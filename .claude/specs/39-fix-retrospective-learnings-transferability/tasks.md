# Tasks: Fix retrospective learnings transferability

**Issue**: #39
**Date**: 2026-02-16
**Status**: Planning
**Author**: Claude

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Rewrite running-retrospectives SKILL.md (Steps 3–7) | [ ] |
| T002 | Restructure retrospective template | [ ] |
| T003 | Update writing-specs Phase 1 retrospective consumption | [ ] |
| T004 | Add retrospective template to migrating-projects | [ ] |
| T005 | Write regression Gherkin feature file | [ ] |
| T006 | Verify no regressions across skills | [ ] |

---

### T001: Rewrite running-retrospectives SKILL.md (Steps 3–7)

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Step 3 instructs extraction of transferable, domain-agnostic patterns: replaces "what the feature spec should have included" with forward-looking generalization guidance
- [ ] Step 3 includes explicit examples of good vs bad learning framing (transferable vs project-specific)
- [ ] New Step 4 "Aggregate Cross-Cutting Patterns" added between analysis and filtering: instructs grouping defects sharing a root pattern into a single learning with multiple evidence references
- [ ] Step 5 (renumbered from old Step 5) adds abstraction-level guidance with explicit "too specific / too generic / right level" criteria
- [ ] Step 7 (renumbered from old Step 7) updates template-filling instructions to use new template structure (evidence column instead of separate source/feature columns)
- [ ] Step 8 (renumbered) output summary still works with the new step numbering
- [ ] All internal step references within the SKILL.md are updated to reflect renumbering

**Notes**: Steps 1–2 and 6 (load existing) are unchanged in content, only renumbered where needed. The new step sequence is: 1 (Scan) → 2 (Filter Eligible) → 3 (Analyze — rewritten) → 4 (Aggregate — new) → 5 (Classify — moved) → 6 (Filter — rewritten) → 7 (Load Existing) → 8 (Write Document) → 9 (Output Summary).

### T002: Restructure retrospective template

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/templates/retrospective.md`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] "How to Use" section reframed from "avoid repeating past spec gaps" to "apply these transferable patterns to new feature contexts — adapt each learning to the current feature's domain"
- [ ] Table columns changed from `Learning | Source Defect | Related Feature Spec | Recommendation` to `Learning | Recommendation | Evidence (defect specs)`
- [ ] Evidence column documents format: comma-separated defect spec paths (e.g., `.claude/specs/20-bug/, .claude/specs/25-bug/`)
- [ ] All three pattern-type sections (Missing Acceptance Criteria, Undertested Boundaries, Domain-Specific Gaps) updated with new column structure
- [ ] Placeholder rows updated to reflect new structure

### T003: Update writing-specs Phase 1 retrospective consumption

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [ ] Line 114 expanded from "apply relevant learnings" to explicit adaptive-application guidance: "read each learning as a transferable principle; adapt it to the current feature's domain by mapping the abstract pattern to concrete scenarios relevant to this feature"
- [ ] Guidance includes an example of adapting a generalized learning to a specific context
- [ ] No other lines in writing-specs SKILL.md are modified

### T004: Add retrospective template to migrating-projects

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [ ] Step 1 adds a fourth template source: `running-retrospectives/templates/retrospective.md` mapped to `.claude/steering/retrospective.md`
- [ ] "What Gets Analyzed" section at the top updated to mention retrospective.md alongside other steering docs
- [ ] Step 3 heading-diff logic applies to retrospective.md the same way as product.md, tech.md, structure.md
- [ ] No other steps or logic in migrating-projects are modified

### T005: Write regression Gherkin feature file

**File(s)**: `.claude/specs/39-fix-retrospective-learnings-transferability/feature.gherkin`
**Type**: Create
**Depends**: T001, T002, T003, T004
**Acceptance**:
- [ ] All 5 acceptance criteria from requirements.md have corresponding scenarios
- [ ] All scenarios tagged `@regression`
- [ ] Feature file is valid Gherkin syntax
- [ ] Scenarios are independent and self-contained

### T006: Verify no regressions across skills

**File(s)**: [existing skill files]
**Type**: Verify (no file changes)
**Depends**: T001, T002, T003, T004
**Acceptance**:
- [ ] Running-retrospectives step flow is internally consistent (no broken step references)
- [ ] Writing-specs Phase 1 still reads retrospective.md correctly (Step 4 conditional)
- [ ] Migrating-projects template resolution doesn't break existing steering doc and spec migrations
- [ ] No side effects in other skills that reference retrospective.md

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T005)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
