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

Then use Grep to identify defect specs by scanning for the `Severity:` field — this field is unique to the defect requirements template and does not appear in feature specs.

### Step 2: Filter to Eligible Defect Specs

Read each candidate defect spec and extract the `Related Spec:` field.

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
4. **Extract a learning**: A concise statement of what the feature spec should have included
5. **Formulate a recommendation**: Actionable guidance for writing future specs (e.g., "When specifying authentication features, include ACs for session timeout and token expiry edge cases")

### Step 4: Classify Learnings

Classify each learning into exactly **one** of three pattern types:

| Pattern Type | Definition | Example |
|-------------|------------|---------|
| **Missing Acceptance Criteria** | The feature spec lacked ACs for the scenario that caused the bug — the gap was a completely absent test case | Feature spec for login had no AC for session timeout expiry |
| **Undertested Boundaries** | The feature spec had related ACs but didn't cover the specific boundary or edge condition | Feature spec tested valid inputs but not empty string or max-length |
| **Domain-Specific Gaps** | The feature spec missed domain knowledge that should have been captured as requirements | Financial feature spec didn't consider rounding rules for currency |

### Step 5: Filter Learnings

**Include** only learnings that would improve `/writing-specs` effectiveness — gaps a better-written feature spec could have prevented.

**Exclude** learnings that fall outside spec-writing scope:

| Exclude Category | Rationale | Example |
|-----------------|-----------|---------|
| Implementation bugs | Code-level errors, not spec gaps | Off-by-one error, wrong variable name |
| Tooling issues | Build/CI/toolchain problems | Webpack config error, dependency conflict |
| Infrastructure failures | Environment/deployment issues | Server timeout, DNS misconfiguration |
| Process failures | Workflow/communication gaps | Missing code review, skipped testing |

**Heuristic**: If the defect could have been prevented by a better-written feature spec (more ACs, tighter boundary definitions, deeper domain analysis), it produces a learning. If not, exclude it.

### Step 6: Load Existing Retrospective (If Present)

Read `.claude/steering/retrospective.md` if it exists.

**Incremental update strategy**: Perform a full re-analysis of all current defect specs on every run — do NOT append new learnings to existing content. This ensures:
- New learnings from new defect specs are added
- Still-relevant learnings from existing defect specs are preserved
- Outdated learnings (from deleted or modified defect specs) are removed

The output is always a complete, self-consistent document reflecting the current state of all defect specs.

### Step 7: Write Retrospective Document

Write `.claude/steering/retrospective.md` using [templates/retrospective.md](templates/retrospective.md).

Fill in:
- **Last Updated**: today's date
- **Defect Specs Analyzed**: count of eligible defect specs processed
- **Learnings Generated**: total count of learnings across all three pattern types
- **Table rows**: One row per learning in the appropriate pattern-type section, with columns:
  - **Learning**: Concise description of the spec gap
  - **Source Defect**: Path to the defect spec directory (e.g., `.claude/specs/20-login-timeout-bug/`)
  - **Related Feature Spec**: Path to the feature spec directory (e.g., `.claude/specs/5-login-feature/`)
  - **Recommendation**: Actionable guidance for future spec writing

Remove placeholder rows from sections with no learnings — leave only the table header.

### Step 8: Output Summary

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
