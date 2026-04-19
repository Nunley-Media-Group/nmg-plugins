# Tasks: Add /onboard-project Skill

**Issues**: #115, #124
**Date**: 2026-04-18
**Status**: Planning
**Author**: Claude

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 2 | [ ] |
| Backend | 5 | [ ] |
| Frontend | 0 | [ ] |
| Integration | 4 | [ ] |
| Testing | 3 | [ ] |
| **Phase 6: Enhancement — Issue #124** | **11** | [ ] |
| **Total** | **25** | |

> This is a Markdown skill addition, not a code feature. "Backend" here means the skill's workflow steps (mode detection, reconciliation logic written as prompt instructions); "Frontend" is N/A because the skill is prompt-based (see `steering/structure.md` — skills are Markdown, not executable code); "Integration" covers plugin registration, marketplace updates, and README/CHANGELOG wiring.

---

## Phase 1: Setup

### T001: Create Skill Directory and Scaffold SKILL.md Frontmatter

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`
**Type**: Create
**Depends**: None
**Acceptance**:
- [ ] Directory `plugins/nmg-sdlc/skills/onboard-project/` exists
- [ ] `SKILL.md` created with YAML frontmatter matching the spec in `design.md` (name, description, disable-model-invocation, allowed-tools, argument-hint)
- [ ] Frontmatter `description` includes the trigger phrases from the issue ("onboard project", "bootstrap project", "initialize project", "adopt nmg-sdlc", "reconcile specs from history")
- [ ] File parses as valid Markdown with YAML frontmatter (verify with a quick `Read`)

**Notes**: No workflow content yet — this task lands only the skeleton so subsequent tasks can add sections.

### T002: Document Prerequisites and Mode Matrix in SKILL.md

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] `## When to Use` section added with trigger conditions from the issue
- [ ] `## Prerequisites` section added: `gh` CLI authenticated, git-initialized repo, Claude Code ≥ current plugin version
- [ ] `## Mode Detection Matrix` section added, reproducing the decision table from `design.md`
- [ ] Legacy-layout precondition block added — abort if `.claude/steering/` or `.claude/specs/*/requirements.md` exist, matching the pattern in `/write-spec` and `/setup-steering`
- [ ] `## Unattended Mode` section added explaining which gates are auto-decided and which decisions are logged in the summary

---

## Phase 2: Backend Implementation (Workflow Steps)

### T003: Step 0 — Legacy-Layout Precondition + Step 1 — Mode Detection

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [ ] Step 0 instructs Claude to run `Glob` for `.claude/steering/*.md` and `.claude/specs/*/requirements.md`; abort with the shared error message if either matches
- [ ] Step 1 enumerates the four detection inputs (steering/, specs/, source-file count excluding scaffold allowlist, `gh issue list --state closed --limit 1`)
- [ ] Step 1 classifies the result per the Mode Detection Matrix and stores the mode + evidence for the summary
- [ ] Step 1 prints the detected mode and evidence to the user before continuing (per UI/UX requirement)
- [ ] Scaffold allowlist matches design.md: `README.md`, `.gitignore`, `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `LICENSE`
- [ ] Source-file count excludes `node_modules/`, `.git/`, and hidden directories

### T004: Step 2 — Greenfield Branch (Steering Bootstrap + Optional Init-Config)

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`
**Type**: Modify
**Depends**: T003
**Acceptance**:
- [ ] Step 2G instructs Claude to delegate to `/setup-steering` and wait for completion
- [ ] After delegation returns, Step 2G verifies `steering/product.md`, `steering/tech.md`, `steering/structure.md` all exist — if any are missing, recorded as a gap and the run aborts
- [ ] Step 3G prompts the user via `AskUserQuestion` to invoke `/init-config` (guarded by unattended-mode check — in unattended mode, auto-yes)
- [ ] After Step 3G, the skill jumps to Step 5 (Summary) — greenfield does not reconcile specs
- [ ] "Ready for `/draft-issue`" is the explicit completion state messaged to the user

### T005: Step 2 — Already-Initialized Branch (Route to /upgrade-project)

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`
**Type**: Modify
**Depends**: T003
**Acceptance**:
- [ ] Step 2I lists the already-existing spec directories so the user can audit
- [ ] Step 2I prompts the user (auto-accept in unattended mode) to delegate to `/upgrade-project`
- [ ] On user decline, the skill exits cleanly with a summary — no specs modified
- [ ] On user accept, the skill invokes `/upgrade-project` and exits after it returns
- [ ] No existing spec file is read, modified, or overwritten by this branch

### T006: Step 2 — Brownfield Branch, Pre-Reconciliation Preflight

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`
**Type**: Modify
**Depends**: T003
**Acceptance**:
- [ ] Step 2B verifies `gh auth status` succeeds before proceeding — aborts with clear message if not authenticated
- [ ] Step 2B checks whether `steering/` exists — if not, delegates to `/setup-steering` first (AC5), then re-verifies before continuing
- [ ] Step 2B handles the brownfield-no-issues empty state: reports "brownfield detected but zero closed issues" and offers to treat the project as greenfield-plus-existing-code (route to Step 2G)
- [ ] Step 2B reads `/write-spec` templates from `plugins/nmg-sdlc/skills/write-spec/templates/` (requirements.md, design.md, tasks.md, feature.gherkin) and stores them for synthesis

### T007: Step 3B — Brownfield Reconciliation Loop (Issue Fetch, Classify, Group, Synthesize)

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`
**Type**: Modify
**Depends**: T006
**Acceptance**:
- [ ] Step 3B issues `gh issue list --state closed --json number,title,body,labels,closedAt --limit 500` (pre-filter at the CLI, not in post-processing — retrospective learning)
- [ ] Per-issue evidence set is built in the order: issue body + comments, merged PR body, PR diff, commit messages, touched files — matching AC9
- [ ] Template variant selection follows AC4: `bug` label → defect template; no label → content heuristic on keywords `fix`, `bug`, `broken`, `regression`, `crash`, `error`; otherwise feature
- [ ] Issues closed as `duplicate`, `wontfix`, or `not-planned` are skipped with a note in the summary (Out of Scope item)
- [ ] Issues without a merged PR degrade per AC10 — spec is emitted with a `## Known Gaps` section; run continues
- [ ] Consolidation grouping: shared-label grouping AND Jaccard overlap ≥ 0.3 on title tokens after stop-word filter
- [ ] Consolidation confirmation via `AskUserQuestion` (auto-accept in unattended mode, decision logged for summary)
- [ ] Slugification uses strict allowlist `[a-z0-9-]` with length ≤ 60 chars — addresses the security consideration
- [ ] Per-spec synthesis writes all four files (requirements.md, design.md, tasks.md, feature.gherkin) using the templates read in T006
- [ ] `design.md` includes an "Evidence Sources" section listing which of {issue body, PR body, PR diff, commit messages, current code} contributed to each major section (AC9)
- [ ] FR16 — spec dirs that already exist are skipped; skip is recorded in the summary
- [ ] State isolation between issues: any in-memory evidence from issue N is discarded before issue N+1 begins (retrospective learning: inter-iteration isolation)

---

## Phase 3: Frontend Implementation

*Not applicable — this skill is prompt-based per `steering/structure.md`. No UI components are added.*

---

## Phase 4: Integration

### T008: Step 4 — Post-Reconciliation Verification

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`
**Type**: Modify
**Depends**: T007
**Acceptance**:
- [ ] Step 4 iterates every spec directory produced in this run
- [ ] For each spec, verifies all four files exist (requirements.md, design.md, tasks.md, feature.gherkin) — any missing file is a gap
- [ ] For each `design.md`, extracts referenced file paths and uses `Glob` or `Read` to confirm each exists in the working tree — missing files are gaps flagged in the summary
- [ ] Verification does not abort the run on gaps — it records them for Step 5 (AC8, retrospective learning: post-step artifact verification)

### T009: Step 5 — Summary Report

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`
**Type**: Modify
**Depends**: T008, T004, T005
**Acceptance**:
- [ ] Summary includes: mode detected, every spec directory produced with contributing issue numbers, every delegated skill invoked and its status (success/failure)
- [ ] Summary calls out any reconciled spec that references removed behavior (missing source files from T008)
- [ ] Summary lists every auto-decision made in unattended mode (consolidation groups auto-accepted, init-config auto-yes) — AC6
- [ ] Summary reminds the user to review reconciled specs before committing (security consideration — specs may contain internal URLs, repro data)
- [ ] Next step stated: "Run `/draft-issue` to add a new feature, or `/upgrade-project` to bring reconciled specs up to latest templates"

### T010: Register Skill in plugin.json and Bump Version

**File(s)**: `plugins/nmg-sdlc/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] `plugins/nmg-sdlc/.claude-plugin/plugin.json` `version` bumped one **minor** level (per tech.md — `enhancement` label → minor)
- [ ] `.claude-plugin/marketplace.json` plugin entry `version` matches `plugin.json` — invariant per CLAUDE.md and the Architectural Invariants table
- [ ] If the issue is the last open in its milestone, bump is **major** instead per `tech.md` version-bump classification — verify via `gh issue list --milestone <name> --state open`
- [ ] `marketplace.json` `metadata.version` is NOT bumped (collection version, not plugin version)

### T011: Update README.md and CHANGELOG.md

**File(s)**: `README.md`, `CHANGELOG.md`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [ ] `README.md` skills reference table adds `/onboard-project` with description and pipeline position
- [ ] `README.md` workflow diagram updated so `/onboard-project` appears before `/draft-issue` in the pipeline figure
- [ ] `README.md` installation/getting-started section notes `/onboard-project` as the first step for new users (replacing the manual `/setup-steering` → `/init-config` → `/draft-issue` guidance)
- [ ] `CHANGELOG.md` `[Unreleased]` section gets an entry under **Added**: `` - `/onboard-project` skill for greenfield bootstrap and brownfield spec reconciliation (#115) ``

---

## Phase 5: BDD Testing (Required)

**Every acceptance criterion MUST have a Gherkin test.**

This project uses exercise-based verification (per `tech.md`). BDD scenarios here serve as design artifacts and verification criteria for exercise testing via Agent SDK / Promptfoo / `claude -p` smoke tests.

### T012: Create feature.gherkin With All 11 AC Scenarios

**File(s)**: `specs/feature-add-onboard-project-skill/feature.gherkin`
**Type**: Create (already scaffolded by /write-spec)
**Depends**: None (can run in parallel with Phase 2)
**Acceptance**:
- [ ] Every AC from `requirements.md` has a corresponding `Scenario:` block
- [ ] Scenarios use concrete example data (not `foo`/`bar`)
- [ ] Scenarios are independent — no shared mutable state between them
- [ ] Valid Gherkin syntax — parses without error in any standard Gherkin parser
- [ ] Error and edge-case scenarios included (AC5, AC8, AC10)

### T013: Exercise-Test the Skill Against Three Fixture Projects

**File(s)**: No persistent file changes; exercise testing per `steering/tech.md`
**Type**: Verify (no file changes)
**Depends**: T009, T012
**Acceptance**:
- [ ] Fixture A (greenfield, empty repo) — `/onboard-project` routes to Step 2G, delegates to `/setup-steering`, offers `/init-config`, reports ready for `/draft-issue`
- [ ] Fixture B (brownfield, 3 closed issues — 1 bug, 1 feature with merged PR, 1 feature with no merged PR) — skill produces: 1 `bug-*/` dir (defect template), 1 `feature-*/` dir (feature template), 1 `feature-*/` dir with `## Known Gaps` per AC10
- [ ] Fixture C (already-initialized, specs/ populated) — skill detects and offers `/upgrade-project` without modifying any spec file
- [ ] Unattended exercise (`.claude/unattended-mode` present, Agent SDK with `ask_user_question.behavior: deny`) on Fixture B — no prompts fire, summary records auto-decisions
- [ ] Idempotency exercise — run `/onboard-project` twice on Fixture B; second run modifies zero files (verify via `git status --porcelain`)

### T014: Verify Skill Passes /verify-code Behavioral-Contract Checks

**File(s)**: No file changes — runs `/verify-code` against this feature's specs and the new skill
**Type**: Verify
**Depends**: T013
**Acceptance**:
- [ ] `/verify-code` reports the skill follows stack-agnostic invariant (no hardcoded languages/frameworks in `SKILL.md`)
- [ ] Every `AskUserQuestion` invocation in `SKILL.md` is guarded by an unattended-mode check (Skill Contracts invariant)
- [ ] Skill steps reference tools by correct name (`Read`, `Glob`, `Grep` — not `cat`, `find`, `grep`) per Prompt Quality Verification
- [ ] Output format of reconciled specs matches what `/write-code` expects as input (template-output chain)
- [ ] Cross-references to other skills resolve (`/setup-steering`, `/init-config`, `/upgrade-project`, `/write-spec` all exist in `plugins/nmg-sdlc/skills/`)

---

---

## Phase 6: Enhancement — Issue #124

Greenfield expansion: intent + tech-selection interview, milestone seeding, starter-issue seeding via `/draft-issue` loop with dependency inference + autolinking, optional Claude Design URL ingestion, steering-enhancement re-run mode, and absorption of `/setup-steering` into `/onboard-project`.

These tasks all amend the existing skill (built by T001–T014). They are written to be implementable after Issue #125 has landed its dependency-inference + autolinking primitive (Blocked By in requirements.md).

### T015: Absorb /setup-steering — Move Templates and Delete Standalone Skill

**File(s)**:
- `plugins/nmg-sdlc/skills/setup-steering/` (delete)
- `plugins/nmg-sdlc/skills/onboard-project/templates/product.md` (create — moved from `setup-steering/templates/product.md`)
- `plugins/nmg-sdlc/skills/onboard-project/templates/tech.md` (create — moved)
- `plugins/nmg-sdlc/skills/onboard-project/templates/structure.md` (create — moved)

**Type**: Move + Delete
**Depends**: None (pre-#124 work — runs first to free up the namespace)
**Acceptance**:
- [ ] All three steering templates exist under `plugins/nmg-sdlc/skills/onboard-project/templates/`
- [ ] Their content matches the prior `setup-steering/templates/` content byte-for-byte (use `git mv` semantics where possible)
- [ ] `plugins/nmg-sdlc/skills/setup-steering/` directory is removed in its entirety (`SKILL.md` + `templates/`)
- [ ] No file under `plugins/nmg-sdlc/skills/` still references `setup-steering/templates/`
- [ ] Maps to AC19, FR23

### T016: Rewrite /setup-steering References in Other Skills

**File(s)**: `plugins/nmg-sdlc/skills/upgrade-project/SKILL.md` (and any other skill identified by Grep)

**Type**: Modify
**Depends**: T015
**Acceptance**:
- [ ] `Grep` for `/setup-steering` across `plugins/nmg-sdlc/skills/**/SKILL.md` returns zero hits after edits
- [ ] Each rewritten reference points at `/onboard-project` (or removes the indirection where the new entry point makes it unnecessary, per FR24)
- [ ] No skill behavior is silently broken — exercise `/upgrade-project` mentally against its new instructions to confirm intent is preserved
- [ ] Maps to AC19, FR24

### T017: Update SKILL.md Frontmatter for #124

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`
**Type**: Modify
**Depends**: T015
**Acceptance**:
- [ ] `description` updated to reflect new capabilities (intent interview, milestone + issue seeding, autolinking, design URL ingestion) and to drop `/setup-steering` from the delegation list, add `/draft-issue`
- [ ] `allowed-tools` adds `WebFetch` and `Bash(node:*)`
- [ ] `argument-hint` adds `[--design-url <url>]`
- [ ] Frontmatter still parses as valid YAML
- [ ] Maps to design.md → "Frontmatter Updates Required by Issue #124"

### T018: Step 2G.1 — Optional Claude Design URL Ingestion

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`
**Type**: Modify
**Depends**: T017
**Acceptance**:
- [ ] Sub-step 2G.1 added before any existing Step 2G content
- [ ] If `--design-url` argument present, use that URL; else `AskUserQuestion`: "Provide a Claude Design URL? (optional, press Enter to skip)" — guarded by unattended-mode check (skip prompt; use arg or empty)
- [ ] URL validated as HTTPS before fetch — non-HTTPS aborts the design step (continues without context per AC20)
- [ ] `WebFetch` invoked with 30s timeout
- [ ] If response indicates gzip (content-type or magic bytes `1f 8b`), decode via `Bash(node -e "...gunzipSync...")`
- [ ] Archive entries listed (filename, size); `README.md` or `README` content surfaced to the user as a summary
- [ ] All payload content displayed in fenced code blocks (no shell interpolation)
- [ ] Failure modes (network, HTTP error, decode error, missing README) all log + record gap + continue per AC20
- [ ] Parsed payload stored as `design_context` for later sub-steps
- [ ] Maps to AC17, AC20, FR25, FR26

### T019: Step 2G.2 — Intent + Tech-Selection Interview

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`
**Type**: Modify
**Depends**: T018
**Acceptance**:
- [ ] Sub-step 2G.2 conducts multi-round `AskUserQuestion` interview, rounds in order: vision, target users/personas, success criteria, language, framework, test tooling, deployment target
- [ ] Each round's question pre-populates defaults from (in priority order): existing steering content (enhancement mode), `design_context` from 2G.1, the steering-template defaults
- [ ] Unattended-mode branch: skip prompts, apply defaults from same priority chain, log every applied default with its source ("from design context", "from template default", "from existing steering") for the Step 5 summary
- [ ] Interview answers stored as `interview_context` for later sub-steps
- [ ] Maps to AC1, AC12, FR17

### T020: Step 2G.3 — Steering Bootstrap (Absorbed) + Enhancement Mode

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`
**Type**: Modify
**Depends**: T015, T019
**Acceptance**:
- [ ] Sub-step 2G.3 reads templates from `plugins/nmg-sdlc/skills/onboard-project/templates/` (not from the deleted `setup-steering/`)
- [ ] **Bootstrap mode** (steering files do not exist): populate templates with `interview_context`, `Write` `steering/product.md`, `steering/tech.md`, `steering/structure.md`
- [ ] **Enhancement mode** (steering files exist — Greenfield-Enhancement per the updated Mode Detection Matrix): for each section that has a corresponding answer in `interview_context` differing from the existing value, present the diff (auto-apply in unattended mode but log it), then `Edit` the section in place — do not `Write` (would overwrite unrelated sections)
- [ ] Verify all three steering files exist after the sub-step; record a gap if any are missing
- [ ] Maps to AC18, AC19, FR23, FR27

### T021: Step 2G.4 — Idempotent Milestone Seeding

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`
**Type**: Modify
**Depends**: T020
**Acceptance**:
- [ ] Sub-step 2G.4 lists existing milestones via `gh api "repos/{owner}/{repo}/milestones?state=all&per_page=100" --jq '.[].title'`
- [ ] For each of `v1 (MVP)` and `v2`: skip if exact title already present; else `gh api --method POST` to create
- [ ] Per-milestone failures (HTTP error, permission denied, name collision) recorded as gaps in the Step 5 summary; loop continues
- [ ] On enhancement re-run, both milestones are detected as already-present and skipped
- [ ] Maps to AC13, AC18, FR18, FR27

### T022: Step 2G.5 — Starter-Issue Candidate Generation

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`
**Type**: Modify
**Depends**: T021
**Acceptance**:
- [ ] Sub-step 2G.5 synthesizes 3–7 starter-issue candidates from `interview_context` and `design_context`
- [ ] Each candidate carries: `title`, `milestone` (`v1 (MVP)` or `v2`), `body_seed`, `component_refs[]`, `ordering_cue`
- [ ] Candidate count enforced: minimum 3, maximum 7 (FR19); if interview yields more, present a top-7 cut for user confirmation (auto-cut in unattended mode, logged)
- [ ] Enhancement-mode filter: query `gh issue list --label seeded-by-onboard --state all --json title` and drop any candidate whose title matches an existing seeded issue
- [ ] Maps to AC14, AC18, FR19, FR27

### T023: Step 2G.6 — Dependency DAG Inference + Confirmation Gate

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`
**Type**: Modify
**Depends**: T022
**Acceptance**:
- [ ] Sub-step 2G.6 builds DAG edges per the rules in design.md → "Dependency Inference Contract": shared component refs, ordering cues, milestone gate (v2 cannot block v1)
- [ ] Cycle detection via DFS three-color marking; on cycle → log + skip wiring entirely (proceed to 2G.7 without autolinks)
- [ ] DAG rendered as ASCII for user inspection
- [ ] `AskUserQuestion`: approve / adjust / proceed-without-DAG (auto-accept in unattended mode, full DAG logged)
- [ ] Maps to AC15, FR20, FR21

### T024: Step 2G.7 — Starter-Issue Seeding Loop with Autolinking

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`
**Type**: Modify
**Depends**: T023, **Issue #125 (Blocked By)**
**Acceptance**:
- [ ] Sub-step 2G.7 iterates candidates in topological order from 2G.6 (or arbitrary order if DAG step was skipped)
- [ ] For each candidate: invoke `/draft-issue` with `interview_context` + `design_context` + this candidate's seed; capture the created issue number
- [ ] Apply `seeded-by-onboard` label via `gh issue edit <num> --add-label seeded-by-onboard` (create the label first if missing — `gh label create seeded-by-onboard --color 0E8A16 --description "Issue seeded by /onboard-project"`)
- [ ] For each DAG parent of this candidate already created: `gh issue edit <self> --add-sub-issue <parent>`; append `Depends on: #<parent>` to the seeded body
- [ ] For each DAG child queued for later: when the child is seeded, its body gets a `Blocks: #<self>` line
- [ ] Per-issue failures recorded as gaps; loop continues
- [ ] Reuses the autolinking primitive from Issue #125 — no inline reimplementation
- [ ] State isolation between iterations: any in-memory candidate state from candidate N is discarded before N+1 (retrospective learning)
- [ ] Maps to AC14, AC16, FR19, FR22

### T025: Update Step 5 Summary for #124

**File(s)**: `plugins/nmg-sdlc/skills/onboard-project/SKILL.md`
**Type**: Modify
**Depends**: T024
**Acceptance**:
- [ ] Step 5 summary extended to include: design URL fetch result (success / skipped / failed-with-reason), interview defaults applied (with source per default), milestones seeded vs skipped, full DAG (or "skipped due to cycle"), every starter issue created with its number and DAG neighbors, every gap recorded across all sub-steps
- [ ] Summary calls out next-step instruction: "Run `/draft-issue` to add more issues, or proceed with `/start-issue` on a seeded starter."
- [ ] Maps to AC11 (extended), AC18 (logging enhancement-mode skips), FR28

### T026: Update README, CHANGELOG, Plugin Version, and Verify-Code Pass

**File(s)**: `README.md`, `CHANGELOG.md`, `plugins/nmg-sdlc/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `specs/feature-add-onboard-project-skill/feature.gherkin`
**Type**: Modify
**Depends**: T025
**Acceptance**:
- [ ] `README.md` skills reference: drop `/setup-steering`; expand `/onboard-project` description with new capabilities; update workflow diagram
- [ ] `CHANGELOG.md` `[Unreleased]`:
  - **Added**: intent interview, v1/v2 milestone seeding, starter-issue seeding via `/draft-issue` loop with dependency-aware autolinking, optional Claude Design URL ingestion, steering-enhancement re-run mode (#124)
  - **Removed**: standalone `/setup-steering` skill — absorbed into `/onboard-project` (#124)
- [ ] Both `plugin.json` and `marketplace.json` versions bumped one **minor** level (per CLAUDE.md invariant — both files update together; `enhancement` label = minor unless this is the last open issue in the milestone, in which case = major — verify via `gh issue list --milestone v6 --state open`)
- [ ] `marketplace.json` `metadata.version` is NOT bumped
- [ ] `feature.gherkin` already contains the new scenarios (added in this spec amendment); confirm syntactic validity
- [ ] Run `/verify-code` against the amended skill — must pass: stack-agnostic, every `AskUserQuestion` guarded by unattended-mode check, all tool refs valid, all delegated skills exist (`/init-config`, `/upgrade-project`, `/draft-issue`), no `/setup-steering` reference left anywhere

---

## Dependency Graph

```
T001 ──▶ T002 ──▶ T003 ──┬──▶ T004 ────────────────────┐
                          │                             │
                          ├──▶ T005 ────────────────────┤
                          │                             │
                          └──▶ T006 ──▶ T007 ──▶ T008 ──┼──▶ T009
                                                        │
T001 ──▶ T010                                           │
T002 ──▶ T011                                           │
                                                        │
T012 ─────────────────────────────────────────┐         │
                                              │         │
                                              └──▶ T013 ──▶ T014
                                                   ▲
                                                   │
                                                  T009

# Phase 6 — Issue #124 (runs after Phase 5 of #115 has shipped)

T015 ──┬──▶ T016
       │
       └──▶ T017 ──▶ T018 ──▶ T019 ──▶ T020 ──▶ T021 ──▶ T022 ──▶ T023 ──▶ T024 ──▶ T025 ──▶ T026
                                                                              ▲
                                                                              │
                                                                       Issue #125 (external blocker)
```

T012 (feature.gherkin) can be written in parallel with Phase 2 since it derives from `requirements.md`, not from implementation. T024 is hard-blocked on Issue #125 landing the autolinking primitive in `/draft-issue`.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #115 | 2026-04-18 | Initial feature spec |
| #124 | 2026-04-18 | Added Phase 6 (T015–T026): absorb `/setup-steering`, add greenfield interview, milestone seeding, starter-issue seeding via `/draft-issue` loop, dependency inference + autolinking (consumes Issue #125 primitive), Claude Design URL ingestion, steering-enhancement re-run mode. Updated summary table; T024 hard-blocked on Issue #125. |

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently given dependencies
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test tasks are included (T012–T014)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
