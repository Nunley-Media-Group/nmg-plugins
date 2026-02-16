# Requirements: Upfront Issue Type Classification

**Issue**: #21
**Date**: 2026-02-15
**Status**: Draft
**Author**: Claude

---

## User Story

**As a** developer using the creating-issues skill
**I want** the skill to proactively classify the issue type (bug vs enhancement) and perform type-specific codebase investigation before drafting
**So that** issues are created with richer context — current-state analysis for enhancements and root-cause investigation for bugs — improving quality of downstream spec writing and implementation

---

## Background

The creating-issues skill currently has type-specific interview guidance (feature vs bug vs enhancement) but it's passive — it adapts its questions based on what emerges during the interview rather than proactively branching the workflow. This means:

- For **enhancements**, issues are drafted without understanding the current state of the codebase, leading to specs that may miss existing patterns or capabilities.
- For **bugs**, issues capture only what the user reports without investigating the codebase to identify root causes, leaving that work entirely to the spec/implementation phase.

By adding upfront classification and type-specific investigation steps, issues will contain richer, more actionable context from the start. This is the first step in the SDLC pipeline — higher quality issues cascade into better specs, implementations, and verifications.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Upfront Type Classification — Happy Path

**Given** the user invokes `/creating-issues` (with or without an argument)
**When** the interview begins
**Then** the very first question asks whether this is a bug or an enhancement/feature, before any other interview questions

**Example**:
- Given: User runs `/creating-issues "improve search performance"`
- When: The skill begins the interview
- Then: The first question presented is "Is this a bug or an enhancement/feature?" (via `AskUserQuestion`)

### AC2: Enhancement Path — Codebase Exploration

**Given** the user selects "enhancement" as the issue type
**When** the skill gathers context for the enhancement
**Then** it explores existing specs in `.claude/specs/` for relevant areas and examines relevant source code to understand the current state, and includes a "Current State" summary section in the issue body

**Example**:
- Given: User classifies issue as "enhancement" for improving the writing-specs skill
- When: The skill investigates the codebase
- Then: It reads existing specs related to the area, examines the current SKILL.md, and adds a "Current State" section describing what exists today

### AC3: Bug Path — Root Cause Investigation

**Given** the user selects "bug" as the issue type
**When** the skill gathers context for the bug
**Then** it actively searches the codebase using Glob/Grep, traces code paths, forms a root cause hypothesis, confirms findings with the user via `AskUserQuestion`, and includes the analysis in the issue body

**Example**:
- Given: User classifies issue as "bug" about spec drift hook missing files
- When: The skill investigates the bug
- Then: It searches for the hook implementation, traces the logic, hypothesizes the root cause, asks the user "Does this root cause analysis look correct?", and includes it in the issue

### AC4: Automation Mode Unchanged

**Given** the `.claude/auto-mode` file exists
**When** the creating-issues skill is invoked
**Then** behavior is unchanged — automation mode does not add type-classification or investigation steps (auto-mode skips the interview entirely, so there is no classification step to add)

**Example**:
- Given: `.claude/auto-mode` exists and user runs `/creating-issues "add logging"`
- When: The skill executes in auto-mode
- Then: It follows the existing auto-mode path (skip interview, generate ACs from argument) with no changes

### AC5: Interview Flow Adapts After Classification

**Given** the issue type has been classified as bug or enhancement
**When** the remaining interview questions are asked
**Then** only type-relevant questions are presented (reproduction steps and environment for bugs; desired improvement, current pain, and impact for enhancements)

**Example**:
- Given: User classified the issue as "bug"
- When: The interview continues
- Then: Questions focus on reproduction steps, expected vs actual behavior, environment, and error output — not user story or impact assessment

### AC6: Current State Section in Enhancement Issues

**Given** the enhancement investigation has completed
**When** the issue body is synthesized
**Then** the issue body includes a "## Current State" section between "## Background" and "## Acceptance Criteria" summarizing what the codebase exploration found

**Example**:
- Given: Investigation found the creating-issues skill has passive type adaptation in Step 2
- When: The issue body is drafted
- Then: A "## Current State" section documents the current behavior, relevant code locations, and existing patterns

### AC7: Root Cause Section in Bug Issues

**Given** the bug investigation has completed and the user has confirmed the hypothesis
**When** the issue body is synthesized
**Then** the issue body includes a "## Root Cause Analysis" section with the hypothesis and relevant code references

**Example**:
- Given: Investigation found the hook reads from a stale file list
- When: The issue body is drafted
- Then: A "## Root Cause Analysis" section documents the hypothesis, affected code paths, and user confirmation

### Generated Gherkin Preview

```gherkin
Feature: Upfront Issue Type Classification
  As a developer using the creating-issues skill
  I want the skill to proactively classify the issue type and perform type-specific investigation
  So that issues are created with richer context for downstream SDLC phases

  Scenario: Upfront Type Classification — Happy Path
    Given the user invokes "/creating-issues" with or without an argument
    When the interview begins
    Then the very first question asks whether this is a bug or an enhancement/feature

  Scenario: Enhancement Path — Codebase Exploration
    Given the user selects "enhancement" as the issue type
    When the skill gathers context for the enhancement
    Then it explores existing specs and source code for the relevant area
    And includes a "Current State" summary in the issue body

  Scenario: Bug Path — Root Cause Investigation
    Given the user selects "bug" as the issue type
    When the skill gathers context for the bug
    Then it searches the codebase and traces code paths
    And forms a root cause hypothesis
    And confirms findings with the user
    And includes the analysis in the issue body

  Scenario: Automation Mode Unchanged
    Given the ".claude/auto-mode" file exists
    When the creating-issues skill is invoked
    Then behavior is unchanged from the current auto-mode path

  Scenario: Interview Flow Adapts After Classification
    Given the issue type has been classified
    When the remaining interview questions are asked
    Then only type-relevant questions are presented

  Scenario: Current State Section in Enhancement Issues
    Given the enhancement investigation has completed
    When the issue body is synthesized
    Then the issue body includes a "Current State" section

  Scenario: Root Cause Section in Bug Issues
    Given the bug investigation has completed and the user confirmed the hypothesis
    When the issue body is synthesized
    Then the issue body includes a "Root Cause Analysis" section
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Add upfront bug/enhancement/feature classification as the first interview question using `AskUserQuestion` | Must | Before any other interview questions |
| FR2 | Enhancement path: explore existing specs in `.claude/specs/` and relevant source code; include "Current State" summary in issue body | Must | Uses Glob, Grep, Read tools |
| FR3 | Bug path: search codebase, trace code paths, form root cause hypothesis, confirm with user via `AskUserQuestion` | Must | Present findings as hypothesis for user confirmation |
| FR4 | Preserve existing automation mode behavior unchanged | Must | Auto-mode skips interview; no classification needed |
| FR5 | Adapt remaining interview questions based on classified type | Should | Bug → reproduction-focused; Enhancement → improvement-focused |
| FR6 | Include "Current State" section in enhancement issue body template | Must | Placed between Background and Acceptance Criteria |
| FR7 | Include "Root Cause Analysis" section in bug issue body template | Must | Placed between Background and Acceptance Criteria |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Investigation step should complete within a reasonable time; use targeted Glob/Grep rather than exhaustive codebase scans |
| **Reliability** | If investigation finds no relevant code or specs, gracefully skip the investigation section and note that no existing code was found |
| **Usability** | Classification question should use `AskUserQuestion` with clear options (Bug, Enhancement/Feature) |

---

## Dependencies

### Internal Dependencies
- [x] Creating-issues skill exists (`plugins/nmg-sdlc/skills/creating-issues/SKILL.md`)
- [x] Steering documents exist (`.claude/steering/product.md`, `tech.md`, `structure.md`)

### External Dependencies
- [x] `gh` CLI for issue creation
- [x] Claude Code `AskUserQuestion` tool for classification prompt

### Blocked By
- None

---

## Out of Scope

- Changes to automation mode behavior (explicitly excluded per AC4)
- Changes to the bug report or enhancement issue templates' structure (content is richer, but sections remain the same except for the new Current State / Root Cause Analysis sections)
- Changes to other SDLC skills (writing-specs, implementing-specs, etc.)
- Automated codebase investigation without user confirmation (bug path always confirms hypothesis)
- Adding new labels or GitHub project integration

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Issue context quality | Enhancement issues include current-state analysis | Presence of "Current State" section in created issues |
| Bug diagnosis quality | Bug issues include root cause hypothesis | Presence of "Root Cause Analysis" section in created issues |
| Downstream spec quality | Specs reference issue investigation findings | Writing-specs skill can leverage richer issue content |

---

## Open Questions

- [x] Should the classification offer two options (Bug, Enhancement) or three (Bug, Feature, Enhancement)? — Per issue, two options: Bug vs Enhancement/Feature (combined)
- [ ] Should the investigation step use `Task` with `subagent_type='Explore'` for deeper codebase exploration, or direct Glob/Grep calls? — To be decided in design phase

---

## Validation Checklist

Before moving to PLAN phase:

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases and error states are specified
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented (or resolved)
