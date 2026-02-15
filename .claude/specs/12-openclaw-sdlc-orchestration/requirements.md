# Requirements: OpenClaw SDLC Orchestration

**Issue**: #12
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As an** OpenClaw agent operator,
**I want** a deterministic script-based SDLC orchestrator that drives the full development cycle via Claude Code subprocesses,
**So that** the SDLC workflow runs reliably with proper step sequencing, precondition validation, retry logic, and Discord status reporting.

---

## Background

The OpenClaw SDLC runner (`openclaw/scripts/sdlc-runner.mjs`) is a Node.js orchestrator that replaced the earlier prompt-engineered heartbeat loop. It drives the complete SDLC cycle — issue selection, spec writing, implementation, verification, PR creation, CI checks, and merge — using `claude -p` subprocesses with deterministic `for`-loop step sequencing. Each step has precondition validation, configurable timeouts and maxTurns, and retry logic with escalation. The runner posts Discord status updates at each step, auto-commits dirty work trees after implementation, auto-detects in-progress work from git state on startup, and tracks `lastCompletedStep` for proper resume behavior.

---

## Acceptance Criteria

### AC1: Full SDLC Cycle Runs End-to-End

**Given** the runner is started with a valid config
**When** it runs to completion
**Then** it executes all SDLC steps: issue selection, spec writing, implementation, verification, PR creation, CI verification, and merge

### AC2: Steps Have Precondition Validation

**Given** the runner advances to a new step
**When** preconditions for that step are checked
**Then** the step only proceeds if all preconditions pass (e.g., spec files exist before implementation)

### AC3: Failed Steps Retry With Escalation

**Given** a step fails
**When** retries are attempted
**Then** the step retries up to its configured cap, and escalation occurs if all retries are exhausted

### AC4: Discord Status Updates at Each Step

**Given** a Discord channel is configured
**When** each step starts, completes, or fails
**Then** a status message is posted to Discord via `openclaw message send`

### AC5: Resume Detects In-Progress Work

**Given** the runner starts on a feature branch with existing work
**When** it inspects git state (branch name, specs, commits, PR status, CI)
**Then** it hydrates state from reality and resumes from the correct step

### AC6: Auto-Commit After Implementation

**Given** implementation (Step 4) completes with uncommitted changes
**When** the step finishes
**Then** the runner auto-commits and pushes so verification preconditions pass

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Deterministic step sequencing via `for` loop | Must | Not prompt-engineered |
| FR2 | `claude -p` subprocess execution per step with configurable maxTurns and timeouts | Must | Per-step config |
| FR3 | Precondition validation before each step | Must | Step-specific checks |
| FR4 | Retry logic with configurable cap and escalation | Must | Per-step retry limits |
| FR5 | Discord status posting via `openclaw message send` | Must | With retry/backoff |
| FR6 | `lastCompletedStep` tracking for correct resume behavior | Must | State persistence |
| FR7 | Auto-detection of in-progress work from git state on startup | Must | Branch, specs, commits, PR, CI |
| FR8 | Auto-commit of dirty work tree after implementation step | Must | `git add -A && git commit` |
| FR9 | Config file support (`sdlc-config.json`) with per-step settings | Must | JSON config format |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Each step bounded by configurable timeout |
| **Security** | No secrets in config file; Discord channel ID is the only external reference |
| **Reliability** | Resume from any failure point via git state detection |

---

## Dependencies

### Internal Dependencies
- [x] All SDLC skills (#3-#8, #10, #11) for step execution
- [x] Automation mode (#11) for headless skill operation

### External Dependencies
- [x] `claude` CLI for subprocess execution
- [x] `openclaw message send` for Discord integration
- [x] `gh` CLI for PR and CI operations
- [x] Node.js runtime for script execution

---

## Out of Scope

- Multi-repo orchestration
- Parallel step execution
- Custom step ordering or step skip configuration
- Integration with CI/CD systems beyond `gh pr checks`

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Dependencies are identified
- [x] Out of scope is defined
