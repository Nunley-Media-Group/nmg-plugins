#!/usr/bin/env node

/**
 * Deterministic SDLC Orchestrator
 *
 * Replaces the prompt-engineered heartbeat loop with a Node.js script that
 * deterministically orchestrates `claude -p` subprocess invocations for each
 * SDLC step. All SDLC work still executes inside Claude Code sessions.
 *
 * Usage:
 *   node sdlc-runner.mjs --config <path-to-sdlc-config.json>
 *   node sdlc-runner.mjs --config <path> --dry-run
 *   node sdlc-runner.mjs --config <path> --step 4
 *   node sdlc-runner.mjs --config <path> --resume
 */

import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    config:  { type: 'string'  },
    'dry-run': { type: 'boolean', default: false },
    'discord-channel': { type: 'string' },
    step:    { type: 'string'  },
    resume:  { type: 'boolean', default: false },
    help:    { type: 'boolean', default: false },
  },
  strict: true,
});

if (args.help) {
  console.log(`
Usage: node sdlc-runner.mjs --config <path> [options]

Options:
  --config <path>            Path to sdlc-config.json (required)
  --dry-run                  Log actions without executing
  --discord-channel <id>     Discord channel ID for status updates
  --step <N>                 Run only step N (1-9), then exit
  --resume                   Resume from existing sdlc-state.json
  --help                     Show this help
`);
  process.exit(0);
}

if (!args.config) {
  console.error('Error: --config <path> is required');
  process.exit(1);
}

const DRY_RUN = args['dry-run'];
const SINGLE_STEP = args.step ? parseInt(args.step, 10) : null;
const RESUME = args.resume;

// ---------------------------------------------------------------------------
// Load configuration
// ---------------------------------------------------------------------------

const configPath = path.resolve(args.config);
if (!fs.existsSync(configPath)) {
  console.error(`Error: config file not found: ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const PROJECT_PATH = config.projectPath;
const PLUGINS_PATH = config.pluginsPath;
const MODEL = config.model || 'opus';
const MAX_RETRIES = config.maxRetriesPerStep || 3;

const DISCORD_CHANNEL = args['discord-channel'] || config.discordChannelId || null;
const CLEANUP_PATTERNS = config.cleanup?.processPatterns || [];

if (!PROJECT_PATH || !PLUGINS_PATH) {
  console.error('Error: config must include projectPath and pluginsPath');
  process.exit(1);
}

const STATE_PATH = path.join(PROJECT_PATH, '.claude', 'sdlc-state.json');

// Failure loop detection — in-memory, not persisted to state file
const MAX_CONSECUTIVE_ESCALATIONS = 2;
let consecutiveEscalations = 0;
const escalatedIssues = new Set();
let bounceCount = 0;

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEP_KEYS = [
  'startCycle',   // 1
  'startIssue',   // 2
  'writeSpecs',   // 3
  'implement',    // 4
  'verify',       // 5
  'commitPush',   // 6
  'createPR',     // 7
  'monitorCI',    // 8
  'merge',        // 9
];

const STEPS = STEP_KEYS.map((key, i) => ({
  number: i + 1,
  key,
  ...(config.steps?.[key] || {}),
}));

// ---------------------------------------------------------------------------
// State management
// ---------------------------------------------------------------------------

function defaultState() {
  return {
    currentStep: 0,
    lastCompletedStep: 0,
    currentIssue: null,
    currentBranch: 'main',
    featureName: null,
    lastTransitionAt: null,
    retries: {},
    runnerPid: process.pid,
  };
}

function readState() {
  if (fs.existsSync(STATE_PATH)) {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  }
  return defaultState();
}

function writeState(state) {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = STATE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
  fs.renameSync(tmp, STATE_PATH);
}

function updateState(patch) {
  const state = readState();
  Object.assign(state, patch, { lastTransitionAt: new Date().toISOString() });
  writeState(state);
  return state;
}

/**
 * Inspect git state and filesystem artifacts to detect in-progress work.
 * Called on every startup to hydrate state from reality, not from a potentially
 * stale state file.
 *
 * Returns a state patch object if work is detected, or null to fall through
 * to normal startup behavior.
 */
function detectAndHydrateState() {
  let branch;
  try {
    branch = git('rev-parse --abbrev-ref HEAD');
  } catch {
    log('detectAndHydrateState: could not determine current branch');
    return null;
  }

  if (branch === 'main') {
    log('detectAndHydrateState: on main branch, proceeding normally');
    return null;
  }

  // Extract issue number from branch name (e.g. "30-feature-slug")
  const branchMatch = branch.match(/^(\d+)-(.+)$/);
  if (!branchMatch) {
    log(`detectAndHydrateState: branch "${branch}" does not match <number>-<slug> pattern, skipping detection`);
    return null;
  }

  const issueNumber = parseInt(branchMatch[1], 10);
  log(`detectAndHydrateState: on feature branch "${branch}", issue #${issueNumber}`);

  // Check if PR is already merged — if so, return to main for a fresh cycle
  try {
    const prState = gh('pr view --json state --jq .state');
    if (prState === 'MERGED') {
      log('detectAndHydrateState: PR is already merged, checking out main for fresh cycle');
      if (!DRY_RUN) {
        git('checkout main');
        git('pull');
      }
      return { _merged: true };
    }
  } catch {
    // No PR exists yet — that's fine, continue probing
  }

  // Probe artifacts from highest to lowest to determine lastCompletedStep
  let lastCompletedStep = 2; // At minimum, we're on a feature branch (step 2 done)

  // Check for spec files (step 3)
  const specsDir = path.join(PROJECT_PATH, '.claude', 'specs');
  let featureName = null;
  if (fs.existsSync(specsDir)) {
    const dirs = fs.readdirSync(specsDir)
      .filter(d => fs.statSync(path.join(specsDir, d)).isDirectory());

    // Try to match by branch slug, otherwise take the last directory
    const slug = branchMatch[2];
    const matched = dirs.find(d => d.includes(slug)) || (dirs.length > 0 ? dirs[dirs.length - 1] : null);

    if (matched) {
      const featureDir = path.join(specsDir, matched);
      const required = ['requirements.md', 'design.md', 'tasks.md', 'feature.gherkin'];
      const allPresent = required.every(f => {
        const fp = path.join(featureDir, f);
        return fs.existsSync(fp) && fs.statSync(fp).size > 0;
      });
      if (allPresent) {
        lastCompletedStep = 3;
        featureName = matched;
      }
    }
  }

  // Check for commits ahead of main (step 4 — conservative; steps 4/5 indistinguishable)
  if (lastCompletedStep >= 3) {
    try {
      const aheadLog = git('log main..HEAD --oneline');
      if (aheadLog) {
        lastCompletedStep = 4;
      }
    } catch { /* ignore */ }
  }

  // Check if branch is pushed to remote with no unpushed commits (step 6)
  if (lastCompletedStep >= 4) {
    try {
      const unpushed = git(`log origin/${branch}..HEAD --oneline`);
      if (!unpushed) {
        // All commits pushed
        lastCompletedStep = 6;
      }
    } catch {
      // Remote branch doesn't exist — not pushed yet
    }
  }

  // Check if PR exists (step 7)
  if (lastCompletedStep >= 6) {
    try {
      gh('pr view --json number');
      lastCompletedStep = 7;
    } catch {
      // No PR yet
    }
  }

  // Check if CI is passing (step 8)
  if (lastCompletedStep >= 7) {
    try {
      const checks = gh('pr checks');
      if (!/fail|pending/i.test(checks)) {
        lastCompletedStep = 8;
      }
    } catch { /* ignore */ }
  }

  log(`detectAndHydrateState: detected lastCompletedStep=${lastCompletedStep}, featureName=${featureName || '<unknown>'}`);

  return {
    currentIssue: issueNumber,
    currentBranch: branch,
    featureName,
    lastCompletedStep,
  };
}

// ---------------------------------------------------------------------------
// Discord reporting via openclaw system event
// ---------------------------------------------------------------------------

async function postDiscord(message) {
  if (!DISCORD_CHANNEL) {
    log('Warning: No Discord channel configured (use --discord-channel or config.discordChannelId)');
    return;
  }
  if (DRY_RUN) {
    log(`[DRY-RUN] Discord: ${message}`);
    return;
  }
  // Use spawn instead of execSync to work around openclaw CLI hang bug:
  // `openclaw message send` delivers the message but never exits because the
  // Discord.js WebSocket stays open (no process.exit() call).
  // See https://github.com/openclaw/openclaw/issues/16460
  const spawnArgs = ['message', 'send', '--channel', 'discord', '--target', DISCORD_CHANNEL, '-m', message];
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const child = spawn('openclaw', spawnArgs, { stdio: 'pipe' });
        let stdout = '';
        let settled = false;
        child.stdout.on('data', (chunk) => {
          stdout += chunk.toString();
          // Once we see the success marker, the message was delivered.
          // Kill the process since it hangs after delivery.
          if (!settled && /Sent via|Message ID/i.test(stdout)) {
            settled = true;
            child.kill();
            resolve();
          }
        });
        child.on('error', (err) => { if (!settled) { settled = true; reject(err); } });
        child.on('close', (code) => {
          if (!settled) {
            settled = true;
            if (code === 0 || code === null) resolve();
            else reject(new Error(`openclaw message send exited with code ${code}: ${stdout}`));
          }
        });
        // Fallback timeout — if no success marker and no exit after 30s, kill it
        setTimeout(() => {
          if (!settled) {
            settled = true;
            child.kill();
            reject(new Error('openclaw message send timed out (30s) with no success marker'));
          }
        }, 30_000);
      });
      return;
    } catch (err) {
      if (attempt < maxAttempts) {
        const backoff = Math.pow(2, attempt) * 1000; // 2s, 4s
        log(`Discord post attempt ${attempt}/${maxAttempts} failed, retrying in ${backoff / 1000}s...`);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, backoff);
      } else {
        log(`Warning: Discord post failed after ${maxAttempts} attempts: ${err.message}`);
      }
    }
  }
}

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

// ---------------------------------------------------------------------------
// Shell helpers
// ---------------------------------------------------------------------------

function git(args, cwd = PROJECT_PATH) {
  return execSync(`git ${args}`, { cwd, encoding: 'utf8', timeout: 30_000 }).trim();
}

function gh(args, cwd = PROJECT_PATH) {
  return execSync(`gh ${args}`, { cwd, encoding: 'utf8', timeout: 60_000 }).trim();
}

// Runner-managed files that should not count as "dirty" working tree
const RUNNER_ARTIFACTS = ['.claude/sdlc-state.json', '.claude/auto-mode'];

function removeAutoMode() {
  try {
    fs.unlinkSync(path.join(PROJECT_PATH, '.claude', 'auto-mode'));
    log('Removed .claude/auto-mode flag');
  } catch { /* best effort — file may not exist */ }
}

/**
 * Commit and push any dirty working-tree changes (excluding runner artifacts).
 * Non-fatal — logs warnings on failure. Returns true if a commit was made.
 */
function autoCommitIfDirty(message) {
  try {
    const status = git('status --porcelain');
    if (!status) return false;

    // Filter out runner artifacts
    const meaningful = status
      .split('\n')
      .filter(line => !RUNNER_ARTIFACTS.some(f => line.trimStart().endsWith(f)))
      .join('\n')
      .trim();

    if (!meaningful) {
      log('Auto-commit: only runner artifacts changed, skipping.');
      return false;
    }

    if (DRY_RUN) {
      log(`[DRY-RUN] Would auto-commit: ${message}`);
      return true;
    }

    git('add -A');
    git(`commit -m "${message.replace(/"/g, '\\"')}"`);
    git('push');
    log(`Auto-committed: ${message}`);
    return true;
  } catch (err) {
    log(`Warning: autoCommitIfDirty failed: ${err.message}`);
    return false;
  }
}

function shellEscape(str) {
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

// ---------------------------------------------------------------------------
// Process cleanup
// ---------------------------------------------------------------------------

function cleanupProcesses() {
  if (CLEANUP_PATTERNS.length === 0) return;

  for (const pattern of CLEANUP_PATTERNS) {
    try {
      const escaped = shellEscape(pattern);
      // Find matching PIDs, excluding our own process
      let pids;
      try {
        pids = execSync(`pgrep -f ${escaped}`, { encoding: 'utf8', timeout: 5_000 }).trim();
      } catch {
        // Exit code 1 means no matches — that's fine
        continue;
      }

      if (!pids) continue;

      // Filter out our own PID
      const pidList = pids.split('\n').filter(p => parseInt(p, 10) !== process.pid);
      if (pidList.length === 0) continue;

      try {
        execSync(`pkill -f ${escaped}`, { encoding: 'utf8', timeout: 5_000 });
      } catch {
        // pkill exit code 1 means no matches (race with pgrep); ignore
      }

      log(`[CLEANUP] Killed ${pidList.length} process(es) matching "${pattern}"`);
    } catch (err) {
      log(`[CLEANUP] Warning: error cleaning up pattern "${pattern}": ${err.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Precondition validation
// ---------------------------------------------------------------------------

function validatePreconditions(step, state) {
  switch (step.number) {
    case 1: // Start cycle — no preconditions
      return { ok: true };

    case 2: { // Start issue — clean main branch
      try {
        const status = git('status --porcelain')
          .split('\n')
          .filter(line => !RUNNER_ARTIFACTS.some(f => line.trimStart().endsWith(f)))
          .join('\n')
          .trim();
        const branch = git('rev-parse --abbrev-ref HEAD');
        if (status.length > 0) return { ok: false, reason: 'Working tree is dirty' };
        if (branch !== 'main') return { ok: false, reason: `Expected main branch, on ${branch}` };
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: `Git check failed: ${err.message}` };
      }
    }

    case 3: { // Write specs — feature branch exists, issue known
      const branch = git('rev-parse --abbrev-ref HEAD');
      if (branch === 'main') return { ok: false, reason: 'Still on main, expected feature branch' };
      if (!state.currentIssue) return { ok: false, reason: 'No current issue set in state' };
      return { ok: true };
    }

    case 4: { // Implement — all 4 spec files exist
      const specsDir = path.join(PROJECT_PATH, '.claude', 'specs');
      if (!fs.existsSync(specsDir)) return { ok: false, reason: 'No .claude/specs directory' };
      const features = fs.readdirSync(specsDir).filter(d =>
        fs.statSync(path.join(specsDir, d)).isDirectory()
      );
      const featureDir = state.featureName
        ? path.join(specsDir, state.featureName)
        : features.length > 0 ? path.join(specsDir, features[features.length - 1]) : null;

      if (!featureDir || !fs.existsSync(featureDir)) {
        return { ok: false, reason: 'No feature spec directory found' };
      }

      const required = ['requirements.md', 'design.md', 'tasks.md', 'feature.gherkin'];
      const missing = required.filter(f => {
        const fp = path.join(featureDir, f);
        return !fs.existsSync(fp) || fs.statSync(fp).size === 0;
      });
      if (missing.length > 0) {
        return { ok: false, reason: `Missing spec files: ${missing.join(', ')}` };
      }
      return { ok: true };
    }

    case 5: { // Verify — implementation committed on feature branch
      const branch = git('rev-parse --abbrev-ref HEAD');
      if (branch === 'main') return { ok: false, reason: 'On main, expected feature branch' };
      try {
        const log = git('log main..HEAD --oneline');
        if (!log) return { ok: false, reason: 'No commits ahead of main' };
      } catch {
        // If main doesn't exist as a ref, just check we have commits
      }
      return { ok: true };
    }

    case 6: // Commit/push — no strict preconditions (step handles it)
      return { ok: true };

    case 7: { // Create PR — branch pushed to remote
      const branch = git('rev-parse --abbrev-ref HEAD');
      try {
        const unpushed = git(`log origin/${branch}..HEAD --oneline`);
        if (unpushed) return { ok: false, reason: 'Unpushed commits exist' };
      } catch {
        return { ok: false, reason: 'Remote branch not found — push first' };
      }
      return { ok: true };
    }

    case 8: { // Monitor CI — PR exists
      try {
        gh('pr view --json number');
        return { ok: true };
      } catch {
        return { ok: false, reason: 'No PR found for current branch' };
      }
    }

    case 9: { // Merge — CI passing
      try {
        const checks = gh('pr checks');
        if (/fail/i.test(checks)) return { ok: false, reason: 'CI checks failing' };
        return { ok: true };
      } catch {
        return { ok: false, reason: 'Could not check PR status' };
      }
    }

    default:
      return { ok: true };
  }
}

// ---------------------------------------------------------------------------
// Build claude -p arguments for each step
// ---------------------------------------------------------------------------

function readSkill(skillName) {
  const skillPath = path.join(PLUGINS_PATH, 'plugins', 'nmg-sdlc', 'skills', skillName, 'SKILL.md');
  if (!fs.existsSync(skillPath)) {
    throw new Error(`Skill file not found: ${skillPath}`);
  }
  return fs.readFileSync(skillPath, 'utf8');
}

function buildClaudeArgs(step, state) {
  const issue = state.currentIssue || '<unknown>';
  const branch = state.currentBranch || '<unknown>';
  const skillRoot = step.skill
    ? `${PLUGINS_PATH}/plugins/nmg-sdlc/skills/${step.skill}`
    : null;

  const prompts = {
    1: 'Check out main and pull latest. Run: git checkout main && git pull. Report the current branch and latest commit.',

    2: `Select and start the next GitHub issue from the current milestone. Create a linked feature branch and set the issue to In Progress.${escalatedIssues.size > 0 ? ` Do NOT select any of these previously-escalated issues: ${[...escalatedIssues].map(i => `#${i}`).join(', ')}.` : ''} Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/.`,

    3: `Write BDD specifications for issue #${issue} on branch ${branch}. Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/.`,

    4: `Implement the specifications for issue #${issue} on branch ${branch}. Do NOT call EnterPlanMode — this is a headless session with no user to approve plans. Design your approach internally, then implement directly. Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/.`,

    5: `Verify the implementation for issue #${issue} on branch ${branch}. Fix any findings. Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/.`,

    6: `Stage all changes, commit with a meaningful conventional-commit message summarizing the work for issue #${issue}, and push to the remote branch ${branch}. After pushing, verify the push succeeded by running git log origin/${branch}..HEAD --oneline — if any unpushed commits remain, or if git push reported an error, exit with a non-zero status code.`,

    7: `Create a pull request for branch ${branch} targeting main for issue #${issue}. Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/.`,

    8: [
      `Monitor CI for the PR on branch ${branch}. Follow these steps exactly:`,
      `1. Run \`gh pr checks\` and poll every 30 seconds until no checks are "pending".`,
      `2. If all checks pass, report success and exit with code 0.`,
      `3. If any check fails:`,
      `   a. Read the CI logs for the failing check(s) to diagnose the root cause.`,
      `   b. Before applying any fix, review the spec files in .claude/specs/ to ensure`,
      `      the fix does not deviate from specified behavior. If the only correct fix`,
      `      would change specified behavior, exit with a non-zero status explaining why.`,
      `   c. Apply the minimal fix, commit with a "fix:" conventional-commit message, and push.`,
      `   d. Return to step 1 to re-poll CI after the push.`,
      `4. If you cannot fix the failure after 3 attempts, exit with a non-zero status`,
      `   explaining what failed and why you could not fix it.`,
      `5. Only exit with code 0 when ALL CI checks show as passing.`,
    ].join('\n'),

    9: `First verify CI is passing with gh pr checks. If any check is failing, do NOT merge — report the failure and exit with a non-zero status. If all checks pass, merge the current PR to main and delete the remote branch ${branch}.`,
  };

  const claudeArgs = [
    '--model', MODEL,
    '-p', prompts[step.number],
    '--dangerously-skip-permissions',
    '--output-format', 'json',
    '--max-turns', String(step.maxTurns || 20),
  ];

  if (step.skill) {
    const skillContent = readSkill(step.skill);
    claudeArgs.push('--append-system-prompt', skillContent);
  }

  return claudeArgs;
}

// ---------------------------------------------------------------------------
// Claude subprocess execution
// ---------------------------------------------------------------------------

function runClaude(step, state) {
  const claudeArgs = buildClaudeArgs(step, state);
  const timeoutMs = (step.timeoutMin || 10) * 60 * 1000;

  if (DRY_RUN) {
    log(`[DRY-RUN] Would run: claude ${claudeArgs.slice(0, 6).join(' ')} ... (timeout: ${step.timeoutMin || 10}min)`);
    return Promise.resolve({ exitCode: 0, stdout: '{"result":"dry-run"}', stderr: '', duration: 0 });
  }

  return new Promise((resolve) => {
    const startTime = Date.now();
    const ac = new AbortController();

    const proc = spawn('claude', claudeArgs, {
      cwd: PROJECT_PATH,
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: ac.signal,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.stderr.on('data', (chunk) => { stderr += chunk; });

    // Stall timeout
    const timer = setTimeout(() => {
      log(`Step ${step.number} exceeded timeout (${step.timeoutMin || 10}min). Sending SIGTERM...`);
      proc.kill('SIGTERM');
      // Grace period then SIGKILL
      setTimeout(() => {
        if (!proc.killed) {
          log('Grace period expired. Sending SIGKILL...');
          proc.kill('SIGKILL');
        }
      }, 5_000);
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        duration: Math.round((Date.now() - startTime) / 1000),
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr + '\n' + err.message,
        duration: Math.round((Date.now() - startTime) / 1000),
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Error pattern matching
// ---------------------------------------------------------------------------

const IMMEDIATE_ESCALATION_PATTERNS = [
  /context_window_exceeded/i,
  /signal:\s*9/i,
  /signal:\s*SIGKILL/i,
  /permission denied/i,
  /EnterPlanMode/,
];

const RATE_LIMIT_PATTERN = /rate_limit/i;

function matchErrorPattern(output) {
  for (const pattern of IMMEDIATE_ESCALATION_PATTERNS) {
    if (pattern.test(output)) return { action: 'escalate', pattern: pattern.source };
  }
  if (RATE_LIMIT_PATTERN.test(output)) return { action: 'wait', pattern: 'rate_limit' };
  return null;
}

// ---------------------------------------------------------------------------
// Bounce loop detection
// ---------------------------------------------------------------------------

/**
 * Increment the per-cycle bounce counter and check whether the bounce-loop
 * threshold has been exceeded.  Returns true when the caller should escalate.
 */
function incrementBounceCount() {
  bounceCount++;
  if (bounceCount > MAX_RETRIES) {
    log(`Bounce loop detected: ${bounceCount} step-back transitions exceed threshold ${MAX_RETRIES}`);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Failure handling
// ---------------------------------------------------------------------------

async function handleFailure(step, result, state) {
  const output = result.stdout + '\n' + result.stderr;

  // 1. Check for known error patterns
  const patternMatch = matchErrorPattern(output);
  if (patternMatch?.action === 'escalate') {
    log(`Immediate escalation: matched pattern "${patternMatch.pattern}"`);
    await escalate(step, `Matched unrecoverable pattern: ${patternMatch.pattern}`, output);
    return 'escalated';
  }

  if (patternMatch?.action === 'wait') {
    log('Rate limited. Waiting 60s before retry...');
    await postDiscord(`Rate limited on Step ${step.number}. Waiting 60s...`);
    await sleep(60_000);
  }

  // 2. Check input artifacts for prior step
  if (step.number > 1) {
    const prevStep = STEPS[step.number - 2];
    const preconds = validatePreconditions(step, state);
    if (!preconds.ok) {
      if (incrementBounceCount()) {
        await escalate(step, `Bounce loop: ${bounceCount} step-back transitions exceed threshold ${MAX_RETRIES}`, output);
        return 'escalated';
      }
      log(`Step ${step.number} preconditions failed: ${preconds.reason}. Will retry step ${prevStep.number}. (bounce ${bounceCount}/${MAX_RETRIES})`);
      await postDiscord(`Step ${step.number} preconditions failed: ${preconds.reason}. Retrying Step ${prevStep.number}. (bounce ${bounceCount}/${MAX_RETRIES})`);
      return 'retry-previous';
    }
  }

  // 3. Commit dirty working tree
  try {
    const status = git('status --porcelain');
    if (status) {
      log('Committing dirty working tree before retry...');
      if (!DRY_RUN) {
        git('add -A');
        git('commit -m "chore: save work before retry (step ' + step.number + ')"');
        git('push');
      }
    }
  } catch {
    // Non-fatal
  }

  // 4. Check retry count
  const retries = state.retries || {};
  const count = (retries[step.number] || 0) + 1;
  if (count >= MAX_RETRIES) {
    log(`Step ${step.number} exhausted retries (${count}/${MAX_RETRIES}). Escalating.`);
    await escalate(step, `Exhausted ${MAX_RETRIES} retries`, output);
    return 'escalated';
  }

  // 5. Increment retry and signal to relaunch
  updateState({ retries: { ...retries, [step.number]: count } });
  await postDiscord(`Step ${step.number} failed (attempt ${count}/${MAX_RETRIES}). Retrying...`);
  log(`Retry ${count}/${MAX_RETRIES} for step ${step.number}`);
  return 'retry';
}

// ---------------------------------------------------------------------------
// Escalation
// ---------------------------------------------------------------------------

async function escalate(step, reason, output = '') {
  const state = readState();
  const truncated = (output || '').slice(-500);

  // Track escalated issues and consecutive escalation count
  if (state.currentIssue) escalatedIssues.add(state.currentIssue);
  consecutiveEscalations++;

  if (consecutiveEscalations >= MAX_CONSECUTIVE_ESCALATIONS) {
    await haltFailureLoop('consecutive escalations', [
      `Issues: ${[...escalatedIssues].map(i => `#${i}`).join(', ')}`,
      `Last step: ${step.number} (${step.key})`,
      `Reason: ${reason}`,
      truncated ? `Last output: ...${truncated}` : '',
    ]);
  }

  cleanupProcesses();

  log(`ESCALATION: Step ${step.number} — ${reason}`);

  // Commit/push partial work
  try {
    const status = git('status --porcelain');
    if (status && !DRY_RUN) {
      git('add -A');
      git('commit -m "chore: save partial work before escalation"');
      git('push');
    }
  } catch { /* non-fatal */ }

  // Return to main
  try {
    if (!DRY_RUN) git('checkout main');
  } catch { /* non-fatal */ }

  // Post diagnostic
  const diagnostic = [
    `ESCALATION: Step ${step.number} (${step.key}) failed.`,
    `Reason: ${reason}`,
    `Retries: ${JSON.stringify(state.retries)}`,
    `Branch: ${state.currentBranch}`,
    `Issue: ${state.currentIssue || 'none'}`,
    truncated ? `Last output: ...${truncated}` : '',
    'Manual intervention required.',
  ].filter(Boolean).join('\n');

  await postDiscord(diagnostic);

  // Clean up auto-mode flag and reset state
  removeAutoMode();
  updateState({ currentStep: 0, lastCompletedStep: 0 });
}

/**
 * Halt the runner due to a detected failure loop.
 * Does NOT call removeAutoMode(), updateState(), or git checkout —
 * preserves all state for manual inspection.
 */
async function haltFailureLoop(loopType, details) {
  const diagnostic = [
    `FAILURE LOOP DETECTED: ${loopType}`,
    ...details,
    `Consecutive escalations: ${consecutiveEscalations}`,
    `Escalated issues: ${escalatedIssues.size > 0 ? [...escalatedIssues].map(i => `#${i}`).join(', ') : 'none'}`,
    'State preserved for manual inspection.',
  ].filter(Boolean).join('\n');

  log(diagnostic);
  await postDiscord(diagnostic);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Post-step state extraction
// ---------------------------------------------------------------------------

function extractStateFromStep(step, result, state) {
  const output = result.stdout;
  const patch = {};

  if (step.number === 1) {
    // After checkout main, reset cycle state
    patch.currentIssue = null;
    patch.currentBranch = 'main';
    patch.featureName = null;
    patch.retries = {};
  }

  if (step.number === 2) {
    // Try to extract issue number and branch from output
    const issueMatch = output.match(/#(\d+)/);
    if (issueMatch) patch.currentIssue = parseInt(issueMatch[1], 10);

    try {
      const branch = git('rev-parse --abbrev-ref HEAD');
      if (branch !== 'main') patch.currentBranch = branch;
    } catch { /* ignore */ }
  }

  if (step.number === 3) {
    // Try to detect the feature name from specs directory
    const specsDir = path.join(PROJECT_PATH, '.claude', 'specs');
    if (fs.existsSync(specsDir)) {
      const dirs = fs.readdirSync(specsDir)
        .filter(d => fs.statSync(path.join(specsDir, d)).isDirectory())
        .sort(); // lexicographic — newest usually last
      if (dirs.length > 0) {
        patch.featureName = dirs[dirs.length - 1];
      }
    }
  }

  if (step.number === 7) {
    // Try to extract PR number from output
    const prMatch = output.match(/pull\/(\d+)/);
    if (prMatch) patch.prNumber = parseInt(prMatch[1], 10);
  }

  if (step.number === 9) {
    // Merged — reset for next cycle
    patch.currentStep = 0;
    patch.lastCompletedStep = 0;
    patch.currentIssue = null;
    patch.currentBranch = 'main';
    patch.featureName = null;
    patch.retries = {};
  }

  return patch;
}

// ---------------------------------------------------------------------------
// Check for remaining open issues
// ---------------------------------------------------------------------------

function hasOpenIssues() {
  try {
    const issues = gh('issue list --state open --limit 1 --json number');
    const parsed = JSON.parse(issues);
    return parsed.length > 0;
  } catch {
    log('Warning: could not check for open issues. Assuming there are some.');
    return true;
  }
}

function hasNonEscalatedIssues() {
  try {
    const issues = gh('issue list --state open --json number');
    const parsed = JSON.parse(issues);
    return parsed.some(i => !escalatedIssues.has(i.number));
  } catch {
    log('Warning: could not check for non-escalated issues. Assuming there are some.');
    return true;
  }
}

// ---------------------------------------------------------------------------
// Spec validation gate (post-step-3)
// ---------------------------------------------------------------------------

function validateSpecs(state) {
  const specsDir = path.join(PROJECT_PATH, '.claude', 'specs');
  if (!fs.existsSync(specsDir)) return { ok: false, missing: ['specs directory'] };

  const features = fs.readdirSync(specsDir).filter(d =>
    fs.statSync(path.join(specsDir, d)).isDirectory()
  );
  const featureDir = state.featureName
    ? path.join(specsDir, state.featureName)
    : features.length > 0 ? path.join(specsDir, features[features.length - 1]) : null;

  if (!featureDir || !fs.existsSync(featureDir)) {
    return { ok: false, missing: ['feature directory'] };
  }

  const required = ['requirements.md', 'design.md', 'tasks.md', 'feature.gherkin'];
  const missing = required.filter(f => {
    const fp = path.join(featureDir, f);
    return !fs.existsSync(fp) || fs.statSync(fp).size === 0;
  });

  // Update feature name in state if we found it
  const featureName = path.basename(featureDir);
  if (featureName !== state.featureName) {
    updateState({ featureName });
  }

  return { ok: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// CI validation gate (post-step-8)
// ---------------------------------------------------------------------------

function validateCI() {
  try {
    const checks = gh('pr checks');
    if (/fail/i.test(checks)) {
      return { ok: false, reason: 'CI checks still failing after Step 8' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `Could not check CI status: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// Push validation gate (post-step-6)
// ---------------------------------------------------------------------------

function validatePush() {
  try {
    const branch = git('rev-parse --abbrev-ref HEAD');
    git('fetch');
    const unpushed = git(`log origin/${branch}..HEAD --oneline`);
    if (unpushed) {
      return { ok: false, reason: 'Unpushed commits remain after push' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `Push validation check failed: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Signal handling (graceful shutdown)
// ---------------------------------------------------------------------------

let currentProcess = null;
let shuttingDown = false;

async function handleSignal(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`Received ${signal}. Shutting down gracefully...`);

  // Kill current subprocess
  if (currentProcess && !currentProcess.killed) {
    currentProcess.kill('SIGTERM');
  }

  cleanupProcesses();

  // Commit/push any work
  try {
    const status = git('status --porcelain');
    if (status) {
      git('add -A');
      git('commit -m "chore: save work on signal ' + signal + '"');
      git('push');
    }
  } catch { /* best effort */ }

  const savedState = readState();
  const nextStep = (savedState.lastCompletedStep || 0) + 1;
  await postDiscord(`SDLC runner stopped (${signal}). Work saved. Resume with --resume to continue from Step ${nextStep}.`);
  // Preserve lastCompletedStep for resume — don't reset step tracking
  updateState({ runnerPid: null });
  removeAutoMode();
  process.exit(0);
}

process.on('SIGTERM', () => handleSignal('SIGTERM'));
process.on('SIGINT', () => handleSignal('SIGINT'));

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function runStep(step, state) {
  log(`=== Step ${step.number}: ${step.key} ===`);

  // Validate preconditions
  const preconds = validatePreconditions(step, state);
  if (!preconds.ok) {
    log(`Preconditions failed for step ${step.number}: ${preconds.reason}`);
    await postDiscord(`Step ${step.number} (${step.key}) preconditions failed: ${preconds.reason}`);

    if (step.number > 1) {
      const prevStep = STEPS[step.number - 2];
      if (incrementBounceCount()) {
        await escalate(prevStep, `Bounce loop: ${bounceCount} step-back transitions exceed threshold ${MAX_RETRIES} (precondition: ${preconds.reason})`);
        return 'escalated';
      }
      await postDiscord(`Retrying Step ${prevStep.number} (${prevStep.key}) to produce required artifacts. (bounce ${bounceCount}/${MAX_RETRIES})`);
      // Increment retry for the previous step
      const retries = state.retries || {};
      const prevCount = (retries[prevStep.number] || 0) + 1;
      if (prevCount >= MAX_RETRIES) {
        await escalate(prevStep, `Precondition check for step ${step.number} failed ${MAX_RETRIES} times: ${preconds.reason}`);
        return 'escalated';
      }
      updateState({
        currentStep: prevStep.number,
        retries: { ...retries, [prevStep.number]: prevCount },
      });
      return 'retry-previous';
    }
    return 'skip';
  }

  // Update state
  state = updateState({ currentStep: step.number });
  await postDiscord(`Starting Step ${step.number}: ${step.key}${state.currentIssue ? ` (issue #${state.currentIssue})` : ''}...`);

  // Run claude
  const result = await runClaude(step, state);
  log(`Step ${step.number} exited with code ${result.exitCode} in ${result.duration}s`);
  cleanupProcesses();

  if (result.exitCode === 0) {
    // Extract state updates
    const patch = extractStateFromStep(step, result, state);
    // Track completed step for resume (step 9 resets this to 0 via its own patch)
    if (patch.lastCompletedStep === undefined) {
      patch.lastCompletedStep = step.number;
    }
    state = updateState(patch);

    // Special: spec validation gate after step 3
    if (step.number === 3) {
      const specCheck = validateSpecs(state);
      if (!specCheck.ok) {
        log(`Spec validation failed: missing ${specCheck.missing.join(', ')}`);
        await postDiscord(`Spec validation failed after Step 3 — missing: ${specCheck.missing.join(', ')}. Retrying...`);
        const retries = state.retries || {};
        const count = (retries[3] || 0) + 1;
        if (count >= MAX_RETRIES) {
          await escalate(step, `Spec validation failed after ${MAX_RETRIES} attempts`);
          return 'escalated';
        }
        updateState({ retries: { ...retries, 3: count } });
        return 'retry';
      }
    }

    // Special: push validation gate after step 6
    if (step.number === 6) {
      const pushCheck = validatePush();
      if (!pushCheck.ok) {
        log(`Push validation failed: ${pushCheck.reason}`);
        await postDiscord(`Push validation failed after Step 6 — ${pushCheck.reason}. Retrying...`);
        const retries = state.retries || {};
        const count = (retries[6] || 0) + 1;
        if (count >= MAX_RETRIES) {
          await escalate(step, `Push validation failed after ${MAX_RETRIES} attempts`);
          return 'escalated';
        }
        updateState({ retries: { ...retries, 6: count } });
        return 'retry';
      }
    }

    // Auto-commit implementation so Step 5's "commits ahead of main" precondition passes
    if (step.number === 4) {
      const issue = state.currentIssue || 'unknown';
      const committed = autoCommitIfDirty(`feat: implement issue #${issue}`);
      if (committed) {
        await postDiscord('Auto-committed implementation changes after Step 4.');
      }
    }

    // Special: CI validation gate after step 8
    if (step.number === 8) {
      const ciCheck = validateCI();
      if (!ciCheck.ok) {
        log(`CI validation failed: ${ciCheck.reason}`);
        await postDiscord(`CI validation failed after Step 8 — ${ciCheck.reason}. Retrying...`);
        const retries = state.retries || {};
        const count = (retries[8] || 0) + 1;
        if (count >= MAX_RETRIES) {
          await escalate(step, `CI validation failed after ${MAX_RETRIES} attempts`);
          return 'escalated';
        }
        updateState({ retries: { ...retries, 8: count } });
        return 'retry';
      }
    }

    await postDiscord(`Step ${step.number} (${step.key}) complete.${result.duration > 60 ? ` (${Math.round(result.duration / 60)}min)` : ''}`);
    return 'ok';
  }

  // Handle failure
  return await handleFailure(step, result, state);
}

async function main() {
  log('SDLC Runner starting...');
  log(`Config: ${configPath}`);
  log(`Project: ${PROJECT_PATH}`);
  log(`Plugins: ${PLUGINS_PATH}`);
  log(`Model: ${MODEL}`);
  log(`Discord channel: ${DISCORD_CHANNEL || 'none (updates will be skipped)'}`);
  if (DRY_RUN) log('DRY-RUN MODE — no actions will be executed');
  if (SINGLE_STEP) log(`Single step mode: running only step ${SINGLE_STEP}`);
  if (RESUME) log('Resume mode: continuing from existing state');

  // Ensure auto-mode flag exists
  const autoModePath = path.join(PROJECT_PATH, '.claude', 'auto-mode');
  if (!fs.existsSync(autoModePath)) {
    const dir = path.dirname(autoModePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(autoModePath, '');
    log('Created .claude/auto-mode flag');
  }

  // Detect in-progress work from git state (runs on every startup)
  const detected = detectAndHydrateState();
  let state;

  if (detected && detected._merged) {
    // PR was merged but we were still on the feature branch — start fresh
    state = defaultState();
    writeState(state);
    log('Detected merged PR on feature branch. Checked out main for fresh cycle.');
    await postDiscord('Detected merged PR — checked out main, starting fresh cycle.');
  } else if (detected) {
    // In-progress work detected from git/filesystem artifacts
    const nextStep = detected.lastCompletedStep + 1;

    // Preserve retry counts from state file if --resume was passed
    if (RESUME && fs.existsSync(STATE_PATH)) {
      const savedState = readState();
      detected.retries = savedState.retries || {};
    } else {
      detected.retries = {};
    }

    state = { ...defaultState(), ...detected };
    writeState(state);
    log(`Detected in-progress work: issue #${detected.currentIssue}, branch "${detected.currentBranch}", lastCompletedStep=${detected.lastCompletedStep} — resuming from step ${nextStep}`);
    await postDiscord(`Detected in-progress work on issue #${detected.currentIssue} (step ${detected.lastCompletedStep} complete). Resuming from Step ${nextStep}.`);
  } else if (RESUME) {
    // No feature branch detected but --resume passed — use state file
    state = readState();
    const nextStep = (state.lastCompletedStep || 0) + 1;
    log(`Resuming: last completed step ${state.lastCompletedStep || 0}, starting from step ${nextStep}. Issue: #${state.currentIssue || 'none'}`);
    await postDiscord(`SDLC runner resuming from Step ${nextStep}.`);
  } else {
    // Fresh start on main — normal behavior
    state = defaultState();
    writeState(state);
    await postDiscord('SDLC runner started.');
  }

  // Record PID
  updateState({ runnerPid: process.pid });

  // Single step mode
  if (SINGLE_STEP) {
    const step = STEPS[SINGLE_STEP - 1];
    if (!step) {
      console.error(`Invalid step number: ${SINGLE_STEP}`);
      removeAutoMode();
      process.exit(1);
    }
    state = readState();
    const result = await runStep(step, state);
    log(`Single step result: ${result}`);
    removeAutoMode();
    process.exit(result === 'ok' ? 0 : 1);
  }

  // Main continuous loop
  while (!shuttingDown) {
    // Check for open issues
    if (!DRY_RUN && !hasOpenIssues()) {
      log('No more open issues. All done!');
      await postDiscord('No more open issues in the project. SDLC runner complete.');
      updateState({ currentStep: 0 });
      removeAutoMode();
      break;
    }

    // Check if all remaining issues have been escalated this session
    if (!DRY_RUN && escalatedIssues.size > 0 && !hasNonEscalatedIssues()) {
      await haltFailureLoop('all issues escalated', [
        `All open issues have been escalated: ${[...escalatedIssues].map(i => `#${i}`).join(', ')}`,
        'No non-escalated issues remain.',
      ]);
    }

    // Determine starting step
    state = readState();
    let startIdx = 0;
    if (state.lastCompletedStep > 0) {
      // Skip already-completed steps — start from the one after lastCompletedStep
      startIdx = state.lastCompletedStep; // 1-indexed step → 0-indexed array position of next step
      log(`Continuing from step ${startIdx + 1} (last completed: ${state.lastCompletedStep})`);
    }

    // Reset bounce counter for each cycle
    bounceCount = 0;

    for (let i = startIdx; i < STEPS.length; i++) {
      if (shuttingDown) break;

      const step = STEPS[i];
      let result = await runStep(step, readState());

      // Handle retry on same step
      while (result === 'retry' && !shuttingDown) {
        result = await runStep(step, readState());
      }

      // Handle retry of previous step
      if (result === 'retry-previous' && i > 0) {
        i -= 2; // Will be incremented by for loop to i-1
        continue;
      }

      if (result === 'escalated') {
        log('Escalation triggered. Stopping cycle.');
        // Break to outer loop which will check for issues again
        break;
      }

      if (result === 'skip') {
        log(`Skipping step ${step.number}`);
        continue;
      }

      // Post-step-2 safety check: halt if Claude selected an escalated issue
      if (result === 'ok' && step.number === 2) {
        const freshState = readState();
        if (freshState.currentIssue && escalatedIssues.has(freshState.currentIssue)) {
          await haltFailureLoop('all issues escalated', [
            `Step 2 selected issue #${freshState.currentIssue} which was previously escalated.`,
            `Escalated issues: ${[...escalatedIssues].map(i => `#${i}`).join(', ')}`,
          ]);
        }
      }

      // After successful merge (step 9), reset consecutive escalation counter
      if (result === 'ok' && step.number === 9) {
        consecutiveEscalations = 0;
      }
    }

    // After a full cycle (or escalation), reset for next iteration
    state = readState();
    if (state.currentStep === 0) {
      // Clean cycle completion or escalation reset — check for more issues
      continue;
    }

    // If we got here from an escalation mid-cycle, the state was already reset
    state = updateState({ currentStep: 0, lastCompletedStep: 0 });
  }

  log('SDLC Runner exiting.');
}

main().catch(async (err) => {
  log(`Fatal error: ${err.message}`);
  await postDiscord(`SDLC runner crashed: ${err.message}`);
  removeAutoMode();
  process.exit(1);
});
