# Requirements: Automation Mode Support

**Issue**: #11
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As an** automation platform operator,
**I want** all SDLC skills to detect a headless mode flag and bypass interactive prompts,
**So that** the full SDLC workflow can be driven by external agents without human intervention.

---

## Background

Automation mode enables external agents (like OpenClaw) to drive the entire SDLC cycle without human input. When `.claude/auto-mode` exists, skills skip all interactive prompts: `AskUserQuestion` calls, `EnterPlanMode` requests, and human review gates. This was developed iteratively — initial attempts used hook-level blocks (PermissionRequest auto-allow, PreToolUse blocks on AskUserQuestion and EnterPlanMode, Stop hook continuation), but these caused infinite retry loops because Claude interprets a blocked tool as "I need this but couldn't get it" and retries endlessly. The final solution moved automation awareness into the skills themselves, where each skill checks for `.claude/auto-mode` and conditionally skips interactive steps.

---

## Acceptance Criteria

### AC1: Auto-Mode Flag Enables Headless Operation

**Given** `.claude/auto-mode` exists in the project
**When** any SDLC skill is invoked
**Then** it operates without interactive prompts or human review gates

### AC2: Writing-Specs Skips Human Review Gates

**Given** automation mode is active
**When** `/writing-specs` runs
**Then** all 3 human review gates between phases are skipped automatically

### AC3: Implementing-Specs Skips Plan Mode

**Given** automation mode is active
**When** `/implementing-specs` runs
**Then** plan mode is skipped and implementation proceeds without approval

### AC4: Creating-Issues Infers Criteria

**Given** automation mode is active
**When** `/creating-issues` is invoked with a feature description
**Then** it skips the interview and generates acceptance criteria from steering docs

### AC5: Starting-Issues Auto-Selects Oldest

**Given** automation mode is active
**When** `/starting-issues` runs without an issue number argument
**Then** it selects the oldest open issue automatically

### AC6: Skills Suppress Next-Step Suggestions

**Given** automation mode is active
**When** any skill completes
**Then** next-step suggestions are suppressed to prevent unintended skill chaining

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | `.claude/auto-mode` flag file detection in all SDLC skills | Must | Simple file existence check |
| FR2 | Skip `AskUserQuestion` calls in auto-mode | Must | Prevents interactive prompts |
| FR3 | Skip `EnterPlanMode` calls in auto-mode | Must | Prevents plan approval gates |
| FR4 | Skip human review gates in `/writing-specs` | Must | All 3 phase gates |
| FR5 | Auto-select issue in `/starting-issues` | Must | Oldest-first |
| FR6 | Infer criteria in `/creating-issues` | Must | From steering docs |
| FR7 | Suppress next-step suggestions in all skills | Must | Outputs "Done. Awaiting orchestrator." |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Auto-mode check is a single file existence test |
| **Security** | Auto-mode file must be created locally (no remote activation) |
| **Reliability** | All-or-nothing: auto-mode affects all skills uniformly |

---

## Dependencies

### Internal Dependencies
- [x] All SDLC skills (#3-#8, #10) for auto-mode integration

### External Dependencies
- [x] Claude Code file system access for `.claude/auto-mode` check

---

## Out of Scope

- Remote auto-mode activation (must be set locally via flag file)
- Partial automation (all-or-nothing per session)
- Custom automation profiles with per-skill overrides

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Dependencies are identified
- [x] Out of scope is defined
