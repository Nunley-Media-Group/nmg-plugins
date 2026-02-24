# Tasks: Validate git cleanliness before branching in /starting-issues

**Issue**: #84
**Date**: 2026-02-24
**Status**: Planning
**Author**: Claude

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Add working tree cleanliness check to Step 4 of SKILL.md | [ ] |
| T002 | Add regression test scenarios (Gherkin) | [ ] |
| T003 | Verify no regressions in existing skill behavior | [ ] |

---

### T001: Add Working Tree Cleanliness Check to Step 4

**File(s)**: `plugins/nmg-sdlc/skills/starting-issues/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] A new "Precondition: Working Tree Check" subsection is added at the beginning of Step 4, before the existing `git branch --show-current` check
- [ ] Instructions tell Claude to run `git status --porcelain` and check if output is non-empty
- [ ] If dirty: skill aborts with an error message listing the dirty files (the `git status --porcelain` output)
- [ ] If dirty in auto-mode (`.claude/auto-mode` exists): the error is formatted as an escalation reason for the runner
- [ ] If clean: skill proceeds to the existing branch check and `gh issue develop` flow unchanged
- [ ] The check uses POSIX-compatible `git status --porcelain` (cross-platform safe)
- [ ] No changes to Steps 1–3 or the rest of Step 4

**Notes**: Insert the new subsection immediately after the `## Step 4:` heading and before the existing "Check if already on a feature branch" paragraph. The auto-mode escalation output should follow the same pattern used in Step 1's "No automatable issues found" exit. Also update the Workflow Overview diagram to show the precondition check.

### T002: Add Regression Test Scenarios (Gherkin)

**File(s)**: `.claude/specs/bug-validate-git-cleanliness-before-branching-in-starting-issues/feature.gherkin`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Gherkin scenario for AC1: dirty tree blocks branch creation
- [ ] Gherkin scenario for AC2: auto-mode escalation for dirty tree
- [ ] Gherkin scenario for AC3: diagnostic error message lists dirty files
- [ ] Gherkin scenario for AC4: clean tree proceeds normally
- [ ] All scenarios tagged `@regression`
- [ ] Scenarios use concrete, realistic data from the reproduction steps

### T003: Verify No Regressions in Existing Skill Behavior

**File(s)**: `plugins/nmg-sdlc/skills/starting-issues/SKILL.md`
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [ ] Steps 1–3 (issue selection, presentation, confirmation) are unchanged
- [ ] Step 4 branch creation logic (after the new guard) is unchanged
- [ ] Auto-mode behavior for issue selection is unchanged
- [ ] The skill's `allowed-tools` frontmatter still includes `Bash(git:*)` (required for `git status --porcelain`)
- [ ] No side effects on downstream skills (`/writing-specs`, `/implementing-specs`)

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Tasks are focused on the fix — no feature work
- [x] Regression test is included (T002)
- [x] Each task has verifiable acceptance criteria
- [x] No scope creep beyond the defect
- [x] File paths reference actual project structure (per `structure.md`)
