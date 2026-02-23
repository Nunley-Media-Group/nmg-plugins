# Tasks: Creating-issues skill does not read tech.md and structure.md during investigation

**Issue**: #27
**Date**: 2026-02-16
**Status**: Planning
**Author**: Claude Code

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Fix the defect — add steering doc reads to Step 3 | [ ] |
| T002 | Add regression test (Gherkin feature file) | [ ] |
| T003 | Verify no regressions | [ ] |

---

### T001: Fix the Defect

**File(s)**: `plugins/nmg-sdlc/skills/creating-issues/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Enhancement flow in Step 3 includes a new sub-step (item 3) that reads `.claude/steering/tech.md` and `.claude/steering/structure.md` if they exist
- [ ] Bug flow in Step 3 includes a new sub-step (item 3) that reads `.claude/steering/tech.md` and `.claude/steering/structure.md` if they exist
- [ ] Enhancement flow's "Summarize findings" step (now item 4) includes a bullet for relevant technical/architectural constraints from steering docs
- [ ] Bug flow's "Form hypothesis" step (now item 4) accounts for constraints from steering docs when formulating the root cause hypothesis
- [ ] Step 1 (`product.md` reading) is unchanged
- [ ] Auto-mode note ("This step is skipped") remains unchanged
- [ ] No unrelated changes included in the diff

**Notes**: Follow the fix strategy from design.md. The new sub-step should instruct Claude to read both documents (if they exist) and note any constraints relevant to the enhancement/bug area. Use conditional language ("if it exists") since not all projects will have all three steering docs.

### T002: Add Regression Test

**File(s)**: `.claude/specs/27-fix-creating-issues-steering-docs/feature.gherkin`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Gherkin scenario reproduces the original bug condition (Step 3 without steering doc reads)
- [ ] Scenario tagged `@regression`
- [ ] Scenario for AC1 (steering docs read during investigation)
- [ ] Scenario for AC2 (product.md still read in Step 1)
- [ ] Scenario for AC3 (constraints surface in issue output)

### T003: Verify No Regressions

**File(s)**: Existing skill file and specs
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [ ] Step 1 still instructs reading `product.md` for product context
- [ ] Step 3 Enhancement flow still explores specs and source code (items 1 and 2 unchanged)
- [ ] Step 3 Bug flow still searches code and traces paths (items 1 and 2 unchanged)
- [ ] Auto-mode note is preserved
- [ ] No side effects in related code paths (per blast radius from design.md)

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T002)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
