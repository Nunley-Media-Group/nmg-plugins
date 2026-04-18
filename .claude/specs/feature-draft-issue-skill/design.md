# Design: Creating Issues Skill

**Issues**: #4, #116
**Date**: 2026-04-17
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/draft-issue` skill implements an adaptive interview workflow that gathers feature requirements from the user and produces well-structured GitHub issues. The skill produces issues in one of two templates — a feature/enhancement template or a bug report template — whose output directly feeds `/write-spec` for downstream spec generation.

Issue #116 extends this skill along three orthogonal axes: **(1)** porting the readability treatment from `/write-spec` (Workflow Overview diagram, per-step `### Input/Process/Output` subsections, and a structured inline review summary with a numbered approve/revise menu at the review gate), **(2)** deepening the interview (NFR/edge-case/related-feature probing, adaptive depth driven by investigation signals, and a "playback and confirm" step that forces understanding alignment before any issue body is drafted), and **(3)** removing unattended-mode support from `/draft-issue` so the skill always runs the full interactive workflow. The runner does not currently invoke `/draft-issue` as a callable step, so AC13 is predominantly a defensive/documentation contract — we assert and harden the non-invocation.

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

## API / Interface Changes

### Internal skill interfaces (no external API changes)

| Interface | Change | Purpose |
|-----------|--------|---------|
| Step 4 → Step 5 handoff | Emit investigation signals (`filesFound`, `componentsInvolved`, `descriptionVagueness`) as inline notes consumed by Step 5 depth heuristic | Enables adaptive depth (FR15) |
| Step 5 → Step 5c handoff | Structured understanding block (persona/outcome/AC outline/scope) | Enables playback (FR14) |
| Step 7 review loop | Replaces open-ended question with summary + 2-option menu | Readability parity with /write-spec (FR6–FR8) |

### External (gh CLI) — unchanged

`gh issue create` invocation contract is unchanged by #116.

---

## Database / Storage Changes

None. The skill is prompt-only; there is no persisted state beyond the created GitHub issue.

---

## State Management

The skill's state lives in the Claude session:

```
DraftState {
  description: string                // initial user argument
  classification: 'feature' | 'bug'
  milestone: string | null           // e.g., "v6", or null if no VERSION
  investigation: {
    filesFound: number
    componentsInvolved: number
    descriptionVagueness: number
    summary: string                  // "Current State" block for features, hypothesis for bugs
  }
  depth: 'core' | 'extended'         // heuristic pick (#116)
  depthOverridden: boolean           // #116: true if user selected the non-recommended option
  anythingMissed: string | null      // #116: answer to end-of-interview probe
  interviewAnswers: map<round, text>
  automatable: boolean
  understanding: {                   // #116
    persona, outcome, acOutline, scopeIn, scopeOut
  }
  understandingConfirmed: boolean    // #116 gate
  draft: string                      // synthesized issue body
  consecutiveRevises: int            // #116 soft-guard counter (Risk-3)
  approved: boolean                  // #116: true after [1] Approve or [3] Accept-as-is
}
```

### State Transitions

```
description → classification → milestone → investigation
  → depth=(heuristic) → depthOverridden?  (FR22 override step)
  → interviewAnswers → automatable → anythingMissed (FR24)
  → understanding → (depth-proportional playback) → understandingConfirmed
  → draft → (review summary loop, tracking consecutiveRevises)
          → approved (via [1] or [3])
  → gh issue create → done
```

The Step 5c playback gate blocks progression to Step 6 (draft synthesis) until `understandingConfirmed = true`. The Step 7 review gate blocks Step 8 until `approved = true`. The `consecutiveRevises` counter resets whenever the user selects Approve, Reset, or Accept-as-is; it increments only on `[2] Revise`.

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

---

## Security Considerations

- [x] Issues created via authenticated `gh` CLI (unchanged)
- [x] No sensitive data included in issue templates (unchanged)
- [x] Interview content stays within the Claude session (unchanged)
- [x] Removal of unattended-mode code paths reduces attack surface: the skill no longer reads or acts on `.claude/unattended-mode`, eliminating any path where environmental state could alter issue-drafting behavior (#116)

---

## Performance Considerations

- [x] Review summary rendering is bounded by AC/FR count; no performance concern
- [x] Adaptive-depth heuristic is O(1) over already-computed investigation signals
- [x] Revise loop is bounded by user interaction; no auto-retries
- [x] Playback step adds one additional round trip but saves downstream amendment cost (empirically observed from #116 motivation)

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

---

## Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | Adaptive-depth heuristic misclassifies (runs core when extended needed) | Medium→Low | Med→Low | **(a)** Borderline-signal bias pushes ambiguous cases to extended (FR23). **(b)** Explicit user override via `AskUserQuestion` after the depth log (FR22 / AC15). **(c)** End-of-interview "Anything I missed?" probe catches gaps before playback (FR24). Combined: user has two explicit redirection points plus a conservative default. |
| 2 | Playback step is perceived as friction for trivial issues | Medium→Low | Low | Core-depth playback collapses to a one-line confirm (FR25 / AC16); extended-depth keeps the full 5-line block. Friction scales with stakes. |
| 3 | Revise loop never terminates (user keeps picking [2]) | Low | Low | Soft guard on the 4th iteration expands the menu to include `Reset and re-interview` / `Accept as-is` (FR26 / AC17). User remains in control; no auto-termination. |
| 4 | Removing unattended-mode breaks a headless user | Low | Med→Low | **(a)** Classified as BREAKING — major version bump v5.2.0 → v6.0.0 (FR27). **(b)** In-file sign-post sentence in SKILL.md redirects users scrolling for old behavior (FR28 / AC18). **(c)** `STEP_KEYS` comment in sdlc-runner.mjs prevents re-introduction. |
| 5 | Users override the depth decision (heuristic wrong) | Medium | Low | Override is now an explicit step (FR22). When the user overrides, a one-line session note captures it (FR29, Risk-5 instrumentation) so dogfooding accumulates evidence for future threshold tuning. Override is a feature, not a failure mode. |

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

---

## Validation Checklist

- [x] Architecture follows existing skill patterns (parity with `/write-spec` structure)
- [x] File changes documented with per-file rationale
- [x] Security considerations addressed (reduced attack surface from unattended-mode removal)
- [x] Alternatives considered and decisions recorded
- [x] Retrospective learning applied (active-ignore for excluded mode signals — AC12 defensive contract)
- [x] Adaptive-depth heuristic thresholds specified in a table
- [x] Review-gate loop semantics defined (wholesale replacement, no iteration limit)
