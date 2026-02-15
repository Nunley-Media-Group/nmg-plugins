# Requirements: Writing Specs Skill

**Issue**: #5
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As a** developer working on a GitHub issue,
**I want** an automated 3-phase specification process that produces requirements, design, and task breakdown documents,
**So that** implementation is guided by well-structured BDD specs rather than ad-hoc interpretation of issue descriptions.

---

## Background

The `/writing-specs` skill reads a GitHub issue and generates three specification documents through sequential phases: (1) Requirements spec — captures what needs to be built with acceptance criteria and functional requirements, (2) Design spec — defines the technical approach with architecture decisions and component design, and (3) Tasks spec — breaks the design into ordered implementation tasks with file-level granularity and Gherkin feature scenarios. Each phase has a human review gate (skipped in automation mode) where the developer can request changes before proceeding. Specs are written to `.claude/specs/{feature-name}/` using a naming algorithm derived from the issue number and title. For bug issues (detected via `bug` label), all three phases use lighter defect-focused templates.

---

## Acceptance Criteria

### AC1: Requirements Spec Captures Issue Intent

**Given** I invoke `/writing-specs` with a GitHub issue reference
**When** Phase 1 completes
**Then** a requirements spec is created in `.claude/specs/{feature-name}/` with acceptance criteria from the issue

### AC2: Design Spec Defines Technical Approach

**Given** the requirements spec has been reviewed and approved
**When** Phase 2 completes
**Then** a design spec is created with architecture decisions, component design, and technology choices

### AC3: Tasks Spec Provides Implementation Plan

**Given** the design spec has been reviewed and approved
**When** Phase 3 completes
**Then** a tasks spec is created with ordered implementation tasks and Gherkin feature scenarios

### AC4: Human Review Gates Pause Between Phases

**Given** I am not in automation mode
**When** a phase completes
**Then** the skill pauses for human review before proceeding to the next phase

### AC5: Feature Name Follows Naming Convention

**Given** a GitHub issue with number and title
**When** the feature name is derived
**Then** it uses the format `{issue-number}-{kebab-case-slug}` (e.g., `42-user-auth`)

### AC6: Bug Issues Use Defect Templates

**Given** the GitHub issue has a `bug` label
**When** the spec phases execute
**Then** defect-focused templates are used with reproduction steps, root cause analysis, and flat task lists

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | 3-phase spec generation: requirements, design, tasks | Must | Sequential with review gates |
| FR2 | Human review gates between phases (skippable in auto-mode) | Must | AskUserQuestion at each gate |
| FR3 | Specs written to `.claude/specs/{feature-name}/` directory | Must | Consistent naming |
| FR4 | Feature name algorithm: issue number + kebab-case title slug | Must | Matches branch name format |
| FR5 | Gherkin feature scenarios in the tasks phase | Must | `feature.gherkin` output |
| FR6 | Defect template variants for bug-labeled issues | Must | Lighter templates for bugs |
| FR7 | Templates for all spec types (requirements, design, tasks, Gherkin) | Must | In `templates/` directory |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Each phase completes within a single skill invocation |
| **Security** | No secrets in generated spec files |
| **Reliability** | Graceful handling when GitHub issue is not found |

---

## Dependencies

### Internal Dependencies
- [x] Plugin scaffold (#2)
- [x] Steering documents (#3) for project context
- [x] Creating issues skill (#4) for upstream issue format

### External Dependencies
- [x] `gh` CLI for reading GitHub issues

---

## Out of Scope

- Spec versioning or diff tracking between revisions
- Multi-issue spec consolidation
- Automatic spec updates when issues change after creation

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Dependencies are identified
- [x] Out of scope is defined
