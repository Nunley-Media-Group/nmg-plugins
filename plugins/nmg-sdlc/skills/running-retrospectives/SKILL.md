---
name: running-retrospectives
description: "Analyze defect specs to identify spec-writing gaps and produce actionable learnings. Use when user says 'run retrospective', 'analyze defects', 'review past bugs', 'what can we learn from bugs', or 'update retrospective'. Produces .claude/steering/retrospective.md that /writing-specs reads to avoid repeating past failures."
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(gh:*), Bash(shasum:*), Bash(sha256sum:*)
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

Then Read the **first line** of each file and collect those whose heading starts with `# Defect Report:`. This reliably distinguishes defect specs from feature specs (which start with `# Requirements:`) without depending on Grep glob parameter interpretation.

### Step 1.5: Load State and Compute Hashes

Read `.claude/steering/retrospective-state.json` if it exists. This state file tracks which defect specs have been previously analyzed and their content hashes, enabling incremental runs that skip unchanged specs.

**State file schema:**

```json
{
  "version": 1,
  "specs": {
    ".claude/specs/20-fix-example/requirements.md": {
      "hash": "a1b2c3d4e5f6...",
      "lastAnalyzed": "2026-02-22"
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `version` | integer | Schema version (must be `1`). |
| `specs` | object | Map of spec file paths to metadata. Keys are relative paths from project root. |
| `specs[path].hash` | string | SHA-256 hex digest of the spec file's content at time of last analysis. |
| `specs[path].lastAnalyzed` | string | ISO 8601 date (YYYY-MM-DD) when the spec was last analyzed. |

**Loading the state file:**

1. If the file does not exist → treat as empty state (first run — all specs are "new")
2. If the file exists but contains malformed JSON → warn: "State file contains invalid JSON — falling back to full re-analysis" and treat as empty state
3. If the file exists but `version` is not `1` → warn: "State file has unrecognized version [N] — falling back to full re-analysis" and treat as empty state

**Computing content hashes:**

For each defect spec found in Step 1, compute a SHA-256 hash of its `requirements.md` file using Bash:

```bash
shasum -a 256 .claude/specs/{defect}/requirements.md
```

Use the hex digest portion of the output (first 64 characters). If `shasum` is not available, fall back to `sha256sum`:

```bash
sha256sum .claude/specs/{defect}/requirements.md
```

**Partitioning specs:**

Compare each computed hash against the loaded state file entries:

- **New**: spec path not in state file
- **Modified**: spec path in state file but hash differs
- **Unchanged**: spec path in state file and hash matches
- **Deleted**: path in state file but spec no longer exists on disk

Report the partition counts:

```
Found [N] defect specs: [new] new, [modified] modified, [unchanged] unchanged, [deleted] removed
```

### Step 2: Filter to Eligible Defect Specs and Resolve Feature Spec Links

**Scope**: Apply eligibility filtering and chain resolution only to **new and modified** specs from Step 1.5. Unchanged specs are already known-eligible from their prior successful analysis. Deleted specs are removed from consideration entirely.

Read each new/modified candidate defect spec and extract the `**Related Spec**:` field (bold-formatted in the defect template).

- **Skip** defect specs that do not have a `Related Spec` field — there is no feature spec to correlate against
- **Warn** if a `Related Spec` link points to a nonexistent spec directory — log a warning and skip that defect

**Chain resolution:** After extracting the `Related Spec` path from a defect spec, Read the target's `requirements.md` first heading:

- If the target starts with `# Requirements:` — it is a feature spec. Use it directly.
- If the target starts with `# Defect Report:` — it is another defect spec. Follow **its** `Related Spec` link recursively.
- Maintain a **visited set** of paths to detect cycles. If a path is visited twice, the chain is circular.
- If the chain is circular or reaches a dead end (missing `Related Spec`, nonexistent directory) → warn: "Related Spec chain from [defect] is circular or broken — skipping" and exclude the defect from analysis.
- Replace the raw `Related Spec` value with the **resolved feature spec path** for use in Step 3.

After filtering and chain resolution, if **zero eligible new/modified defect specs** remain **and** there are **no unchanged specs** with carried-forward learnings:

```
No defect specs with Related Spec links found. No retrospective generated.
```

Stop here — do not create or modify `retrospective.md`.

If zero new/modified specs are eligible but unchanged specs exist with carried-forward learnings, proceed to Step 3.5 to carry forward existing learnings (skip Step 3).

### Step 3: Analyze Each Eligible Defect

**Scope**: Analyze only **new and modified** eligible specs from Step 2. Unchanged specs are skipped entirely — their learnings are carried forward in Step 3.5.

Report progress before starting analysis:

```
Analyzing [N] specs, skipping [M] unchanged
```

For each new/modified defect spec with a resolved feature spec from Step 2:

1. **Read the defect spec** (`requirements.md`) — extract reproduction steps, acceptance criteria, severity, and root cause context
2. **Read the resolved feature spec** (the `requirements.md` at the path resolved through chain resolution in Step 2) — extract the original acceptance criteria, functional requirements, and scope
3. **Compare**: What did the feature spec cover? What scenario caused the defect? What was the gap?
4. **Identify the transferable spec-writing pattern** — strip project-specific details and frame as a principle applicable to any domain
5. **Formulate a recommendation**: Actionable guidance for writing future specs

**Generalization guidance**: Each learning must be a forward-looking principle, not a backward-looking description of what one spec missed. Remove project-specific terminology, file names, and implementation details.

| Framing | Example |
|---------|---------|
| **Bad** (project-specific) | "Feature spec for `emulate status` did not account for CDP session isolation" |
| **Good** (transferable) | "When specifying features that interact with external systems via session-scoped protocols, include ACs for state persistence across invocations" |

### Step 3.5: Load Existing Retrospective and Extract Carried-Forward Learnings

Read `.claude/steering/retrospective.md` if it exists.

**Carry-forward strategy**: Rather than re-analyzing every spec, extract learnings from the existing `retrospective.md` that can be carried forward unchanged. This avoids redundant LLM analysis for specs that haven't changed.

**Extracting learnings from the existing retrospective:**

1. Parse the three pattern-type sections by heading: "Missing Acceptance Criteria", "Undertested Boundaries", "Domain-Specific Gaps"
2. For each section, read the markdown table rows (skip the header row and separator row)
3. For each learning row, extract:
   - **Learning** text (column 1)
   - **Recommendation** text (column 2)
   - **Evidence paths** (column 3 — split on `,` and trim whitespace to get individual spec directory paths)

**Carry-forward decision per learning:**

- **Carry forward** the learning if **ALL** of its evidence spec paths correspond to specs in the "unchanged" set from Step 1.5
- **Do NOT carry forward** the learning if **ANY** of its evidence spec paths correspond to specs in the "new", "modified", or "deleted" sets — those learnings will be re-derived from fresh analysis
- If the existing `retrospective.md` does not exist (first run), there are no carried-forward learnings

The carried-forward learnings join the freshly analyzed learnings from Step 3 as input to Step 4.

### Step 4: Aggregate Cross-Cutting Patterns

The input to this step is the **combined set** of:
- **Fresh learnings** from Step 3 (newly analyzed new/modified specs)
- **Carried-forward learnings** from Step 3.5 (extracted from existing `retrospective.md` for unchanged specs)

Review the full combined set of learnings:

1. **Group learnings** that share a root pattern type into a single cross-cutting learning — grouping requires a shared root *pattern type* (e.g., "missing ACs for protocol statefulness"), not just a shared category
2. **Merge grouped learnings** into one consolidated learning that captures the common principle
3. **List all contributing defect specs** as evidence for each aggregated learning (comma-separated paths)
4. **Preserve ungrouped learnings** as-is — not every learning will aggregate

The goal is to surface higher-order patterns. If three defects all stem from missing ACs around session state, the output is one learning about session-state ACs with three evidence references, not three separate learnings. A carried-forward learning may be merged with a fresh learning if they share a root pattern type — the merged result replaces both.

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

### Step 7: Write Retrospective Document

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

### Step 8: Write State File

Write `.claude/steering/retrospective-state.json` to persist the current analysis state for the next run.

**Building the state object:**

1. For each **new or modified** spec that was analyzed: record the computed SHA-256 hash from Step 1.5 and today's date as `lastAnalyzed`
2. For each **unchanged** spec: preserve the existing `hash` and `lastAnalyzed` date from the loaded state file
3. **Omit deleted specs** — they are no longer in the current defect spec set
4. Set `version` to `1`

Write the state file as formatted JSON with 2-space indentation using the Write tool. Ensure the `.claude/steering/` directory exists before writing (create it if needed, same as Step 7).

### Step 9: Output Summary

```
Retrospective complete.

Defect specs: [total] total ([new] new, [modified] modified, [unchanged] skipped, [deleted] removed)
Learnings generated: [total] ([new_count] new, [carried_count] carried forward)

  Missing Acceptance Criteria: [count]
  Undertested Boundaries: [count]
  Domain-Specific Gaps: [count]

Written to .claude/steering/retrospective.md
State saved to .claude/steering/retrospective-state.json

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
| `Related Spec` points to another defect spec | Follow chain to root feature spec; if circular or dead end, warn and skip |
| All learnings filtered out | Report "N defect specs analyzed, but no spec-quality learnings identified." — do not create/modify retrospective.md |
| `.claude/steering/` directory doesn't exist | Create it before writing retrospective.md |
| State file missing (first run) | Treat all defect specs as "new" — full analysis, state file created on completion |
| State file contains malformed JSON | Warn: "State file contains invalid JSON — falling back to full re-analysis" — treat as first run |
| State file has unrecognized `version` | Warn: "State file has unrecognized version [N] — falling back to full re-analysis" — treat as first run |
| Deleted spec in state file | Remove entry from state file; remove learnings sourced solely from the deleted spec |

---

## Integration with SDLC Workflow

```
/creating-issues  →  /writing-specs #N  →  /implementing-specs #N  →  /verifying-specs #N  →  /creating-prs #N
                          ▲                                                                         │
                          │                                                                         ▼
                          └──── reads retrospective.md ◄──── /running-retrospectives ◄──── defect specs
```

The retrospective skill sits outside the main linear pipeline. It is invoked periodically (not per-issue) and feeds learnings back into the spec-writing step.
