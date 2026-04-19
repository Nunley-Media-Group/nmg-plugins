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

> As of v6.0.0, `/draft-issue` no longer honors `.claude/unattended-mode`. Issue drafting requires interactive input.

## Workflow Overview

```
┌──────────────────────────────────────────────────────────────┐
│                   /draft-issue Skill                         │
├──────────────────────────────────────────────────────────────┤
│  Step 1:  Gather Context (+ optional Claude Design URL)      │
│  Step 1a: Fetch & Decode Design URL                          │
│             → session.designContext | null on failure        │
│  Step 1b: Detect Multi-Issue Prompt                          │
│             → singleIssue OR {split, signals, confidence}    │
│  Step 1c: Split-Confirm Menu  ◀── Human Review Gate          │
│             [1] Approve | [2] Adjust | [3] Collapse          │
│  Step 1d: Infer Dependency DAG + Graph-Confirm               │
│             ◀── Human Review Gate                            │
│             [1] Approve | [2] Adjust edges | [3] Flatten     │
│  ────────── Per-Issue Loop (for each planned issue) ──────── │
│  Step 2: Classify Issue Type (Feature | Bug)                 │
│  Step 3: Assign Milestone                                    │
│  Step 4: Investigate Codebase  →  investigation signals      │
│  Step 5: Interview the User (adaptive depth)                 │
│    ├── Core interview (3 rounds)                             │
│    └── Extended interview (4 rounds: +NFR/edge/related)      │
│  Step 5b: Automation Eligibility Label                       │
│  Step 5c: Playback and Confirm  ◀── Human Review Gate        │
│  Step 6: Synthesize into Issue Body                          │
│  Step 7: Present Draft for Review  ◀── Human Review Gate     │
│    ├── Inline structured summary                             │
│    ├── [1] Approve / [2] Revise menu (loop)                  │
│    └── [Abandon] (batch mode only)                           │
│  Step 8: Create the Issue                                    │
│  Step 9: Output                                              │
│  ──────────────────────────────────────────────────────────  │
│  Step 10: Autolink Batch                                     │
│             Probe gh --add-sub-issue; wire parent/child;     │
│             always write "Depends on" / "Blocks" body lines  │
│  Step 11: Batch Summary                                      │
│             Created N of M planned issues; degradation notes │
└──────────────────────────────────────────────────────────────┘
```

Single-issue prompts bypass Steps 1c, 1d, and the batch phases: Step 1b emits a `"single-issue detected"` trail note and the flow falls straight into Step 2 with a single `DraftState`. Step 11 renders a trivial summary (M=1, N=1) with no autolinking block.

## Workflow

### Step 0: Legacy-Layout Precondition

Before Step 1, run `Glob` for `.claude/steering/*.md` and `.claude/specs/*/requirements.md`. If either returns a match, abort and print:

```
ERROR: This project uses the legacy `.claude/steering/` and/or `.claude/specs/` directory layout, which current Claude Code releases refuse to write to. Run `/upgrade-project` first, then re-run `/draft-issue`.
```

The gate fires in both interactive and unattended mode — do not silently draft an issue against a mixed layout.

### Step 1: Gather Context

#### Input

- Optional CLI argument (e.g., `/draft-issue "add dark mode"`)
- Optional Claude Design URL (recognized by the `claude.ai` design URL shape anywhere in the argument)
- `steering/product.md` (if it exists)

#### Process

1. If an argument was provided, use it as the starting description. Otherwise, ask the user what they need.
2. **Detect a Claude Design URL** in the argument. If none is present, ask the user once (a short free-text prompt: `"Supply an optional Claude Design URL? (press Enter to skip)"`). Store the URL as `session.designUrl` (may be null).
3. Read `steering/product.md` to understand:
   - Product vision and mission
   - Target users and personas
   - Feature prioritization (MoSCoW)
   - Existing user journeys

#### Output

- `session.initialDescription` — the starting description string
- `session.designUrl` — URL or null
- `session.productContext` — product vision, personas, priorities (shared across batch iterations)

---

### Step 1a: Fetch & Decode the Claude Design URL

#### Input

- `session.designUrl` from Step 1

#### Process

If `session.designUrl` is null, skip this step entirely. Otherwise, fetch and decode the archive using the same procedure documented in `/onboard-project` §2G.1 (reuse to avoid drift):

1. **Validate URL is HTTPS.** If not, log `"Design URL rejected (non-HTTPS)"`, set `session.designContext = null`, set `session.designFailureNote = "non-HTTPS URL"`, and continue.
2. **Fetch** via `WebFetch` with a 15s default timeout.
3. **Decode**: if the response indicates gzip (content-type `application/gzip` / `application/x-gzip` OR magic bytes `1f 8b` at offset 0), decode via:
   ```
   Bash(node -e "process.stdout.write(require('node:zlib').gunzipSync(Buffer.from(process.argv[1],'base64')).toString())" "<base64>")
   ```
   Pass the payload as a base64 argument — never interpolate raw payload bytes into a shell command.
4. **Parse**: locate `README.md` or `README` at the archive root. Archive entry filenames are validated against `[A-Za-z0-9._/-]`; any `..` path component aborts the parse.
5. **Cache**: `session.designContext = { url, fetchedAt, readme, rawSize }`.

##### Failure modes (graceful degradation)

| Failure | Handling |
|---------|----------|
| HTTP 4xx/5xx | Log `"Design fetch failed ({status}) — continuing without design context"`; set `session.designContext = null` |
| Timeout | Same log line with `(timeout)`; same null assignment |
| Decode failure (non-gzip, corrupted) | Same log line with `(decode failed)`; same null assignment |
| Archive missing README | Same log line with `(no README found)`; same null assignment |

Any failure sets `session.designFailureNote` (captured for Step 11). The session continues to Step 1b unchanged — a design-fetch failure must NOT abort the batch.

#### Output

- `session.designContext` — `{ url, fetchedAt, readme, rawSize }` or `null`
- `session.designFailureNote` — single-line failure description or `null`

---

### Step 1b: Detect Multi-Issue Prompt

#### Input

- `session.initialDescription` from Step 1

#### Process

Run a heuristic over the initial description to decide whether the user asked for one issue or several. Signals (all computed from the initial description):

| Signal | Extraction |
|--------|-----------|
| `conjunctionHits` | Count of occurrences of `{"and also", "second thing", "another thing", "in addition", "plus", "separately", "as well as another", "on top of that", "two things", "three things"}` (case-insensitive, word-boundary matched) |
| `bulletListCount` | Count of top-level `- ` / `* ` / numbered `1.` list items |
| `distinctComponents` | Count of distinct top-level component mentions (file paths, skill names, module references) appearing in different sentences |
| `sentenceCount` | Total sentence count |

##### Split decision

| Confidence | Rule |
|------------|------|
| `high` | `bulletListCount ≥ 2` OR `conjunctionHits ≥ 2` |
| `medium` | `conjunctionHits ≥ 1` AND `distinctComponents ≥ 2` |
| `low` | `distinctComponents ≥ 3` AND `sentenceCount ≥ 4` (borderline — prefer to propose and let the user collapse) |
| `single` | otherwise — exit with `"single-issue detected"` trail note |

When a split is proposed, segment the description at conjunction markers / list boundaries and generate a one-line summary per segment. Assign each segment an `id` (`A1`, `A2`, ...).

##### Trail note (always emitted)

Emit a visible session note regardless of the decision. Examples:

```
Step 1b: single-issue detected — no split proposed.
  Signals: conjunctionHits=0, bulletListCount=0, distinctComponents=1 (confidence: single)

Step 1b: multi-issue split proposed (confidence: high).
  Signals: conjunctionHits=2, bulletListCount=3, distinctComponents=4
  Proposed: 3 asks
```

#### Output

- `session.proposedSplit` — `{asks: [{id, summary, sourceText}], signals, confidence}` or `null` on the single-issue path

On the single-issue path, skip directly to the Per-Issue Loop (one iteration).

---

### Step 1c: Split-Confirm Menu

Runs only when `session.proposedSplit` is non-null.

#### Input

- `session.proposedSplit` from Step 1b

#### Process

Render an inline summary of the proposed split:

```
Multi-issue detection proposed a split of N asks:

  A1: [one-line summary of ask 1]
  A2: [one-line summary of ask 2]
  A3: [one-line summary of ask 3]

Signals: conjunctionHits=2, bulletListCount=3, distinctComponents=4 (confidence: high)
```

Call `AskUserQuestion`:

```
question: "How would you like to proceed with the proposed split?"
options:
  - "[1] Approve the split as proposed"
  - "[2] Adjust the split (merge or re-divide)"
  - "[3] Collapse back to a single issue"
```

- **`[1] Approve`** — proceed to Step 1d.
- **`[2] Adjust`** — ask one free-text prompt (`"How should the split be adjusted? (e.g., 'merge A1 and A2', 'split A3 into two')"`), apply the edits, re-render the summary, and re-menu. Loop until `[1]` or `[3]`.
- **`[3] Collapse`** — set `session.proposedSplit = null` and proceed to Step 2 with the original single-issue description (false-positive path).

#### Output

- `session.proposedSplit` — confirmed (possibly edited) or null on collapse

#### Human Review Gate

This gate blocks Step 1d until the user approves, adjusts-then-approves, or collapses.

---

### Step 1d: Infer Dependency Graph + Graph-Confirm

Runs only when `session.proposedSplit` is non-null after Step 1c.

#### Input

- `session.proposedSplit.asks`

#### Process

##### Edge inference rules (applied in order; duplicates suppressed)

1. **Explicit cues** — if an ask's text contains `"depends on <reference>"`, `"requires <reference>"`, `"blocked by <reference>"`, or `"blocks <reference>"`, add the corresponding edge.
2. **Shared component — precursor** — if two asks mention the same top-level component and one ask's summary contains foundational language (`"add"`, `"create"`, `"introduce"`, `"scaffold"`) while the other contains modification language (`"update"`, `"enhance"`, `"extend"`, `"wire"`), the scaffolding ask is the parent.
3. **AC/FR overlap** — if segments describe the same acceptance criterion with differing scope (one broader, one narrower), the narrower ask depends on the broader one.

Normalize the result to a DAG. On cycle detection, drop the lowest-priority edge (last rule applied wins tie-breaks) and emit a visible note: `"Graph cycle detected — dropped edge A{X} → A{Y}."`

##### Render

```
Proposed dependency graph:

  A1 ──▶ A2 ──▶ A3
  A1 ──▶ A4

(A1 is the root; A3 and A4 are leaves.)
```

Call `AskUserQuestion`:

```
question: "Approve the proposed dependency graph?"
options:
  - "[1] Approve the graph"
  - "[2] Adjust edges (add/remove a dependency)"
  - "[3] Flatten — no dependencies between issues"
```

- **`[1] Approve`** — proceed to the Per-Issue Loop.
- **`[2] Adjust edges`** — free-text prompt (`"Describe the edge to add or remove, e.g., 'A2 depends on A4' or 'remove A1 → A3'"`); apply; re-render; re-menu.
- **`[3] Flatten`** — clear all edges (`session.dag = []`); proceed.

#### Output

- `session.dag` — ordered list of `{parent: askId, child: askId}` pairs; empty on flatten

#### Human Review Gate

This gate blocks the Per-Issue Loop until the user approves or flattens.

---

### Per-Issue Loop

The confirmed split + DAG drives a loop over Steps 2–9. Each iteration runs the full existing Steps 2–9 contract independently — a preamble note: each step below now runs **per planned issue**.

#### Shared read-only session state

| Field | Source | Consumers |
|-------|--------|-----------|
| `session.productContext` | Step 1 | Step 4 investigation |
| `session.designContext` | Step 1a | Steps 4, 5, 6 |
| `session.dag` | Step 1d | Step 6 (body cross-ref placeholders), Step 10 (autolinking) |

Iterations **must not mutate** these fields. Everything else — classification, milestone, investigation, interview answers, depth, understanding, draft, review counter — lives in a per-iteration `DraftState`.

#### Loop ordering

Issues are created in **topological order** by `session.dag` so that parents exist before children's `gh issue edit --add-sub-issue` calls fire in Step 10. Flat DAGs preserve the order from `session.proposedSplit.asks`.

#### Iteration output

Each successful iteration appends to `session.createdIssues`:

```
session.createdIssues = [
  { planId, issueNumber, url, labels, dependsOn: [askId, ...], blocks: [askId, ...] },
  ...
]
```

`dependsOn` / `blocks` are computed from `session.dag` and passed to Step 6 so it can write placeholder body lines (`Depends on: <A1>`, `Blocks: <A3>`). Step 10 later resolves placeholders to real `#N` references.

#### Single-issue path

When `session.proposedSplit === null`, the loop runs exactly once against the original description and `session.dag === []`. Steps 10 and 11 still run, but Step 10 is a no-op (no edges) and Step 11 renders the trivial summary.

#### State model

```
SessionState {
  initialDescription: string
  designUrl: string | null
  designContext: { url, fetchedAt, readme, rawSize } | null
  designFailureNote: string | null
  productContext: object

  proposedSplit: {
    asks: [{ id, summary, sourceText }]
    signals: { conjunctionHits, bulletListCount, distinctComponents, sentenceCount }
    confidence: 'high' | 'medium' | 'low'
  } | null

  dag: [{ parent: askId, child: askId }]

  subIssueSupported: boolean | null
  autolinkDegradationNotes: string[]

  createdIssues: [{
    planId, issueNumber, url, labels, dependsOn, blocks
  }]

  abandoned: boolean
}

DraftState {
  planId: askId
  description: string  // per-ask summary + sourceText (or original description on single-issue path)
  classification: 'feature' | 'bug'
  milestone: string | null
  investigation: { filesFound, componentsInvolved, descriptionVagueness, summary }
  depth: 'core' | 'extended'
  depthOverridden: boolean
  anythingMissed: string | null
  interviewAnswers: map<round, text>
  automatable: boolean
  understanding: { persona, outcome, acOutline, scopeIn, scopeOut }
  understandingConfirmed: boolean
  draft: string  // may contain "Depends on: <askId>" placeholders
  consecutiveRevises: int
  approved: boolean
}
```

---

### Step 2: Classify Issue Type

#### Input

- Initial description from Step 1

#### Process

Use `AskUserQuestion` to ask the user what type of issue this is. This is always the first question after gathering context.

Options:

- **Bug** — "Something is broken or behaving incorrectly"
- **Enhancement / Feature** — "New capability or improvement to existing behavior"

#### Output

- `classification` ∈ {`feature`, `bug`}

---

### Step 3: Assign Milestone

#### Input

- Project root `VERSION` file (if present)
- GitHub milestones via `gh api`

#### Process

1. **Read the current version**: If a `VERSION` file exists in the project root, read it and verify it contains a valid semver string (X.Y.Z). Extract the major version number (e.g., `2.11.0` → `2`). If no `VERSION` file exists or the content is not valid semver, skip milestone assignment entirely (omit the `--milestone` flag from `gh issue create` in Step 8).
2. **Ask the user** via `AskUserQuestion`:
   ```
   question: "Which milestone should this issue be assigned to?"
   options:
     - "v{major} (current major version)" — e.g., "v2 (current major version)"
     - "v{major+1} (next major version)" — e.g., "v3 (next major version)"
   ```
3. **Ensure the milestone exists**: Run `gh api repos/{owner}/{repo}/milestones --jq '.[].title'`. If the chosen milestone does not exist, create it:
   ```
   gh api repos/{owner}/{repo}/milestones --method POST --field title="v{N}"
   ```
   If creation fails (permission denied, API error), proceed without milestone assignment and note the failure in Step 9 output.

#### Output

- `milestone` — e.g., `"v2"`, or `null` if skipped

---

### Step 4: Investigate Codebase

#### Input

- `classification` from Step 2
- Relevant source, specs, and steering docs
- `session.designContext` (read-only; may be null)

#### Process

Perform a targeted codebase investigation before the interview. The investigation also produces **signals** that Step 5 uses to select interview depth.

When `session.designContext` is present, read its README alongside the steering docs and fold relevant sections into the "Current State" summary (for features) or root-cause framing (for bugs). Cite the design URL inline when a section of the README directly describes the area under investigation. `session.designContext` is read-only — do not mutate it across iterations.

##### If Enhancement / Feature

1. **Explore existing specs**: Use `Glob` for `specs/*/requirements.md` and read any that relate to the area described by the user
2. **Explore source code**: Use `Glob` and `Grep` to find files related to the enhancement area (e.g., the relevant SKILL.md, templates, hooks, or application code)
3. **Read steering docs**: Read `steering/tech.md` and `steering/structure.md` (if they exist) and note any technical or architectural constraints relevant to the enhancement area
4. **Summarize findings**: Produce a "Current State" summary capturing:
   - What exists today (relevant code, patterns, specs)
   - How the current implementation works
   - What patterns should be preserved or built upon
   - Relevant constraints from steering docs

If no relevant code or specs are found, note that this appears to be a greenfield addition and move on.

##### If Bug

1. **Search for related code**: Use `Grep` to find code related to the bug description (error messages, function names, file patterns the user mentioned)
2. **Trace code paths**: `Read` the relevant files and follow the logic through the affected paths
3. **Read steering docs**: Read `steering/tech.md` and `steering/structure.md` (if they exist) and note any constraints relevant to the bug's domain
4. **Form hypothesis**: Formulate a root cause hypothesis describing:
   - What code is involved
   - What the incorrect behavior or assumption is
   - Why it manifests as the reported bug
   - Any steering doc constraints that inform the fix approach
5. **Confirm with user** via `AskUserQuestion`:
   - "Yes, that matches"
   - "Not quite — let me clarify"

   If "not quite", ask a follow-up clarifying question and revise the hypothesis.

If investigation is inconclusive, note what is known and proceed with the user's description alone.

##### Compute Investigation Signals

Before exiting Step 4, capture three numeric signals used by Step 5's adaptive-depth heuristic:

| Signal | Source | Type |
|--------|--------|------|
| `filesFound` | count of `Grep`/`Glob` hits examined | integer |
| `componentsInvolved` | count of distinct top-level dirs or skills/modules matched | integer |
| `descriptionVagueness` | ratio of vague tokens (pronouns, "stuff", "things", "something", "somehow") to total tokens in the initial description | float 0–1 |

#### Output

- `investigation.summary` — Current State (feature) or Root Cause hypothesis (bug)
- `investigation.filesFound`, `investigation.componentsInvolved`, `investigation.descriptionVagueness`

---

### Step 5: Interview the User

#### Input

- `classification` from Step 2
- `investigation.*` signals from Step 4
- Initial description from Step 1
- `session.designContext` (read-only; may be null)

#### Process

##### 5.1 Select Interview Depth (Adaptive-Depth Heuristic)

Compute `depth` from the Step 4 signals:

| Depth | Condition | Rounds |
|-------|-----------|--------|
| Core | `filesFound ≤ 3` **and** `componentsInvolved ≤ 1` **and** `descriptionVagueness < 0.10` | 3 rounds |
| Extended (borderline bias) | `descriptionVagueness ∈ [0.10, 0.15)` **or** (`componentsInvolved == 1` **and** `filesFound > 8`) | 4 rounds |
| Extended | otherwise (multi-component, many files, or vague description) | 4 rounds |

The borderline row intentionally biases ambiguous cases to the deeper interview — running extended for a small issue costs a few extra probes; running core for an under-specified issue costs a downstream spec amendment.

##### 5.2 Log the Depth Decision

Emit a one-sentence user-visible log line explaining the selection, for example:

- Extended: `"This touches 4 components across 2 skills — I'll ask deeper scope questions."`
- Core: `"Small scoped change — running a core interview."`

##### 5.3 Offer Depth Override

Immediately after the log line, call `AskUserQuestion` with two options:

```
question: "Which interview depth would you like to use?"
options:
  - "[1] Use {heuristic_pick} interview (recommended)"
    description: "Keep the heuristic's default for this issue"
  - "[2] Use {other_depth} interview"
    description: "Override the heuristic"
```

If the user selects `[2]`, switch `depth` to the other value and emit a one-line session note before the interview begins — e.g., `"(heuristic chose core, user selected extended)"`. This visible trail lets future threshold tuning build on concrete evidence.

##### 5.4 Run the Probe Rounds

Skip any topics already answered by the initial description, the Step 4 investigation, or `session.designContext`. When `session.designContext` is present, the interview may reference design components or flows as pre-known context rather than re-eliciting them from the user (e.g., `"The design shows the overlay layer toggles from the map-controls panel — is the same trigger acceptable here?"`). Group related questions when natural. Use multi-question `AskUserQuestion` rounds rather than individual questions.

###### If Feature / Enhancement

| Round | Core (3 rounds) | Extended (4 rounds) |
|-------|-----------------|---------------------|
| R1 Persona & outcome | Who benefits? What pain point? What desired outcome? | Same as core |
| R2 ACs, scope, priority | Key ACs in G/W/T format; in-scope / out-of-scope; MoSCoW priority | Key ACs in G/W/T format; in-scope / out-of-scope (priority moves to R4) |
| R3 NFRs & edge cases | *(omitted)* | Performance / accessibility / security / i18n relevance; edge cases and error states beyond the happy path |
| R4 Related features & priority | *(folded into R2)* | Existing related features to maintain consistency with; MoSCoW priority |

###### If Bug

| Round | Probes |
|-------|--------|
| R1 Repro | Exact reproduction steps; expected vs actual |
| R2 Env & recency | Environment (OS, browser, version); frequency; error output; when it started |
| R3 Edge cases & regression risk | Edge/error states beyond the primary repro; related behavior that must not regress |

Reproduction remains the bug-path primary focus. R3 is always asked, regardless of depth — bugs benefit from edge-case probing even when scoped tightly.

##### 5.5 End-of-Interview "Anything I Missed?" Probe

Regardless of classification or depth, the **final** round ends with a single free-text probe:

> "Before I play back my understanding, is there anything I haven't asked that matters here?"

A non-empty answer is folded into the understanding block that feeds Step 5c.

#### Output

- `depth` ∈ {`core`, `extended`}
- `depthOverridden` — true if the user chose the non-recommended option
- `interviewAnswers` — map of round → answers
- `anythingMissed` — free-text answer or `null`

---

### Step 5b: Automation Eligibility

#### Input

- `classification` and interview answers from Step 5

#### Process

Ask whether this issue is suitable for fully automated processing downstream. Use `AskUserQuestion` with a body that explains what "automatable" controls:

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
    description: "An AI agent can handle spec writing, implementation, verification, and PR creation without human intervention"
  - "No — requires human judgment"
    description: "This issue needs human decision-making during implementation (e.g., UX choices, ambiguous requirements, complex trade-offs)"
```

#### Output

- `automatable` ∈ {`true`, `false`}

---

### Step 5c: Playback and Confirm

#### Input

- Interview answers from Step 5 + automatable answer from Step 5b + `anythingMissed` probe

#### Process

Play back a structured understanding block whose length is **proportional to the interview depth**. This matches friction to stakes.

##### Core-depth playback (one-line confirm)

```
Drafting an issue for {persona} that {outcome}.
  In-scope: {bullets joined by commas}
  Out-of-scope: {bullets joined by commas}
```

##### Extended-depth playback (full structured block)

```
Understanding check:
  Persona:   [type]
  Outcome:   [action + benefit]
  ACs:       [numbered one-line outline]
  Scope in:  [bullets]
  Scope out: [bullets]
```

After rendering the playback, call `AskUserQuestion`:

```
question: "Does this match your intent?"
options:
  - "[1] Looks right — draft the issue"
  - "[2] Something's off — let me clarify"
```

If the user selects `[2]`, ask one free-text clarification, revise the understanding, and re-render the playback at the same depth-proportional length. Loop until the user selects `[1]`.

#### Output

- `understanding` — confirmed persona, outcome, AC outline, scope in/out
- `understandingConfirmed` — must be true before Step 6

#### Human Review Gate

This gate blocks Step 6 (synthesis) until the user confirms the playback. The skill does not draft the issue body until `understandingConfirmed = true`.

---

### Step 6: Synthesize into Issue Body

#### Input

- Confirmed `understanding` from Step 5c
- `classification` from Step 2
- `investigation.summary` from Step 4
- `session.designContext` (read-only; may be null)
- Current iteration's `planId` and neighbor `askId`s from `session.dag` (if any)

#### Process

Choose the appropriate template based on `classification`. When `session.designContext` is present, cite the design URL in the Background / Current State section (e.g., `"Design reference: <session.designContext.url>"`) and weave relevant design details into the narrative.

**Body cross-ref placeholders (batch mode).** When `session.dag` has edges touching the current iteration's `planId`, append placeholder lines at the end of the body:

```
Depends on: <A1>, <A2>
Blocks: <A4>
```

The `<askId>` tokens are resolved to real `#N` references in Step 10 once all issues in the batch have been created. On the single-issue path, no placeholder lines are added.

The two templates differ significantly in structure — the reference table below contrasts them:

##### Feature vs Bug Template Comparison

| Section | Feature Template | Bug Report Template |
|---------|------------------|---------------------|
| Opening | User Story (As a / I want / So that) | Bug Report (1–2 sentence summary) |
| Context | Background + Current State | Root Cause Analysis + User Confirmed flag |
| Reproduction | N/A | Reproduction Steps (numbered) + Environment table |
| Expected vs Actual | N/A | Expected Behavior / Actual Behavior |
| AC count guidance | 3+ (happy path, alternative, error) | 2 (Bug Is Fixed + No Regression) |
| FR priority | MoSCoW (Must/Should/Could) | Typically Must only |
| Out of Scope | Scope boundaries for the feature | Related improvements not part of this fix |

##### Feature / Enhancement Template

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

##### Bug Report Template

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

#### Output

- `draft` — fully composed issue body (markdown string)
- `title` — concise, action-oriented issue title starting with a verb

---

### Step 7: Present Draft for Review

#### Input

- `draft` and `title` from Step 6
- Planned labels from Step 8 (pre-computed so the summary can show them)

#### Process

##### 7.1 Render the Inline Review Summary

After Step 6 synthesis, render an inline markdown block structured exactly as:

```
Issue Draft Summary — [title]

User Story: [one-liner]

Acceptance Criteria ([N] total):
  AC1: [Name] — Given [...] When [...] Then [...]
  AC2: ...

Functional Requirements:
  FR1: [req] (Must)
  FR2: [req] (Should)
  ...

Out of Scope: [comma-separated list]
Labels: [applied labels]
```

For bug reports, substitute the User Story line with `Bug Summary: [one-liner]`.

##### 7.2 Present the Review Menu

Call `AskUserQuestion` with two options (or three, when the batch is mid-flight — see 7.6):

```
question: "Approve this draft?"
options:
  - "[1] Approve — create the issue"
  - "[2] Revise — I'll describe what to change"
```

##### 7.3 Handle Revise

On `[2]`, ask one free-text follow-up: `"What would you like to change?"`. Apply the changes to the draft (replacing it wholesale — revise iterations do **not** preserve previous drafts as diffs). Re-render the summary and menu. Loop until `[1]`.

##### 7.4 Track Consecutive Revises (Soft Guard)

Maintain a counter `consecutiveRevises` that:

- Starts at `0`
- Increments on each `[2] Revise` (two-option menu) or `[1] Keep revising` (expanded menu)
- Resets to `0` on any selection that exits or restarts the loop: two-option `[1] Approve`, expanded `[2] Reset and re-interview`, or expanded `[3] Accept as-is`

##### 7.5 Expand the Menu After Three Consecutive Revises

When `consecutiveRevises == 3`, the **next** review round (i.e., the fourth review round) expands its menu to three options:

```
question: "You've revised three times — how would you like to proceed?"
options:
  - "[1] Keep revising — I have more changes"
  - "[2] Reset and re-interview — this draft isn't salvageable"
  - "[3] Accept as-is — create the issue with the current draft"
```

- `[1]` returns to the two-option menu on the next round; `consecutiveRevises` continues incrementing
- `[2]` returns the skill to Step 5 (re-entering the interview with `classification` and `milestone` preserved); `consecutiveRevises` resets to `0`
- `[3]` proceeds to Step 8 as if Approve was selected

The skill does not auto-terminate the loop. The user remains in control.

##### 7.6 Batch-Mode Abandonment

In batch mode (`session.proposedSplit !== null`), when `session.createdIssues.length < session.proposedSplit.asks.length`, every review menu (both the two-option and the expanded three-option variant) gains an additional trailing option:

```
  - "[Abandon] Stop the batch — keep created issues, skip the rest"
```

Selecting `[Abandon]` sets `session.abandoned = true`, skips the remaining iterations, and jumps directly to Step 11. No rollback or deletion of already-created issues is attempted.

#### Output

- `approved` — true after `[1] Approve` or `[3] Accept as-is`
- `session.abandoned` — true if the user selected `[Abandon]`
- Final `draft` and `title`

#### Human Review Gate

This gate blocks Step 8 (issue creation) until `approved = true` or the user abandons the batch.

---

### Step 8: Create the Issue

#### Input

- Approved `draft`, `title`, `labels`, `milestone`, `automatable`

#### Process

1. **Check labels**: Run `gh label list` to see existing labels
2. **Create missing labels** if needed:
   ```
   gh label create "label-name" --description "Description" --color "hex-color"
   ```
3. **Ensure the `automatable` label exists** if Step 5b answered "Yes":
   - Check: `gh label list --search automatable --json name --jq '.[].name'`
   - If not found, create it: `gh label create "automatable" --description "Suitable for automated SDLC processing" --color "0E8A16"`
4. **Determine labels** based on issue type and automation eligibility:
   - Feature → `enhancement`
   - Bug → `bug`
   - If Step 5b answered "Yes" → also include `automatable`
   - Other project-specific labels as appropriate
5. **Create the issue** (include `--milestone` if Step 3 assigned one):
   ```
   gh issue create --title "[concise, action-oriented title]" --body "[issue body]" --label "label1,label2" --milestone "v{N}"
   ```
6. **Verify automatable label** (if intended):
   ```
   gh issue view #N --json labels --jq '.labels[].name'
   ```
   If `automatable` is missing from the output, warn in Step 9 output: "Warning: automatable label was not applied — verify manually."

#### Output

- `issueNumber`, `issueUrl`, `appliedLabels`

---

### Step 9: Output

#### Input

- `issueNumber`, `issueUrl`, `appliedLabels`, and any warnings from Step 8

#### Process

Render the final status block.

#### Output

```
Issue #N created: [title]
URL: [issue URL]
Labels: [labels applied]
[If automatable label verification failed]: Warning: automatable label was not applied — verify manually.
```

In batch mode, the per-iteration Step 9 block is compact (one line per iteration) and the final combined summary is rendered in Step 11. In single-issue mode, Step 9 ends with `"Next step: Run /start-issue #N ..."` and Steps 10/11 render as a trivial summary.

---

### Step 10: Autolink Batch

Runs after the Per-Issue Loop (or immediately after Step 9 on the single-issue path, where it is a no-op).

#### Input

- `session.createdIssues` (from the loop)
- `session.dag` (from Step 1d)

#### Process

##### 10.1 Probe `gh` capability once per batch

Run `gh issue edit --help 2>&1` and look for `--add-sub-issue` in the output. Cache the result as `session.subIssueSupported`. If the probe output cannot be read or the flag is absent, set `session.subIssueSupported = false` and record a single degradation note: `"Sub-issue linking unavailable in this gh version — body cross-refs only"`.

##### 10.2 Wire parent/child edges (only when supported)

For each `{parent, child}` in `session.dag` where both ask IDs have entries in `session.createdIssues`:

```
gh issue edit <child.issueNumber> --add-sub-issue <parent.issueNumber>
```

Per-edge failures are appended to `session.autolinkDegradationNotes` but do NOT abort the batch.

##### 10.3 Resolve body cross-ref placeholders (always)

Every issue body written in Step 6 contains `Depends on: <A1>, <A2>` / `Blocks: <A3>` placeholder lines (when the iteration had DAG neighbors). Step 10 rewrites each affected body by replacing every `<askId>` token with:

- The real `#N` number when a `session.createdIssues` entry exists for that ask ID
- The plain-text marker `(planned but not created)` when the batch was abandoned before the ask was created

Apply the rewrite via:

```
gh issue edit <issue.number> --body-file <updated-body>
```

Body cross-refs are written **unconditionally** — independent of `session.subIssueSupported` and independent of whether any `--add-sub-issue` call succeeded.

#### Output

- `session.subIssueSupported` — boolean
- `session.autolinkDegradationNotes` — list of failure descriptions
- Updated issue bodies with resolved cross-refs

---

### Step 11: Batch Summary

#### Input

- `session.createdIssues`, `session.proposedSplit`, `session.dag`
- `session.abandoned`, `session.designFailureNote`, `session.autolinkDegradationNotes`, `session.subIssueSupported`

#### Process

Render the final summary.

##### Batch mode

```
Batch complete: Created N of M planned issues

  #<num1> — <title1>  (url)
  #<num2> — <title2>  (url)
  ...
  [Abandoned]: <list of asks not drafted, if any>

Autolinking:
  - Sub-issues wired: <count> / <total DAG edges>
  - Body cross-refs written: yes (unconditionally)
  [If degraded]: Sub-issue linking unavailable in this gh version — body cross-refs only.

[If design fetch failed]: Design fetch failed — issues drafted without design context.

Next step: /start-issue #<first-issue-number>
```

##### Single-issue mode

Steps 10 and 11 collapse to the existing `"Issue #N created ... Next step: /start-issue #N"` block from Step 9 (M=1, N=1, no autolinking block). If a design fetch failure was recorded, append the design-failure line.

##### Abandonment

When `session.abandoned === true`, the summary reports the partial counts (`"Created N of M planned issues"` with `N < M`), lists the already-created issues with URLs, and marks the remaining plan entries as `[Abandoned]`. No rollback or deletion runs.

#### Output

- Final rendered summary (user-visible)

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
