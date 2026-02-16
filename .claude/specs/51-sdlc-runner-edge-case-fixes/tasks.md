# Tasks: SDLC Runner Edge Case Audit Findings (6 Bugs)

**Issue**: #51
**Date**: 2026-02-16
**Status**: Planning
**Author**: Claude

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Fix F1: Assign `currentProcess` in `runClaude()` | [ ] |
| T002 | Fix F2: Replace `Atomics.wait()` with `await sleep()` | [ ] |
| T003 | Fix F3: Use `shellEscape()` in `autoCommitIfDirty` | [ ] |
| T004 | Fix F4: Wrap merged-PR checkout in try-catch | [ ] |
| T005 | Fix F5: Log warning on `--resume` with missing state file | [ ] |
| T006 | Fix F6: Remove unused `AbortController` from `runClaude()` | [ ] |
| T007 | Add regression tests for all fixes | [ ] |
| T008 | Verify no regressions in existing tests | [ ] |

---

### T001: Fix F1 — Assign `currentProcess` in `runClaude()`

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] `currentProcess = proc` is assigned immediately after `spawn()` call (~line 747)
- [ ] `currentProcess = null` is set in `proc.on('close')` handler (~line 772)
- [ ] `currentProcess = null` is set in `proc.on('error')` handler (~line 782)
- [ ] SIGTERM handler at line 1170 can now reach the active subprocess

**Notes**: The module-level `let currentProcess = null` declaration at line 1161 already exists. Only the assignment and cleanup are missing.

### T002: Fix F2 — Replace `Atomics.wait()` with `await sleep()`

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Line 384 `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, backoff)` is replaced with `await sleep(backoff)`
- [ ] The `sleep()` helper at line 1153 is used (no new function needed)
- [ ] The retry loop in `postDiscord` remains functionally identical (same backoff durations, same retry count)
- [ ] `postDiscord` is already `async`, so no signature change needed

**Notes**: `postDiscord` is already an `async function` — the `await` will work without any caller changes.

### T003: Fix F3 — Use `shellEscape()` in `autoCommitIfDirty`

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Line 502 `git(\`commit -m "${message.replace(/"/g, '\\"')}"\`)` is replaced with `git(\`commit -m ${shellEscape(message)}\`)`
- [ ] `shellEscape()` at line 512 is used — no new escaping function
- [ ] Backticks, `$()`, and other shell metacharacters are neutralized by single-quote wrapping

**Notes**: `shellEscape()` wraps in single quotes and escapes embedded single quotes via `'\''`.

### T004: Fix F4 — Wrap merged-PR checkout in try-catch

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Lines 236–239 (`git('checkout main')` and `git('pull')`) are wrapped in a try-catch
- [ ] The catch block logs a warning with the error message
- [ ] The catch block returns `null` (falling through to normal startup behavior)
- [ ] The runner does not crash when the working tree is dirty during merged-PR detection

**Notes**: Returning `null` from `detectAndHydrateState()` causes the main loop to treat it as "no in-progress work detected" and proceed normally.

### T005: Fix F5 — Log warning on `--resume` with missing state file

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] A `log('Warning: --resume specified but state file not found...')` call is added in the `else` branch at line 1368
- [ ] Retry counters still reset to `{}` (existing behavior preserved)
- [ ] The warning message mentions that retry history was lost

**Notes**: This is the branch where `RESUME` is true but no state file exists on disk. The `detected` object comes from git/filesystem probing, not the state file.

### T006: Fix F6 — Remove unused `AbortController` from `runClaude()`

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] `const ac = new AbortController();` at line 745 is removed
- [ ] `signal: ac.signal` is removed from the `spawn()` options at line 750
- [ ] Timeout handling still works via the existing `setTimeout` + `proc.kill()` mechanism
- [ ] No other references to `ac` exist in the function

**Notes**: The `AbortController` was created but `ac.abort()` was never called anywhere. Removing it eliminates dead code.

### T007: Add Jest regression tests for all fixes

**File(s)**: `openclaw/scripts/__tests__/sdlc-runner.test.mjs`
**Type**: Modify (append new `describe` blocks to existing test file)
**Depends**: T001, T002, T003, T004, T005, T006
**Acceptance**:
- [ ] New `describe('Edge case fixes (issue #51)')` block added to existing test file
- [ ] Test for F1: Mock `spawn` to return a process object; call `runClaude()`; assert `currentProcess` is set during execution and cleared after close event fires
- [ ] Test for F2: Read source of `postDiscord` or invoke its retry path; assert no `Atomics.wait` usage (source grep or behavioral: verify event loop is not blocked during retry)
- [ ] Test for F3: Call `autoCommitIfDirty` with a message containing `$(dangerous)`; assert the `git commit` command uses single-quote escaping via `shellEscape()` (inspect `mockExecSync` call args)
- [ ] Test for F4: Mock `git checkout main` to throw (simulating dirty worktree); call `detectAndHydrateState()` when PR is merged; assert it returns `null` instead of throwing, and a warning is logged
- [ ] Test for F5: Set `RESUME=true` via `__test__.setConfig`; ensure state file doesn't exist; run the resume path; assert `log()` was called with a warning about missing state file
- [ ] Test for F6: Mock `spawn`; call `runClaude()`; assert `spawn` was called without a `signal` option in its third argument
- [ ] All new tests pass: `npm test` in `openclaw/scripts/`

**Notes**: Uses the existing Jest ESM mock infrastructure (`mockExecSync`, `mockSpawn`, `mockFs`, `__test__` helpers). Each Gherkin scenario from `feature.gherkin` maps to one or more Jest `it()` blocks.

### T008: Verify no regressions in existing tests

**File(s)**: Existing test files in `openclaw/scripts/__tests__/`
**Type**: Verify (no file changes)
**Depends**: T001, T002, T003, T004, T005, T006, T007
**Acceptance**:
- [ ] All existing tests pass (`npm test` in `openclaw/scripts/`)
- [ ] No side effects in related code paths per blast radius assessment in design.md

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression tests are included (T007)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
