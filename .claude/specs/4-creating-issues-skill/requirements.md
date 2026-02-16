# Requirements: Creating Issues Skill

**Issue**: #4
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As a** developer or product owner,
**I want** a guided interview process that produces well-groomed GitHub issues with BDD acceptance criteria,
**So that** every feature request is captured in a structured, spec-ready format before development begins.

---

## Background

The `/creating-issues` skill conducts an adaptive interview (2-3 rounds, skipping already-answered topics) to understand a feature need, then creates a GitHub issue with a standardized body: User Story, Background, Given/When/Then acceptance criteria, Functional Requirements table, and Out of Scope section. This format directly feeds the downstream `/writing-specs` skill, ensuring specs are grounded in well-defined requirements. In automation mode, the skill skips the interview and infers acceptance criteria from steering docs and the provided feature description.

---

## Acceptance Criteria

### AC1: Interactive Interview Gathers Requirements

**Given** I invoke `/creating-issues` without automation mode
**When** the skill starts
**Then** it asks adaptive questions about the feature need, skipping topics I've already addressed

### AC2: Issue Body Follows BDD Template

**Given** the interview is complete
**When** the GitHub issue is created
**Then** the body contains User Story, Background, Given/When/Then acceptance criteria, Functional Requirements, and Out of Scope sections

### AC3: Bug Report Uses Defect Template

**Given** I'm creating an issue for a bug
**When** I indicate it's a defect
**Then** the issue uses the bug report template with reproduction steps, expected/actual behavior, and environment table

### AC4: Automation Mode Skips Interview

**Given** automation mode is active (`.claude/auto-mode` exists)
**When** I invoke `/creating-issues` with a feature description argument
**Then** the skill skips the interview and infers 3-5 acceptance criteria from steering docs

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Adaptive interview process (2-3 rounds) gathering feature requirements | Must | Skips already-answered topics |
| FR2 | GitHub issue creation via `gh issue create` with BDD-formatted body | Must | Structured template |
| FR3 | User Story, Background, Acceptance Criteria, Functional Requirements, Out of Scope sections | Must | Standard issue format |
| FR4 | Bug report template variant with reproduction steps and severity | Must | Triggered by bug type |
| FR5 | Automation mode support that skips interview and infers criteria | Must | Reads `.claude/auto-mode` |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Interview and issue creation complete within a single session |
| **Security** | No sensitive data in issue bodies; uses `gh` CLI for authenticated access |
| **Reliability** | Graceful handling when GitHub API is unavailable |

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
- [x] Steering documents (from `/setting-up-steering`, #3) for automation mode context

### External Dependencies
- [x] `gh` CLI for GitHub issue creation
- [x] GitHub Issues API

---

## Out of Scope

- Issue prioritization or backlog ordering
- Integration with project management tools beyond GitHub Issues
- Automatic label assignment based on content analysis

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
