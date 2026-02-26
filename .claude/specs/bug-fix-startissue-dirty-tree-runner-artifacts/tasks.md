# Tasks: Fix `startIssue` dirty working tree from runner artifacts

**Date**: 2026-02-26
**Status**: Complete
**Author**: Claude

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Add `untrackRunnerArtifactsIfTracked()` to `sdlc-runner.mjs` | [x] |
| T002 | Update `starting-issues` SKILL.md Step 4 to filter runner artifacts | [x] |
| T003 | Verify no regressions | [x] |

---

### T001: Add runner self-heal for tracked artifacts

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [x] New `untrackRunnerArtifactsIfTracked()` function exists after `ensureRunnerArtifactsGitignored()`
- [x] Function iterates over `RUNNER_ARTIFACTS` and checks if each is tracked via `git ls-files --error-unmatch`
- [x] For tracked artifacts, runs `git rm --cached` to untrack
- [x] For non-tracked artifacts, silently skips (no error)
- [x] Logs when an artifact is untracked
- [x] Called in `main()` after `ensureRunnerArtifactsGitignored()` and before auto-mode creation
- [x] Uses existing `git()` helper for commands

### T002: Update starting-issues skill dirty-tree check

**File(s)**: `plugins/nmg-sdlc/skills/starting-issues/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [x] Step 4 precondition instructs filtering `.claude/sdlc-state.json` and `.claude/auto-mode` from `git status --porcelain` output
- [x] Filtering happens before the clean/dirty evaluation
- [x] Real dirty files (source code, config, etc.) still trigger the abort

### T003: Verify No Regressions

**File(s)**: Existing files
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [x] `ensureRunnerArtifactsGitignored()` behavior unchanged
- [x] `autoCommitIfDirty()` behavior unchanged
- [x] `removeAutoMode()` behavior unchanged
- [x] `validatePreconditions()` case 2 behavior unchanged

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure
