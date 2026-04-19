# Tasks: Add /onboard-project Skill

**Issues**: #115
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
| **Total** | **14** | |

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
```

T012 (feature.gherkin) can be written in parallel with Phase 2 since it derives from `requirements.md`, not from implementation.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #115 | 2026-04-18 | Initial feature spec |

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
