# Tasks: Setting Up Steering Skill

**Issue**: #3
**Date**: 2026-02-15
**Status**: Complete
**Author**: Claude Code (retroactive)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | [x] |
| Plugin Files | 1 | [x] |
| Templates/Content | 3 | [x] |
| Integration | 1 | [x] |
| Testing | 1 | [x] |
| **Total** | **7** | |

---

## Phase 1: Setup

### T001: Create Skill Directory

**File(s)**: `plugins/nmg-sdlc/skills/setting-up-steering/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Directory exists at `plugins/nmg-sdlc/skills/setting-up-steering/`
- [x] `templates/` subdirectory exists for template files

---

## Phase 2: Plugin Files

### T002: Create Skill Definition

**File(s)**: `plugins/nmg-sdlc/skills/setting-up-steering/SKILL.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] SKILL.md has valid frontmatter with name, description, allowed-tools
- [x] Documents 4-step workflow (scan, generate, write, prompt)
- [x] Lists all file types scanned during codebase analysis
- [x] Includes customization guidance table

---

## Phase 3: Templates/Content

### T003: Create Product Steering Template

**File(s)**: `plugins/nmg-sdlc/skills/setting-up-steering/templates/product.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Template covers product vision, target users, capabilities
- [x] Includes placeholders for user journeys and feature prioritization

### T004: Create Tech Steering Template

**File(s)**: `plugins/nmg-sdlc/skills/setting-up-steering/templates/tech.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Template covers tech stack, frameworks, testing, coding standards
- [x] Includes BDD testing section
- [x] Includes environment variables section

### T005: Create Structure Steering Template

**File(s)**: `plugins/nmg-sdlc/skills/setting-up-steering/templates/structure.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Template covers directory layout, layer architecture, naming conventions
- [x] Includes anti-patterns section

---

## Phase 4: Integration

### T006: Register Skill in Plugin

**File(s)**: `plugins/nmg-sdlc/skills/setting-up-steering/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] Skill is discoverable by Claude Code's plugin system
- [x] Allowed tools are correctly scoped (Read, Glob, Grep, Task, Write, Edit, Bash)

---

## Phase 5: Testing

### T007: Create BDD Feature File

**File(s)**: `.claude/specs/3-setting-up-steering-skill/feature.gherkin`
**Type**: Create
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] All 4 acceptance criteria have corresponding scenarios
- [x] Valid Gherkin syntax

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure
- [x] No circular dependencies
