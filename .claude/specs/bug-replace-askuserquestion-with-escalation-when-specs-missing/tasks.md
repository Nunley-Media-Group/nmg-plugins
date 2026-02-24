# Tasks: Replace AskUserQuestion with escalation when specs missing in auto-mode

**Issues**: #85
**Date**: 2026-02-24
**Status**: Planning
**Author**: Claude

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Add auto-mode conditional to missing-specs error path | [ ] |
| T002 | Add regression test scenarios | [ ] |
| T003 | Verify no regressions | [ ] |

---

### T001: Add auto-mode conditional to missing-specs error path

**File(s)**: `plugins/nmg-sdlc/skills/implementing-specs/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Step 2 ("Read Specs") missing-specs error path checks for `.claude/auto-mode` before prompting
- [ ] When `.claude/auto-mode` exists: outputs escalation message identifying missing specs, naming `/writing-specs` as the prerequisite, ending with "Done. Awaiting orchestrator." — does NOT call `AskUserQuestion`
- [ ] When `.claude/auto-mode` does NOT exist: calls `AskUserQuestion` to prompt user (preserves existing interactive behavior)
- [ ] The auto-mode conditional follows the same pattern used in `/starting-issues` SKILL.md (lines 145–156)
- [ ] No changes to any other part of the skill

**Notes**: Replace the single-line instruction at line 59 (`If specs don't exist, prompt: "No specs found. Run '/writing-specs #N' first."`) with an explicit conditional block. Use the established pattern:

```
If specs don't exist:

**If `.claude/auto-mode` exists:** Output:
\```
No specs found for issue #N. The `/writing-specs` step must run first.

[Missing: list which spec files or directory are absent]

Done. Awaiting orchestrator.
\```
Then stop — do not proceed to subsequent steps.

**If `.claude/auto-mode` does NOT exist:** Use `AskUserQuestion` to prompt: "No specs found. Run `/writing-specs #N` first."
```

### T002: Add regression test scenarios

**File(s)**: `.claude/specs/bug-replace-askuserquestion-with-escalation-when-specs-missing/feature.gherkin`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Gherkin scenario covers AC1: escalation in auto-mode when specs missing
- [ ] Gherkin scenario covers AC2: interactive prompt preserved when auto-mode absent
- [ ] Gherkin scenario covers AC3: escalation message contains actionable context
- [ ] All scenarios tagged `@regression`
- [ ] Scenarios use concrete, realistic data

### T003: Verify no regressions

**File(s)**: [existing skill files — no changes]
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [ ] The implementing-specs skill's Automation Mode section (lines 20–23) remains unchanged
- [ ] The skill's Step 4 (EnterPlanMode) auto-mode guard remains unchanged
- [ ] The skill's Step 5 (Execute Tasks) auto-mode behavior remains unchanged
- [ ] The skill's Step 6 (Signal Completion) auto-mode output remains unchanged
- [ ] No other skills are affected by this change

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T002)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
