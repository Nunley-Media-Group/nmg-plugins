---
name: upgrade-project
description: "Upgrade a project to the latest nmg-sdlc contract — relocate legacy `.claude/steering/` and `.claude/specs/` to the project root, update specs, steering docs, and configs to current template standards. Use when user says 'upgrade project', 'update templates', 'check for outdated docs', 'sync with latest plugin', 'relocate specs', 'how do I update my project', or 'bring my project up to date'. Detects the legacy `.claude/{steering,specs}` directory layout and migrates it in place via `git mv`, then diffs headings against current templates and merges missing sections while preserving all user content. Utility skill — run after plugin updates, outside the main SDLC pipeline."
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(gh:*), Bash(git:*), AskUserQuestion
model: opus
effort: high
---

# Upgrade Project

Bring an existing project forward to the current nmg-sdlc contract. This covers two related jobs:

1. **Directory relocation** — Move `.claude/steering/` → `steering/` and `.claude/specs/` → `specs/` at the project root (current Claude Code releases protect `.claude/` from Edit/Write; canonical SDLC artifacts must live at the root).
2. **Template reconciliation** — Diff existing steering docs, spec files, and runner configs against current templates and merge missing sections while preserving all user content.

**This skill is self-updating.** It reads templates at runtime, so when templates gain new sections, this skill detects them automatically without any code changes.

## When to Use

- Immediately after upgrading the nmg-sdlc plugin on a project that still uses the legacy `.claude/steering/` and `.claude/specs/` layout (these paths are now refused by Claude Code)
- When steering docs or specs were created with an older plugin version
- To check whether project files are up to date with current standards

## Unattended Mode

If the file `.claude/unattended-mode` exists in the project directory, this skill applies **non-destructive changes automatically** and **skips destructive operations** (which require interactive approval). Do NOT call `AskUserQuestion` in unattended mode.

**Non-destructive (auto-applied in unattended mode):** Legacy directory relocation (`.claude/steering/` → `steering/`, `.claude/specs/` → `specs/`), legacy exclusions-file rename (`.claude/migration-exclusions.json` → `.claude/upgrade-exclusions.json`), steering doc section additions, spec file section additions, Related Spec link corrections, legacy frontmatter migration (`Issue` → `Issues`, Change History additions), runner config key additions, CHANGELOG.md fixes, VERSION file creation/update, legacy spec-directory renames — solo (Steps 4d–4e).

**Destructive (skipped in unattended mode):** Spec directory consolidation, legacy spec-directory deletes (Steps 4b–4e). For each skipped operation, record it in a "Skipped Operations" list to output at Step 9.

**Informational only (reported but not applied in unattended mode):** Config value drift (Step 5 sub-step 6). Drifted values are included in the upgrade summary for visibility but are NOT automatically updated and are NOT recorded in the "Skipped Operations" block. Value updates may represent intentional customizations and require explicit per-value user approval in interactive mode.

**In unattended mode:**
- Step 1.5: Auto-apply the legacy layout relocation (directory moves via `git mv`, intra-file cross-reference rewrites, legacy-directory cleanup). Record the relocation in the summary but do not prompt.
- Step 4d: For solo renames (`feature-` or `bug-` targets), auto-apply `git mv`, frontmatter updates, and cross-reference updates without `AskUserQuestion`. For consolidation groups, skip `AskUserQuestion` and record each group as a skipped operation. Proceed to Step 4f
- Step 8 Part A: Auto-select all proposed steering doc sections (equivalent to selecting all)
- Step 8 Part B: Auto-approve all non-destructive changes; skip any destructive operations (record them as skipped)
- Step 8 Part C: Skip entirely — do not prompt for config value drift updates; drift is reported in the summary only
- Step 9: After applying changes, emit a machine-readable "Skipped Operations (Unattended-Mode)" section
- Do NOT write to `.claude/upgrade-exclusions.json` (nothing is declined in unattended mode)

**When `.claude/unattended-mode` does NOT exist**, all existing interactive behavior is preserved unchanged — present all findings via `AskUserQuestion` as described in Step 8.

## What Gets Analyzed

```
.claude/steering/                   — Legacy steering directory (relocated in Step 1.5 to steering/)
.claude/specs/                      — Legacy spec directory (relocated in Step 1.5 to specs/)
.claude/migration-exclusions.json   — Legacy exclusions file (renamed in Step 1.5 to .claude/upgrade-exclusions.json)
steering/*.md                       — Steering docs (product, tech, structure, retrospective)
specs/*/requirements.md             — Spec requirements (feature + defect variants)
specs/*/design.md                   — Spec designs (feature + defect variants)
specs/*/tasks.md                    — Spec task breakdowns (feature + defect variants)
specs/*/                            — Spec directory naming (legacy {issue#}-{slug} vs feature-/bug- convention)
specs/feature-*/*.md                — Spec frontmatter format (singular **Issue** vs plural **Issues**, Change History)
.claude/upgrade-exclusions.json     — Declined sections (read to skip, written after user declines)
sdlc-config.json                    — SDLC runner config (JSON key merge + value drift detection)
CHANGELOG.md                        — Changelog format and completeness (Keep a Changelog)
VERSION                             — Single source of truth for project version (plain text semver)
```

**NOT analyzed:** `feature.gherkin` files (generated, not templated).

---

## Workflow

**Before Step 1:** Check whether `.claude/unattended-mode` exists in the project root. Set an unattended-mode flag for the entire session. This flag determines behavior at Step 1.5, Step 4d, Step 8, and Step 9 — check it once here rather than re-reading the file at each branch point.

### Step 1: Resolve Template Paths

Locate the template directories from the installed plugin. Use this skill's own file path to resolve paths relative to the plugin root:

- **Steering templates:** `plugins/nmg-sdlc/skills/onboard-project/templates/*.md`
  - `product.md`, `tech.md`, `structure.md`
- **Retrospective template:** `plugins/nmg-sdlc/skills/run-retro/templates/retrospective.md`
  - Maps to `steering/retrospective.md`
- **Spec templates:** `plugins/nmg-sdlc/skills/write-spec/templates/*.md`
  - `requirements.md`, `design.md`, `tasks.md`
- **Config template:** `scripts/sdlc-config.example.json`

Use `Glob` to find the skill's own `SKILL.md` path, then resolve `../../..` to get the plugin root. From the plugin root, resolve `../..` to get the marketplace root (which contains `scripts/`).

Read all template files. If a template file cannot be found, skip that category and note it in the summary.

### Step 1.5: Detect And Relocate Legacy Layout

Claude Code now protects the project-level `.claude/` directory from Edit/Write. Canonical SDLC artifacts must live at the project root (`steering/`, `specs/`), not under `.claude/`. Runtime artifacts (`.claude/unattended-mode`, `.claude/sdlc-state.json`, `.claude/upgrade-exclusions.json`) stay under `.claude/` — they are read/written by the SDLC runner and the upgrade-exclusions write-back directly, not by Claude's Edit/Write tools, so they are unaffected by the protection.

**Detection**

1. Check whether `.claude/steering/` exists and contains at least one file. Call this `STEERING_LEGACY`.
2. Check whether `.claude/specs/` exists and contains at least one subdirectory. Call this `SPECS_LEGACY`.
3. Check whether `.claude/migration-exclusions.json` exists. Call this `EXCLUSIONS_LEGACY`.
4. If none of `STEERING_LEGACY`, `SPECS_LEGACY`, `EXCLUSIONS_LEGACY` is true, skip the rest of Step 1.5 and proceed to Step 2.

**Preflight**

Before any move, verify the working tree is clean enough to relocate safely:

- Run `git status --porcelain` — if it lists tracked-file modifications under `.claude/steering/`, `.claude/specs/`, or `.claude/migration-exclusions.json`, warn the user. In interactive mode, ask whether to proceed; in unattended mode, proceed (the `git mv` preserves staged/unstaged state on the renamed paths).
- Verify that `steering/` and `specs/` at the project root do NOT already exist with content. If they do, abort Step 1.5 with an instructive message — a half-upgraded project should be resolved manually before re-running.

**Proposal (interactive mode only)**

If NOT unattended, present the proposed actions via `AskUserQuestion`:

```
question: "The project uses the legacy `.claude/steering/` and `.claude/specs/` layout. Relocate to `steering/` and `specs/` at the project root?"
options:
  - "Yes, relocate (recommended)"
  - "Skip for now — I'll run this later"
```

If the user skips, record the relocation as deferred and stop Step 1.5. Downstream steps in this skill will still run against whatever lives at `steering/` and `specs/` (which in this case is nothing) and will produce a mostly-empty upgrade report.

**Apply (both modes, once approved)**

1. If `STEERING_LEGACY`: run `git mv .claude/steering steering`. After the move, run `Grep` across every file under `steering/` for the literal strings `.claude/steering/` and `.claude/specs/`. For each match, use `Edit` to rewrite the reference to the new path (`steering/` and `specs/` respectively). Remove any now-empty `.claude/steering/` directory.
2. If `SPECS_LEGACY`: run `git mv .claude/specs specs`. After the move, run `Grep` across every file under `specs/` for the literal strings `.claude/steering/` and `.claude/specs/`. For each match, use `Edit` to rewrite the reference. This especially applies to `**Related Spec**` fields in defect-spec `requirements.md` files, which commonly embed the legacy path. Remove any now-empty `.claude/specs/` directory.
3. If `EXCLUSIONS_LEGACY`: run `git mv .claude/migration-exclusions.json .claude/upgrade-exclusions.json`. The content schema is unchanged.
4. Do NOT touch `.claude/unattended-mode` or `.claude/sdlc-state.json`. These runtime artifacts remain under `.claude/` unchanged.
5. Record every action applied for inclusion in the Step 9 summary.

**Post-conditions**

- `.claude/steering/` and `.claude/specs/` no longer exist (or are empty and removed)
- `steering/` and `specs/` contain the relocated content with git history preserved (the `git mv` registers as a rename in git, visible via `git log --follow`)
- No `.claude/specs/` or `.claude/steering/` string appears inside any relocated file
- `.claude/migration-exclusions.json` has been renamed to `.claude/upgrade-exclusions.json` (if it existed)
- Runtime artifacts under `.claude/` are unchanged

### Step 2: Scan Project Files

Glob for existing project files using the new canonical paths:

```
steering/*.md
specs/*/requirements.md
specs/*/design.md
specs/*/tasks.md
sdlc-config.json
```

**Only analyze files that already exist.** Do not create missing files — suggest `/onboard-project` or `/write-spec` for that.

### Step 3: Analyze Steering Docs

For each existing steering doc (e.g., `steering/product.md`):

1. **Read the template file** (e.g., `onboard-project/templates/product.md`)
2. **Extract template content** — steering templates from `onboard-project/templates/` wrap their content in a ` ```markdown ... ``` ` code block; parse only the content between the opening ` ```markdown ` and the closing ` ``` `. The retrospective template (`run-retro/templates/retrospective.md`) is direct markdown — use the file content as-is.
3. **Parse headings** — Extract all `## ` headings from both the template content and the existing project file.
4. **Diff headings** — Identify headings present in the template but absent from the project file.
5. **Filter by relevance** — For each missing heading, check whether it matches a keyword in the **Relevance Heuristic Table** below. If it matches, use `Glob` to check the project codebase for the associated evidence patterns. If **no evidence is found**, exclude the section from the proposal. If the heading does **not match any keyword** in the table (unknown section), **conservatively include it** — let the user decide.
6. **Filter by exclusions** — Read `.claude/upgrade-exclusions.json` from the project root (if it exists). If the file exists but contains invalid JSON, treat it as empty (log a warning and proceed as if no exclusions are set). If the current file's name (e.g., `tech.md`) appears in `excludedSections` and the missing heading text appears in that array, skip the section — it was previously declined by the user.
7. **Extract missing sections** — For each remaining missing heading (after filtering), extract the full section content from the template (from the `## ` heading to the next `## ` heading or end of content).
8. **Determine insertion point** — Insert after the predecessor heading in template order. For example, if the template order is `## A`, `## B`, `## C` and `## B` is missing, insert it after the `## A` section's content.

**Example:**

```
Template headings:    ## Mission, ## Target Users, ## Core Value Proposition, ## Product Principles, ## Success Metrics
Existing headings:    ## Mission, ## Target Users, ## Core Value Proposition, ## Success Metrics
Missing:              ## Product Principles
Insert after:         ## Core Value Proposition (its predecessor in template order)
```

Consult [references/upgrade-procedures.md](references/upgrade-procedures.md) for the **Relevance Heuristic Table** (keyword-to-glob mapping) and **Exclusion File Schema** (`.claude/upgrade-exclusions.json` format).

### Step 4: Analyze Spec Files

For each spec file (`requirements.md`, `design.md`, `tasks.md`) in each spec directory:

1. **Detect the variant** — Read the first `# ` heading in the existing file:
   - **Feature variant:** `# Requirements:`, `# Design:`, `# Tasks:`
   - **Defect variant:** `# Defect Report:`, `# Root Cause Analysis:`, `# Tasks:` with a flat summary table (Task/Description/Status columns)

2. **Extract the correct template variant** — Each spec template file contains two code blocks:
   - **First ` ```markdown ``` ` block** = feature variant
   - **Second ` ```markdown ``` ` block** (after `# Defect` heading) = defect variant

   Select the block matching the detected variant.

3. **Same heading-diff logic as Step 3** — Parse `## ` headings, identify missing, extract section content, determine insertion point.

**Variant detection rules for `tasks.md`** (both variants start with `# Tasks:`):
- If the Summary table has columns `Phase | Tasks | Status` → feature variant
- If the Summary table has columns `Task | Description | Status` → defect variant

**Skip `feature.gherkin` files entirely** — these are generated from acceptance criteria, not templated.

### Step 4a: Validate Related Spec Links

For each **defect spec** found in Step 2's scan (identified by a `# Defect Report:` first heading), read the `**Related Spec**:` field and validate it:

1. **Check target exists** — Verify the target directory exists and contains a `requirements.md`
2. **Check target is a feature spec** — Read the target's first heading:
   - `# Requirements:` → valid feature spec link. No action needed.
   - `# Defect Report:` → target is another defect spec. Follow its `Related Spec` link recursively (maintaining a visited set to detect cycles) until reaching a `# Requirements:` heading or a dead end.
3. **Record findings** for each invalid link:
   - **Current link**: the path in the defect spec's `Related Spec` field
   - **Suggested correction**: the resolved root feature spec path, or "N/A — no feature spec found" if the chain is circular or broken
4. **Skip** defect specs that have no `Related Spec` field or whose `Related Spec` is already `N/A`

### Step 4b: Detect Legacy Spec Directories

Identify spec directories that use the legacy `{issue#}-{slug}` naming convention and need migration to `feature-{slug}` or `bug-{slug}`.

1. Run `Glob` for `specs/*/requirements.md` to list all spec directories
2. For each spec directory, classify by naming pattern:
   - **Legacy**: directory name matches `{digits}-{slug}` pattern (e.g., `42-add-dark-mode`, `71-dark-mode-toggle`)
   - **New**: directory name starts with `feature-` or `bug-` prefix
3. Collect all legacy directories into a candidate list
4. If no legacy directories found, skip Steps 4c–4e and proceed to Step 4f

### Step 4c: Cluster Legacy Specs by Feature

Group related legacy specs that should be consolidated into a single feature spec.

1. For each legacy spec, extract keywords from:
   - Directory name (strip the issue number prefix)
   - First `# ` heading of `requirements.md` (feature name)
   - User story content
2. **Exclude bug specs from consolidation grouping** — read the first heading of each `requirements.md`:
   - `# Defect Report:` → this is a bug spec. Do not group it with other specs. It becomes a solo `bug-{slug}` rename candidate.
   - `# Requirements:` → this is a feature spec. Include in keyword comparison.
3. Compare keyword sets between all pairs of feature legacy specs. Group specs with significant keyword overlap (>50% shared keywords after stop word filtering).
4. For each group, determine the proposed feature name:
   - Use the most descriptive slug from the group (longest directory slug after stripping the issue number prefix)
   - Prefix with `feature-`
5. Solo feature specs (no group match) are also migration candidates: simple rename from `{issue#}-{slug}` to `feature-{slug}`
6. Solo bug specs: rename from `{issue#}-{slug}` to `bug-{slug}`

### Step 4d: Present Consolidation Candidates

For each group (and solo migration candidates):

1. Show the source directories and proposed target name
2. Show a brief summary of each source spec's content (first heading, issue number, status)

**If `.claude/unattended-mode` exists:** Handle solo renames and consolidation groups differently:
   - **Solo renames** (type: `"rename"` or `"rename-bug"` — single directory → `feature-{slug}/` or `bug-{slug}/`): These are non-destructive. Execute the rename automatically — proceed to Step 4e to apply `git mv`, frontmatter updates, and cross-reference updates without `AskUserQuestion`. Do NOT record solo renames as skipped operations.
   - **Consolidation groups** (type: `"consolidation"` — multiple directories merged into one): These are destructive. Skip `AskUserQuestion` and record each group as a skipped operation (affected paths: source directories, reason: "Destructive operation requires interactive approval").
   After processing all groups, proceed to Step 4f.

**If `.claude/unattended-mode` does NOT exist:** Use `AskUserQuestion` for each group:
   - Option 1: "Consolidate into `feature-{slug}/`" (or "Rename to `feature-{slug}/`" / "Rename to `bug-{slug}/`" for solo specs)
   - Option 2: "Skip — leave as-is"

### Step 4e: Apply Consolidation

For each approved group or solo rename:

**Multi-spec consolidation** (groups of related feature specs):

1. **Create new directory**: `specs/feature-{slug}/`
2. **Merge `requirements.md`**: Start with the oldest spec's content as the base. Change `**Issue**` to `**Issues**` and collect all issue numbers (e.g., `**Issues**: #42, #71`). Append ACs and FRs from other specs with sequential numbering (find highest existing AC/FR number, continue from there). Create a Change History section from all contributing specs.
3. **Merge `design.md`**: Start with the oldest spec's design as base. Append unique sections from other specs. Update `**Issues**` frontmatter.
4. **Merge `tasks.md`**: Start with the oldest spec's tasks as base. Append tasks from other specs with renumbered IDs. Mark tasks from already-implemented specs as completed. Update Summary table.
5. **Merge `feature.gherkin`**: Concatenate all scenarios. Tag appended scenarios with `# From issue #N` comments.
6. **Update defect spec cross-references** (per AC12): Run `Grep` across all spec directories (both already-renamed `bug-*/` and not-yet-renamed `{issue#}-*/`) for `**Related Spec**` fields pointing to any consolidated or renamed legacy directory. Filter to defect specs by checking for `# Defect Report:` heading. Update those fields to point to the new `feature-{slug}/` directory. Follow chain resolution through intermediate defect specs (maintaining a visited set for cycle detection).
7. **Remove legacy directories** after successful merge.

**Solo feature rename** (single legacy spec → `feature-{slug}`):
1. Rename the directory using `git mv`: `git mv specs/{issue#}-{slug}/ specs/feature-{slug}/`
2. Update frontmatter in `requirements.md`, `design.md`, and `tasks.md`: replace `**Issue**: #N` with `**Issues**: #N`
3. Update defect spec cross-references: Run `Grep` across all `specs/*/requirements.md` files for `**Related Spec**` fields containing the old path (`specs/{issue#}-{slug}/`). For each match, verify it is a defect spec by checking for a `# Defect Report:` first heading. Use `Edit` to update the `**Related Spec**` field to point to `specs/feature-{slug}/`. Then follow chain resolution: for each updated defect spec, check whether other defect specs have `**Related Spec**` fields pointing to IT, and update those as well. Maintain a visited set to prevent circular traversal.

**Solo bug rename** (single legacy bug spec → `bug-{slug}`):
1. Rename the directory using `git mv`: `git mv specs/{issue#}-{slug}/ specs/bug-{slug}/`
2. Keep the singular `**Issue**: #N` field (bugs are per-issue)
3. Update defect spec cross-references: Run `Grep` across all `specs/*/requirements.md` files for `**Related Spec**` fields containing the old path (`specs/{issue#}-{slug}/`). For each match, verify it is a defect spec by checking for a `# Defect Report:` first heading. Use `Edit` to update the `**Related Spec**` field to point to `specs/bug-{slug}/`. Then follow chain resolution: for each updated defect spec, check whether other defect specs have `**Related Spec**` fields pointing to IT, and update those as well. Maintain a visited set to prevent circular traversal.

### Step 4f: Migrate Legacy Frontmatter in Feature Specs

After consolidation (or independently, for feature specs that already use `feature-` naming but retain old frontmatter):

1. Run `Glob` for `specs/feature-*/requirements.md`, `specs/feature-*/design.md`, `specs/feature-*/tasks.md`
2. For each file, read the first 15 lines and check:
   - Is the first `# ` heading a **feature variant** (`# Requirements:`, `# Design:`, `# Tasks:`)? If `# Defect Report:` or `# Root Cause Analysis:`, skip — defect specs keep singular `**Issue**`.
   - Does the file contain `**Issue**: #` (singular) instead of `**Issues**: #` (plural)?
   - Is the `## Change History` section missing?
3. For files with singular `**Issue**`: propose replacing `**Issue**: #N` with `**Issues**: #N`
4. For files missing `## Change History`: propose adding the section before `## Validation Checklist` with a single entry: `| #N | [original date from **Date** field] | Initial feature spec |`
5. Present findings alongside other migration proposals in Step 8
6. Apply on user confirmation using `Edit`

This step runs on ALL feature-variant specs in `feature-*/` directories, catching specs that were created by newer `/write-spec` but somehow have stale frontmatter, renamed from legacy directories but not yet updated, or already in the new naming convention from a prior partial migration.

### Step 5: Analyze SDLC Runner Config

If `sdlc-config.json` exists in the project root:

1. **Read both files** — the project's `sdlc-config.json` and the template `sdlc-config.example.json`. If either file cannot be parsed as valid JSON, skip config analysis entirely and note the parse error in the summary (e.g., "Config analysis skipped — `sdlc-config.json` is not valid JSON").
2. **Compare root-level keys** — Identify keys present in the template but absent from the project config
3. **Compare `steps.*` keys** — Identify missing step entries (e.g., a new step added to the template)
4. **Compare step sub-keys** — For each step that exists in both, identify missing sub-keys (e.g., `skill`, `timeoutMin`)
5. **Record missing keys at all levels** with their template default values
6. **Compare scalar values for drift** — After identifying missing keys, perform a second pass over keys that exist in **both** the project config and the template:
   - **Root-level scalars** (e.g., `model`, `effort`, `maxRetriesPerStep`, `maxBounceRetries`, `maxLogDiskUsageMB`): compare values directly
   - **Step sub-key scalars** (e.g., `steps.createPR.maxTurns`, `steps.verify.timeoutMin`, `steps.implement.model`): for each step present in both configs, compare each sub-key value
   - **Skip non-scalars**: if both values are objects, recurse into sub-keys (for `steps.*` nesting — max two levels deep: `steps.{stepName}.{subKey}`); if one is an object and the other a scalar, record as drift (type mismatch); arrays and complex nested objects not present in the template are excluded
   - **Skip user additions**: keys present in the project config but absent from the template are not drift candidates (FR32)
7. **Record each drifted value** with:
   - Dotted key path (e.g., `steps.createPR.maxTurns`)
   - Current project value
   - Template default value

**Important:** Never overwrite existing values. Only add keys that are entirely absent. Config value drift is reported separately and requires explicit per-value user approval before any values are updated (see Step 8 Part C).

### Step 6: Analyze CHANGELOG.md

Check whether the project has a `CHANGELOG.md` and ensure it follows the [Keep a Changelog](https://keepachangelog.com/) format.

#### If no CHANGELOG.md exists

Generate one from git history:

1. **Parse git tags**: Run `git tag --sort=-v:refname` to list version tags (e.g., `v1.0.0`, `v1.1.0`).
2. **Parse commits between tags**: For each pair of consecutive tags, run `git log {older_tag}..{newer_tag} --pretty=format:"%s"` to get commit messages.
3. **Classify by conventional commit type**:
   - `feat:` → `### Added`
   - `fix:` → `### Fixed`
   - `refactor:`, `chore:`, `docs:`, `style:`, `perf:`, `test:` → `### Changed`
   - Commits without a conventional prefix → `### Changed`
4. **Build the CHANGELOG**: Use Keep a Changelog format with version headings from git tags and an `[Unreleased]` section for commits after the latest tag.
5. **If no git tags exist**: Group all commits under a `## [0.1.0]` version heading (with today's date) and leave the `[Unreleased]` section empty.

#### If CHANGELOG.md exists

Reconcile it with the Keep a Changelog format:

1. **Check for `[Unreleased]` section**: If missing, add one after the preamble.
2. **Check version headings**: Compare git tags against CHANGELOG version headings. Identify any tagged versions missing from the CHANGELOG.
3. **Check categories**: Ensure entries are grouped under standard categories (`### Added`, `### Changed`, `### Fixed`, `### Removed`, etc.). Flag any non-standard categories.
4. **Check preamble**: Ensure the file starts with a title (`# Changelog`) and a brief description.
5. **Preserve manual entries**: Any entries that do not correspond to conventional commits must be preserved exactly as-is.

Record findings (missing sections, malformed headings, reconciliation needed) for the summary in Step 9.

### Step 7: Analyze VERSION File

Ensure the project has a `VERSION` file that reflects the current version.

1. **Determine expected version**:
   - If CHANGELOG.md has versioned headings (from Step 7 or pre-existing), use the latest version heading as the expected version.
   - If no CHANGELOG.md versions exist but git tags are present, use the latest semver git tag.
   - If neither exists, default to `0.1.0`.
2. **Check for VERSION file**:
   - If `VERSION` does not exist: Record a finding to create it with the expected version.
   - If `VERSION` exists: Read it and compare to the expected version. If they differ, record a finding to update it.
   - If they match: No action needed.

Record findings for the summary in Step 9.

### Step 8: Present Findings

Display a per-file summary of all proposed changes. Group by category:

```
## Upgrade Summary

### Legacy Layout Relocation (Step 1.5)
- `.claude/steering/` → `steering/` (relocated, cross-refs rewritten)
- `.claude/specs/` → `specs/` (relocated, cross-refs rewritten)
- `.claude/migration-exclusions.json` → `.claude/upgrade-exclusions.json` (renamed)

### Steering Docs
- **product.md** — Add 2 missing sections: "Product Principles", "Brand Voice"
- **tech.md** — Up to date
- **structure.md** — Not found (run /onboard-project to create)

### Spec Files
- **feature-add-auth/requirements.md** — Add 1 missing section: "UI/UX Requirements"
- **feature-add-auth/design.md** — Up to date
- **bug-login-crash/requirements.md** (defect) — Up to date

### Spec Directory Consolidation
- **42-add-dark-mode/** + **71-dark-mode-toggle/** → Consolidate into **feature-dark-mode/**
- **55-add-weather-alerts/** → Rename to **feature-weather-alerts/**
- **15-fix-login/** → Rename to **bug-fix-login/**

### Spec Frontmatter Migration
- **feature-dark-mode/requirements.md** — Update `**Issue**` → `**Issues**`, add Change History section
- **feature-dark-mode/design.md** — Update `**Issue**` → `**Issues**`, add Change History section

### Runner Config
- **sdlc-config.json** — Add 2 missing keys: "cleanup", "steps.merge"

### Config Value Drift
- **steps.createPR.maxTurns**: `15` → `30` (template default)
- **steps.implement.maxTurns**: `80` → `100` (template default)
- **maxRetriesPerStep**: `2` → `3` (template default)

### Related Spec Links
- **bug-auto-mode-cleanup/requirements.md** — Related Spec points to defect spec; suggested correction: `specs/feature-automation-mode-support/`
- **bug-session-crash/requirements.md** — Related Spec points to nonexistent directory; suggested correction: N/A

```

If everything is up to date, report:

```
Everything is up to date — no upgrade needed.
```

And stop here.

Otherwise, proceed to approval. The approval flow has three parts:

**If `.claude/unattended-mode` exists:** Skip Part A, Part B, and Part C approval prompts. Auto-select all proposed steering doc sections (equivalent to selecting all). Auto-approve all non-destructive changes (including solo directory renames already applied in Step 4d, and the legacy layout relocation applied in Step 1.5). Any remaining destructive operations (consolidations, legacy directory deletes) that were not already recorded in Step 4d should be recorded as skipped operations now. Config value drift is reported in the summary but NOT applied — skip Part C entirely (value updates may represent intentional customizations). Proceed directly to Step 9.

**If `.claude/unattended-mode` does NOT exist:** Follow the interactive approval flow below.

#### Part A: Steering doc sections (per-section approval)

If there are proposed steering doc sections, present them via `AskUserQuestion` with `multiSelect: true`. Each option represents one section for one file:

```
question: "Select which steering doc sections to add (unselected sections will be remembered and skipped in future runs):"
multiSelect: true
options:
  - label: "tech.md: Testing Standards"
    description: "BDD testing framework, Gherkin conventions, test pyramid"
  - label: "product.md: Product Principles"
    description: "Decision-making guidelines when requirements conflict"
  - ...one option per proposed section
```

Sections the user does **not** select are treated as declined and will be persisted in Step 9.

If there are **no** proposed steering doc sections (all were filtered by relevance or exclusions), skip Part A.

#### Part B: Other changes (per-group for consolidation, all-or-nothing for the rest)

If there are proposed spec directory consolidations or renames (from Steps 4b–4e), present each group individually via `AskUserQuestion`:

```
question: "Consolidate 42-add-dark-mode/ + 71-dark-mode-toggle/ into feature-dark-mode/?"
options:
  - "Yes, consolidate"
  - "Skip — leave as-is"
```

For spec frontmatter migrations, spec file sections, Related Spec corrections, runner config keys, CHANGELOG fixes, or VERSION changes, ask as a batch:

```
question: "Apply the remaining upgrade changes (spec sections, frontmatter updates, Related Spec corrections, config, changelog)?"
options:
  - "Yes, apply all"
  - "No, cancel"
```

If there are no non-steering changes, skip Part B.

#### Part C: Config value drift (per-value approval)

If Step 5 found config value drift (scalar values that differ between the project config and the template):

1. Present drifted values via `AskUserQuestion` with `multiSelect: true`:

```
question: "The following config values differ from the current template defaults. Select which values to update (unselected values will be kept as-is):"
multiSelect: true
options:
  - label: "steps.createPR.maxTurns: 15 → 30"
    description: "Maximum agentic turns for PR creation step"
  - label: "steps.implement.maxTurns: 80 → 100"
    description: "Maximum agentic turns for implementation step"
  - label: "maxRetriesPerStep: 2 → 3"
    description: "Maximum retry attempts per SDLC step"
  - ...one option per drifted value
```

2. Each option label shows the dotted key path and values in `current → template` format
3. Each option description provides brief context about the key's purpose
4. Unselected values are left unchanged — they are not recorded or persisted as declined (drift is re-evaluated every run)

If no drift was found in Step 5, skip Part C.

#### Part D: Recommended runner defaults diff (batch approve)

This flow is additive — the existing key-merge (Step 9 item 6) and per-value drift prompt (Part C) are unchanged. Part D specifically surfaces changes to the per-step `model` / `effort` / `maxTurns` / `timeoutMin` defaults so users upgrading across plugin versions can adopt the shipped recommendations without clicking through each field individually.

1. **Build the diff.** For each step in `steps.*`, compare the user's `model`, `effort`, `maxTurns`, and `timeoutMin` against the values in `scripts/sdlc-config.example.json`. Include only fields where the user's value differs from (or inherits a value different than) the shipped example. Present unset/inherited values as `(unset — inherited "<global>")` so the source of each value is visible.
2. **Present the diff table** (interactive mode only) in a single `AskUserQuestion` with three options:

```
question: "Apply recommended defaults from the shipped example config? (Review the diff below.)"

  Recommended default changes:
    steps.startCycle.model:     (unset — inherited "opus") → "haiku"
    steps.startCycle.maxTurns:  5 → 10
    steps.implement.effort:     "medium" → "xhigh"
    steps.implement.maxTurns:   100 → 150
    steps.verify.maxTurns:      60 → 100
    ...

options:
  - "Apply all recommended defaults"
  - "Review each field individually (falls back to Part C behavior)"
  - "Decline — keep my current values"
```

3. **Apply on approval.** "Apply all" updates each listed field in `sdlc-config.json` via `Edit`, preserving JSON formatting. "Review individually" falls through to the existing Part C per-value flow. "Decline" leaves values unchanged and records nothing (drift is re-evaluated every run).
4. **Unattended mode.** In unattended mode, Part D is **not** applied — the diff is instead recorded in the upgrade summary (under a "Recommended defaults (not applied)" heading) for visibility. This preserves the existing value-drift contract: automatic runs never overwrite user-configured values.

### Step 9: Apply Changes

Follow the detailed apply procedures in [references/upgrade-procedures.md](references/upgrade-procedures.md). In summary:

1. **Legacy layout relocation** — Already applied in Step 1.5 (directory moves via `git mv`, cross-reference rewrites, exclusions-file rename). Include a note in the summary for user visibility.
2. **Spec directory consolidation** — Apply merges from Step 4e (create directories, merge files, update cross-references, remove legacy directories).
3. **Spec frontmatter migration** — Apply updates from Step 4f (replace `**Issue**:` → `**Issues**:`, insert Change History sections).
4. **Markdown files** — Insert missing sections after their predecessor heading using `Edit`. Add `---` separator matching file style. Re-read to verify.
5. **Related Spec corrections** — Replace `**Related Spec**:` lines with resolved feature spec paths.
6. **JSON config** — Add missing keys only; never overwrite existing values.
7. **Config value drift updates** — For each user-selected drifted value from Part C (interactive mode only; skipped in unattended mode):
   - Read the current `sdlc-config.json`
   - Use `Edit` to replace the old value with the template default value, matching the exact JSON formatting (2-space indentation)
   - Re-read the file after each update to verify the change was applied correctly
   - Preserve all other values — only the explicitly selected values are updated
8. **Persist declined sections** — If NOT in unattended mode, save unselected steering doc sections to `.claude/upgrade-exclusions.json`. In unattended mode, skip this step (nothing is declined).
9. **Output summary** — Report changes applied (including any drift updates and the legacy layout relocation), declined, skipped, and filtered sections with recommendations.
10. **Skipped Operations (Unattended-Mode)** — If running in unattended mode and any destructive operations were skipped, emit a machine-readable block after the output summary:

```
## Skipped Operations (Unattended-Mode)

The following destructive operations were skipped because `.claude/unattended-mode` is active.
Run `/upgrade-project` interactively to apply them.

| Operation Type | Affected Paths | Reason |
|---------------|----------------|--------|
| consolidation | `42-add-dark-mode/` + `71-dark-mode-toggle/` → `feature-dark-mode/` | Destructive operation requires interactive approval |
```

If no destructive operations were skipped, omit this section entirely.

---

## Key Rules

1. **Never modify existing content** — Only insert new sections or add new keys
2. **Never create files** — Only update files that already exist (exceptions: `CHANGELOG.md`, `VERSION`, and `.claude/upgrade-exclusions.json` may be created if missing)
3. **Never overwrite values** — For JSON, only add keys that are absent. Exception: config value drift updates are applied only with explicit per-value user approval (Step 8 Part C); in unattended mode, value updates are never applied
4. **Skip `feature.gherkin`** — These are generated, not templated
5. **Interactive by default** — When `.claude/unattended-mode` is absent, present findings with per-section approval for steering docs and wait for user selection before applying
6. **Unattended-mode aware** — When `.claude/unattended-mode` exists: auto-apply all non-destructive changes (legacy layout relocation, section additions, frontmatter updates, config keys, changelog fixes, solo directory renames); skip all destructive operations (consolidations, legacy spec-directory deletes) and report them in a machine-readable "Skipped Operations" block
7. **Self-updating** — Read templates at runtime; never hardcode template content
8. **Filter irrelevant sections** — Use codebase analysis (Relevance Heuristic Table) to exclude steering doc sections with no evidence of relevance; persist user declines in `.claude/upgrade-exclusions.json` (interactive mode only)
9. **Conservative defaults** — When a missing section's heading does not match any keyword in the heuristic table, include it in the proposal and let the user decide
10. **Preserve runtime artifacts** — Never relocate `.claude/unattended-mode` or `.claude/sdlc-state.json`; only the exclusions file is renamed

---

## Integration with SDLC Workflow

Run this skill periodically after plugin updates to keep project files current:

```
/onboard-project (one-time)
         ↓
/upgrade-project (after plugin updates)
         ↓
/draft-issue  →  /start-issue  →  /write-spec  →  /write-code  →  /simplify  →  /verify-code  →  /open-pr
```

Next step: Once the upgrade completes, resume your normal SDLC workflow — run `/draft-issue` for new work or `/start-issue` to pick up an existing issue.
