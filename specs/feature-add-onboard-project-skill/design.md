# Design: Add /onboard-project Skill

**Issues**: #115, #124
**Date**: 2026-04-18
**Status**: Draft
**Author**: Claude

---

## Overview

`/onboard-project` is a new prompt-based skill under `plugins/nmg-sdlc/skills/onboard-project/SKILL.md` that becomes the single entry point for initializing a project for the SDLC. It does not replace any existing skill — it orchestrates them. At runtime it detects one of three modes (greenfield, brownfield, already-initialized) and routes work accordingly, delegating steering-doc bootstrap to `/setup-steering`, config generation to `/init-config`, and template reconciliation to `/upgrade-project` — all existing skills.

The novel capability this skill introduces is **brownfield reconciliation**: reading closed GitHub issues, their merged PR diffs and commit messages, and the current implementation, then synthesizing one `specs/{feature,bug}-{slug}/` directory per reconciled feature using the same templates `/write-spec` uses. Reconciliation is bounded by evidence — specs are emitted only for closed issues whose code landed, and gaps are surfaced in the final summary rather than silently filled.

Key architectural commitment: **this skill delegates rather than duplicates**. Steering-doc logic lives in `/setup-steering`; config logic lives in `/init-config`; template drift logic lives in `/upgrade-project`. `/onboard-project` owns only mode detection, issue-to-spec reconciliation, and summary reporting.

> **Issue #124 amendment** — `/setup-steering` is **absorbed** into `/onboard-project`. The "delegates rather than duplicates" commitment is preserved for `/init-config` and `/upgrade-project`; for steering, the bootstrap and in-place enhancement logic now lives directly in Step 2G (greenfield) and the new Step 2I-Enhancement (re-run with steering present but specs absent). Issue #124 also expands greenfield's responsibilities: intent + tech-selection interview, `v1`/`v2` milestone seeding, starter-issue seeding via `/draft-issue` loop with dependency inference + autolinking (reusing Issue #125's primitive), and optional Claude Design URL ingestion. Brownfield (Step 2B/3B) is unchanged.

---

## Architecture

### Component Diagram

`/onboard-project` is a Markdown skill (per `steering/structure.md` → Skill Contracts). The "components" are workflow steps inside `SKILL.md` and the delegated skills it invokes.

```
┌────────────────────────────────────────────────────────────────────┐
│                     /onboard-project (SKILL.md)                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────┐                                              │
│  │ Step 0:          │                                              │
│  │ Legacy layout    │─── abort if .claude/steering/ exists         │
│  │ precondition     │                                              │
│  └────────┬─────────┘                                              │
│           ▼                                                        │
│  ┌──────────────────┐                                              │
│  │ Step 1:          │  reads:                                      │
│  │ Detect mode      │  - ls steering/, specs/                      │
│  │ (green/brown/    │  - ls src files (excl. scaffold)             │
│  │  initialized)    │  - gh issue list --state closed --limit 1    │
│  └────────┬─────────┘                                              │
│           ▼                                                        │
│      ┌────┴────┬─────────────┐                                     │
│      ▼         ▼             ▼                                     │
│  Greenfield  Brownfield   Initialized                              │
│      │         │             │                                     │
│      ▼         ▼             ▼                                     │
│  Step 2G:   Step 2B:      Step 2I:                                 │
│  delegate   ensure        offer                                    │
│  /setup-    steering,     /upgrade-                                │
│  steering   then          project                                  │
│    │        reconcile       │                                      │
│    ▼          │              ▼                                     │
│  Step 3G:     ▼          (exits after delegation)                  │
│  offer     Step 3B:                                                │
│  /init-    read closed                                             │
│  config    issues, PRs,                                            │
│    │       code; group;                                            │
│    │       reconcile                                               │
│    │         │                                                     │
│    ▼         ▼                                                     │
│  ┌──────────────────┐                                              │
│  │ Step 4:          │                                              │
│  │ Verify artifacts │  — confirm all 4 files per spec dir          │
│  │ + referenced     │  — confirm referenced source files exist    │
│  │ source files     │                                              │
│  └────────┬─────────┘                                              │
│           ▼                                                        │
│  ┌──────────────────┐                                              │
│  │ Step 5:          │                                              │
│  │ Summary report   │  mode, specs, delegations, gaps              │
│  └──────────────────┘                                              │
└────────────────────────────────────────────────────────────────────┘
         │
         │ delegates to
         ▼
┌────────────────────────────────────────────────────────────────────┐
│  Existing Skills (unchanged)                                       │
│  /setup-steering  /init-config  /upgrade-project  /write-spec      │
│                                                     (templates)    │
└────────────────────────────────────────────────────────────────────┘
```

### Mode-Detection Decision Table

| `steering/` exists | `specs/` has specs | Source files beyond scaffold | Closed issues exist | Mode |
|--------------------|--------------------|------------------------------|---------------------|------|
| Any | **Yes** | Any | Any | **Already initialized** |
| No | No | No | No | **Greenfield** |
| Yes | No | No | No | **Greenfield-Enhancement** (#124 — steering pre-seeded; enter enhancement mode) |
| Any | No | **Yes** | Yes | **Brownfield** |
| Any | No | Yes | **No** | **Brownfield-no-issues** (reported as empty state, AC per UI/UX) |

"Source files beyond scaffold" means files outside the allowlist `{README.md, .gitignore, package.json, pyproject.toml, Cargo.toml, go.mod, LICENSE}`. The skill counts files recursively, excluding `node_modules/`, `.git/`, and hidden directories.

**(#124)** The `Yes / No / No / No` row was previously labeled "Greenfield (steering pre-seeded)"; under #124 it routes to **Greenfield-Enhancement mode** (FR27, AC18). Behavior: the interview reads existing steering values and presents them as defaults rather than as blank prompts; steering files are edited in place (not overwritten); milestone + starter-issue seeding is gated by idempotency checks against `seeded-by-onboard` label and prior-run summary.

### Greenfield Enhanced Workflow (#124)

The greenfield branch is no longer a thin delegation to `/setup-steering` + `/init-config`. Step 2G now runs a multi-phase orchestration:

```
Step 2G — Greenfield (or Greenfield-Enhancement on re-run):

  ┌──────────────────────────────────────────────────────────────────┐
  │ 2G.1  Optional Claude Design URL ingestion                       │
  │       - AskUserQuestion: "Provide a Claude Design URL?"          │
  │       - fetch via built-in fetch (no curl, no shell interpolation)│
  │       - decode gzip via node:zlib gunzipSync                     │
  │       - read README from extracted archive                       │
  │       - on failure → log + record gap + continue without context │
  └────────────────────────────┬─────────────────────────────────────┘
                               ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ 2G.2  Intent + Tech-Selection Interview                          │
  │       - AskUserQuestion multi-question rounds                    │
  │       - Rounds: vision, personas, success criteria, language,    │
  │         framework, test tooling, deployment target               │
  │       - Defaults sourced from design payload (if any) and from   │
  │         steering templates                                        │
  │       - Enhancement mode: existing steering values are defaults  │
  │       - Unattended: skip prompts, apply defaults, log all in S5  │
  └────────────────────────────┬─────────────────────────────────────┘
                               ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ 2G.3  Steering Bootstrap (absorbed from /setup-steering)         │
  │       - Bootstrap mode: Write product.md, tech.md, structure.md  │
  │         from templates, populated with interview answers         │
  │       - Enhancement mode: Edit in place via Edit tool            │
  │       - Verify all three files exist before continuing           │
  └────────────────────────────┬─────────────────────────────────────┘
                               ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ 2G.4  Milestone Seeding                                          │
  │       - For each of {"v1 (MVP)", "v2"}:                          │
  │           gh api repos/{owner}/{repo}/milestones \               │
  │             --jq ".[] | select(.title == \"<name>\") | .number"  │
  │           if not present → POST /repos/{owner}/{repo}/milestones │
  │       - Per-milestone failures recorded as gaps; loop continues  │
  └────────────────────────────┬─────────────────────────────────────┘
                               ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ 2G.5  Starter-Issue Candidate Generation                         │
  │       - Synthesize 3–7 candidates from interview answers and    │
  │         (if present) design payload's surfaced files             │
  │       - Each candidate: { title, milestone, body_seed,           │
  │           component_refs[], ordering_cue }                       │
  │       - Enhancement mode: cross-check against open issues with  │
  │         label "seeded-by-onboard" and skip duplicates            │
  └────────────────────────────┬─────────────────────────────────────┘
                               ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ 2G.6  Dependency DAG Inference + Confirmation Gate               │
  │       - Build edges from:                                        │
  │           a) shared component_refs between candidates             │
  │           b) explicit ordering_cue mentions                       │
  │           c) milestone mapping (v2 cannot block v1)               │
  │       - Cycle detection (DFS): if cycle → log + skip wiring step │
  │       - Render DAG as ASCII for the user                         │
  │       - AskUserQuestion: approve / adjust / proceed without DAG  │
  │       - Unattended: auto-accept; log proposed DAG for summary    │
  └────────────────────────────┬─────────────────────────────────────┘
                               ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ 2G.7  Starter-Issue Seeding Loop (delegates to /draft-issue)     │
  │       - For each candidate (in topological order from 2G.6):     │
  │           a) Invoke /draft-issue with shared interview context  │
  │              + this candidate's seed                              │
  │           b) Capture created issue number                        │
  │           c) Apply "seeded-by-onboard" label via gh issue edit   │
  │           d) For each DAG parent of this candidate already       │
  │              created: gh issue edit <self> --add-sub-issue       │
  │              <parent>; append "Depends on: #<parent>" to body    │
  │           e) For each DAG child not yet created: queue a         │
  │              "Blocks: #<self>" insertion when child is seeded    │
  │       - Per-issue failure → record gap; continue loop            │
  │       - Reuses Issue #125's autolinking primitive (FR22)         │
  └────────────────────────────┬─────────────────────────────────────┘
                               ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ Step 3G — Delegate to /init-config (unchanged from #115)         │
  │  Step 5 — Summary (extended: interview defaults applied,         │
  │           design fetch result, milestones seeded/skipped, issues │
  │           seeded with their issue numbers, DAG, gaps)            │
  └──────────────────────────────────────────────────────────────────┘
```

### Steering-Enhancement Mode (Re-Run, #124)

When mode detection lands in **Greenfield-Enhancement** (steering exists, specs do not), the same Step 2G pipeline runs with three behavior shifts:

| Sub-step | Bootstrap behavior | Enhancement behavior |
|----------|--------------------|----------------------|
| 2G.2 Interview | Defaults from templates / design payload | Defaults from existing steering content (parse `# Vision`, `# Tech Stack`, etc. headings) |
| 2G.3 Steering write | `Write` tool (create file) | `Edit` tool (in-place modify, preserve unrelated sections) |
| 2G.4 Milestone seeding | Always create | Detect existing `v1 (MVP)` / `v2` and skip |
| 2G.5 Candidate generation | All candidates new | Filter out candidates whose title matches an open issue with `seeded-by-onboard` label |
| 2G.6 DAG | Build from scratch | Build only over the not-yet-seeded subset; never rewrite existing `--add-sub-issue` edges |

### Data Flow — Brownfield Reconciliation (Step 3B)

```
1. Fetch closed issues:      gh issue list --state closed --json number,title,body,labels,closedAt --limit 500
2. For each issue:
     a. Fetch issue detail:  gh issue view N --json body,labels,comments
     b. Find merged PR:      gh issue view N --json closedByPullRequestsReferences
     c. If PR exists:        gh pr view <prnum> --json body,files,commits
                             gh pr diff <prnum>
     d. Build evidence set:  { issue_body, pr_body, pr_diff, commit_msgs, touched_files }
     e. Classify template:   bug label OR keyword heuristic → defect template
                             else → feature template
3. Group issues:             by shared label AND by keyword overlap (Jaccard ≥ 0.3 on title tokens)
4. Confirm groups:           AskUserQuestion (unless unattended → auto-accept)
5. For each group (or single issue):
     a. Slugify name:        feature-{slug} or bug-{slug}
     b. Skip if spec dir already exists (FR16)
     c. Synthesize requirements.md from evidence using /write-spec templates
     d. Synthesize design.md listing which evidence source fed each section
     e. Synthesize tasks.md mapped to currently-existing source files
     f. Synthesize feature.gherkin from ACs
     g. Write all four files atomically (stage in memory, then write)
6. Post-write verification (Step 4):
     - Confirm all 4 files present in each new spec dir
     - For each file referenced in design.md, confirm it exists in working tree
     - Record gaps, do not abort
```

---

## API / Interface Changes

### New Skill Entry Point

| Skill | Argument | Purpose |
|-------|----------|---------|
| `/onboard-project` | `[--dry-run]` (optional) | Initialize project for SDLC (greenfield bootstrap or brownfield reconciliation) |

### Skill Frontmatter (YAML, per `tech.md`)

```yaml
---
name: onboard-project
description: "Initialize a project for the SDLC — bootstrap greenfield projects or reconcile specs for brownfield projects from closed GitHub issues and merged PR diffs. Use when user says 'onboard project', 'bootstrap project', 'initialize project', 'adopt nmg-sdlc', 'set up nmg-sdlc', 'I need specs for an existing codebase', or 'reconcile specs from history'. Do NOT use for writing specs for new features (that is /write-spec), for updating existing specs to current templates (that is /upgrade-project), or for creating issues/PRs. Delegates to /setup-steering, /init-config, and /upgrade-project where appropriate. Pipeline position: runs once per project lifetime, before /draft-issue."
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(gh:*), Bash(git:*), Bash(ls:*), Bash(wc:*), AskUserQuestion
argument-hint: "[--dry-run]"
---
```

#### Frontmatter Updates Required by Issue #124

```yaml
---
name: onboard-project
description: "Initialize a project for the SDLC — bootstrap greenfield projects with intent + tech-selection interview, v1/v2 milestone seeding, and 3–7 starter issues seeded via /draft-issue with dependency-aware autolinking; or reconcile specs for brownfield projects from closed GitHub issues and merged PR diffs. Optionally ingests a Claude Design URL as interview + seed context. Use when user says 'onboard project', 'bootstrap project', 'initialize project', 'adopt nmg-sdlc', 'set up nmg-sdlc', 'I need specs for an existing codebase', or 'reconcile specs from history'. Do NOT use for writing specs for new features (that is /write-spec), for updating existing specs to current templates (that is /upgrade-project), or for creating issues/PRs. Delegates to /init-config, /upgrade-project, and /draft-issue (in a loop) where appropriate. Pipeline position: runs once per project lifetime, before /draft-issue."
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Write, Edit, WebFetch, Bash(gh:*), Bash(git:*), Bash(ls:*), Bash(wc:*), Bash(node:*), AskUserQuestion
argument-hint: "[--dry-run] [--design-url <url>]"
---
```

Changes vs the original frontmatter:

| Field | Change | Rationale |
|-------|--------|-----------|
| `description` | Add intent interview, milestone seeding, starter-issue seeding, autolinking, Claude Design ingestion to capability list. Drop `/setup-steering` from "Delegates to" list (it no longer exists). Add `/draft-issue` to delegation list. | AC8 (absorption), AC1/AC3/AC6 (new capabilities) |
| `allowed-tools` | Add `WebFetch` (Claude Design URL ingestion); add `Bash(node:*)` (gzip decode via `node -e "require('node:zlib').gunzipSync(...)"` if WebFetch alone proves insufficient for binary payloads — fallback path) | FR25 |
| `argument-hint` | Add `[--design-url <url>]` | AC17 |

### Delegation Contracts

| Invoked Skill | When | Success Criterion |
|---------------|------|-------------------|
| ~~`/setup-steering`~~ | ~~Greenfield mode OR brownfield-missing-steering~~ | **(#124, AC19)** Removed — logic absorbed into Step 2G.3 of this skill; standalone skill deleted |
| `/init-config` | Greenfield mode, after Step 2G completes, user confirms (auto-yes in unattended mode) | `sdlc-config.json` exists at project root |
| `/upgrade-project` | Already-initialized mode | User-facing — `/onboard-project` exits after delegation returns |
| `/draft-issue` | **(#124)** Greenfield Step 2G.7, once per starter-issue candidate | New issue exists in GitHub with the expected title; issue number is captured for autolinking |

The skill does **not** invoke `/write-spec` — it uses `/write-spec`'s template files directly (read via `Read` tool from `plugins/nmg-sdlc/skills/write-spec/templates/`). This avoids the overhead of one `/write-spec` invocation per reconciled issue and lets the skill batch-synthesize specs from aggregated evidence.

#### Steering-Bootstrap Logic Absorbed from `/setup-steering` (#124, FR23)

The Step 2G.3 sub-step replaces the prior `/setup-steering` delegation with inlined logic:

1. Read steering templates from `plugins/nmg-sdlc/skills/onboard-project/templates/` (templates relocated from `plugins/nmg-sdlc/skills/setup-steering/templates/` as part of the absorption — see Storage Changes below)
2. **Bootstrap mode** (steering does not exist): populate templates with interview answers, write three files via `Write`
3. **Enhancement mode** (steering exists): for each section that has a corresponding interview answer that differs from the existing value, surface the diff to the user (auto-accept in unattended mode), then `Edit` the section in place
4. Verify all three files exist before proceeding

#### Claude Design URL Fetch Contract (#124, FR25)

| Step | Implementation |
|------|----------------|
| Fetch | `WebFetch` tool with the user-supplied URL; timeout 30s |
| Decode | If response content-type indicates gzip OR magic bytes `1f 8b` are present, decode via `node -e` invoking `node:zlib.gunzipSync` (Bash tool, allowed-tools includes `Bash(node:*)`); else treat as plain text |
| Parse | Look for `README.md` or `README` at archive root; read and summarize via the model |
| Surface | List archive entries (filename, size, MIME-guess) to the user; propose design-derived starter-issue candidates |
| Failure modes | Network/timeout/HTTP error → log and continue (AC20); decode error → log and continue (AC20); empty README → continue with whatever else was extracted |

#### Milestone Seeding Contract (#124, FR18)

| Operation | Command |
|-----------|---------|
| List existing milestones | `gh api "repos/{owner}/{repo}/milestones?state=all&per_page=100" --jq '.[].title'` |
| Create milestone | `gh api --method POST "repos/{owner}/{repo}/milestones" --field title="<name>" --field description="<desc>"` |
| Idempotency check | Title-exact match against the listed set; skip create if present |

#### Dependency Inference Contract (#124, FR20, FR21)

Inputs: candidate set `[{ title, milestone, body_seed, component_refs[], ordering_cue }]`.

Edge construction rules:

1. **Shared component refs** — if candidate A's `component_refs` is a strict subset of B's, A is a parent of B (A introduces the component, B builds on it)
2. **Ordering cue** — phrases like "first", "before", "depends on" surfaced in the interview create explicit edges
3. **Milestone gate** — drop any edge that would have a `v2` candidate as parent of a `v1` candidate (invariant from FR20)

Cycle detection: standard DFS with three-color marking (white/gray/black). On any back edge, abort the DAG step entirely — do not partially wire — and proceed to 2G.7 with each candidate seeded standalone (no autolinks).

#### Autolinking Contract (#124, FR22, AC16)

This skill does not implement autolinking primitives. It calls into the helper landed by Issue #125. Expected interface (from #125):

```text
addSubIssue(parent_number, child_number) → success | failure_reason
formatDependencyLines(depends_on: number[], blocks: number[]) → markdown_block
```

If Issue #125 is not yet shipped at #124's implementation time, this skill must block on it (per Dependencies → Blocked By in requirements.md).

### Request / Response Schemas — Closed Issue Reconciliation

Input (one per issue):
```json
{
  "issue": {
    "number": 42,
    "title": "Add dark mode toggle",
    "body": "...markdown...",
    "labels": [{ "name": "enhancement" }],
    "closedAt": "2025-09-12T14:22:00Z"
  },
  "pr": {
    "number": 51,
    "body": "...markdown...",
    "files": [{ "path": "src/theme.ts", "additions": 42, "deletions": 3 }],
    "commits": [{ "messageHeadline": "feat: add dark mode toggle" }]
  },
  "diff": "unified-diff-text",
  "currentFiles": ["src/theme.ts", "src/settings.tsx"]
}
```

Output (one spec directory):
```
specs/feature-add-dark-mode-toggle/
├── requirements.md   — populated from issue body + PR body; Issues: #42
├── design.md         — populated from PR diff + current code; lists evidence sources per section
├── tasks.md          — reverse-engineered from PR commits, tasks marked Complete
└── feature.gherkin   — scenarios from reconstructed ACs in requirements.md
```

Errors per issue (recorded in summary, run continues):

| Code | Condition |
|------|-----------|
| `NO_PR` | Issue was closed without a merged PR — degrade per AC10, emit spec with "Known Gaps" section |
| `SPEC_DIR_EXISTS` | Slug collides with existing spec directory — skip per FR16 |
| `SOURCE_REMOVED` | design.md references files not present in working tree — emit spec, flag in summary |

---

## Database / Storage Changes

None. The skill reads from git, the working tree, and GitHub via `gh` CLI; writes to `specs/`. No persistent storage layer.

### File Tree Changes (#124)

| Path | Change | Reason |
|------|--------|--------|
| `plugins/nmg-sdlc/skills/setup-steering/` | **Delete** entire directory (SKILL.md + templates/) | AC19, FR23 — absorbed into `/onboard-project` |
| `plugins/nmg-sdlc/skills/onboard-project/templates/` | **New** directory | Houses the steering templates relocated from `setup-steering/templates/` so Step 2G.3 can read them via `Read` tool |
| `plugins/nmg-sdlc/skills/onboard-project/templates/product.md` | **Move** from `setup-steering/templates/product.md` | Steering bootstrap reads this template |
| `plugins/nmg-sdlc/skills/onboard-project/templates/tech.md` | **Move** from `setup-steering/templates/tech.md` | Steering bootstrap reads this template |
| `plugins/nmg-sdlc/skills/onboard-project/templates/structure.md` | **Move** from `setup-steering/templates/structure.md` | Steering bootstrap reads this template |
| `plugins/nmg-sdlc/skills/upgrade-project/SKILL.md` | **Edit** — rewrite all `/setup-steering` references | FR24 |
| `plugins/nmg-sdlc/skills/onboard-project/SKILL.md` | **Edit** — frontmatter, Step 2G expansion, new sub-steps 2G.1–2G.7, Step 2I-Enhancement branch | All #124 ACs |
| `.claude-plugin/marketplace.json` + `plugins/nmg-sdlc/.claude-plugin/plugin.json` | **Edit** — minor version bump | Per CLAUDE.md and tech.md version-bump policy (`enhancement` label → minor) |
| `CHANGELOG.md` | **Edit** — `[Unreleased]` adds Added/Changed/Removed entries | Removal of `/setup-steering` is significant; record it explicitly |
| `README.md` | **Edit** — drop `/setup-steering` from skill list, expand `/onboard-project` description, update workflow diagram | Public docs must stay in sync |

### Artifact File Writes

| Path | Operation | Rollback on Failure |
|------|-----------|---------------------|
| `specs/{feature,bug}-{slug}/requirements.md` | Create (FR16 skips if exists) | `Write` tool semantics — no partial writes |
| `specs/{feature,bug}-{slug}/design.md` | Create | Same |
| `specs/{feature,bug}-{slug}/tasks.md` | Create | Same |
| `specs/{feature,bug}-{slug}/feature.gherkin` | Create | Same |

Atomicity strategy: synthesize all four files' content into memory for one spec directory, then `Write` them in sequence. If any write fails mid-sequence, the partial directory is reported as a gap in the summary (Step 5) — not rolled back. Rationale: `Write` tool is synchronous and failures are rare; atomic-rename semantics would require shell gymnastics inconsistent with the "skills are Markdown, not code" invariant.

---

## State Management

The skill is stateless between invocations. All state lives in:

| State | Where | Lifetime |
|-------|-------|----------|
| Mode detection evidence | In-memory during a single invocation | Per-invocation |
| Reconciliation progress | In-memory (per-issue evidence set, per-group decisions) | Per-invocation |
| Unattended flag | `.claude/unattended-mode` file presence | External |
| Dry-run flag | `--dry-run` argument | Per-invocation |

No lock files or flag files are created by this skill (applying retrospective learning: avoid artifact lifecycle gaps).

---

## UI Components

N/A — this is a prompt-based skill; no UI components. User interaction is via `AskUserQuestion` for consolidation confirmation and optional `/init-config` invocation, both guarded by the unattended-mode check.

### Interaction Surfaces

| Surface | Trigger | Unattended Mode |
|---------|---------|-----------------|
| Consolidation confirmation per group | Step 3B — groups with ≥2 issues | Auto-accept proposed grouping |
| `/init-config` invocation | Step 3G — after greenfield steering bootstrap | Auto-yes (default behavior) |
| Already-initialized routing | Step 2I — offer `/upgrade-project` | Auto-delegate |

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: One skill per mode** | Separate `/onboard-greenfield` and `/reconcile-brownfield` skills | Clearer single-responsibility per skill | User must know which to run; defeats the "single entry point" goal | Rejected — contradicts the issue's core motivation |
| **B: Extend `/setup-steering`** | Add reconciliation to existing `/setup-steering` | One fewer skill in the marketplace | Violates "one skill = one SDLC step" invariant; `/setup-steering` becomes two skills in a trench coat | Rejected — structural invariant violation |
| **C: Invoke `/write-spec` once per issue** | Delegate spec synthesis to `/write-spec` in a loop | Reuses existing synthesis logic verbatim | `/write-spec` is issue-driven and prompts for human review gates per issue; batching would fire dozens of prompts in interactive mode; unattended mode would still cost N × `/write-spec` overhead | Rejected — poor UX and high token cost |
| **D: New skill, delegates + direct template use** | `/onboard-project` delegates to `/setup-steering`, `/init-config`, `/upgrade-project`; reads `/write-spec` templates directly for batch synthesis | Single entry point; respects invariants; batches cleanly; keeps synthesis logic co-located with its input evidence | Duplicates template-reading logic (mitigated by reading templates, not copying them) | **Selected** |
| **E: Agent-driven reconciliation** | Spawn a subagent per closed issue to produce specs | Parallelism; isolation per issue | Agents can't spawn subagents (`Task` tool restriction); sequencing already acceptable; overkill for this workload | Rejected — adds complexity with little benefit |

### Alternatives Considered (#124 amendments)

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **F: Keep `/setup-steering` as a delegated skill** | Leave the standalone skill, add the new interview/seeding logic as a wrapper inside `/onboard-project` | Lower-risk change; `/setup-steering` stays callable independently | Two skills doing the same job; "single entry point" goal weakens; the interview must happen *before* steering bootstrap so the wrapper would need to interleave with the delegated skill anyway | Rejected — interleaving makes the delegation more complex than absorption |
| **G: Absorb `/setup-steering` into `/onboard-project`** | Inline steering bootstrap + enhancement logic into Step 2G.3; delete the standalone skill | One skill = one entry point; interview answers flow directly into steering content; no IPC across delegation boundary | One-time migration cost; breaking change for any external caller of `/setup-steering` (none known) | **Selected** — matches AC8/AC19/FR23 |
| **H: Seed starter issues via `gh issue create` directly (no `/draft-issue` loop)** | Synthesize issue bodies inline, call `gh` once per issue | Fewer skill boundaries; simpler control flow | Duplicates AC/FR-synthesis logic that `/draft-issue` already owns; bypasses `/draft-issue`'s codebase-investigation step | Rejected — violates "delegates rather than duplicates" |
| **I: Delegate to `/draft-issue` per candidate** | Loop calls `/draft-issue` with shared interview context per candidate | Reuses the AC/FR-synthesis logic; consistent issue quality between seeded and user-drafted issues | N invocations of `/draft-issue` add token cost (mitigated: 3–7 candidates max) | **Selected** — matches AC3/FR19 |
| **J: Re-implement dependency inference + autolinking inline** | Build the DAG and call `gh issue edit --add-sub-issue` directly | No coupling to Issue #125 | Duplicates the primitive #125 establishes; two implementations to keep in sync | Rejected — wait for #125 (Blocked By) and consume its primitive (FR22, AC16) |
| **K: Run interview after steering bootstrap (preserve current ordering)** | Bootstrap from defaults first, then interview to refine | Smaller diff to the existing flow | The whole point of the interview is to drive steering content — bootstrapping first means rewriting steering after the interview, doubling the writes | Rejected — interview before bootstrap is the entire reason for AC1/AC12 |
| **L: Treat the Claude Design URL as raw HTML / web content** | `WebFetch` and parse the response as text | Simpler — no decode step | The example URL returns a gzipped archive (~119 KB); raw-text parsing produces garbage | Rejected — payload is not HTML; gzip decode is required (AC17) |

---

## Security Considerations

- [x] **Authentication**: `gh` CLI uses `GITHUB_TOKEN` per `tech.md`. No credentials handled by the skill.
- [x] **Authorization**: Skill operates on whatever repo the current working directory is tied to — user's gh auth scope bounds what is accessible.
- [x] **Input Validation**: Issue titles, body content, and PR descriptions are treated as untrusted text when:
  - **Slugifying** for directory names — strict allowlist `[a-z0-9-]`, length-capped at 60 chars
  - **Embedding in `Bash` commands** — all `gh` arguments use `--json` output and structured parsing; no string interpolation of issue content into shell commands
  - **Writing to Markdown** — fenced code blocks used for diff content to prevent Markdown injection of headings that would confuse downstream skills
- [x] **Data Sanitization**: Diffs and PR bodies written to `design.md` preserve original content inside fenced code blocks; no interpretation or rewriting.
- [x] **Sensitive Data**: Closed issue bodies may contain internal URLs, user names, or reproduction data. The skill writes these into spec files that are committed to the repo. The user is expected to review reconciled specs before committing — this expectation must be stated in the skill's final summary (FR11).

### Security Considerations Added by #124

- [x] **Untrusted Claude Design payload**: The fetched archive is treated as untrusted input throughout. (a) The URL is validated to be HTTPS before fetch; (b) the decoded payload is never passed to a shell command via interpolation — content surfaces to the user via fenced code blocks only; (c) archive entry filenames are validated against `[A-Za-z0-9._/-]` and any `..` path component aborts the parse; (d) no extracted file is written to disk by `/onboard-project` itself (the user can later create files via `/draft-issue` follow-up).
- [x] **Interview answers passed to `/draft-issue`**: Free-text interview answers (vision, persona descriptions) are embedded into starter-issue bodies. These are passed as structured data, not interpolated into shell commands. `/draft-issue` is responsible for its own input validation per its existing security stance.
- [x] **Milestone seeding scope**: `gh api --method POST` to `/milestones` requires the user's gh-auth scope to include `repo` write. The skill assumes this is already granted; failure surfaces as an HTTP 403 captured by the milestone-failure path (AC13).
- [x] **Autolinking scope**: `gh issue edit --add-sub-issue` requires `repo` write scope; same handling as above.
- [x] **`seeded-by-onboard` label**: New label, project-scoped. The skill creates the label idempotently (`gh label create seeded-by-onboard --color 0E8A16` if missing). No security implications — label is purely advisory.

---

## Performance Considerations

- [x] **Caching**: No caching — each run is cold. Closed issue count is typically in the dozens; cache complexity is not justified.
- [x] **Pagination**: `gh issue list --limit 500` by default. If a project has more than 500 closed issues, the skill warns and offers `--since <date>` once that is added (post-v1 per Open Questions).
- [x] **Lazy Loading**: PR diffs fetched only when an issue has a merged PR. Issues with `NO_PR` skip the diff fetch entirely.
- [x] **Indexing**: N/A — `gh` CLI is the index.
- [x] **Batching**: Issues are processed sequentially; GitHub API rate limits (5000 req/hr authenticated) are not a concern at expected scale.

---

## Testing Strategy

This project uses **exercise-based verification** (per `tech.md` → Testing Standards). Skills are Markdown, not executable code — they are tested by running them in Claude Code against a test project.

| Layer | Type | Coverage |
|-------|------|----------|
| Skill prompt quality | Static review | `/verify-code` checks unambiguous instructions, complete paths, correct tool refs, gate integrity |
| Mode detection | Exercise (Agent SDK) | Three test projects: (a) empty, (b) source + closed issues + no specs, (c) already-initialized. Verify each routes correctly. |
| Brownfield reconciliation | Exercise (Agent SDK) with fixture issues | Seed a test repo with 3 closed issues (1 bug, 2 features, 1 feature with no merged PR). Verify correct template variants, consolidation prompts, and AC10 degradation. |
| Unattended mode | Exercise with `ask_user_question.behavior: deny` | Verify no prompts fire; summary lists auto-decisions. |
| Idempotency | Exercise | Run `/onboard-project` twice. Second run must produce zero file writes. |
| BDD | Gherkin feature file | `specs/feature-add-onboard-project-skill/feature.gherkin` — every AC has a scenario |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Reconciled specs reference behavior that has since been removed | Medium | Medium | Post-reconciliation verification (Step 4) — flag missing source files in summary, do not silently emit stale specs (retrospective learning: "success reported" vs "success verified") |
| Template drift: `/write-spec` templates change, `/onboard-project` synthesizes against old structure | Medium | Low | Read templates at runtime from `plugins/nmg-sdlc/skills/write-spec/templates/` rather than embedding template structure in the skill (retrospective learning: stack-agnostic / reference over embed) |
| Over-consolidation groups unrelated issues with shared vocabulary | Medium | Medium | Interactive confirmation per group; auto-accept only in unattended mode with decision logged in summary so the user can re-run selectively after review |
| Under-consolidation produces dozens of specs for closely related work | Low | Low | Jaccard ≥ 0.3 threshold tuned to err toward over-grouping; user can decline per-group to split |
| Agent produces incomplete spec (missing one of four files) | Low | Medium | FR14 + Step 4 verification — each spec dir must have all four files or the gap is flagged (retrospective learning: AI agent postcondition verification) |
| Shell injection via issue title/body | Low | High | All `gh` calls use `--json`; issue content embedded in paths uses strict slugify allowlist; issue content embedded in Markdown goes inside fenced code blocks |
| `gh` CLI not authenticated | Low | High | Step 1 precondition check runs `gh auth status` before brownfield reconciliation; aborts with clear message |
| **(#124)** Issue #125 lands a different autolinking interface than this spec assumes | Medium | Medium | Spec lists Issue #125 in **Blocked By**; implementation pulls the actual interface from #125's design.md before coding; if interface diverges, this spec is amended via `/write-spec` re-run before implementation begins |
| **(#124)** Claude Design URL format changes (e.g., uncompressed payloads, different archive layout) | Medium | Low | Decode step probes content-type AND magic bytes; falls back to plain-text parse; failure surfaces as gap (AC20) rather than silent corruption |
| **(#124)** Steering enhancement mode overwrites user customizations | Medium | High | Enhancement mode uses `Edit` (not `Write`); each modified section is diff-surfaced to the user before apply (auto-accept in unattended mode but logged for audit); preserves unrelated sections by tool semantics |
| **(#124)** Dependency DAG inferred wrong; user accepts blindly in unattended mode | Medium | Medium | Cycle detection prevents the worst case; non-cycle wrong edges surface in the seeded issue bodies as `Depends on:` lines that the user can audit and edit post-hoc; summary lists the full DAG so the audit is one-glance |
| **(#124)** `/draft-issue` invocation explosion (3–7 nested skill calls) blows token budget | Low | Medium | Hard cap at 7 candidates per FR19; sequential invocation (no parallelism); progress emitted per issue so the user can interrupt |
| **(#124)** `/setup-steering` deletion breaks an external caller | Low | Low | Project-internal only — no marketplace consumers documented; CHANGELOG records removal; `/upgrade-project` references are rewritten in the same PR (FR24) |
| **(#124)** Milestone name collision with existing user-created milestone of similar but not exact name (e.g., `v1` vs `v1 (MVP)`) | Low | Low | Strict exact-match on title; user resolves via interactive prompt if collision is suspected; unattended mode treats as "create" and lets GitHub return the dedupe error which is captured as a gap |

---

## Open Questions

- [ ] Should the skill produce a single consolidated `CHANGELOG` retrospective entry summarizing what was reconciled? Defer — out of scope per issue Notes.
- [ ] Should `design.md`'s "evidence sources" section be machine-parseable (YAML block) or prose? Default: prose with a structured subheading per source.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #115 | 2026-04-18 | Initial feature spec |
| #124 | 2026-04-18 | Greenfield enhancement: Step 2G expanded into seven sub-steps (design URL ingest, interview, steering bootstrap absorbed from `/setup-steering`, milestone seeding, candidate generation, DAG inference, starter-issue seeding loop). Greenfield-Enhancement re-run mode added. `/setup-steering` standalone skill deleted; templates relocated to `onboard-project/templates/`. `/draft-issue` added to delegation contracts; `/setup-steering` removed. New tools: `WebFetch`, `Bash(node:*)`. New argument: `--design-url`. New risks tracked for autolinking dependency on Issue #125, design-payload format, and steering-enhancement overwrite. |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Architecture follows existing project patterns (per `structure.md`) — skill + delegation model
- [x] All API/interface changes documented — new skill frontmatter, delegation contracts
- [x] Database/storage changes planned — N/A (no database)
- [x] State management approach is clear — stateless per invocation
- [x] UI components and hierarchy defined — N/A (prompt-based)
- [x] Security considerations addressed — input validation for untrusted issue content
- [x] Performance impact analyzed — O(N) in closed issues; no scale concerns
- [x] Testing strategy defined — exercise-based with three test-project fixtures
- [x] Alternatives were considered and documented — A through E
- [x] Risks identified with mitigations
