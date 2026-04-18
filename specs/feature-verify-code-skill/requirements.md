# Requirements: Verifying Specs Skill

**Issues**: #7, #109
**Date**: 2026-03-03
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As a** developer who has implemented a feature,
**I want** automated verification that my implementation matches the spec, with architecture review and automatic fixing of issues,
**So that** I can catch spec drift, architectural problems, and missing requirements before opening a PR.

---

## Background

The `/verify-code` skill validates that the implementation matches the specification, then runs an architecture review using a dedicated subagent. It actively fixes findings during verification — prioritizing fixes, running tests after each fix, re-verifying, and deferring items that exceed ~20 lines of change. The skill delegates architecture evaluation (SOLID principles, security/OWASP, performance, testability, error handling) to the `nmg-sdlc:architecture-reviewer` agent. The final report includes "Fixes Applied" and "Remaining Issues" sections, and the GitHub issue is updated with verification evidence. For bug fixes, verification focuses on reproduction checks, `@regression` scenario validation, blast radius, and minimal change audit.

---

## Acceptance Criteria

### AC1: Implementation Is Verified Against Spec

**Given** I invoke `/verify-code` for a completed feature
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

### AC6: Structured Verification Gates Section in tech.md

**Given** a project with a `tech.md` steering document
**When** the project defines mandatory verification constraints
**Then** the constraints are declared in a structured `## Verification Gates` section with a table containing: gate name, applicability condition, verification command/action, and pass criteria

### AC7: Gate Extraction During Verification

**Given** a project's `tech.md` contains a `## Verification Gates` section
**When** the verify-code skill runs Step 1 (Load Specifications and Steering Docs)
**Then** the skill extracts each gate as a named mandatory step to be executed during Step 5

### AC8: Gate Enforcement During Test Verification

**Given** the skill has extracted mandatory verification gates from steering docs
**When** Step 5 (Verify Test Coverage) executes
**Then** each applicable gate is executed as an explicit sub-step, the gate's pass criteria are evaluated against the actual result (supporting both exit code checks and artifact/output verification), and the gate is recorded with its outcome

### AC9: Incomplete Status for Unexecutable Gates

**Given** a mandatory verification gate cannot be executed (e.g., prerequisites not met, tool unavailable)
**When** the skill evaluates the gate
**Then** the overall verification status is set to "Incomplete" (not Pass or Fail), and the gate is recorded as unevaluated with the reason

### AC10: Report Template Includes Gate Results

**Given** verification gates were extracted from steering docs
**When** the verification report is generated (Step 7)
**Then** the report includes a mandatory "Steering Doc Verification Gates" section listing each gate with its status (Pass/Fail/Incomplete) and evidence or blocker reason

### AC11: Pass Report Requires All Gates Satisfied

**Given** one or more verification gates have status Incomplete or Fail
**When** the overall verification status is determined
**Then** the status cannot be "Pass" — it must be "Partial" (some gates failed) or "Incomplete" (gates were not executed)

### AC12: Stack-Agnostic Gate Definitions

**Given** verification gates are defined in `tech.md`
**When** different projects define different gates (e.g., E2E robot tests, load tests, accessibility audits, API contract tests)
**Then** the mechanism works for any gate type without the skill containing stack-specific logic

### AC13: Migration Path for Existing Projects

**Given** an existing project with a `tech.md` that lacks the `## Verification Gates` section
**When** a developer runs `/migrate-project` after updating the nmg-sdlc plugin
**Then** the migrate-project skill detects the missing `## Verification Gates` section and offers to add it (with the structured table template) via the standard section-merge workflow

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
| FR9 | Define a `## Verification Gates` section format for `tech.md` with structured gate declarations (name, condition, action, pass criteria) | Must | Table format for stack-agnostic gate definitions |
| FR10 | Update verify-code Step 1 to extract verification gates from steering docs | Must | Parse `## Verification Gates` table into named mandatory steps |
| FR11 | Update verify-code Step 5 to execute each applicable gate as a hard sub-step | Must | Execute gate action, evaluate pass criteria, record result |
| FR12 | Set verification status to "Incomplete" when any mandatory gate cannot be executed | Must | Prevents false Pass when gates are skipped |
| FR13 | Add a "Steering Doc Verification Gates" section to the report template | Must | Gate name, status (Pass/Fail/Incomplete), evidence/blocker |
| FR14 | Prevent "Pass" status when any gate is Incomplete or Fail | Must | Status must be "Partial" or "Incomplete" instead |
| FR15 | Update the setup-steering tech.md template to include the Verification Gates section | Must | New projects get the section scaffolded |
| FR16 | Document the Verification Gates convention in README.md | Must | User-facing documentation |
| FR17 | Ensure migrate-project detects and offers the Verification Gates section for existing projects | Must | Automatic via template-driven design — verify it works end-to-end |

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
- Automatically detecting verification constraints from prose (structured `## Verification Gates` section is required)
- Executing gates that require interactive prerequisites (e.g., starting a simulator) — these should be reported as Incomplete with the prerequisite documented
- Changes to the write-spec or write-code skills
- Defining specific gates for any particular project (each project defines its own)
- Changes to the migrate-project skill code (it is self-updating and reads templates at runtime)

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
| #7 | 2026-02-15 | Initial feature spec |
| #109 | 2026-03-03 | Add steering doc verification gates: structured gate format in tech.md, gate extraction and enforcement in verify-code, report template updates, migration path |

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Dependencies are identified
- [x] Out of scope is defined
