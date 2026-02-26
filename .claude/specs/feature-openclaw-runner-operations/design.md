# Design: OpenClaw Runner Operations

**Issues**: #12, #24, #33, #34, #88, #90
**Date**: 2026-02-25
**Status**: Complete
**Author**: Claude Code (consolidated from issues #12, #24, #33, #34, #88)

---

## Overview

The SDLC runner (`openclaw/scripts/sdlc-runner.mjs`) is a Node.js script that orchestrates the complete SDLC cycle using deterministic `for`-loop step sequencing. Each step spawns a `claude -p` subprocess with a specific skill prompt, configurable maxTurns and timeout, and precondition validation. The runner handles retry logic with escalation, Discord status updates via `openclaw message send`, auto-commit of dirty work trees, and resume detection from git state.

The runner reads configuration from `sdlc-config.json`, which provides per-step settings (maxTurns, timeout, prompt templates). On startup, the runner inspects the git state (branch name, spec files, commit count, PR status, CI status) to determine if in-progress work exists and resumes from the correct step. State is tracked via `lastCompletedStep` in `.claude/sdlc-state.json`.

The companion OpenClaw skill (`openclaw/skills/running-sdlc/SKILL.md`) provides the Claude Code skill interface that OpenClaw uses to invoke the runner.

Additional capabilities built onto this foundation:
- **Process cleanup** (issue #24): A configurable `cleanupProcesses()` function kills orphaned processes (e.g., Chrome) at step transitions, escalation, and shutdown.
- **Failure loop detection** (issue #33): In-memory tracking of consecutive escalations, escalated-issue sets, and per-cycle bounce counts with `haltFailureLoop()` for deterministic exits.
- **Persistent logging** (issue #34): Per-step log files written to an OS-agnostic temp directory with disk usage enforcement.
- **Configurable bounce retries** (issue #88): The bounce loop threshold is configurable via `maxBounceRetries` in the config, with enhanced diagnostic messages including the specific failed precondition name.
- **Spec content validation** (issue #90): Post-Step 3 validation extended beyond file existence to check content structure — required frontmatter fields and heading patterns — with per-file, per-check failure reporting.

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────────┐
│            OpenClaw Platform                       │
│  ┌────────────────────────────────────────┐       │
│  │  running-sdlc Skill (SKILL.md)         │       │
│  │  → invokes sdlc-runner.mjs             │       │
│  └──────────────┬─────────────────────────┘       │
└─────────────────┼────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────┐
│         sdlc-runner.mjs (Node.js)                 │
├──────────────────────────────────────────────────┤
│  1. Load config (sdlc-config.json)                │
│  2. Detect in-progress work (git state)           │
│  3. For each step:                                │
│     a. Validate preconditions                     │
│     b. Post Discord status (start)                │
│     c. Spawn claude -p subprocess                 │
│     d. Handle success/failure                     │
│     e. Post Discord status (complete/fail)        │
│     f. Retry on failure (with escalation)         │
│     g. Auto-commit if dirty (step 4)              │
│     h. [#24] cleanupProcesses() post-step         │
│     i. [#34] writeStepLog() per-step              │
│     j. [#90] validateSpecContent() post-step 3    │
│  4. Track lastCompletedStep                       │
│  5. [#33] Detect failure loops → haltFailureLoop()│
└──────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────┐    ┌──────────────────┐
│ claude -p   │    │ openclaw message  │
│ subprocesses│    │ send (Discord)    │
└─────────────┘    └──────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ <os.tmpdir()>/sdlc-logs/<proj>/  │
│ ├── sdlc-runner.log              │
│ ├── writeSpecs-abc123-*.log      │
│ ├── implementSpecs-def456-*.log  │
│ └── verify-live.log (real-time)  │
└──────────────────────────────────┘
```

### Data Flow

```
1. OpenClaw invokes running-sdlc skill
2. Runner loads sdlc-config.json (including cleanup patterns, log config)
3. Runner resolves log directory (os.tmpdir()/sdlc-logs/<project>/ or custom)
4. Runner checks git state for in-progress work
5. For each SDLC step (7+ steps):
   a. Validate step preconditions (git branch, spec files, commits, PR, CI)
   b. Post Discord start message
   c. Spawn claude -p with skill prompt, maxTurns, timeout
   d. On completion: writeStepLog() (non-fatal)
   e. cleanupProcesses() (non-fatal)
   f. On success: track lastCompletedStep, post Discord success
   g. On failure: retry up to cap, escalate if exhausted
      - escalate() checks consecutive escalation count → haltFailureLoop() if >= 2
   h. bounce detection in handleFailure() and runStep() precondition paths
   i. After implementation: auto-commit dirty work tree
   j. After step 3 file-existence check passes: validateSpecContent() reads files and checks structure
6. After all steps: post completion to Discord; reset consecutiveEscalations
```

---

## File Changes

| File | Type | Purpose |
|------|------|---------|
| `openclaw/scripts/sdlc-runner.mjs` | Create | Main Node.js orchestrator script (issues #12, #24, #33, #34, #88, #90) |
| `openclaw/scripts/sdlc-config.example.json` | Create/Modify | Config template — per-step settings (#12), cleanup patterns (#24), logging fields (#34), `maxBounceRetries` (#88) |
| `openclaw/skills/running-sdlc/SKILL.md` | Create/Modify | OpenClaw skill — invokes runner (#12), cleanup docs (#24), logging docs (#34) |

---

## Process Cleanup Design (Issue #24)

### From Issue #24

This section describes the configurable post-step process cleanup mechanism added to the SDLC runner.

#### Overview

When enabled via a `cleanup.processPatterns` config field, the runner will kill processes matching the configured patterns at key transition points: after every step completes, during escalation, and on graceful shutdown.

The implementation is minimal — a single `cleanupProcesses()` function called from three existing code paths. It uses `pgrep`/`pkill` with `-f` (full command-line matching) to find and kill processes, enabling operators to target specific process configurations (e.g., Chrome launched with `--remote-debugging-port`) rather than all instances of a binary. On macOS, `pgrep -f` requires a `--` end-of-options separator before patterns that start with dashes (e.g., `--remote-debugging-port`) to prevent them being interpreted as flags.

#### Config Schema Addition

The `cleanup` field is a new optional top-level key in `sdlc-config.json`:

```json
{
  "projectPath": "/path/to/project",
  "pluginsPath": "/path/to/nmg-plugins",
  "model": "opus",
  "cleanup": {
    "processPatterns": ["--remote-debugging-port", "chromium"]
  },
  "steps": { ... }
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `cleanup` | object | No | `undefined` | Cleanup configuration block |
| `cleanup.processPatterns` | string[] | No | `[]` | Array of patterns matched against full process command line via `pgrep -f --` / `pkill -f` |

#### New Function: `cleanupProcesses()`

```javascript
/**
 * Kill processes matching configured cleanup patterns.
 * Non-fatal — logs warnings on failure, never throws.
 */
function cleanupProcesses() { ... }
```

- **Called from**: `runStep()`, `escalate()`, `handleSignal()`
- **Behavior**: No-op when `CLEANUP_PATTERNS` is empty
- **Error handling**: Catches all errors; logs warnings; never prevents the runner from continuing
- **Self-protection**: Excludes the runner's own PID from kills

#### Implementation Details

Config loading:
```javascript
const CLEANUP_PATTERNS = config.cleanup?.processPatterns || [];
```

`cleanupProcesses()` implementation:
```javascript
function cleanupProcesses() {
  if (CLEANUP_PATTERNS.length === 0) return;

  for (const pattern of CLEANUP_PATTERNS) {
    try {
      const pids = execSync(`pgrep -f -- ${shellEscape(pattern)}`, { encoding: 'utf8', timeout: 5000 })
        .trim()
        .split('\n')
        .filter(pid => pid && parseInt(pid, 10) !== process.pid);

      if (pids.length === 0) continue;

      execSync(`pkill -f ${shellEscape(pattern)}`, { timeout: 5000 });
      log(`[CLEANUP] Killed ${pids.length} process(es) matching "${pattern}"`);
    } catch (err) {
      if (err.status === 1) continue;
      log(`[CLEANUP] Warning: cleanup for pattern "${pattern}" failed: ${err.message}`);
    }
  }
}
```

Shell escape helper:
```javascript
function shellEscape(str) {
  return "'" + str.replace(/'/g, "'\\''") + "'";
}
```

Integration points:
1. `runStep()` — after `runClaude()` returns, before `exitCode === 0` branch (AC2)
2. `escalate()` — at the top, before committing partial work (AC3)
3. `handleSignal()` — after killing subprocess, before commit/push (AC4)

#### Cleanup Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| **A: Process group killing** | Use `kill -TERM -<pgid>` to kill entire process group | Rejected — too invasive, platform issues |
| **B: pgrep/pkill with -f** | Pattern-match against full command line | **Selected** — matches issue requirements exactly |
| **C: Node.js process listing** | Parse `ps aux` output programmatically | Rejected — unnecessary complexity |

#### Cleanup Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Pattern matches unintended processes | Medium | High | Document that patterns should be specific; operator configures patterns |
| `pkill` kills the runner itself | Low | High | Filter `process.pid` from matches |
| `pgrep`/`pkill` not available on target OS | Low | Medium | Both are standard on macOS and Linux; out of scope for Windows |
| Cleanup delays step transitions | Low | Low | 5-second timeout on `pgrep`/`pkill`; non-fatal error handling |

---

## Failure Loop Detection Design (Issue #33)

### From Issue #33

This section describes the failure loop detection and halt mechanism added to the SDLC runner.

#### Overview

The SDLC runner's outer `while (!shuttingDown)` loop has no failure cap. After an escalation, it immediately picks up the next (or same) issue and can fail again indefinitely. This design adds three in-memory tracking mechanisms — consecutive escalation count, an escalated-issues set, and a per-cycle bounce counter — with a new `haltFailureLoop()` function that exits immediately without cleanup, preserving state for manual inspection.

All changes are confined to `openclaw/scripts/sdlc-runner.mjs`. No new files, no external dependencies, no changes to the skill layer.

#### Component Diagram

```
sdlc-runner.mjs
├── In-Memory Tracking (new)
│   ├── consecutiveEscalations: number    ← reset on successful step 9
│   ├── escalatedIssues: Set<number>      ← grows per session, never reset
│   └── bounceCount: number               ← reset at start of each cycle
│
├── haltFailureLoop(type, details) (new)
│   ├── Posts diagnostic to Discord
│   └── process.exit(1) — NO cleanup
│
├── escalate() (modified)
│   ├── Records issue in escalatedIssues
│   ├── Increments consecutiveEscalations
│   ├── Checks threshold → haltFailureLoop() if exceeded
│   └── Normal cleanup (commit, checkout main, reset state) if under threshold
│
├── handleFailure() (modified)
│   └── retry-previous path: increments bounceCount, checks threshold
│
├── runStep() (modified)
│   └── Precondition retry-previous path: increments bounceCount, checks threshold
│
├── buildClaudeArgs() (modified)
│   └── Step 2 prompt: includes escalated issue exclusion list
│
└── main() loop (modified)
    ├── Before step 2: check if non-escalated issues exist
    ├── After step 2: verify selected issue is not in escalatedIssues
    ├── Start of cycle: reset bounceCount
    └── After successful step 9: reset consecutiveEscalations
```

#### New `haltFailureLoop()` Function

```javascript
async function haltFailureLoop(loopType, details) {
  const diagnostic = [
    `FAILURE LOOP DETECTED: ${loopType}`,
    ...details,
    `Consecutive escalations: ${consecutiveEscalations}`,
    `Escalated issues: ${[...escalatedIssues].map(n => '#' + n).join(', ') || 'none'}`,
    'Runner halting. State preserved for manual inspection.',
    'sdlc-state.json, .claude/auto-mode, and working tree left as-is.',
  ].filter(Boolean).join('\n');

  log(diagnostic);
  await postDiscord(diagnostic);
  process.exit(1);
}
```

**Key design decision**: This function does NOT call `removeAutoMode()`, `updateState()`, or `git checkout main`. It exits immediately, preserving the full failure state for debugging.

#### Modified `escalate()` Function

Before cleanup, record the issue in `escalatedIssues`, increment `consecutiveEscalations`, and check the threshold:

```javascript
async function escalate(step, reason, output = '') {
  const state = readState();
  const truncated = (output || '').slice(-500);

  // Track failure loop metrics
  if (state.currentIssue) {
    escalatedIssues.add(state.currentIssue);
  }
  consecutiveEscalations++;

  if (consecutiveEscalations >= 2) {
    await haltFailureLoop('consecutive escalations', [
      `${consecutiveEscalations} consecutive cycles resulted in escalation.`,
      `Last step: ${step.number} (${step.key})`,
      `Reason: ${reason}`,
      `Affected issues: ${[...escalatedIssues].map(n => '#' + n).join(', ')}`,
      truncated ? `Last output: ...${truncated}` : '',
    ]);
  }

  cleanupProcesses();
  log(`ESCALATION: Step ${step.number} — ${reason}`);
  // ... rest of existing escalate() unchanged ...
}
```

#### `hasNonEscalatedIssues()` Helper

```javascript
function hasNonEscalatedIssues() {
  if (escalatedIssues.size === 0) return true;
  try {
    const issues = gh('issue list --state open --json number');
    const parsed = JSON.parse(issues);
    return parsed.some(issue => !escalatedIssues.has(issue.number));
  } catch {
    return true; // Conservative: assume non-escalated issues exist
  }
}
```

#### Failure Loop Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| **A: Persistent tracking** | Store counters in `sdlc-state.json` | Rejected — complicates state management; stale data after manual intervention |
| **B: Configurable thresholds** | Add `maxConsecutiveEscalations`, `maxBounces` to config | ~~Rejected — out of scope for first iteration~~ Partially implemented in #88: bounce threshold is now configurable via `maxBounceRetries`; consecutive escalation threshold remains hardcoded at 2 |
| **C: Modify `escalate()` to accept cleanup flag** | Pass `skipCleanup: true` to `escalate()` | Rejected — increases complexity |
| **D: Separate `haltFailureLoop()` + check-before-escalate** | Increment counter and check before cleanup | **Selected** — clearest contract |

#### Failure Loop Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `process.exit(1)` prevents graceful async cleanup | Low | Medium | Discord message is posted before exit; state is preserved on disk |
| Step 2 prompt exclusion ignored by Claude | Low | Low | Post-step-2 safety check detects and halts if escalated issue selected |
| `bounceCount` threshold too low | Low | Medium | Now configurable via `maxBounceRetries` (#88); default 3 matches existing per-step tolerance |
| `hasNonEscalatedIssues()` GitHub query fails | Low | Low | Conservative fallback returns `true` |

---

## Persistent Logging Design (Issue #34)

### From Issue #34

This section describes the persistent per-step logging system added to the SDLC runner.

#### Overview

This design adds persistent per-step logging to the SDLC runner (`sdlc-runner.mjs`). Currently, the `runClaude()` function captures stdout/stderr in memory for error pattern matching but discards it after each step. The orchestration log is hardcoded to `/tmp/sdlc-runner.log` via a `nohup` redirect in the `running-sdlc` SKILL.md.

The change introduces a logging module within `sdlc-runner.mjs` that: (1) resolves an OS-agnostic log directory using `os.tmpdir()`, (2) writes per-step log files with a standardized naming convention after each `runClaude()` call, (3) moves the orchestration log into the same directory, (4) enforces a configurable max disk usage threshold by pruning the oldest log files before each write, and (5) streams subprocess output to live log files in real-time via file descriptors for `tail -f` observability.

The runner uses `--output-format stream-json` (newline-delimited JSON events) instead of `--output-format json` (single blob at completion). This enables real-time streaming: each `runClaude()` call opens a `{step}-live.log` file and writes stdout/stderr chunks as they arrive. The final result is extracted from the stream using `extractResultFromStream()`, which scans for the `type: "result"` event.

All changes are confined to three files: `sdlc-runner.mjs` (logging logic), `running-sdlc/SKILL.md` (nohup redirect path and documentation), and `sdlc-config.example.json` (new config fields). No external dependencies — only `node:os`, `node:fs`, and `node:path`.

#### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    sdlc-runner.mjs                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌──────────────────┐               │
│  │  Config Loader   │──▶│  Log Dir Resolver │               │
│  │  (existing)      │    │  (NEW)            │               │
│  └─────────────────┘    └────────┬─────────┘               │
│                                  │                          │
│                                  ▼                          │
│  ┌─────────────────┐    ┌──────────────────┐               │
│  │  runClaude()     │──▶│  writeStepLog()   │               │
│  │  (existing)      │    │  (NEW)            │               │
│  └─────────────────┘    └────────┬─────────┘               │
│                                  │                          │
│                                  ▼                          │
│                          ┌──────────────────┐               │
│                          │  enforceMaxDisk() │               │
│                          │  (NEW)            │               │
│                          └──────────────────┘               │
│  ┌─────────────────┐                                        │
│  │  log() function  │──▶ Writes to orchestration log file   │
│  │  (MODIFIED)      │    AND console.log (dual output)      │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

#### New Functions in `sdlc-runner.mjs`

| Function | Parameters | Returns | Purpose |
|----------|-----------|---------|---------|
| `resolveLogDir(config, projectPath)` | config object, project path string | `string` (absolute path) | Compute log directory from config `logDir` or default to `os.tmpdir()/sdlc-logs/<project-name>/` |
| `writeStepLog(stepKey, result)` | step key string, `runClaude` result object | `void` | Write per-step log file; non-fatal on error |
| `enforceMaxDisk(logDir, maxBytes)` | directory path, max bytes number | `void` | Delete oldest `.log` files until total under threshold |
| `extractResultFromStream(streamOutput)` | stdout string from `claude --output-format stream-json` | `object\|null` | Extract final result JSON from stream-json output (scans for `type: "result"` event), with fallback for single-JSON format |
| `extractSessionId(jsonOutput)` | stdout string from `claude --output-format stream-json` | `string` | Extract session ID via `extractResultFromStream()`, fallback to UUID |

#### Config Schema Additions

Two new optional fields at the top level of `sdlc-config.json`:

```json
{
  "logDir": "/optional/custom/log/path",
  "maxLogDiskUsageMB": 500
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `logDir` | `string` (optional) | `os.tmpdir()/sdlc-logs/<project-basename>/` | Override log directory path |
| `maxLogDiskUsageMB` | `number` (optional) | `500` | Max total disk usage in MB before oldest logs are pruned |

#### Log Directory Resolution

```javascript
import os from 'node:os';

function resolveLogDir(config, projectPath) {
  if (config.logDir) {
    return path.resolve(config.logDir);
  }
  const projectName = path.basename(projectPath);
  return path.join(os.tmpdir(), 'sdlc-logs', projectName);
}
```

- Uses `os.tmpdir()` for cross-platform default: `/tmp` on Linux/macOS, `C:\Users\<user>\AppData\Local\Temp` on Windows
- `path.basename()` extracts project directory name for namespace isolation
- Custom `logDir` in config overrides the default entirely

#### Orchestration Log Migration

The existing `log()` function is modified to also append to `<logDir>/sdlc-runner.log`:

```javascript
function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  console.log(line.trimEnd());
  try {
    fs.appendFileSync(ORCHESTRATION_LOG, line);
  } catch { /* non-fatal */ }
}
```

This replaces the `nohup ... > /tmp/sdlc-runner.log 2>&1` redirect in the SKILL.md.

#### `writeStepLog()` — Per-Step Log Writing

Called in `runStep()` immediately after `runClaude()` returns, regardless of exit code:

```javascript
function writeStepLog(stepKey, result) {
  try {
    const sessionId = extractSessionId(result.stdout);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${stepKey}-${sessionId}-${ts}.log`;
    const filepath = path.join(LOG_DIR, filename);

    enforceMaxDisk(LOG_DIR, MAX_LOG_DISK_BYTES);

    const content = [
      `Step: ${stepKey}`,
      `Exit Code: ${result.exitCode}`,
      `Duration: ${result.duration}s`,
      `Session: ${sessionId}`,
      `Timestamp: ${new Date().toISOString()}`,
      '---STDOUT---',
      result.stdout,
      '---STDERR---',
      result.stderr,
    ].join('\n');

    fs.writeFileSync(filepath, content);
    log(`Step log written: ${filename}`);
  } catch (err) {
    log(`Warning: failed to write step log: ${err.message}`);
  }
}
```

#### `enforceMaxDisk()` — Disk Usage Enforcement

```javascript
function enforceMaxDisk(logDir, maxBytes) {
  try {
    const files = fs.readdirSync(logDir)
      .filter(f => f.endsWith('.log') && f !== 'sdlc-runner.log')
      .map(f => {
        const fp = path.join(logDir, f);
        const stat = fs.statSync(fp);
        return { path: fp, size: stat.size, mtime: stat.mtimeMs };
      })
      .sort((a, b) => a.mtime - b.mtime); // oldest first

    let totalSize = files.reduce((sum, f) => sum + f.size, 0);

    while (totalSize > maxBytes && files.length > 0) {
      const oldest = files.shift();
      fs.unlinkSync(oldest.path);
      totalSize -= oldest.size;
      log(`Pruned old log: ${path.basename(oldest.path)}`);
    }
  } catch (err) {
    log(`Warning: disk cleanup failed: ${err.message}`);
  }
}
```

Key decisions:
- Excludes `sdlc-runner.log` from pruning — the orchestration log is always preserved
- Only prunes `.log` files — won't accidentally delete non-log files
- Sorted by mtime (oldest first) — preserves recent logs
- Non-fatal — cleanup failure doesn't block step log writing

#### Integration Point in `runStep()`

```javascript
const result = await runClaude(step, state);
log(`Step ${step.number} exited with code ${result.exitCode} in ${result.duration}s`);

// Persist step log (non-fatal)
writeStepLog(step.key, result);

cleanupProcesses();
```

#### SKILL.md Change

The `running-sdlc` SKILL.md step 6 (launch command) changes from:
```bash
nohup node <runner-path>/sdlc-runner.mjs --config <config-path> --discord-channel <channel-id> > /tmp/sdlc-runner.log 2>&1 &
```
To:
```bash
nohup node <runner-path>/sdlc-runner.mjs --config <config-path> --discord-channel <channel-id> 2>&1 &
```

The skill also gains a **Logging** section documenting the log directory location, naming convention, and config fields.

#### Logging Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| **A: Separate log module file** | Extract logging into a new `sdlc-logger.mjs` file | Rejected — single file aligns with existing pattern |
| **B: Stream-based writing** | Pipe subprocess stdout/stderr directly to log files during execution | **Now implemented** — `runClaude()` streams to `{step}-live.log` via file descriptors for real-time `tail -f` observability. Post-execution `writeStepLog()` still writes the final archived log. |
| **C: Write logs in `runClaude()`** | Move log writing into `runClaude()` itself | Rejected — caller (`runStep()`) has context (step key) |
| **D: Keep nohup redirect for orchestration log** | Continue using shell redirect, only add per-step logs | Rejected — unified approach is cleaner |

#### Logging Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Log write fails (disk full, permissions) | Low | Low | Entire `writeStepLog` is try/caught; failure logged as warning |
| Large Claude output causes memory pressure | Low | Medium | Already captured in memory by `runClaude()`; writing to disk helps GC |
| Timestamp collision in filenames | Very Low | Low | Session ID + timestamp makes collisions extremely unlikely |
| `os.tmpdir()` returns unexpected path | Very Low | Low | Configurable `logDir` override provides escape hatch |
| Pruning deletes recent useful logs | Low | Medium | Prunes oldest first; 500 MB default allows substantial history |

---

## Configurable Bounce Retry Threshold Design (Issue #88)

### From Issue #88

This section describes making the bounce loop retry threshold configurable and enhancing bounce diagnostic messages.

#### Overview

The bounce loop detection (issue #33) originally used the hardcoded `MAX_RETRIES` constant (per-step retry cap, default 3) as its threshold. This design introduces a separate `MAX_BOUNCE_RETRIES` variable loaded from the `maxBounceRetries` config field, with input validation and a default of 3 for backward compatibility. It also enhances bounce-related log and Discord messages to include the specific precondition that failed.

All changes are confined to `openclaw/scripts/sdlc-runner.mjs` and `openclaw/scripts/sdlc-config.example.json`. No new files, no new dependencies.

#### Config Schema Addition

One new optional top-level field in `sdlc-config.json`:

```json
{
  "maxBounceRetries": 3,
  "maxRetriesPerStep": 3
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `maxBounceRetries` | `number` (positive integer) | No | `3` | Maximum step-back transitions allowed per cycle before escalation |

Note: `maxBounceRetries` is distinct from `maxRetriesPerStep`. The former controls bounce-back transitions (step N fails preconditions → retry step N-1), while the latter controls same-step retries (step N fails → retry step N).

#### Config Loading with Validation

```javascript
let MAX_BOUNCE_RETRIES = 3;

// During config loading:
MAX_BOUNCE_RETRIES = (() => {
  const val = config.maxBounceRetries;
  if (val === undefined || val === null) return 3;
  const num = Number(val);
  if (!Number.isInteger(num) || num <= 0) {
    log(`Warning: invalid maxBounceRetries value "${val}" — using default 3`);
    return 3;
  }
  return num;
})();
```

**Validation rules:**
- `undefined` or `null` → default 3 (backward-compatible)
- Non-numeric string (e.g., `"abc"`) → warning + default 3
- Zero or negative → warning + default 3
- Positive integer → use as-is

#### Separation from MAX_RETRIES

Previously, bounce detection used the same `MAX_RETRIES` constant as per-step retries:

```javascript
// Before (issue #33):
if (bounceCount > MAX_RETRIES) { ... }

// After (issue #88):
if (bounceCount > MAX_BOUNCE_RETRIES) { ... }
```

This allows operators to set different thresholds for "retry the same step" vs "bounce back to the previous step". Example: `maxRetriesPerStep: 2` (fail fast on same step) but `maxBounceRetries: 5` (be patient with transient precondition failures).

#### `incrementBounceCount()` Helper

A helper function encapsulates the increment-and-check logic, used in both `handleFailure()` and `runStep()`:

```javascript
function incrementBounceCount() {
  bounceCount++;
  if (bounceCount > MAX_BOUNCE_RETRIES) {
    log(`Bounce loop detected: ${bounceCount} step-back transitions exceed threshold ${MAX_BOUNCE_RETRIES}`);
    return true;  // threshold exceeded
  }
  return false;
}
```

#### Enhanced Discord Bounce Messages

Bounce-related Discord messages now include:
- The specific precondition that failed (`failedCheck` from `validatePreconditions()`)
- The current bounce count and threshold in `(bounce N/M)` format
- The step being bounced to

```javascript
// In handleFailure() and runStep() bounce paths:
await postDiscord(
  `Step ${step.number} (${step.key}) bounced to Step ${prevStep.number} (${prevStep.key}). ` +
  `Precondition failed: "${failedCheck}". (bounce ${bounceCount}/${MAX_BOUNCE_RETRIES})`
);
```

#### Enhanced Log Messages

Bounce-related log messages use the same enriched format:

```javascript
log(`Bounce ${bounceCount}/${MAX_BOUNCE_RETRIES}: Step ${step.number} → Step ${prevStep.number}. Precondition failed: "${failedCheck}"`);
```

#### Integration Points

| Location | Change | Purpose |
|----------|--------|---------|
| Config loading block (~line 98) | Add `MAX_BOUNCE_RETRIES` extraction with IIFE validation | AC25, AC26, AC29 |
| `incrementBounceCount()` (new) | Replace inline `bounceCount++` + threshold check | AC25 — single threshold reference point |
| `handleFailure()` retry-previous path | Use `incrementBounceCount()` + include `failedCheck` in messages | AC27, AC28 |
| `runStep()` precondition retry-previous path | Use `incrementBounceCount()` + include `failedCheck` in messages | AC27, AC28 |
| `sdlc-config.example.json` | Add `maxBounceRetries` field | FR36 |

#### Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| **A: Reuse `maxRetriesPerStep` for bounces** | Keep a single threshold for both retries and bounces | Rejected — operators may want different tolerances for same-step vs cross-step failures |
| **B: Separate `maxBounceRetries` config field** | Dedicated field with validation and default fallback | **Selected** — clear semantics, backward-compatible |
| **C: Nested `bounceLoop.maxRetries` config** | Put under a `bounceLoop` config object | Rejected — over-engineering for a single field |

#### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Operator sets very high threshold, masking real failures | Low | Medium | Document recommended range (3–10) in example config |
| Config value of 0 disables bounce detection entirely | Low | High | Validation rejects 0 with warning; minimum is 1 |
| Existing code paths still reference `MAX_RETRIES` for bounces | Low | Medium | Search-and-replace all bounce paths; verify in tests |

---

## Spec Content Structure Validation Design (Issue #90)

### From Issue #90

This section describes the content structure validation added to the post-Step 3 validation gate in the SDLC runner.

#### Overview

The existing `validateSpecs()` function checks that 4 spec files exist with non-zero size after Step 3 (writing-specs). However, a file containing only a heading or placeholder text passes this check while breaking downstream steps that expect structured content (frontmatter fields, AC headings, task entries).

This design extends `validateSpecs()` with a new `validateSpecContent()` function that reads the content of `requirements.md` and `tasks.md` and checks for required structural elements. The function runs only after existing file-existence checks pass, preserving backward compatibility. Failures report specific missing elements per file and trigger a retry of Step 3 with actionable context.

All changes are confined to `openclaw/scripts/sdlc-runner.mjs`. No new files, no new dependencies, no config changes.

#### Component Diagram

```
sdlc-runner.mjs
├── validateSpecs() (MODIFIED)
│   ├── Existing: file existence + non-zero size checks
│   └── NEW: if files pass → validateSpecContent()
│
├── validateSpecContent(featureDir) (NEW)
│   ├── Read requirements.md → check for **Issues**: and ### AC
│   ├── Read tasks.md → check for ### T
│   └── Return { ok, issues[] } with per-file, per-check detail
│
└── runStep() post-step-3 gate (MODIFIED)
    └── validateSpecs() failure now includes content issues in retry context
```

#### New Function: `validateSpecContent()`

```javascript
/**
 * Validate spec file content structure after file-existence checks pass.
 * Returns { ok: boolean, issues: string[] } with per-file detail.
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
```

**Design decisions:**

| Decision | Rationale |
|----------|-----------|
| Regex `\*\*Issues?\*\*\s*:` matches both `**Issues**:` and `**Issue**:` | Backward compatibility with legacy single-issue field name |
| Regex `^### AC\d` requires line-start `###` followed by `AC` and a digit | Matches `### AC1:`, `### AC12:`, etc. without false positives on prose mentioning "AC" |
| Regex `^### T\d` matches task headings | Matches `### T001:`, `### T01:`, `### T1:` — any task numbering format |
| `m` flag on regexes | Enables `^` to match start of any line, not just start of string |
| Read errors caught per-file | A read error on one file doesn't prevent checking the other |
| Returns `issues[]` not `missing[]` | Distinct from `validateSpecs()` existing `missing[]` (which tracks missing files) to avoid confusion |

#### Modified `validateSpecs()`

The existing function gains a content validation step after file-existence checks pass:

```javascript
function validateSpecs(state) {
  // ... existing directory and file existence checks (unchanged) ...

  const required = ['requirements.md', 'design.md', 'tasks.md', 'feature.gherkin'];
  const missing = required.filter(f => {
    const fp = path.join(featureDir, f);
    return !fs.existsSync(fp) || fs.statSync(fp).size === 0;
  });

  if (missing.length > 0) {
    return { ok: false, missing };  // File-existence failure — unchanged behavior
  }

  // NEW: Content structure validation (only runs when all files exist)
  const contentCheck = validateSpecContent(featureDir);
  if (!contentCheck.ok) {
    return { ok: false, missing: contentCheck.issues };
  }

  // ... existing featureName state update (unchanged) ...
  return { ok: missing.length === 0, missing };
}
```

**Key constraint**: Content validation runs ONLY when all 4 files exist with non-zero size. This preserves the existing error reporting hierarchy — missing files are always reported as missing-file errors, never as content errors.

#### Integration Point in `runStep()` Post-Step-3 Gate

The existing post-step-3 gate code requires no changes. It already:
1. Calls `validateSpecs(state)` and checks `specCheck.ok`
2. Logs `specCheck.missing.join(', ')` — now includes content issues
3. Posts to Discord with the specific missing elements
4. Retries or escalates based on retry count

The only change is that `specCheck.missing` may now contain content structure issues (e.g., `"requirements.md: missing **Issues**: frontmatter"`) in addition to the existing file-name entries (e.g., `"requirements.md"`). The downstream logging and Discord reporting handle both formats identically since they join the array into a comma-separated string.

#### Content Validation Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| **A: Inline content checks in `validateSpecs()`** | Add regex checks directly inside the existing `missing` filter | Rejected — mixes file-existence and content concerns; harder to maintain |
| **B: Separate `validateSpecContent()` function** | Dedicated function called after file checks pass | **Selected** — clear separation of concerns; easy to extend for new files later |
| **C: Config-driven validation rules** | Define content checks in `sdlc-config.json` | Rejected — over-engineering for 3 fixed checks; adds config complexity |
| **D: Full markdown AST parsing** | Parse markdown into AST and validate structure | Rejected — requires external dependency or complex parsing; regex is sufficient for heading/frontmatter checks |

#### Content Validation Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Regex false negatives (valid spec doesn't match) | Low | Medium | Patterns are deliberately broad (`### AC\d` matches any numbering); tested against actual spec output from `/writing-specs` |
| Regex false positives (invalid spec matches) | Low | Low | Content validation is a safety net, not a guarantee — it catches the most common failures (empty specs, missing frontmatter). Semantic correctness is out of scope. |
| `readFileSync` fails on valid files | Very Low | Low | Per-file try/catch; read error reported as an issue, triggers retry |
| Content validation adds latency | Very Low | Very Low | Two small file reads (typically < 50 KB each); negligible relative to multi-minute Claude sessions |
| Legacy specs use `**Issue**:` (singular) | Low | Medium | Regex matches both `**Issues**:` and `**Issue**:` via `Issues?` pattern |

---

## Security Considerations

- [x] No secrets in the runner script or config file
- [x] Discord channel ID is the only external identifier
- [x] `claude -p` subprocesses inherit the user's authentication
- [x] Config file is gitignored by the generating skill
- [x] Shell escaping (`shellEscape()`) prevents command injection via cleanup patterns
- [x] Runner's own PID filtered from cleanup kills
- [x] Log files in temp directory with user permissions; may contain project code (acceptable for local temp storage)

---

## Performance Considerations

- [x] Each step bounded by configurable timeout
- [x] Discord messages have retry with backoff
- [x] Subprocess spawning is efficient (one at a time)
- [x] Resume from git state avoids re-running completed steps
- [x] Cleanup completes in < 5 seconds (timeout enforced); non-fatal on failure
- [x] Failure loop tracking adds negligible overhead (in-memory counters and sets only)
- [x] Log writing is synchronous but negligible relative to multi-minute Claude sessions

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Step Sequencing | BDD | End-to-end cycle scenario |
| Preconditions | BDD | Validation scenario |
| Retry Logic | BDD | Failure and escalation scenario |
| Resume | BDD | In-progress detection scenario |
| Process Cleanup | BDD (Gherkin) | All 6 cleanup acceptance criteria as scenarios |
| Failure Loop Detection | BDD (Gherkin) | All 5 failure loop criteria as scenarios |
| Log dir resolution | Verification | Default path uses `os.tmpdir()`; custom path from config |
| Per-step log writing | Verification | Log files created with correct naming; content includes stdout/stderr |
| Disk cleanup | Verification | Oldest files pruned when over threshold; orchestration log preserved |
| Session ID extraction | Verification | Extracts from valid JSON; falls back to UUID |
| Configurable bounce threshold | BDD (Gherkin) | Config loading, validation, default fallback, enhanced diagnostics |
| Spec content validation | BDD (Gherkin) | Requirements.md frontmatter check, AC heading check, tasks.md task heading check, specific error reporting, retry on failure, file-existence checks preserved |

Per `tech.md`, this project uses Gherkin specs as design artifacts rather than executable tests. Verification is done through `/verifying-specs`.

---

## Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| Prompt-engineered heartbeat loop | Claude drives the loop via prompt | Rejected — non-deterministic, unreliable step ordering |
| Shell script orchestrator | Bash script with claude -p calls | Rejected — limited error handling and state management |
| **Node.js deterministic runner** | for-loop with preconditions, retries, Discord | **Selected** — full control, reliable, maintainable |

---

## Change History

| Issue | Date | Description |
|-------|------|-------------|
| #12 | 2026-02-15 | Initial design — deterministic runner, Discord integration, resume detection, auto-commit, OpenClaw skill |
| #24 | 2026-02-15 | Added process cleanup design — `cleanupProcesses()`, `shellEscape()`, config schema, integration points |
| #33 | 2026-02-16 | Added failure loop detection design — `haltFailureLoop()`, modified `escalate()`, bounce tracking, issue exclusion |
| #34 | 2026-02-16 | Added persistent logging design — `resolveLogDir()`, `writeStepLog()`, `enforceMaxDisk()`, `extractSessionId()`, SKILL.md changes |
| #88 | 2026-02-25 | Added configurable bounce retry threshold — `MAX_BOUNCE_RETRIES` config loading with validation, `incrementBounceCount()` helper, enhanced Discord/log diagnostics |
| #90 | 2026-02-25 | Added spec content structure validation — `validateSpecContent()` function, modified `validateSpecs()` to check frontmatter and headings after file-existence passes, per-file error reporting |

---

## Validation Checklist

- [x] Architecture follows deterministic orchestration pattern
- [x] All file changes documented
- [x] Security considerations addressed
- [x] Alternatives considered (prompt-engineered loop rejected)
- [x] Process cleanup design documented with integration points
- [x] Failure loop detection design documented with state preservation contract
- [x] Persistent logging design documented with cross-platform approach
- [x] Spec content validation design documented with regex patterns, separation of concerns, and backward compatibility
