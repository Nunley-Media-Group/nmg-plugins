# Requirements: Verifying Specs Skill

**Issue**: #7
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As a** developer who has implemented a feature,
**I want** automated verification that my implementation matches the spec, with architecture review and automatic fixing of issues,
**So that** I can catch spec drift, architectural problems, and missing requirements before opening a PR.

---

## Background

The `/verifying-specs` skill validates that the implementation matches the specification, then runs an architecture review using a dedicated subagent. It actively fixes findings during verification — prioritizing fixes, running tests after each fix, re-verifying, and deferring items that exceed ~20 lines of change. The skill delegates architecture evaluation (SOLID principles, security/OWASP, performance, testability, error handling) to the `nmg-sdlc:architecture-reviewer` agent. The final report includes "Fixes Applied" and "Remaining Issues" sections, and the GitHub issue is updated with verification evidence. For bug fixes, verification focuses on reproduction checks, `@regression` scenario validation, blast radius, and minimal change audit.

---

## Acceptance Criteria

### AC1: Implementation Is Verified Against Spec

**Given** I invoke `/verifying-specs` for a completed feature
**When** verification runs
**Then** each acceptance criterion and functional requirement from the spec is checked against the implementation

### AC2: Architecture Review Evaluates Quality

**Given** spec verification is complete
**When** the architecture review runs
**Then** the `architecture-reviewer` agent evaluates SOLID principles, security, performance, testability, and error handling

### AC3: Findings Are Fixed During Verification

**Given** findings are discovered during verification
**When** a finding requires fewer than ~20 lines to fix
**Then** the skill fixes it, runs tests, and re-verifies; larger findings are deferred

### AC4: GitHub Issue Is Updated With Evidence

**Given** verification is complete
**When** the report is generated
**Then** the GitHub issue is updated with a comment containing verification results

### AC5: Bug Fix Verification Checks Regression

**Given** the feature is a bug fix
**When** verification runs
**Then** it checks reproduction, validates `@regression` scenarios, audits blast radius, and confirms minimal change scope

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Spec-to-implementation verification for all acceptance criteria | Must | Pass/Fail per AC |
| FR2 | Architecture review via `nmg-sdlc:architecture-reviewer` subagent | Must | SOLID, security, performance, testability, error handling |
| FR3 | Auto-fix of findings under ~20 lines with test-after-fix workflow | Must | Fix, test, re-verify cycle |
| FR4 | Deferral of large findings with clear documentation | Must | Documented in report |
| FR5 | Report with "Fixes Applied" and "Remaining Issues" sections | Must | Using report template |
| FR6 | GitHub issue updated with verification evidence | Must | Via `gh issue comment` |
| FR7 | Bug fix verification with regression and blast radius checks | Must | Defect-specific checks |
| FR8 | Verification checklists for SOLID, security, performance, testability | Must | In `checklists/` directory |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Verification completes within a single skill invocation |
| **Security** | No secrets exposed in verification reports or issue comments |
| **Reliability** | Deferred findings are clearly documented, not silently dropped |

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
- [x] Writing specs skill (#5) for spec format
- [x] Implementing specs skill (#6) for implementation to verify

### External Dependencies
- [x] `gh` CLI for issue comments
- [x] `nmg-sdlc:architecture-reviewer` agent

---

## Out of Scope

- Performance benchmarking or load testing
- Security scanning with external tools (SAST/DAST)
- Automated deployment verification

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
