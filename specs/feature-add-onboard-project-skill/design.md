# Design: Add /onboard-project Skill

**Issues**: #115
**Date**: 2026-04-18
**Status**: Draft
**Author**: Claude

---

## Overview

`/onboard-project` is a new prompt-based skill under `plugins/nmg-sdlc/skills/onboard-project/SKILL.md` that becomes the single entry point for initializing a project for the SDLC. It does not replace any existing skill — it orchestrates them. At runtime it detects one of three modes (greenfield, brownfield, already-initialized) and routes work accordingly, delegating steering-doc bootstrap to `/setup-steering`, config generation to `/init-config`, and template reconciliation to `/upgrade-project` — all existing skills.

The novel capability this skill introduces is **brownfield reconciliation**: reading closed GitHub issues, their merged PR diffs and commit messages, and the current implementation, then synthesizing one `specs/{feature,bug}-{slug}/` directory per reconciled feature using the same templates `/write-spec` uses. Reconciliation is bounded by evidence — specs are emitted only for closed issues whose code landed, and gaps are surfaced in the final summary rather than silently filled.

Key architectural commitment: **this skill delegates rather than duplicates**. Steering-doc logic lives in `/setup-steering`; config logic lives in `/init-config`; template drift logic lives in `/upgrade-project`. `/onboard-project` owns only mode detection, issue-to-spec reconciliation, and summary reporting.

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
| Yes | No | No | No | **Greenfield** (steering pre-seeded) |
| Any | No | **Yes** | Yes | **Brownfield** |
| Any | No | Yes | **No** | **Brownfield-no-issues** (reported as empty state, AC per UI/UX) |

"Source files beyond scaffold" means files outside the allowlist `{README.md, .gitignore, package.json, pyproject.toml, Cargo.toml, go.mod, LICENSE}`. The skill counts files recursively, excluding `node_modules/`, `.git/`, and hidden directories.

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

### Delegation Contracts

| Invoked Skill | When | Success Criterion |
|---------------|------|-------------------|
| `/setup-steering` | Greenfield mode OR brownfield-missing-steering | `steering/product.md`, `steering/tech.md`, `steering/structure.md` all exist after return |
| `/init-config` | Greenfield mode, after `/setup-steering` succeeds, user confirms (auto-yes in unattended mode) | `sdlc-config.json` exists at project root |
| `/upgrade-project` | Already-initialized mode | User-facing — `/onboard-project` exits after delegation returns |

The skill does **not** invoke `/write-spec` — it uses `/write-spec`'s template files directly (read via `Read` tool from `plugins/nmg-sdlc/skills/write-spec/templates/`). This avoids the overhead of one `/write-spec` invocation per reconciled issue and lets the skill batch-synthesize specs from aggregated evidence.

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

---

## Open Questions

- [ ] Should the skill produce a single consolidated `CHANGELOG` retrospective entry summarizing what was reconciled? Defer — out of scope per issue Notes.
- [ ] Should `design.md`'s "evidence sources" section be machine-parseable (YAML block) or prose? Default: prose with a structured subheading per source.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #115 | 2026-04-18 | Initial feature spec |

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
