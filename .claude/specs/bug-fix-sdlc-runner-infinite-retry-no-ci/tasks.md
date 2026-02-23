# Tasks: SDLC runner infinite retry when repo has no CI checks

**Issue**: #54
**Date**: 2026-02-16
**Status**: Planning
**Author**: Claude

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Fix Step 8 and Step 9 prompts to handle "no checks" | [ ] |
| T002 | Add regression Gherkin scenarios | [ ] |
| T003 | Verify no regressions | [ ] |

---

### T001: Fix the Defect

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Step 8 prompt includes explicit handling for "no checks reported" output — treats it as a passing condition and exits with code 0
- [ ] Step 9 prompt includes explicit handling for "no checks reported" output — treats it as equivalent to "all checks pass" and proceeds with merge
- [ ] Existing prompt logic for repos with CI checks (pending, passing, failing) is unchanged
- [ ] No unrelated changes included in the diff

**Notes**: The fix is prompt-text-only. Modify the string arrays at lines 700–714 (Step 8) and line 716 (Step 9). For Step 8, add an early-exit instruction before the polling loop: "If `gh pr checks` outputs 'no checks reported', this means the repository has no CI configured — treat this as success and exit with code 0." For Step 9, extend the precondition: "If `gh pr checks` reports 'no checks reported', treat this as passing and proceed with the merge."

### T002: Add Regression Test

**File(s)**: `.claude/specs/54-fix-sdlc-runner-infinite-retry-no-ci/feature.gherkin`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Gherkin scenario covers AC1 (no-checks pass in monitorCI)
- [ ] Gherkin scenario covers AC2 (no-checks pass in merge)
- [ ] Gherkin scenario covers AC3 (existing CI behavior preserved)
- [ ] All scenarios tagged `@regression`
- [ ] Scenarios use concrete data from the reproduction steps

### T003: Verify No Regressions

**File(s)**: [existing runner and prompt code]
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [ ] Step 8 prompt still handles pending checks (poll loop)
- [ ] Step 8 prompt still handles failing checks (diagnose + fix + retry)
- [ ] Step 8 prompt still handles the 3-attempt limit
- [ ] Step 9 prompt still refuses to merge when checks are failing
- [ ] No other prompt strings in `buildClaudeArgs()` were modified

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T002)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
