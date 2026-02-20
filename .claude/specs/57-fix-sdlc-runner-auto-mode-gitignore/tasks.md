# Tasks: Fix SDLC runner committing auto-mode file to target projects

**Issue**: #57
**Date**: 2026-02-19
**Status**: Planning
**Author**: Claude

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Add `ensureRunnerArtifactsGitignored()` and call it before auto-mode creation | [ ] |
| T002 | Add regression test | [ ] |
| T003 | Verify no regressions | [ ] |

---

### T001: Fix the Defect

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] New `ensureRunnerArtifactsGitignored()` function exists near the `RUNNER_ARTIFACTS` constant
- [ ] Function reads existing `.gitignore` (or starts empty if file doesn't exist)
- [ ] Function checks each `RUNNER_ARTIFACTS` entry and only appends missing ones
- [ ] Function adds a comment header (e.g., `# SDLC runner artifacts`) before appended entries
- [ ] Function ensures a trailing newline before appending
- [ ] Function does not modify or remove any existing `.gitignore` entries
- [ ] Function is idempotent — calling it twice produces the same result
- [ ] `ensureRunnerArtifactsGitignored()` is called in `main()` before auto-mode file creation (before line ~1434)
- [ ] Uses `node:fs` and `node:path` (zero external dependencies)
- [ ] Uses `path.join()` for cross-platform path construction

**Notes**: Reference `RUNNER_ARTIFACTS` constant for the list of patterns to add. The patterns in `.gitignore` should match the values in `RUNNER_ARTIFACTS` (e.g., `.claude/auto-mode`, `.claude/sdlc-state.json`). Add a log message when entries are appended.

### T002: Add Regression Test

**File(s)**: `.claude/specs/57-fix-sdlc-runner-auto-mode-gitignore/feature.gherkin`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Gherkin scenario covers AC1: artifacts gitignored at startup
- [ ] Gherkin scenario covers AC2: existing gitignore preserved
- [ ] Gherkin scenario covers AC3: cleanup still works
- [ ] All scenarios tagged `@regression`

### T003: Verify No Regressions

**File(s)**: Existing test files, `openclaw/scripts/sdlc-runner.mjs`
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [ ] Existing runner tests still pass (`npm test` in `openclaw/scripts/`)
- [ ] `autoCommitIfDirty()` behavior is unchanged — still filters artifacts and uses `git add -A`
- [ ] `removeAutoMode()` behavior is unchanged — still deletes the file on cleanup
- [ ] Signal handler, escalation handler, and failure handler still commit/push dirty work
- [ ] No side effects in related code paths (per blast radius from design.md)

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T002)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
