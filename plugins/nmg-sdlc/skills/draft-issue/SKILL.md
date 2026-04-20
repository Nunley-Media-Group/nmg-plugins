---
name: draft-issue
description: "Interview user about a feature need, create groomed GitHub issue with BDD acceptance criteria. Use when user says 'create issue', 'new feature', 'report a bug', 'log a bug', 'request a feature', 'I need a...', 'file an issue', 'draft an issue', 'how do I create an issue', or 'how to file a feature request'. Do NOT use for writing specs, implementing code, or creating PRs. Supports feature and bug templates with codebase investigation and milestone assignment. First step in the SDLC pipeline — followed by /start-issue."
argument-hint: "[brief description of the need] [optional Claude Design URL]"
allowed-tools: Read, Glob, Grep, Bash(gh:*), WebSearch, WebFetch
model: sonnet
effort: medium
---

# Draft Issue

Interview the user to understand their need, then create a well-groomed GitHub issue with BDD acceptance criteria. The skill adapts its interview depth to issue complexity and plays back its understanding before drafting so the result is aligned with intent before a single byte lands in GitHub.

## Core Principles

| Principle | Description |
|-----------|-------------|
| **Interactive-Only** | Issue drafting is a human-judgment activity — the skill always runs the full interactive workflow |
| **Interview-First** | Gather context before drafting; play back understanding before synthesis |
| **Adaptive Depth** | Scale interview depth to issue complexity; let the user override |
| **Readable Gates** | Review-gate summaries are legible without opening files |
| **BDD-Ready Output** | Every acceptance criterion is written as Given/When/Then |

## When to Use

- Starting new work on a feature, bug fix, or enhancement
- The user has an idea but hasn't formalized it yet
- You need a trackable GitHub issue before writing specs

`/draft-issue` does not honor `.claude/unattended-mode`. Issue drafting requires interactive input.

## Workflow Overview

```
┌──────────────────────────────────────────────────────────────┐
│                   /draft-issue Skill                         │
├──────────────────────────────────────────────────────────────┤
│  Step 1:  Gather Context (+ optional Claude Design URL)      │
│  Step 1a: Fetch & Decode Design URL                          │
│  Step 1b: Detect Multi-Issue Prompt                          │
│  Step 1c: Split-Confirm Menu  ◀── Human Review Gate          │
│  Step 1d: Infer Dependency DAG + Graph-Confirm ◀── Gate      │
│  ────────── Per-Issue Loop (for each planned issue) ──────── │
│  Step 2:  Classify Issue Type (Feature | Bug | Epic)         │
│  Step 3:  Assign Milestone                                   │
│  Step 4:  Investigate Codebase  →  investigation signals     │
│  Step 5:  Interview the User (adaptive depth)                │
│  Step 5b: Automation Eligibility Label                       │
│  Step 5c: Playback and Confirm  ◀── Human Review Gate        │
│  Step 6:  Synthesize into Issue Body                         │
│  Step 7:  Present Draft for Review  ◀── Human Review Gate    │
│  Step 8:  Create the Issue                                   │
│  Step 9:  Output                                             │
│  ──────────────────────────────────────────────────────────  │
│  Step 10: Autolink Batch                                     │
│  Step 11: Batch Summary                                      │
└──────────────────────────────────────────────────────────────┘
```

Single-issue prompts bypass Steps 1c, 1d, and the batch phases — Step 1b emits a `"single-issue detected"` trail note and the flow falls straight into Step 2. Step 11 renders a trivial summary (M=1, N=1) with no autolinking block.

## Workflow

### Step 0: Legacy-Layout Precondition

Read `../../references/legacy-layout-gate.md` when the workflow starts — the gate checks for legacy `.claude/steering/` and `.claude/specs/` trees and aborts with a pointer to `/upgrade-project` before any drafting happens.

### Step 1: Gather Context

**Input**: optional CLI argument; optional Claude Design URL; `steering/product.md` if present.

**Process**:

1. If an argument was provided, use it as the starting description. Otherwise, ask the user what they need.
2. Detect a Claude Design URL in the argument. If none is present, ask once: `"Supply an optional Claude Design URL? (press Enter to skip)"`. Store as `session.designUrl` (may be null).
3. Read `steering/product.md` for product vision, personas, MoSCoW priorities, and existing user journeys.

Read `../../references/steering-schema.md` when you need the roster of steering documents and their read-timing.

**Output**: `session.initialDescription`, `session.designUrl`, `session.productContext`.

### Step 1a: Fetch & Decode the Claude Design URL

Read `references/design-url.md` when `session.designUrl` is non-null. If it is null, skip this step entirely and proceed to Step 1b.

### Step 1b–1d: Detect, Confirm, and Graph a Multi-Issue Prompt

Read `references/multi-issue.md` when the workflow reaches Step 1b — the detector runs for every prompt, single- or multi-issue, and emits a `"single-issue detected"` trail note on the single-issue path before the flow drops directly into Step 2 (one iteration).

### Per-Issue Loop

Read `references/multi-issue.md` when you need the shared read-only `SessionState`, per-iteration `DraftState` schema, topological loop ordering, or the single-issue-path rules — the reference applies on both the single-issue (one iteration) and multi-issue (N iterations) paths. Steps 2–9 below run once per planned issue.

### Step 2: Classify Issue Type

**Input**: initial description from Step 1; multi-phase signals from Step 1b.

**Process**: compute `epicRecommended = true` when ANY fire:

- The description contains "in phases", "multiple PRs", or "multi-PR" (case-insensitive, word-boundary match).
- Step 1b's `distinctComponents >= 4` AND `sentenceCount >= 3`.
- The description contains references to multiple sequential delivery phases (e.g., "first … then … finally …").

Call `AskUserQuestion`:

```
question: "What type of issue is this?"
options:
  - "Bug" — Something is broken or behaving incorrectly
  - "Enhancement / Feature" — New capability or improvement to existing behavior
  - "Epic" — A coordinated set of child issues delivering one logical feature across multiple PRs
```

When `epicRecommended` is true, append `(Recommended)` to the Epic option label.

**Output**: `classification` ∈ {`feature`, `bug`, `epic`}.

### Step 3: Assign Milestone

**Input**: project root `VERSION` file (if present); GitHub milestones via `gh api`.

**Process**:

1. Read the `VERSION` file at the project root. If it exists and parses as semver (`X.Y.Z`), extract the major (`2.11.0` → `2`). Otherwise skip milestone assignment entirely (omit `--milestone` from `gh issue create` in Step 8).
2. Call `AskUserQuestion` with options `"v{major} (current major version)"` and `"v{major+1} (next major version)"`.
3. Ensure the milestone exists: `gh api repos/{owner}/{repo}/milestones --jq '.[].title'`. If the chosen milestone is missing, create it via `gh api repos/{owner}/{repo}/milestones --method POST --field title="v{N}"`. If creation fails (permission denied, API error), proceed without milestone and note the failure in Step 9 output.

Read `../../references/versioning.md` when you need the project's VERSION-file conventions.

**Output**: `milestone` — e.g., `"v2"`, or `null` if skipped.

### Step 4: Investigate Codebase

**Input**: `classification` from Step 2; relevant source, specs, and steering docs; `session.designContext` (read-only).

**Process**: perform a targeted codebase investigation before the interview. When `session.designContext` is present, read its README alongside the steering docs and fold relevant sections into the Current State / root-cause framing — cite the design URL inline when a section directly describes the area under investigation.

**If Enhancement / Feature**: `Glob` for `specs/*/requirements.md` and read related specs; `Glob`/`Grep` source files related to the area; read `steering/tech.md` and `steering/structure.md` if they exist; summarize a **Current State** block covering what exists today, how it works, patterns to preserve, and relevant steering constraints. If no related code or specs are found, note the greenfield addition and move on.

**If Bug**: `Grep` for code related to the bug (error messages, function names, file patterns); `Read` the relevant files and trace logic through affected paths; read `steering/tech.md` and `steering/structure.md` if they exist; form a **root-cause hypothesis** covering the affected code, the incorrect behavior or assumption, why it manifests as the reported bug, and relevant steering constraints. Confirm with the user via `AskUserQuestion` (`"Yes, that matches"` / `"Not quite — let me clarify"`); on "not quite", ask one follow-up and revise. If investigation is inconclusive, note what is known and proceed with the user's description alone.

Read `../../references/steering-schema.md` when you need each steering doc's purpose and read-timing.

Before exiting, capture three signals that Step 5 uses for adaptive depth: `filesFound` (int, count of `Grep`/`Glob` hits examined); `componentsInvolved` (int, count of distinct top-level dirs or skills/modules matched); `descriptionVagueness` (float 0–1, ratio of vague tokens — `"stuff"`, `"things"`, `"something"`, `"somehow"`, pronouns — to total tokens).

**Output**: `investigation.summary` plus the three signals.

### Step 5: Interview the User

Read `references/interview-depth.md` when entering the interview phase — the reference covers the adaptive-depth heuristic, the user-override prompt, the Feature and Bug probe rounds, and the end-of-interview "anything I missed?" probe.

**Output**: `depth`, `depthOverridden`, `interviewAnswers`, `anythingMissed`.

### Step 5b: Automation Eligibility

Call `AskUserQuestion`:

```
question: "Is this issue suitable for hands-off automation?"
body: |
  The `automatable` label tells the downstream SDLC pipeline
  (/write-spec, /write-code, /verify-code, /open-pr) that it can
  progress this issue without human judgment at the review gates.
  It does NOT affect /draft-issue itself — issue drafting always
  requires interactive human input.
options:
  - "Yes — suitable for hands-off automation"
  - "No — requires human judgment"
```

**Output**: `automatable` ∈ {`true`, `false`}.

### Step 5c: Playback and Confirm

Play back a structured understanding block whose length is proportional to `depth` — matching friction to stakes. Core-depth uses a one-line confirm (persona, outcome, in-scope bullets, out-of-scope bullets). Extended-depth uses a structured block with labelled fields — Persona, Outcome, ACs (numbered one-line outline), Scope in, Scope out:

```
Understanding check:
  Persona:   [type]
  Outcome:   [action + benefit]
  ACs:       [numbered one-line outline]
  Scope in:  [bullets]
  Scope out: [bullets]
```

Call `AskUserQuestion`: `"Does this match your intent?"` → `"[1] Looks right — draft the issue"` / `"[2] Something's off — let me clarify"`. On `[2]`, ask one free-text clarification, revise the understanding, re-render at the same depth, and re-menu. Loop until `[1]`.

**Output**: `understanding` (persona, outcome, AC outline, scope in/out); `understandingConfirmed` must be true before Step 6.

**Human Review Gate**: blocks Step 6 until the user confirms the playback.

### Step 6: Synthesize into Issue Body

**Input**: confirmed `understanding`; `classification`; `investigation.summary`; `session.designContext` (read-only); current iteration's `planId` and neighbor `askId`s from `session.dag`.

Choose the template based on `classification`:

Read `references/feature-template.md` when `classification === 'feature'`.
Read `references/bug-template.md` when `classification === 'bug'`.
Read `references/multi-issue.md` when `classification === 'epic'` — the Epic Coordination template lives there alongside the multi-issue pipeline.

When `session.designContext` is present, cite the design URL in the Background / Current State section and weave relevant design details into the narrative. Epics do NOT cite the design URL in the body — the reference belongs on the child feature/bug issues.

**Body cross-ref placeholders (batch mode)**: when `session.dag` has edges touching the current iteration's `planId`, append placeholder lines at the end of the body — `Depends on: <A1>, <A2>` / `Blocks: <A4>`. The `<askId>` tokens are resolved to real `#N` references in Step 10 once all issues in the batch have been created. On the single-issue path, no placeholder lines are added.

**Output**: `draft` (issue body markdown), `title` (concise, action-oriented, starts with a verb).

### Step 7: Present Draft for Review

Render an inline review summary:

```
Issue Draft Summary — [title]

User Story: [one-liner]         ← "Bug Summary: [one-liner]" for bug reports

Acceptance Criteria ([N] total):
  AC1: [Name] — Given [...] When [...] Then [...]
  ...

Functional Requirements:
  FR1: [req] (Must)
  ...

Out of Scope: [comma-separated list]
Labels: [applied labels]
```

Call `AskUserQuestion`:

```
question: "Approve this draft?"
options:
  - "[1] Approve — create the issue"
  - "[2] Revise — I'll describe what to change"
```

On `[2]`, ask one free-text follow-up (`"What would you like to change?"`), apply the changes wholesale (revise iterations do NOT preserve previous drafts as diffs), re-render the summary and menu. Loop until `[1]`.

**Consecutive-revise soft guard**: maintain `consecutiveRevises` starting at `0`. Increment on `[2] Revise` (or `[1] Keep revising` on the expanded menu); reset on any selection that exits or restarts the loop. When `consecutiveRevises == 3`, the next round expands the menu to three options — `"[1] Keep revising"` / `"[2] Reset and re-interview"` / `"[3] Accept as-is"`. `[1]` returns to the two-option menu; `[2]` jumps back to Step 5 with `classification` and `milestone` preserved and resets the counter; `[3]` proceeds to Step 8. The skill does not auto-terminate — the user stays in control.

**Batch-mode abandonment**: when `session.proposedSplit !== null` and `session.createdIssues.length < session.proposedSplit.asks.length`, every review menu gains a trailing `"[Abandon] Stop the batch — keep created issues, skip the rest"`. Selecting `[Abandon]` sets `session.abandoned = true`, skips remaining iterations, and jumps directly to Step 11. No rollback or deletion of already-created issues is attempted.

**Output**: `approved` (true after Approve or Accept as-is); `session.abandoned` (true if user abandoned); final `draft` and `title`.

**Human Review Gate**: blocks Step 8 until `approved = true` or the user abandons the batch.

### Step 8: Create the Issue

1. `gh label list` — enumerate existing labels.
2. Create missing labels via `gh label create "label-name" --description "..." --color "hex"`.
3. If Step 5b answered "Yes", ensure the `automatable` label exists (`gh label list --search automatable --json name --jq '.[].name'`; lazily create with color `0E8A16` if absent).
4. Determine labels by classification:
   - Feature → `enhancement`
   - Bug → `bug`
   - Epic → `epic` + `enhancement` (BOTH; lazily create the `epic` label with color `5319E7` if absent)
   - `automatable` applies to Feature/Bug when Step 5b answered "Yes" — epics do NOT receive `automatable`; children inherit it per iteration.
5. Create the issue (include `--milestone` only when Step 3 assigned one):
   ```
   gh issue create --title "..." --body "..." --label "label1,label2" --milestone "v{N}"
   ```
6. If `automatable` was intended, verify with `gh issue view #N --json labels --jq '.labels[].name'`. If missing, warn in Step 9: `"Warning: automatable label was not applied — verify manually."`

**Output**: `issueNumber`, `issueUrl`, `appliedLabels`.

### Step 9: Output

Render the final status block:

```
Issue #N created: [title]
URL: [issue URL]
Labels: [labels applied]
[If automatable verification failed]: Warning: automatable label was not applied — verify manually.
```

In batch mode, per-iteration Step 9 blocks are compact (one line per iteration) and the combined summary is rendered in Step 11. In single-issue mode, Step 9 ends with `"Next step: Run /start-issue #N …"` and Steps 10/11 render as a trivial summary.

### Step 10: Autolink Batch

Read `references/multi-issue.md` when the Per-Issue Loop has finished — the reference covers the `gh` capability probe, DAG edge wiring, body cross-ref placeholder resolution, and the Epic child-creation flow. On the single-issue path, Step 10 is a no-op (no edges).

### Step 11: Batch Summary

Read `references/multi-issue.md` when rendering the final batch summary. On the single-issue path, Step 11 collapses to the `"Issue #N created ... Next step: /start-issue #N"` block emitted by Step 9 (M=1, N=1, no autolinking block); if a design fetch failure was recorded, append the design-failure line.

## Guidelines

- **Title**: Concise, action-oriented, starts with a verb (e.g., "Add precipitation overlay to map")
- **Acceptance criteria**: Always in Given/When/Then format — these become Gherkin tests later
- **Scope**: Be explicit about what's out of scope to prevent creep
- **Priority**: Use MoSCoW (Must/Should/Could/Won't) for requirements
- **No implementation details**: The issue describes *what*, not *how*

## Integration with SDLC Workflow

```
/draft-issue  →  /start-issue #N  →  /write-spec #N  →  /write-code #N  →  /simplify  →  /verify-code #N  →  /open-pr #N
     ▲ You are here
```
