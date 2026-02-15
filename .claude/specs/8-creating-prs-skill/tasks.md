# Tasks: Creating PRs Skill

**Issue**: #8
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

## Phase 1: Setup

### T001: Create Skill Directory

**File(s)**: `plugins/nmg-sdlc/skills/creating-prs/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Directory exists

---

## Phase 2: Plugin Files

### T002: Create Skill Definition

**File(s)**: `plugins/nmg-sdlc/skills/creating-prs/SKILL.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] SKILL.md has valid frontmatter with disable-model-invocation: true
- [x] Documents 4-step workflow (read context, generate content, push/create, output)
- [x] PR body template with summary, ACs, test plan, spec links, Closes #N
- [x] Conventional commit prefix for PR titles
- [x] Automation mode completion signal documented

---

## Phase 3: Integration

### T003: Configure Allowed Tools

**File(s)**: `plugins/nmg-sdlc/skills/creating-prs/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] Allowed tools: Read, Glob, Grep, Bash(gh:*), Bash(git:*)
- [x] No Write/Edit needed (read-only + gh commands)

---

## Phase 4: Testing

### T004: Create BDD Feature File

**File(s)**: `.claude/specs/8-creating-prs-skill/feature.gherkin`
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
