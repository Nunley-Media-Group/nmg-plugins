# Tasks: Silent commitPush failure causing retry loop

**Issue**: #32
**Date**: 2026-02-16
**Status**: Planning
**Author**: Claude

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Fix the defect (push validation gate + prompt update) | [ ] |
| T002 | Add regression test | [ ] |
| T003 | Verify no regressions | [ ] |

---

### T001: Fix the Defect

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] A `validatePush()` helper function exists that runs `git fetch` then `git log origin/${branch}..HEAD --oneline` and returns `{ ok: boolean, reason?: string }`
- [ ] A post-step validation gate for step 6 exists in `runStep()`, inserted between the step 4 auto-commit block and the step 8 CI validation gate
- [ ] The gate follows the exact pattern of the spec validation gate (step 3, lines 1040-1055): check result, log failure, post Discord message, increment `retries[6]`, return `'retry'` or escalate at `MAX_RETRIES`
- [ ] The step 6 prompt (line 585) is updated to include explicit instruction for Claude to exit with a non-zero status code if `git push` fails
- [ ] No unrelated changes are included in the diff

**Notes**:

The `validatePush()` helper should:
1. Get the current branch via `git rev-parse --abbrev-ref HEAD`
2. Run `git fetch` to update remote refs (avoids false positives from stale refs)
3. Run `git log origin/${branch}..HEAD --oneline`
4. Return `{ ok: true }` if output is empty (no unpushed commits)
5. Return `{ ok: false, reason: 'Unpushed commits remain after push' }` if output is non-empty

The post-step gate should be placed in the `if (result.exitCode === 0)` block of `runStep()`, after the step 4 auto-commit block (~line 1064) and before the step 8 CI validation gate (~line 1066).

The prompt update should change:
```
...and push to the remote branch ${branch}. Verify the push succeeded.
```
to something like:
```
...and push to the remote branch ${branch}. After pushing, verify the push succeeded by running git log origin/${branch}..HEAD --oneline — if any unpushed commits remain, or if git push reported an error, exit with a non-zero status code.
```

### T002: Add Regression Test

**File(s)**: `.claude/specs/32-fix-silent-commitpush-failure/feature.gherkin`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Gherkin scenarios cover all 4 acceptance criteria from requirements.md
- [ ] All scenarios tagged `@regression`
- [ ] Scenarios use concrete data from the reproduction steps
- [ ] Feature file is valid Gherkin syntax

### T003: Verify No Regressions

**File(s)**: Existing test files and related code paths
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [ ] The existing spec validation gate (step 3) still functions correctly
- [ ] The existing CI validation gate (step 8) still functions correctly
- [ ] Step 7 precondition logic is unchanged
- [ ] The `MAX_RETRIES` / escalation pattern works consistently across all three validation gates
- [ ] No side effects in the `runStep()` function's control flow

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T002)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
