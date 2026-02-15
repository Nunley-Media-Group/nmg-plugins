# Tasks: Automation Mode Support

**Issue**: #11
**Date**: 2026-02-15
**Status**: Complete
**Author**: Claude Code (retroactive)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Plugin Files | 6 | [x] |
| Integration | 1 | [x] |
| Testing | 1 | [x] |
| **Total** | **8** | |

---

## Phase 1: Plugin Files

### T001: Add Auto-Mode to Creating-Issues

**File(s)**: `plugins/nmg-sdlc/skills/creating-issues/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Automation Mode section added
- [x] Skip interview, infer criteria from steering docs
- [x] Output "Done. Awaiting orchestrator." at completion

### T002: Add Auto-Mode to Starting-Issues

**File(s)**: `plugins/nmg-sdlc/skills/starting-issues/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Automation Mode section added
- [x] Auto-select oldest issue when no argument provided
- [x] Skip selection and confirmation steps

### T003: Add Auto-Mode to Writing-Specs

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Automation Mode section added
- [x] All 3 review gates pre-approved
- [x] Do not call AskUserQuestion at any gate

### T004: Add Auto-Mode to Implementing-Specs

**File(s)**: `plugins/nmg-sdlc/skills/implementing-specs/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Automation Mode section added
- [x] Do not call EnterPlanMode (design approach internally)
- [x] All approval gates pre-approved

### T005: Add Auto-Mode to Verifying-Specs

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Automation Mode section added
- [x] All approval gates pre-approved

### T006: Add Auto-Mode to Creating-PRs

**File(s)**: `plugins/nmg-sdlc/skills/creating-prs/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Orchestrator completion signal: "Done. Awaiting orchestrator."

---

## Phase 2: Integration

### T007: Verify Cross-Skill Consistency

**File(s)**: All SKILL.md files
**Type**: Verify
**Depends**: T001-T006
**Status**: Complete
**Acceptance**:
- [x] All skills check `.claude/auto-mode` consistently
- [x] All skills suppress next-step suggestions in auto-mode
- [x] Completion signal is consistent across all skills

---

## Phase 3: Testing

### T008: Create BDD Feature File

**File(s)**: `.claude/specs/11-automation-mode-support/feature.gherkin`
**Type**: Create
**Depends**: T007
**Status**: Complete
**Acceptance**:
- [x] All 6 acceptance criteria have corresponding scenarios

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] All 6 skills modified consistently
