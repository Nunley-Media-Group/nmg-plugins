# Tasks: Writing Specs Skill

**Issue**: #5
**Date**: 2026-02-15
**Status**: Complete
**Author**: Claude Code (retroactive)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | [x] |
| Plugin Files | 1 | [x] |
| Templates/Content | 4 | [x] |
| Integration | 1 | [x] |
| Testing | 1 | [x] |
| **Total** | **8** | |

---

## Phase 1: Setup

### T001: Create Skill Directory Structure

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/`, `plugins/nmg-sdlc/skills/writing-specs/templates/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Skill directory exists
- [x] Templates subdirectory exists

---

## Phase 2: Plugin Files

### T002: Create Skill Definition

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] SKILL.md has valid frontmatter
- [x] Documents 3-phase workflow (SPECIFY, PLAN, TASKS)
- [x] Human review gates documented at each phase boundary
- [x] Automation mode behavior documented
- [x] Feature name convention documented
- [x] Defect detection and routing documented

---

## Phase 3: Templates/Content

### T003: Create Requirements Template

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/templates/requirements.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Feature variant with user story, ACs, functional/non-functional requirements
- [x] Defect variant with reproduction, expected vs actual, severity
- [x] Both variants clearly documented

### T004: Create Design Template

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/templates/design.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Feature variant with architecture, API, DB, state management, UI components
- [x] Defect variant with root cause analysis, fix strategy, blast radius
- [x] Validation checklists in both variants

### T005: Create Tasks Template

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/templates/tasks.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Feature variant with 5-phase breakdown and dependency graph
- [x] Defect variant with flat T001-T003 task list
- [x] Task format documented (file, type, depends, acceptance)

### T006: Create Gherkin Template

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/templates/feature.gherkin`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Feature variant with happy path, alternatives, errors, edge cases
- [x] Defect variant with @regression tagged scenarios
- [x] Step definition patterns documented

---

## Phase 4: Integration

### T007: Wire Templates to Skill Phases

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: T002, T003, T004, T005, T006
**Status**: Complete
**Acceptance**:
- [x] Phase 1 references requirements template
- [x] Phase 2 references design template
- [x] Phase 3 references tasks and gherkin templates
- [x] Defect detection routes to correct variant

---

## Phase 5: Testing

### T008: Create BDD Feature File

**File(s)**: `.claude/specs/5-writing-specs-skill/feature.gherkin`
**Type**: Create
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] All 6 acceptance criteria have corresponding scenarios
- [x] Valid Gherkin syntax

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure
