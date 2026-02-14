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
  --config <path>   Path to sdlc-config.json (required)
  --dry-run         Log actions without executing
  --step <N>        Run only step N (1-9), then exit
  --resume          Resume from existing sdlc-state.json
  --help            Show this help
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

if (!PROJECT_PATH || !PLUGINS_PATH) {
  console.error('Error: config must include projectPath and pluginsPath');
  process.exit(1);
}

const STATE_PATH = path.join(PROJECT_PATH, '.claude', 'sdlc-state.json');

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

// ---------------------------------------------------------------------------
// Discord reporting via openclaw system event
// ---------------------------------------------------------------------------

function postDiscord(message) {
  const escaped = message.replace(/'/g, "'\\''");
  const cmd = `openclaw system event --text '${escaped}' --mode now`;
  if (DRY_RUN) {
    log(`[DRY-RUN] Discord: ${message}`);
    return;
  }
  try {
    execSync(cmd, { timeout: 15_000, stdio: 'pipe' });
  } catch (err) {
    log(`Warning: Discord post failed: ${err.message}`);
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

// ---------------------------------------------------------------------------
// Precondition validation
// ---------------------------------------------------------------------------

function validatePreconditions(step, state) {
  switch (step.number) {
    case 1: // Start cycle — no preconditions
      return { ok: true };

    case 2: { // Start issue — clean main branch
      try {
        const RUNNER_FILES = ['.claude/sdlc-state.json', '.claude/auto-mode'];
        const status = git('status --porcelain')
          .split('\n')
          .filter(line => !RUNNER_FILES.some(f => line.trimStart().endsWith(f)))
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

    2: `Select and start the next GitHub issue from the current milestone. Create a linked feature branch and set the issue to In Progress. Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/.`,

    3: `Write BDD specifications for issue #${issue} on branch ${branch}. Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/.`,

    4: `Implement the specifications for issue #${issue} on branch ${branch}. Do NOT call EnterPlanMode — this is a headless session with no user to approve plans. Design your approach internally, then implement directly. Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/.`,

    5: `Verify the implementation for issue #${issue} on branch ${branch}. Fix any findings. Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/.`,

    6: `Stage all changes, commit with a meaningful conventional-commit message summarizing the work for issue #${issue}, and push to the remote branch ${branch}. Verify the push succeeded.`,

    7: `Create a pull request for branch ${branch} targeting main for issue #${issue}. Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/.`,

    8: `Monitor CI status for the current PR on branch ${branch}. Poll until CI completes. If CI fails, diagnose the failure, fix it locally, verify the fix, commit and push. Repeat until CI passes. Report the final CI status.`,

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
    postDiscord(`Rate limited on Step ${step.number}. Waiting 60s...`);
    await sleep(60_000);
  }

  // 2. Check input artifacts for prior step
  if (step.number > 1) {
    const prevStep = STEPS[step.number - 2];
    const preconds = validatePreconditions(step, state);
    if (!preconds.ok) {
      log(`Step ${step.number} preconditions failed: ${preconds.reason}. Will retry step ${prevStep.number}.`);
      postDiscord(`Step ${step.number} preconditions failed: ${preconds.reason}. Retrying Step ${prevStep.number}.`);
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
  postDiscord(`Step ${step.number} failed (attempt ${count}/${MAX_RETRIES}). Retrying...`);
  log(`Retry ${count}/${MAX_RETRIES} for step ${step.number}`);
  return 'retry';
}

// ---------------------------------------------------------------------------
// Escalation
// ---------------------------------------------------------------------------

async function escalate(step, reason, output = '') {
  const state = readState();
  const truncated = (output || '').slice(-500);

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

  postDiscord(diagnostic);

  // Reset state
  updateState({ currentStep: 0 });
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

function handleSignal(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`Received ${signal}. Shutting down gracefully...`);

  // Kill current subprocess
  if (currentProcess && !currentProcess.killed) {
    currentProcess.kill('SIGTERM');
  }

  // Commit/push any work
  try {
    const status = git('status --porcelain');
    if (status) {
      git('add -A');
      git('commit -m "chore: save work on signal ' + signal + '"');
      git('push');
    }
  } catch { /* best effort */ }

  postDiscord(`SDLC runner stopped (${signal}). Work saved.`);
  updateState({ currentStep: 0 });
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
    postDiscord(`Step ${step.number} (${step.key}) preconditions failed: ${preconds.reason}`);

    if (step.number > 1) {
      const prevStep = STEPS[step.number - 2];
      postDiscord(`Retrying Step ${prevStep.number} (${prevStep.key}) to produce required artifacts.`);
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
  postDiscord(`Starting Step ${step.number}: ${step.key}${state.currentIssue ? ` (issue #${state.currentIssue})` : ''}...`);

  // Run claude
  const result = await runClaude(step, state);
  log(`Step ${step.number} exited with code ${result.exitCode} in ${result.duration}s`);

  if (result.exitCode === 0) {
    // Extract state updates
    const patch = extractStateFromStep(step, result, state);
    state = updateState(patch);

    // Special: spec validation gate after step 3
    if (step.number === 3) {
      const specCheck = validateSpecs(state);
      if (!specCheck.ok) {
        log(`Spec validation failed: missing ${specCheck.missing.join(', ')}`);
        postDiscord(`Spec validation failed after Step 3 — missing: ${specCheck.missing.join(', ')}. Retrying...`);
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

    postDiscord(`Step ${step.number} (${step.key}) complete.${result.duration > 60 ? ` (${Math.round(result.duration / 60)}min)` : ''}`);
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

  // Write initial state (or resume from existing)
  let state;
  if (RESUME) {
    state = readState();
    log(`Resuming from step ${state.currentStep}, issue #${state.currentIssue || 'none'}`);
    postDiscord(`SDLC runner resuming from Step ${state.currentStep}.`);
  } else {
    state = defaultState();
    writeState(state);
    postDiscord('SDLC runner started.');
  }

  // Record PID
  updateState({ runnerPid: process.pid });

  // Single step mode
  if (SINGLE_STEP) {
    const step = STEPS[SINGLE_STEP - 1];
    if (!step) {
      console.error(`Invalid step number: ${SINGLE_STEP}`);
      process.exit(1);
    }
    state = readState();
    const result = await runStep(step, state);
    log(`Single step result: ${result}`);
    process.exit(result === 'ok' ? 0 : 1);
  }

  // Main continuous loop
  while (!shuttingDown) {
    // Check for open issues
    if (!DRY_RUN && !hasOpenIssues()) {
      log('No more open issues. All done!');
      postDiscord('No more open issues in the project. SDLC runner complete.');
      updateState({ currentStep: 0 });
      break;
    }

    // Determine starting step
    let startIdx = 0;
    if (RESUME && state.currentStep > 0) {
      // Resume from the step that was in progress (re-run it)
      startIdx = state.currentStep - 1;
      RESUME && log(`Resuming from step ${state.currentStep}`);
    }

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
    }

    // After a full cycle (or escalation), reset for next iteration
    state = readState();
    if (state.currentStep === 0) {
      // Clean cycle completion or escalation reset — check for more issues
      continue;
    }

    // If we got here from an escalation mid-cycle, the state was already reset
    state = updateState({ currentStep: 0 });
  }

  log('SDLC Runner exiting.');
}

main().catch((err) => {
  log(`Fatal error: ${err.message}`);
  postDiscord(`SDLC runner crashed: ${err.message}`);
  process.exit(1);
});
