# Tasks: Creating Issues Skill

**Issues**: #4
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

**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Directory exists at `plugins/nmg-sdlc/skills/draft-issue/`

---

## Phase 2: Plugin Files

### T002: Create Skill Definition

**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] SKILL.md has valid frontmatter with name, description, argument-hint, allowed-tools
- [x] Documents 6-step workflow (gather context, interview, synthesize, review, create, output)
- [x] Includes feature/enhancement template with BDD acceptance criteria
- [x] Includes bug report template variant
- [x] Documents unattended mode behavior

---

## Phase 3: Integration

### T003: Configure Allowed Tools

**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] Allowed tools include Read, Glob, Grep, Bash(gh:*), WebSearch, WebFetch
- [x] Skill is discoverable via Claude Code plugin system

---

## Phase 4: Testing

### T004: Create BDD Feature File

**File(s)**: `.claude/specs/4-draft-issue-skill/feature.gherkin`
**Type**: Create
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] All 4 acceptance criteria have corresponding scenarios
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
| #4 | 2026-02-15 | Initial feature spec |

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure
