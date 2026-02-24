# Tasks: SDLC runner process cleanup fails to kill entire process trees

**Issue**: #55
**Date**: 2026-02-16
**Status**: Planning
**Author**: Claude (spec agent)

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Implement platform-aware process tree helpers and rewrite `cleanupProcesses()` | [ ] |
| T002 | Add `lastClaudePid` tracking in `runClaude()` | [ ] |
| T003 | Add regression test (Gherkin feature file) | [ ] |
| T004 | Verify no regressions | [ ] |

---

### T001: Implement platform-aware process tree helpers and rewrite `cleanupProcesses()`

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] New `IS_WINDOWS` constant: `process.platform === 'win32'`
- [ ] New `getChildPids(pid)` function: returns direct child PIDs of the given PID
  - POSIX: `pgrep -P <pid>`
  - Windows: `wmic process where (ParentProcessId=<pid>) get ProcessId` — parse output to extract integer PIDs, ignoring header/blank lines
- [ ] New `getProcessTree(pid)` function: recursively calls `getChildPids(pid)` to collect all descendant PIDs; returns flat array (depth-first, children before parent)
- [ ] New `killProcessTree(pid)` function:
  - POSIX: calls `getProcessTree(pid)`, kills each PID bottom-up with `process.kill(pid, 'SIGTERM')`, logs each kill
  - Windows: calls `execSync('taskkill /T /F /PID <pid>')` — native tree kill in one command
  - Both: handles "no such process" errors gracefully (ESRCH on POSIX, exit code on Windows)
- [ ] New `findProcessesByPattern(pattern)` function: returns PIDs matching a command-line pattern
  - POSIX: `pgrep -f -- <pattern>` (using existing `shellEscape`; `--` prevents patterns starting with dashes being interpreted as flags on macOS)
  - Windows: `wmic process where "CommandLine like '%<pattern>%'" get ProcessId` — parse output to extract integer PIDs
- [ ] Rewritten `cleanupProcesses()` implements two-phase strategy:
  - Phase 1 (tree-based): if `lastClaudePid` is set, call `killProcessTree(lastClaudePid)`, then clear `lastClaudePid`
  - Phase 2 (pattern fallback): for each pattern in `CLEANUP_PATTERNS`, call `findProcessesByPattern(pattern)`, filter out `process.pid`, kill each filtered PID directly with `process.kill(pid, 'SIGTERM')` (not `pkill -f`)
- [ ] All code paths emit `[CLEANUP]` log entries: tree kill results, fallback results, "no matching processes found"
- [ ] All `process.kill()` and `execSync` calls wrapped in try/catch — ESRCH / "not found" is non-fatal, other errors logged as warnings
- [ ] Function remains synchronous (uses `execSync`) — safe for signal handler context
- [ ] No external dependencies — uses only `node:child_process` `execSync` and `process.kill()`
- [ ] `wmic` output parsing is defensive: extract only integer PIDs from output, skip headers and blank lines

**Notes**:
- `getChildPids` wraps `pgrep`/`wmic` in try/catch: exit code 1 (POSIX) or empty output (Windows) means no children — return `[]`
- On POSIX, bottom-up kill order: collect tree as [grandchildren, children, root], then kill in that order
- On Windows, `taskkill /T /F /PID <pid>` handles tree kill natively — no need for manual bottom-up
- `process.kill(pid, 'SIGTERM')` is cross-platform: sends SIGTERM on POSIX, calls TerminateProcess on Windows
- `wmic` is deprecated but still available on all supported Windows versions; if it fails, log warning and fall through

---

### T002: Add `lastClaudePid` tracking in `runClaude()`

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] New module-level variable `let lastClaudePid = null;` declared near `currentProcess` (line ~1178)
- [ ] In `runClaude()`, after `const proc = spawn(...)`, set `lastClaudePid = proc.pid`
- [ ] `lastClaudePid` is NOT cleared on process close/error (it persists for cleanup after subprocess exit)
- [ ] `lastClaudePid` IS cleared inside `cleanupProcesses()` after tree-based cleanup completes (to prevent stale PID reuse)
- [ ] `lastClaudePid` exported via the existing test-exports object (line ~1551) for testability

**Notes**:
- The key difference from `currentProcess`: `currentProcess` is cleared on close, but `lastClaudePid` persists so `cleanupProcesses()` can walk the tree even after the subprocess exits
- `cleanupProcesses()` clears it after use to prevent accumulating stale PIDs across steps

---

### T003: Add regression test (Gherkin feature file)

**File(s)**: `.claude/specs/55-fix-sdlc-runner-process-tree-cleanup/feature.gherkin`
**Type**: Create
**Depends**: T001, T002
**Acceptance**:
- [ ] Gherkin feature file with `@regression` tag
- [ ] Scenarios cover all 5 acceptance criteria from requirements.md:
  - AC1: Process tree cleanup kills descendants
  - AC2: Filtered PID list used for actual kills
  - AC3: Only runner-spawned processes targeted
  - AC4: Orphaned processes handled via pattern fallback
  - AC5: Cleanup logs always emitted
- [ ] Scenarios are platform-agnostic (describe behavior, not POSIX-specific commands)
- [ ] Scenarios use concrete data from reproduction steps
- [ ] Valid Gherkin syntax

---

### T004: Verify no regressions

**File(s)**: Existing test files, runner callsites
**Type**: Verify (no file changes)
**Depends**: T001, T002, T003
**Acceptance**:
- [ ] All three `cleanupProcesses()` callsites behave correctly:
  - Main step loop (line ~1259): cleanup after each step
  - `escalate()` (line ~954): cleanup during escalation
  - `handleSignal()` (line ~1191): cleanup during signal shutdown
- [ ] `handleSignal()` still kills `currentProcess` before calling `cleanupProcesses()` (existing behavior preserved)
- [ ] DRY_RUN mode: `cleanupProcesses()` still runs (it's independent of dry-run)
- [ ] No processes matched: function logs "no matching processes" and returns without error
- [ ] `CLEANUP_PATTERNS` empty and `lastClaudePid` null: function returns immediately with log entry
- [ ] Config hot-reload (line ~1539) still updates `CLEANUP_PATTERNS`
- [ ] Test exports object (line ~1551) still exposes `cleanupProcesses` and `currentProcess`, plus new `lastClaudePid`
- [ ] Platform helpers degrade gracefully: if `pgrep`/`wmic` is unavailable, cleanup logs a warning and continues without crashing

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T003)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Cross-platform: platform-specific commands are behind `process.platform` checks
