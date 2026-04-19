---
name: onboard-project
description: "Initialize a project for the SDLC — bootstrap greenfield projects or reconcile specs for brownfield projects from closed GitHub issues and merged PR diffs. Use when user says 'onboard project', 'bootstrap project', 'initialize project', 'adopt nmg-sdlc', 'set up nmg-sdlc', 'I need specs for an existing codebase', or 'reconcile specs from history'. Do NOT use for writing specs for new features (that is /write-spec), for updating existing specs to current templates (that is /upgrade-project), or for creating issues/PRs. Delegates to /setup-steering, /init-config, and /upgrade-project where appropriate. Pipeline position: runs once per project lifetime, before /draft-issue."
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(gh:*), Bash(git:*), Bash(ls:*), Bash(wc:*), AskUserQuestion
argument-hint: "[--dry-run]"
---

# Onboard Project

Single entry point for adopting nmg-sdlc on a project that isn't already spec-driven. Detects whether the project is **greenfield** (no code, no specs), **brownfield** (existing code and closed issues but no specs), or **already-initialized**, then routes work accordingly. Brownfield projects get one spec directory per reconciled feature, synthesized from closed GitHub issues, merged PR diffs, commit messages, and the current implementation.

This skill **delegates rather than duplicates**:

- Steering doc bootstrap → `/setup-steering`
- Runner config generation → `/init-config`
- Template drift on already-initialized projects → `/upgrade-project`
- Spec template structure → read from `plugins/nmg-sdlc/skills/write-spec/templates/`

Its own responsibility is mode detection, brownfield reconciliation, post-reconciliation verification, and the final summary.

## When to Use

- First-time adoption of nmg-sdlc in a brand-new project
- First-time adoption in an existing codebase that already has shipped features and closed issues
- When you need specs reverse-engineered from the historical record so the SDLC pipeline has something to consume

## When NOT to Use

- To write a spec for a new feature (use `/write-spec`)
- To update existing specs to current templates (use `/upgrade-project`)
- To create GitHub issues or PRs (use `/draft-issue` or `/open-pr`)

## Prerequisites

- `gh` CLI authenticated (`gh auth status` passes) — required for brownfield reconciliation
- Git-initialized repository
- Claude Code plugin `nmg-sdlc` installed at current version

## Mode Detection Matrix

| `steering/` exists | `specs/` has specs | Source files beyond scaffold | Closed issues exist | Mode |
|--------------------|--------------------|------------------------------|---------------------|------|
| Any | **Yes** | Any | Any | **Already initialized** |
| No | No | No | No | **Greenfield** |
| Yes | No | No | No | **Greenfield** (steering pre-seeded) |
| Any | No | **Yes** | Yes | **Brownfield** |
| Any | No | Yes | **No** | **Brownfield-no-issues** (empty state — offer to treat as greenfield) |

**Scaffold allowlist** (files that do NOT count as source): `README.md`, `.gitignore`, `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `LICENSE`.

**Exclude from file count**: `node_modules/`, `.git/`, and any hidden directory (names starting with `.`).

## Unattended Mode

If `.claude/unattended-mode` exists:

- All `AskUserQuestion` prompts are skipped — the skill proceeds with defaults
- Consolidation groups are auto-accepted as proposed
- `/init-config` invocation after greenfield bootstrap is auto-yes
- Already-initialized mode auto-delegates to `/upgrade-project`
- Every auto-decision (which groups were accepted, which defaults were applied) is logged in the final summary so the run can be audited

---

## Workflow

### Step 0: Legacy-Layout Precondition

Run `Glob` for:

- `.claude/steering/*.md`
- `.claude/specs/*/requirements.md`

If either returns a match, abort and print:

```
ERROR: This project uses the legacy `.claude/steering/` and/or `.claude/specs/` directory layout, which current Claude Code releases refuse to write to. Run `/upgrade-project` first, then re-run `/onboard-project`.
```

This gate fires in both interactive and unattended mode.

### Step 1: Detect Mode

Gather four signals:

1. **`steering/` presence** — `Glob` for `steering/product.md`, `steering/tech.md`, `steering/structure.md`
2. **`specs/` presence** — `Glob` for `specs/*/requirements.md`
3. **Source-file count beyond scaffold** — list tracked files via `git ls-files`, exclude the scaffold allowlist and hidden/excluded directories, count the remainder
4. **Closed-issue presence** — `gh issue list --state closed --limit 1 --json number` (one-item probe, just to detect whether any exist)

Classify per the Mode Detection Matrix. Print a one-line summary of the detected mode and the evidence used, e.g.:

```
Brownfield detected: 12 closed issues, 47 source files, no specs/.
```

Store the evidence for the Step 5 summary. Proceed to the branch matching the detected mode.

### Step 2G: Greenfield — Steering Bootstrap

1. Invoke `/setup-steering` (delegated) and wait for it to return.
2. Verify `steering/product.md`, `steering/tech.md`, and `steering/structure.md` all exist. If any is missing, record as a gap and abort (do not continue to Step 3G). The gap appears in the Step 5 summary.
3. Proceed to Step 3G.

### Step 3G: Greenfield — Optional Init-Config

1. In interactive mode, call `AskUserQuestion` asking whether to run `/init-config` now for unattended-runner setup. Options: `[1] Yes — run /init-config now`, `[2] No — skip, I'll run it later`.
2. In unattended mode, auto-yes without prompting. Log the auto-decision.
3. If yes, invoke `/init-config` (delegated) and record its exit status.
4. Jump to Step 5 (Summary). Greenfield does not reconcile specs.

### Step 2I: Already-Initialized — Route to /upgrade-project

1. List the existing spec directories under `specs/` so the user can audit what is already present.
2. In interactive mode, call `AskUserQuestion`: `[1] Delegate to /upgrade-project now`, `[2] Exit without changes`.
3. In unattended mode, auto-accept option 1. Log the auto-decision.
4. On accept, invoke `/upgrade-project` (delegated) and exit after it returns — jump to Step 5 summary.
5. On decline, exit cleanly — jump to Step 5 summary with no specs modified.
6. This branch MUST NOT read, modify, or overwrite any existing spec file.

### Step 2B: Brownfield — Preflight

1. Run `gh auth status`. If it fails, abort with a clear message pointing the user at `gh auth login` — do not proceed to reconciliation.
2. If `steering/` is missing or incomplete (fewer than all three of `product.md`, `tech.md`, `structure.md`), delegate to `/setup-steering` first (AC5). After it returns, re-verify all three files exist before continuing. If still incomplete, record a gap and abort.
3. Handle the **brownfield-no-issues** empty state: if the mode-detection step found zero closed issues, report "brownfield detected but zero closed issues" and offer (via `AskUserQuestion`, auto-accept in unattended mode) to treat the project as greenfield-plus-existing-code. On accept, route to Step 3G. On decline, jump to Step 5 summary with no reconciliation performed.
4. Read the `/write-spec` templates from `plugins/nmg-sdlc/skills/write-spec/templates/`:
   - `requirements.md` (feature) and the defect variant
   - `design.md` (feature) and the defect variant
   - `tasks.md` (feature) and the defect variant
   - `feature.gherkin`

   Store their contents in memory for synthesis. Reading templates at runtime — rather than embedding their structure here — keeps this skill aligned with future `/write-spec` template changes automatically.

5. Proceed to Step 3B.

### Step 3B: Brownfield — Reconciliation Loop

#### 3B.1 Fetch Closed Issues

```
gh issue list --state closed --json number,title,body,labels,closedAt --limit 500
```

Pre-filter at the CLI (`--state closed`) — do not fetch all issues and filter client-side. Skip any issue closed with reason `duplicate`, `not planned`, or having a `wontfix` label — these yield no useful design evidence; record them in the summary as "skipped (no actionable evidence)".

Emit progress every ~5 issues so long runs are observable.

#### 3B.2 Per-Issue Evidence Gathering

For each remaining issue, in this order (AC9):

1. **Issue body + comments** — `gh issue view N --json body,comments`
2. **Merged PR** — `gh issue view N --json closedByPullRequestsReferences` to find the PR number; then `gh pr view <prnum> --json body,files,commits,merged` (only if `merged` is true)
3. **PR diff** — `gh pr diff <prnum>`
4. **Commit messages** — from the `commits[].messageHeadline` field in the PR JSON
5. **Current implementation files** — for each path in `pr.files[].path`, use `Glob`/`Read` to confirm presence in the working tree

Build the evidence set in memory for this issue. **Discard** the prior issue's evidence before beginning the next — no inter-iteration state leakage.

If no merged PR is found (`NO_PR`), degrade per AC10: keep only evidence sources #1 and #5, mark this spec for a `## Known Gaps` section noting missing PR context, and continue processing remaining issues. A single reconciliation gap must NOT abort the run.

#### 3B.3 Template Variant Selection (AC4)

Per issue:

1. If the issue carries a `bug` label → defect template.
2. Else, inspect the title + body for any of these keywords (case-insensitive): `fix`, `bug`, `broken`, `regression`, `crash`, `error`. If any match → defect template.
3. Otherwise → feature template.

Feature specs emit to `specs/feature-{slug}/`; defect specs emit to `specs/bug-{slug}/`.

#### 3B.4 Consolidation Grouping

After all issues are classified:

1. Group issues that share a non-trivial label (excluding `enhancement`, `bug`, `automatable`, `good-first-issue` and other pipeline-mechanical labels).
2. Additionally group by Jaccard overlap ≥ 0.3 on title tokens, after stop-word filtering (`the`, `a`, `an`, `add`, `fix`, `update`, `remove`, `for`, `to`, `of`, `and`, `or`).
3. Merge overlapping groups transitively (if issue A groups with B and B groups with C, A/B/C form one group).
4. For each group with ≥ 2 issues, present a consolidation proposal via `AskUserQuestion`:

   ```
   Issues #10, #14, #27 share the label "dark-mode" and overlapping keywords ("toggle", "theme").
   Consolidate into one spec?
   [1] Yes — produce one consolidated feature-{slug}/ with all three issue numbers
   [2] No — produce one spec per issue
   ```

5. In unattended mode, auto-accept consolidation (option 1) and log each auto-decision for the summary.
6. Single-issue "groups" (no consolidation candidates) proceed directly to synthesis with no prompt.

#### 3B.5 Per-Spec Synthesis

For each approved group (or single issue):

1. **Slugify** the title using strict allowlist `[a-z0-9-]`, collapsing runs of non-allowlisted characters to a single hyphen, trimming leading/trailing hyphens, and capping at 60 characters. This is a security boundary — issue content is untrusted.
2. **Check for collision** (FR16) — if `specs/feature-{slug}/` or `specs/bug-{slug}/` already exists, skip synthesis and record "skipped — spec dir already exists" for the summary.
3. **Synthesize all four files in memory** using the templates loaded in Step 2B.4:
   - **`requirements.md`** — fill user story, background, acceptance criteria, FRs from issue body + PR body. Frontmatter `**Issues**: #N, #M, ...` listing every contributing issue number.
   - **`design.md`** — fill overview, architecture, API/interface changes from PR diff + PR body + commit messages + current code. Include an explicit `## Evidence Sources` section listing which of {issue body, PR body, PR diff, commit messages, current code} contributed to each major section (AC9). If the issue degraded per AC10, include a `## Known Gaps` section noting the missing PR.
   - **`tasks.md`** — reverse-engineer phased tasks from PR commits; mark each as complete (`[x]`) since the code has landed. Map each task to the actual files in `pr.files[].path`.
   - **`feature.gherkin`** — derive scenarios from the reconstructed ACs in `requirements.md`.

4. Embed any diff snippets or PR body excerpts inside fenced code blocks — never interpolate untrusted content into Markdown headings or into shell commands.
5. **If `--dry-run` was passed**, do NOT write files — record "would produce specs/..." for the summary and continue.
6. Otherwise, `Write` all four files in sequence. If any `Write` fails mid-sequence, record the partial directory as a gap (no rollback — see design.md).

### Step 4: Post-Reconciliation Verification

For each spec directory produced in this run (greenfield skips this step — nothing to verify):

1. Verify all four files exist: `requirements.md`, `design.md`, `tasks.md`, `feature.gherkin`. Any missing file is a gap recorded for the summary (AC8).
2. Extract referenced file paths from each `design.md` (look at paths mentioned in architecture/API sections and in tasks). For each referenced path, use `Glob` or `Read` to confirm the file exists in the current working tree. Missing files are gaps — the spec is still kept on disk, not deleted.
3. Verification MUST NOT abort the run on gaps — it records them for Step 5.

### Step 5: Summary Report

Emit a structured summary with these sections:

1. **Mode detected** — greenfield, brownfield, already-initialized, or brownfield-no-issues
2. **Delegated skills invoked** — each of `/setup-steering`, `/init-config`, `/upgrade-project` that ran, with success/failure status
3. **Specs produced** — every spec directory written this run, with contributing issue numbers in parentheses, e.g.:

   ```
   specs/feature-dark-mode/        (#10, #14, #27)
   specs/bug-login-crash-on-timeout/ (#42)
   specs/feature-export-report/    (#61) — partial: ## Known Gaps noted
   ```

4. **Skipped** — issues skipped as `duplicate`/`wontfix`/`not planned`, and spec dirs skipped because they already existed (FR16)
5. **Gaps** — any missing artifact files (from Step 4) and any referenced source files that no longer exist in the working tree
6. **Auto-decisions** (unattended-mode runs only) — every consolidation auto-accept, every default applied without prompting
7. **Review reminder** — one line reminding the user that reconciled specs may contain internal URLs, reproduction data, or other content copied from closed issues and should be reviewed before committing
8. **Next step** —
   - Greenfield: `Run /draft-issue to create your first issue.`
   - Brownfield: `Review the reconciled specs, then run /draft-issue for new work or /upgrade-project to bring reconciled specs up to the latest templates.`
   - Already-initialized (after `/upgrade-project`): `Run /draft-issue for the next feature.`

If `.claude/unattended-mode` exists, replace the "Next step" with `Done. Awaiting orchestrator.`

---

## Error States

| Condition | Behavior |
|-----------|----------|
| Legacy `.claude/steering/` or `.claude/specs/` layout detected | Abort in Step 0 with upgrade instructions |
| `gh auth status` fails in brownfield mode | Abort in Step 2B with `gh auth login` pointer |
| `/setup-steering` delegation returns incomplete | Abort before reconciliation; gap recorded for summary |
| Single issue fails reconciliation | Recorded as gap; run continues (AC10/FR13) |
| Spec dir already exists at target slug | Skipped, recorded in summary (FR16) |
| Spec references removed source file | Spec still written; gap recorded in summary (AC8) |

---

## Integration with SDLC Workflow

This is the one-time adoption step for projects that aren't yet spec-driven. It runs before `/draft-issue` and produces the artifacts the pipeline depends on (`steering/` docs and, for brownfield, a seed population of specs).

```
                       ┌─────────────────────────────────────────┐
                       │ /onboard-project (once per project)     │
                       │   ├── greenfield  → /setup-steering      │
                       │   │                 → /init-config        │
                       │   ├── brownfield  → /setup-steering (if) │
                       │   │                 → reconcile specs     │
                       │   └── initialized → /upgrade-project      │
                       └────────────────────┬────────────────────┘
                                            ▼
/draft-issue  →  /start-issue #N  →  /write-spec #N  →  /write-code #N  →  /verify-code #N  →  /open-pr #N
```
