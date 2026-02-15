# Tasks: Defect-Specific Spec Handling

**Issue**: #16
**Date**: 2026-02-15
**Status**: Complete
**Author**: Claude Code (retroactive)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Templates/Content | 4 | [x] |
| Plugin Files | 4 | [x] |
| Integration | 1 | [x] |
| Testing | 1 | [x] |
| **Total** | **10** | |

---

## Phase 1: Templates/Content

### T001: Add Defect Requirements Variant

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/templates/requirements.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Defect Requirements Variant section added after main template
- [x] Includes severity, reproduction steps, expected vs actual, environment table
- [x] 2-3 acceptance criteria (bug fixed + no regression)
- [x] Optional "Related Spec" field for traceability
- [x] Validation checklist adapted for defects

### T002: Add Defect Design Variant

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/templates/design.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Defect Design Variant section added after main template
- [x] Root cause analysis with affected code references
- [x] Fix strategy with blast radius assessment
- [x] Regression risk table
- [x] Alternatives considered section (optional)

### T003: Add Defect Tasks Variant

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/templates/tasks.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Defect Tasks Variant section added after main template
- [x] Flat T001-T003 structure (fix, regression test, verify)
- [x] Optional T004 for multi-file fixes
- [x] Simplified validation checklist

### T004: Add Defect Regression Scenarios

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/templates/feature.gherkin`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Defect Regression Scenarios section added after main template
- [x] All scenarios tagged `@regression`
- [x] Feature description states what was broken (not user story)
- [x] 2-3 scenarios: bug fixed, no regression, optional edge case

---

## Phase 2: Plugin Files

### T005: Add Bug Report Template to Creating-Issues

**File(s)**: `plugins/nmg-sdlc/skills/creating-issues/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Bug Report Template section added to Step 3
- [x] Includes reproduction steps, expected/actual, environment table
- [x] Defect-focused acceptance criteria

### T006: Add Defect Detection to Writing-Specs

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: T001, T002, T003, T004
**Status**: Complete
**Acceptance**:
- [x] Defect Detection section added
- [x] `bug` label check via `gh issue view --json labels`
- [x] Routing table for feature vs defect variants per phase
- [x] Complexity escape hatch documented

### T007: Add Bug Fix Rules to Implementing-Specs

**File(s)**: `plugins/nmg-sdlc/skills/implementing-specs/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Bug Fix Implementation section added
- [x] Follow fix strategy, minimize scope, require regression test

### T008: Add Bug Fix Verification to Verifying-Specs

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Bug Fix Verification section added
- [x] Reproduction check, regression validation, blast radius audit, minimal change check

---

## Phase 3: Integration

### T009: Verify Cross-Skill Defect Routing

**File(s)**: All modified SKILL.md files
**Type**: Verify
**Depends**: T005-T008
**Status**: Complete
**Acceptance**:
- [x] All skills detect `bug` label consistently
- [x] Template routing is automatic — no manual selection
- [x] Defect workflow path is documented in writing-specs SKILL.md

---

## Phase 4: Testing

### T010: Create BDD Feature File

**File(s)**: `.claude/specs/16-defect-spec-handling/feature.gherkin`
**Type**: Create
**Depends**: T009
**Status**: Complete
**Acceptance**:
- [x] All 7 acceptance criteria have corresponding scenarios

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] All 8 files modified consistently
