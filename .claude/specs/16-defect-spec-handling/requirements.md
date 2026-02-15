# Requirements: Defect-Specific Spec Handling

**Issue**: #16
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As a** developer fixing a bug,
**I want** the spec workflow to use lightweight, defect-focused templates instead of full feature templates,
**So that** bug fixes get appropriate documentation (reproduction steps, root cause analysis, fix strategy) without the overhead of feature-level requirements gathering.

---

## Background

Defect-specific spec handling adds a parallel set of templates for bug issues across the entire SDLC workflow. When a GitHub issue has the `bug` label, all skills automatically switch to defect variants: `/creating-issues` uses a bug report template with reproduction steps, expected/actual behavior, and environment table; `/writing-specs` routes all three phases to defect templates with reproduction steps, root cause analysis, and flat 2-4 task lists (with a complexity escape hatch for architectural bugs); `/implementing-specs` follows the fix strategy precisely with minimal change scope and a required regression test; and `/verifying-specs` checks reproduction, validates `@regression` scenarios, audits blast radius, and confirms minimal change. The defect templates include Requirements Variant (severity, reproduction, expected vs actual), Design Variant (root cause analysis, fix strategy, blast radius, regression risk), Tasks Variant (flat T001-T003), and Regression Scenarios (Gherkin with `@regression` tags). An optional "Related Spec" field links defect specs back to the original feature spec.

---

## Acceptance Criteria

### AC1: Bug Label Triggers Defect Templates

**Given** a GitHub issue has the `bug` label
**When** any SDLC skill processes the issue
**Then** defect-focused template variants are used instead of feature templates

### AC2: Bug Report Captures Reproduction Steps

**Given** I'm creating an issue for a bug via `/creating-issues`
**When** the bug report template is used
**Then** it includes reproduction steps, expected/actual behavior, environment table, and defect-focused acceptance criteria

### AC3: Defect Specs Use Root Cause Analysis

**Given** `/writing-specs` runs for a bug issue
**When** the design phase executes
**Then** it uses the defect design variant with root cause analysis, fix strategy, blast radius assessment, and regression risk

### AC4: Defect Tasks Are Flat and Minimal

**Given** `/writing-specs` runs for a bug issue
**When** the tasks phase executes
**Then** it produces a flat T001-T003 task list (fix, test, verify) instead of a full task hierarchy

### AC5: Implementation Minimizes Change Scope

**Given** `/implementing-specs` runs for a bug fix
**When** implementation begins
**Then** it follows the fix strategy precisely, minimizes change scope, and requires a regression test

### AC6: Verification Checks Regression Scenarios

**Given** `/verifying-specs` runs for a bug fix
**When** verification executes
**Then** it checks reproduction, validates `@regression` Gherkin scenarios, audits blast radius, and confirms minimal change

### AC7: Related Spec Field Links to Original Feature

**Given** a defect spec is for a bug in a previously-specified feature
**When** the requirements spec is written
**Then** it can include an optional "Related Spec" field referencing the original feature spec

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | `bug` label detection in all SDLC skills | Must | Via `gh issue view --json labels` |
| FR2 | Defect Requirements Variant (severity, reproduction, expected vs actual) | Must | In requirements template |
| FR3 | Defect Design Variant (root cause, fix strategy, blast radius, regression risk) | Must | In design template |
| FR4 | Defect Tasks Variant (flat T001-T003 task list) | Must | In tasks template |
| FR5 | Defect Regression Scenarios (Gherkin with `@regression` tags) | Must | In gherkin template |
| FR6 | Bug report issue template with reproduction steps | Must | In creating-issues skill |
| FR7 | Minimal change scope enforcement in implementation | Must | In implementing-specs skill |
| FR8 | Regression scenario validation in verification | Must | In verifying-specs skill |
| FR9 | Optional "Related Spec" field for defect traceability | Must | In requirements template |
| FR10 | Complexity escape hatch for architectural bugs | Must | Supplement with feature sections |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | No overhead — template selection is a simple label check |
| **Security** | Same security model as feature templates |
| **Reliability** | Automatic routing — no manual template selection needed |

---

## Dependencies

### Internal Dependencies
- [x] Creating issues skill (#4) for bug report template
- [x] Writing specs skill (#5) for defect template variants
- [x] Implementing specs skill (#6) for minimal change enforcement
- [x] Verifying specs skill (#7) for regression validation

### External Dependencies
- [x] `gh` CLI for label detection

---

## Out of Scope

- Automatic severity classification based on bug description
- Regression test generation (developer writes the test)
- Bug triage or assignment workflows

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Dependencies are identified
- [x] Out of scope is defined
