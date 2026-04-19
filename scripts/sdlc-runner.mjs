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
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const IS_WINDOWS = process.platform === 'win32';
const VALID_EFFORTS = ['low', 'medium', 'high', 'xhigh'];

// ---------------------------------------------------------------------------
// CLI argument parsing & configuration (guarded for testability)
// ---------------------------------------------------------------------------

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

let DRY_RUN = false;
let SINGLE_STEP = null;
let RESUME = false;
let SINGLE_ISSUE_NUMBER = null;
let PROJECT_PATH = '';
let PLUGINS_PATH = '';
let MODEL = 'sonnet';
let EFFORT = 'medium';
let MAX_RETRIES = 3;
let MAX_BOUNCE_RETRIES = 3;
let CLEANUP_PATTERNS = [];
let STATE_PATH = '';
let configPath = '';
let configSteps = {};
let LOG_DIR = '';
let MAX_LOG_DISK_BYTES = 500 * 1024 * 1024;
let ORCHESTRATION_LOG = '';

if (isMainModule) {
  const { values: args } = parseArgs({
    options: {
      config:  { type: 'string'  },
      'dry-run': { type: 'boolean', default: false },
      step:    { type: 'string'  },
      issue:   { type: 'string'  },
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
  --step <N>                 Run only step N (1-9), then exit
  --issue <N>                Process only issue #N then exit (single-cycle mode)
  --resume                   Resume from existing sdlc-state.json
  --help                     Show this help
`);
    process.exit(0);
  }

  if (!args.config) {
    console.error('Error: --config <path> is required');
    process.exit(1);
  }

  DRY_RUN = args['dry-run'];
  SINGLE_STEP = args.step ? parseInt(args.step, 10) : null;
  SINGLE_ISSUE_NUMBER = args.issue ? parseInt(args.issue, 10) : null;
  if (args.issue && (!Number.isInteger(SINGLE_ISSUE_NUMBER) || SINGLE_ISSUE_NUMBER <= 0)) {
    console.error(`Error: --issue must be a positive integer, got "${args.issue}"`);
    process.exit(1);
  }
  RESUME = args.resume;

  // Load configuration
  configPath = path.resolve(args.config);
  if (!fs.existsSync(configPath)) {
    console.error(`Error: config file not found: ${configPath}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  PROJECT_PATH = config.projectPath;
  PLUGINS_PATH = config.pluginsPath;
  MODEL = config.model || 'sonnet';
  EFFORT = config.effort || 'medium';
  MAX_RETRIES = config.maxRetriesPerStep || 3;
  MAX_BOUNCE_RETRIES = parseMaxBounceRetries(config.maxBounceRetries);

  CLEANUP_PATTERNS = config.cleanup?.processPatterns || [];
  configSteps = config.steps || {};

  // Validate configuration
  const configErrors = validateConfig(config);
  if (configErrors.length > 0) {
    for (const err of configErrors) console.error(`Config error: ${err}`);
    process.exit(1);
  }

  if (!PROJECT_PATH || !PLUGINS_PATH) {
    console.error('Error: config must include projectPath and pluginsPath');
    process.exit(1);
  }

  STATE_PATH = path.join(PROJECT_PATH, '.claude', 'sdlc-state.json');

  // Logging setup (uses the already-parsed config)
  LOG_DIR = resolveLogDir(config, PROJECT_PATH);
  MAX_LOG_DISK_BYTES = (config.maxLogDiskUsageMB || 500) * 1024 * 1024;

  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch { /* non-fatal — log() will silently skip file writes */ }

  ORCHESTRATION_LOG = path.join(LOG_DIR, 'sdlc-runner.log');
}

// ---------------------------------------------------------------------------
// Logging configuration
// ---------------------------------------------------------------------------

function resolveLogDir(cfg, projectPath) {
  if (cfg.logDir) return path.resolve(cfg.logDir);
  return path.join(os.tmpdir(), 'sdlc-logs', path.basename(projectPath));
}

// Failure loop detection — in-memory, not persisted to state file
const MAX_CONSECUTIVE_ESCALATIONS = 2;
let consecutiveEscalations = 0;
const escalatedIssues = new Set();
let bounceCount = 0;

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

// NOTE: draftIssue is intentionally absent. /draft-issue is interactive-only
// as of plugin v1.41.0 (issue #116). Do not add it here — see
// plugins/nmg-sdlc/skills/draft-issue/SKILL.md for the rationale.
const STEP_KEYS = [
  'startCycle',   // 1
  'startIssue',   // 2
  'writeSpecs',   // 3
  'implement',    // 4
  'simplify',     // 5 — optional marketplace skill; probe-and-skip if absent
  'verify',       // 6
  'commitPush',   // 7
  'createPR',     // 8
  'monitorCI',    // 9
  'merge',        // 10
];

const STEPS = STEP_KEYS.map((key, i) => ({
  number: i + 1,
  key,
  ...(configSteps[key] || {}),
}));

// Step numbers keyed by name — avoids hardcoding positional indices at call
// sites that care about specific steps (e.g., merge idempotency).
const STEP_NUMBER = Object.fromEntries(STEP_KEYS.map((key, i) => [key, i + 1]));

// ---------------------------------------------------------------------------
// Configuration validation and resolution
// ---------------------------------------------------------------------------

/**
 * Validate model and effort fields throughout a config object.
 * Returns an array of error messages (empty = valid).
 */
function validateConfig(config) {
  const errors = [];

  if (config.effort === 'max') {
    errors.push('Global effort "max" is intentionally excluded from nmg-sdlc defaults — max is prone to overthinking on coding workloads; use "xhigh" instead');
  } else if (config.effort !== undefined && !VALID_EFFORTS.includes(config.effort)) {
    errors.push(`Invalid global effort "${config.effort}" — must be one of: ${VALID_EFFORTS.join(', ')}`);
  }
  if (config.model !== undefined && (typeof config.model !== 'string' || config.model.trim() === '')) {
    errors.push('Global model must be a non-empty string');
  }

  if (config.steps) {
    const globalEffort = config.effort;
    const globalModel = config.model;
    for (const [key, step] of Object.entries(config.steps)) {
      if (step.model !== undefined && (typeof step.model !== 'string' || step.model.trim() === '')) {
        errors.push(`steps.${key}.model must be a non-empty string`);
      }
      if (step.effort === 'max') {
        errors.push(`steps.${key}.effort "max" is intentionally excluded from nmg-sdlc defaults — max is prone to overthinking on coding workloads; use "xhigh" instead`);
      } else if (step.effort !== undefined && !VALID_EFFORTS.includes(step.effort)) {
        errors.push(`Invalid steps.${key}.effort "${step.effort}" — must be one of: ${VALID_EFFORTS.join(', ')}`);
      }

      const resolvedModel = step.model || globalModel;
      const resolvedEffort = step.effort !== undefined ? step.effort : globalEffort;
      if (resolvedModel === 'haiku' && resolvedEffort !== undefined) {
        errors.push(`steps.${key}: Haiku does not support the effort parameter — remove effort from this step (or the global effort field if the step inherits it)`);
      }
    }
  }

  return errors;
}

/**
 * Return a config object packaging module-level globals for the resolution functions.
 */
function getConfigObject() {
  return { model: MODEL, effort: EFFORT };
}

/**
 * Resolve model and effort for a step using the fallback chain:
 *   step.field → config.field → default
 * Model default: 'sonnet'; effort default: 'medium' (cleared to undefined when model is haiku).
 */
function resolveStepConfig(step, config) {
  const model = step.model || config.model || 'sonnet';
  const effort = step.effort || config.effort || 'medium';
  return {
    model,
    effort: model === 'haiku' ? undefined : effort,
  };
}


// ---------------------------------------------------------------------------
// Shared helpers (used by validation, state detection, and spec checks)
// ---------------------------------------------------------------------------

const REQUIRED_SPEC_FILES = ['requirements.md', 'design.md', 'tasks.md', 'feature.gherkin'];

/**
 * Locate the feature directory inside specs/.
 * Matches by featureName, branchSlug, or falls back to the last directory.
 * Returns the absolute path, or null if nothing is found.
 */
function findFeatureDir(specsDir, featureName, branchSlug) {
  if (!fs.existsSync(specsDir)) return null;
  const dirs = fs.readdirSync(specsDir)
    .filter(d => fs.statSync(path.join(specsDir, d)).isDirectory());
  if (dirs.length === 0) return null;

  if (featureName && dirs.includes(featureName)) {
    return path.join(specsDir, featureName);
  }
  const matched = branchSlug
    ? dirs.find(d => d.includes(branchSlug)) || dirs[dirs.length - 1]
    : dirs[dirs.length - 1];
  return path.join(specsDir, matched);
}

/**
 * Check that all required spec files exist with non-zero size.
 * Returns an array of missing/empty filenames (empty = all present).
 */
function checkRequiredSpecFiles(featureDir) {
  return REQUIRED_SPEC_FILES.filter(f => {
    const fp = path.join(featureDir, f);
    return !fs.existsSync(fp) || fs.statSync(fp).size === 0;
  });
}

/**
 * Parse maxBounceRetries from a config value, returning a validated integer
 * or the default of 3.
 */
function parseMaxBounceRetries(val) {
  if (val === undefined || val === null) return 3;
  const num = Number(val);
  if (!Number.isInteger(num) || num <= 0) {
    log(`Warning: invalid maxBounceRetries value "${val}" — using default 3`);
    return 3;
  }
  return num;
}

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
    try {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    } catch (err) {
      log(`Warning: state file corrupted (${err.message}), resetting to defaults`);
      return defaultState();
    }
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
        try {
          git('checkout main');
          git('pull');
        } catch (err) {
          log(`Warning: could not checkout main after merged PR: ${err.message}`);
          return null;
        }
      }
      return { _merged: true };
    }
  } catch {
    // No PR exists yet — that's fine, continue probing
  }

  // Read any persisted state up front: verify and simplify have no
  // git-observable artifact, so we need the saved state to confirm they passed
  // before probing past implement on the basis of "branch pushed".
  const savedState = readState();
  const savedLastCompleted = typeof savedState.lastCompletedStep === 'number' ? savedState.lastCompletedStep : 0;

  // Probe artifacts from highest to lowest to determine lastCompletedStep
  let lastCompletedStep = STEP_NUMBER.startIssue; // At minimum, we're on a feature branch (startIssue done)

  // Check for spec files (writeSpecs)
  const specsDir = path.join(PROJECT_PATH, 'specs');
  let featureName = null;
  const featureDir = findFeatureDir(specsDir, null, branchMatch[2]);
  if (featureDir && checkRequiredSpecFiles(featureDir).length === 0) {
    lastCompletedStep = STEP_NUMBER.writeSpecs;
    featureName = path.basename(featureDir);
  }

  // Check for commits ahead of main (implement — conservative; implement/simplify/verify indistinguishable from git state)
  if (lastCompletedStep >= STEP_NUMBER.writeSpecs) {
    try {
      const aheadLog = git('log main..HEAD --oneline');
      if (aheadLog) {
        lastCompletedStep = STEP_NUMBER.implement;
      }
    } catch { /* ignore */ }
  }

  // Check if branch is pushed to remote with no unpushed commits (commitPush).
  // "All commits pushed" only implies commitPush completion when verify
  // actually passed. Since simplify/verify have no git-observable artifact,
  // require the saved state to confirm `lastCompletedStep >= verify` before
  // advancing past implement on this signal alone. Otherwise, a crash
  // mid-verify followed by a resume would falsely skip verification entirely.
  if (lastCompletedStep >= STEP_NUMBER.implement && savedLastCompleted >= STEP_NUMBER.verify) {
    try {
      const unpushed = git(`log origin/${branch}..HEAD --oneline`);
      if (!unpushed) {
        // All commits pushed AND verify previously confirmed
        lastCompletedStep = STEP_NUMBER.commitPush;
      }
    } catch {
      // Remote branch doesn't exist — not pushed yet
    }
  }

  // Check if PR exists (createPR)
  if (lastCompletedStep >= STEP_NUMBER.commitPush) {
    try {
      gh('pr view --json number');
      lastCompletedStep = STEP_NUMBER.createPR;
    } catch {
      // No PR yet
    }
  }

  // Check if CI is passing (monitorCI)
  if (lastCompletedStep >= STEP_NUMBER.createPR) {
    try {
      const checks = gh('pr checks');
      if (!/fail|pending/i.test(checks)) {
        lastCompletedStep = STEP_NUMBER.monitorCI;
      }
    } catch (err) {
      if (/no checks reported/i.test(err.stderr || err.message || '')) {
        lastCompletedStep = STEP_NUMBER.monitorCI;
      }
    }
  }

  // If the runner was shut down by signal, the SIGTERM handler auto-pushed WIP
  // commits. That makes artifact probing think "all pushed → step 6 done" even
  // if the runner was mid-way through an earlier step. Cap the probed value to
  // what the state file recorded before shutdown.
  if (savedState.signalShutdown && savedState.lastCompletedStep < lastCompletedStep) {
    log(`detectAndHydrateState: signal shutdown detected — capping lastCompletedStep from ${lastCompletedStep} to ${savedState.lastCompletedStep} (state file value)`);
    lastCompletedStep = savedState.lastCompletedStep;
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
// Status notifications (logged to console and orchestration log)
// ---------------------------------------------------------------------------

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(ORCHESTRATION_LOG, line + '\n'); } catch { /* non-fatal */ }
}

// ---------------------------------------------------------------------------
// Per-step log persistence
// ---------------------------------------------------------------------------

/**
 * Extract the final result JSON object from stream-json output.
 * stream-json emits newline-delimited JSON events; the result event has type "result".
 * Falls back to parsing the entire output as a single JSON object (legacy json format).
 */
function extractResultFromStream(streamOutput) {
  // Try stream-json: scan lines in reverse for the result event
  const lines = streamOutput.trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(lines[i]);
      if (parsed.type === 'result') return parsed;
    } catch { /* skip non-JSON lines */ }
  }
  // Fallback: try parsing as single JSON (legacy --output-format json)
  try {
    return JSON.parse(streamOutput);
  } catch { /* not valid JSON */ }
  return null;
}

function extractSessionId(jsonOutput) {
  const result = extractResultFromStream(jsonOutput);
  if (result?.session_id) return String(result.session_id).slice(0, 12);
  return randomUUID().slice(0, 12);
}

function enforceMaxDisk(logDir, maxBytes) {
  try {
    const entries = fs.readdirSync(logDir)
      .filter(f => f.endsWith('.log') && f !== 'sdlc-runner.log')
      .map(f => {
        const fp = path.join(logDir, f);
        const stat = fs.statSync(fp);
        return { path: fp, size: stat.size, mtime: stat.mtimeMs };
      })
      .sort((a, b) => a.mtime - b.mtime); // oldest first

    let total = entries.reduce((sum, e) => sum + e.size, 0);
    for (const entry of entries) {
      if (total <= maxBytes) break;
      fs.unlinkSync(entry.path);
      total -= entry.size;
      log(`Pruned old log: ${path.basename(entry.path)}`);
    }
  } catch (err) { log(`Warning: disk cleanup failed: ${err.message}`); }
}

function writeStepLog(stepKey, result) {
  try {
    enforceMaxDisk(LOG_DIR, MAX_LOG_DISK_BYTES);
    const sessionId = extractSessionId(result.stdout);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${stepKey}-${sessionId}-${ts}.log`;
    const header = [
      `Step: ${stepKey}`,
      `Session: ${sessionId}`,
      `Exit code: ${result.exitCode}`,
      `Duration: ${result.duration}s`,
      `Timestamp: ${new Date().toISOString()}`,
      '---',
      '',
    ].join('\n');
    const body = `=== STDOUT ===\n${result.stdout}\n\n=== STDERR ===\n${result.stderr}\n`;
    fs.writeFileSync(path.join(LOG_DIR, filename), header + body);
    log(`Step log written: ${filename}`);
  } catch (err) { log(`Warning: failed to write step log for ${stepKey}: ${err.message}`); }
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
const RUNNER_ARTIFACTS = ['.claude/sdlc-state.json', '.claude/unattended-mode'];

/**
 * Ensure each RUNNER_ARTIFACTS entry is listed in the target project's .gitignore.
 * Append-only — never removes existing content. Idempotent on repeated calls.
 */
function ensureRunnerArtifactsGitignored() {
  const gitignorePath = path.join(PROJECT_PATH, '.gitignore');
  let content = '';
  try {
    content = fs.readFileSync(gitignorePath, 'utf8');
  } catch (err) { if (err.code !== 'ENOENT') throw err; }

  const existingLines = new Set(content.split('\n').map(l => l.trim()));
  const missing = RUNNER_ARTIFACTS.filter(entry => !existingLines.has(entry));
  if (missing.length === 0) return;

  let append = '';
  if (content.length > 0 && !content.endsWith('\n')) {
    append += '\n';
  }
  append += '\n# SDLC runner artifacts\n';
  append += missing.join('\n') + '\n';

  fs.appendFileSync(gitignorePath, append);
  log(`Appended to .gitignore: ${missing.join(', ')}`);
}

/**
 * If any RUNNER_ARTIFACTS are already git-tracked (committed before the
 * .gitignore entry was in place), untrack them with `git rm --cached`.
 * This is a one-time self-healing operation — once untracked, .gitignore
 * keeps them out of future commits.
 */
function untrackRunnerArtifactsIfTracked() {
  for (const artifact of RUNNER_ARTIFACTS) {
    try {
      // ls-files --error-unmatch exits non-zero if the file is not tracked
      git(`ls-files --error-unmatch ${artifact}`);
      // If we get here, the file IS tracked — untrack it
      git(`rm --cached ${artifact}`);
      log(`Untracked previously committed runner artifact: ${artifact}`);
    } catch {
      // Not tracked (or doesn't exist) — nothing to do
    }
  }
}

function removeUnattendedMode() {
  try {
    fs.unlinkSync(path.join(PROJECT_PATH, '.claude', 'unattended-mode'));
    log('Removed .claude/unattended-mode flag');
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
    git(`commit -m ${shellEscape(message)}`);
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
// Process cleanup — helpers
// ---------------------------------------------------------------------------

function getChildPids(pid) {
  try {
    let stdout;
    if (IS_WINDOWS) {
      stdout = execSync(`wmic process where (ParentProcessId=${pid}) get ProcessId`, { encoding: 'utf8', timeout: 5_000 });
    } else {
      stdout = execSync(`pgrep -P ${pid}`, { encoding: 'utf8', timeout: 5_000 });
    }
    return stdout.trim().split(/\s+/).map(Number).filter(n => n > 0 && Number.isInteger(n));
  } catch {
    return [];
  }
}

function getProcessTree(pid) {
  const children = getChildPids(pid);
  const result = [];
  for (const child of children) {
    result.push(...getProcessTree(child));
  }
  result.push(pid);
  return result;
}

function killProcessTree(pid) {
  if (IS_WINDOWS) {
    try {
      execSync(`taskkill /T /F /PID ${pid}`, { encoding: 'utf8', timeout: 5_000 });
      return 1;
    } catch {
      return 0;
    }
  }
  const pids = getProcessTree(pid);
  let killed = 0;
  for (const p of pids) {
    try {
      process.kill(p, 'SIGTERM');
      killed++;
    } catch (err) {
      if (err.code !== 'ESRCH') throw err;
    }
  }
  return killed;
}

function findProcessesByPattern(pattern) {
  try {
    let stdout;
    if (IS_WINDOWS) {
      const escaped = pattern.replace(/'/g, "''");
      stdout = execSync(`wmic process where "CommandLine like '%${escaped}%'" get ProcessId`, { encoding: 'utf8', timeout: 5_000 });
    } else {
      stdout = execSync(`pgrep -f -- ${shellEscape(pattern)}`, { encoding: 'utf8', timeout: 5_000 });
    }
    return stdout.trim().split(/\s+/).map(Number).filter(n => n > 0 && Number.isInteger(n));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Process cleanup
// ---------------------------------------------------------------------------

function cleanupProcesses() {
  const phase1Ran = !!lastClaudePid;

  // Phase 1: tree-based cleanup via lastClaudePid
  if (lastClaudePid) {
    const killed = killProcessTree(lastClaudePid);
    log(`[CLEANUP] Phase 1: killed ${killed} process(es) in tree rooted at PID ${lastClaudePid}`);
    lastClaudePid = null;
  }

  // Phase 2: pattern-based fallback
  if (CLEANUP_PATTERNS.length === 0) {
    if (!phase1Ran) log('[CLEANUP] No matching processes found');
    return;
  }

  let phase2Killed = false;
  for (const pattern of CLEANUP_PATTERNS) {
    try {
      const pids = findProcessesByPattern(pattern).filter(p => p !== process.pid);
      if (pids.length === 0) continue;

      phase2Killed = true;
      for (const pid of pids) {
        try {
          process.kill(pid, 'SIGTERM');
        } catch (err) {
          if (err.code !== 'ESRCH') throw err;
        }
      }
      log(`[CLEANUP] Phase 2: killed ${pids.length} process(es) matching "${pattern}"`);
    } catch (err) {
      log(`[CLEANUP] Warning: error cleaning up pattern "${pattern}": ${err.message}`);
    }
  }

  if (!phase2Killed && !phase1Ran) {
    log('[CLEANUP] No matching processes found');
  }
}

// ---------------------------------------------------------------------------
// Precondition validation
// ---------------------------------------------------------------------------

function validatePreconditions(step, state) {
  switch (step.number) {
    case STEP_NUMBER.startCycle: // Start cycle — no preconditions
      return { ok: true };

    case STEP_NUMBER.startIssue: { // Start issue — clean main branch
      try {
        const status = git('status --porcelain')
          .split('\n')
          .filter(line => !RUNNER_ARTIFACTS.some(f => line.trimStart().endsWith(f)))
          .join('\n')
          .trim();
        const branch = git('rev-parse --abbrev-ref HEAD');
        if (status.length > 0) return { ok: false, failedCheck: 'clean working tree', reason: 'Working tree is dirty' };
        if (branch !== 'main') return { ok: false, failedCheck: 'on main branch', reason: `Expected main branch, on ${branch}` };
        return { ok: true };
      } catch (err) {
        return { ok: false, failedCheck: 'git state check', reason: `Git check failed: ${err.message}` };
      }
    }

    case STEP_NUMBER.writeSpecs: { // Write specs — feature branch exists, issue known
      const branch = git('rev-parse --abbrev-ref HEAD');
      if (branch === 'main') return { ok: false, failedCheck: 'feature branch exists', reason: 'Still on main, expected feature branch' };
      if (!state.currentIssue) return { ok: false, failedCheck: 'issue number known', reason: 'No current issue set in state' };
      return { ok: true };
    }

    case STEP_NUMBER.implement: { // Implement — all 4 spec files exist
      const specsDir = path.join(PROJECT_PATH, 'specs');
      const featureDir = findFeatureDir(specsDir, state.featureName);
      if (!featureDir) {
        return { ok: false, failedCheck: 'spec files exist', reason: 'No feature spec directory found' };
      }
      const missing = checkRequiredSpecFiles(featureDir);
      if (missing.length > 0) {
        return { ok: false, failedCheck: 'spec files exist', reason: `Missing spec files: ${missing.join(', ')}` };
      }
      return { ok: true };
    }

    case STEP_NUMBER.simplify: // Simplify — no preconditions; probe-and-skip handled in prompt
      return { ok: true };

    case STEP_NUMBER.verify: { // Verify — implementation committed on feature branch
      const branch = git('rev-parse --abbrev-ref HEAD');
      if (branch === 'main') return { ok: false, failedCheck: 'on feature branch', reason: 'On main, expected feature branch' };
      try {
        const log = git('log main..HEAD --oneline');
        if (!log) return { ok: false, failedCheck: 'commits exist on branch', reason: 'No commits ahead of main' };
      } catch {
        // If main doesn't exist as a ref, just check we have commits
      }
      return { ok: true };
    }

    case STEP_NUMBER.commitPush: // Commit/push — no strict preconditions (step handles it)
      return { ok: true };

    case STEP_NUMBER.createPR: { // Create PR — branch pushed to remote
      const branch = git('rev-parse --abbrev-ref HEAD');
      try {
        const unpushed = git(`log origin/${branch}..HEAD --oneline`);
        if (unpushed) return { ok: false, failedCheck: 'branch pushed to remote', reason: 'Unpushed commits exist' };
      } catch {
        return { ok: false, failedCheck: 'branch pushed to remote', reason: 'Remote branch not found — push first' };
      }
      return { ok: true };
    }

    case STEP_NUMBER.monitorCI: { // Monitor CI — PR exists
      try {
        gh('pr view --json number');
        return { ok: true };
      } catch {
        return { ok: false, failedCheck: 'PR exists', reason: 'No PR found for current branch' };
      }
    }

    case STEP_NUMBER.merge: { // Merge — CI passing
      try {
        const checks = gh('pr checks');
        if (/fail/i.test(checks)) return { ok: false, failedCheck: 'CI checks passing', reason: 'CI checks failing' };
        return { ok: true };
      } catch (err) {
        if (/no checks reported/i.test(err.stderr || err.message || '')) {
          return { ok: true };
        }
        return { ok: false, failedCheck: 'PR status check', reason: 'Could not check PR status' };
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

function buildClaudeArgs(step, state, overrides = {}) {
  const issue = state.currentIssue || '<unknown>';
  const branch = state.currentBranch || '<unknown>';
  const skillRoot = step.skill
    ? path.join(PLUGINS_PATH, 'plugins', 'nmg-sdlc', 'skills', step.skill)
    : null;

  const prompts = {
    [STEP_NUMBER.startCycle]: 'Check out main, clean the working tree, and pull latest. Run: git checkout main && git clean -fd && git checkout -- . && git pull. Report the current branch and latest commit.',

    [STEP_NUMBER.startIssue]: SINGLE_ISSUE_NUMBER
      ? `Start issue #${SINGLE_ISSUE_NUMBER}. Create a linked feature branch and set the issue to In Progress. Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/.`
      : [
          `You are running in UNATTENDED MODE (\`.claude/unattended-mode\` exists).`,
          `Do NOT call AskUserQuestion — it will be denied and waste turns. Do NOT emit`,
          `text asking the user to reply. Follow the skill's unattended-mode path:`,
          ``,
          `1. Fetch viable milestones via \`gh api repos/{owner}/{repo}/milestones --jq '[.[] | select(.open_issues > 0) | {title: .title, open_issues: .open_issues}] | sort_by(.title)'\`.`,
          `2. Select the first milestone alphabetically. If none, fall back to repo-wide.`,
          `3. List issues with \`--label automatable\`: \`gh issue list -s open -m "<milestone>" --label automatable -L 10 --json number,title,labels\`.`,
          `4. If the list is empty, run the diagnostic query described in the skill and exit.`,
          `5. Otherwise, pick the issue with the lowest number from the list and use \`gh issue develop <N> --checkout\` to create and check out a branch. Update the project board status if applicable.`,
          `6. Exit successfully. HEAD must be on the new <number>-<slug> feature branch when you exit.`,
          ``,
          escalatedIssues.size > 0 ? `Do NOT select any of these previously-escalated issues: ${[...escalatedIssues].map(i => `#${i}`).join(', ')}.` : '',
          `Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/.`,
        ].filter(Boolean).join('\n'),

    [STEP_NUMBER.writeSpecs]: `Write BDD specifications for issue #${issue} on branch ${branch}. Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/.`,

    [STEP_NUMBER.implement]: `Implement the specifications for issue #${issue} on branch ${branch}. Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/.`,

    [STEP_NUMBER.simplify]: [
      `Run the simplify pass over files changed on branch ${branch} for issue #${issue}.`,
      ``,
      `1. Probe for the simplify skill. Treat it as available if ANY of these is true:`,
      `   - Glob finds ~/.claude/skills/simplify/SKILL.md`,
      `   - Glob finds ~/.claude/plugins/**/skills/simplify/SKILL.md`,
      `   - The available-skills list in your system reminder advertises a skill named "simplify" (or "*:simplify")`,
      `2. If NOT available, print the following line verbatim and exit with code 0:`,
      `   simplify skill not available — skipping simplification pass`,
      `3. If available, invoke /simplify on the files listed by: git diff main...HEAD --name-only`,
      `   Apply any fixes it returns. Exit with code 0 on success.`,
    ].join('\n'),

    [STEP_NUMBER.verify]: `Verify the implementation for issue #${issue} on branch ${branch}. Fix any findings. Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/.`,

    [STEP_NUMBER.commitPush]: `Stage all changes, commit with a meaningful conventional-commit message summarizing the work for issue #${issue}, and push to the remote branch ${branch}. After pushing, verify the push succeeded by running git log origin/${branch}..HEAD --oneline — if any unpushed commits remain, or if git push reported an error, exit with a non-zero status code.`,

    [STEP_NUMBER.createPR]: `Create a pull request for branch ${branch} targeting main for issue #${issue}. You MUST bump the version (Steps 2-3 of the skill) before creating the PR — this is mandatory and must not be skipped. Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/.`,

    [STEP_NUMBER.monitorCI]: [
      `Monitor CI for the PR on branch ${branch}. Follow these steps exactly:`,
      `1. Run \`gh pr checks\`. If the output contains "no checks reported", the repository has no CI configured — treat this as success and exit with code 0 immediately.`,
      `2. Poll \`gh pr checks\` every 30 seconds until no checks are "pending".`,
      `3. If all checks pass, report success and exit with code 0.`,
      `4. If any check fails:`,
      `   a. Read the CI logs for the failing check(s) to diagnose the root cause.`,
      `   b. Before applying any fix, review the spec files in specs/ to ensure`,
      `      the fix does not deviate from specified behavior. If the only correct fix`,
      `      would change specified behavior, exit with a non-zero status explaining why.`,
      `   c. Apply the minimal fix, commit with a "fix:" conventional-commit message, and push.`,
      `   d. Return to step 2 to re-poll CI after the push.`,
      `5. If you cannot fix the failure after 3 attempts, exit with a non-zero status`,
      `   explaining what failed and why you could not fix it.`,
      `6. Only exit with code 0 when ALL CI checks show as passing.`,
    ].join('\n'),

    [STEP_NUMBER.merge]: `First verify CI is passing with gh pr checks. If the output contains "no checks reported", treat this as passing (the repository has no CI configured). If any check is failing, do NOT merge — report the failure and exit with a non-zero status. If all checks pass, merge the current PR to main and delete the remote branch ${branch}.`,
  };

  const claudeArgs = [
    '--model', overrides.model || MODEL,
    '-p', overrides.prompt || prompts[step.number],
    '--dangerously-skip-permissions',
    '--verbose',
    '--output-format', 'stream-json',
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

function runClaude(step, state, overrides = {}) {
  const resolved = resolveStepConfig(step, getConfigObject());
  const model = overrides.model || resolved.model;
  const effort = overrides.effort ?? resolved.effort;

  const claudeArgs = buildClaudeArgs(step, state, { model, prompt: overrides.prompt });
  const timeoutMs = (step.timeoutMin || 10) * 60 * 1000;

  if (DRY_RUN) {
    log(`[DRY-RUN] Would run: claude ${claudeArgs.slice(0, 6).join(' ')} ... (timeout: ${step.timeoutMin || 10}min)`);
    return Promise.resolve({ exitCode: 0, stdout: '{"type":"result","result":"dry-run"}', stderr: '', duration: 0 });
  }

  // Create live log file for real-time streaming
  const liveLogName = `${overrides.liveLogLabel || step.key || 'step' + step.number}-live.log`;
  const liveLogPath = path.join(LOG_DIR, liveLogName);
  let liveLogFd;
  try {
    liveLogFd = fs.openSync(liveLogPath, 'w');
    log(`Live log: ${liveLogPath}`);
  } catch (err) {
    log(`Warning: could not create live log: ${err.message}`);
  }

  return new Promise((resolve) => {
    const startTime = Date.now();

    const spawnOpts = {
      cwd: PROJECT_PATH,
      stdio: ['ignore', 'pipe', 'pipe'],
    };
    if (effort) {
      spawnOpts.env = { ...process.env, CLAUDE_CODE_EFFORT_LEVEL: effort };
    }

    const proc = spawn('claude', claudeArgs, spawnOpts);
    currentProcess = proc;
    lastClaudePid = proc.pid;

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (liveLogFd !== undefined) {
        try { fs.writeSync(liveLogFd, chunk); } catch { /* ignore write errors */ }
      }
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (liveLogFd !== undefined) {
        try { fs.writeSync(liveLogFd, '[STDERR] ' + chunk); } catch { /* ignore write errors */ }
      }
    });

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
      currentProcess = null;
      clearTimeout(timer);
      if (liveLogFd !== undefined) {
        try { fs.closeSync(liveLogFd); } catch { /* ignore */ }
      }
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        duration: Math.round((Date.now() - startTime) / 1000),
      });
    });

    proc.on('error', (err) => {
      currentProcess = null;
      clearTimeout(timer);
      if (liveLogFd !== undefined) {
        try { fs.closeSync(liveLogFd); } catch { /* ignore */ }
      }
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
// Soft failure detection (exit code 0 but step did not succeed)
// ---------------------------------------------------------------------------

// Tools that are benign when denied — the model attempted them but recovered.
// These should NOT trigger soft failure escalation.
const BENIGN_DENIED_TOOLS = new Set(['EnterPlanMode', 'ExitPlanMode', 'AskUserQuestion']);

// OS temp directory — resolved once at startup. Permission denials targeting
// paths inside this directory are treated as benign because SDLC skills
// routinely create ephemeral test scaffolds there (see steering/structure.md
// "Test Project Scaffolding"). The subprocess sandbox blocks writes outside
// the project root, so scaffold writes get denied even under
// --dangerously-skip-permissions. The model recovers from these denials and
// the step still completes; escalating on them halts otherwise-successful runs.
const OS_TMPDIR = os.tmpdir();

// Known text-based failure patterns — detected in raw stdout when JSON checks
// find no failure indicators.  Each entry has a regex and a human-readable label
// used in the soft-failure reason string and status log messages.
const TEXT_FAILURE_PATTERNS = [
  { pattern: /EnterPlanMode/i, label: 'EnterPlanMode' },
  { pattern: /AskUserQuestion.*unattended-mode/i, label: 'AskUserQuestion in unattended-mode' },
];

function getToolName(denial) {
  return typeof denial === 'object' && denial !== null ? denial.tool_name : String(denial);
}

// Fields on `tool_input` that carry filesystem paths or shell commands. We
// check these directly rather than serializing the whole object — a substring
// match against a stringified object can false-positive on unrelated fields.
const DENIAL_PATH_FIELDS = ['file_path', 'notebook_path', 'path', 'command'];

function isEphemeralScaffoldDenial(denial) {
  if (!denial || typeof denial !== 'object') return false;
  const input = denial.tool_input;
  if (!input || typeof input !== 'object') return false;
  return DENIAL_PATH_FIELDS.some(field => typeof input[field] === 'string' && input[field].includes(OS_TMPDIR));
}

function detectSoftFailure(stdout) {
  const parsed = extractResultFromStream(stdout);
  if (parsed) {
    if (parsed.subtype === 'error_max_turns') {
      return { isSoftFailure: true, reason: 'error_max_turns' };
    }
    if (Array.isArray(parsed.permission_denials) && parsed.permission_denials.length > 0) {
      // Filter out benign denials: interactive tools the model tried but
      // recovered from, and denials targeting the OS temp directory (expected
      // for skills that create ephemeral test scaffolds).
      const serious = parsed.permission_denials.filter(d => {
        if (BENIGN_DENIED_TOOLS.has(getToolName(d))) return false;
        if (isEphemeralScaffoldDenial(d)) return false;
        return true;
      });
      if (serious.length > 0) {
        return { isSoftFailure: true, reason: `permission_denials: ${serious.map(getToolName).join(', ')}` };
      }
    }
  }
  // Text-pattern scan: catch failures that produce text output but no JSON indicators.
  // Only runs when no JSON result was extracted — if JSON was present, the JSON checks
  // above are authoritative (avoids false positives from tool names in JSON fields).
  if (!parsed && stdout) {
    for (const { pattern, label } of TEXT_FAILURE_PATTERNS) {
      if (pattern.test(stdout)) {
        return { isSoftFailure: true, reason: `text_pattern: ${label}` };
      }
    }
  }
  return { isSoftFailure: false };
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
  if (bounceCount > MAX_BOUNCE_RETRIES) {
    log(`Bounce loop detected: ${bounceCount} step-back transitions exceed threshold ${MAX_BOUNCE_RETRIES}`);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Step outcome idempotency detection
// ---------------------------------------------------------------------------

/**
 * Return true when a step's expected outcome is already observable in the
 * repo / GitHub, making a retry unnecessary (and usually harmful). Currently
 * only the merge step is covered — it's the only step whose inner action
 * produces irreversible side-effects (squash-merge + branch delete) before
 * the Claude session might exit non-zero on unrelated follow-up noise.
 *
 * Other steps (spec writing, implement, verify, createPR, monitorCI) are
 * either purely local or idempotent enough that retrying is safe.
 */
function isStepOutcomeSatisfied(step, state) {
  if (step.number !== STEP_NUMBER.merge) return false;
  const issueNum = state.currentIssue;
  if (!issueNum) return false;
  // Look for a merged PR associated with this issue. `gh pr list --search`
  // matches on title/body, and the issue number typically appears in the
  // title ("feat: … (#N)") or body ("Closes #N"). Filter strictly by state
  // to avoid false positives on open PRs.
  try {
    const out = gh(`pr list --state merged --search "${issueNum} in:title,body" --json number,state,title,body --limit 10`);
    const list = JSON.parse(out);
    if (!Array.isArray(list)) return false;
    const pattern = new RegExp(`#${issueNum}(?!\\d)`);
    return list.some(p => p.state === 'MERGED' && (pattern.test(p.title || '') || pattern.test(p.body || '')));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Failure handling
// ---------------------------------------------------------------------------

async function handleFailure(step, result, state) {
  const output = result.stdout + '\n' + result.stderr;

  // 0. Idempotency check: did the step already achieve its outcome before
  // exiting non-zero? The merge step is the canonical example — `gh pr merge`
  // can squash-merge the PR (mutating shared GitHub state and deleting the
  // branch) and then the Claude session exits non-zero on an unrelated
  // follow-up (rate_limit noise, post-merge `gh pr checks` on the
  // auto-switched `main` branch, etc.). Retrying such a step can't redo a
  // completed merge, and precondition probing sees a deleted branch and
  // escalates. When we can confirm the outcome is satisfied, treat the exit
  // as success.
  if (isStepOutcomeSatisfied(step, state)) {
    log(`Step ${step.number} (${step.key}) exited non-zero but outcome is already satisfied — treating as success.`);
    log(`[STATUS] Step ${step.number} (${step.key}) complete (idempotent — outcome was already achieved).`);
    const patch = extractStateFromStep(step, result, state);
    if (patch.lastCompletedStep === undefined) patch.lastCompletedStep = step.number;
    updateState(patch);
    return 'ok';
  }

  // 1. Check for known error patterns
  const patternMatch = matchErrorPattern(output);
  if (patternMatch?.action === 'escalate') {
    log(`Immediate escalation: matched pattern "${patternMatch.pattern}"`);
    await escalate(step, `Matched unrecoverable pattern: ${patternMatch.pattern}`, output);
    return 'escalated';
  }

  if (patternMatch?.action === 'wait') {
    log('Rate limited. Waiting 60s before retry...');
    log(`[STATUS] Rate limited on Step ${step.number}. Waiting 60s...`);
    await sleep(60_000);
  }

  // 2. Check input artifacts for prior step
  if (step.number > 1) {
    const prevStep = STEPS[step.number - 2];
    const preconds = validatePreconditions(step, state);
    if (!preconds.ok) {
      if (incrementBounceCount()) {
        await escalate(step, `Bounce loop: ${bounceCount} step-back transitions exceed threshold ${MAX_BOUNCE_RETRIES}`, output);
        return 'escalated';
      }
      const failedCheck = preconds.failedCheck || preconds.reason;
      log(`Step ${step.number} (${step.key}) precondition failed: "${failedCheck}". Bouncing to Step ${prevStep.number} (${prevStep.key}). (bounce ${bounceCount}/${MAX_BOUNCE_RETRIES})`);
      log(`[STATUS] Step ${step.number} (${step.key}) bounced to Step ${prevStep.number} (${prevStep.key}). Precondition failed: "${failedCheck}". (bounce ${bounceCount}/${MAX_BOUNCE_RETRIES})`);
      return 'retry-previous';
    }
  }

  // 3. Commit dirty working tree
  autoCommitIfDirty(`chore: save work before retry (step ${step.number})`);

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
  log(`[STATUS] Step ${step.number} failed (attempt ${count}/${MAX_RETRIES}). Retrying...`);
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
  autoCommitIfDirty('chore: save partial work before escalation');

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

  log(`[STATUS] ${diagnostic}`);

  // In single-issue mode, exit immediately on escalation — no next cycle
  if (SINGLE_ISSUE_NUMBER) {
    removeUnattendedMode();
    process.exit(1);
  }

  // Reset state for next cycle (keep unattended-mode flag — the runner is still running
  // and will start a fresh cycle; removing the flag causes skills to run interactively)
  updateState({ currentStep: 0, lastCompletedStep: 0 });
}

/**
 * Halt the runner due to a detected failure loop.
 * Does NOT call removeUnattendedMode(), updateState(), or git checkout —
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
  cleanupProcesses();
  log(`[STATUS] ${diagnostic}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Post-step state extraction
// ---------------------------------------------------------------------------

function extractStateFromStep(step, result, state) {
  const output = result.stdout;
  const patch = {};

  if (step.number === STEP_NUMBER.startCycle) {
    // After checkout main, reset cycle state
    patch.currentIssue = null;
    patch.currentBranch = 'main';
    patch.featureName = null;
    patch.retries = {};
  }

  if (step.number === STEP_NUMBER.startIssue) {
    // Detect branch first — more reliable than parsing Claude output
    try {
      const branch = git('rev-parse --abbrev-ref HEAD');
      if (branch !== 'main') {
        patch.currentBranch = branch;
        // Extract issue number from branch name (e.g. "42-feature-slug")
        const branchIssue = branch.match(/^(\d+)-/);
        if (branchIssue) patch.currentIssue = parseInt(branchIssue[1], 10);
      }
    } catch { /* ignore */ }

    // If branch-based extraction failed, log a warning — do NOT fall back to
    // regex on conversation output, which can match stale issue numbers (#62)
    if (!patch.currentIssue) {
      log('Warning: branch-based issue extraction failed after startIssue — currentIssue will be null');
    }
  }

  if (step.number === STEP_NUMBER.writeSpecs) {
    // Try to detect the feature name from specs directory
    const specsDir = path.join(PROJECT_PATH, 'specs');
    const featureDir = findFeatureDir(specsDir);
    if (featureDir) {
      patch.featureName = path.basename(featureDir);
    }
  }

  if (step.number === STEP_NUMBER.createPR) {
    // Try to extract PR number from output
    const prMatch = output.match(/pull\/(\d+)/);
    if (prMatch) patch.prNumber = parseInt(prMatch[1], 10);
  }

  if (step.number === STEP_NUMBER.merge) {
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
    const issues = gh('issue list --state open --limit 200 --json number');
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

/**
 * Validate spec file content structure after file-existence checks pass.
 * Returns { ok: boolean, issues: string[] } with per-file, per-check detail.
 */
function validateSpecContent(featureDir) {
  const issues = [];

  // Validate requirements.md
  try {
    const reqContent = fs.readFileSync(path.join(featureDir, 'requirements.md'), 'utf8');
    if (!/\*\*Issues?\*\*\s*:/.test(reqContent)) {
      issues.push('requirements.md: missing **Issues**: frontmatter');
    }
    if (!/^### AC\d/m.test(reqContent)) {
      issues.push('requirements.md: no ### AC heading found');
    }
  } catch (err) {
    issues.push(`requirements.md: read error — ${err.message}`);
  }

  // Validate tasks.md
  try {
    const taskContent = fs.readFileSync(path.join(featureDir, 'tasks.md'), 'utf8');
    if (!/^### T\d/m.test(taskContent)) {
      issues.push('tasks.md: no task heading (### T) found');
    }
  } catch (err) {
    issues.push(`tasks.md: read error — ${err.message}`);
  }

  return { ok: issues.length === 0, issues };
}

function validateSpecs(state) {
  const specsDir = path.join(PROJECT_PATH, 'specs');
  const featureDir = findFeatureDir(specsDir, state.featureName);

  if (!featureDir) {
    return { ok: false, missing: ['feature directory'] };
  }

  const missing = checkRequiredSpecFiles(featureDir);
  if (missing.length > 0) {
    return { ok: false, missing };
  }

  // Content structure validation (only runs when all files exist with non-zero size)
  const contentCheck = validateSpecContent(featureDir);
  if (!contentCheck.ok) {
    return { ok: false, missing: contentCheck.issues };
  }

  // Update feature name in state if we found it
  const featureName = path.basename(featureDir);
  if (featureName !== state.featureName) {
    updateState({ featureName });
  }

  return { ok: true, missing: [] };
}

// ---------------------------------------------------------------------------
// CI validation gate (post-monitorCI)
// ---------------------------------------------------------------------------

function validateCI() {
  try {
    const checks = gh('pr checks');
    if (/fail/i.test(checks)) {
      return { ok: false, reason: `CI checks still failing after Step ${STEP_NUMBER.monitorCI}` };
    }
    return { ok: true };
  } catch (err) {
    if (/no checks reported/i.test(err.stderr || err.message || '')) {
      return { ok: true };
    }
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
// Version bump validation gate (post-step-7)
// ---------------------------------------------------------------------------

function validateVersionBump() {
  const versionPath = path.join(PROJECT_PATH, 'VERSION');
  if (!fs.existsSync(versionPath)) return { ok: true }; // no VERSION file → skip

  // Check if VERSION contains valid semver
  const version = fs.readFileSync(versionPath, 'utf8').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    log('Warning: VERSION file does not contain valid semver, skipping version bump check');
    return { ok: true };
  }

  // Check if VERSION changed vs main
  try {
    const diff = git('diff main -- VERSION');
    if (diff) return { ok: true }; // VERSION changed — bump was done
    return { ok: false, reason: 'VERSION file unchanged relative to main' };
  } catch (err) {
    log(`Warning: could not diff VERSION against main: ${err.message}`);
    return { ok: true }; // can't verify → skip
  }
}

// ---------------------------------------------------------------------------
// Deterministic version bump (recovery when LLM skips the bump)
// ---------------------------------------------------------------------------

/**
 * Classify the version bump type from issue labels.
 * Reads the classification matrix from steering/tech.md if available,
 * falls back to hardcoded defaults (bug→patch, else→minor).
 */
function classifyBumpType(labels, projectPath) {
  const techMdPath = path.join(projectPath, 'steering', 'tech.md');

  if (!fs.existsSync(techMdPath)) {
    return labels.includes('bug') ? 'patch' : 'minor';
  }

  try {
    const content = fs.readFileSync(techMdPath, 'utf8');
    const versioningSection = content.match(/## Versioning\s*\n([\s\S]*?)(?=\n## |\n$|$)/);
    if (!versioningSection) {
      return labels.includes('bug') ? 'patch' : 'minor';
    }

    const classSection = versioningSection[1].match(/### Version Bump Classification\s*\n([\s\S]*?)(?=\n### |\n## |$)/);
    if (!classSection) {
      return labels.includes('bug') ? 'patch' : 'minor';
    }

    // Parse the markdown table into a label→bump map
    const rows = classSection[1].match(/\|[^|\n]+\|[^|\n]+\|/g) || [];
    const classMap = new Map();
    for (const row of rows) {
      const cells = row.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 2 && cells[0] !== 'Label' && !cells[0].startsWith('-')) {
        classMap.set(cells[0].replace(/`/g, '').toLowerCase(), cells[1].toLowerCase().trim());
      }
    }

    for (const label of labels) {
      const bump = classMap.get(label.toLowerCase());
      if (bump) return bump;
    }
    return 'minor';
  } catch (err) {
    log(`Warning: could not read tech.md classification: ${err.message}`);
    return labels.includes('bug') ? 'patch' : 'minor';
  }
}

function performDeterministicVersionBump(state) {
  const versionPath = path.join(PROJECT_PATH, 'VERSION');

  // Guard: VERSION file must exist and contain valid semver
  if (!fs.existsSync(versionPath)) {
    log('performDeterministicVersionBump: no VERSION file, skipping');
    return false;
  }

  const currentVersion = fs.readFileSync(versionPath, 'utf8').trim();
  if (!/^\d+\.\d+\.\d+$/.test(currentVersion)) {
    log(`performDeterministicVersionBump: invalid semver "${currentVersion}", skipping`);
    return false;
  }

  const [major, minor, patch] = currentVersion.split('.').map(Number);
  const issue = state.currentIssue;

  if (!issue) {
    log('performDeterministicVersionBump: no current issue, skipping');
    return false;
  }

  try {
    // Get issue labels
    let labels = [];
    try {
      const labelOutput = gh(`issue view ${issue} --json labels --jq '.labels[].name'`);
      labels = labelOutput.split('\n').map(l => l.trim()).filter(Boolean);
    } catch (err) {
      log(`Warning: could not read issue labels: ${err.message}`);
    }

    const bumpType = classifyBumpType(labels, PROJECT_PATH);

    let newVersion;
    if (bumpType === 'patch') {
      newVersion = `${major}.${minor}.${patch + 1}`;
    } else {
      // minor (default) or any other non-patch bump type
      newVersion = `${major}.${minor + 1}.0`;
    }

    log(`Deterministic version bump: ${currentVersion} → ${newVersion}`);

    if (DRY_RUN) {
      log(`[DRY-RUN] Would bump version to ${newVersion}`);
      return true;
    }

    // 1. Update VERSION file
    fs.writeFileSync(versionPath, newVersion + '\n');

    // 2. Update CHANGELOG.md if it exists
    const changelogPath = path.join(PROJECT_PATH, 'CHANGELOG.md');
    if (fs.existsSync(changelogPath)) {
      try {
        let changelog = fs.readFileSync(changelogPath, 'utf8');
        const today = new Date().toISOString().slice(0, 10);
        changelog = changelog.replace(
          /## \[Unreleased\]/,
          `## [Unreleased]\n\n## [${newVersion}] - ${today}`
        );
        fs.writeFileSync(changelogPath, changelog);
      } catch (err) {
        log(`Warning: could not update CHANGELOG.md: ${err.message}`);
      }
    }

    // 3. Update stack-specific files from steering/tech.md
    const techMdPath = path.join(PROJECT_PATH, 'steering', 'tech.md');
    if (fs.existsSync(techMdPath)) {
      try {
        const techMd = fs.readFileSync(techMdPath, 'utf8');
        const versioningMatch = techMd.match(/## Versioning\s*\n([\s\S]*?)(?=\n### |\n## |\n$|$)/);
        if (versioningMatch) {
          // Parse table rows: | file | dot.path |
          const tableRows = versioningMatch[1].match(/\|[^|\n]+\|[^|\n]+\|/g) || [];
          for (const row of tableRows) {
            const cells = row
              .split('|')
              .map(c => c.trim().replace(/^`|`$/g, ''))
              .filter(Boolean);
            if (cells.length < 2 || cells[0] === 'File' || cells[0].startsWith('-')) continue;

            const filePath = path.join(PROJECT_PATH, cells[0]);
            const dotPath = cells[1];

            if (!fs.existsSync(filePath)) {
              log(`Warning: versioned file not found: ${cells[0]}`);
              continue;
            }

            try {
              if (filePath.endsWith('.json')) {
                // JSON: parse, update dot-path (supports arr[0] indexing), write back
                const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const navigate = (root, segments, setOnLast) => {
                  let obj = root;
                  for (let i = 0; i < segments.length; i++) {
                    const seg = segments[i];
                    const parts = [];
                    const re = /([^\[\]]+)|\[(\d+)\]/g;
                    let m;
                    while ((m = re.exec(seg)) !== null) {
                      parts.push(m[1] !== undefined ? m[1] : Number(m[2]));
                    }
                    for (let j = 0; j < parts.length; j++) {
                      const isLast = i === segments.length - 1 && j === parts.length - 1;
                      if (isLast && setOnLast) {
                        obj[parts[j]] = newVersion;
                        return true;
                      }
                      obj = obj[parts[j]];
                      if (obj == null) return false;
                    }
                  }
                  return false;
                };
                if (navigate(json, dotPath.split('.'), true)) {
                  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
                }
              } else if (filePath.endsWith('.toml')) {
                // TOML: regex replace the version value at the dot-path
                let content = fs.readFileSync(filePath, 'utf8');
                const lastKey = dotPath.split('.').pop();
                const pattern = new RegExp(`(${lastKey}\\s*=\\s*")([^"]*)(")`, 'g');
                content = content.replace(pattern, `$1${newVersion}$3`);
                fs.writeFileSync(filePath, content);
              } else {
                // Plain text: replace version string
                let content = fs.readFileSync(filePath, 'utf8');
                content = content.replace(currentVersion, newVersion);
                fs.writeFileSync(filePath, content);
              }
            } catch (err) {
              log(`Warning: could not update ${cells[0]}: ${err.message}`);
            }
          }
        }
      } catch (err) {
        log(`Warning: could not parse tech.md versioning section: ${err.message}`);
      }
    }

    // 4. Commit and push
    git('add -A');
    git(`commit -m ${shellEscape(`chore: bump version to ${newVersion}`)}`);
    git('push');

    log(`Deterministic version bump committed and pushed: ${newVersion}`);
    return true;
  } catch (err) {
    log(`Warning: performDeterministicVersionBump failed: ${err.message}`);
    return false;
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
let lastClaudePid = null;
let shuttingDown = false;

function handleSignal(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`Received ${signal}. Shutting down gracefully...`);

  // Kill current subprocess
  if (currentProcess && !currentProcess.killed) {
    currentProcess.kill('SIGTERM');
  }

  cleanupProcesses();

  // Commit/push any work
  autoCommitIfDirty(`chore: save work on signal ${signal}`);

  const savedState = readState();
  const nextStep = (savedState.lastCompletedStep || 0) + 1;
  log(`[STATUS] SDLC runner stopped (${signal}). Work saved. Resume with --resume to continue from Step ${nextStep}.`);
  // Preserve lastCompletedStep for resume — don't reset step tracking.
  // Mark signalShutdown so detectAndHydrateState knows the auto-push was WIP,
  // not a completed commitPush step.
  updateState({ runnerPid: null, signalShutdown: true });
  removeUnattendedMode();
  process.exit(0);
}

process.on('SIGTERM', () => handleSignal('SIGTERM'));
process.on('SIGINT', () => handleSignal('SIGINT'));


// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

/**
 * Run a post-step validation gate. If the validator fails, retry or escalate
 * using the standard pattern shared by steps 3, 6, and 8.
 * Returns null if validation passed, or a step result string ('retry'|'escalated').
 */
async function runValidationGate(step, state, validateFn, label) {
  const check = validateFn();
  if (check.ok) return null;

  const reason = check.reason || check.missing?.join(', ') || 'unknown';
  log(`${label} failed: ${reason}`);
  log(`[STATUS] ${label} failed after Step ${step.number} — ${reason}. Retrying...`);

  const retries = state.retries || {};
  const count = (retries[step.number] || 0) + 1;
  if (count >= MAX_RETRIES) {
    await escalate(step, `${label} failed after ${MAX_RETRIES} attempts`);
    return 'escalated';
  }
  updateState({ retries: { ...retries, [step.number]: count } });
  return 'retry';
}

async function runStep(step, state) {
  log(`=== Step ${step.number}: ${step.key} ===`);

  // Validate preconditions
  const preconds = validatePreconditions(step, state);
  if (!preconds.ok) {
    const failedCheck = preconds.failedCheck || preconds.reason;
    log(`Preconditions failed for step ${step.number} (${step.key}): "${failedCheck}"`);
    log(`[STATUS] Step ${step.number} (${step.key}) preconditions failed: "${failedCheck}"`);

    if (step.number > 1) {
      const prevStep = STEPS[step.number - 2];
      if (incrementBounceCount()) {
        await escalate(prevStep, `Bounce loop: ${bounceCount} step-back transitions exceed threshold ${MAX_BOUNCE_RETRIES} (precondition: ${failedCheck})`);
        return 'escalated';
      }
      log(`Step ${step.number} (${step.key}) bounced to Step ${prevStep.number} (${prevStep.key}). Precondition failed: "${failedCheck}". (bounce ${bounceCount}/${MAX_BOUNCE_RETRIES})`);
      log(`[STATUS] Step ${step.number} (${step.key}) bounced to Step ${prevStep.number} (${prevStep.key}). Precondition failed: "${failedCheck}". (bounce ${bounceCount}/${MAX_BOUNCE_RETRIES})`);
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
  log(`[STATUS] Starting Step ${step.number}: ${step.key}${state.currentIssue ? ` (issue #${state.currentIssue})` : ''}...`);

  // Run claude
  let result;
  result = await runClaude(step, state);
  log(`Step ${step.number} exited with code ${result.exitCode} in ${result.duration}s`);
  writeStepLog(step.key, result);
  cleanupProcesses();

  if (result.exitCode === 0) {
    // Check for soft failures (exit code 0 but step did not succeed)
    const softFailure = detectSoftFailure(result.stdout);
    if (softFailure.isSoftFailure) {
      log(`Soft failure detected: ${softFailure.reason}`);
      log(`[STATUS] Step ${step.number} (${step.key}) soft failure: ${softFailure.reason}`);
      return await handleFailure(step, result, state);
    }

    // Extract state updates
    const patch = extractStateFromStep(step, result, state);
    // Track completed step for resume (step 9 resets this to 0 via its own patch)
    if (patch.lastCompletedStep === undefined) {
      patch.lastCompletedStep = step.number;
    }
    state = updateState(patch);

    // Step 2 postcondition: a feature branch must be checked out. When the
    // skill bails without creating one (e.g., AskUserQuestion was denied in
    // unattended mode and the model fell back to a text prompt), the exit
    // code is still 0 but HEAD stays on main. Without this gate, downstream
    // preconditions bounce repeatedly until the bounce-loop guard escalates.
    // Treat "no feature branch" as a soft failure so the retry path handles
    // it deterministically.
    if (step.number === STEP_NUMBER.startIssue && !SINGLE_ISSUE_NUMBER) {
      if (!state.currentIssue || !state.currentBranch || state.currentBranch === 'main') {
        log('Soft failure detected: step 2 exited 0 but no feature branch was created');
        log(`[STATUS] Step 2 (startIssue) soft failure: no feature branch created (HEAD on ${state.currentBranch || 'main'})`);
        return await handleFailure(step, result, state);
      }
    }

    // Special: spec validation gate after writeSpecs
    if (step.number === STEP_NUMBER.writeSpecs) {
      const gate = await runValidationGate(step, state, () => validateSpecs(state), 'Spec validation');
      if (gate) return gate;
    }

    // Special: push validation gate after commitPush
    if (step.number === STEP_NUMBER.commitPush) {
      const gate = await runValidationGate(step, state, validatePush, 'Push validation');
      if (gate) return gate;
    }

    // Special: version bump postcondition gate after createPR
    if (step.number === STEP_NUMBER.createPR) {
      const versionCheck = validateVersionBump();
      if (!versionCheck.ok) {
        log(`Version bump missing: ${versionCheck.reason}`);
        log(`[STATUS] Version bump missing after Step ${STEP_NUMBER.createPR} — ${versionCheck.reason}. Performing deterministic bump...`);
        const bumped = performDeterministicVersionBump(state);
        if (bumped) {
          log(`[STATUS] Deterministic version bump succeeded. Retrying Step ${STEP_NUMBER.createPR}...`);
          return 'retry';
        } else {
          // Could not bump — warn but don't block PR creation
          log('Warning: deterministic version bump failed, continuing without version bump');
          log('[STATUS] Warning: could not perform deterministic version bump. Continuing.');
        }
      }
    }

    // Auto-commit implementation so the simplify/verify "commits ahead of main" precondition passes
    if (step.number === STEP_NUMBER.implement) {
      const issue = state.currentIssue || 'unknown';
      const committed = autoCommitIfDirty(`feat: implement issue #${issue}`);
      if (committed) {
        log(`[STATUS] Auto-committed implementation changes after Step ${STEP_NUMBER.implement}.`);
      }
    }

    // Special: CI validation gate after monitorCI
    if (step.number === STEP_NUMBER.monitorCI) {
      const gate = await runValidationGate(step, state, validateCI, 'CI validation');
      if (gate) return gate;
    }

    log(`[STATUS] Step ${step.number} (${step.key}) complete.${result.duration > 60 ? ` (${Math.round(result.duration / 60)}min)` : ''}`);
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
  if (EFFORT) log(`Effort: ${EFFORT}`);
  if (DRY_RUN) log('DRY-RUN MODE — no actions will be executed');
  if (SINGLE_STEP) log(`Single step mode: running only step ${SINGLE_STEP}`);
  if (SINGLE_ISSUE_NUMBER) log(`Single issue mode: #${SINGLE_ISSUE_NUMBER}`);
  if (RESUME) log('Resume mode: continuing from existing state');

  // Validate project path exists and is a git repo
  if (!fs.existsSync(PROJECT_PATH)) {
    log(`Error: projectPath does not exist: ${PROJECT_PATH}`);
    process.exit(1);
  }
  try {
    git('rev-parse --is-inside-work-tree');
  } catch {
    log(`Error: projectPath is not a git repository: ${PROJECT_PATH}`);
    process.exit(1);
  }

  // Ensure runner artifacts are gitignored before creating any
  ensureRunnerArtifactsGitignored();

  // Self-heal: untrack runner artifacts that were committed before gitignore was in place
  untrackRunnerArtifactsIfTracked();

  // Ensure unattended-mode flag exists
  const unattendedModePath = path.join(PROJECT_PATH, '.claude', 'unattended-mode');
  if (!fs.existsSync(unattendedModePath)) {
    const dir = path.dirname(unattendedModePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(unattendedModePath, '');
    log('Created .claude/unattended-mode flag');
  }

  // Detect in-progress work from git state (runs on every startup)
  const detected = detectAndHydrateState();
  let state;

  if (detected && detected._merged) {
    // PR was merged but we were still on the feature branch — start fresh
    state = defaultState();
    writeState(state);
    log('Detected merged PR on feature branch. Checked out main for fresh cycle.');
    log('[STATUS] Detected merged PR — checked out main, starting fresh cycle.');
  } else if (detected) {
    // In-progress work detected from git/filesystem artifacts
    const nextStep = detected.lastCompletedStep + 1;

    // Preserve retry counts from state file if --resume was passed
    if (RESUME && fs.existsSync(STATE_PATH)) {
      const savedState = readState();
      detected.retries = savedState.retries || {};
    } else {
      if (RESUME) log('Warning: --resume specified but state file not found — retry history lost. Starting with empty retry counters.');
      detected.retries = {};
    }

    state = { ...defaultState(), ...detected };
    writeState(state);
    log(`Detected in-progress work: issue #${detected.currentIssue}, branch "${detected.currentBranch}", lastCompletedStep=${detected.lastCompletedStep} — resuming from step ${nextStep}`);
    log(`[STATUS] Detected in-progress work on issue #${detected.currentIssue} (step ${detected.lastCompletedStep} complete). Resuming from Step ${nextStep}.`);
  } else if (RESUME) {
    // No feature branch detected but --resume passed — use state file
    state = readState();
    const nextStep = (state.lastCompletedStep || 0) + 1;
    log(`Resuming: last completed step ${state.lastCompletedStep || 0}, starting from step ${nextStep}. Issue: #${state.currentIssue || 'none'}`);
    log(`[STATUS] SDLC runner resuming from Step ${nextStep}.`);
  } else {
    // Fresh start on main — normal behavior
    state = defaultState();
    writeState(state);
    log('[STATUS] SDLC runner started.');
  }

  // Record PID
  updateState({ runnerPid: process.pid });

  // Single step mode
  if (SINGLE_STEP) {
    const step = STEPS[SINGLE_STEP - 1];
    if (!step) {
      console.error(`Invalid step number: ${SINGLE_STEP}`);
      removeUnattendedMode();
      process.exit(1);
    }
    state = readState();
    const result = await runStep(step, state);
    log(`Single step result: ${result}`);
    removeUnattendedMode();
    process.exit(result === 'ok' ? 0 : 1);
  }

  // Main continuous loop
  while (!shuttingDown) {
    // Check for open issues (skip in single-issue mode — we already know which issue to work on)
    if (!SINGLE_ISSUE_NUMBER && !DRY_RUN && !hasOpenIssues()) {
      log('No more open issues. All done!');
      log('[STATUS] No more open issues in the project. SDLC runner complete.');
      updateState({ currentStep: 0 });
      removeUnattendedMode();
      break;
    }

    // Check if all remaining issues have been escalated this session (skip in single-issue mode)
    if (!SINGLE_ISSUE_NUMBER && !DRY_RUN && escalatedIssues.size > 0 && !hasNonEscalatedIssues()) {
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

      // Post-startIssue safety check: halt if Claude selected an escalated issue (skip in single-issue mode)
      if (!SINGLE_ISSUE_NUMBER && result === 'ok' && step.number === STEP_NUMBER.startIssue) {
        const freshState = readState();
        if (freshState.currentIssue && escalatedIssues.has(freshState.currentIssue)) {
          await haltFailureLoop('all issues escalated', [
            `Step 2 selected issue #${freshState.currentIssue} which was previously escalated.`,
            `Escalated issues: ${[...escalatedIssues].map(i => `#${i}`).join(', ')}`,
          ]);
        }
      }

      // After successful merge, reset consecutive escalation counter
      if (result === 'ok' && step.number === STEP_NUMBER.merge) {
        consecutiveEscalations = 0;
        if (SINGLE_ISSUE_NUMBER) {
          log(`Single-issue mode: issue #${SINGLE_ISSUE_NUMBER} complete. Exiting.`);
          removeUnattendedMode();
          break; // Exit the for loop
        }
      }
    }

    // Single-issue mode: exit the while loop after the for loop completes
    if (SINGLE_ISSUE_NUMBER) break;

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

if (isMainModule) {
  main().catch((err) => {
    log(`Fatal error: ${err.message}`);
    log(`[STATUS] SDLC runner crashed: ${err.message}`);
    removeUnattendedMode();
    process.exit(1);
  });
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const __test__ = {
  resetState() {
    bounceCount = 0;
    consecutiveEscalations = 0;
    escalatedIssues.clear();
    SINGLE_ISSUE_NUMBER = null;
  },
  setConfig(cfg) {
    PROJECT_PATH = cfg.projectPath ?? PROJECT_PATH;
    PLUGINS_PATH = cfg.pluginsPath ?? PLUGINS_PATH;
    MODEL = cfg.model ?? MODEL;
    if ('effort' in cfg) EFFORT = cfg.effort;
    MAX_RETRIES = cfg.maxRetriesPerStep ?? MAX_RETRIES;
    MAX_BOUNCE_RETRIES = cfg.maxBounceRetries === undefined
      ? MAX_BOUNCE_RETRIES
      : parseMaxBounceRetries(cfg.maxBounceRetries);
    if ('singleIssueNumber' in cfg) SINGLE_ISSUE_NUMBER = cfg.singleIssueNumber;
    CLEANUP_PATTERNS = cfg.cleanup?.processPatterns ?? CLEANUP_PATTERNS;
    STATE_PATH = cfg.statePath ?? STATE_PATH;
    DRY_RUN = cfg.dryRun ?? DRY_RUN;
    RESUME = cfg.resume ?? RESUME;
    LOG_DIR = cfg.logDir ?? LOG_DIR;
    ORCHESTRATION_LOG = cfg.orchestrationLog ?? ORCHESTRATION_LOG;
    if (cfg.configSteps !== undefined) configSteps = cfg.configSteps;
  },
  get singleIssueNumber() { return SINGLE_ISSUE_NUMBER; },
  set singleIssueNumber(v) { SINGLE_ISSUE_NUMBER = v; },
  get bounceCount() { return bounceCount; },
  set bounceCount(v) { bounceCount = v; },
  get consecutiveEscalations() { return consecutiveEscalations; },
  set consecutiveEscalations(v) { consecutiveEscalations = v; },
  get escalatedIssues() { return escalatedIssues; },
  get currentProcess() { return currentProcess; },
  get lastClaudePid() { return lastClaudePid; },
  set lastClaudePid(v) { lastClaudePid = v; },
};

// ---------------------------------------------------------------------------
// Named exports for testability
// ---------------------------------------------------------------------------

export {
  detectSoftFailure,
  detectAndHydrateState,
  isStepOutcomeSatisfied,
  validatePreconditions,
  extractStateFromStep,
  matchErrorPattern,
  incrementBounceCount,
  defaultState,
  validateConfig,
  getConfigObject,
  resolveStepConfig,

  findFeatureDir,
  checkRequiredSpecFiles,
  parseMaxBounceRetries,
  classifyBumpType,
  runValidationGate,

  validateSpecs,
  validateSpecContent,
  validateCI,
  validatePush,
  validateVersionBump,
  performDeterministicVersionBump,
  autoCommitIfDirty,
  buildClaudeArgs,
  readSkill,
  handleFailure,
  escalate,
  haltFailureLoop,

  runStep,
  log,
  readState,
  writeState,
  updateState,
  runClaude,
  removeUnattendedMode,
  ensureRunnerArtifactsGitignored,
  cleanupProcesses,
  getChildPids,
  getProcessTree,
  killProcessTree,
  findProcessesByPattern,
  handleSignal,
  hasOpenIssues,
  hasNonEscalatedIssues,
  writeStepLog,
  extractResultFromStream,
  extractSessionId,
  enforceMaxDisk,
  resolveLogDir,
  sleep,
  main,
  IS_WINDOWS,
  STEPS,
  STEP_KEYS,
  STEP_NUMBER,
  REQUIRED_SPEC_FILES,
  RUNNER_ARTIFACTS,
  IMMEDIATE_ESCALATION_PATTERNS,
  TEXT_FAILURE_PATTERNS,
  BENIGN_DENIED_TOOLS,
  RATE_LIMIT_PATTERN,
  VALID_EFFORTS,
  MAX_CONSECUTIVE_ESCALATIONS,
  __test__,
};
