# Tasks: SDLC runner cross-cycle state contamination in issue number extraction

**Issue**: #62
**Date**: 2026-02-20
**Status**: Complete
**Author**: Claude (regenerated)

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Replace regex extraction with branch-name detection | [x] |
| T002 | Add working tree cleanup to step 1 prompt | [x] |
| T003 | Add regression test scenarios | [x] |
| T004 | Verify no regressions | [x] |

---

### T001: Replace regex extraction with branch-name detection

**File(s)**: `openclaw/scripts/sdlc-runner.mjs` (`extractStateFromStep`, step 2 handler)
**Type**: Modify
**Depends**: None
**Acceptance**:
- [x] Step 2 handler uses `git rev-parse --abbrev-ref HEAD` to detect the current branch
- [x] Issue number extracted from branch name via `branch.match(/^(\d+)-/)` pattern
- [x] Fragile `output.match(/#(\d+)/)` regex on conversation output is removed entirely
- [x] Warning logged if branch-based extraction fails (no silent fallback)
- [x] Matches the same extraction pattern used by `detectAndHydrateState`

**Notes**: The branch name is deterministic ground truth — `/starting-issues` always creates branches in `{number}-{slug}` format.

### T002: Add working tree cleanup to step 1 prompt

**File(s)**: `openclaw/scripts/sdlc-runner.mjs` (`buildClaudeArgs`, step 1 prompt)
**Type**: Modify
**Depends**: None
**Acceptance**:
- [x] Step 1 prompt includes `git clean -fd` to remove untracked files
- [x] Step 1 prompt includes `git checkout -- .` to discard unstaged changes
- [x] Commands run after `git checkout main` and before `git pull`

**Notes**: Ensures the working tree is pristine at each cycle boundary, preventing file carryover from the previous cycle.

### T003: Add regression test scenarios

**File(s)**: `.claude/specs/62-fix-sdlc-runner-cross-cycle-state-contamination/feature.gherkin`
**Type**: Create
**Depends**: T001, T002
**Acceptance**:
- [x] Gherkin scenario covers issue number extraction from branch name (AC1, AC2)
- [x] Gherkin scenario covers working tree cleanup at cycle start (AC3)
- [x] Gherkin scenario covers normal cycle regression check (AC4)
- [x] All scenarios tagged `@regression`

### T004: Verify no regressions

**File(s)**: Existing test files and runner behavior
**Type**: Verify (no file changes)
**Depends**: T001, T002, T003
**Acceptance**:
- [x] `detectAndHydrateState` still works correctly (uses same branch-name pattern)
- [x] `extractStateFromStep` handlers for other steps (1, 3, 7, 9) are unaffected
- [x] Step prompts for steps 2–9 still reference `state.currentIssue` correctly
- [x] No side effects in related code paths per blast radius assessment

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T003)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
