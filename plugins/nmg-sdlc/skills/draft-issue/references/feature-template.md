# Feature / Enhancement Issue Body Template

**Consumed by**: `draft-issue` Step 6.
**Triggering condition**: `classification === 'feature'`.

Use this template as the body of the drafted GitHub issue when the current iteration classifies as a Feature or Enhancement. Fill each placeholder from the confirmed `understanding` block produced by Step 5c and the `investigation.summary` from Step 4. Epic classification uses a separate template — see `references/multi-issue.md` for the Epic Coordination template.

## Template Structure vs. Bug Template

| Section | Feature Template | (Bug Report Template) |
|---------|------------------|----------------------|
| Opening | User Story (As a / I want / So that) | Bug Report (1–2 sentence summary) |
| Context | Background + Current State | Root Cause Analysis + User Confirmed flag |
| Reproduction | N/A | Reproduction Steps + Environment table |
| Expected vs Actual | N/A | Expected Behavior / Actual Behavior |
| AC count guidance | 3+ (happy path, alternative, error) | 2 (Bug Is Fixed + No Regression) |
| FR priority | MoSCoW (Must/Should/Could) | Typically Must only |
| Out of Scope | Scope boundaries for the feature | Related improvements not part of this fix |

## Template

```markdown
## User Story

**As a** [specific user type/persona]
**I want** [action or capability]
**So that** [benefit or value]

## Background

[1-2 paragraphs: why this is needed, what problem it solves, any relevant context]

## Current State

[Summary from Step 4 investigation — what exists today, relevant code patterns,
existing specs, and how the current implementation works. If no relevant code
was found, state that this is a greenfield addition.]

## Acceptance Criteria

Each criterion uses Given/When/Then format. These become Gherkin BDD test scenarios.

### AC1: [Scenario Name — Happy Path]

**Given** [precondition]
**When** [action]
**Then** [expected outcome]

### AC2: [Scenario Name — Alternative Path]

**Given** [precondition]
**When** [action]
**Then** [expected outcome]

### AC3: [Scenario Name — Error Handling]

**Given** [error precondition]
**When** [action that fails]
**Then** [error handling behavior]

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | [requirement] | Must |
| FR2 | [requirement] | Should |
| FR3 | [requirement] | Could |

## Out of Scope

- [What this does NOT include]
- [Boundaries to prevent scope creep]

## Notes

[Any additional context, links, references, or technical considerations]
```

## Authoring Guidance

The general issue-quality guidance (title shape, AC format, scope discipline, MoSCoW priorities, no-implementation-details rule) is defined once in the consuming SKILL.md `## Guidelines` section — do not duplicate it here. Template-specific rules:

- When `session.designContext` is present, cite the design URL in the Background section (e.g., `"Design reference: <session.designContext.url>"`) and weave relevant design details into the narrative.
- When the iteration has DAG neighbors (batch mode), append placeholder cross-ref lines at the end of the body (`Depends on: <A1>, <A2>` / `Blocks: <A4>`). Step 10 rewrites each `<askId>` token to a real `#N` once siblings have been created.
