# Requirements: Starting Issues Skill

**Issue**: #10
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As a** developer ready to begin work on a feature,
**I want** a skill that lets me select a GitHub issue, creates a linked feature branch, and sets the issue to In Progress,
**So that** I can start development with proper branch hygiene and issue tracking without manual setup.

---

## Background

The `/starting-issues` skill was extracted from the earlier `/beginning-dev` skill to provide standalone issue selection and branch setup. It lists open GitHub issues, lets the developer select one (or accepts an issue number argument in auto-mode), creates a feature branch linked to the issue via `gh issue develop`, and updates the issue status to "In Progress" in any associated GitHub Project. In automation mode, issues are sorted by number ascending (oldest first) and selected automatically without user confirmation.

---

## Acceptance Criteria

### AC1: Issue Selection Presents Open Issues

**Given** I invoke `/starting-issues` in interactive mode
**When** the skill starts
**Then** it lists open GitHub issues for me to select from

### AC2: Feature Branch Is Created and Linked

**Given** I select a GitHub issue
**When** branch setup completes
**Then** a feature branch is created and linked to the issue via `gh issue develop`

### AC3: Issue Status Is Updated

**Given** a feature branch is created
**When** the issue is linked
**Then** the issue status is set to "In Progress" in any associated GitHub Project

### AC4: Automation Mode Auto-Selects Oldest Issue

**Given** automation mode is active
**When** `/starting-issues` runs
**Then** it selects the oldest open issue (lowest number) without user confirmation

### AC5: Issue Number Can Be Provided as Argument

**Given** I invoke `/starting-issues` with an issue number
**When** the skill runs
**Then** it skips issue selection and uses the provided issue number directly

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | List open GitHub issues for interactive selection | Must | Via AskUserQuestion |
| FR2 | Feature branch creation linked via `gh issue develop` | Must | Creates and checks out branch |
| FR3 | Issue status update to "In Progress" in GitHub Projects | Must | Via GraphQL API |
| FR4 | Automation mode with oldest-first issue selection | Must | `.claude/auto-mode` check |
| FR5 | Direct issue number argument support | Must | Skips selection steps |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Branch creation completes in seconds |
| **Security** | Uses authenticated `gh` CLI for all GitHub operations |
| **Reliability** | Graceful skip if issue is not in any GitHub Project |

---

## UI/UX Requirements

Reference `structure.md` and `product.md` for project-specific design standards.

| Element | Requirement |
|---------|-------------|
| **Interaction** | [Touch targets, gesture requirements] |
| **Typography** | [Minimum text sizes, font requirements] |
| **Contrast** | [Accessibility contrast requirements] |
| **Loading States** | [How loading should be displayed] |
| **Error States** | [How errors should be displayed] |
| **Empty States** | [How empty data should be displayed] |

---

## Data Requirements

### Input Data

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| [field] | [type] | [rules] | Yes/No |

### Output Data

| Field | Type | Description |
|-------|------|-------------|
| [field] | [type] | [what it represents] |

---

## Dependencies

### Internal Dependencies
- [x] Plugin scaffold (#2)

### External Dependencies
- [x] `gh` CLI for issue listing, branch creation, GraphQL API
- [x] GitHub Projects v2 API for status updates

---

## Out of Scope

- Issue assignment to specific developers
- Branch naming customization beyond the default `gh issue develop` format
- Multi-issue selection for batch work

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| [metric] | [target value] | [how to measure] |

---

## Open Questions

- [ ] [Question needing stakeholder input]
- [ ] [Technical question to research]
- [ ] [UX question to validate]

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Dependencies are identified
- [x] Out of scope is defined
