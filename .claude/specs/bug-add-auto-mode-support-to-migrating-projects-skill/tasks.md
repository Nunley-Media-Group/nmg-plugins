# Tasks: /migrating-projects Lacks Auto-Mode Support

**Issue**: #81
**Date**: 2026-02-23
**Status**: Planning
**Author**: Claude

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Update Automation Mode section and add auto-mode guards to SKILL.md | [ ] |
| T002 | Add regression test (BDD feature file) | [ ] |
| T003 | Verify no regressions | [ ] |

---

### T001: Update SKILL.md with Auto-Mode Support

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] "Automation Mode" section (lines 21–27) rewritten to describe dual behavior: auto-apply non-destructive changes, skip destructive operations with summary
- [ ] Step 4d (consolidation approval, lines 169–179) has auto-mode guard: when `.claude/auto-mode` exists, skip `AskUserQuestion`, record each consolidation group as a skipped operation, and proceed to Step 4f
- [ ] Step 9 Part A (steering doc approval, lines 336–356) has auto-mode guard: when `.claude/auto-mode` exists, auto-select all proposed sections without calling `AskUserQuestion`
- [ ] Step 9 Part B (batch approval, lines 358–379) has auto-mode guard: when `.claude/auto-mode` exists, auto-approve all non-destructive changes without calling `AskUserQuestion`; skip any remaining destructive operations with summary
- [ ] Step 10 output summary (lines 380–392) includes a new "Skipped Operations (Auto-Mode)" section when running in auto-mode — a machine-readable markdown table with columns: Operation Type, Affected Paths, Reason
- [ ] Key Rules section updated: rule 5 ("Always interactive") reworded to reflect conditional interactivity; new rule added describing auto-mode behavior (non-destructive auto-apply, destructive skip with summary)
- [ ] Step 10 "Persist declined sections" sub-step has auto-mode guard: skip writing to `.claude/migration-exclusions.json` in auto-mode (nothing is declined)
- [ ] No changes to Steps 1–3, 4a, 4b, 4c, 4e, 4f, 5, 6, 7, 8 analysis logic — only the approval gates and output are affected
- [ ] Interactive mode behavior (when `.claude/auto-mode` does NOT exist) is completely unchanged

**Notes**: Follow the pattern from other skills — check for `.claude/auto-mode` at each `AskUserQuestion` call site. The analysis steps (1–8) remain unchanged; only the approval steps (4d, 9) and output step (10) need auto-mode branches. Keep changes minimal and focused on the three `AskUserQuestion` touchpoints plus the output section.

### T002: Add Regression Test

**File(s)**: `.claude/specs/bug-add-auto-mode-support-to-migrating-projects-skill/feature.gherkin`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Gherkin scenario reproduces the original bug condition (auto-mode present, skill calls `AskUserQuestion`)
- [ ] Scenarios cover all 4 ACs: non-destructive auto-apply, destructive skip, machine-readable output, interactive mode unchanged
- [ ] All scenarios tagged `@regression`
- [ ] Scenarios use concrete data from the reproduction steps
- [ ] Scenarios are self-contained and independent

### T003: Verify No Regressions

**File(s)**: [existing test files]
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [ ] The SKILL.md is valid markdown with correct heading hierarchy
- [ ] All existing steps (1–10) are present and unchanged in their analysis logic
- [ ] Interactive mode flow (all `AskUserQuestion` calls) is preserved when `.claude/auto-mode` does not exist
- [ ] The "Key Rules" section is internally consistent with the updated workflow
- [ ] No side effects in related code paths — the `references/migration-procedures.md` file does not need changes (it describes apply procedures, not approval flow)

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #81 | 2026-02-23 | Initial defect spec |

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T002)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
