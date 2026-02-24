# Tasks: Handle Missing Spec Files Gracefully in /creating-prs

**Issue**: #82
**Date**: 2026-02-23
**Status**: Planning
**Author**: Claude Code

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Add spec existence check and fallback logic to Step 1 | [ ] |
| T002 | Add conditional PR body template to Step 4 | [ ] |
| T003 | Add regression test scenarios | [ ] |

---

### T001: Add Spec Existence Check and Fallback Logic to Step 1

**File(s)**: `plugins/nmg-sdlc/skills/creating-prs/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Step 1 uses `Glob` to check for `.claude/specs/{feature-name}/requirements.md` before attempting to read spec files
- [ ] If the spec directory or files do not exist, the skill extracts acceptance criteria from the GitHub issue body (already fetched via `gh issue view #N`)
- [ ] If the spec directory exists, the skill reads spec files as before (unchanged behavior)
- [ ] No unrelated changes to Step 1

**Notes**: Insert the existence check after the issue read (Step 1.1) and before the spec reads (Step 1.2-1.3). Use `Glob` for `.claude/specs/*/requirements.md` with matching against the current issue/branch, consistent with the Prerequisites section's existing fallback guidance. Track whether specs were found using a conceptual flag (e.g., "specs found" vs "specs not found") that Step 4 can reference.

### T002: Add Conditional PR Body Template to Step 4

**File(s)**: `plugins/nmg-sdlc/skills/creating-prs/SKILL.md`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] Step 4 has two PR body template variants: "with specs" (current template, unchanged) and "without specs"
- [ ] The "without specs" variant omits the "Specs" section entirely
- [ ] The "without specs" variant labels the Acceptance Criteria section as "From issue body" instead of "From `.claude/specs/{feature}/requirements.md`"
- [ ] The "without specs" variant includes a warning: "No spec files found — acceptance criteria extracted from issue body"
- [ ] The "with specs" variant is identical to the current template (AC4 preserved)

**Notes**: Present both variants in Step 4 with a clear conditional: "If specs were found in Step 1, use Template A. If specs were not found, use Template B."

### T003: Verify No Regressions

**File(s)**: `.claude/specs/bug-handle-missing-spec-files-in-creating-prs/feature.gherkin`
**Type**: Create
**Depends**: T001, T002
**Acceptance**:
- [ ] Gherkin scenarios cover all 4 acceptance criteria from requirements.md
- [ ] Scenarios tagged `@regression`
- [ ] Feature file is valid Gherkin syntax

---

## Validation Checklist

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T003)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
