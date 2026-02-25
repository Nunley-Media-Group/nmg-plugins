# Tasks: Exercise Template Dry-Run Prefix Prevents Skill Recognition

**Issue**: #49
**Date**: 2026-02-25
**Status**: Planning
**Author**: Claude

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Fix the exercise prompt structure in exercise-testing.md | [ ] |
| T002 | Add regression test (Gherkin scenarios) | [ ] |
| T003 | Verify no regressions | [ ] |

---

### T001: Fix the Defect

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/references/exercise-testing.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Line 36: "prepend" is changed to "append" and the instruction restructured so dry-run text follows the skill invocation
- [ ] Lines 38–39: "Dry-run prefix" label is renamed to "Dry-run instructions" and the text is prefixed with "IMPORTANT:"
- [ ] Line 96: `{exercise-prompt}` definition is updated to show the composite format: `"/{skill-name} {args}\n\nIMPORTANT: {dry-run-instructions}"` for GitHub-integrated skills
- [ ] The fallback `claude -p` prompt on lines 111–117 also reflects the new ordering (skill invocation first, dry-run appended)
- [ ] No unrelated changes included in the diff

**Notes**: Follow the fix strategy from design.md. The key change is reversing the order: skill invocation first, then dry-run instructions appended with "IMPORTANT:" marker. Update both the Agent SDK and `claude -p` code paths.

### T002: Add Regression Test

**File(s)**: `.claude/specs/bug-exercise-template-dry-run-prefix/feature.gherkin`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Gherkin scenarios cover AC1 (disable-model-invocation skill recognized), AC2 (dry-run instructions respected), and AC3 (non-disable-model-invocation skills unaffected)
- [ ] All scenarios tagged `@regression`
- [ ] Scenarios use concrete data from the reproduction steps (e.g., `creating-prs` as the affected skill)

### T003: Verify No Regressions

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/references/exercise-testing.md`, `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md`
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [ ] The SKILL.md references to exercise-testing.md still resolve correctly (step 5b–5e reference is intact)
- [ ] The Agent SDK exercise script template still has valid JavaScript syntax after prompt restructuring
- [ ] The `claude -p` fallback command is still syntactically valid
- [ ] No other files in the verifying-specs skill reference the old "Dry-run prefix" label

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #49 | 2026-02-25 | Initial defect spec |

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T002)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
