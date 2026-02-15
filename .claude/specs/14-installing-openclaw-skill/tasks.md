# Tasks: Installing OpenClaw Skill

**Issue**: #14
**Date**: 2026-02-15
**Status**: Complete
**Author**: Claude Code (retroactive)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | [x] |
| Plugin Files | 1 | [x] |
| Templates/Content | 1 | [x] |
| Integration | 1 | [x] |
| Testing | 1 | [x] |
| **Total** | **5** | |

---

## Phase 1: Setup

### T001: Create Skill Directory

**File(s)**: `plugins/nmg-sdlc/skills/installing-openclaw-skill/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Directory exists

---

## Phase 2: Plugin Files

### T002: Create Skill Definition

**File(s)**: `plugins/nmg-sdlc/skills/installing-openclaw-skill/SKILL.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] 5-step workflow documented (mkdir, copy, patch, restart, report)
- [x] Key paths table documenting source and destination
- [x] Non-fatal error handling for gateway restart

---

## Phase 3: Templates/Content

### T003: Create Standalone Installer Script

**File(s)**: `openclaw/scripts/install-openclaw-skill.sh`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Shell script with copy and --link modes
- [x] Copies SKILL.md, sdlc-runner.mjs, sdlc-config.example.json
- [x] Supports --link flag for symlink mode

---

## Phase 4: Integration

### T004: Configure Allowed Tools

**File(s)**: `plugins/nmg-sdlc/skills/installing-openclaw-skill/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] Allowed tools: Read, Bash(cp:*), Bash(mkdir:*), Bash(source:*), Bash(ls:*), Bash(node:*)

---

## Phase 5: Testing

### T005: Create BDD Feature File

**File(s)**: `.claude/specs/14-installing-openclaw-skill/feature.gherkin`
**Type**: Create
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] All 4 acceptance criteria have corresponding scenarios

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Acceptance criteria are verifiable
