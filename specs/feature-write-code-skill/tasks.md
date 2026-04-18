# Tasks: Implementing Specs Skill

**Issues**: #6
**Date**: 2026-02-15
**Status**: Complete
**Author**: Claude Code (retroactive)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | [x] |
| Plugin Files | 1 | [x] |
| Integration | 1 | [x] |
| Testing | 1 | [x] |
| **Total** | **4** | |

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

### T001: Create Skill Directory

**File(s)**: `plugins/nmg-sdlc/skills/write-code/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Directory exists

---

## Phase 2: Plugin Files

### T002: Create Skill Definition

**File(s)**: `plugins/nmg-sdlc/skills/write-code/SKILL.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] SKILL.md has valid frontmatter with name, description, argument-hint, allowed-tools
- [x] Documents 6-step workflow (identify, read specs, read steering, plan, execute, signal)
- [x] Automation mode behavior documented (skip EnterPlanMode)
- [x] Bug fix implementation rules documented
- [x] Deviation handling documented (minor, major, blocker)
- [x] Resume capability documented

---

## Phase 3: Integration

### T003: Configure Tool Access

**File(s)**: `plugins/nmg-sdlc/skills/write-code/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] Allowed tools include Read, Glob, Grep, Task, Write, Edit, EnterPlanMode, Bash(gh:*), Bash(git:*)
- [x] EnterPlanMode included for plan mode step

---

## Phase 4: Testing

### T004: Create BDD Feature File

**File(s)**: `specs/6-write-code-skill/feature.gherkin`
**Type**: Create
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] All 5 acceptance criteria have corresponding scenarios
- [x] Valid Gherkin syntax

---

## Dependency Graph

```
T001 ──┬──▶ T002 ──┬──▶ T003 ──▶ T004 ──▶ T005 ──▶ T006
       │           │
       │           └──▶ T007 ──▶ T008 ──▶ T009 ──▶ T010 ──▶ T011
       │                                    │
       │                                    └──▶ T012, T013 ──▶ T014
       │
       └──▶ T015 ──▶ T016, T017
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #6 | 2026-02-15 | Initial feature spec |

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure
