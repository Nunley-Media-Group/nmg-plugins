# Requirements: Creating PRs Skill

**Issue**: #8
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As a** developer ready to merge a verified feature,
**I want** a skill that creates a pull request with a summary automatically derived from my specs and verification results,
**So that** PR reviewers get full context linking the issue, specs, and implementation evidence without manual write-up.

---

## Background

The `/creating-prs` skill creates a GitHub pull request using `gh pr create` with a body that references the originating GitHub issue, links to the spec files in `.claude/specs/{feature-name}/`, and summarizes the implementation based on the tasks spec and verification report. The PR title and body are structured to give reviewers immediate context about what was built and why. In automation mode, the skill outputs a completion signal for the orchestrator instead of suggesting next steps.

---

## Acceptance Criteria

### AC1: PR Links to Originating Issue

**Given** I invoke `/creating-prs` after verification
**When** the PR is created
**Then** the PR body contains a reference to the originating GitHub issue (e.g., `Closes #N`)

### AC2: PR References Spec Files

**Given** specs exist in `.claude/specs/{feature-name}/`
**When** the PR is created
**Then** the PR body links to the requirements, design, and tasks spec files

### AC3: PR Summary Reflects Implementation

**Given** the implementation and verification are complete
**When** the PR body is generated
**Then** it summarizes what was built, key decisions, and verification status

### AC4: Automation Mode Outputs Completion Signal

**Given** automation mode is active
**When** the PR is created
**Then** the skill outputs `Done. Awaiting orchestrator.` instead of suggesting next steps

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | PR creation via `gh pr create` with structured body | Must | |
| FR2 | Issue reference in PR body (e.g., `Closes #N`) | Must | Auto-closes issue on merge |
| FR3 | Links to spec files in the PR body | Must | requirements, design, tasks |
| FR4 | Implementation summary derived from specs and verification | Must | |
| FR5 | Automation mode support with completion signal | Must | `Done. Awaiting orchestrator.` |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Single `gh pr create` call |
| **Security** | Uses authenticated `gh` CLI; no tokens in PR body |
| **Reliability** | Ensures branch is pushed before creating PR |

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
- [x] Writing specs skill (#5) for spec files to reference
- [x] Implementing specs skill (#6) for code to include
- [x] Verifying specs skill (#7) for verification status

### External Dependencies
- [x] `gh` CLI for PR creation
- [x] Git for branch management

---

## Out of Scope

- Automatic PR review assignment
- CI/CD pipeline triggering or status checking
- Auto-merge after approval

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
