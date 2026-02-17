# Tasks: Retrospectives Severity grep pattern misses bold-formatted fields

**Issue**: #48
**Date**: 2026-02-16
**Status**: Planning
**Author**: Claude

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Fix the grep pattern instruction in SKILL.md | [ ] |
| T002 | Add regression test (Gherkin feature file) | [ ] |
| T003 | Verify no regressions | [ ] |

---

### T001: Fix the Grep Pattern Instruction

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Line 34 updated to instruct a grep pattern that matches both `**Severity**:` and `Severity:` formats
- [ ] The instruction is unambiguous — Claude will use a pattern that handles optional bold markdown markers
- [ ] No other lines in the skill are modified
- [ ] The rest of the workflow (Steps 2–9) is unaffected

**Notes**: Update the instruction text on line 34. The current text reads:
> Then use Grep to identify defect specs by scanning for the `Severity:` field — this field is unique to the defect requirements template and does not appear in feature specs.

Change the grep guidance to use a pattern that accounts for optional `**` bold markers around the word, e.g. scanning for `Severity` without requiring a specific prefix/suffix format, or using a regex like `\*{0,2}Severity\*{0,2}:`.

### T002: Add Regression Test

**File(s)**: `.claude/specs/48-fix-retrospectives-severity-grep-pattern/feature.gherkin`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Gherkin scenario reproduces the original bug condition (bold-formatted Severity field)
- [ ] Scenario tagged `@regression`
- [ ] Scenario verifies both bold and plain Severity formats are detected
- [ ] Scenario verifies feature specs are not false-positive matched

### T003: Verify No Regressions

**File(s)**: [existing skill files]
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [ ] The running-retrospectives skill's Step 1 instruction is clear and unambiguous
- [ ] Steps 2–9 remain unchanged and still reference the correct input from Step 1
- [ ] The skill's overall workflow is coherent after the change

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T002)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
