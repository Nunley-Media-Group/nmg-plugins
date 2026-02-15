# Tasks: SDLC runner not deleting auto-mode on exit

**Issue**: #17
**Date**: 2026-02-15
**Status**: Planning
**Author**: Claude

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Add centralized `removeAutoMode()` helper | [ ] |
| T002 | Call `removeAutoMode()` at all five exit paths | [ ] |
| T003 | Add regression test (Gherkin feature file) | [ ] |
| T004 | Verify no regressions | [ ] |

---

### T001: Add centralized `removeAutoMode()` helper

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] `removeAutoMode()` function defined near the `RUNNER_ARTIFACTS` constant (~line 360)
- [ ] Uses `fs.unlinkSync()` on `path.join(PROJECT_PATH, '.claude', 'auto-mode')`
- [ ] Wrapped in try-catch — swallows errors silently (best-effort, non-fatal per FR3)
- [ ] Logs deletion via `log()` on success for observability

**Notes**: Follow the existing best-effort pattern used in `handleSignal()` and `escalate()` (`try { ... } catch { /* best effort */ }`). The function should be synchronous since it's called from both sync and async contexts (including right before `process.exit()`).

### T002: Call `removeAutoMode()` at all five exit paths

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] Called in `handleSignal()` before `process.exit(0)` (~line 900) — fixes AC1
- [ ] Called in `escalate()` before `updateState()` at end of function (~line 749) — fixes AC2
- [ ] Called in the no-more-issues path before `break` (~line 1071) — fixes AC3
- [ ] Called in `main().catch()` before `process.exit(1)` (~line 1129) — fixes AC4
- [ ] Called in single-step mode before `process.exit()` (~line 1060) — fixes AC5
- [ ] Auto-mode creation at startup (~line 1004) is NOT modified — AC6 preserved

**Notes**: Each call site is a single line: `removeAutoMode();`. Place it as late as possible in each path (right before the exit action) to maximize the window where auto-mode is active during execution.

### T003: Add regression test (Gherkin feature file)

**File(s)**: `.claude/specs/17-fix-auto-mode-cleanup-on-exit/feature.gherkin`
**Type**: Create
**Depends**: T001, T002
**Acceptance**:
- [ ] Gherkin scenarios cover all 6 acceptance criteria from requirements.md
- [ ] All scenarios tagged `@regression`
- [ ] Feature description states what was broken and how it was fixed
- [ ] Valid Gherkin syntax

### T004: Verify no regressions

**File(s)**: No file changes
**Type**: Verify
**Depends**: T001, T002, T003
**Acceptance**:
- [ ] Auto-mode file is still created at startup (creation code untouched)
- [ ] `RUNNER_ARTIFACTS` constant is unchanged
- [ ] No other behavior in `handleSignal()`, `escalate()`, or `main()` is altered
- [ ] The diff contains only the new helper function and the 5 call-site additions

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T003)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
