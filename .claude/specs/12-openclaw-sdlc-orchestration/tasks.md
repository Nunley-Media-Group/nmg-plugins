# Tasks: OpenClaw SDLC Orchestration

**Issue**: #12
**Date**: 2026-02-15
**Status**: Complete
**Author**: Claude Code (retroactive)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | [x] |
| Plugin Files | 2 | [x] |
| Templates/Content | 1 | [x] |
| Integration | 1 | [x] |
| Testing | 1 | [x] |
| **Total** | **6** | |

---

## Phase 1: Setup

### T001: Create OpenClaw Directory Structure

**File(s)**: `openclaw/scripts/`, `openclaw/skills/running-sdlc/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Scripts directory exists
- [x] Skill directory exists

---

## Phase 2: Plugin Files

### T002: Create SDLC Runner Script

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Node.js ES module with deterministic step sequencing
- [x] Precondition validation before each step
- [x] `claude -p` subprocess spawning with configurable maxTurns and timeout
- [x] Retry logic with configurable cap and escalation
- [x] Discord status posting via `openclaw message send`
- [x] Auto-commit of dirty work tree after implementation step
- [x] Git state detection for resume behavior
- [x] `lastCompletedStep` tracking in state file

### T003: Create OpenClaw Skill Definition

**File(s)**: `openclaw/skills/running-sdlc/SKILL.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] SKILL.md provides Claude Code skill interface for OpenClaw
- [x] References sdlc-runner.mjs for execution

---

## Phase 3: Templates/Content

### T004: Create Config Template

**File(s)**: `openclaw/scripts/sdlc-config.example.json`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] JSON template with per-step maxTurns, timeout, and prompt settings
- [x] Optional discordChannelId field
- [x] Project path and plugins path placeholders

---

## Phase 4: Integration

### T005: Wire Skill to Runner

**File(s)**: `openclaw/skills/running-sdlc/SKILL.md`
**Type**: Modify
**Depends**: T002, T003
**Status**: Complete
**Acceptance**:
- [x] Skill correctly invokes the runner script
- [x] Config file path is configurable

---

## Phase 5: Testing

### T006: Create BDD Feature File

**File(s)**: `.claude/specs/12-openclaw-sdlc-orchestration/feature.gherkin`
**Type**: Create
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] All 6 acceptance criteria have corresponding scenarios

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Acceptance criteria are verifiable
