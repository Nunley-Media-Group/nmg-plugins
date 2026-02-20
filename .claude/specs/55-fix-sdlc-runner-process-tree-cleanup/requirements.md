# Defect Report: SDLC runner process cleanup fails to kill entire process trees

**Issue**: #55
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude (spec agent)
**Severity**: High
**Related Spec**: `.claude/specs/24-configurable-post-step-process-cleanup/`

---

## Reproduction

### Steps to Reproduce

1. Configure an SDLC runner with `cleanup.processPatterns: ["--remote-debugging-port"]`
2. Run the SDLC runner against a project where `claude -p` steps spawn headless Chrome (e.g., for browser testing or web scraping)
3. After the run completes, check for orphaned processes: `pgrep -af "chrome|chromium"`
4. Observe orphaned child processes (PPID=1) that survived cleanup

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | macOS (Darwin 25.3.0) |
| **Version / Commit** | Current main branch |
| **Component** | `openclaw/scripts/sdlc-runner.mjs`, lines 529–561 (`cleanupProcesses()`) |
| **Configuration** | `cleanup.processPatterns: ["--remote-debugging-port"]` |

### Frequency

Always — every cleanup invocation has the three bugs described below.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | All processes spawned by `claude -p` subprocesses (and their entire process trees) are terminated when cleanup runs. Cleanup logs are always emitted. Only runner-spawned processes are affected. |
| **Actual** | (1) The filtered PID list is discarded — `pkill -f` re-matches independently and doesn't apply the filtering. (2) Only parent processes matching the pattern are killed; child processes (e.g., Chrome GPU, renderer) survive because they don't inherit the command-line flag. (3) The broad pattern `--remote-debugging-port` matches any process with that flag, including the user's normal Chrome browser. (4) No `[CLEANUP]` log entries appear in some cases, suggesting silent failures. |

### Error Output

```
No error output — the function fails silently. Orphaned processes are only
visible via post-hoc inspection:

$ pgrep -af chrome
12345 /Applications/Google Chrome.app/.../chrome --type=gpu-process ...
12346 /Applications/Google Chrome.app/.../chrome --type=renderer ...
12347 /Applications/Google Chrome.app/.../chrome --type=utility ...

All have PPID=1 (reparented to init after parent was killed).
```

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Process tree cleanup uses targeted PID-based killing

**Given** `cleanupProcesses()` has identified PIDs matching a cleanup pattern
**When** it terminates those processes
**Then** it kills the entire process tree (all descendants) for each matched PID, not just the pattern-matched process itself

### AC2: Filtered PID list is used for actual kill operations

**Given** `cleanupProcesses()` filters out the runner's own PID from matched processes
**When** it performs the kill
**Then** it uses the filtered PID list directly (e.g., `kill` by PID) instead of a separate `pkill -f` that re-matches without filtering

### AC3: Cleanup scopes to runner-spawned processes only

**Given** the user has a normal Chrome browser running with `--remote-debugging-port`
**And** the SDLC runner has spawned headless Chrome instances via `claude -p`
**When** `cleanupProcesses()` runs
**Then** it only kills processes that are descendants of `claude -p` subprocesses spawned by the runner, not unrelated user processes matching the same pattern

### AC4: Cleanup handles orphaned processes (PPID=1)

**Given** a `claude -p` subprocess has exited and its Chrome children have been reparented to PID 1
**When** `cleanupProcesses()` runs
**Then** it still identifies and terminates those orphaned processes using the configured patterns as a fallback, scoped as narrowly as possible

### AC5: Cleanup logs are always emitted

**Given** `cleanupProcesses()` is called
**When** it finds processes to clean up OR finds no processes
**Then** it logs the outcome (processes killed with PIDs, or "no matching processes found") so debugging is possible

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Replace `pkill -f` with PID-targeted killing using the filtered PID list directly (e.g., `kill` on each PID) | Must |
| FR2 | For each matched PID, discover and kill all descendant processes (walk the process tree via recursive `pgrep -P`) before killing the parent | Must |
| FR3 | Track `claude -p` subprocess PIDs via the existing `currentProcess` variable and use them to scope cleanup to runner-spawned process trees | Must |
| FR4 | Fall back to pattern-based `pgrep -f` for orphaned processes (PPID=1) that can no longer be traced to a runner subprocess | Should |
| FR5 | Emit `[CLEANUP]` log entries for every cleanup invocation: list PIDs killed, or log "no matching processes found" | Should |
| FR6 | Update `sdlc-config.example.json` if the cleanup config schema changes (e.g., documenting that `processPatterns` is now a fallback for orphans) | Should |

---

## Out of Scope

- Changing how `claude -p` subprocesses themselves manage Chrome lifecycle (that's Claude Code's responsibility)
- Adding a process supervisor or daemon for long-running cleanup
- Cross-platform process supervisor/daemon — platform-specific process discovery commands are acceptable behind a `process.platform` check
- Deprecating `cleanup.processPatterns` config — it remains as a fallback for orphaned processes
- Refactoring `cleanupProcesses()` beyond the minimal fix (e.g., no major restructuring of the runner)

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC3 — no false kills of user processes)
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
