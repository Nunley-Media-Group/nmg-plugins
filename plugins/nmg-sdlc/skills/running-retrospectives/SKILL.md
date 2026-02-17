---
name: running-retrospectives
description: "Analyze defect specs to identify spec-writing gaps and produce actionable learnings."
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(gh:*)
---

# Running Retrospectives

Batch-analyze defect specs to identify recurring spec-writing gaps and produce `.claude/steering/retrospective.md` — a steering document that `/writing-specs` reads during Phase 1 to avoid repeating past spec failures.

## When to Use

- After accumulating defect specs with `Related Spec` links back to feature specs
- Periodically (e.g., after each release cycle) to refresh learnings
- Before starting a new feature in a domain where past defects occurred

## Automation Mode

If the file `.claude/auto-mode` exists in the project directory:
- All approval gates are pre-approved. Do NOT call `AskUserQuestion` — proceed through all steps without stopping for user input.

---

## Workflow

### Step 1: Scan for Defect Specs

Use Glob to find all spec files:

```
.claude/specs/*/requirements.md
```

Then use Grep to identify defect specs by scanning for `\*{0,2}Severity\*{0,2}:` (matches both `**Severity**:` and `Severity:`) — this field is unique to the defect requirements template and does not appear in feature specs.

### Step 2: Filter to Eligible Defect Specs

Read each candidate defect spec and extract the `**Related Spec**:` field (bold-formatted in the defect template).

- **Skip** defect specs that do not have a `Related Spec` field — there is no feature spec to correlate against
- **Warn** if a `Related Spec` link points to a nonexistent spec directory — log a warning and skip that defect

After filtering, if **zero eligible defect specs** remain:

```
No defect specs with Related Spec links found. No retrospective generated.
```

Stop here — do not create or modify `retrospective.md`.

### Step 3: Analyze Each Eligible Defect

For each defect spec with a valid `Related Spec` link:

1. **Read the defect spec** (`requirements.md`) — extract reproduction steps, acceptance criteria, severity, and root cause context
2. **Read the related feature spec** (`requirements.md`) — extract the original acceptance criteria, functional requirements, and scope
3. **Compare**: What did the feature spec cover? What scenario caused the defect? What was the gap?
4. **Identify the transferable spec-writing pattern** — strip project-specific details and frame as a principle applicable to any domain
5. **Formulate a recommendation**: Actionable guidance for writing future specs

**Generalization guidance**: Each learning must be a forward-looking principle, not a backward-looking description of what one spec missed. Remove project-specific terminology, file names, and implementation details.

| Framing | Example |
|---------|---------|
| **Bad** (project-specific) | "Feature spec for `emulate status` did not account for CDP session isolation" |
| **Good** (transferable) | "When specifying features that interact with external systems via session-scoped protocols, include ACs for state persistence across invocations" |

### Step 4: Aggregate Cross-Cutting Patterns

After analyzing all defects individually, review the full set of per-defect learnings:

1. **Group learnings** that share a root pattern type into a single cross-cutting learning — grouping requires a shared root *pattern type* (e.g., "missing ACs for protocol statefulness"), not just a shared category
2. **Merge grouped learnings** into one consolidated learning that captures the common principle
3. **List all contributing defect specs** as evidence for each aggregated learning (comma-separated paths)
4. **Preserve ungrouped learnings** as-is — not every learning will aggregate

The goal is to surface higher-order patterns. If three defects all stem from missing ACs around session state, the output is one learning about session-state ACs with three evidence references, not three separate learnings.

### Step 5: Classify Learnings

Classify each learning into exactly **one** of three pattern types:

| Pattern Type | Definition | Example |
|-------------|------------|---------|
| **Missing Acceptance Criteria** | The feature spec lacked ACs for the scenario that caused the bug — the gap was a completely absent test case | Feature spec for login had no AC for session timeout expiry |
| **Undertested Boundaries** | The feature spec had related ACs but didn't cover the specific boundary or edge condition | Feature spec tested valid inputs but not empty string or max-length |
| **Domain-Specific Gaps** | The feature spec missed domain knowledge that should have been captured as requirements | Financial feature spec didn't consider rounding rules for currency |

### Step 6: Filter Learnings

**Include** only learnings that would improve `/writing-specs` effectiveness — gaps a better-written feature spec could have prevented.

**Exclude** learnings that fall outside spec-writing scope:

| Exclude Category | Rationale | Example |
|-----------------|-----------|---------|
| Implementation bugs | Code-level errors, not spec gaps | Off-by-one error, wrong variable name |
| Tooling issues | Build/CI/toolchain problems | Webpack config error, dependency conflict |
| Infrastructure failures | Environment/deployment issues | Server timeout, DNS misconfiguration |
| Process failures | Workflow/communication gaps | Missing code review, skipped testing |

**Heuristic**: If the defect could have been prevented by a better-written feature spec (more ACs, tighter boundary definitions, deeper domain analysis), it produces a learning. If not, exclude it.

**Abstraction-level check** — each surviving learning must sit at the right level of generality:

| Level | Indicator | Action |
|-------|-----------|--------|
| **Too specific** | References project domain terms, specific file names, or implementation details | Generalize further — strip domain terms, describe the *category* of interaction |
| **Too generic** | Could apply to any software without narrowing (e.g., "write better ACs") | Add specificity — name the *category* of feature or interaction pattern |
| **Right level** | Describes the category of feature or interaction pattern without naming the specific technology | Keep as-is |

### Step 7: Load Existing Retrospective (If Present)

Read `.claude/steering/retrospective.md` if it exists.

**Incremental update strategy**: Perform a full re-analysis of all current defect specs on every run — do NOT append new learnings to existing content. This ensures:
- New learnings from new defect specs are added
- Still-relevant learnings from existing defect specs are preserved
- Outdated learnings (from deleted or modified defect specs) are removed

The output is always a complete, self-consistent document reflecting the current state of all defect specs.

### Step 8: Write Retrospective Document

Write `.claude/steering/retrospective.md` using [templates/retrospective.md](templates/retrospective.md).

Fill in:
- **Last Updated**: today's date
- **Defect Specs Analyzed**: count of eligible defect specs processed
- **Learnings Generated**: total count of learnings across all three pattern types
- **Table rows**: One row per learning in the appropriate pattern-type section, with columns:
  - **Learning**: Transferable spec-writing pattern (domain-agnostic)
  - **Recommendation**: Actionable guidance for future spec writing
  - **Evidence (defect specs)**: Comma-separated paths to defect spec directories that support this learning (e.g., `.claude/specs/20-bug/, .claude/specs/25-bug/`)

Remove placeholder rows from sections with no learnings — leave only the table header.

### Step 9: Output Summary

```
Retrospective complete.

Defect specs analyzed: [count]
Learnings generated: [count]

  Missing Acceptance Criteria: [count]
  Undertested Boundaries: [count]
  Domain-Specific Gaps: [count]

Written to .claude/steering/retrospective.md

[If `.claude/auto-mode` does NOT exist]: This document will be read by /writing-specs during Phase 1 to improve future spec quality.
[If `.claude/auto-mode` exists]: Done. Awaiting orchestrator.
```

---

## Graceful Handling

| Condition | Behavior |
|-----------|----------|
| No defect specs found | Report "No defect specs with Related Spec links found." — do not create/modify retrospective.md |
| Defect spec missing `Related Spec` field | Skip that defect spec silently (this is expected for defects unrelated to existing features) |
| `Related Spec` link points to nonexistent spec | Warn: "Related Spec link in [defect] points to [path] which does not exist — skipping" |
| All learnings filtered out | Report "N defect specs analyzed, but no spec-quality learnings identified." — do not create/modify retrospective.md |
| `.claude/steering/` directory doesn't exist | Create it before writing retrospective.md |

---

## Integration with SDLC Workflow

```
/creating-issues  →  /writing-specs #N  →  /implementing-specs #N  →  /verifying-specs #N  →  /creating-prs #N
                          ▲                                                                         │
                          │                                                                         ▼
                          └──── reads retrospective.md ◄──── /running-retrospectives ◄──── defect specs
```

The retrospective skill sits outside the main linear pipeline. It is invoked periodically (not per-issue) and feeds learnings back into the spec-writing step.
