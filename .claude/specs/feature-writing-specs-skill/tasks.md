# Tasks: Writing Specs Skill

**Issues**: #5, #16
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
| Defect Templates/Content | 4 | [x] |
| Defect Plugin Files | 4 | [x] |
| Defect Integration | 1 | [x] |
| Defect Testing | 1 | [x] |
| **Total** | **18** | |

---

## Task Format

Each task follows this structure:

```
### T[NNN]: [Task Title]

**File(s)**: `{layer}/path/to/file`
**Type**: Create | Modify | Delete
**Depends**: T[NNN], T[NNN] (or None)
**Acceptance**:
- [ ] [Verifiable criterion 1]
- [ ] [Verifiable criterion 2]

**Notes**: [Optional implementation hints]
```

Map `{layer}/` placeholders to actual project paths using `structure.md`.

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

**File(s)**: `.claude/specs/feature-writing-specs-skill/feature.gherkin`
**Type**: Create
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] All 6 acceptance criteria have corresponding scenarios
- [x] Valid Gherkin syntax

---

## Phase 6: Defect Templates/Content

### T009: Add Defect Requirements Variant

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

### T010: Add Defect Design Variant

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

### T011: Add Defect Tasks Variant

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/templates/tasks.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Defect Tasks Variant section added after main template
- [x] Flat T001-T003 structure (fix, regression test, verify)
- [x] Optional T004 for multi-file fixes
- [x] Simplified validation checklist

### T012: Add Defect Regression Scenarios

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

## Phase 7: Defect Plugin Files

### T013: Add Bug Report Template to Creating-Issues

**File(s)**: `plugins/nmg-sdlc/skills/creating-issues/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Bug Report Template section added to Step 3
- [x] Includes reproduction steps, expected/actual, environment table
- [x] Defect-focused acceptance criteria

### T014: Add Defect Detection to Writing-Specs

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: T009, T010, T011, T012
**Status**: Complete
**Acceptance**:
- [x] Defect Detection section added
- [x] `bug` label check via `gh issue view --json labels`
- [x] Routing table for feature vs defect variants per phase
- [x] Complexity escape hatch documented

### T015: Add Bug Fix Rules to Implementing-Specs

**File(s)**: `plugins/nmg-sdlc/skills/implementing-specs/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Bug Fix Implementation section added
- [x] Follow fix strategy, minimize scope, require regression test

### T016: Add Bug Fix Verification to Verifying-Specs

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Bug Fix Verification section added
- [x] Reproduction check, regression validation, blast radius audit, minimal change check

---

## Phase 8: Defect Integration

### T017: Verify Cross-Skill Defect Routing

**File(s)**: All modified SKILL.md files
**Type**: Verify
**Depends**: T013, T014, T015, T016
**Status**: Complete
**Acceptance**:
- [x] All skills detect `bug` label consistently
- [x] Template routing is automatic — no manual selection
- [x] Defect workflow path is documented in writing-specs SKILL.md

---

## Phase 9: Defect Testing

### T018: Create BDD Feature File for Defect Handling

**File(s)**: `.claude/specs/feature-writing-specs-skill/feature.gherkin`
**Type**: Modify
**Depends**: T017
**Status**: Complete
**Acceptance**:
- [x] All 7 acceptance criteria from issue #16 have corresponding scenarios

---

## Dependency Graph

```
T001 ──┬──▶ T002 ──┬──▶ T003 ──▶ T004 ──▶ T005 ──▶ T006
       │           │
       │           └──▶ T007 ──▶ T008
       │
       └── T009 ──▶ T010 ──▶ T011 ──▶ T012
                    │
                    └──▶ T013 ──▶ T014 ──▶ T015 ──▶ T016 ──▶ T017 ──▶ T018
```

---

## Change History

| Date | Issue | Summary |
|------|-------|---------|
| 2026-02-15 | #5 | Initial tasks for writing-specs skill (T001–T008) |
| 2026-02-15 | #16 | Added defect handling tasks (T009–T018): defect template variants, cross-skill bug routing, regression verification |

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure
- [x] All 8 files modified consistently
