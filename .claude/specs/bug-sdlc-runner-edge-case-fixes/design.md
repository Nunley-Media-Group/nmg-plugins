# Root Cause Analysis: SDLC Runner Edge Case Audit Findings (6 Bugs)

**Issue**: #51
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude

---

## Root Cause

Six independent bugs were identified through a code-level edge case analysis of `openclaw/scripts/sdlc-runner.mjs`. Each bug stems from a different root cause — they share no common underlying defect. The bugs range from a critical process lifecycle issue (orphaned subprocesses) to a low-priority dead code cleanup.

The findings fall into three categories:
1. **Process lifecycle** (F1, F6): The subprocess spawned by `runClaude()` is not tracked in the module-level `currentProcess` variable, and an unused `AbortController` adds confusion to the timeout path.
2. **Event loop blocking** (F2): A synchronous `Atomics.wait()` call in the Discord retry path freezes the event loop, preventing signal handlers from firing during the backoff window.
3. **Defensive coding gaps** (F3, F4, F5): Shell escaping is incomplete for commit messages, a `git checkout` in the merged-PR path lacks error handling, and a `--resume` with missing state file produces no warning.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `openclaw/scripts/sdlc-runner.mjs` | 1161, 747, 1170 | F1: `currentProcess` declared but never assigned from `runClaude()` |
| `openclaw/scripts/sdlc-runner.mjs` | 384 | F2: `Atomics.wait()` synchronous blocking sleep in Discord retry |
| `openclaw/scripts/sdlc-runner.mjs` | 502, 512 | F3: `autoCommitIfDirty` escapes `"` only; `shellEscape()` exists but unused |
| `openclaw/scripts/sdlc-runner.mjs` | 232–239 | F4: Merged-PR `git checkout main` outside try-catch |
| `openclaw/scripts/sdlc-runner.mjs` | 1364–1368 | F5: Silent retry counter reset when `--resume` + missing state file |
| `openclaw/scripts/sdlc-runner.mjs` | 745 | F6: Unused `AbortController` in `runClaude()` |

### Triggering Conditions

**F1**: Any SIGTERM/SIGINT signal while a Claude subprocess is running. The signal handler checks `currentProcess` which is always `null`.

**F2**: Any Discord post failure that triggers the retry loop (network error, timeout, openclaw CLI failure). The `Atomics.wait()` call blocks for 2–4 seconds per retry.

**F3**: A commit message containing backticks or `$()` passed to `autoCommitIfDirty`. Currently all callers pass safe strings, but this is a defense-in-depth gap.

**F4**: Dirty working tree (uncommitted changes) when `detectAndHydrateState()` finds a merged PR and attempts `git checkout main`.

**F5**: `--resume` flag passed when the state file has been manually deleted or never existed.

**F6**: Every invocation of `runClaude()` — the `AbortController` is always created and never used.

---

## Fix Strategy

### Approach

All six fixes are independent, minimal changes within `sdlc-runner.mjs`. No architectural changes, no new files, no new dependencies. Each fix targets the exact lines identified in the root cause analysis.

### Changes

| Finding | File | Change | Rationale |
|---------|------|--------|-----------|
| F1 | `sdlc-runner.mjs` | Assign `currentProcess = proc` after `spawn()` in `runClaude()`; clear to `null` in `proc.on('close')` and `proc.on('error')` | Enables SIGTERM handler to kill active subprocess |
| F2 | `sdlc-runner.mjs` | Replace `Atomics.wait(...)` on line 384 with `await sleep(backoff)` | Non-blocking sleep keeps event loop responsive; `sleep()` helper already exists at line 1153 |
| F3 | `sdlc-runner.mjs` | Replace the `git commit -m "${message.replace(...)}"` pattern with `git commit -m ${shellEscape(message)}` | Uses the existing `shellEscape()` function (line 512) for proper single-quote escaping |
| F4 | `sdlc-runner.mjs` | Wrap lines 236–239 (`git checkout main` / `git pull`) in a try-catch; log a warning on failure and return `null` to fall through to normal startup | Prevents crash on dirty working tree during merged-PR detection |
| F5 | `sdlc-runner.mjs` | Add a `log()` warning in the `else` branch at line 1368 when `RESUME` is true but the state file doesn't exist | Informs operator that retry history was lost; preserves existing reset behavior |
| F6 | `sdlc-runner.mjs` | Remove the `const ac = new AbortController()` line and the `signal: ac.signal` option from the `spawn()` call | Eliminates dead code; timeout already handled by `setTimeout` + `proc.kill()` |

### Blast Radius

- **Direct impact**: Only `openclaw/scripts/sdlc-runner.mjs` is modified
- **Indirect impact**:
  - F1: Signal handlers (`handleSignal`) will now actually kill subprocesses — this is the *intended* behavior, not a side effect
  - F2: `postDiscord` retry loop becomes fully async — callers already `await` it, so no interface change
  - F3: Commit message escaping changes from double-quote to single-quote wrapping — functionally equivalent for git
  - F4: Merged-PR path may now return `null` instead of crashing — the caller already handles `null` as "proceed normally"
  - F5: A new log line appears — purely additive
  - F6: `spawn()` no longer receives an `AbortSignal` — since it was never used, no behavior changes
- **Risk level**: Low — all fixes are contained within a single file and address exactly the identified defects

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| F1: Subprocess killed prematurely during normal operation | Low | `currentProcess` is only read in the signal handler, which only fires on SIGTERM/SIGINT |
| F2: Retry timing changes affect Discord delivery | Low | Same backoff durations, just non-blocking; delivery logic unchanged |
| F3: Single-quote in commit messages breaks escaping | Low | `shellEscape()` properly handles embedded single quotes via `'\''` |
| F4: Merged-PR detection silently skips checkout | Low | Warning is logged; runner falls through to normal detection which will still find the feature branch |
| F5: Log noise from new warning | Very Low | Only fires on the specific `--resume` + missing state file edge case |
| F6: Removing AbortController signal from spawn | Very Low | `ac.abort()` was never called; the signal had no effect |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| F3: Switch to `execFileSync` with argument array | Avoids shell entirely by passing args as an array | Would require refactoring the `git()` helper function, which is used throughout the file; `shellEscape()` is the minimal fix |
| F4: Auto-stash dirty changes before checkout | `git stash` before `git checkout main`, then `git stash pop` | Adds complexity; stash conflicts could cause different failures; a warning + fallback is simpler and safer |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
