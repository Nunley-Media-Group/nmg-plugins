# Requirements: Add /onboard-project Skill

**Issues**: #115, #124
**Date**: 2026-04-18
**Status**: Draft
**Author**: Claude

---

## User Story

**As a** developer adopting nmg-sdlc on a project that isn't already spec-driven
**I want** a single skill that initializes the project for the SDLC — whether it is greenfield (no code, no specs) or brownfield (code but no specs)
**So that** I can get from "plugin installed" to "ready to run `/draft-issue`" without hand-crafting steering docs or back-filling specs one at a time

---

## Background

Today, nmg-sdlc assumes a project is either already spec-driven or will be built spec-first from day one. Two scenarios fall through the cracks:

1. **Greenfield** — a brand-new repo with no code and no specs. The user must know to run `/setup-steering` first, then `/init-config`, then `/draft-issue`.
2. **Brownfield** — an existing codebase with shipped features and closed GitHub issues but no specs. No skill reverse-engineers specs from the historical record.

`/onboard-project` becomes the single entry point that detects which mode applies, delegates to existing skills where possible (`/setup-steering`, `/init-config`, `/upgrade-project`), and fills the gap with a new brownfield-reconciliation capability that reads closed issues + merged PR diffs + the current implementation and emits one spec directory per reconciled feature.

Pipeline position: runs **before** `/draft-issue`, **once per project lifetime** (versus once per feature). Adjacent skills that already exist: `/setup-steering` (bootstraps steering docs), `/upgrade-project` (reconciles existing specs/steering/configs against latest templates), `/init-config` (generates `sdlc-config.json`).

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Greenfield Bootstrap — Happy Path

**Given** a project with no `steering/` directory and no `specs/` directory and no source files beyond scaffolding (`README.md`, `.gitignore`, empty `package.json` or equivalent)
**When** the user runs `/onboard-project`
**Then** the skill detects greenfield mode, delegates to `/setup-steering` to create steering docs, offers to invoke `/init-config`, and reports that the project is ready for `/draft-issue`
**And** after delegation returns, the skill verifies `steering/product.md`, `steering/tech.md`, and `steering/structure.md` exist before reporting success

### AC2: Brownfield Reconciliation — Happy Path

**Given** a project with existing source files, at least one closed GitHub issue, and no `specs/` directory
**When** the user runs `/onboard-project`
**Then** the skill detects brownfield mode, confirms `steering/` exists (delegating to `/setup-steering` first if missing), reads closed issues via `gh issue list --state closed`, inspects each issue's merged PR diff and commit messages for design context, cross-checks the combined evidence against the current implementation, and produces one spec directory per reconciled feature under `specs/`
**And** each produced spec directory contains `requirements.md`, `design.md`, `tasks.md`, and `feature.gherkin` — the same artifact set `/write-spec` emits

### AC3: Multi-Issue Consolidation

**Given** several closed issues touch the same feature area (by shared label or by keyword overlap in title/body)
**When** the skill reconciles specs
**Then** it groups related issues, presents the groups to the user via `AskUserQuestion`, and produces one consolidated spec per approved group
**And** if the user declines consolidation for a group, the skill produces one spec per issue in that group instead

### AC4: Template Variant Selection by Label

**Given** a closed issue being reconciled into a spec
**When** the skill picks a spec template
**Then** it uses the defect/bug template if the issue carries a `bug` label (emitting to `specs/bug-{slug}/`), otherwise the feature template (emitting to `specs/feature-{slug}/`)
**And** if no label is set, the skill inspects the issue title and body for bug-indicating keywords (`fix`, `bug`, `broken`, `regression`, `crash`, `error`) before defaulting to feature

### AC5: Brownfield With Missing Steering Docs

**Given** brownfield mode is detected and `steering/` is missing
**When** reconciliation would begin
**Then** the skill delegates to `/setup-steering` to create steering docs first
**And** only after steering bootstrap succeeds does reconciliation proceed — the skill does not produce partial specs against an uninitialized project

### AC6: Unattended-Mode Support

**Given** `.claude/unattended-mode` exists in the project directory
**When** the skill runs
**Then** all interactive prompts are skipped, consolidation groups are auto-accepted as proposed, and defaults are applied without `AskUserQuestion`
**And** any decision the skill would have prompted for (init-config invocation, consolidation confirmations, template variant overrides) is logged in the final summary so the user can audit what the unattended run decided

### AC7: Idempotency — Already Initialized

**Given** `/onboard-project` has already run and `specs/` contains at least one spec directory
**When** the user runs `/onboard-project` again
**Then** the skill detects the already-initialized state, reports which specs already exist, and offers to delegate to `/upgrade-project` instead of duplicating reconciliation work
**And** the skill does not overwrite any existing spec file

### AC8: Post-Reconciliation Verification

**Given** brownfield reconciliation has emitted spec directories
**When** the skill finishes writing specs
**Then** it verifies each generated spec directory contains all four required files (`requirements.md`, `design.md`, `tasks.md`, `feature.gherkin`) and reports any missing files as gaps
**And** for each reconciled spec, the skill confirms the referenced source files named in `design.md` still exist in the current working tree — if a spec references removed behavior, the gap is flagged in the summary rather than silently emitted

### AC9: Context Sources Enumerated Per Reconciled Spec

**Given** a spec is being reconciled from a closed issue
**When** the skill gathers evidence for the spec's requirements and design
**Then** it reads, in order: the closed issue body and comments, the merged PR body and diff, commit messages on the PR, and the current implementation files that the PR touched
**And** the produced `design.md` lists which of these four sources contributed to each major section so the user can verify traceability

### AC10: Reconciliation Degradation When Evidence Is Incomplete

**Given** a closed issue has no merged PR (closed as duplicate, wontfix, or without code changes)
**When** the skill attempts to reconcile it
**Then** it degrades gracefully to "issue body + current code" evidence only, emits the spec with a `## Known Gaps` section noting the missing PR context, and continues processing the remaining issues
**And** the skill does not abort the overall run because of a single reconciliation gap

### AC11: Summary Report

**Given** the skill has finished either greenfield bootstrap or brownfield reconciliation
**When** it reports completion
**Then** the final output names the mode detected, lists every spec directory produced (with issue numbers), lists every delegated skill invoked and whether each succeeded, and — for brownfield — calls out any issues where the reconciled spec references behavior that no longer exists in the current implementation

---

<!-- ACs added by issue #124: greenfield enhancement (interview, backlog seeding, Claude Design URL, /setup-steering absorption) -->

### AC12: Intent + Tech-Selection Interview Runs in Greenfield Mode

**Given** a project detected as greenfield
**When** Step 2G begins
**Then** the skill conducts an interactive interview (via `AskUserQuestion` multi-question rounds, consistent with `/draft-issue`) covering: product vision, target users/personas, success criteria, language, framework, test tooling, and deployment target — *before* any steering file is written
**And** in unattended mode, the interview is replaced by deterministic defaults sourced from the Claude Design payload (if provided) or from the steering templates' defaults; every applied default is logged in the Step 5 summary so the run can be audited

### AC13: v1 and v2 Milestones Are Seeded Idempotently

**Given** greenfield mode
**When** milestone seeding runs
**Then** GitHub milestones `v1 (MVP)` and `v2` are created via `gh api` if they do not already exist
**And** if either already exists, the existing milestone is reused without duplication
**And** failure to create a milestone (network error, permission denied, name collision the user did not approve overwriting) is recorded as a gap in the Step 5 summary and the run continues — milestone seeding does not abort the greenfield flow

### AC14: Starter Issues Are Seeded via the /draft-issue Loop

**Given** the interview surfaces 3–7 starter-issue candidates
**When** seeding runs
**Then** `/draft-issue` is delegated to once per candidate
**And** the shared interview context (vision, personas, tech selections, design payload if any) is passed in to each delegation so each starter issue lands with a proper AC/FR body — not a minimal placeholder
**And** if `/draft-issue` fails for any one candidate, that failure is recorded as a per-issue gap and the loop continues with the remaining candidates

### AC15: Dependencies Between Seeded Starter Issues Are Inferred and Confirmed

**Given** 3–7 starter issues are about to be seeded
**When** dependency inference runs
**Then** the skill proposes a DAG built from: (a) shared component references in the candidate bodies, (b) explicit ordering cues surfaced in the interview, and (c) milestone mapping (`v1` items cannot depend on `v2` items)
**And** the user approves or adjusts the DAG via `AskUserQuestion` *before* any `/draft-issue` invocation begins (auto-accept in unattended mode, with the proposed DAG logged for the summary)
**And** if cycles are detected in the inferred DAG, the skill aborts the dependency step, logs the cycle, and proceeds to seed issues without dependency wiring rather than producing an invalid graph

### AC16: Seeded Starter Issues Are Autolinked

**Given** the dependency graph is approved
**When** each starter issue is created inside the `/draft-issue` loop
**Then** hierarchical relationships are wired via `gh issue edit <child> --add-sub-issue <parent>` for every DAG edge that has a clear parent/child relationship
**And** every seeded issue body includes machine-parseable `Depends on: #X, #Y` and/or `Blocks: #Z` lines reflecting its DAG neighbors
**And** the autolinking primitive landed by Issue #125 is reused — this skill does not duplicate dependency-wiring logic

### AC17: Claude Design URL Is Used as Context

**Given** the user supplies a Claude Design URL at the start of the greenfield interview
**When** the greenfield flow runs
**Then** the archive is fetched, decoded as gzip-aware (the payload is a gzipped archive of ~119 KB in the example, not raw HTML)
**And** the README inside the archive is read and summarized to the user
**And** relevant files surfaced from the archive (file names, sizes, brief content previews) are presented as context
**And** the parsed content feeds both the interview defaults and the starter-issue seed bodies — design-derived files become candidate starter issues unless the user excludes them

### AC18: Re-Run Switches to Steering Enhancement Mode

**Given** `steering/product.md`, `steering/tech.md`, and `steering/structure.md` already exist
**When** `/onboard-project` is invoked on the same project
**Then** the flow switches to **steering-enhancement mode** — existing steering content is edited in place rather than overwritten
**And** milestone seeding detects already-seeded milestones (`v1 (MVP)`, `v2`) and skips them
**And** issue seeding detects already-seeded starter issues (by title match against the previously-seeded set, recorded in the Step 5 summary of the prior run, or by GitHub label `seeded-by-onboard`) and skips them
**And** existing dependency links between issues are preserved — the skill does not rewrite or delete `--add-sub-issue` relationships set by a prior run

### AC19: /setup-steering Is Absorbed Into /onboard-project

**Given** this issue ships
**When** a user runs `/setup-steering`
**Then** the standalone `/setup-steering` skill no longer exists in `plugins/nmg-sdlc/skills/`
**And** all steering bootstrap and steering-enhancement logic that previously lived in `/setup-steering` runs inside `/onboard-project`'s greenfield branch (Step 2G) and re-run branch (Step 2I, enhancement mode)
**And** every reference to `/setup-steering` in other skills (notably `/upgrade-project`'s delegation references) is rewritten to point at `/onboard-project` (or to no delegation if the new entry point makes the indirection unnecessary)
**And** `CHANGELOG.md` records the removal of the standalone `/setup-steering` skill in `[Unreleased]`

### AC20: Claude Design Fetch Failure Degrades Gracefully

**Given** the supplied Claude Design URL is unreachable, times out, returns a non-success HTTP status, or returns a payload that cannot be decoded as gzip
**When** the fetch or decode step fails
**Then** the failure is logged with the URL, the failure mode (network, HTTP status, decode error), and a single-sentence remediation hint
**And** the greenfield flow continues without design context — interview proceeds with no design-derived defaults
**And** the failure is noted as a gap in the Step 5 summary
**And** the run does not abort

### AC21: /init-config Is Still Delegated After Seeding

**Given** backlog seeding completes (milestones seeded, starter issues seeded, dependencies wired)
**When** the greenfield flow nears exit
**Then** `/init-config` is still invoked per the existing Step 3G behavior — no scope change to `/init-config` itself
**And** in unattended mode, the invocation remains auto-yes (existing AC6 behavior preserved)

### Generated Gherkin Preview

```gherkin
Feature: Onboard Project
  As a developer adopting nmg-sdlc on a project that isn't spec-driven
  I want a single skill that initializes the project for the SDLC
  So that I can get from "plugin installed" to "ready to run /draft-issue" in one step

  Scenario: Greenfield bootstrap
    Given a project with no steering/ and no specs/ and only scaffolding source files
    When I run /onboard-project
    Then the skill delegates to /setup-steering, optionally invokes /init-config, and reports ready for /draft-issue

  Scenario: Brownfield reconciliation
    Given a project with existing code, closed GitHub issues, and no specs/
    When I run /onboard-project
    Then the skill reconciles one spec per feature area from closed issues, merged PR diffs, and current code

  Scenario: Multi-issue consolidation
    Given several closed issues touch the same feature area
    When the skill groups related issues
    Then it produces one consolidated spec per approved group, or one spec per issue if declined

  Scenario: Template variant selection
    Given a closed issue with a "bug" label
    When the skill picks a template
    Then it emits to specs/bug-{slug}/ using the defect variant

  Scenario: Brownfield with missing steering
    Given brownfield mode is detected and steering/ is missing
    When reconciliation would begin
    Then the skill delegates to /setup-steering before producing any specs

  Scenario: Unattended mode
    Given .claude/unattended-mode exists
    When the skill runs
    Then consolidation groups are auto-accepted and no AskUserQuestion prompts fire

  Scenario: Idempotency
    Given specs/ already contains spec directories
    When I run /onboard-project again
    Then the skill offers to delegate to /upgrade-project instead of duplicating work

  Scenario: Post-reconciliation verification
    Given reconciliation has emitted specs
    When the skill finishes writing
    Then it verifies each spec has all four artifact files and reports any referenced source files that no longer exist

  Scenario: Context sources enumerated
    Given a spec is reconciled from a closed issue
    When the skill writes design.md
    Then design.md lists which of issue body, PR body, PR diff, commit messages, and current code contributed to each major section

  Scenario: Degradation when PR evidence is missing
    Given a closed issue has no merged PR
    When the skill reconciles it
    Then the spec is emitted with a "Known Gaps" section and the run continues

  Scenario: Summary report
    Given the skill has finished
    When it reports completion
    Then the output names the mode, lists specs produced, lists delegated skills invoked, and calls out gaps

  # --- Added by issue #124 ---

  Scenario: Greenfield interview covers intent and tech selection
    Given a project detected as greenfield
    When Step 2G begins
    Then the skill conducts a multi-round interview covering vision, personas, success criteria, language, framework, test tooling, and deployment target before any steering file is written

  Scenario: v1 and v2 milestones are seeded idempotently
    Given greenfield mode and no pre-existing milestones
    When milestone seeding runs
    Then "v1 (MVP)" and "v2" are created via gh api
    And on a re-run the existing milestones are reused without duplication

  Scenario: Starter issues seeded via /draft-issue loop
    Given the interview surfaces 5 starter-issue candidates
    When seeding runs
    Then /draft-issue is invoked once per candidate with shared interview context

  Scenario: Dependency DAG is inferred and confirmed
    Given 5 starter-issue candidates exist
    When dependency inference runs
    Then a DAG is proposed from shared components, ordering cues, and milestone mapping
    And the user approves the DAG before any /draft-issue invocation begins

  Scenario: Seeded issues are autolinked
    Given the dependency DAG is approved
    When each starter issue is created
    Then "gh issue edit <child> --add-sub-issue <parent>" wires hierarchical edges
    And every seeded issue body includes "Depends on: #X" and "Blocks: #Y" lines for its DAG neighbors

  Scenario: Claude Design URL is fetched, decoded, and used as context
    Given the user supplies a Claude Design URL at interview start
    When the greenfield flow runs
    Then the gzipped archive is fetched and decoded
    And the README is summarized to the user
    And the parsed content feeds interview defaults and starter-issue seeds

  Scenario: Re-run switches to steering enhancement mode
    Given steering/product.md, steering/tech.md, and steering/structure.md already exist
    When /onboard-project is invoked again
    Then steering content is edited in place (not overwritten)
    And already-seeded milestones and starter issues are skipped
    And existing dependency links are preserved

  Scenario: /setup-steering is absorbed into /onboard-project
    Given this issue has shipped
    When the user looks for /setup-steering
    Then the standalone skill no longer exists
    And all steering bootstrap/enhancement runs inside /onboard-project
    And /upgrade-project's references to /setup-steering have been rewritten

  Scenario: Claude Design fetch failure degrades gracefully
    Given the supplied Claude Design URL is unreachable
    When fetch fails
    Then the failure is logged with URL and failure mode
    And the greenfield flow continues without design context
    And the failure is noted in the Step 5 summary

  Scenario: /init-config is still delegated after seeding
    Given backlog seeding has completed
    When the greenfield flow nears exit
    Then /init-config is still invoked per existing Step 3G behavior
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Detect greenfield vs brownfield by presence of non-scaffold source files and presence/absence of `specs/` | Must | Heuristic: if `specs/` has any `requirements.md`, treat as already-initialized (FR9). If no `specs/` and source files beyond `README.md`, `.gitignore`, `package.json`-equivalent exist, treat as brownfield. Otherwise greenfield. |
| FR2 | For greenfield, delegate steering-doc bootstrap to `/setup-steering` | Must | Do not duplicate `/setup-steering` logic. |
| FR3 | For brownfield, read closed GitHub issues via `gh issue list --state closed --json number,title,body,labels,closedAt` | Must | Pre-filter to `--state closed` at the CLI layer, not in post-processing. |
| FR4 | For brownfield, inspect the merged PR diff and commit messages for each closed issue via `gh pr view` + `gh pr diff` | Must | Skip issues whose PR was not merged; degrade per AC10. |
| FR5 | Cross-check reconciled spec content against current implementation before writing | Must | Read each file named in the reconstructed design and confirm it exists; flag gaps in the summary. |
| FR6 | Group related issues by shared label and by keyword overlap in title/body; confirm groups interactively | Must | Keyword tokenization + stop-word filter per the `/write-spec` convention. |
| FR7 | Pick spec template by issue label (`bug` → defect), fall back to content heuristic when label is absent | Must | Content heuristic keywords: `fix`, `bug`, `broken`, `regression`, `crash`, `error`. |
| FR8 | Honor `.claude/unattended-mode` for headless execution | Must | Every `AskUserQuestion` call must be guarded. |
| FR9 | Detect already-initialized projects (specs exist) and route to `/upgrade-project` | Must | Do not overwrite existing specs. |
| FR10 | Emit the same spec artifact set as `/write-spec` per reconciled feature: `requirements.md`, `design.md`, `tasks.md`, `feature.gherkin` | Must | Use `/write-spec`'s templates verbatim. |
| FR11 | Emit a final summary: mode detected, specs produced (with contributing issue numbers), delegated skills invoked and their status, and reconciliation gaps | Must | Required so unattended runs can be audited. |
| FR12 | Enumerate contributing evidence sources per reconciled spec (issue body, PR body, PR diff, commit messages, current code) | Must | Addresses traceability — `design.md` lists which sources fed which sections. |
| FR13 | Degrade gracefully when PR evidence is missing for a closed issue (AC10) | Must | Do not abort the run on a single reconciliation gap. |
| FR14 | Verify all four artifact files exist in each produced spec directory before reporting success | Must | Postcondition check — addresses probabilistic agent-produced output. |
| FR15 | Support a dry-run mode (`--dry-run` or equivalent argument) that previews which specs would be produced without writing files | Should | Previews only; no filesystem writes. |
| FR16 | Skip issues whose reconciled spec would duplicate an existing spec directory name (idempotent per-issue) | Should | Prevents partial re-runs from overwriting completed work. |
| FR17 | Conduct a multi-round intent + tech-selection interview inside the greenfield branch (Step 2G) before any steering file is written | Must | `AskUserQuestion` rounds covering vision, personas, success criteria, language, framework, test tooling, deployment target. Unattended mode applies deterministic defaults from design payload or templates and logs them in the summary. (Issue #124) |
| FR18 | Seed `v1 (MVP)` and `v2` GitHub milestones idempotently via `gh api` | Must | Reuse existing milestones by name match; skip duplicates; record per-milestone failures in the summary without aborting. (Issue #124) |
| FR19 | Seed 3–7 starter issues by delegating to `/draft-issue` in a loop with shared interview context | Must | Each delegation receives the full interview payload + design payload; per-issue failures are recorded as gaps without aborting the loop. (Issue #124) |
| FR20 | Infer a dependency DAG between candidate starter issues from shared component references, interview ordering cues, and milestone mapping | Must | `v1` items cannot depend on `v2` items. Detect cycles and abort the dependency step (continue without wiring) rather than emit an invalid graph. (Issue #124) |
| FR21 | Confirm the inferred DAG via `AskUserQuestion` before any `/draft-issue` invocation begins | Must | Auto-accept in unattended mode; log the proposed DAG for the summary. (Issue #124) |
| FR22 | Autolink seeded starter issues via `gh issue edit <child> --add-sub-issue <parent>` and embed `Depends on:` / `Blocks:` lines in seeded issue bodies | Must | Reuse the autolinking primitive landed by Issue #125; do not duplicate dependency-wiring logic. (Issue #124) |
| FR23 | Absorb all `/setup-steering` logic (bootstrap and in-place enhancement) into `/onboard-project`'s greenfield branch (Step 2G) and re-run branch (Step 2I enhancement mode); delete the standalone `/setup-steering` skill directory | Must | Maintains the "one skill = one SDLC step" invariant. (Issue #124) |
| FR24 | Rewrite all `/setup-steering` references in other skills (notably `/upgrade-project`) to point at `/onboard-project` (or remove the indirection where the new entry point makes it unnecessary) | Must | Grep `plugins/nmg-sdlc/skills/**/SKILL.md` for any remaining `/setup-steering` mention; CHANGELOG records the removal. (Issue #124) |
| FR25 | Accept an optional Claude Design URL argument at the start of the greenfield interview, fetch the URL, decode the gzipped archive, parse the README, and inject the parsed content as interview defaults + starter-issue seed context | Should | Treat the payload as untrusted: fenced blocks only when embedding into Markdown, no shell interpolation of payload content into commands. (Issue #124) |
| FR26 | Degrade gracefully on Claude Design fetch or decode failure — log URL + failure mode + remediation hint, continue the greenfield flow without design context, surface the failure as a gap in the Step 5 summary | Should | Fetch failures must not abort the run. (Issue #124) |
| FR27 | Detect re-run on a project that already has steering docs and switch to **steering-enhancement mode** — edit existing steering content in place, skip already-seeded milestones, skip already-seeded starter issues, preserve existing dependency links | Must | Already-seeded starter issues identified by either a `seeded-by-onboard` GitHub label or by title match against the prior run's summary; existing `--add-sub-issue` relationships are not rewritten or deleted. Distinct from the existing FR9 already-initialized branch (which routes to `/upgrade-project`) — enhancement mode applies when steering exists but specs do not. (Issue #124) |
| FR28 | Emit progress lines during interview, design fetch/decode, milestone seeding, dependency inference, and the starter-issue loop | Should | Per the existing UI/UX requirement for long operations; one line per phase boundary plus per-issue progress in the seeding loop. (Issue #124) |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | No hard time limit. Brownfield reconciliation of N closed issues is roughly O(N) `gh` calls; batch where possible. |
| **Security** | No secrets written to spec files. `gh` CLI uses `GITHUB_TOKEN` per `tech.md`. No shell injection via issue title/body content — treat as untrusted input when constructing paths. |
| **Accessibility** | Skill output is plain Markdown / console text; no visual-only cues. |
| **Reliability** | Partial completion is tolerated — a single failed reconciliation must not abort the run (FR13). Every produced spec is either complete (all four files) or flagged as a gap (FR14). |
| **Platforms** | Must work on macOS, Windows, Linux (per `tech.md`). POSIX-compatible shell commands only; paths via `node:path` if a helper script is introduced. |
| **Stack-agnostic** | Skill content must not hardcode language/framework names — project specifics live in steering docs (per `structure.md` skill-contract invariants). |

---

## UI/UX Requirements

| Element | Requirement |
|---------|-------------|
| **Interaction** | Interactive prompts via `AskUserQuestion` only; every prompt guarded by unattended-mode check. |
| **Mode-detection output** | Before any work begins, the skill prints the detected mode and the evidence used (e.g., "Brownfield detected: 12 closed issues, src/ contains 47 files, no specs/ directory"). |
| **Consolidation UX** | Groups presented as numbered options with issue numbers, titles, and the grouping signal (shared label name or keyword overlap summary). |
| **Loading States** | For long operations (reading many closed issues), emit progress every N issues processed. |
| **Error States** | Reconciliation errors per-issue are recorded and surfaced in the final summary, not thrown immediately. |
| **Empty States** | If brownfield mode is detected but zero closed issues exist, the skill reports this and offers to treat the project as greenfield-plus-existing-code instead. |

---

## Data Requirements

### Input Data

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| GitHub repo | Detected from `gh` CLI config | Must have a remote origin | Yes |
| Closed issues | `gh issue list --state closed` JSON output | Parseable JSON array | Yes (brownfield only) |
| Merged PR diffs | `gh pr diff <num>` | Valid unified diff | Optional per issue (AC10) |
| Current working tree | File system at project root | Git-initialized repo | Yes |
| `.claude/unattended-mode` | File presence flag | N/A | Optional |
| Dry-run argument | `--dry-run` CLI flag or equivalent | Boolean | Optional |

### Output Data

| Field | Type | Description |
|-------|------|-------------|
| Spec directories | `specs/feature-{slug}/` or `specs/bug-{slug}/` | One per reconciled feature or bug |
| Artifact files | `requirements.md`, `design.md`, `tasks.md`, `feature.gherkin` | Per spec directory |
| Summary report | Markdown to skill stdout | Mode, specs produced, delegated skills invoked, gaps |

---

## Dependencies

### Internal Dependencies
- [x] `/setup-steering` — **(Pre-#124)** delegated for steering doc bootstrap. **(Post-#124)** absorbed into `/onboard-project`; standalone skill removed (FR23, AC19).
- [x] `/init-config` — optionally delegated after steering bootstrap (greenfield)
- [x] `/upgrade-project` — delegated when already-initialized is detected; references to `/setup-steering` rewritten per FR24
- [x] `/write-spec` templates — reused verbatim for reconciled spec artifact structure
- [x] `/draft-issue` — **(#124)** delegated in a loop for starter-issue seeding (FR19); shared interview context passed in
- [x] `/draft-issue` autolinking primitive — **(#124)** consumed for starter-issue dependency wiring (FR22); landed by Issue #125

### External Dependencies
- [x] `gh` CLI — closed issues, PR bodies, PR diffs, commit messages, milestone seeding (`gh api`), autolinking (`gh issue edit --add-sub-issue`)
- [x] `git` — working tree status, file presence checks
- [x] HTTP fetch + gzip decode — **(#124)** Claude Design URL ingestion (FR25); use built-in fetch + decompression (no new npm dependency)

### Blocked By
- Issue #125 — must land the dependency-inference + autolinking primitive in `/draft-issue` first; this issue consumes that primitive (FR22, AC16)

---

## Out of Scope

- Reading non-GitHub issue trackers (Jira, Linear, Asana)
- Multi-repo orchestration — one skill invocation reconciles one project
- Generating specs for features that have no corresponding closed issue (there is no evidence to reconcile from)
- Rewriting historical specs when they already exist — that is `/upgrade-project`
- Re-running verification (`/verify-code`) against reconciled specs — a separate invocation after onboarding
- Backfilling specs for issues closed as `duplicate`, `wontfix`, or `not-planned` — these yield no useful design evidence; skipped by default with a note in the summary
- *(#124)* Auto-implementing design files as runnable code (e.g., writing the actual `Live Incident Map.html` from a design payload) — that remains a later `/write-code` activity on a seeded starter issue
- *(#124)* Brownfield reconciliation behavior changes — Step 2B/3B logic is unchanged by issue #124; the enhancement is greenfield-only
- *(#124)* `/upgrade-project` behavioral changes — only the delegation target rewrites to match the absorbed `/setup-steering` (FR24)
- *(#124)* `/init-config` scope changes — it is still delegated with current behavior (AC21)
- *(#124)* Inventing dependency-detection or autolinking primitives — reuse the helper from Issue #125 rather than duplicating (FR22)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Greenfield time-to-ready | < 2 minutes from `/onboard-project` to "ready for `/draft-issue`" | Exercise-based timing on a minimal test project |
| Brownfield reconciliation completeness | ≥ 80% of closed issues produce a non-gap spec (all four files + no missing source references) | Count of complete specs / count of eligible closed issues in exercise test |
| Idempotency | Re-running `/onboard-project` on an initialized project produces zero file writes | Verify git status is clean after second run |
| Unattended compatibility | All 11 ACs executable in unattended mode without `AskUserQuestion` prompts firing | Agent SDK exercise test with `ask_user_question.behavior: deny` |

---

## Open Questions

- [ ] Should the skill support a `--since <date>` argument to limit reconciliation to recent closed issues? Deferred to post-v1 — can be added as an FR later.
- [ ] If the current implementation has drifted significantly from closed-issue evidence, should the skill offer an interactive "accept/reject/edit" gate per reconciled spec? Current answer: no — emit all specs, flag gaps in summary, let the user iterate with `/upgrade-project` afterwards.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #115 | 2026-04-18 | Initial feature spec |
| #124 | 2026-04-18 | Greenfield enhancement: intent + tech-selection interview, v1/v2 milestone seeding, 3–7 starter-issue seeding via `/draft-issue` loop with dependency inference + autolinking, optional Claude Design URL ingestion (gzip-decoded), steering-enhancement re-run mode, absorption of `/setup-steering` into `/onboard-project` |

---

## Validation Checklist

Before moving to PLAN phase:

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases and error states are specified (AC5, AC8, AC10)
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented
