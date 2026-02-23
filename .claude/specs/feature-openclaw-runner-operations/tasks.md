# Tasks: OpenClaw Runner Operations

**Issues**: #12, #24, #33, #34
**Date**: 2026-02-15
**Status**: Complete
**Author**: Claude Code (consolidated from issues #12, #24, #33, #34)

---

## Summary

| Phase | Issue | Tasks | Status |
|-------|-------|-------|--------|
| Setup (Runner Foundation) | #12 | 1 | [x] |
| Plugin Files (Runner Foundation) | #12 | 2 | [x] |
| Templates/Content (Runner Foundation) | #12 | 1 | [x] |
| Integration (Runner Foundation) | #12 | 1 | [x] |
| Testing (Runner Foundation) | #12 | 1 | [x] |
| Setup (Process Cleanup) | #24 | 2 | [x] |
| Backend (Process Cleanup) | #24 | 1 | [x] |
| Integration (Process Cleanup) | #24 | 3 | [x] |
| Documentation (Process Cleanup) | #24 | 2 | [x] |
| Testing (Process Cleanup) | #24 | 1 | [x] |
| Setup (Failure Loop Detection) | #33 | 1 | [x] |
| Backend (Failure Loop Detection) | #33 | 5 | [x] |
| Integration (Failure Loop Detection) | #33 | 1 | [x] |
| Testing (Failure Loop Detection) | #33 | 1 | [x] |
| Backend (Persistent Logging) | #34 | 4 | [x] |
| Integration (Persistent Logging) | #34 | 1 | [x] |
| Documentation (Persistent Logging) | #34 | 2 | [x] |
| **Total** | **#12–#34** | **27** | |

---

## Task Format

Each task follows this structure:

```
### T[NNN]: [Task Title]

**File(s)**: `{layer}/path/to/file`
**Type**: Create | Modify | Delete
**Depends**: T[NNN], T[NNN] (or None)
**Acceptance**:
- [ ] [Verifiable criterion 1]
- [ ] [Verifiable criterion 2]

**Notes**: [Optional implementation hints]
```

Map `{layer}/` placeholders to actual project paths using `structure.md`.

---

## Issue #12 — OpenClaw SDLC Orchestration

### Phase 1: Setup

#### T001: Create OpenClaw Directory Structure

**File(s)**: `openclaw/scripts/`, `openclaw/skills/running-sdlc/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Scripts directory exists
- [x] Skill directory exists

---

### Phase 2: Plugin Files

#### T002: Create SDLC Runner Script

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Node.js ES module with deterministic step sequencing
- [x] Precondition validation before each step
- [x] `claude -p` subprocess spawning with configurable maxTurns and timeout
- [x] Retry logic with configurable cap and escalation
- [x] Discord status posting via `openclaw message send`
- [x] Auto-commit of dirty work tree after implementation step
- [x] Git state detection for resume behavior
- [x] `lastCompletedStep` tracking in state file

#### T003: Create OpenClaw Skill Definition

**File(s)**: `openclaw/skills/running-sdlc/SKILL.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] SKILL.md provides Claude Code skill interface for OpenClaw
- [x] References sdlc-runner.mjs for execution

---

### Phase 3: Templates/Content

#### T004: Create Config Template

**File(s)**: `openclaw/scripts/sdlc-config.example.json`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] JSON template with per-step maxTurns, timeout, and prompt settings
- [x] Optional discordChannelId field
- [x] Project path and plugins path placeholders

---

### Phase 4: Integration

#### T005: Wire Skill to Runner

**File(s)**: `openclaw/skills/running-sdlc/SKILL.md`
**Type**: Modify
**Depends**: T002, T003
**Status**: Complete
**Acceptance**:
- [x] Skill correctly invokes the runner script
- [x] Config file path is configurable

---

### Phase 5: Testing

#### T006: Create BDD Feature File (Issue #12)

**File(s)**: `.claude/specs/12-openclaw-sdlc-orchestration/feature.gherkin`
**Type**: Create
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] All 6 acceptance criteria have corresponding scenarios

---

## Issue #24 — Configurable Post-Step Process Cleanup

### Phase 6: Setup

#### T007: Add CLEANUP_PATTERNS Config Constant

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] `CLEANUP_PATTERNS` constant extracted from `config.cleanup?.processPatterns` with `[]` default
- [x] Placed after existing config loading block (after line ~77)
- [x] No error thrown when `cleanup` key is absent from config

#### T008: Add shellEscape() Helper Function

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] `shellEscape()` function wraps input in single quotes with proper escaping
- [x] Handles strings containing single quotes (e.g., `it's`)
- [x] Placed in the "Shell helpers" section (near line ~350)

---

### Phase 7: Backend Implementation

#### T009: Implement cleanupProcesses() Function

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T007, T008
**Status**: Complete
**Acceptance**:
- [x] Function is a no-op when `CLEANUP_PATTERNS` is empty
- [x] For each pattern, runs `pgrep -f` to find matching PIDs
- [x] Filters out the runner's own PID (`process.pid`)
- [x] Runs `pkill -f` to kill matching processes
- [x] Logs `[CLEANUP] Killed N process(es) matching "pattern"` for each pattern with matches
- [x] Catches `pgrep`/`pkill` exit code 1 (no matches) silently
- [x] Catches other errors and logs a warning without throwing
- [x] Uses `shellEscape()` for pattern arguments
- [x] 5-second timeout on `execSync` calls

---

### Phase 8: Integration

#### T010: Wire Cleanup into runStep() — Post-Step Cleanup

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T009
**Status**: Complete
**Acceptance**:
- [x] `cleanupProcesses()` called after `runClaude()` returns, before the `exitCode === 0` branch
- [x] Runs on both success and failure paths
- [x] Does not interfere with existing step result handling

#### T011: Wire Cleanup into escalate() — Escalation Cleanup

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T009
**Status**: Complete
**Acceptance**:
- [x] `cleanupProcesses()` called at the top of `escalate()`, before committing partial work
- [x] Does not interfere with existing escalation logic

#### T012: Wire Cleanup into handleSignal() — Graceful Shutdown Cleanup

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T009
**Status**: Complete
**Acceptance**:
- [x] `cleanupProcesses()` called after killing the current subprocess, before committing work
- [x] Does not interfere with existing signal handling or process exit

---

### Phase 9: Documentation

#### T013: Update sdlc-config.example.json (Cleanup)

**File(s)**: `openclaw/scripts/sdlc-config.example.json`
**Type**: Modify
**Depends**: T007
**Status**: Complete
**Acceptance**:
- [x] New `cleanup` object with `processPatterns` array added to the example config
- [x] Example pattern is realistic (e.g., `--remote-debugging-port`)
- [x] Valid JSON syntax

#### T014: Update OpenClaw SKILL.md with Cleanup Config Documentation

**File(s)**: `openclaw/skills/running-sdlc/SKILL.md`
**Type**: Modify
**Depends**: T013
**Status**: Complete
**Acceptance**:
- [x] New section or table row documenting `cleanup.processPatterns` config field
- [x] Describes purpose, format, and example values
- [x] Notes that cleanup is optional and backward-compatible

---

### Phase 10: Testing

#### T015: Create BDD Feature File (Issue #24)

**File(s)**: `.claude/specs/24-configurable-post-step-process-cleanup/feature.gherkin`
**Type**: Create
**Depends**: T010, T011, T012
**Status**: Complete
**Acceptance**:
- [x] All 6 acceptance criteria from requirements.md are scenarios
- [x] Uses Given/When/Then format
- [x] Includes both happy path and no-op (backward-compatible) scenarios
- [x] Feature file is valid Gherkin syntax

---

## Issue #33 — Failure Loop Detection and Halt

### Phase 11: Setup

#### T016: Add In-Memory Failure Loop Tracking Variables

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] `consecutiveEscalations` variable declared as `let` with initial value `0`
- [x] `escalatedIssues` variable declared as `const new Set()`
- [x] `bounceCount` variable declared as `let` with initial value `0`
- [x] Variables placed after config loading (after line ~79), before step definitions
- [x] Variables are module-level (accessible to all functions)

**Notes**: These are intentionally NOT persisted to `sdlc-state.json`. In-memory only — a fresh runner process starts with clean counters.

---

### Phase 12: Backend Implementation

#### T017: Implement haltFailureLoop() Function

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify (add function)
**Depends**: T016
**Status**: Complete
**Acceptance**:
- [x] Function signature: `async function haltFailureLoop(loopType, details)`
- [x] `details` is an array of strings
- [x] Builds diagnostic message containing: loop type, details, consecutive escalation count, escalated issue list
- [x] Calls `log()` with the diagnostic
- [x] Calls `postDiscord()` with the diagnostic
- [x] Calls `process.exit(1)` after Discord post
- [x] Does NOT call `removeAutoMode()`, `updateState()`, or `git checkout main`
- [x] Placed after the `escalate()` function

#### T018: Modify escalate() to Track Failure Loop Metrics and Check Threshold

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T016, T017
**Status**: Complete
**Acceptance**:
- [x] At the start of `escalate()`, before `cleanupProcesses()`: adds `state.currentIssue` to `escalatedIssues`, increments `consecutiveEscalations`
- [x] After incrementing, checks `if (consecutiveEscalations >= 2)`
- [x] If threshold met: calls `haltFailureLoop('consecutive escalations', [...])` with affected issues, last step, reason, and truncated output
- [x] If threshold NOT met: proceeds with existing `escalate()` logic unchanged

#### T019: Add Bounce Loop Detection to handleFailure() Retry-Previous Path

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T016, T017
**Status**: Complete
**Acceptance**:
- [x] In `handleFailure()`, before the existing `return 'retry-previous'`: increments `bounceCount`, checks `if (bounceCount > MAX_RETRIES)`
- [x] If threshold exceeded: calls `escalate()` with bounce loop reason, returns `'escalated'`
- [x] If under threshold: proceeds with existing `return 'retry-previous'` behavior
- [x] Log and Discord messages include bounce count and threshold for diagnostics

#### T020: Add Bounce Loop Detection to runStep() Precondition Retry-Previous Path

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T016, T017
**Status**: Complete
**Acceptance**:
- [x] In `runStep()`, in the precondition failure block, before returning `'retry-previous'`: increments `bounceCount`, checks `if (bounceCount > MAX_RETRIES)`
- [x] If threshold exceeded: calls `escalate()` with bounce loop reason, returns `'escalated'`
- [x] If under threshold: proceeds with existing retry-previous logic

#### T021: Add hasNonEscalatedIssues() Helper and Modify Step 2 Prompt

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify (add function + modify `buildClaudeArgs`)
**Depends**: T016
**Status**: Complete
**Acceptance**:
- [x] `hasNonEscalatedIssues()` function: queries `gh issue list --state open --json number`, returns `true` if any issue is NOT in `escalatedIssues`; returns `true` on error (conservative fallback)
- [x] In `buildClaudeArgs()` step 2 prompt: if `escalatedIssues.size > 0`, appends exclusion clause listing issue numbers to skip
- [x] Placed after existing `hasOpenIssues()` function

---

### Phase 13: Integration

#### T022: Modify Main Loop for Cycle-Level Failure Loop Management

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T017, T018, T019, T020, T021
**Status**: Complete
**Acceptance**:
- [x] At the start of each cycle (before the for-loop): `bounceCount = 0`
- [x] Before entering the cycle: call `hasNonEscalatedIssues()` — if false, call `haltFailureLoop('all issues escalated', [...])`
- [x] After step 2 succeeds and state is extracted: check if `state.currentIssue` is in `escalatedIssues` — if so, call `haltFailureLoop('all issues escalated', [...])`
- [x] After step 9 succeeds (successful cycle completion): `consecutiveEscalations = 0`
- [x] Existing main loop flow preserved for non-loop cases

---

### Phase 14: Testing

#### T023: Create Gherkin Feature File for Failure Loop Detection

**File(s)**: `.claude/specs/33-failure-loop-detection/feature.gherkin`
**Type**: Create
**Depends**: T022
**Status**: Complete
**Acceptance**:
- [x] All 5 acceptance criteria from `requirements.md` have corresponding scenarios
- [x] Scenarios use Given/When/Then format
- [x] Feature file is valid Gherkin syntax
- [x] Includes scenarios for: consecutive escalation, same-issue skip, all-issues-escalated halt, bounce loop, Discord diagnostics, state preservation

---

## Issue #34 — Persistent Logging for Headless Sessions

### Phase 15: Backend Implementation

#### T024: Add Log Directory Resolution and Orchestration Log Migration

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] `resolveLogDir(config, projectPath)` function implemented using `os.tmpdir()` and `path.basename()`
- [x] Custom `logDir` config field overrides the default
- [x] Log directory created at startup with `mkdirSync({ recursive: true })`
- [x] `LOG_DIR` and `ORCHESTRATION_LOG` constants derived from resolved log directory
- [x] `log()` function modified to dual-write to console AND `<logDir>/sdlc-runner.log`
- [x] Appends to orchestration log (does not truncate on restart)
- [x] Orchestration log write failure is non-fatal (try/catch)

#### T025: Implement writeStepLog() and extractSessionId()

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T024
**Status**: Complete
**Acceptance**:
- [x] `extractSessionId(jsonOutput)` parses `session_id` from Claude JSON output, truncated to 12 chars; falls back to UUID slice on parse failure
- [x] `writeStepLog(stepKey, result)` writes log file with header metadata (step, exit code, duration, session, timestamp) followed by `---STDOUT---` and `---STDERR---` sections
- [x] Filename format: `<stepKey>-<sessionId>-<timestamp>.log` with `:` replaced by `-` in timestamp for Windows compatibility
- [x] Entire `writeStepLog()` is wrapped in try/catch — log write failures never crash the runner
- [x] Log write failure emits a warning via `log()`

#### T026: Implement enforceMaxDisk()

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T024
**Status**: Complete
**Acceptance**:
- [x] `enforceMaxDisk(logDir, maxBytes)` reads all `.log` files in the log directory, excluding `sdlc-runner.log`
- [x] Files sorted by mtime, oldest first
- [x] Deletes oldest files until total size is under `maxBytes`
- [x] Logs each pruned file via `log()`
- [x] Entirely non-fatal — errors are warned but do not block log writing
- [x] `maxLogDiskUsageMB` config field used; defaults to 500 MB

---

### Phase 16: Integration

#### T027: Wire writeStepLog() into runStep()

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T025, T026
**Status**: Complete
**Acceptance**:
- [x] `writeStepLog(step.key, result)` called in `runStep()` immediately after `runClaude()` returns, before `cleanupProcesses()`
- [x] Called regardless of exit code (both success and failure paths)
- [x] Does not affect step result handling or control flow

---

### Phase 17: Documentation

#### T028: Update sdlc-config.example.json with Logging Fields

**File(s)**: `openclaw/scripts/sdlc-config.example.json`
**Type**: Modify
**Depends**: T024
**Status**: Complete
**Acceptance**:
- [x] `logDir` field present in example config (empty string or commented)
- [x] `maxLogDiskUsageMB` field present with value `500`
- [x] Valid JSON syntax

#### T029: Update running-sdlc SKILL.md with Logging Documentation

**File(s)**: `openclaw/skills/running-sdlc/SKILL.md`
**Type**: Modify
**Depends**: T028
**Status**: Complete
**Acceptance**:
- [x] `nohup` launch command updated — removes `> /tmp/sdlc-runner.log 2>&1` redirect (log() handles its own file output)
- [x] New "Logging" section documents: default log directory location, log file naming convention, `logDir` and `maxLogDiskUsageMB` config fields, how to find/tail logs

---

## Dependency Graph

```
T001 ──▶ T002 ──┬──▶ T003 ──▶ T005
                │
                ├──▶ T004
                │
                ├──▶ T006 (feature.gherkin #12)
                │
                ├──▶ T007 ──┬──▶ T009 ──┬──▶ T010
                │           │           ├──▶ T011
                ├──▶ T008 ──┘           └──▶ T012 ──▶ T015 (feature.gherkin #24)
                │
                ├──▶ T013 ──▶ T014
                │
                ├──▶ T016 ──┬──▶ T017 ──┬──▶ T018
                │           │           ├──▶ T019
                │           │           └──▶ T020
                │           └──▶ T021
                │
                ├──▶ T022 (depends on T017–T021) ──▶ T023 (feature.gherkin #33)
                │
                ├──▶ T024 ──▶ T025 ──┬──▶ T027
                │            T026 ──┘
                │
                └──▶ T028 ──▶ T029
```

---

## Change History

| Issue | Date | Description |
|-------|------|-------------|
| #12 | 2026-02-15 | Tasks T001–T006: initial OpenClaw runner, skill, config template, BDD feature file |
| #24 | 2026-02-15 | Tasks T007–T015: process cleanup implementation, integration points, documentation, BDD |
| #33 | 2026-02-16 | Tasks T016–T023: failure loop detection, `haltFailureLoop()`, bounce tracking, main loop integration, BDD |
| #34 | 2026-02-16 | Tasks T024–T029: persistent logging, disk enforcement, SKILL.md updates, config example |

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Acceptance criteria are verifiable
- [x] All tasks marked complete (historical completed specs)
