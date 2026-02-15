# Root Cause Analysis: SDLC runner not deleting auto-mode on exit

**Issue**: #17
**Date**: 2026-02-15
**Status**: Draft
**Author**: Claude

---

## Root Cause

The SDLC runner creates `.claude/auto-mode` at startup (line ~1004) to signal skills that they should operate in headless mode. However, none of the five exit paths in the runner delete this file before exiting. The code is aware of the file — `RUNNER_ARTIFACTS` at line 359 lists `'.claude/auto-mode'` for git exclusion purposes — but no cleanup logic was ever implemented.

The auto-mode file path is constructed inline at the creation site (`path.join(PROJECT_PATH, '.claude', 'auto-mode')`) and is not stored in a reusable variable or associated with any teardown logic. Each exit path (signal handler, escalation, no-more-issues, fatal crash, single-step) was written independently without a shared cleanup routine, so the omission was replicated across all of them.

The consequence is that after any runner exit, the flag file persists. Every SDLC skill checks for this file's existence to decide whether to skip interactive prompts — so all subsequent manual usage silently loses interactivity until the user manually discovers and deletes the file.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `openclaw/scripts/sdlc-runner.mjs` | ~359 | `RUNNER_ARTIFACTS` constant — knows about auto-mode but only for git filtering |
| `openclaw/scripts/sdlc-runner.mjs` | ~999–1006 | Auto-mode creation at startup — no corresponding teardown |
| `openclaw/scripts/sdlc-runner.mjs` | ~874–900 | `handleSignal()` — graceful shutdown, no auto-mode cleanup |
| `openclaw/scripts/sdlc-runner.mjs` | ~713–749 | `escalate()` — escalation handler, no auto-mode cleanup |
| `openclaw/scripts/sdlc-runner.mjs` | ~1066–1071 | No-more-issues exit — breaks main loop, no auto-mode cleanup |
| `openclaw/scripts/sdlc-runner.mjs` | ~1125–1129 | Fatal crash handler — `main().catch()`, no auto-mode cleanup |
| `openclaw/scripts/sdlc-runner.mjs` | ~1050–1061 | Single-step mode — exits after one step, no auto-mode cleanup |

### Triggering Conditions

- The SDLC runner is started (auto-mode file is created)
- The runner exits via any path (all five lack cleanup)
- A user subsequently invokes any SDLC skill manually in the same project

---

## Fix Strategy

### Approach

Add a centralized `removeAutoMode()` helper function near the existing `RUNNER_ARTIFACTS` constant. This function wraps `fs.unlinkSync()` in a try-catch so it is best-effort and non-fatal — if the file doesn't exist or can't be deleted, the original exit reason is never masked.

Then call `removeAutoMode()` at each of the five exit paths, immediately before the exit action (`process.exit()`, `break`, or end-of-function). This is the minimal change: one new function (~6 lines) and five single-line call sites.

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `openclaw/scripts/sdlc-runner.mjs` | Add `removeAutoMode()` helper function near line ~360 (after `RUNNER_ARTIFACTS`) | Centralizes cleanup logic in one place (FR2); best-effort try-catch satisfies FR3 |
| `openclaw/scripts/sdlc-runner.mjs` | Call `removeAutoMode()` in `handleSignal()` before `process.exit(0)` | Fixes AC1: graceful shutdown cleanup |
| `openclaw/scripts/sdlc-runner.mjs` | Call `removeAutoMode()` in `escalate()` before state reset | Fixes AC2: escalation cleanup |
| `openclaw/scripts/sdlc-runner.mjs` | Call `removeAutoMode()` in the no-more-issues path before `break` | Fixes AC3: completion cleanup |
| `openclaw/scripts/sdlc-runner.mjs` | Call `removeAutoMode()` in `main().catch()` before `process.exit(1)` | Fixes AC4: fatal crash cleanup |
| `openclaw/scripts/sdlc-runner.mjs` | Call `removeAutoMode()` in single-step mode before `process.exit()` | Fixes AC5: single-step cleanup |

### Blast Radius

- **Direct impact**: Only `openclaw/scripts/sdlc-runner.mjs` is modified. The new function only calls `fs.unlinkSync()` on a single file path.
- **Indirect impact**: None. The auto-mode file is read (not written) by skills, and those skills already handle the file-not-found case (they just proceed interactively). Deleting the file earlier than before has no effect on any running process — `fs.existsSync()` checks in skills are point-in-time reads.
- **Risk level**: Low — the change is additive (new function + call sites), all wrapped in try-catch, and touches no existing logic.

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Auto-mode deleted too early (during active execution) | Low — cleanup only runs at exit points, not during step processing | AC6 regression scenario verifies auto-mode exists during execution |
| Cleanup masks original error on fatal crash | Low — try-catch swallows only the unlink error, not the crash | FR3 requires best-effort semantics; the catch block is isolated |
| Future exit paths miss cleanup | Low — centralized helper makes the pattern obvious | FR2 establishes the convention; `removeAutoMode()` is easy to grep for |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| `process.on('exit')` handler | Register a single handler that runs on any exit | `process.on('exit')` does not support async operations, and the handler runs after `process.exit()` in some Node.js versions — unreliable for file I/O in crash scenarios. Explicit call sites are more predictable. |
| Delete auto-mode from the `running-sdlc` SKILL.md `stop` command | Let the OpenClaw skill handle cleanup | Issue's out-of-scope specifies the runner should own its own cleanup. The skill `stop` command sends SIGTERM, so fixing `handleSignal()` already covers it. |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
