# Multi-Issue Detection, Split Confirmation, DAG Inference, Per-Issue Loop, Autolinking, Batch Summary, Epic Coordination

**Consumed by**: `draft-issue` Steps 1b, 1c, 1d, Per-Issue Loop, 6 (Epic template), 10, 11.
**Triggering condition**: The initial description shows multi-issue signals (bullets, conjunctions, distinct components) OR the user selects the Epic classification at Step 2.

This reference covers the entire multi-issue pipeline: detecting that one prompt asks for several issues, confirming the proposed split with the user, inferring a dependency graph across the planned asks, looping issue creation with read-only session state, wiring sub-issue links after creation, rendering the final batch summary, and the Epic coordination template used when the user picks the Epic type at Step 2.

## Table of Contents

1. [Step 1b — Detect Multi-Issue Prompt](#step-1b--detect-multi-issue-prompt)
2. [Step 1c — Split-Confirm Menu](#step-1c--split-confirm-menu)
3. [Step 1d — Infer Dependency Graph + Graph-Confirm](#step-1d--infer-dependency-graph--graph-confirm)
4. [Per-Issue Loop](#per-issue-loop)
5. [Epic Coordination Template (Step 6)](#epic-coordination-template-step-6)
6. [Step 10 — Autolink Batch](#step-10--autolink-batch)
7. [Step 11 — Batch Summary](#step-11--batch-summary)

---

## Step 1b — Detect Multi-Issue Prompt

### Input

- `session.initialDescription` from Step 1

### Process

Run a heuristic over the initial description to decide whether the user asked for one issue or several. Signals (all computed from the initial description):

| Signal | Extraction |
|--------|-----------|
| `conjunctionHits` | Count of occurrences of `{"and also", "second thing", "another thing", "in addition", "plus", "separately", "as well as another", "on top of that", "two things", "three things"}` (case-insensitive, word-boundary matched) |
| `bulletListCount` | Count of top-level `- ` / `* ` / numbered `1.` list items |
| `distinctComponents` | Count of distinct top-level component mentions (file paths, skill names, module references) appearing in different sentences |
| `sentenceCount` | Total sentence count |

#### Split decision

| Confidence | Rule |
|------------|------|
| `high` | `bulletListCount ≥ 2` OR `conjunctionHits ≥ 2` |
| `medium` | `conjunctionHits ≥ 1` AND `distinctComponents ≥ 2` |
| `low` | `distinctComponents ≥ 3` AND `sentenceCount ≥ 4` (borderline — prefer to propose and let the user collapse) |
| `single` | otherwise — exit with `"single-issue detected"` trail note |

When a split is proposed, segment the description at conjunction markers / list boundaries and generate a one-line summary per segment. Assign each segment an `id` (`A1`, `A2`, ...).

#### Trail note (always emitted)

Emit a visible session note regardless of the decision. Examples:

```
Step 1b: single-issue detected — no split proposed.
  Signals: conjunctionHits=0, bulletListCount=0, distinctComponents=1 (confidence: single)

Step 1b: multi-issue split proposed (confidence: high).
  Signals: conjunctionHits=2, bulletListCount=3, distinctComponents=4
  Proposed: 3 asks
```

### Output

- `session.proposedSplit` — `{asks: [{id, summary, sourceText}], signals, confidence}` or `null` on the single-issue path

On the single-issue path, skip directly to the Per-Issue Loop (one iteration).

---

## Step 1c — Split-Confirm Menu

Runs only when `session.proposedSplit` is non-null.

### Input

- `session.proposedSplit` from Step 1b

### Process

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

### Output

- `session.proposedSplit` — confirmed (possibly edited) or null on collapse

### Human Review Gate

This gate blocks Step 1d until the user approves, adjusts-then-approves, or collapses.

---

## Step 1d — Infer Dependency Graph + Graph-Confirm

Runs only when `session.proposedSplit` is non-null after Step 1c.

### Input

- `session.proposedSplit.asks`

### Process

#### Edge inference rules (applied in order; duplicates suppressed)

1. **Explicit cues** — if an ask's text contains `"depends on <reference>"`, `"requires <reference>"`, `"blocked by <reference>"`, or `"blocks <reference>"`, add the corresponding edge.
2. **Shared component — precursor** — if two asks mention the same top-level component and one ask's summary contains foundational language (`"add"`, `"create"`, `"introduce"`, `"scaffold"`) while the other contains modification language (`"update"`, `"enhance"`, `"extend"`, `"wire"`), the scaffolding ask is the parent.
3. **AC/FR overlap** — if segments describe the same acceptance criterion with differing scope (one broader, one narrower), the narrower ask depends on the broader one.

Normalize the result to a DAG. On cycle detection, drop the lowest-priority edge (last rule applied wins tie-breaks) and emit a visible note: `"Graph cycle detected — dropped edge A{X} → A{Y}."`

#### Render

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

### Output

- `session.dag` — ordered list of `{parent: askId, child: askId}` pairs; empty on flatten

### Human Review Gate

This gate blocks the Per-Issue Loop until the user approves or flattens.

---

## Per-Issue Loop

The confirmed split + DAG drives a loop over Steps 2–9. Each iteration runs the full existing Steps 2–9 contract independently — a preamble note: each step below now runs **per planned issue**.

### Shared read-only session state

| Field | Source | Consumers |
|-------|--------|-----------|
| `session.productContext` | Step 1 | Step 4 investigation |
| `session.designContext` | Step 1a | Steps 4, 5, 6 |
| `session.dag` | Step 1d | Step 6 (body cross-ref placeholders), Step 10 (autolinking) |

Iterations **must not mutate** these fields. Everything else — classification, milestone, investigation, interview answers, depth, understanding, draft, review counter — lives in a per-iteration `DraftState`.

### Loop ordering

Issues are created in **topological order** by `session.dag` so that parents exist before children's `gh issue edit --add-sub-issue` calls fire in Step 10. Flat DAGs preserve the order from `session.proposedSplit.asks`.

### Iteration output

Each successful iteration appends to `session.createdIssues`:

```
session.createdIssues = [
  { planId, issueNumber, url, labels, dependsOn: [askId, ...], blocks: [askId, ...] },
  ...
]
```

`dependsOn` / `blocks` are computed from `session.dag` and passed to Step 6 so it can write placeholder body lines (`Depends on: <A1>`, `Blocks: <A3>`). Step 10 later resolves placeholders to real `#N` references.

### Single-issue path

When `session.proposedSplit === null`, the loop runs exactly once against the original description and `session.dag === []`. Steps 10 and 11 still run, but Step 10 is a no-op (no edges) and Step 11 renders the trivial summary.

### State model

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
  classification: 'feature' | 'bug' | 'epic'
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

## Epic Coordination Template (Step 6)

When `classification === 'epic'`, synthesize the issue body using this template **only**. An epic is a coordination document — it MUST NOT contain a User Story, Acceptance Criteria, or Functional Requirements. ACs belong to each child issue.

```markdown
## Goal

[1–3 sentences describing what this epic delivers when all children are done.]

## Delivery Phases

| Phase | Child Issue | Depends On | Summary |
|-------|-------------|------------|---------|
| 1 | #{askId-1} | — | [short description] |
| 2 | #{askId-2} | #{askId-1} | [short description] |

## Success Criteria

Each child issue owns its own acceptance criteria — this epic is a coordination document only.

## Child Issues

- [ ] #{askId-1} — [short description]
- [ ] #{askId-2} — [short description]
```

### Template invariants (flagged as skill-quality findings if violated)

- Delivery Phases table columns MUST be exactly `Phase | Child Issue | Depends On | Summary` in that order.
- `#{askId-N}` placeholders are resolved to real issue numbers in Step 10 after children are created. On fresh synthesis, keep the placeholders.
- Every child referenced in Delivery Phases MUST also appear in Child Issues; Step 10 keeps them synchronized.
- The Success Criteria section is a fixed delegation note — do not replace it with per-child criteria.

The child issues themselves (created in Step 10 via the existing Steps 1b–1d batch mechanism) use the Feature or Bug template as usual (see `references/feature-template.md` and `references/bug-template.md`).

---

## Step 10 — Autolink Batch

Runs after the Per-Issue Loop (or immediately after Step 9 on the single-issue path, where it is a no-op).

### Input

- `session.createdIssues` (from the loop)
- `session.dag` (from Step 1d)

### Process

#### 10.1 Probe `gh` capability once per batch

Run `gh issue edit --help 2>&1` and look for `--add-sub-issue` in the output. Cache the result as `session.subIssueSupported`. If the probe output cannot be read or the flag is absent, set `session.subIssueSupported = false` and record a single degradation note: `"Sub-issue linking unavailable in this gh version — body cross-refs only"`.

#### 10.2 Wire parent/child edges (only when supported)

For each `{parent, child}` in `session.dag` where both ask IDs have entries in `session.createdIssues`:

```
gh issue edit <child.issueNumber> --add-sub-issue <parent.issueNumber>
```

Per-edge failures are appended to `session.autolinkDegradationNotes` but do NOT abort the batch.

#### 10.3 Resolve body cross-ref placeholders (always)

Every issue body written in Step 6 contains `Depends on: <A1>, <A2>` / `Blocks: <A3>` placeholder lines (when the iteration had DAG neighbors). Step 10 rewrites each affected body by replacing every `<askId>` token with:

- The real `#N` number when a `session.createdIssues` entry exists for that ask ID
- The plain-text marker `(planned but not created)` when the batch was abandoned before the ask was created

Apply the rewrite via:

```
gh issue edit <issue.number> --body-file <updated-body>
```

Body cross-refs are written **unconditionally** — independent of `session.subIssueSupported` and independent of whether any `--add-sub-issue` call succeeded.

#### 10.4 Epic Child-Creation Flow (epic classification only)

When the current iteration's `classification === 'epic'`, after the epic issue itself is created in Step 8, the skill fans out to create children from the Epic's Delivery Phases table.

1. **Parse Delivery Phases** from the epic body (already synthesized in Step 6). Each row yields a planned child with a short summary and optional sibling prerequisites (the `Depends On` column).
2. **Enter batch mode for the children.** Re-seed `session.proposedSplit` from the Delivery Phases, set each child's draft classification (Feature unless the row summary starts with `bug:`), and re-enter the Per-Issue Loop starting at Step 2 for each planned child.
3. **Child body requirements** (enforced during Step 6 for each child):
   - The body MUST contain a `Depends on: #{epic-number}` line (the epic is the parent of every child).
   - Any intra-epic prerequisite from the Delivery Phases `Depends On` column MUST produce an additional `Depends on: #{sibling-number}` line (resolved via Step 10.3 placeholder rewriting once siblings exist).
4. **Child labels:** apply `enhancement` (NOT `epic`) to every child. If Step 5b flagged the epic as automatable, propagate the `automatable` label to children.
5. **GitHub sub-issue link:** after each child is created, also run `gh issue edit <child> --add-parent <epic>` (gated on `session.subIssueSupported` — the `--add-parent` flag uses the same gh capability as `--add-sub-issue`). Per-edge failures append to `session.autolinkDegradationNotes`.
6. **Update the epic's Child Issues checklist in place.** After all children are created, rewrite the epic's body (`gh issue edit <epic> --body-file <updated>`) to replace `#{askId-N}` placeholders in the Child Issues checklist and Delivery Phases table with the real child issue numbers.

**Unattended-mode rule.** `/draft-issue` as a whole does not honor unattended-mode (the skill header states this). The Epic child-creation flow is therefore always interactive — each child pass through Steps 2–9 may prompt as needed. Nothing about this sub-step introduces a new `AskUserQuestion` call site beyond those already present in the Per-Issue Loop.

### Output

- `session.subIssueSupported` — boolean
- `session.autolinkDegradationNotes` — list of failure descriptions
- Updated issue bodies with resolved cross-refs
- For epics: `session.epicChildIssues` — list of `{number, title}` created as children

---

## Step 11 — Batch Summary

### Input

- `session.createdIssues`, `session.proposedSplit`, `session.dag`
- `session.abandoned`, `session.designFailureNote`, `session.autolinkDegradationNotes`, `session.subIssueSupported`

### Process

Render the final summary.

#### Batch mode

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

#### Single-issue mode

Steps 10 and 11 collapse to the existing `"Issue #N created ... Next step: /start-issue #N"` block from Step 9 (M=1, N=1, no autolinking block). If a design fetch failure was recorded, append the design-failure line.

#### Abandonment

When `session.abandoned === true`, the summary reports the partial counts (`"Created N of M planned issues"` with `N < M`), lists the already-created issues with URLs, and marks the remaining plan entries as `[Abandoned]`. No rollback or deletion runs.

### Output

- Final rendered summary (user-visible)
