# Tasks: Verifying Specs Skill

**Issue**: #7
**Date**: 2026-02-15
**Status**: Complete
**Author**: Claude Code (retroactive)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | [x] |
| Plugin Files | 2 | [x] |
| Templates/Content | 6 | [x] |
| Integration | 1 | [x] |
| Testing | 1 | [x] |
| **Total** | **11** | |

---

## Phase 1: Setup

### T001: Create Skill Directory Structure

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/`, `plugins/nmg-sdlc/skills/verifying-specs/checklists/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Skill directory exists
- [x] Checklists subdirectory exists

---

## Phase 2: Plugin Files

### T002: Create Skill Definition

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] 9-step workflow documented
- [x] Auto-fix rules documented (fix <20 lines, defer larger)
- [x] Bug fix verification documented
- [x] Automation mode support documented

### T003: Create Architecture Reviewer Agent

**File(s)**: `plugins/nmg-sdlc/agents/architecture-reviewer.md`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Agent frontmatter with name, description, tools (Read, Glob, Grep)
- [x] Review process documented (map architecture, trace deps, evaluate checklists)
- [x] Output format documented (category scores, issues, observations)

---

## Phase 3: Templates/Content

### T004: Create SOLID Principles Checklist

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/checklists/solid-principles.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] All 5 SOLID principles covered with evaluation criteria

### T005: Create Security Checklist

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/checklists/security.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] OWASP-aligned security review criteria

### T006: Create Performance Checklist

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/checklists/performance.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Performance patterns and anti-patterns documented

### T007: Create Testability Checklist

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/checklists/testability.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] DI patterns, mock support, test isolation criteria

### T008: Create Error Handling Checklist

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/checklists/error-handling.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Error hierarchy, propagation, and recovery patterns

### T009: Create Report Template

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/checklists/report-template.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Executive summary with scores
- [x] AC verification table
- [x] Task completion table
- [x] Fixes Applied and Remaining Issues sections

---

## Phase 4: Integration

### T010: Wire Agent to Skill

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md`, `plugins/nmg-sdlc/agents/architecture-reviewer.md`
**Type**: Modify
**Depends**: T002, T003
**Status**: Complete
**Acceptance**:
- [x] Skill references architecture-reviewer via Task tool with correct subagent_type
- [x] Agent's skills field references verifying-specs

---

## Phase 5: Testing

### T011: Create BDD Feature File

**File(s)**: `.claude/specs/7-verifying-specs-skill/feature.gherkin`
**Type**: Create
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] All 5 acceptance criteria have corresponding scenarios

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure
