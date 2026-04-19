---
name: onboard-project
description: "Initialize a project for the SDLC — bootstrap greenfield projects with intent + tech-selection interview, v1/v2 milestone seeding, and 3–7 starter issues seeded via /draft-issue with dependency-aware autolinking; or reconcile specs for brownfield projects from closed GitHub issues and merged PR diffs. Optionally ingests a Claude Design URL as interview + seed context. Use when user says 'onboard project', 'bootstrap project', 'initialize project', 'adopt nmg-sdlc', 'set up nmg-sdlc', 'I need specs for an existing codebase', or 'reconcile specs from history'. Do NOT use for writing specs for new features (that is /write-spec), for updating existing specs to current templates (that is /upgrade-project), or for creating issues/PRs. Delegates to /init-config, /upgrade-project, and /draft-issue (in a loop) where appropriate. Pipeline position: runs once per project lifetime, before /draft-issue."
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Write, Edit, WebFetch, Bash(gh:*), Bash(git:*), Bash(ls:*), Bash(wc:*), Bash(node:*), AskUserQuestion
argument-hint: "[--dry-run] [--design-url <url>]"
model: opus
effort: high
---

# Onboard Project

Single entry point for adopting nmg-sdlc on a project that isn't already spec-driven. Detects whether the project is **greenfield** (no code, no specs), **greenfield-enhancement** (steering exists, specs do not — re-run on a previously bootstrapped project), **brownfield** (existing code and closed issues but no specs), or **already-initialized**, then routes work accordingly.

Greenfield runs an intent + tech-selection interview, seeds `v1 (MVP)` and `v2` GitHub milestones, and seeds 3–7 starter issues via a `/draft-issue` loop with dependency-aware autolinking. Brownfield produces one spec directory per reconciled feature, synthesized from closed GitHub issues, merged PR diffs, commit messages, and the current implementation.

This skill **delegates rather than duplicates**:

- Runner config generation → `/init-config`
- Template drift on already-initialized projects → `/upgrade-project`
- Starter-issue authoring → `/draft-issue` (one invocation per seeded candidate)
- Spec template structure → read from `plugins/nmg-sdlc/skills/write-spec/templates/`

Steering bootstrap and steering enhancement run **inside** this skill (Step 2G.3). Steering templates live at `plugins/nmg-sdlc/skills/onboard-project/templates/`.

Its own responsibility is mode detection, the greenfield interview/seeding pipeline, brownfield reconciliation, post-reconciliation verification, and the final summary.

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
| No | No | No | No | **Greenfield** (bootstrap mode) |
| Yes | No | No | No | **Greenfield-Enhancement** (steering pre-seeded — Step 2G runs in enhancement mode) |
| Any | No | **Yes** | Yes | **Brownfield** |
| Any | No | Yes | **No** | **Brownfield-no-issues** (empty state — offer to treat as greenfield) |

**Scaffold allowlist** (files that do NOT count as source): `README.md`, `.gitignore`, `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `LICENSE`, `LICENSE.md`, `LICENSE.txt`.

**Exclude from file count**: `node_modules/`, `.git/`, and any hidden directory (names starting with `.`).

## Unattended Mode

If `.claude/unattended-mode` exists:

- All `AskUserQuestion` prompts are skipped — the skill proceeds with defaults
- Consolidation groups (brownfield) are auto-accepted as proposed
- The greenfield interview is replaced by deterministic defaults sourced from the Claude Design payload (if any) or the steering templates
- The inferred dependency DAG is auto-accepted; the proposed graph is logged for the summary
- The starter-issue candidate cut to ≤7 is applied automatically when interview output exceeds the cap
- `/init-config` invocation after greenfield bootstrap is auto-yes
- Already-initialized mode auto-delegates to `/upgrade-project`
- Every auto-decision (consolidation accepts, applied defaults with their source, DAG, candidate cuts) is logged in the final summary so the run can be audited

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

### Step 2G: Greenfield — Interview, Steering, Milestones, Starter Issues

Step 2G runs in one of two modes:

- **Bootstrap mode** — no `steering/` files exist. Steering files are written from templates and populated with interview answers.
- **Enhancement mode** — all three of `steering/product.md`, `steering/tech.md`, `steering/structure.md` exist (Greenfield-Enhancement per the Mode Detection Matrix). Steering files are edited in place; existing milestones and seeded issues are detected and skipped.

Both modes run the same seven sub-steps. Behavior diverges per the **Bootstrap vs Enhancement** column noted in each sub-step.

#### 2G.1 Optional Claude Design URL Ingestion

1. Resolve the design URL: if `--design-url <url>` was passed as an argument, use that. Else (interactive only) call `AskUserQuestion`: "Provide a Claude Design URL? (optional — press Enter to skip)". In unattended mode without `--design-url`, skip this sub-step entirely.
2. **Validate URL is HTTPS.** If not, log "design URL rejected (non-HTTPS)", record the rejection as a gap, and continue to 2G.2 with empty `design_context`.
3. Fetch via `WebFetch` with a 30s timeout.
4. **Decode**: if the response indicates gzip (content-type `application/gzip`/`application/x-gzip` OR magic bytes `1f 8b` at offset 0), decode via `Bash(node -e "process.stdout.write(require('node:zlib').gunzipSync(Buffer.from(process.argv[1],'base64')).toString())" "<base64>")` — pass the payload as a base64 argument; never interpolate raw payload bytes into a shell command.
5. **Parse**: locate `README.md` or `README` at the archive root. Read and summarize it for the user. List archive entries (filename, size) inside a fenced code block.
6. Store the parsed content as `design_context` (in-memory only — no file writes by this skill).
7. **Failure handling** (AC20, FR26): network error, HTTP non-2xx, gzip decode error, missing README — log the URL + failure mode + a single-sentence remediation hint (e.g., "Verify the URL is reachable and points to a valid Claude Design archive"), record the gap for the Step 5 summary, set `design_context = {}`, and **continue** the run. Fetch failures must NOT abort.
8. All payload content surfaced to the user goes inside fenced code blocks. Archive entry filenames are validated against `[A-Za-z0-9._/-]`; any `..` path component aborts the parse and records a gap.

Emit a progress line: `Design URL: fetched (N bytes, M entries) | skipped | failed (<reason>)`.

#### 2G.2 Intent + Tech-Selection Interview

Conduct a multi-round interview using `AskUserQuestion`. Rounds, in order:

1. **Vision** — what is the product? (open-ended)
2. **Target users / personas** — who is it for? (open-ended)
3. **Success criteria** — how will you know it works? (open-ended)
4. **Language** — primary language (e.g., TypeScript, Python, Go)
5. **Framework** — primary framework if any (e.g., Next.js, FastAPI)
6. **Test tooling** — test framework + BDD tooling
7. **Deployment target** — where does this run? (e.g., Vercel, AWS Lambda, Cloudflare Workers, on-prem)

For each round, the default presented to the user is sourced in this priority order:

1. (Enhancement mode) the existing value parsed from the relevant steering file (e.g., `# Mission` heading in `product.md` for vision)
2. The corresponding field from `design_context` (if 2G.1 succeeded)
3. The default in the steering template

**Unattended-mode branch**: skip all prompts. For each round, apply the default from the priority chain above. Log every applied default with its source label (`from existing steering`, `from design context`, `from template default`) into a list that Step 5 emits.

Store the answers as `interview_context` for sub-steps 2G.3, 2G.5, 2G.7.

Emit a progress line: `Interview: complete (N rounds, K defaults applied unattended)`.

#### 2G.3 Steering Bootstrap (Absorbed) or Enhancement

Read the three steering templates from `plugins/nmg-sdlc/skills/onboard-project/templates/`:

- `product.md`, `tech.md`, `structure.md`

Extract template content from the ` ```markdown ... ``` ` fenced block in each template (templates wrap the bootstrap content this way so they are also valid skill-relative documentation).

**Bootstrap mode** (no `steering/` files exist):

1. Populate the template content with `interview_context`:
   - `product.md` ← vision, personas, success criteria
   - `tech.md` ← language, framework, test tooling, deployment target
   - `structure.md` ← scaffold layout (use `git ls-files` and the discovered layout: top-level directories, source/test directories, monorepo structure if any)
2. `Write` `steering/product.md`, `steering/tech.md`, `steering/structure.md`.
3. Create the `specs/` directory (empty — for future spec writes).

**Enhancement mode** (all three steering files already exist):

1. For each section that has a corresponding interview answer differing from the existing value:
   - In interactive mode, present the diff to the user (one section at a time) and ask whether to apply.
   - In unattended mode, auto-apply and log the diff for Step 5.
2. Use `Edit` (not `Write`) so unrelated sections in the steering files are preserved.
3. Do not delete content the interview did not address.

After this sub-step, verify all three of `steering/product.md`, `steering/tech.md`, `steering/structure.md` exist. If any is missing, record as a gap and abort the greenfield flow.

Emit a progress line: `Steering: bootstrapped (3 files written) | enhanced (N sections updated)`.

#### 2G.4 Idempotent Milestone Seeding

For each of `v1 (MVP)` and `v2`:

1. List existing milestones: `gh api "repos/{owner}/{repo}/milestones?state=all&per_page=100" --jq '.[].title'`
2. If the exact title is present → record `seeded vs skipped: <name> = skipped (already exists)` and continue.
3. Else create: `gh api --method POST "repos/{owner}/{repo}/milestones" --field title="<name>" --field description="<one-line description>"`
4. On HTTP error (403, 422 collision, network) → record `<name> = failed (<status>)` as a gap; **do not abort** the run.

`v1 (MVP)` description: `Minimum Viable Product — first shippable milestone seeded by /onboard-project.`
`v2` description: `Post-MVP enhancements seeded by /onboard-project.`

Emit a progress line per milestone: `Milestone: v1 (MVP) seeded | skipped | failed (<reason>)`.

#### 2G.5 Starter-Issue Candidate Generation

Synthesize 3–7 starter-issue candidates from `interview_context` and `design_context`. Each candidate carries:

```
{
  title:           "Set up basic API",
  milestone:       "v1 (MVP)" | "v2",
  body_seed:       "<one-paragraph seed used by /draft-issue>",
  component_refs:  ["api", "auth"],
  ordering_cue:    "first" | "before X" | null
}
```

Generation rules:

- Mine `interview_context.success_criteria` and (if present) `design_context` filenames/READMEs for distinct functional concerns.
- Allocate the foundational/setup concerns to `v1 (MVP)`; allocate enhancements to `v2`.
- Hard floor: 3 candidates. Hard ceiling: 7 (FR19). If interview output yields more, present a top-7 cut via `AskUserQuestion` (auto-cut in unattended mode, with the cut list logged for Step 5).

**Enhancement-mode filter**: query `gh issue list --label seeded-by-onboard --state all --json title --limit 200`. Drop any candidate whose title exactly matches an existing seeded issue.

Emit a progress line: `Candidates: N generated, M dropped as already-seeded, K cut to top-7`.

#### 2G.6 Dependency DAG Inference + Confirmation Gate

Build edges from the candidate set per these rules:

1. **Shared component refs** — if candidate A's `component_refs` is a strict subset of B's, A → B (A introduces the component; B builds on it).
2. **Ordering cues** — phrases like "first", "before X", "depends on" surfaced in the interview create explicit edges.
3. **Milestone gate** — drop any edge with a `v2` candidate as parent of a `v1` candidate (invariant from FR20).

**Cycle detection** — DFS with white/gray/black marking. On any back edge:

- Log the cycle (list the participating candidates).
- **Skip the wiring step entirely** — proceed to 2G.7 with no autolinks. Do not partially wire.
- Record `DAG: skipped due to cycle` for Step 5.

Render the DAG as ASCII for the user, e.g.:

```
[v1] Set up basic API
   └─▶ [v1] Add user profile
          └─▶ [v2] Add caching layer
[v1] Set up auth
   └─▶ [v1] Add user profile
```

`AskUserQuestion`: `[1] Approve and proceed`, `[2] Adjust (return to candidate generation)`, `[3] Proceed without DAG (seed standalone)`.

In unattended mode: auto-accept option 1 and log the full DAG for Step 5.

Emit a progress line: `DAG: N edges inferred, cycle detected? = no | yes (skipped wiring)`.

#### 2G.7 Starter-Issue Seeding Loop with Autolinking

Iterate candidates in **topological order** from 2G.6 (or arbitrary order if the DAG step was skipped).

Before the first iteration:

1. Ensure the `seeded-by-onboard` label exists:
   ```
   gh label create seeded-by-onboard --color 0E8A16 --description "Issue seeded by /onboard-project" 2>/dev/null || true
   ```
2. **Autolinking availability check**: attempt a dry probe to confirm Issue #125's autolinking primitive is available in `/draft-issue`. If the probe fails or the primitive is not yet shipped, log once — `Autolinking: not available (Issue #125 not yet landed); seeding will proceed without sub-issue wiring` — set `autolinking_available = false`, and record the gap for Step 5. Do NOT repeat this failure per candidate.

For each candidate:

1. **Invoke `/draft-issue`** (delegated) with the shared `interview_context`, `design_context`, and this candidate's `{title, milestone, body_seed, component_refs}` as the seed payload. The delegated skill is responsible for full AC/FR synthesis — do not bypass it.
2. **Capture the created issue number** from `/draft-issue`'s return.
3. **Apply the seeded-by-onboard label**: `gh issue edit <num> --add-label seeded-by-onboard`.
4. **Wire DAG parents already created** (skip if `autolinking_available = false`): for each parent of this candidate already created in this loop, invoke the autolinking primitive landed by Issue #125 (`addSubIssue(parent_number, child_number)` exposed by `/draft-issue`). Append a `Depends on: #<parent>` line to this issue's body via `gh issue edit <self> --body-file -` (read existing body via `gh issue view <self> --json body`, append the line, write back).
5. **Queue child back-references** (skip if `autolinking_available = false`): for each DAG child of this candidate not yet created, record a deferred `Blocks: #<self>` insertion that will be applied when that child is seeded.
6. **State isolation**: discard any per-candidate working state before iterating to the next candidate.

**Per-issue failure handling**: if any of `/draft-issue` invocation, label apply, autolink call, or body edit fails — record the failure as a per-issue gap (with the candidate title, the failed step, and the error message) and **continue the loop**. A single failure must not abort the remaining seeds.

Reuses the autolinking primitive from Issue #125; this skill does not implement `gh issue edit --add-sub-issue` wiring inline.

Emit a progress line per candidate: `Seeded: <title> = #<num> (parents: #X #Y, blocks: #Z) | failed (<reason>)`.

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
2. If `steering/` is missing or incomplete (fewer than all three of `product.md`, `tech.md`, `structure.md`), run the absorbed steering bootstrap (Step 2G.1 → 2G.3) first to establish the steering docs, then return to Step 2B (skip 2G.4–2G.7 — milestone and starter-issue seeding are greenfield-only and not appropriate for brownfield). After steering bootstrap returns, re-verify all three files exist before continuing. If still incomplete, record a gap and abort.
3. Handle the **brownfield-no-issues** empty state: if the mode-detection step found zero closed issues, report "brownfield detected but zero closed issues" and offer (via `AskUserQuestion`, auto-accept in unattended mode) to treat the project as greenfield-plus-existing-code. On accept, route to Step 3G. On decline, jump to Step 5 summary with no reconciliation performed.
4. Read the four `/write-spec` template files from `plugins/nmg-sdlc/skills/write-spec/templates/`:
   - `requirements.md` — contains both the full feature variant and the lightweight "Defect Requirements Variant" (search for the `# Defect Requirements Variant` heading to locate the defect section)
   - `design.md`
   - `tasks.md` — contains both the phased feature task layout and the flat "Defect Tasks Variant"
   - `feature.gherkin`

   Store their contents in memory for synthesis. Reading templates at runtime — rather than embedding their structure here — keeps this skill aligned with future `/write-spec` template changes automatically. When synthesizing a defect spec, use the Defect variant sections from `requirements.md` and `tasks.md`; for feature specs, use the full variants.

5. Proceed to Step 3B.

### Step 3B: Brownfield — Reconciliation Loop

#### 3B.1 Fetch Closed Issues

```
gh issue list --state closed --json number,title,body,labels,closedAt --limit 500
```

Pre-filter at the CLI (`--state closed`) — do not fetch all issues and filter client-side. Skip any issue closed with reason `duplicate`, `not planned`, or having a `wontfix` label — these yield no useful design evidence; record them in the summary as "skipped (no actionable evidence)".

**Pagination note**: `--limit 500` is a hard ceiling. If the repository has more than 500 closed issues, the output is silently truncated. Note this in the summary ("Fetched N closed issues; repository may have additional issues beyond the 500-issue limit — re-run with `--search` or `--since` filtering to target a subset.").

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
   - **`feature.gherkin`** — derive scenarios from the reconstructed ACs in `requirements.md`. For defect specs, tag each scenario with `@regression` (required by `/verify-code`'s bug-fix verification contract).

4. Embed any diff snippets, PR body excerpts, issue body text, or issue comments inside fenced code blocks — never interpolate untrusted content into Markdown headings or into shell commands. Issue body and comments are user-controlled input and must be treated as untrusted throughout.
5. **If `--dry-run` was passed**, do NOT write files — record "would produce specs/..." for the summary and continue.
6. Otherwise, `Write` all four files in sequence. If any `Write` fails mid-sequence, record the partial directory as a gap (no rollback — see design.md). In the summary, include the instruction: "To re-reconcile this issue, manually delete `specs/{slug}/` before re-running `/onboard-project`."

### Step 4: Post-Reconciliation Verification

For each spec directory produced in this run (greenfield skips this step — nothing to verify):

1. Verify all four files exist: `requirements.md`, `design.md`, `tasks.md`, `feature.gherkin`. Any missing file is a gap recorded for the summary (AC8).
2. Extract referenced file paths from each `design.md`: scan all inline code spans (`` `path/to/file.ext` ``) and fenced code block content within the `## Architecture`, `## API / Interface Changes`, and `## Tasks` sections for tokens matching the pattern `[\w./\-]+\.\w+` (i.e., strings with at least one dot that look like file paths). For each extracted path, use `Glob` or `Read` to confirm the file exists in the current working tree. Missing files are gaps — the spec is still kept on disk, not deleted.
3. Verification MUST NOT abort the run on gaps — it records them for Step 5.

### Step 5: Summary Report

Emit a structured summary with these sections:

1. **Mode detected** — greenfield (bootstrap), greenfield-enhancement, brownfield, already-initialized, or brownfield-no-issues
2. **Delegated skills invoked** — each of `/init-config`, `/upgrade-project`, and every `/draft-issue` invocation (greenfield seeding loop) that ran, with success/failure status
3. **Greenfield only — Design URL fetch result** — `success (N bytes, M entries)`, `skipped (no URL provided)`, or `failed (<reason>)`
4. **Greenfield only — Interview defaults applied** — for each round, the value applied and its source (`from existing steering`, `from design context`, `from template default`, or `user input`)
5. **Greenfield only — Milestones** — `v1 (MVP)` and `v2`: each marked `seeded`, `skipped (already exists)`, or `failed (<reason>)`
6. **Greenfield only — Dependency DAG** — full ASCII rendering, OR `skipped due to cycle (<participants>)`, OR `skipped at user request`
7. **Greenfield only — Starter issues seeded** — every issue created with its number, milestone, parent/child neighbors, and per-issue gap if any:

   ```
   #200 [v1] Set up basic API           (parents: —, blocks: #201, #202)
   #201 [v1] Add user profile           (parents: #200, blocks: —)
   #202 [v2] Add caching layer          (parents: #200, blocks: —)
   #203 [v1] FAILED — /draft-issue exited 1
   ```

8. **Brownfield only — Specs produced** — every spec directory written this run, with contributing issue numbers in parentheses, e.g.:

   ```
   specs/feature-dark-mode/        (#10, #14, #27)
   specs/bug-login-crash-on-timeout/ (#42)
   specs/feature-export-report/    (#61) — partial: ## Known Gaps noted
   ```

9. **Brownfield only — Skipped** — issues skipped as `duplicate`/`wontfix`/`not planned`, and spec dirs skipped because they already existed (FR16)
10. **Enhancement-mode skips** (greenfield-enhancement only) — milestones detected as already-seeded, candidates dropped because the title matched an existing `seeded-by-onboard` issue, and any sections in steering files left untouched because the interview answer matched the existing value
11. **Gaps** — any missing artifact files (from Step 4), any referenced source files that no longer exist in the working tree, partial spec directories from Write failures, milestone-creation failures, design-fetch failures, and per-issue seeding failures
12. **Auto-decisions** (unattended-mode runs only) — every consolidation auto-accept, every default applied without prompting (with source), DAG auto-accept, candidate top-7 cuts
13. **Review reminder** — one line reminding the user that reconciled specs (brownfield) may contain internal URLs, reproduction data, or other content copied from closed issues and should be reviewed before committing
14. **Next step** —
   - Greenfield: `Run /start-issue on a seeded starter (e.g., #<first-v1-issue>), or /draft-issue to add more.`
   - Brownfield: `Review the reconciled specs, then run /draft-issue for new work or /upgrade-project to bring reconciled specs up to the latest templates.`
   - Already-initialized (after `/upgrade-project`): `Run /draft-issue for the next feature.`

If `.claude/unattended-mode` exists, replace the "Next step" with `Done. Awaiting orchestrator.`

---

## Error States

| Condition | Behavior |
|-----------|----------|
| Legacy `.claude/steering/` or `.claude/specs/` layout detected | Abort in Step 0 with upgrade instructions |
| `gh auth status` fails in brownfield mode | Abort in Step 2B with `gh auth login` pointer |
| Steering bootstrap (Step 2G.3) leaves any of the three files missing | Abort the greenfield flow; gap recorded for summary |
| Claude Design URL fetch/decode fails (greenfield) | Logged with URL + reason; `design_context = {}`; greenfield flow continues; gap recorded (AC20) |
| Non-HTTPS Claude Design URL | Rejected before fetch; gap recorded; greenfield flow continues |
| Milestone creation fails (greenfield) | Per-milestone gap recorded; loop continues; run does not abort (AC13) |
| Dependency DAG cycle detected (greenfield) | Wiring step skipped entirely; seeding loop proceeds without autolinks; recorded for summary (AC15) |
| `/draft-issue` invocation fails for one candidate (greenfield) | Per-issue gap recorded; loop continues with remaining candidates (AC14) |
| Single issue fails reconciliation (brownfield) | Recorded as gap; run continues (AC10/FR13) |
| Spec dir already exists at target slug (brownfield) | Skipped, recorded in summary (FR16) |
| Spec references removed source file (brownfield) | Spec still written; gap recorded in summary (AC8) |

---

## Integration with SDLC Workflow

This is the one-time adoption step for projects that aren't yet spec-driven. It runs before `/draft-issue` and produces the artifacts the pipeline depends on (`steering/` docs and, for brownfield, a seed population of specs).

```
                       ┌─────────────────────────────────────────────────┐
                       │ /onboard-project (once per project)             │
                       │   ├── greenfield  → design URL ingest (opt)     │
                       │   │                 → interview (vision/tech)   │
                       │   │                 → steering bootstrap        │
                       │   │                 → seed v1/v2 milestones     │
                       │   │                 → seed 3–7 starter issues   │
                       │   │                   via /draft-issue loop     │
                       │   │                 → /init-config              │
                       │   ├── greenfield-enhancement (re-run)           │
                       │   │                 → in-place steering Edit    │
                       │   │                 → skip already-seeded       │
                       │   ├── brownfield  → steering bootstrap (if)     │
                       │   │                 → reconcile specs           │
                       │   └── initialized → /upgrade-project            │
                       └────────────────────┬────────────────────────────┘
                                            ▼
/draft-issue  →  /start-issue #N  →  /write-spec #N  →  /write-code #N  →  /simplify  →  /verify-code #N  →  /open-pr #N
```
