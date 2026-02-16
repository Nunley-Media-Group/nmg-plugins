# Defect Report: SDLC Runner Edge Case Audit Findings (6 Bugs)

**Issue**: #51
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude
**Severity**: Mixed (Critical x1, High x1, Medium x3, Low x1)
**Related Spec**: N/A (runtime script, not a skill)

---

## Reproduction

### Steps to Reproduce

Each finding has distinct reproduction steps documented in the individual sections below. Common preconditions:

1. Run the SDLC runner: `node sdlc-runner.mjs --config <path>`
2. Trigger the specific code path described in each finding

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | Any (Node.js v24+) |
| **Version / Commit** | Current HEAD of `sdlc-runner.mjs` |
| **Runtime** | Node.js ESM |
| **Configuration** | Standard `sdlc-config.json` |

### Frequency

- F1 (currentProcess): Always — SIGTERM handler never kills subprocess
- F2 (Atomics.wait): Always — every Discord retry blocks the event loop
- F3 (shell escaping): Conditional — only with adversarial commit messages (defense-in-depth)
- F4 (merged PR checkout): Conditional — only when working tree is dirty at merged-PR detection
- F5 (silent retry reset): Conditional — only when `--resume` is passed but state file is missing
- F6 (unused AbortController): Always — dead code present on every `runClaude()` invocation

---

## Expected vs Actual

### F1 — Critical: `currentProcess` never assigned; SIGTERM can't kill subprocess

| | Description |
|---|-------------|
| **Expected** | SIGTERM handler kills the active Claude subprocess, preventing orphaned processes |
| **Actual** | `currentProcess` is declared at line 1161 but never assigned in `runClaude()` (line 747); SIGTERM handler at line 1170 always sees `null`, so orphaned `claude` processes continue consuming API quota |

### F2 — High: `Atomics.wait()` blocks event loop in Discord retry

| | Description |
|---|-------------|
| **Expected** | Discord retry backoff pauses without blocking the event loop, allowing signal handlers to fire |
| **Actual** | `Atomics.wait()` at line 384 is a synchronous blocking sleep (2–4s per retry) that freezes the entire event loop; signal handlers cannot fire during this window |

### F3 — Medium: Incomplete shell escaping in `autoCommitIfDirty`

| | Description |
|---|-------------|
| **Expected** | Commit messages are safely passed to `git commit` without shell interpretation |
| **Actual** | Line 502 only escapes `"` characters but not backticks or `$()` subshell syntax; `shellEscape()` exists at line 512 but is not used here |

### F4 — Medium: Uncaught exception on merged PR `git checkout main`

| | Description |
|---|-------------|
| **Expected** | When a merged PR is detected with a dirty working tree, the runner handles the situation gracefully |
| **Actual** | `git checkout main` at line 236 throws if the working tree is dirty; the error propagates uncaught because lines 236–239 are inside the `if (prState === 'MERGED')` block but outside the try-catch at line 232 |

### F5 — Medium: Silent retry reset with `--resume` and missing state file

| | Description |
|---|-------------|
| **Expected** | When `--resume` is passed but the state file has been deleted, the operator is warned that retry history was lost |
| **Actual** | The `else` branch at line 1368 silently resets retry counters to `{}`; no warning is logged |

### F6 — Low: Unused `AbortController` dead code in `runClaude`

| | Description |
|---|-------------|
| **Expected** | No dead code — timeout handling uses a single consistent mechanism |
| **Actual** | An `AbortController` is created at line 745 and its signal passed to `spawn()`, but `ac.abort()` is never called; stall/step timeout uses manual `proc.kill()` instead |

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: SIGTERM handler kills active subprocess (F1)

**Given** the SDLC runner is executing a Claude subprocess via `runClaude()`
**When** the runner receives a SIGTERM signal
**Then** the active subprocess is killed via SIGTERM
**And** `currentProcess` is set to the spawned process during execution and cleared on close

### AC2: Discord retry uses non-blocking sleep (F2)

**Given** a Discord post fails and enters the retry loop
**When** the retry backoff delay elapses
**Then** the delay uses `await sleep(backoff)` (async, non-blocking)
**And** the event loop remains responsive during the retry delay

### AC3: Commit messages are safely escaped (F3)

**Given** `autoCommitIfDirty` is called with a commit message
**When** the message is passed to `git commit -m`
**Then** the message is passed using `shellEscape()` or via `execFileSync` argument array to avoid shell interpretation
**And** backticks, `$()`, and other shell metacharacters are neutralized

### AC4: Dirty working tree during merged-PR checkout doesn't crash (F4)

**Given** `detectAndHydrateState()` detects a merged PR
**And** the working tree has uncommitted changes
**When** the function attempts `git checkout main`
**Then** the error is caught and handled gracefully
**And** the runner either stashes changes or logs a warning and continues

### AC5: Warning logged when `--resume` used with missing state file (F5)

**Given** the runner is started with `--resume`
**And** the state file (`sdlc-state.json`) does not exist
**When** the runner initializes its retry counters
**Then** a warning is logged indicating the state file was not found
**And** retry counters still reset to `{}` (current behavior preserved)

### AC6: AbortController dead code removed (F6)

**Given** `runClaude()` spawns a Claude subprocess
**When** the subprocess is created
**Then** no `AbortController` is instantiated
**And** timeout handling uses only the existing `setTimeout`/`proc.kill()` mechanism

### AC7: No regression in existing runner behavior

**Given** the SDLC runner is configured and running normally
**When** a full SDLC cycle completes without errors
**Then** all existing behavior (step execution, retries, escalation, state management) is preserved
**And** no new bugs are introduced by the fixes

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Assign `currentProcess = proc` in `runClaude()` after spawning; clear on process close | Must |
| FR2 | Replace `Atomics.wait()` in `postDiscord` retry with `await sleep(backoff)` | Must |
| FR3 | Use `shellEscape()` or `execFileSync` argument array for commit messages in `autoCommitIfDirty` | Must |
| FR4 | Wrap `git checkout main` / `git pull` in `detectAndHydrateState` merged-PR path with try-catch | Must |
| FR5 | Log a warning when `--resume` is passed but state file is missing | Must |
| FR6 | Remove unused `AbortController` from `runClaude()` | Should |

---

## Out of Scope

- Refactoring `postDiscord` beyond the `Atomics.wait` fix (e.g., restructuring retry logic)
- Adding new Discord notification messages
- Changing the step timeout mechanism beyond removing the unused `AbortController`
- Adding new CLI arguments or configuration options
- Rewriting `autoCommitIfDirty` beyond the escaping fix
- Unit test framework changes (tests use existing Jest ESM setup)

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC7)
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
