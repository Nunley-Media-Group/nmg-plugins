# Requirements: Spec Retrospective Skill

**Issue**: #1
**Date**: 2026-02-15
**Status**: Draft
**Author**: Claude

---

## User Story

**As a** developer using the nmg-sdlc workflow
**I want** defect patterns to automatically feed back into how specs are written
**So that** future specs avoid the same gaps that led to past bugs

---

## Background

When a defect is found in an existing feature, its defect spec optionally links back to the original feature spec via the **Related Spec** field. This creates a traceable relationship between "what we specified" and "what we missed." Currently, these learnings are lost — there's no mechanism to analyze defect history and feed actionable guidance back into the spec-writing process.

A new `/running-retrospectives` skill will batch-analyze all defect specs, correlate them with their related feature specs, identify recurring patterns in spec gaps, and produce a steering doc (`.claude/steering/retrospective.md`). The `/writing-specs` skill will then read this doc during Phase 1 (SPECIFY) to apply project-specific learnings when writing new specs.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Retrospective Skill Produces Steering Doc — Happy Path

**Given** defect specs exist in `.claude/specs/` with Related Spec links to feature specs
**When** the user runs `/running-retrospectives`
**Then** the skill analyzes all defect specs, correlates them with their related feature specs, identifies patterns (missing acceptance criteria, undertested boundaries, domain-specific gaps), and creates or updates `.claude/steering/retrospective.md` with actionable learnings

**Example**:
- Given: `.claude/specs/20-login-timeout-bug/requirements.md` exists with `Related Spec: .claude/specs/5-login-feature/` and root cause "missing AC for session timeout edge case"
- When: User invokes `/running-retrospectives`
- Then: `retrospective.md` includes a learning like "Authentication specs should include session timeout and expiry edge cases"

### AC2: Writing-Specs Reads Retrospective During Phase 1

**Given** a `.claude/steering/retrospective.md` file exists with learnings
**When** the user runs `/writing-specs` to create a new feature spec
**Then** Phase 1 (SPECIFY) reads the retrospective doc and applies relevant learnings when drafting acceptance criteria and requirements

**Example**:
- Given: `retrospective.md` contains "Authentication specs should include session timeout edge cases"
- When: User runs `/writing-specs` for a new auth-related feature
- Then: The generated requirements include acceptance criteria addressing session timeout scenarios

### AC3: Graceful Handling When No Defect Specs Exist

**Given** no defect specs exist in `.claude/specs/` (or none have Related Spec links)
**When** the user runs `/running-retrospectives`
**Then** the skill reports that no defect patterns were found and does not create or modify the retrospective doc

**Example**:
- Given: `.claude/specs/` contains only feature specs, no defect specs with Related Spec fields
- When: User invokes `/running-retrospectives`
- Then: Skill outputs "No defect specs with Related Spec links found. No retrospective generated."

### AC4: Only Spec-Quality Learnings Are Captured

**Given** defect specs with various root causes exist
**When** the skill analyzes them
**Then** only learnings that would improve `/writing-specs` effectiveness are included (e.g., missing AC patterns, undertested boundaries, domain-specific requirement gaps) — implementation bugs, tooling issues, or infrastructure failures are excluded

**Example**:
- Given: Three defect specs — one caused by missing AC for edge case, one caused by a typo in implementation code, one caused by CI misconfiguration
- When: Skill analyzes all three
- Then: Only the missing-AC defect produces a learning; the implementation typo and CI issue are excluded

### AC5: Retrospective Doc Is Incrementally Updated

**Given** a `.claude/steering/retrospective.md` already exists from a previous run
**When** the user runs `/running-retrospectives` again after new defect specs are added
**Then** the doc is updated with new learnings while preserving still-relevant existing learnings, and outdated entries are removed

**Example**:
- Given: Existing `retrospective.md` has 3 learnings; 2 new defect specs have been added since last run
- When: User runs `/running-retrospectives`
- Then: New learnings are added, existing relevant learnings are preserved, and any learnings no longer supported by current defect specs are removed

### Generated Gherkin Preview

```gherkin
Feature: Spec Retrospective Skill
  As a developer using the nmg-sdlc workflow
  I want defect patterns to automatically feed back into how specs are written
  So that future specs avoid the same gaps that led to past bugs

  Scenario: Retrospective skill produces steering doc from defect specs
    Given defect specs exist in ".claude/specs/" with Related Spec links to feature specs
    When the user runs "/running-retrospectives"
    Then the skill creates ".claude/steering/retrospective.md" with actionable learnings
    And each learning identifies a pattern type: missing AC, undertested boundary, or domain-specific gap

  Scenario: Writing-specs reads retrospective during Phase 1
    Given a ".claude/steering/retrospective.md" file exists with learnings
    When the user runs "/writing-specs" to create a new feature spec
    Then Phase 1 reads the retrospective doc and applies relevant learnings to acceptance criteria

  Scenario: Graceful handling when no defect specs exist
    Given no defect specs with Related Spec links exist in ".claude/specs/"
    When the user runs "/running-retrospectives"
    Then the skill reports no defect patterns found
    And no retrospective doc is created or modified

  Scenario: Only spec-quality learnings are captured
    Given defect specs with various root causes exist
    When the skill analyzes them
    Then only learnings relevant to spec-writing quality are included
    And implementation bugs, tooling issues, and infrastructure failures are excluded

  Scenario: Retrospective doc is incrementally updated
    Given a ".claude/steering/retrospective.md" exists from a previous run
    And new defect specs have been added since the last run
    When the user runs "/running-retrospectives"
    Then new learnings are added
    And still-relevant existing learnings are preserved
    And outdated entries no longer supported by current defect specs are removed
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | New `/running-retrospectives` skill (SKILL.md) that batch-analyzes all defect specs in `.claude/specs/` | Must | Skill follows standard SKILL.md structure |
| FR2 | Skill identifies defect specs by scanning for `Severity:` and `Related Spec:` fields in `requirements.md` files | Must | Defect specs use the defect requirements template |
| FR3 | Skill correlates defect specs with related feature specs via the Related Spec field | Must | Follows link to read original feature spec |
| FR4 | Skill classifies learnings into three pattern types: missing acceptance criteria, undertested boundaries, domain-specific requirement gaps | Must | Only these three categories |
| FR5 | Skill creates or updates `.claude/steering/retrospective.md` with structured, actionable learnings | Must | Structured format for machine readability |
| FR6 | Learnings are filtered to only those that improve spec-writing effectiveness | Must | Exclude implementation, tooling, infra issues |
| FR7 | `/writing-specs` Phase 1 (SPECIFY) reads `retrospective.md` when it exists | Must | Minimal change to writing-specs SKILL.md |
| FR8 | Skill supports automation mode (skip user prompts when `.claude/auto-mode` exists) | Should | Consistent with other skills |
| FR9 | Retrospective doc uses a structured, parseable format with headings per pattern type | Should | Enables writing-specs to extract relevant sections |
| FR10 | Skill gracefully handles zero defect specs (no file created, informational message) | Must | |
| FR11 | Incremental updates preserve still-relevant learnings and remove outdated ones | Must | Full re-analysis on each run, not append-only |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Skill execution should complete within reasonable time for batch analysis of all specs; no hard time limit in manual mode |
| **Reliability** | Graceful degradation when defect specs have incomplete fields (missing Related Spec, missing severity) |
| **Maintainability** | Retrospective doc is human-readable and editable — teams may curate auto-generated learnings |
| **Consistency** | Follows existing skill conventions: SKILL.md format, auto-mode support, SDLC integration section |

---

## UI/UX Requirements

| Element | Requirement |
|---------|-------------|
| **Skill Output** | Clear summary of how many defect specs were analyzed, how many learnings produced, pattern type breakdown |
| **Progress Feedback** | Status messages during analysis: "Scanning defect specs...", "Correlating with feature specs...", "Generating learnings..." |
| **Error States** | Informational message when no defect specs found; warning when Related Spec links point to nonexistent specs |
| **Retrospective Doc** | Human-readable with clear section headers; editable by teams for curation |

---

## Data Requirements

### Input Data

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| Defect spec `requirements.md` | Markdown file | Must contain `Severity:` field to identify as defect | Yes |
| `Related Spec` field | File path string | Must point to existing spec directory | No (defects without this field are skipped) |
| Related feature spec files | Markdown files | Must exist at the referenced path | No (warn if missing) |

### Output Data

| Field | Type | Description |
|-------|------|-------------|
| `.claude/steering/retrospective.md` | Markdown file | Structured learnings document organized by pattern type |
| Console output | Text | Summary of analysis: specs scanned, learnings generated, pattern breakdown |

---

## Dependencies

### Internal Dependencies
- [x] Defect requirements template with optional Related Spec field (Issue #16 — completed)
- [x] Steering documents infrastructure (`.claude/steering/`) (Issue #3 — completed)
- [x] `/writing-specs` skill with Phase 1 steering doc integration (Issue #5 — completed)

### External Dependencies
- None

### Blocked By
- None — all dependencies are already implemented

---

## Out of Scope

- Per-defect incremental mode (future enhancement — this issue covers batch analysis only)
- Modifying the `/writing-specs` SKILL.md template structure itself (the retrospective is guidance, not template changes)
- Retrospectives for non-spec concerns (implementation quality, tooling, infrastructure)
- Automatic triggering of retrospectives (user must explicitly invoke the skill)
- Analysis of defect specs without Related Spec links (these are skipped — no feature spec to correlate against)
- Modifying existing defect specs to add missing Related Spec fields

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Defect spec coverage | 100% of defect specs with Related Spec links are analyzed | Count analyzed vs total eligible |
| Learning actionability | Every learning maps to a concrete spec-writing improvement | Manual review of output |
| Writing-specs integration | Retrospective learnings visibly influence new spec ACs | Compare specs written before/after retrospective |

---

## Open Questions

- [x] ~~What structured format should `retrospective.md` use?~~ → Resolved: headings per pattern type (Missing Acceptance Criteria, Undertested Boundaries, Domain-Specific Gaps) with bullet-point learnings under each
- [ ] Should the skill produce a summary diff showing what changed in incremental updates?

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
