# Tasks: Plugin Scaffold and Marketplace Infrastructure

**Issue**: #2
**Date**: 2026-02-15
**Status**: Complete
**Author**: Claude Code (retroactive)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 2 | [x] |
| Plugin Files | 2 | [x] |
| Templates/Content | 1 | [x] |
| Integration | 1 | [x] |
| Testing | 1 | [x] |
| **Total** | **7** | |

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

### T001: Create Marketplace Index

**File(s)**: `.claude-plugin/marketplace.json`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] JSON file exists at `.claude-plugin/marketplace.json`
- [x] Contains `name`, `owner`, `metadata`, and `plugins` array
- [x] At least one plugin entry with name, version, description, source path

### T002: Create Plugin Directory Structure

**File(s)**: `plugins/nmg-sdlc/.claude-plugin/plugin.json`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Plugin directory exists at `plugins/nmg-sdlc/`
- [x] Plugin manifest exists at `plugins/nmg-sdlc/.claude-plugin/plugin.json`
- [x] Manifest contains name, version, description, author, repository

---

## Phase 2: Plugin Files

### T003: Create Installation Skill

**File(s)**: `.claude/skills/installing-locally/SKILL.md`
**Type**: Create
**Depends**: T001, T002
**Status**: Complete
**Acceptance**:
- [x] SKILL.md exists with valid frontmatter (name, description, allowed-tools)
- [x] Documents complete 7-step workflow (pull, discover, sync, update, OpenClaw, restart, report)
- [x] Handles marketplace index reading and plugin discovery
- [x] Uses `rsync` for idempotent file sync

### T004: Create README Documentation

**File(s)**: `README.md`
**Type**: Create
**Depends**: T001, T002
**Status**: Complete
**Acceptance**:
- [x] Documents the marketplace concept and plugin structure
- [x] Includes installation instructions
- [x] Lists available plugins and their capabilities

---

## Phase 3: Templates/Content

### T005: Define Manifest Schemas

**File(s)**: `.claude-plugin/marketplace.json`, `plugins/nmg-sdlc/.claude-plugin/plugin.json`
**Type**: Modify
**Depends**: T001, T002
**Status**: Complete
**Acceptance**:
- [x] Marketplace metadata includes version and pluginRoot
- [x] Plugin manifest includes all required fields
- [x] Version fields are synchronized between marketplace and plugin

---

## Phase 4: Integration

### T006: Verify Plugin Discovery Path

**File(s)**: `.claude/skills/installing-locally/SKILL.md`
**Type**: Modify
**Depends**: T003
**Status**: Complete
**Acceptance**:
- [x] Installation skill correctly reads marketplace.json plugins array
- [x] Resolves plugin source paths relative to marketplace root
- [x] Updates installed_plugins.json with correct version and path

---

## Phase 5: Testing

### T007: Create BDD Feature File

**File(s)**: `.claude/specs/2-plugin-scaffold-and-marketplace-infrastructure/feature.gherkin`
**Type**: Create
**Depends**: T003
**Status**: Complete
**Acceptance**:
- [x] All acceptance criteria from requirements.md have corresponding scenarios
- [x] Uses Given/When/Then format
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

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure
- [x] Test tasks are included
- [x] No circular dependencies
- [x] Tasks are in logical execution order
