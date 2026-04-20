# Bug Report Issue Body Template

**Consumed by**: `draft-issue` Step 6.
**Triggering condition**: `classification === 'bug'`.

Use this template as the body of the drafted GitHub issue when the current iteration classifies as a Bug. Fill each placeholder from the confirmed `understanding` block produced by Step 5c and the `investigation.summary` (root-cause hypothesis) from Step 4.

## Template

```markdown
## Bug Report

[1-2 sentence summary of the bug]

## Root Cause Analysis

[Hypothesis from Step 4 investigation — affected code paths, the incorrect
assumption or logic, and triggering conditions. If investigation was
inconclusive, state what is known and what needs further investigation.]

**User Confirmed**: Yes / Partially / Investigation inconclusive

## Reproduction Steps

1. [First step]
2. [Second step]
3. [Step that triggers the bug]

## Expected Behavior

[What should happen]

## Actual Behavior

[What actually happens]

## Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | [e.g., macOS 15.2, Ubuntu 24.04] |
| **Version / Commit** | [app version or commit SHA] |
| **Browser / Runtime** | [if applicable] |

## Acceptance Criteria

### AC1: Bug Is Fixed

**Given** [the reproduction precondition]
**When** [the action that previously triggered the bug]
**Then** [the correct expected behavior]

### AC2: No Regression

**Given** [a related scenario that currently works]
**When** [a related action]
**Then** [existing behavior is preserved]

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | [The fix] | Must |

## Out of Scope

- [Related improvements not part of this fix]
```

## Authoring Guidance

- **Title** (separate from the body): Starts with a verb naming the fix (e.g., "Fix login crash on timeout").
- **Root Cause Analysis** is the value-add over a raw user report — use the Step 4 investigation's hypothesis so downstream spec writing does not re-derive it. When the user did not confirm the hypothesis, mark `**User Confirmed**: Partially` or `Investigation inconclusive` and say so honestly.
- **Acceptance Criteria** for bugs are tight: AC1 is the direct regression of the reproduction, AC2 is the "no related regression" guardrail. Additional ACs are acceptable when the bug's domain has clear edge cases worth locking down.
- **Functional Requirements** typically collapse to a single `FR1: [The fix]` row. Resist adding nice-to-haves — the issue is about the fix, not surrounding cleanup.
- **Out of Scope** names the adjacent improvements that will NOT be attempted in the fix PR — tempting diffs belong in a separate feature issue.
- When the iteration has DAG neighbors (batch mode), append placeholder cross-ref lines at the end of the body (`Depends on: <A1>` / `Blocks: <A4>`). Step 10 rewrites `<askId>` tokens to real `#N` once siblings have been created.
