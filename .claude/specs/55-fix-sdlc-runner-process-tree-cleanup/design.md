# Root Cause Analysis: SDLC runner process cleanup fails to kill entire process trees

**Issue**: #55
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude (spec agent)

---

## Root Cause

The `cleanupProcesses()` function in `openclaw/scripts/sdlc-runner.mjs` (lines 529–561) has three independent bugs that compound into incomplete cleanup:

**Bug 1: Filtered PID list is discarded.** The function calls `pgrep -f` to find matching PIDs, filters out the runner's own PID, logs the count — then calls `pkill -f` separately to do the actual killing. The `pkill -f` call re-matches processes independently and does not use the filtered PID list. This means the filter is cosmetic: the runner's own PID could be matched, and the logged count may not reflect what was actually killed.

**Bug 2: Only pattern-matched parents are killed.** Processes like Chrome spawn child processes (GPU, renderer, utility) that do not inherit the parent's command-line flags. When `pkill -f --remote-debugging-port` runs, only the parent Chrome process is killed. Children are reparented to PID 1 and orphaned. The function never walks the process tree to find and kill descendants.

**Bug 3: Pattern matches unrelated user processes.** The `--remote-debugging-port` pattern matches any process with that flag, including a user's normal Chrome browser. There is no scoping to runner-spawned processes. The runner already tracks the `claude -p` subprocess PID via `currentProcess` (line 1178), but `cleanupProcesses()` does not use this information.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `openclaw/scripts/sdlc-runner.mjs` | 529–561 | `cleanupProcesses()` — the broken function |
| `openclaw/scripts/sdlc-runner.mjs` | 759–763 | `runClaude()` — sets `currentProcess = proc` |
| `openclaw/scripts/sdlc-runner.mjs` | 784–785 | `runClaude()` close handler — sets `currentProcess = null` |
| `openclaw/scripts/sdlc-runner.mjs` | 1178 | `currentProcess` declaration |
| `openclaw/scripts/sdlc-runner.mjs` | 1187–1191 | `handleSignal()` — kills `currentProcess`, then calls `cleanupProcesses()` |
| `openclaw/scripts/sdlc-runner.mjs` | 954 | `escalate()` — calls `cleanupProcesses()` |
| `openclaw/scripts/sdlc-runner.mjs` | 1259 | Main loop — calls `cleanupProcesses()` after each step |

### Triggering Conditions

- `cleanup.processPatterns` is configured with at least one pattern (e.g., `["--remote-debugging-port"]`)
- A `claude -p` subprocess spawns child processes that don't inherit the parent's command-line flags (e.g., Chrome GPU/renderer)
- After `claude -p` exits (or is killed), those children are reparented to PID 1
- `cleanupProcesses()` is called but only kills pattern-matched parents, leaving orphans

---

## Fix Strategy

### Approach

Replace the single `pkill -f` call with a two-phase cleanup strategy, abstracted behind platform-aware helpers that use `process.platform` to select the correct system commands for each OS.

1. **Primary cleanup (PID-based tree kill):** Track the PID of each `claude -p` subprocess. When cleanup runs, use the tracked PID to discover the entire process tree and kill all descendants. This scopes cleanup to runner-spawned processes only.

2. **Fallback cleanup (pattern-based, for orphans):** After tree-based cleanup, run a pattern match as a fallback for orphaned processes that have been reparented (PPID=1 on POSIX) and can no longer be traced through the tree. Use the filtered PID list directly with `process.kill()` instead of `pkill -f` to honor the self-PID exclusion.

### Platform Abstraction

All process discovery is behind two platform-aware primitives:

| Primitive | POSIX (macOS/Linux) | Windows |
|-----------|-------------------|---------|
| **Get child PIDs of a parent** | `pgrep -P <pid>` | `wmic process where (ParentProcessId=<pid>) get ProcessId` |
| **Find PIDs by command-line pattern** | `pgrep -f <pattern>` | `wmic process where "CommandLine like '%pattern%'" get ProcessId` |
| **Kill a process tree** | Recursive `getChildPids` + bottom-up `process.kill(pid, 'SIGTERM')` | `taskkill /T /F /PID <pid>` (native tree kill) |
| **Kill a single PID** | `process.kill(pid, 'SIGTERM')` | `process.kill(pid, 'SIGTERM')` (calls `TerminateProcess`) |

The `IS_WINDOWS` constant (`process.platform === 'win32'`) gates each branch. On Windows, `taskkill /T` handles tree killing natively in a single call, so `killProcessTree` is simpler.

`process.kill(pid, 'SIGTERM')` is cross-platform in Node.js — on POSIX it sends SIGTERM, on Windows it calls `TerminateProcess`. This is used for both single-PID kills and the POSIX bottom-up tree kill.

### Implementation Details

The implementation requires:
- A `IS_WINDOWS` constant: `process.platform === 'win32'`
- A new helper `getChildPids(pid)` that returns direct child PIDs using the platform-appropriate command
- A new helper `getProcessTree(pid)` that recursively calls `getChildPids` to collect all descendant PIDs (depth-first, children before parent)
- A new helper `killProcessTree(pid)` that on POSIX kills bottom-up via the tree, and on Windows uses `taskkill /T /F /PID <pid>`
- A new helper `findProcessesByPattern(pattern)` that uses the platform-appropriate command to find PIDs matching a command-line pattern
- Tracking of the last `claude -p` PID via `lastClaudePid`
- Adding `[CLEANUP]` log entries for all code paths

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `openclaw/scripts/sdlc-runner.mjs` | Add `IS_WINDOWS` constant and platform-aware `getChildPids(pid)` helper | Abstracts POSIX `pgrep -P` vs Windows `wmic` for child PID discovery |
| `openclaw/scripts/sdlc-runner.mjs` | Add `getProcessTree(pid)` helper: recursively calls `getChildPids` to collect all descendant PIDs | Platform-agnostic tree walker built on the `getChildPids` primitive |
| `openclaw/scripts/sdlc-runner.mjs` | Add `killProcessTree(pid)` helper: POSIX — bottom-up `process.kill`; Windows — `taskkill /T /F /PID` | Uses native OS tree-kill on Windows, manual bottom-up on POSIX |
| `openclaw/scripts/sdlc-runner.mjs` | Add `findProcessesByPattern(pattern)` helper: POSIX — `pgrep -f`; Windows — `wmic` CommandLine query | Replaces the old bare `pgrep -f` / `pkill -f` calls with a platform-aware abstraction |
| `openclaw/scripts/sdlc-runner.mjs` | Add `lastClaudePid` variable alongside `currentProcess`: set to `proc.pid` in `runClaude()`, not cleared on close | Preserves the PID for tree cleanup after subprocess exits |
| `openclaw/scripts/sdlc-runner.mjs` | Rewrite `cleanupProcesses()`: (1) if `lastClaudePid` is set, call `killProcessTree(lastClaudePid)`; (2) then run pattern-based fallback using `findProcessesByPattern` + direct `process.kill` on filtered PID list | Two-phase: targeted tree kill, then pattern fallback for orphans |
| `openclaw/scripts/sdlc-runner.mjs` | Add `[CLEANUP]` log lines for: tree kill start/results, fallback start/results, no-processes-found | Ensures debugging visibility (AC5) |
| `openclaw/scripts/sdlc-config.example.json` | Add comment-style documentation (via README or inline field) explaining that `processPatterns` is now a fallback for orphaned processes | Documents the behavioral change (FR6) |

### Blast Radius

- **Direct impact**: `cleanupProcesses()` function body is fully rewritten. Five new helper functions added (`IS_WINDOWS`, `getChildPids`, `getProcessTree`, `killProcessTree`, `findProcessesByPattern`). One new module-level variable (`lastClaudePid`) added. Minor addition to `runClaude()` to set `lastClaudePid`.
- **Indirect impact**: Three callsites invoke `cleanupProcesses()` — the main step loop (line 1259), `escalate()` (line 954), and `handleSignal()` (line 1191). All three call the function with no arguments, so the signature change is transparent. `handleSignal()` also kills `currentProcess` before calling cleanup — this behavior is preserved.
- **Risk level**: Medium — the function is called in the signal handler (`handleSignal`), which runs during shutdown. The rewrite must remain synchronous (using `execSync`) and handle errors gracefully to avoid crashing during signal handling. The Windows `wmic`/`taskkill` commands must be tested on Windows to verify correct output parsing.

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `wmic` output format differs across Windows versions or locales | Medium — `wmic` is deprecated in favor of PowerShell | Parse `wmic` output defensively (extract integers, ignore non-numeric lines). If `wmic` fails, fall through gracefully — the function continues without tree kill, logging a warning. |
| `kill` / `taskkill` on already-exited PID causes spurious errors | Medium — race between process exit and cleanup | Wrap each `process.kill()` and `execSync('taskkill ...')` call in try/catch; ESRCH / "not found" errors are expected and non-fatal |
| Bottom-up kill order causes SIGCHLD cascades (POSIX) | Low — Node.js doesn't propagate SIGCHLD to the runner | Kill with `SIGTERM`; graceful degradation if process is already gone |
| `lastClaudePid` retains stale PID from a previous step | Medium — PID could be reused by the OS | Clear `lastClaudePid` at the end of `cleanupProcesses()` after tree cleanup completes. The PID is only meaningful for the most recent subprocess. |
| Pattern fallback still matches user Chrome after tree kill already cleaned up | Low — fallback runs second | This is acceptable: the fallback only kills PIDs not already killed. If the user's Chrome happens to match the pattern AND wasn't part of the tree, it is still at risk — but this is the existing behavior, and AC4 acknowledges that orphaned-process fallback uses pattern matching "scoped as narrowly as possible". |
| Windows `taskkill /T` kills the tree in one shot, making bottom-up order untestable | Low — correctness is OS-provided | On Windows, delegate to `taskkill /T` and trust the OS. Bottom-up order is only relevant on POSIX where we do manual tree walking. |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| **A: Process groups (setpgid)** | Spawn `claude -p` in its own process group, then `kill -<pgid>` to kill the whole group | Requires changing `spawn()` options (`detached: true`), which changes subprocess behavior (e.g., stdin/stdout handling). More invasive than tree-walking. Also, Chrome may spawn processes outside the group. Process groups behave differently on Windows (`detached` creates a new console). |
| **B: Track all child PIDs via `/proc` or `ps`** | Periodically poll `ps` for children of the `claude -p` PID and maintain a set | Adds polling complexity, timer management, and state. Overkill for a cleanup-time operation. `/proc` doesn't exist on macOS or Windows. |
| **C: Use `pkill -P` (parent-based pkill)** | Kill all processes whose parent is the `claude -p` PID | Only kills direct children, not grandchildren. Doesn't handle reparented orphans (PPID=1). POSIX-only — no equivalent on Windows. |
| **D: Drop pattern-based cleanup entirely** | Rely solely on tree-based PID cleanup | Would miss orphaned processes (PPID=1) that were reparented before cleanup runs. The pattern fallback is still valuable for these cases. |
| **E: Use npm `tree-kill` package** | Cross-platform tree-kill as an npm dependency | Violates the zero-dependency constraint for OpenClaw scripts (per `tech.md`). The platform abstraction with `wmic`/`pgrep` achieves the same result with no external dependencies. |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`) — synchronous `execSync`, zero dependencies, `node:child_process` only
- [x] Cross-platform: platform-specific commands gated behind `process.platform` check (per `tech.md` cross-platform constraint)
