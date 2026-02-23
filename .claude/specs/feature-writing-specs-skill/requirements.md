# Requirements: Writing Specs Skill

**Issues**: #5, #16
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

<!-- From issue #16 -->

### AC7: Bug Label Triggers Defect Templates Across All Skills

**Given** a GitHub issue has the `bug` label
**When** any SDLC skill processes the issue
**Then** defect-focused template variants are used instead of feature templates

### AC8: Bug Report Captures Reproduction Steps

**Given** I'm creating an issue for a bug via `/creating-issues`
**When** the bug report template is used
**Then** it includes reproduction steps, expected/actual behavior, environment table, and defect-focused acceptance criteria

### AC9: Defect Specs Use Root Cause Analysis

**Given** `/writing-specs` runs for a bug issue
**When** the design phase executes
**Then** it uses the defect design variant with root cause analysis, fix strategy, blast radius assessment, and regression risk

### AC10: Defect Tasks Are Flat and Minimal

**Given** `/writing-specs` runs for a bug issue
**When** the tasks phase executes
**Then** it produces a flat T001-T003 task list (fix, test, verify) instead of a full task hierarchy

### AC11: Implementation Minimizes Change Scope

**Given** `/implementing-specs` runs for a bug fix
**When** implementation begins
**Then** it follows the fix strategy precisely, minimizes change scope, and requires a regression test

### AC12: Verification Checks Regression Scenarios

**Given** `/verifying-specs` runs for a bug fix
**When** verification executes
**Then** it checks reproduction, validates `@regression` Gherkin scenarios, audits blast radius, and confirms minimal change

### AC13: Related Spec Field Links to Original Feature

**Given** a defect spec is for a bug in a previously-specified feature
**When** the requirements spec is written
**Then** it can include an optional "Related Spec" field referencing the original feature spec

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
| FR8 | `bug` label detection in all SDLC skills | Must | Via `gh issue view --json labels` |
| FR9 | Defect Requirements Variant (severity, reproduction, expected vs actual) | Must | In requirements template |
| FR10 | Defect Design Variant (root cause, fix strategy, blast radius, regression risk) | Must | In design template |
| FR11 | Defect Tasks Variant (flat T001-T003 task list) | Must | In tasks template |
| FR12 | Defect Regression Scenarios (Gherkin with `@regression` tags) | Must | In gherkin template |
| FR13 | Bug report issue template with reproduction steps | Must | In creating-issues skill |
| FR14 | Minimal change scope enforcement in implementation | Must | In implementing-specs skill |
| FR15 | Regression scenario validation in verification | Must | In verifying-specs skill |
| FR16 | Optional "Related Spec" field for defect traceability | Must | In requirements template |
| FR17 | Complexity escape hatch for architectural bugs | Must | Supplement with feature sections |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Each phase completes within a single skill invocation |
| **Security** | No secrets in generated spec files |
| **Reliability** | Graceful handling when GitHub issue is not found |

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
- [x] Steering documents (#3) for project context
- [x] Creating issues skill (#4) for upstream issue format
- [x] Implementing specs skill (#6) for minimal change enforcement
- [x] Verifying specs skill (#7) for regression validation

### External Dependencies
- [x] `gh` CLI for reading GitHub issues and label detection

---

## Out of Scope

- Spec versioning or diff tracking between revisions
- Multi-issue spec consolidation
- Automatic spec updates when issues change after creation
- Automatic severity classification based on bug description
- Regression test generation (developer writes the test)
- Bug triage or assignment workflows

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

| Date | Issue | Summary |
|------|-------|---------|
| 2026-02-15 | #5 | Initial requirements for writing-specs skill (3-phase spec generation) |
| 2026-02-15 | #16 | Added defect-specific spec handling: bug label routing, defect template variants, regression scenarios, minimal change enforcement |

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Dependencies are identified
- [x] Out of scope is defined
