# Tasks: migrating-projects Respects auto-mode Despite Spec Excluding It

**Issue**: #46
**Date**: 2026-02-16
**Status**: Planning
**Author**: Claude

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Add Automation Mode section to SKILL.md | [ ] |
| T002 | Add regression Gherkin feature file | [ ] |
| T003 | Verify no regressions in other skills | [ ] |

---

### T001: Add Automation Mode Section to SKILL.md

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] A `## Automation Mode` section exists after `## When to Use` and before `## What Gets Analyzed`
- [ ] The section explicitly states that `.claude/auto-mode` does NOT apply to this skill
- [ ] The section instructs Claude to ALWAYS use `AskUserQuestion` for the review gate
- [ ] Existing auto-mode notes at Step 9 (line ~222) and Key Rules (line ~279) are preserved
- [ ] No other content in the SKILL.md is changed

**Notes**: Follow the fix strategy from design.md. The section heading and placement must match the structural pattern used by other skills (e.g., `writing-specs/SKILL.md` has `## Automation Mode` after `## When to Use`).

### T002: Add Regression Test

**File(s)**: `.claude/specs/46-fix-migrating-projects-auto-mode/feature.gherkin`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Gherkin scenario reproduces the original bug condition (auto-mode present, review gate should still appear)
- [ ] Scenario tagged `@regression`
- [ ] Scenario for the no-auto-mode path confirms existing behavior preserved
- [ ] Scenario for other skills confirms they still respect auto-mode

### T003: Verify No Regressions

**File(s)**: Other SDLC skill SKILL.md files
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [ ] `writing-specs/SKILL.md` still has its Automation Mode section unchanged
- [ ] `implementing-specs/SKILL.md` still has its auto-mode handling unchanged
- [ ] `verifying-specs/SKILL.md` still has its auto-mode handling unchanged
- [ ] No other skill SKILL.md files were modified

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T002)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
