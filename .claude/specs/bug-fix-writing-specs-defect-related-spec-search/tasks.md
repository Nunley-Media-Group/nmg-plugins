# Tasks: Writing-specs defect variant does not actively search for related feature specs

**Issue**: #58
**Date**: 2026-02-16
**Status**: Planning
**Author**: Claude Code

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Update SKILL.md Phase 1 step 7 with active search instruction | [ ] |
| T002 | Update requirements template Related Spec comment | [ ] |
| T003 | Add regression test (Gherkin feature file) | [ ] |

---

### T001: Update SKILL.md Phase 1 defect instruction with active search step

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Step 7 defect bullet is replaced with an active search instruction
- [ ] Instruction tells the agent to: (1) extract keywords from the issue (file paths, function names, component names), (2) glob `.claude/specs/*/requirements.md`, (3) grep for matching keywords, (4) populate Related Spec with the match or set to N/A
- [ ] Feature bullet in step 7 is unchanged
- [ ] No other steps are modified

**Notes**: The new instruction should be clear and procedural — the agent needs a concrete algorithm, not a vague hint. Keep it concise (a few lines, not a paragraph).

### T002: Update requirements template Related Spec comment

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/templates/requirements.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] The passive comment `*(optional — link to the feature spec this bug was found in, if one exists)*` is replaced with guidance referencing the active search step
- [ ] Only the Defect Requirements Variant section is modified
- [ ] The feature template section is unchanged

**Notes**: The updated comment should indicate the field is populated by the search step in the SKILL.md process, while still noting N/A is appropriate when no match is found.

### T003: Verify no regressions

**File(s)**: Existing SKILL.md and template files
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [ ] Feature variant in SKILL.md step 7 is unmodified
- [ ] Feature template in requirements.md is unmodified
- [ ] SKILL.md still parses as valid Markdown with correct heading hierarchy
- [ ] Template still parses as valid Markdown
- [ ] No other phases (Phase 2, Phase 3) are affected

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
