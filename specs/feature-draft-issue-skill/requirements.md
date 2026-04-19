# Requirements: Creating Issues Skill

**Issues**: #4, #116, #125
**Date**: 2026-04-18
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As a** developer or product owner,
**I want** a guided interview process that produces well-groomed GitHub issues with BDD acceptance criteria,
**So that** every feature request is captured in a structured, spec-ready format before development begins.

---

## Background

The `/draft-issue` skill conducts an adaptive interview to understand a feature need, then creates a GitHub issue with a standardized body: User Story, Background, Given/When/Then acceptance criteria, Functional Requirements table, and Out of Scope section. This format directly feeds the downstream `/write-spec` skill, ensuring specs are grounded in well-defined requirements.

Issue #116 extends this skill along two axes: (1) bringing its review-gate UX to parity with the readability treatment applied to `/write-spec` (structured inline summaries + numbered approve/revise menus), and (2) deepening the interview itself (NFR/edge-case/related-feature probing, an understanding-playback step before drafting, and adaptive depth driven by investigation signals). Issue #116 also removes unattended-mode support from `/draft-issue` — issue drafting is treated as an intrinsically interactive human-judgment activity.

Issue #125 generalizes `/draft-issue` from a one-issue-per-invocation skill into a **batch-capable** one that can detect multi-part asks in the initial prompt, propose a split with per-ask summaries, infer a dependency DAG between the detected asks, loop through the existing Steps 2–9 per issue, and autolink the created issues via GitHub sub-issues and body cross-refs. Issue #125 also adds **Claude Design URL ingestion** as a shared session-scoped context source: when the user supplies a design URL at the start of the run, the archive is fetched, gzip-decoded, and the README is parsed and made available to every per-issue interview, investigation, and synthesis. All new behavior is gated behind explicit user confirmation (split-confirm and graph-confirm menus) so single-issue prompts remain unaffected and false-positive splits remain recoverable.

---

## Acceptance Criteria

### AC1: Interactive Interview Gathers Requirements

**Given** I invoke `/draft-issue` without unattended mode
**When** the skill starts
**Then** it asks adaptive questions about the feature need, skipping topics I've already addressed

### AC2: Issue Body Follows BDD Template

**Given** the interview is complete
**When** the GitHub issue is created
**Then** the body contains User Story, Background, Given/When/Then acceptance criteria, Functional Requirements, and Out of Scope sections

### AC3: Bug Report Uses Defect Template

**Given** I'm creating an issue for a bug
**When** I indicate it's a defect
**Then** the issue uses the bug report template with reproduction steps, expected/actual behavior, and environment table

### AC4: Unattended Mode Skips Interview (Superseded by AC12)

**Given** unattended mode is active (`.claude/unattended-mode` exists)
**When** I invoke `/draft-issue` with a feature description argument
**Then** the skill skips the interview and infers 3-5 acceptance criteria from steering docs

> **Superseded by AC12 (issue #116):** `/draft-issue` no longer supports unattended mode. The skill always runs the interactive workflow regardless of the `.claude/unattended-mode` flag. AC4 is retained for history.

### AC5: Inline Review Summary Replaces Open-Ended Step 7 Prompts

**Given** the interview is complete and the skill has drafted an issue body
**When** the skill reaches the Present Draft for Review step
**Then** the skill renders an inline structured summary (Title, User Story one-liner, AC count with one-line Given/When/Then per AC, FRs with MoSCoW priorities, Out of Scope, and applied Labels) **and** presents an `AskUserQuestion` numbered menu with exactly two options: `[1] Approve — create the issue` and `[2] Revise — I'll describe what to change`

### AC6: Revise Path Loops Until Approval

**Given** the review summary is shown
**When** I select `[2] Revise`
**Then** the skill asks a single free-text follow-up ("What would you like to change?"), applies the changes to the draft, and re-renders the summary + menu — repeating until I select `[1] Approve`

### AC7: Tables Contrast Feature vs Bug Templates

**Given** I'm scanning SKILL.md
**When** I reach the template section
**Then** a reference table contrasts the Feature and Bug templates on key sections (User Story vs Bug Report summary, Current State vs Root Cause Analysis, AC count guidance, Environment table presence) matching the style of the feature-vs-defect tables in `/write-spec`

### AC8: Steps Restructured with Input / Process / Output Subsections

**Given** I open SKILL.md
**When** I view each workflow step
**Then** each step uses explicit `### Input`, `### Process`, `### Output` (and `### Human Review Gate` where applicable) subsections, and the file opens with a Workflow Overview ASCII diagram showing all steps and review gates — matching `/write-spec`'s structure

### AC9: Interview Probes NFRs, Edge Cases, and Related Features

**Given** I have classified the issue as a Feature
**When** the skill runs the interview step
**Then** the interview includes dedicated probing for (a) non-functional requirements (performance, accessibility, security, i18n as relevant), (b) edge cases and error states beyond the happy path, and (c) related existing features to maintain consistency — these may be grouped into multi-question `AskUserQuestion` rounds rather than individual questions

### AC10: Understanding Check Before Drafting

**Given** I have answered the interview questions
**When** the skill transitions toward the Synthesize Issue Body step
**Then** the skill first plays back its understanding (persona, desired outcome, acceptance criteria outline, scope boundaries) and asks me via `AskUserQuestion` to confirm or correct — the skill does not draft the issue body until the playback is confirmed

### AC11: Adaptive Interview Depth Based on Complexity

**Given** the skill has completed codebase investigation
**When** it enters the interview step
**Then** the skill uses heuristic signals from investigation (number of related files found, presence of multiple components/personas, vagueness of the user's initial description) to decide whether to run a core interview or an extended interview with follow-up probing — the heuristic and its decision are briefly logged to the user (e.g., "This touches 4 components — I'll ask deeper scope questions")

### AC12: Unattended-Mode Support Removed from draft-issue

**Given** I invoke `/draft-issue` in any context, including when `.claude/unattended-mode` exists
**When** the skill runs
**Then** the skill always runs the full interactive workflow — the top-level "Automation Mode" section is removed from SKILL.md, every per-step `> Auto-mode: This step is skipped` (or equivalent unattended-mode) blockquote is removed, and `.claude/unattended-mode` has no effect on `/draft-issue` behavior

### AC13: SDLC Runner No Longer Invokes draft-issue

**Given** `scripts/sdlc-runner.mjs` and its configuration reference the SDLC step list
**When** the runner executes
**Then** `/draft-issue` is not a callable step — the runner's step list, any step-dispatch logic, and the config template (`scripts/sdlc-config.example.json`) reflect that `/draft-issue` is interactive-only; existing runner tests still pass

### AC14: Automatable-Label Question Explains Downstream Impact

**Given** I reach the automatable-label classification step
**When** the skill presents the `AskUserQuestion` for the automatable label
**Then** the question body includes a 1–2 line explanation referencing the downstream skills (`/write-spec`, `/write-code`, `/verify-code`, `/open-pr`), making clear that "automatable" means the downstream SDLC can proceed without further human judgment — not that drafting itself is automated

### AC15: User Can Override the Heuristic Depth Decision

**Given** the skill has logged the heuristic's depth decision
**When** the skill enters the interview step
**Then** the skill presents an `AskUserQuestion` with two options (`[1] Use core interview` and `[2] Use extended interview`), with the heuristic's pick marked as the recommended first option — **and** if the user overrides, the skill emits a one-line session note (e.g., `"(heuristic chose core, user selected extended)"`) before proceeding; **and** when depth signals are borderline (e.g., `descriptionVagueness` falls in the near-threshold range, or a single component is touched across many files), the heuristic biases toward extended depth; **and** the final interview round ends with a one-line `"Anything I missed?"` probe before Step 5c

### AC16: Playback Length Scales with Interview Depth

**Given** the interview is complete and the skill has reached Step 5c
**When** the skill plays back its understanding
**Then** the core-depth path renders a one-line confirm (persona + outcome + in/out-of-scope summary) with a two-option menu, **and** the extended-depth path renders the full multi-line structured playback block with a two-option menu — in both cases the skill does not advance to Step 6 until the user confirms

### AC17: Revise Loop Adds Soft Guard After Three Iterations

**Given** I am iterating on the Step 7 review summary
**When** I have selected `[2] Revise` three consecutive times without approving
**Then** on the next review round the `AskUserQuestion` menu expands to offer three options: `[1] Keep revising`, `[2] Reset and re-interview`, `[3] Accept as-is` — the skill does not auto-terminate the loop; the user remains in control

### AC18: Unattended-Mode Removal Ships as a Breaking Major Version with a Sign-Post

**Given** a user upgrades the plugin from a version that honored `.claude/unattended-mode` in `/draft-issue`
**When** they read SKILL.md or the CHANGELOG
**Then** the plugin version is bumped **major** (v6.0.0) with a BREAKING entry describing the removal, **and** SKILL.md retains a single sign-post sentence where the Unattended Mode section used to be (e.g., `"As of v6.0.0, /draft-issue no longer honors .claude/unattended-mode. Issue drafting requires interactive input."`), **and** `scripts/sdlc-runner.mjs` includes a comment near `STEP_KEYS` referencing this removal so future contributors do not re-add `draftIssue`

### AC19: Heuristic Multi-Issue Detection at Step 1b (#125)

**Given** an initial prompt has been captured in Step 1
**When** Step 1b runs the multi-issue detection heuristic
**Then** the heuristic inspects the prompt for (a) conjunction and topic-shift markers (e.g., `"and also"`, `"second thing"`, `"another thing"`), (b) explicit numbered lists or bullet points, and (c) distinct target components referenced across different parts of the prompt — **and** it either produces a proposed split with per-ask summaries, or exits quickly with a `"single-issue detected"` trail note (see AC26) so the flow proceeds unchanged to Step 2

### AC20: Split-Confirm Menu (#125)

**Given** the Step 1b heuristic proposed a split of N asks
**When** the split-confirm menu is presented
**Then** the skill renders an inline summary listing each proposed ask (one-line per ask) **and** presents an `AskUserQuestion` with three options: `[1] Approve the split as proposed`, `[2] Adjust the split (merge asks or re-divide)`, `[3] Collapse back to a single issue (false-positive path)` — on `[1]` the flow continues to Step 1d dependency inference; on `[2]` the user is asked for free-text adjustments and the summary re-renders until approve/collapse; on `[3]` the skill proceeds to Step 2 with the original single-issue description

### AC21: Dependency Inference + Graph-Confirm Menu (#125)

**Given** the user approved a multi-issue split
**When** dependency inference runs in Step 1d
**Then** the skill proposes a DAG using AC/FR overlap, shared components mentioned in the prompt, and explicit `"X depends on Y"` or `"X blocks Y"` textual cues — **and** the proposed DAG is rendered for the user (as an indented or arrow-notation list showing edges) followed by an `AskUserQuestion` with options `[1] Approve the graph`, `[2] Adjust edges (add/remove a dependency)`, `[3] Flatten (no dependencies between issues)` — drafting does not begin until the user approves the graph or explicitly flattens it

### AC22: Per-Issue Loop Preserves the Steps 2–9 Contract (#125)

**Given** the split and dependency graph are confirmed
**When** the per-issue loop runs
**Then** each iteration runs the full existing Steps 2–9 independently (classification, milestone, investigation, interview, playback, synthesis, review, creation, output) **and** only two things are shared across iterations: (a) the product-context snapshot loaded in Step 1 and (b) the Claude Design URL content from AC24 if one was supplied — each iteration retains its own independent review-gate state, classification, milestone, investigation, and draft

### AC23: Autolinking via GitHub Sub-Issues and Body Cross-Refs (#125)

**Given** multiple issues are created in the same batch
**When** creation completes for each issue
**Then** for every parent/child edge in the confirmed DAG the skill runs `gh issue edit <child> --add-sub-issue <parent>` (after probing availability — see AC28) **and** every issue body includes explicit `"Depends on: #X, #Y"` and/or `"Blocks: #Z"` lines listing its DAG neighbors — body cross-refs are always written, independent of whether the sub-issue API call succeeds

### AC24: Claude Design URL as Shared Session Context (#125)

**Given** the user supplied a Claude Design URL at the start of the run (either via argument or via an explicit prompt early in Step 1)
**When** Step 1b begins
**Then** the archive is fetched over HTTPS, **gzip-decoded**, the contained README is parsed, and the parsed content is cached as session-scoped context available to every per-issue interview (Step 5), investigation (Step 4), and synthesis (Step 6) in the batch — regardless of whether Step 1b later proposes a split

### AC25: Graceful Degradation on Design Fetch/Decode Failure (#125)

**Given** the user supplied a Claude Design URL
**When** the fetch times out, the URL is unreachable, or the archive fails to decode
**Then** the failure is logged as a visible session note, the session continues without design context (not aborted), and the Step 9 / final summary includes a line noting the gap (e.g., `"Design fetch failed — issues drafted without design context"`)

### AC26: Heuristic Trail is Logged as a Visible Session Note (#125)

**Given** Step 1b has run
**When** detection completes (whether a split was proposed or a single issue was detected)
**Then** the skill emits a visible session note — in the same spirit as the existing depth-override log — listing the signals observed (conjunction hits, bullet/numbered-list presence, distinct components) and a rough confidence indicator (e.g., `high`, `medium`, `low`) so future threshold tuning has concrete evidence; the note is printed even in the single-issue path (`"Step 1b: single-issue detected — no split proposed"`)

### AC27: Partial-Batch Abandonment Preserves Created Issues (#125)

**Given** a multi-issue batch is in progress
**When** the user abandons mid-loop after N of M planned issues have been created (either via an explicit abandon action at any review gate, or by ending the session)
**Then** the already-created issues remain on GitHub, the final summary reports `"Created N of M planned issues"` listing URLs for each created issue, and no rollback or cleanup of the created issues is attempted

### AC28: `gh issue edit --add-sub-issue` Availability Probe with Body-Only Fallback (#125)

**Given** the autolinking step is about to wire parent/child relationships
**When** the skill runs a one-time probe of `gh issue edit --help` (or equivalent) to detect support for the `--add-sub-issue` flag
**Then** if the flag is unavailable, the skill falls back to body cross-refs only, records the degradation in the final summary (`"Sub-issue linking unavailable in this gh version — body cross-refs only"`), and does not error — the probe runs once per batch, its result is cached, and the body cross-refs from AC23 are always written regardless of probe outcome

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Adaptive interview process (2-3 rounds) gathering feature requirements | Must | Skips already-answered topics |
| FR2 | GitHub issue creation via `gh issue create` with BDD-formatted body | Must | Structured template |
| FR3 | User Story, Background, Acceptance Criteria, Functional Requirements, Out of Scope sections | Must | Standard issue format |
| FR4 | Bug report template variant with reproduction steps and severity | Must | Triggered by bug type |
| FR5 | Automation mode support that skips interview and infers criteria | Must (superseded by FR16/FR17) | Originally read `.claude/unattended-mode`; removed by #116 |
| FR6 | Review step renders a structured inline summary of the drafted issue (Title, User Story one-liner, AC count + one-line G/W/T per AC, FRs w/ priorities, Out of Scope, Labels) | Must | Issue #116 |
| FR7 | Review step presents a 2-option `AskUserQuestion` numbered menu: `[1] Approve` / `[2] Revise` | Must | Issue #116 |
| FR8 | On `[2] Revise`, ask one free-text follow-up, apply changes, re-render summary + menu; loop until Approve | Must | Issue #116 |
| FR9 | Add a feature-vs-bug template comparison table near the template/synthesis step | Must | Issue #116 |
| FR10 | Restructure each workflow step with explicit `### Input` / `### Process` / `### Output` subsections | Must | Issue #116 |
| FR11 | Add a Workflow Overview ASCII diagram near the top of SKILL.md showing all steps and review gates | Must | Issue #116 |
| FR12 | Feature interview path gains dedicated probing for NFRs, edge cases, and related-feature consistency — grouped into multi-question rounds to stay within 3–4 rounds total | Must | Issue #116 |
| FR13 | Bug interview path gains dedicated probing for edge cases / related regressions while keeping reproduction as primary focus | Must | Issue #116 |
| FR14 | Insert a "Playback and Confirm" step between the final classification step and the synthesis step; skill plays back understanding and requires confirmation before drafting | Must | Issue #116 |
| FR15 | Interview step implements adaptive depth using heuristics from investigation (file count, component count, description vagueness); the decision is briefly logged to the user | Must | Issue #116 |
| FR16 | Remove "Automation Mode" top-level section from `plugins/nmg-sdlc/skills/draft-issue/SKILL.md` | Must | Issue #116 |
| FR17 | Remove all per-step unattended-mode skip blockquotes from the same file | Must | Issue #116 |
| FR18 | Update `scripts/sdlc-runner.mjs` so `/draft-issue` is not a runnable step; update `scripts/sdlc-config.example.json` and any runner tests accordingly | Must | Issue #116 |
| FR19 | Automatable-label `AskUserQuestion` includes a 1–2 line explanation of what the label controls downstream | Must | Issue #116 |
| FR20 | Update `README.md` to reflect that `/draft-issue` is interactive-only and describe the new review-gate UX | Must | Issue #116 |
| FR21 | Bump plugin version in both `plugins/nmg-sdlc/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`; update `CHANGELOG.md` under `[Unreleased]` | Must | Issue #116 |
| FR22 | After logging the heuristic's depth decision, present an `AskUserQuestion` that lets the user override (core ↔ extended); the heuristic's pick is the first/recommended option | Must | Issue #116 (Risk 1 mitigation) |
| FR23 | Depth heuristic biases toward extended when signals are borderline — specific rule: extended is selected when `descriptionVagueness ∈ [0.10, 0.15)` OR (`componentsInvolved == 1` AND `filesFound > 8`) | Must | Issue #116 (Risk 1 mitigation) |
| FR24 | The final interview round ends with a one-line `"Anything I missed?"` free-text probe before advancing to Step 5c | Must | Issue #116 (Risk 1 mitigation) |
| FR25 | Step 5c playback length is depth-proportional: core-depth renders a one-line confirm; extended-depth renders the full structured 5-line block | Must | Issue #116 (Risk 2 mitigation) |
| FR26 | Step 7 revise loop tracks consecutive `[2] Revise` selections; on the 4th iteration the `AskUserQuestion` menu expands to `[1] Keep revising` / `[2] Reset and re-interview` / `[3] Accept as-is` | Must | Issue #116 (Risk 3 mitigation) |
| FR27 | Version bump is **major** (v5.2.0 → v6.0.0); `CHANGELOG.md` `[Unreleased]` entry is under a BREAKING subsection describing `/draft-issue` unattended-mode removal | Must | Issue #116 (Risk 4 mitigation) |
| FR28 | SKILL.md retains a one-sentence sign-post where the Unattended Mode section used to be; `scripts/sdlc-runner.mjs` has a comment above `STEP_KEYS` referencing the v6.0.0 removal and prohibiting re-addition of `draftIssue` | Must | Issue #116 (Risk 4 mitigation) |
| FR29 | When the user overrides the depth heuristic (FR22), the skill emits a one-line session note (e.g., `"(heuristic chose core, user selected extended)"`) before the interview begins | Must | Issue #116 (Risk 5 mitigation) |
| FR30 | New Step 1b runs heuristic multi-issue detection using conjunction/topic-shift markers, explicit numbered/bulleted lists, and distinct-component cues; produces either a proposed split with per-ask summaries or a `"single-issue detected"` trail note | Must | Issue #125 |
| FR31 | Split-confirm menu with three options: `[1] Approve`, `[2] Adjust (merge/re-divide)`, `[3] Collapse to single issue` — approve continues to dependency inference; collapse returns the flow to Step 2 with the original description; adjust loops with free-text input | Must | Issue #125 |
| FR32 | Step 1d dependency-graph inference: build a DAG using AC/FR overlap, shared components, and explicit `"X depends on Y"` / `"X blocks Y"` textual cues; render and require confirm via `[1] Approve`, `[2] Adjust edges`, `[3] Flatten` before drafting | Must | Issue #125 |
| FR33 | Per-issue iteration loop that runs the existing Steps 2–9 independently for each planned issue, sharing only the Step 1 product-context snapshot and the Claude Design URL content (FR35) across iterations | Must | Issue #125 |
| FR34 | Autolinking post-create: for each parent/child edge in the confirmed DAG run `gh issue edit <child> --add-sub-issue <parent>` (subject to availability probe FR39), and write explicit `"Depends on: #X, #Y"` / `"Blocks: #Z"` lines into each issue body unconditionally | Must | Issue #125 |
| FR35 | Claude Design URL handling: detect a supplied URL, fetch over HTTPS, gzip-decode the archive, parse the README, and cache the content as session-scoped context available to every per-issue Step 4 (investigation), Step 5 (interview), and Step 6 (synthesis) — reuse whatever fetch/decode helper lands with Issue #124 to avoid drift | Should | Issue #125 |
| FR36 | Graceful degradation on Claude Design fetch/decode failure: log the failure as a visible session note, continue the session without design context, and record the gap in the final summary — no abort | Should | Issue #125 |
| FR37 | Step 1b heuristic trail: after detection, emit a visible session note listing observed signals (conjunction hits, list presence, component count) and a `high`/`medium`/`low` confidence indicator — printed even on the single-issue path | Must | Issue #125 |
| FR38 | Partial-batch summary: when the loop is abandoned mid-way, the final summary reports `"Created N of M planned issues"` with URLs; already-created issues are preserved (no rollback) | Must | Issue #125 |
| FR39 | One-time-per-batch probe of `gh issue edit --add-sub-issue` availability with result cached for the loop; on unavailable, body cross-refs (FR34) are still written and the degradation is noted in the final summary | Must | Issue #125 |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Interview and issue creation complete within a single session |
| **Security** | No sensitive data in issue bodies; uses `gh` CLI for authenticated access |
| **Reliability** | Graceful handling when GitHub API is unavailable |
| **Readability** | Review-gate summaries legible without opening files; SKILL.md opens with Workflow Overview for rapid onboarding (#116) |
| **Interactivity** | `/draft-issue` must actively ignore environmental unattended-mode signals and always run the interactive workflow (#116) |
| **Resilience** | External integrations (Claude Design fetch, `gh --add-sub-issue` flag) must degrade gracefully — a failure in either must not abort the batch or prevent issue creation (#125) |
| **Idempotence** | The per-issue loop must tolerate mid-loop abandonment: already-created issues remain committed on GitHub, and the summary accurately reports the partial state (#125) |

---

## UI/UX Requirements

Reference `structure.md` and `product.md` for project-specific design standards.

| Element | Requirement |
|---------|-------------|
| **Review Summary Layout** | Structured inline markdown summary: Title, User Story one-liner, numbered AC list with one-line G/W/T, FR table with priorities, Out of Scope list, applied Labels (#116) |
| **Review Menu** | Two numbered `AskUserQuestion` options — `[1] Approve — create the issue`, `[2] Revise — I'll describe what to change` (#116) |
| **Playback Step** | Short structured playback block (persona, outcome, AC outline, scope) followed by a confirm/correct `AskUserQuestion` (#116) |
| **Adaptive Depth Log** | One-line message to the user explaining which interview depth was selected and why (#116) |
| **Error States** | If `gh issue create` fails, surface stderr verbatim and offer retry without losing gathered interview content |

---

## Data Requirements

### Input Data

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| feature description | string | Non-empty | No (optional CLI arg) |
| issue type | enum {feature, bug} | One of the two values | Yes (collected in classification) |
| automatable | boolean | true/false | Yes (collected in labeling step) |

### Output Data

| Field | Type | Description |
|-------|------|-------------|
| issue number | integer | GitHub issue number from `gh issue create` output |
| issue URL | string | HTTPS URL of the created issue |
| applied labels | string[] | Labels applied at creation time |

---

## Dependencies

### Internal Dependencies
- [x] Plugin scaffold (#2)
- [x] Steering documents (from `/setup-steering`, #3) for context reference
- [x] Readability treatment applied to `/write-spec` (commit `2b38811`) — pattern reference (#116)

### External Dependencies
- [x] `gh` CLI for GitHub issue creation
- [x] GitHub Issues API

---

## Out of Scope

- Issue prioritization or backlog ordering
- Integration with project management tools beyond GitHub Issues
- Automatic label assignment based on content analysis
- Changes to other SDLC skills (`/write-spec`, `/write-code`, `/verify-code`, `/open-pr`, `/start-issue`) — issue #116 is draft-issue-only (#116)
- Backfill of existing GitHub issues to the new template or review-gate structure (#116)
- Changes to the core Feature and Bug issue-body templates — only the interview and review flow change (#116)
- AI-generated content beyond what the interview gathers (e.g., auto-generating ACs from steering docs alone) (#116)
- Cross-repository issue creation — single-repo scope only (#125)
- Auto-closing drafts that the multi-issue split renders superseded (#125)
- Image or asset upload from the Claude Design archive (#125)
- `/start-issue` dependency-aware ordering across the batch — tracked separately (#125)
- Rollback or deletion of created issues on mid-loop abandonment (#125)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Review-gate churn | <2 revise iterations on average | Count `[2] Revise` selections per drafted issue during dogfooding |
| Interview depth fit | Heuristic-selected depth matches user expectation | Rate of user overriding depth decision during dogfooding |
| Downstream amendment rate | Drop in `/write-spec` amendments that cite "interview missed X" | Compare pre/post #116 spec change-history entries |

---

## Open Questions

- [ ] Should the adaptive-depth heuristic be configurable via steering docs, or fixed in the skill?
- [ ] Should revise iterations preserve the previous draft as a diff, or replace wholesale?

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #4 | 2026-02-15 | Initial feature spec |
| #116 | 2026-04-17 | Apply readability treatment (inline review summary + approve/revise menu) and deeper interview (NFR/edge-case/related-feature probing, understanding playback, adaptive depth). Remove unattended-mode support from draft-issue and from sdlc-runner. Include risk-mitigation controls: user override for depth heuristic (AC15), depth-proportional playback (AC16), soft guard on revise loop (AC17), major-version bump with in-file sign-post (AC18). |
| #125 | 2026-04-18 | Add multi-issue detection (Step 1b heuristic with trail logging + confidence indicator), split-confirm menu, Step 1d dependency inference with graph-confirm, per-issue loop over Steps 2–9, GitHub sub-issue + body cross-ref autolinking with availability probe and body-only fallback, Claude Design URL ingestion as shared session context with graceful degradation, and partial-batch summary preserving created issues on abandonment. ACs AC19–AC28. FRs FR30–FR39. |

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Defensive AC present for excluded environmental mode signals (AC12) — per retrospective learning on feature-mode-exclusion
