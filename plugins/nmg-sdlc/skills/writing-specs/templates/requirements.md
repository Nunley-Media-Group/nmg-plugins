# Requirements Template

Use this template to create feature specifications in the **SPECIFY** phase.

---

```markdown
# Requirements: [Feature Name]

**Issue**: #[number]
**Date**: [YYYY-MM-DD]
**Status**: Draft | In Review | Approved
**Author**: [name]

---

## User Story

**As a** [user type — reference personas from product.md]
**I want** [action/capability — what they do]
**So that** [benefit/value — why it matters]

---

## Background

[1-2 paragraphs of context: why this feature is needed, what problem it solves, any relevant history. Reference the GitHub issue for additional context.]

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

Write criteria in Given/When/Then format — these will be directly converted to `.feature` files.

### AC1: [Scenario Name — Happy Path]

**Given** [precondition — the starting state]
**When** [action — what the user does]
**Then** [outcome — what should happen]
**And** [additional outcome — optional]

**Example**:
- Given: [concrete example with data]
- When: [specific action]
- Then: [specific outcome]

### AC2: [Scenario Name — Alternative Path]

**Given** [precondition]
**When** [action]
**Then** [outcome]

### AC3: [Scenario Name — Error Handling]

**Given** [precondition that leads to error]
**When** [action that triggers error]
**Then** [error handling behavior]

### AC4: [Scenario Name — Edge Case]

**Given** [edge case precondition]
**When** [action]
**Then** [expected behavior]

### Generated Gherkin Preview

```gherkin
Feature: [Feature Name]
  As a [user type from story]
  I want [action from story]
  So that [benefit from story]

  Scenario: [AC1 name]
    Given [AC1 precondition]
    When [AC1 action]
    Then [AC1 outcome]

  Scenario: [AC2 name]
    Given [AC2 precondition]
    When [AC2 action]
    Then [AC2 outcome]

  # ... all ACs become scenarios
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | [Core functionality — must have] | Must | |
| FR2 | [Important functionality] | Should | |
| FR3 | [Nice-to-have functionality] | Could | |
| FR4 | [Future consideration] | Won't (this release) | |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | [e.g., Response time < 200ms, Load time < 2s] |
| **Security** | [e.g., Requires authentication, Data encrypted] |
| **Accessibility** | [e.g., WCAG 2.1 AA, Screen reader support] |
| **Reliability** | [e.g., Graceful degradation, Offline support] |
| **Platforms** | [Reference tech.md for supported platforms] |

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
- [ ] [Other feature or component required]

### External Dependencies
- [ ] [External service or API]

### Blocked By
- [ ] Issue #[number] — [description]

---

## Out of Scope

Explicitly list what this feature does NOT include:

- [Feature or functionality not included]
- [Edge case not handled]
- [Platform not supported]

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

Before moving to PLAN phase:

- [ ] User story follows "As a / I want / So that" format
- [ ] All acceptance criteria use Given/When/Then format
- [ ] No implementation details in requirements
- [ ] All criteria are testable and unambiguous
- [ ] Success metrics are measurable
- [ ] Edge cases and error states are specified
- [ ] Dependencies are identified
- [ ] Out of scope is defined
- [ ] Open questions are documented (or resolved)
```
