# Tasks: Installing Locally Skill

**Issue**: #15
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

**File(s)**: `.claude/skills/installing-locally/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Directory exists at repo-level `.claude/skills/` (not inside a plugin)

---

## Phase 2: Plugin Files

### T002: Create Skill Definition

**File(s)**: `.claude/skills/installing-locally/SKILL.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] SKILL.md with valid frontmatter
- [x] 7-step workflow documented (pull, discover, sync, update, OpenClaw, restart, report)
- [x] Key paths table documenting all relevant directories
- [x] Version tracking with installedAt/lastUpdated
- [x] Version mismatch warning logic
- [x] Non-fatal gateway restart handling

---

## Phase 3: Integration

### T003: Configure Allowed Tools

**File(s)**: `.claude/skills/installing-locally/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] Allowed tools: Read, Bash(git:*), Bash(cp:*), Bash(mkdir:*), Bash(date:*), Bash(jq:*), Bash(chmod:*), Bash(rsync:*), Bash(source:*)

---

## Phase 4: Testing

### T004: Create BDD Feature File

**File(s)**: `.claude/specs/15-installing-locally-skill/feature.gherkin`
**Type**: Create
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] All 4 acceptance criteria have corresponding scenarios

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

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Acceptance criteria are verifiable
