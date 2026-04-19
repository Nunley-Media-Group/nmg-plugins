# Design: Creating Issues Skill

**Issues**: #4, #116, #125
**Date**: 2026-04-18
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/draft-issue` skill implements an adaptive interview workflow that gathers feature requirements from the user and produces well-structured GitHub issues. The skill produces issues in one of two templates — a feature/enhancement template or a bug report template — whose output directly feeds `/write-spec` for downstream spec generation.

Issue #116 extends this skill along three orthogonal axes: **(1)** porting the readability treatment from `/write-spec` (Workflow Overview diagram, per-step `### Input/Process/Output` subsections, and a structured inline review summary with a numbered approve/revise menu at the review gate), **(2)** deepening the interview (NFR/edge-case/related-feature probing, adaptive depth driven by investigation signals, and a "playback and confirm" step that forces understanding alignment before any issue body is drafted), and **(3)** removing unattended-mode support from `/draft-issue` so the skill always runs the full interactive workflow. The runner does not currently invoke `/draft-issue` as a callable step, so AC13 is predominantly a defensive/documentation contract — we assert and harden the non-invocation.

Issue #125 extends the skill along two further axes without changing the per-issue Steps 2–9 contract: **(1)** a **multi-issue pipeline** inserted between Step 1 and Step 2 (Step 1b heuristic detection → split-confirm → Step 1d dependency-graph inference → graph-confirm), which turns one invocation into a planned batch of N issues with a confirmed DAG; Steps 2–9 then loop per planned issue; a post-loop autolinking stage wires the DAG via `gh issue edit --add-sub-issue` (with availability probing and body-cross-ref fallback). **(2)** **Claude Design URL ingestion** — the skill accepts an optional URL, fetches and gzip-decodes the archive (reusing Issue #124's helper), parses the README, and makes the content available as shared session context to every per-issue Step 4/5/6 across the batch. Both axes are designed to be **graceful on the single-issue, no-design path**: Step 1b exits quickly with a trail note, no confirm menus fire, and Step 2 runs unchanged.

---

## Architecture

### Component Diagram (Revised for #116)

```
┌──────────────────────────────────────────────────────────────┐
│                   /draft-issue Skill                         │
├──────────────────────────────────────────────────────────────┤
│  Workflow Overview diagram (ASCII) — top-of-file             │
│                                                              │
│  Step 1: Gather Context                                      │
│    Input / Process / Output                                  │
│  Step 2: Classify Issue Type (Feature | Bug)                 │
│    Input / Process / Output                                  │
│  Step 3: Assign Milestone                                    │
│    Input / Process / Output                                  │
│  Step 4: Investigate Codebase (Feature | Bug variants)       │
│    Input / Process / Output  →  investigation signals        │
│  Step 5: Interview User  (NEW: adaptive depth)               │
│    Input / Process / Output                                  │
│    ├── Core interview (3 rounds)                             │
│    └── Extended interview (4 rounds: +NFR/edge/related)      │
│  Step 5b: Automation Eligibility Label                       │
│    Input / Process / Output  (now with downstream rationale) │
│  Step 5c: Playback and Confirm  (NEW)                        │
│    Input / Process / Output / Human Review Gate              │
│  Step 6: Synthesize into Issue Body                          │
│    Input / Process / Output                                  │
│    + Feature-vs-Bug template comparison table                │
│  Step 7: Present Draft for Review  (REVISED)                 │
│    Input / Process / Output / Human Review Gate              │
│    ├── Inline structured summary                             │
│    └── [1] Approve / [2] Revise menu (loop)                  │
│  Step 8: Create the Issue                                    │
│    Input / Process / Output                                  │
│  Step 9: Output                                              │
│    Input / Process / Output                                  │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User invokes /draft-issue [description]
2. Step 1: Skill reads steering docs; captures initial description
3. Step 2: Classify Feature vs Bug via AskUserQuestion
4. Step 3: Assign milestone (always interactive now)
5. Step 4: Investigate codebase; emit signals:
      filesFound, componentsInvolved, descriptionVagueness
6. Step 5: Select core vs extended interview via heuristic;
      log decision to user; ask multi-question rounds
7. Step 5b: Ask automatable-label question with downstream
      explanation (references /write-spec, /write-code, etc.)
8. Step 5c: Play back understanding; require confirmation
      (iterate on correction if user says "not quite")
9. Step 6: Choose template; synthesize issue body
10. Step 7: Render inline review summary + [1]/[2] menu;
      loop through revisions until Approve
11. Step 8: Create labels and the issue via gh issue create
12. Step 9: Output issue URL and next step (/start-issue)
```

### Unattended-Mode Exclusion

Per AC12, `/draft-issue` **actively ignores** `.claude/unattended-mode`:

- The top-level "Unattended Mode" section in SKILL.md is **removed**, not just neutralized.
- Every per-step blockquote of the form `> Unattended-mode: This step is skipped.` is removed.
- The skill does not check for the flag file anywhere — absence of the check is the absence of the behavior.
- The SDLC runner's step list (STEP_KEYS in `scripts/sdlc-runner.mjs`) already excludes `draftIssue`; this spec adds no runner step and explicitly forbids adding one.

This implements the retrospective learning on "features that explicitly exclude integration with a system-wide behavior mode": the exclusion must be active (remove all detection code) rather than passive (only documented in Out of Scope).

**Breaking-change treatment** (FR27 / FR28 / AC18, Risk-4 mitigation): because the removal changes observable behavior for any user who previously relied on `.claude/unattended-mode` in `/draft-issue`, the plugin version is bumped **major** (v5.2.0 → v6.0.0) and the CHANGELOG `[Unreleased]` entry sits under a `### Changed (BREAKING)` subsection. In SKILL.md, where the Unattended Mode section used to live, a **single sign-post sentence** remains so users scrolling for the old behavior are explicitly redirected:

> As of v6.0.0, `/draft-issue` no longer honors `.claude/unattended-mode`. Issue drafting requires interactive input.

In `scripts/sdlc-runner.mjs`, a comment above `STEP_KEYS` captures the same contract for future contributors:

```js
// NOTE: draftIssue is intentionally absent. /draft-issue is interactive-only
// as of plugin v6.0.0 (issue #116). Do not add it here — see
// plugins/nmg-sdlc/skills/draft-issue/SKILL.md for the rationale.
```

---

## Workflow-Step Contracts (Issue #116 additions)

### Step 5 — Adaptive Depth Heuristic (FR15)

**Inputs from Step 4:**

| Signal | Source | Values |
|--------|--------|--------|
| `filesFound` | count of `Grep`/`Glob` hits in Step 4 | integer |
| `componentsInvolved` | count of distinct top-level dirs or skills/modules matched | integer |
| `descriptionVagueness` | ratio of vague tokens (pronouns, "stuff", "things") to total tokens in initial description | float 0–1 |

**Depth selection:**

| Depth | Condition | Rounds |
|-------|-----------|--------|
| Core | `filesFound ≤ 3` **and** `componentsInvolved ≤ 1` **and** `descriptionVagueness < 0.10` | 3 rounds |
| Extended (borderline bias) | `descriptionVagueness ∈ [0.10, 0.15)` **or** (`componentsInvolved == 1` **and** `filesFound > 8`) | 4 rounds |
| Extended | otherwise (multi-component, many files, or vague description) | 4 rounds (adds NFR/edge/related probing) |

The borderline bias row (FR23, Risk-1 mitigation) intentionally pushes ambiguous cases to the deeper interview — the cost of running extended for a small issue is a few extra probes; the cost of running core for an under-specified issue is a downstream spec amendment.

**User-visible log line** (FR15): one short sentence explaining the decision, e.g. `"This touches 4 components across 2 skills — I'll ask deeper scope questions."` or `"Small scoped change — running a core interview."`

**Override step** (FR22 / AC15, Risk-1 mitigation): immediately after the log line, call `AskUserQuestion` with two options — `[1] Use {heuristic_pick} interview (recommended)` / `[2] Use {the_other_depth} interview`. If the user selects `[2]`, emit a one-line session note before the interview begins — e.g., `"(heuristic chose core, user selected extended)"` (FR29, Risk-5 instrumentation). This visible trail accumulates evidence for future threshold tuning.

**End-of-interview "Anything I missed?" probe** (FR24, Risk-1 mitigation): the final round — regardless of depth — ends with a single free-text probe: `"Before I play back my understanding, is there anything I haven't asked that matters here?"`. Non-empty answers are folded into the understanding block.

> The heuristic thresholds are **not configurable** in this iteration; they live inline in the skill markdown. Steering-doc configurability is deferred (see Open Questions in requirements.md).

### Step 5 — Feature Interview Probe Bank (FR12)

Extended-depth rounds (added by #116) group related probes:

| Round | Probes |
|-------|--------|
| R1 (Persona & outcome) | Who benefits? What pain point? What desired outcome? |
| R2 (ACs & scope) | Key acceptance criteria (G/W/T) + in/out-of-scope boundaries |
| R3 (NFRs & edge cases) | Performance / accessibility / security / i18n relevance; edge cases and error states beyond the happy path |
| R4 (Related features & priority) | Existing related features to maintain consistency with; MoSCoW priority |

Core-depth rounds drop R3 and merge R4's priority into R2.

### Step 5 — Bug Interview Probe Bank (FR13)

| Round | Probes |
|-------|--------|
| R1 (Repro) | Exact reproduction steps; expected vs actual |
| R2 (Env & recency) | Environment; frequency; error output; when started |
| R3 (Edge cases & regression risk) | Edge/error states beyond the primary repro; related behavior that must not regress |

Reproduction remains the bug-path primary focus; R3 is the new #116 addition.

### Step 5c — Playback and Confirm (FR14 / FR25 / AC10 / AC16)

**Input:** answers from Step 5 + Step 5b + the "Anything I missed?" probe answer (FR24).

**Process — depth-proportional playback (FR25, Risk-2 mitigation):**

**Core-depth playback (one-line confirm):**
```
Drafting an issue for {persona} that {outcome}.
  In-scope: {bullets joined by commas}
  Out-of-scope: {bullets joined by commas}
```
Followed by `AskUserQuestion` with `[1] Looks right — draft the issue` / `[2] Something's off — let me clarify`.

**Extended-depth playback (full structured block):**
```
Understanding check:
  Persona:   [type]
  Outcome:   [action + benefit]
  ACs:       [numbered one-line outline]
  Scope in:  [bullets]
  Scope out: [bullets]
```
Followed by the same two-option `AskUserQuestion`.

On `[2]` (either variant), ask one free-text clarification, revise the playback, and re-render — always at the same depth-proportional length. Loop until the user selects `[1]`.

**Output:** confirmed understanding that feeds Step 6 synthesis.

### Step 5b — Automation Eligibility Explanation (FR19 / AC14)

The `AskUserQuestion` body must include a 1–2 line prefix such as:

> The `automatable` label tells the downstream SDLC pipeline (`/write-spec`, `/write-code`, `/verify-code`, `/open-pr`) that it can progress this issue without human judgment at the review gates. It does **not** affect `/draft-issue` itself — issue drafting always requires interactive human input.

### Step 7 — Inline Review Summary + Approve/Revise Menu (FR6–FR8 / AC5–AC6)

**Process:**
1. After Step 6 synthesis, render an inline markdown block structured exactly as:
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
2. Call `AskUserQuestion` with exactly two options: `[1] Approve — create the issue` / `[2] Revise — I'll describe what to change`.
3. On `[2]`, ask one free-text follow-up; apply the changes to the draft; re-render summary + menu. Loop until `[1]`.

**Soft guard after three consecutive revises** (FR26 / AC17, Risk-3 mitigation): the skill maintains a counter `consecutiveRevises` that increments on each `[2]` and resets to `0` on each `[1]`. When `consecutiveRevises == 3`, the next review round's menu expands to **three** options:
- `[1] Keep revising — I have more changes`
- `[2] Reset and re-interview — this draft isn't salvageable`
- `[3] Accept as-is — create the issue with the current draft`

If the user selects `[2] Reset`, the skill returns to Step 5 (re-entering the interview with the same classification and milestone already captured); `consecutiveRevises` resets to `0`. If `[3]`, the skill proceeds to Step 8 as if Approve was selected. If `[1]`, the two-option menu returns on the next round and `consecutiveRevises` continues counting.

Revise iterations **replace** the previous draft wholesale (the Open Question on "preserve as diff vs replace" is resolved here to "replace" for simplicity; this can be revisited if users request diff preservation).

### Step 6 — Feature vs Bug Template Comparison Table (FR9 / AC7)

Add a contrast table near the two template blocks:

| Section | Feature Template | Bug Report Template |
|---------|------------------|---------------------|
| Opening | User Story (As a / I want / So that) | Bug Report (1–2 sentence summary) |
| Context | Background + Current State | Root Cause Analysis + User Confirmed flag |
| Reproduction | N/A | Reproduction Steps (numbered) + Environment table |
| Expected vs Actual | N/A | Expected Behavior / Actual Behavior |
| AC count guidance | 3+ (happy path, alternative, error) | 2 (Bug Is Fixed + No Regression) |
| FR priority | MoSCoW (Must/Should/Could) | Typically Must only |
| Out of Scope | Scope boundaries for the feature | Related improvements not part of this fix |

### Document Structure (FR10 / FR11 / AC8)

- SKILL.md opens with a "Workflow Overview" ASCII diagram that names all 9+ steps and marks the human review gates (Step 5c playback, Step 7 approve/revise).
- Every workflow step uses explicit `### Input`, `### Process`, `### Output` subsections. Steps with human checkpoints (5c, 7) also include `### Human Review Gate`.

---

## Multi-Issue Pipeline (Issue #125)

### Revised Workflow Overview

```
┌──────────────────────────────────────────────────────────────┐
│                   /draft-issue Skill                         │
├──────────────────────────────────────────────────────────────┤
│  Step 1:  Gather Context (+ optional Claude Design URL)      │
│  Step 1a: Fetch & Decode Design URL  (#125)                  │
│             → session.designContext | null on failure        │
│  Step 1b: Detect Multi-Issue Prompt  (#125)                  │
│             → singleIssue OR {split:[...], signals, confidence} │
│  Step 1c: Split-Confirm Menu  ◀── Human Review Gate  (#125)  │
│             [1] Approve | [2] Adjust | [3] Collapse          │
│  Step 1d: Infer Dependency DAG + Graph-Confirm  (#125)       │
│             ◀── Human Review Gate                            │
│             [1] Approve | [2] Adjust edges | [3] Flatten     │
│  ────────────── Per-Issue Loop (for each planned issue) ──── │
│  Step 2–9: classify → milestone → investigate → interview →  │
│             playback → synthesize → review → create → output │
│           (sharing only session.productContext +             │
│            session.designContext; all else is per-issue)     │
│  ──────────────────────────────────────────────────────────  │
│  Step 10: Autolink Batch  (#125)                             │
│             Probe gh --add-sub-issue; wire parent/child;     │
│             always write "Depends on" / "Blocks" body lines  │
│  Step 11: Batch Summary  (#125)                              │
│             Created N of M planned issues; degradation notes │
└──────────────────────────────────────────────────────────────┘
```

Single-issue prompts bypass Steps 1c, 1d, and the batch phases: Step 1b's trail note records `"single-issue detected"` and the flow falls straight into Step 2.

### Step 1a — Claude Design URL Fetch & Decode (FR35 / FR36 / AC24 / AC25)

**Trigger:** Step 1's context gathering detects a Claude Design URL — either supplied as part of the CLI argument (pattern match on the claude.ai design URL shape) or elicited via an early free-text prompt. If no URL is supplied, Step 1a is skipped entirely.

**Helper reuse:** Issue #124 introduces the first Claude Design integration in the plugin (for `/onboard-project`). Step 1a **must reuse the same fetch/decode helper** (gzip-aware archive read + README parse) to avoid behavioral drift. If #124 lands a shared module (e.g., `plugins/nmg-sdlc/skills/_shared/claude-design.*` or equivalent), this skill imports and calls it directly; if #124 keeps the helper inline, this issue's implementation extracts the helper into a shared location as a precondition task.

**Process:**

1. Fetch the URL over HTTPS with a bounded timeout (default: 15s).
2. Detect gzip encoding (archives are gzipped, ~119 KB in typical examples) and decode.
3. Parse the contained README into plain text.
4. Cache as `session.designContext = { url, fetchedAt, readme, rawSize }`.

**Failure modes (graceful degradation per AC25):**

| Failure | Handling |
|---------|----------|
| HTTP 4xx/5xx | Log `"Design fetch failed ({status}) — continuing without design context"`; set `session.designContext = null` |
| Timeout | Same log line with `(timeout)`; same null assignment |
| Decode failure (non-gzip, corrupted) | Log with `(decode failed)`; same null assignment |
| Archive missing README | Log with `(no README found)`; same null assignment |

A single `session.designFailureNote` string captures the failure for inclusion in Step 11's batch summary. The session continues to Step 1b unchanged.

### Step 1b — Multi-Issue Detection Heuristic (FR30 / FR37 / AC19 / AC26)

**Input:** initial description string from Step 1; `session.designContext` (unused here but available).

**Signals (all computed from the initial description):**

| Signal | Extraction |
|--------|-----------|
| `conjunctionHits` | Count of occurrences of the set `{"and also", "second thing", "another thing", "in addition", "plus", "separately", "as well as another", "on top of that", "two things", "three things"}` (case-insensitive, word-boundary matched) |
| `bulletListCount` | Count of top-level `- ` / `* ` / numbered `1.` list items in the description |
| `distinctComponents` | Count of distinct top-level component mentions (file paths, skill names, module references) appearing in different sentences |
| `sentenceCount` | Total sentence count (for normalization) |

**Split decision:**

| Confidence | Rule |
|------------|------|
| `high` | `bulletListCount ≥ 2` OR `conjunctionHits ≥ 2` |
| `medium` | `conjunctionHits ≥ 1` AND `distinctComponents ≥ 2` |
| `low` | `distinctComponents ≥ 3` AND `sentenceCount ≥ 4` (borderline — prefer to propose and let user collapse) |
| `single` | otherwise — exit with `"single-issue detected"` trail note |

When a split is proposed, the heuristic also produces **per-ask summaries** by segmenting the description at conjunction markers / list boundaries and generating a one-line summary per segment (LLM-synthesized from the raw text of that segment).

**Trail note (AC26):** emitted as a visible session note regardless of the decision. Examples:

```
Step 1b: single-issue detected — no split proposed.
  Signals: conjunctionHits=0, bulletListCount=0, distinctComponents=1

Step 1b: multi-issue split proposed (confidence: high).
  Signals: conjunctionHits=2, bulletListCount=3, distinctComponents=4
  Proposed: 3 asks
```

**Output:** `session.proposedSplit` (null or `{asks: [{id, summary, sourceText}], signals, confidence}`).

### Step 1c — Split-Confirm Menu (FR31 / AC20)

**Input:** `session.proposedSplit`.

**Render:**

```
Multi-issue detection proposed a split of N asks:

  A1: [one-line summary of ask 1]
  A2: [one-line summary of ask 2]
  A3: [one-line summary of ask 3]

Signals: conjunctionHits=2, bulletListCount=3, distinctComponents=4 (confidence: high)
```

**Menu (`AskUserQuestion`):**

- `[1] Approve the split as proposed` — proceed to Step 1d
- `[2] Adjust the split (merge or re-divide)` — ask one free-text prompt (`"How should the split be adjusted? (e.g., 'merge A1 and A2', 'split A3 into two')"`), apply edits, re-render, re-menu
- `[3] Collapse back to a single issue` — set `session.proposedSplit = null`, proceed to Step 2 with original description (false-positive path)

The menu loops on `[2]` until the user selects `[1]` or `[3]`.

### Step 1d — Dependency Inference + Graph-Confirm (FR32 / AC21)

**Input:** approved `session.proposedSplit.asks`.

**Edge inference rules (applied in order, duplicates suppressed):**

1. **Explicit cues** — if ask text contains `"depends on <reference>"`, `"requires <reference>"`, `"blocked by <reference>"`, `"blocks <reference>"`, add edge accordingly.
2. **Shared component — precursor** — if two asks mention the same top-level component and one ask's summary contains foundational/scaffolding language (`"add"`, `"create"`, `"introduce"`, `"scaffold"`) and the other contains modification language (`"update"`, `"enhance"`, `"extend"`, `"wire"`), the scaffolding ask is the parent.
3. **AC/FR overlap** — if segments describe the same acceptance criterion with differing scope (e.g., one says `"detection"`, another says `"menu confirm detection"`), the narrower ask depends on the broader one.

The graph is normalized to a DAG (cycles broken by dropping the lowest-priority edge with a visible note).

**Render:**

```
Proposed dependency graph:

  A1 ──▶ A2 ──▶ A3
  A1 ──▶ A4

(A1 is the root; A3 and A4 are leaves.)
```

**Menu (`AskUserQuestion`):**

- `[1] Approve the graph` — proceed to the per-issue loop
- `[2] Adjust edges` — free-text prompt (`"Describe the edge to add or remove, e.g., 'A2 depends on A4' or 'remove A1 → A3'"`); apply; re-render; re-menu
- `[3] Flatten — no dependencies` — clear all edges; proceed

**Output:** `session.dag` (ordered list of `{parent, child}` pairs; empty on flatten).

### Per-Issue Loop (FR33 / AC22)

**Iteration boundary:** each planned issue runs the existing Steps 2–9 **in full** with its own `DraftState` (classification, milestone, investigation, interview answers, depth, understanding, draft, review loop).

**Shared across iterations (read-only):**

- `session.productContext` — loaded in Step 1
- `session.designContext` — loaded in Step 1a (null if absent or failed)
- `session.dag` — parent/child edges for post-loop autolinking

**Loop ordering:** issues are created in **topological order** by the DAG so parents exist before children's `--add-sub-issue` calls fire. (Flat DAGs preserve the order from `session.proposedSplit.asks`.)

**Iteration output:** each iteration appends to `session.createdIssues = [{planId, issueNumber, url, labels, dependsOn, blocks}]`. The `dependsOn` and `blocks` fields are computed from `session.dag` and injected into the issue body during Step 6 synthesis of that issue.

**Abandonment (AC27):** at any Step 7 review gate, the user may select a new review-menu option `[Abandon the batch]` (added only when `session.createdIssues.length < session.proposedSplit.asks.length`). Selecting it jumps to Step 11 with the current `session.createdIssues`; no rollback runs.

### Step 10 — Autolink Batch (FR34 / FR39 / AC23 / AC28)

**Input:** `session.createdIssues`, `session.dag`.

**Process:**

1. **Probe once per batch:** run `gh issue edit --help 2>&1` and look for `--add-sub-issue` in the output. Cache the result as `session.subIssueSupported`.
2. **Wire edges (if supported):** for each `{parent, child}` in `session.dag` where both have been created, run:
   ```bash
   gh issue edit <child.number> --add-sub-issue <parent.number>
   ```
   Failures are logged but do not abort the batch; they add entries to `session.autolinkDegradationNotes`.
3. **Body cross-refs (always):** Step 6 synthesis injected `"Depends on: #X, #Y"` and `"Blocks: #Z"` lines into each issue body **regardless** of `session.subIssueSupported`. If later edits are needed (because issue numbers weren't known at synthesis time), run:
   ```bash
   gh issue edit <issue.number> --body-file <updated-body>
   ```
   with the resolved neighbor numbers.

> **Implementation note:** Because neighbor issue numbers are unknown at Step 6 synthesis time for the first issue(s) in the loop, the body cross-refs are written as placeholders (`Depends on: <A1>`) in Step 6 and **resolved to real numbers** in Step 10 via a body rewrite. This is the simplest approach that keeps the per-issue Steps 2–9 contract intact.

### Step 11 — Batch Summary (FR38 / AC27)

**Render:**

```
Batch complete: Created N of M planned issues

  #<num1> — <title1>  (url)
  #<num2> — <title2>  (url)
  ...
  [Abandoned]: <remaining asks not drafted>

Autolinking:
  - Sub-issues wired: <count> / <total DAG edges>
  - Body cross-refs written: yes (unconditionally)
  [If degraded]: Sub-issue linking unavailable in this gh version — body cross-refs only.

[If design fetch failed]: Design fetch failed — issues drafted without design context.

Next step: /start-issue #<first-issue-number>
```

Single-issue flows fall through Step 11 with `M=1, N=1` and no autolinking block.

### Integration with Shared Session Context (FR35 / AC24)

The **per-issue loop** reads `session.designContext` at three points:

| Step | Use |
|------|-----|
| Step 4 (Investigation) | Design README is read alongside product/tech steering docs; relevant sections inform the "Current State" summary |
| Step 5 (Interview) | Interview probes may reference specific design components or flows as pre-known context, avoiding the need to re-elicit them from the user |
| Step 6 (Synthesis) | Issue body "Background" or "Current State" section cites the design URL when applicable |

The `session.designContext` is **read-only** — iterations cannot mutate it. This prevents cross-iteration coupling beyond the declared shared surface.

---

## API / Interface Changes

### Internal skill interfaces (no external API changes)

| Interface | Change | Purpose |
|-----------|--------|---------|
| Step 4 → Step 5 handoff | Emit investigation signals (`filesFound`, `componentsInvolved`, `descriptionVagueness`) as inline notes consumed by Step 5 depth heuristic | Enables adaptive depth (FR15) |
| Step 5 → Step 5c handoff | Structured understanding block (persona/outcome/AC outline/scope) | Enables playback (FR14) |
| Step 7 review loop | Replaces open-ended question with summary + 2-option menu | Readability parity with /write-spec (FR6–FR8) |

### External (gh CLI) — unchanged

`gh issue create` invocation contract is unchanged by #116.

### External (gh CLI) — additions (#125)

| Call | Purpose |
|------|---------|
| `gh issue edit --help` | Capability probe for `--add-sub-issue` support; run once per batch (FR39) |
| `gh issue edit <child> --add-sub-issue <parent>` | Wire parent/child link in the GitHub sub-issue hierarchy (FR34, AC23) |
| `gh issue edit <issue> --body-file <path>` | Rewrite issue bodies in Step 10 to resolve `Depends on: <placeholder>` → real `#N` references |

### External (HTTPS) — additions (#125)

| Call | Purpose |
|------|---------|
| `GET <claude-design-url>` (gzip-aware) | Fetch the design archive. 15s default timeout. Reuses the fetch/decode helper introduced by Issue #124 (shared helper path TBD when #124 lands; if unshared, this issue extracts it first) |

---

## Database / Storage Changes

None. The skill is prompt-only; there is no persisted state beyond the created GitHub issue.

---

## State Management

The skill's state lives in the Claude session. Issue #125 introduces a `SessionState` that wraps **zero-or-more** `DraftState` instances plus batch-level fields:

```
SessionState {                      // #125 — new outer scope
  initialDescription: string
  designUrl: string | null          // #125
  designContext: {                  // #125
    url, fetchedAt, readme, rawSize
  } | null
  designFailureNote: string | null  // #125 — captured for Step 11

  productContext: object            // loaded in Step 1

  proposedSplit: {                  // #125 — null on single-issue path
    asks: [{ id, summary, sourceText }]
    signals: { conjunctionHits, bulletListCount, distinctComponents, sentenceCount }
    confidence: 'high' | 'medium' | 'low'
  } | null

  dag: [{ parent: askId, child: askId }]   // #125 — empty on flatten or single-issue

  subIssueSupported: boolean | null // #125 — cached probe result
  autolinkDegradationNotes: string[] // #125

  createdIssues: [{                 // #125 — populated by the loop
    planId: askId
    issueNumber: int
    url: string
    labels: string[]
    dependsOn: int[]
    blocks: int[]
  }]

  abandoned: boolean                // #125 — true if user selected [Abandon]
}

DraftState {                        // #125 — one per planned issue in the loop
  planId: askId                     // links back to session.proposedSplit
  description: string               // derived: the per-ask summary + sourceText
  classification: 'feature' | 'bug'
  milestone: string | null
  investigation: {
    filesFound: number
    componentsInvolved: number
    descriptionVagueness: number
    summary: string
  }
  depth: 'core' | 'extended'
  depthOverridden: boolean
  anythingMissed: string | null
  interviewAnswers: map<round, text>
  automatable: boolean
  understanding: {
    persona, outcome, acOutline, scopeIn, scopeOut
  }
  understandingConfirmed: boolean
  draft: string                     // may contain "Depends on: <askId>" placeholders
  consecutiveRevises: int
  approved: boolean
}
```

On the single-issue path `session.proposedSplit === null`, `session.dag === []`, and exactly one `DraftState` runs against the session context before Step 11 renders a trivial summary.

### State Transitions

```
Session:
  initialDescription + designUrl?
    → [1a] designContext  (may be null on failure)
    → [1b] proposedSplit  (may be null on single-issue)
    → [1c] confirmed split  (or collapsed to single-issue)
    → [1d] dag  (may be empty on flatten or single-issue)
    → for each planned issue in topological order:
          DraftState transitions (as below)
          → session.createdIssues += { ... }
    → [10] autolink (probe → wire edges → rewrite bodies for cross-refs)
    → [11] batch summary

Per-issue (DraftState):
  description → classification → milestone → investigation
    → depth=(heuristic) → depthOverridden?
    → interviewAnswers → automatable → anythingMissed
    → understanding → (depth-proportional playback) → understandingConfirmed
    → draft → (review summary loop, tracking consecutiveRevises)
            → approved (via [1] or [3])
            | [Abandon] → session.abandoned = true → skip to Step 11
    → gh issue create → done
```

The Step 5c playback gate blocks progression to Step 6 (draft synthesis) until `understandingConfirmed = true`. The Step 7 review gate blocks Step 8 until `approved = true`. The `consecutiveRevises` counter resets whenever the user selects Approve, Reset, or Accept-as-is; it increments only on `[2] Revise`. The **Step 1c and Step 1d gates** (FR31 / FR32) additionally block any drafting until the split and DAG are confirmed; they do not fire on the single-issue path.

---

## UI Components

Not applicable — this is a Markdown skill that drives the Claude Code CLI. UI changes are to the textual review summary and `AskUserQuestion` layouts described in Workflow-Step Contracts above.

---

## File Changes (Issue #116)

| File | Type | Purpose |
|------|------|---------|
| `plugins/nmg-sdlc/skills/draft-issue/SKILL.md` | Modify | Add Workflow Overview diagram; restructure every step with Input/Process/Output; add Step 5c playback; rewrite Step 7 as inline summary + numbered menu; add feature-vs-bug comparison table; add adaptive-depth heuristic + logging; enrich Step 5b explanation; remove "Unattended Mode" section and all per-step unattended-mode blockquotes |
| `scripts/sdlc-runner.mjs` | Verify (no change) | Confirm `STEP_KEYS` does not include `draftIssue` and no code path invokes the skill; add a code-level comment reinforcing that `/draft-issue` is interactive-only and must not be added to STEP_KEYS |
| `scripts/sdlc-config.example.json` | Verify (no change) | Confirm `steps` object has no `draftIssue` key; add a `_draft_issue_note` comment-style key documenting that `/draft-issue` is interactive-only |
| `scripts/__tests__/sdlc-runner.test.mjs` | Modify | Add a regression test asserting `STEP_KEYS` does not contain `draftIssue` |
| `README.md` | Modify | Describe new Step 7 UX (inline summary + approve/revise); note `/draft-issue` is interactive-only; remove any language that implies automation |
| `plugins/nmg-sdlc/.claude-plugin/plugin.json` | Modify | Bump version |
| `.claude-plugin/marketplace.json` | Modify | Bump matching plugin entry version |
| `CHANGELOG.md` | Modify | Add `[Unreleased]` entries describing the readability treatment, deeper interview, and unattended-mode removal from `/draft-issue` |

## File Changes (Issue #125)

| File | Type | Purpose |
|------|------|---------|
| `plugins/nmg-sdlc/skills/draft-issue/SKILL.md` | Modify | Expand the Workflow Overview diagram with Step 1a/1b/1c/1d + Step 10/11; add Step 1a (design fetch/decode), Step 1b (multi-issue detection heuristic with signals table + trail note format), Step 1c (split-confirm menu), Step 1d (dependency inference rules + graph-confirm menu), per-issue loop section wrapping Steps 2–9 with SessionState + DraftState descriptions, Step 10 (autolink batch: probe → wire → body rewrite), Step 11 (batch summary). Retain all existing Step 2–9 contracts. Introduce the `[Abandon]` review-gate option. |
| `plugins/nmg-sdlc/skills/draft-issue/SKILL.md` | Modify | Update frontmatter `argument-hint` to mention optional Claude Design URL |
| `plugins/nmg-sdlc/skills/_shared/claude-design.*` (or similar) | Reference/Extract | Reuse Issue #124's fetch/gzip-decode/README-parse helper. If #124 landed it inline, extract to a shared location as a precondition task for #125; otherwise import directly. Final path coordinated with #124. |
| `specs/feature-draft-issue-skill/feature.gherkin` | Modify | Add #125 scenarios covering AC19–AC28 |
| `README.md` | Modify | Document multi-issue detection with split/graph confirm gates, autolinking behavior, Claude Design URL ingestion, and partial-batch summary behavior |
| `CHANGELOG.md` | Modify | Add `[Unreleased]` entry describing the multi-issue, dependency, autolinking, and Claude Design additions under the appropriate subsection |
| `plugins/nmg-sdlc/.claude-plugin/plugin.json` | Modify | Minor version bump (7.2.0 → 7.3.0) — additive enhancement, no breaking changes |
| `.claude-plugin/marketplace.json` | Modify | Match version bump in the plugin entry |

---

## Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| Free-form issue creation | No template, user writes freely | **Rejected** — inconsistent format (original) |
| Form-based template | Fixed-field GitHub issue template | **Rejected** — too rigid, loses conversational context (original) |
| Adaptive interview | Guided conversation with template output | **Selected** — balances structure with flexibility (original) |
| Keep unattended-mode support with stricter defaults | Preserve the feature but force human confirm at key moments | **Rejected** — issue drafting is intrinsically a judgment activity; a degraded unattended path adds surface area without clear users (#116) |
| Configurable adaptive-depth thresholds via steering docs | Let projects tune file-count/component-count thresholds | **Rejected for this iteration** — premature configurability; hardcoded thresholds are sufficient until we have evidence of mismatch (#116) |
| Preserve previous draft as diff in revise loop | Show the user what changed between iterations | **Rejected for this iteration** — wholesale replacement is simpler to implement and reason about (#116) |
| Single universal interview path regardless of depth | Always run the extended interview | **Rejected** — adds friction for trivial issues and contradicts retrospective learning on not interrogating users about small changes (#116) |
| Auto-terminate revise loop after N iterations | Kill the loop when `consecutiveRevises` crosses a threshold | **Rejected** — auto-termination overrides user agency. Soft guard that expands options is preferable (#116 Risk-3 mitigation) |
| Minor-version bump for unattended-mode removal | Ship as v5.3.0 since runner wasn't using it anyway | **Rejected** — removal of documented behavior is a breaking change regardless of usage. Semver discipline outweighs observed-usage heuristics (#116 Risk-4 mitigation) |
| Uniform full-block playback at all depths | Always show the 5-line structured playback | **Rejected** — playback friction should scale with interview depth, which itself scales with issue complexity (#116 Risk-2 mitigation) |
| Auto-split without user confirm (#125) | Skip Step 1c and drop straight into drafting N issues | **Rejected** — false positives are inevitable for a heuristic; a collapse-back path (Step 1c `[3]`) is cheap insurance against wrong splits silently creating extra issues |
| Implicit dependency ordering without Step 1d graph-confirm (#125) | Infer a DAG and use it without user visibility | **Rejected** — dependency structure determines topological order, sub-issue wiring, and body cross-refs; surfacing it catches misinference before multiple issues are created in the wrong order |
| Eagerly write body cross-refs without placeholders (#125) | Wait to draft each issue until all neighbor numbers are known | **Rejected** — would require either pre-creating empty issues or restructuring the Step 6 synthesis contract; placeholder-then-rewrite in Step 10 is simpler and preserves the per-issue Steps 2–9 contract |
| Abort on design-fetch failure (#125) | Fail fast when the Claude Design URL is unreachable | **Rejected** — design context is supplementary; the batch still has value without it. Graceful degradation preserves the user's work (FR36) |
| Share `DraftState` fields across the loop (#125) | Reuse classification, milestone, etc. across planned issues | **Rejected** — each planned issue may legitimately differ (one a feature, one a bug; different milestones). Only `productContext` + `designContext` + `dag` cross the iteration boundary (FR33) |
| Auto-rollback on partial-batch abandonment (#125) | Delete already-created issues when the user abandons mid-loop | **Rejected** — created issues have independent value; deleting them destroys user work. Preservation + accurate summary is the correct default (FR38) |
| Require `gh --add-sub-issue` as a hard prerequisite (#125) | Block the skill if the flag isn't available in the installed `gh` version | **Rejected** — body cross-refs alone provide readable dependency tracking; hard-blocking penalizes users on older `gh` releases. Probe + graceful fallback (FR39) is the right tradeoff |

---

## Security Considerations

- [x] Issues created via authenticated `gh` CLI (unchanged)
- [x] No sensitive data included in issue templates (unchanged)
- [x] Interview content stays within the Claude session (unchanged)
- [x] Removal of unattended-mode code paths reduces attack surface: the skill no longer reads or acts on `.claude/unattended-mode`, eliminating any path where environmental state could alter issue-drafting behavior (#116)
- [x] Claude Design URL is fetched over HTTPS only; the URL pattern is validated against the claude.ai shape before fetch; fetched archive is parsed in-memory and not persisted to disk; decoded content is read-only (#125)
- [x] `gh` commands in Step 10 use issue numbers (integers) or explicit file paths — no user-derived strings are interpolated unquoted into shell commands (#125)
- [x] Placeholder resolution in body cross-refs replaces only tokens of the form `<askId>` with matching integer issue numbers — no arbitrary string substitution (#125)

---

## Performance Considerations

- [x] Review summary rendering is bounded by AC/FR count; no performance concern
- [x] Adaptive-depth heuristic is O(1) over already-computed investigation signals
- [x] Revise loop is bounded by user interaction; no auto-retries
- [x] Playback step adds one additional round trip but saves downstream amendment cost (empirically observed from #116 motivation)
- [x] Step 1b heuristic runs once over the initial description; signal extraction is O(n) in description length and has no effect on single-issue throughput beyond a brief trail note (#125)
- [x] Claude Design fetch is bounded by a 15s timeout and runs at most once per session (#125)
- [x] Sub-issue availability probe runs at most once per batch — result is cached for the Step 10 wire-edges phase (#125)
- [x] Per-issue loop overhead is O(M) GitHub API calls for creation + O(|edges|) for sub-issue wiring + O(M) for body rewrites — well within interactive-session tolerances (#125)

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Skill behavior (Feature path, core depth) | BDD exercise | Scenario for trivial feature: core interview runs, playback confirms, inline summary renders |
| Skill behavior (Feature path, extended depth) | BDD exercise | Scenario for multi-component feature: extended interview runs with NFR/edge/related rounds |
| Skill behavior (Bug path) | BDD exercise | Scenario for bug: reproduction + edge-case probing + playback + review |
| Revise loop | BDD exercise | Scenario: user selects [2] Revise, provides change, summary re-renders, [1] Approve completes |
| Unattended-mode ignored | BDD exercise | Scenario: `.claude/unattended-mode` is present, yet skill still runs the full interactive workflow |
| Runner non-invocation | Jest unit | `STEP_KEYS` asserts `draftIssue` is absent |
| Template output | Manual | Verify issue body matches feature vs bug templates unchanged |
| Multi-issue detection (#125) | BDD exercise | Scenarios: single-issue path exits Step 1b quickly; high-confidence prompt produces a split with signal trail note |
| Split-confirm collapse (#125) | BDD exercise | Scenario: user selects `[3] Collapse`, skill proceeds to Step 2 with original description unchanged |
| Dependency graph confirm (#125) | BDD exercise | Scenario: DAG is rendered; user selects `[3] Flatten`; autolink step writes only body cross-refs |
| Per-issue loop + autolinking (#125) | BDD exercise (dry-run) | Scenario: batch of 2 issues with parent/child edge produces two `gh issue create` calls in topological order and one `gh issue edit --add-sub-issue` call; body cross-refs use real issue numbers |
| `gh --add-sub-issue` unavailable (#125) | BDD exercise | Scenario: probe returns no support; Step 10 skips sub-issue calls; body cross-refs still written; summary notes degradation |
| Claude Design fetch success (#125) | BDD exercise | Scenario: URL supplied; archive fetched and decoded; `session.designContext` available in per-issue Step 4/5/6 |
| Claude Design fetch failure (#125) | BDD exercise | Scenario: URL times out; session continues; summary notes design-fetch failure |
| Partial-batch abandonment (#125) | BDD exercise | Scenario: after 1 of 3 issues created, user selects `[Abandon]` at Step 7; remaining 2 are skipped; summary reports "Created 1 of 3 planned issues" with URL for the created one |

---

## Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | Adaptive-depth heuristic misclassifies (runs core when extended needed) | Medium→Low | Med→Low | **(a)** Borderline-signal bias pushes ambiguous cases to extended (FR23). **(b)** Explicit user override via `AskUserQuestion` after the depth log (FR22 / AC15). **(c)** End-of-interview "Anything I missed?" probe catches gaps before playback (FR24). Combined: user has two explicit redirection points plus a conservative default. |
| 2 | Playback step is perceived as friction for trivial issues | Medium→Low | Low | Core-depth playback collapses to a one-line confirm (FR25 / AC16); extended-depth keeps the full 5-line block. Friction scales with stakes. |
| 3 | Revise loop never terminates (user keeps picking [2]) | Low | Low | Soft guard on the 4th iteration expands the menu to include `Reset and re-interview` / `Accept as-is` (FR26 / AC17). User remains in control; no auto-termination. |
| 4 | Removing unattended-mode breaks a headless user | Low | Med→Low | **(a)** Classified as BREAKING — major version bump v5.2.0 → v6.0.0 (FR27). **(b)** In-file sign-post sentence in SKILL.md redirects users scrolling for old behavior (FR28 / AC18). **(c)** `STEP_KEYS` comment in sdlc-runner.mjs prevents re-introduction. |
| 5 | Users override the depth decision (heuristic wrong) | Medium | Low | Override is now an explicit step (FR22). When the user overrides, a one-line session note captures it (FR29, Risk-5 instrumentation) so dogfooding accumulates evidence for future threshold tuning. Override is a feature, not a failure mode. |
| 6 | Step 1b heuristic misclassifies single-issue prompts as multi-issue (false positive) | Medium | Low | **(a)** `[3] Collapse` always present in Step 1c returns the flow to Step 2 unchanged (FR31). **(b)** Heuristic trail note exposes the signals so the user can judge. **(c)** Confidence indicator (`high`/`medium`/`low`) sets user expectation. Cost of a false positive is one extra menu selection, not wasted drafting work. |
| 7 | Step 1b misses multi-issue prompts (false negative) | Medium | Medium | User can always re-invoke `/draft-issue` for subsequent asks — existing single-issue behavior is the baseline, not a regression. Signal counts logged even on the single-issue path (FR37) provide feedback for future threshold tuning. |
| 8 | Dependency graph inference produces cycles or wrong edges | Medium | Medium | **(a)** DAG normalization drops the lowest-priority edge with a visible note on cycle detection. **(b)** Graph-confirm menu (FR32) is the hard gate — user must approve, adjust, or flatten before drafting. **(c)** `[3] Flatten` guarantees a safe fallback for any user who does not trust the inference. |
| 9 | Autolinking silently fails for some edges | Low | Low | Per-edge failures are logged to `session.autolinkDegradationNotes` and surfaced in Step 11. Body cross-refs (FR34) are always written, so dependency information is never fully lost even if every sub-issue call fails. |
| 10 | Claude Design fetch stalls the batch | Low | Med | 15s bounded timeout (design.md Step 1a). On timeout, null `designContext` + visible session note + summary entry — the batch continues without design context (FR36 / AC25). |
| 11 | Claude Design URL leaks sensitive content into issue bodies | Low | Med | Designs are user-supplied and already public on claude.ai; content flows through the LLM synthesis step where issue bodies are already reviewed at the Step 7 gate before `gh issue create` runs. No automatic full-dump of design content into issues. |
| 12 | Partial-batch leaves orphan placeholder body cross-refs (e.g., "Depends on: &lt;A3&gt;" when A3 was never created) | Medium | Low | Step 10 resolves placeholders to `#N` only for created issues; unresolved placeholders are replaced with a plain-text note like `"(planned but not created)"`. Body remains readable and the summary makes the abandonment explicit. |
| 13 | Helper drift between #124 and #125 Claude Design integrations | Medium | Low | FR35 + File Changes table mandate reuse of the #124 helper. If #124 ships the helper inline, a preconditional extraction task for #125 moves it to a shared location. A regression test asserts both skills import from the same module. |

---

## Open Questions

- [ ] Should the depth log be suppressible via a steering-doc setting for users who find it noisy? (Deferred — ship visible log first, measure feedback.)
- [ ] Should the review summary include the full issue body inline for cases where the summary loses nuance? (Deferred — start with summary-only, reassess after dogfooding.)

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #4 | 2026-02-15 | Initial feature spec |
| #116 | 2026-04-17 | Readability treatment (Workflow Overview diagram, per-step Input/Process/Output, inline review summary with [1]/[2] menu). Deeper interview (NFR/edge/related probing, adaptive depth heuristic with user-visible log, Step 5c Playback and Confirm gate, Step 5b downstream explanation). Unattended-mode actively removed from the skill; runner non-invocation hardened with a regression test. Risk-mitigation controls added: depth override step with borderline-signal bias (AC15), depth-proportional playback (AC16), soft guard on revise loop with Reset/Accept-as-is options (AC17), major-version bump with in-file sign-post and STEP_KEYS comment (AC18). |
| #125 | 2026-04-18 | Multi-issue pipeline (Step 1a design fetch, Step 1b detection heuristic, Step 1c split-confirm, Step 1d dependency-graph inference + confirm), per-issue loop over existing Steps 2–9 with shared productContext/designContext/dag, Step 10 autolinking (`gh --add-sub-issue` probe with body-cross-ref fallback), Step 11 batch summary with partial-batch preservation. SessionState wrapper introduced around DraftState. Minor version bump (7.2.0 → 7.3.0). Risks 6–13 added covering false positives/negatives, graph misinference, autolink failures, design fetch stalls, placeholder orphans, and helper drift with #124. |

---

## Validation Checklist

- [x] Architecture follows existing skill patterns (parity with `/write-spec` structure)
- [x] File changes documented with per-file rationale
- [x] Security considerations addressed (reduced attack surface from unattended-mode removal)
- [x] Alternatives considered and decisions recorded
- [x] Retrospective learning applied (active-ignore for excluded mode signals — AC12 defensive contract)
- [x] Adaptive-depth heuristic thresholds specified in a table
- [x] Review-gate loop semantics defined (wholesale replacement, no iteration limit)
