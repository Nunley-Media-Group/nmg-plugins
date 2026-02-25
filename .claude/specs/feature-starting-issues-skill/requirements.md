# Requirements: Starting Issues Skill

**Issues**: #10, #89
**Date**: 2026-02-25
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

### AC6: Diagnostic Context in Zero-Result Auto-Mode Output

**Given** `/starting-issues` finds zero automatable issues in auto-mode
**When** the result is returned
**Then** it additionally queries the total open issue count (without the `automatable` label filter, in the same milestone scope)
**And** includes it in the output (e.g., "No automatable issues found (N open issues exist without the automatable label)")

### AC7: Suggestion When Open Issues Exist Without Label

**Given** total open issues > 0 but automatable issues = 0
**When** the zero-result diagnostic output is returned
**Then** the output suggests checking label assignment as a potential cause (e.g., "Consider adding the `automatable` label to issues that should be picked up automatically.")

### AC8: No Misleading Suggestion When No Open Issues Exist

**Given** total open issues = 0 and automatable issues = 0
**When** the zero-result diagnostic output is returned
**Then** the output indicates no work is available without suggesting label checks (e.g., "No automatable issues found. 0 open issues in scope.")

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | List open GitHub issues for interactive selection | Must | Via AskUserQuestion |
| FR2 | Feature branch creation linked via `gh issue develop` | Must | Creates and checks out branch |
| FR3 | Issue status update to "In Progress" in GitHub Projects | Must | Via GraphQL API |
| FR4 | Automation mode with oldest-first issue selection | Must | `.claude/auto-mode` check |
| FR5 | Direct issue number argument support | Must | Skips selection steps |
| FR6 | Query total open issue count (same scope, without label filter) when automatable count is zero in auto-mode | Must | Second `gh issue list` without `--label` |
| FR7 | Include total open issue count in zero-result diagnostic output | Must | Enhances the "No automatable issues found" message |
| FR8 | Suggest checking label assignment when open issues > 0 but automatable = 0 | Should | Actionable guidance for operators |

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
- Automatically applying the `automatable` label to issues
- Changing how the `automatable` label is managed by `/creating-issues`
- Adding resilience for other label types

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

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #10 | 2026-02-15 | Initial feature spec |
| #89 | 2026-02-25 | Add diagnostics for zero automatable issues in auto-mode: open issue count, label suggestion |

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Dependencies are identified
- [x] Out of scope is defined
