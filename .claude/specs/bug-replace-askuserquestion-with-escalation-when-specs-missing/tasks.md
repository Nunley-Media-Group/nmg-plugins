# Tasks: Replace AskUserQuestion with escalation when specs missing in unattended-mode

**Issues**: #85
**Date**: 2026-02-24
**Status**: Planning
**Author**: Claude

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Add unattended-mode conditional to missing-specs error path | [ ] |
| T002 | Add regression test scenarios | [ ] |
| T003 | Verify no regressions | [ ] |

---

### T001: Add unattended-mode conditional to missing-specs error path

**File(s)**: `plugins/nmg-sdlc/skills/write-code/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Step 2 ("Read Specs") missing-specs error path checks for `.claude/unattended-mode` before prompting
- [ ] When `.claude/unattended-mode` exists: outputs escalation message identifying missing specs, naming `/write-spec` as the prerequisite, ending with "Done. Awaiting orchestrator." — does NOT call `AskUserQuestion`
- [ ] When `.claude/unattended-mode` does NOT exist: calls `AskUserQuestion` to prompt user (preserves existing interactive behavior)
- [ ] The unattended-mode conditional follows the same pattern used in `/start-issue` SKILL.md (lines 145–156)
- [ ] No changes to any other part of the skill

**Notes**: Replace the single-line instruction at line 59 (`If specs don't exist, prompt: "No specs found. Run '/write-spec #N' first."`) with an explicit conditional block. Use the established pattern:

```
If specs don't exist:

**If `.claude/unattended-mode` exists:** Output:
\```
No specs found for issue #N. The `/write-spec` step must run first.

[Missing: list which spec files or directory are absent]

Done. Awaiting orchestrator.
\```
Then stop — do not proceed to subsequent steps.

**If `.claude/unattended-mode` does NOT exist:** Use `AskUserQuestion` to prompt: "No specs found. Run `/write-spec #N` first."
```

### T002: Add regression test scenarios

**File(s)**: `.claude/specs/bug-replace-askuserquestion-with-escalation-when-specs-missing/feature.gherkin`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Gherkin scenario covers AC1: escalation in unattended-mode when specs missing
- [ ] Gherkin scenario covers AC2: interactive prompt preserved when unattended-mode absent
- [ ] Gherkin scenario covers AC3: escalation message contains actionable context
- [ ] All scenarios tagged `@regression`
- [ ] Scenarios use concrete, realistic data

### T003: Verify no regressions

**File(s)**: [existing skill files — no changes]
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [ ] The write-code skill's Unattended Mode section (lines 20–23) remains unchanged
- [ ] The skill's Step 4 (EnterPlanMode) unattended-mode guard remains unchanged
- [ ] The skill's Step 5 (Execute Tasks) unattended-mode behavior remains unchanged
- [ ] The skill's Step 6 (Signal Completion) unattended-mode output remains unchanged
- [ ] No other skills are affected by this change

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T002)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
