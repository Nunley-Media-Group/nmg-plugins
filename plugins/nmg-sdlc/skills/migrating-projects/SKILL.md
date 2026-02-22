---
name: migrating-projects
description: "Update project specs, steering docs, and configs to latest template standards. Use when user says 'migrate project', 'update templates', 'check for outdated docs', or 'sync with latest plugin'. Diffs headings against current templates and merges missing sections while preserving all user content."
model: opus
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(gh:*), Bash(git:*), AskUserQuestion
---

# Migrating Projects

Update existing project files (steering docs, specs, OpenClaw configs) to the latest template standards by diffing headings against current templates and merging missing sections — preserving all user content.

**This skill is self-updating.** It reads templates at runtime, so when templates gain new sections, this skill detects them automatically without any code changes.

## When to Use

- After updating the nmg-sdlc plugin (new template sections may exist)
- When steering docs or specs were created with an older plugin version
- To check whether project files are up to date with current standards

## Automation Mode

**This skill is ALWAYS interactive — `.claude/auto-mode` does NOT apply.**

Even if `.claude/auto-mode` exists in the project directory, this skill MUST present proposed changes via `AskUserQuestion` and wait for user approval before modifying any files. Migration is a sensitive operation that requires human review.

Do NOT skip the review gate in Step 9. Do NOT apply changes without explicit user approval.

## What Gets Analyzed

```
.claude/steering/*.md          — Steering docs (product, tech, structure, retrospective)
.claude/specs/*/requirements.md — Spec requirements (feature + defect variants)
.claude/specs/*/design.md      — Spec designs (feature + defect variants)
.claude/specs/*/tasks.md       — Spec task breakdowns (feature + defect variants)
.claude/specs/*/                — Spec directory naming (legacy {issue#}-{slug} vs feature-/bug- convention)
.claude/specs/feature-*/*.md   — Spec frontmatter format (singular **Issue** vs plural **Issues**, Change History)
.claude/migration-exclusions.json — Declined sections (read to skip, written after user declines)
sdlc-config.json               — OpenClaw runner config (JSON key merge)
~/.openclaw/skills/running-sdlc/ — OpenClaw skill version check
CHANGELOG.md                   — Changelog format and completeness (Keep a Changelog)
VERSION                        — Single source of truth for project version (plain text semver)
```

**NOT analyzed:** `feature.gherkin` files (generated, not templated).

---

## Workflow

### Step 1: Resolve Template Paths

Locate the template directories from the installed plugin. Use this skill's own file path to resolve paths relative to the plugin root:

- **Steering templates:** `plugins/nmg-sdlc/skills/setting-up-steering/templates/*.md`
  - `product.md`, `tech.md`, `structure.md`
- **Retrospective template:** `plugins/nmg-sdlc/skills/running-retrospectives/templates/retrospective.md`
  - Maps to `.claude/steering/retrospective.md`
- **Spec templates:** `plugins/nmg-sdlc/skills/writing-specs/templates/*.md`
  - `requirements.md`, `design.md`, `tasks.md`
- **Config template:** `openclaw/scripts/sdlc-config.example.json`

Use `Glob` to find the skill's own `SKILL.md` path, then resolve `../../..` to get the plugin root. From the plugin root, resolve `../..` to get the marketplace root (which contains `openclaw/`).

Read all template files. If a template file cannot be found, skip that category and note it in the summary.

### Step 2: Scan Project Files

Glob for existing project files:

```
.claude/steering/*.md
.claude/specs/*/requirements.md
.claude/specs/*/design.md
.claude/specs/*/tasks.md
sdlc-config.json
```

**Only analyze files that already exist.** Do not create missing files — suggest `/setting-up-steering` or `/writing-specs` for that.

### Step 3: Analyze Steering Docs

For each existing steering doc (e.g., `.claude/steering/product.md`):

1. **Read the template file** (e.g., `setting-up-steering/templates/product.md`)
2. **Extract template content** — steering templates from `setting-up-steering/` wrap their content in a ` ```markdown ... ``` ` code block; parse only the content between the opening ` ```markdown ` and the closing ` ``` `. The retrospective template (`running-retrospectives/templates/retrospective.md`) is direct markdown — use the file content as-is.
3. **Parse headings** — Extract all `## ` headings from both the template content and the existing project file.
4. **Diff headings** — Identify headings present in the template but absent from the project file.
5. **Filter by relevance** — For each missing heading, check whether it matches a keyword in the **Relevance Heuristic Table** below. If it matches, use `Glob` to check the project codebase for the associated evidence patterns. If **no evidence is found**, exclude the section from the proposal. If the heading does **not match any keyword** in the table (unknown section), **conservatively include it** — let the user decide.
6. **Filter by exclusions** — Read `.claude/migration-exclusions.json` from the project root (if it exists). If the file exists but contains invalid JSON, treat it as empty (log a warning and proceed as if no exclusions are set). If the current file's name (e.g., `tech.md`) appears in `excludedSections` and the missing heading text appears in that array, skip the section — it was previously declined by the user.
7. **Extract missing sections** — For each remaining missing heading (after filtering), extract the full section content from the template (from the `## ` heading to the next `## ` heading or end of content).
8. **Determine insertion point** — Insert after the predecessor heading in template order. For example, if the template order is `## A`, `## B`, `## C` and `## B` is missing, insert it after the `## A` section's content.

**Example:**

```
Template headings:    ## Mission, ## Target Users, ## Core Value Proposition, ## Product Principles, ## Success Metrics
Existing headings:    ## Mission, ## Target Users, ## Core Value Proposition, ## Success Metrics
Missing:              ## Product Principles
Insert after:         ## Core Value Proposition (its predecessor in template order)
```

Consult [references/migration-procedures.md](references/migration-procedures.md) for the **Relevance Heuristic Table** (keyword-to-glob mapping) and **Exclusion File Schema** (`.claude/migration-exclusions.json` format).

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

1. Run `Glob` for `.claude/specs/*/requirements.md` to list all spec directories
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
3. Use `AskUserQuestion` for each group:
   - Option 1: "Consolidate into `feature-{slug}/`" (or "Rename to `feature-{slug}/`" / "Rename to `bug-{slug}/`" for solo specs)
   - Option 2: "Skip — leave as-is"

**This skill is always interactive** — `.claude/auto-mode` does NOT apply. Every consolidation requires explicit user confirmation.

### Step 4e: Apply Consolidation

For each approved group or solo rename:

**Multi-spec consolidation** (groups of related feature specs):

1. **Create new directory**: `.claude/specs/feature-{slug}/`
2. **Merge `requirements.md`**: Start with the oldest spec's content as the base. Change `**Issue**` to `**Issues**` and collect all issue numbers (e.g., `**Issues**: #42, #71`). Append ACs and FRs from other specs with sequential numbering (find highest existing AC/FR number, continue from there). Create a Change History section from all contributing specs.
3. **Merge `design.md`**: Start with the oldest spec's design as base. Append unique sections from other specs. Update `**Issues**` frontmatter.
4. **Merge `tasks.md`**: Start with the oldest spec's tasks as base. Append tasks from other specs with renumbered IDs. Mark tasks from already-implemented specs as completed. Update Summary table.
5. **Merge `feature.gherkin`**: Concatenate all scenarios. Tag appended scenarios with `# From issue #N` comments.
6. **Update defect spec cross-references** (per AC12): Run `Grep` across all spec directories (both already-renamed `bug-*/` and not-yet-renamed `{issue#}-*/`) for `**Related Spec**` fields pointing to any consolidated or renamed legacy directory. Filter to defect specs by checking for `# Defect Report:` heading. Update those fields to point to the new `feature-{slug}/` directory. Follow chain resolution through intermediate defect specs (maintaining a visited set for cycle detection).
7. **Remove legacy directories** after successful merge.

**Solo feature rename** (single legacy spec → `feature-{slug}`):
1. Rename the directory from `{issue#}-{slug}/` to `feature-{slug}/`
2. Update frontmatter: `**Issue**: #N` → `**Issues**: #N`
3. Update defect spec cross-references that pointed to the old directory name

**Solo bug rename** (single legacy bug spec → `bug-{slug}`):
1. Rename the directory from `{issue#}-{slug}/` to `bug-{slug}/`
2. Keep the singular `**Issue**: #N` field (bugs are per-issue)
3. Update any defect spec cross-references that pointed to the old directory name

### Step 4f: Migrate Legacy Frontmatter in Feature Specs

After consolidation (or independently, for feature specs that already use `feature-` naming but retain old frontmatter):

1. Run `Glob` for `.claude/specs/feature-*/requirements.md`, `.claude/specs/feature-*/design.md`, `.claude/specs/feature-*/tasks.md`
2. For each file, read the first 15 lines and check:
   - Is the first `# ` heading a **feature variant** (`# Requirements:`, `# Design:`, `# Tasks:`)? If `# Defect Report:` or `# Root Cause Analysis:`, skip — defect specs keep singular `**Issue**`.
   - Does the file contain `**Issue**: #` (singular) instead of `**Issues**: #` (plural)?
   - Is the `## Change History` section missing?
3. For files with singular `**Issue**`: propose replacing `**Issue**: #N` with `**Issues**: #N`
4. For files missing `## Change History`: propose adding the section before `## Validation Checklist` with a single entry: `| #N | [original date from **Date** field] | Initial feature spec |`
5. Present findings alongside other migration proposals in Step 9
6. Apply on user confirmation using `Edit`

This step runs on ALL feature-variant specs in `feature-*/` directories, catching specs that were created by newer `/writing-specs` but somehow have stale frontmatter, renamed from legacy directories but not yet updated, or already in the new naming convention from a prior partial migration.

### Step 5: Analyze OpenClaw Config

If `sdlc-config.json` exists in the project root:

1. **Read both files** — the project's `sdlc-config.json` and the template `sdlc-config.example.json`
2. **Compare root-level keys** — Identify keys present in the template but absent from the project config
3. **Compare `steps.*` keys** — Identify missing step entries (e.g., a new step added to the template)
4. **Compare step sub-keys** — For each step that exists in both, identify missing sub-keys (e.g., `skill`, `timeoutMin`)
5. **Record missing keys at all levels** with their template default values

**Important:** Never overwrite existing values. Only add keys that are entirely absent.

### Step 6: Check OpenClaw Skill Version

Compare the installed OpenClaw skill with the source in the marketplace clone:

- **Installed:** `~/.openclaw/skills/running-sdlc/`
- **Source:** `openclaw/skills/running-sdlc/` (relative to marketplace root)

For each file in the source directory, read both the installed and source versions. If any file differs (or is missing from the installation), record a warning.

If the installed skill is outdated or missing, suggest running `/installing-openclaw-skill` to update.

If `~/.openclaw/skills/running-sdlc/` does not exist, note that OpenClaw is not installed and skip this check.

### Step 7: Analyze CHANGELOG.md

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

Record findings (missing sections, malformed headings, reconciliation needed) for the summary in Step 10.

### Step 8: Analyze VERSION File

Ensure the project has a `VERSION` file that reflects the current version.

1. **Determine expected version**:
   - If CHANGELOG.md has versioned headings (from Step 7 or pre-existing), use the latest version heading as the expected version.
   - If no CHANGELOG.md versions exist but git tags are present, use the latest semver git tag.
   - If neither exists, default to `0.1.0`.
2. **Check for VERSION file**:
   - If `VERSION` does not exist: Record a finding to create it with the expected version.
   - If `VERSION` exists: Read it and compare to the expected version. If they differ, record a finding to update it.
   - If they match: No action needed.

Record findings for the summary in Step 10.

### Step 9: Present Findings

Display a per-file summary of all proposed changes. Group by category:

```
## Migration Summary

### Steering Docs
- **product.md** — Add 2 missing sections: "Product Principles", "Brand Voice"
- **tech.md** — Up to date
- **structure.md** — Not found (run /setting-up-steering to create)

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

### OpenClaw Config
- **sdlc-config.json** — Add 2 missing keys: "cleanup", "steps.merge"

### Related Spec Links
- **bug-auto-mode-cleanup/requirements.md** — Related Spec points to defect spec; suggested correction: `.claude/specs/feature-automation-mode-support/`
- **bug-session-crash/requirements.md** — Related Spec points to nonexistent directory; suggested correction: N/A

### OpenClaw Skill
- ⚠ Installed skill is outdated — run /installing-openclaw-skill to update
```

If everything is up to date, report:

```
Everything is up to date — no migration needed.
```

And stop here.

Otherwise, proceed to approval. The approval flow has two parts:

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

Sections the user does **not** select are treated as declined and will be persisted in Step 10.

If there are **no** proposed steering doc sections (all were filtered by relevance or exclusions), skip Part A.

#### Part B: Other changes (per-group for consolidation, all-or-nothing for the rest)

If there are proposed spec directory consolidations or renames (from Steps 4b–4e), present each group individually via `AskUserQuestion`:

```
question: "Consolidate 42-add-dark-mode/ + 71-dark-mode-toggle/ into feature-dark-mode/?"
options:
  - "Yes, consolidate"
  - "Skip — leave as-is"
```

For spec frontmatter migrations, spec file sections, Related Spec corrections, OpenClaw config keys, CHANGELOG fixes, or VERSION changes, ask as a batch:

```
question: "Apply the remaining migration changes (spec sections, frontmatter updates, Related Spec corrections, config, changelog)?"
options:
  - "Yes, apply all"
  - "No, cancel"
```

If there are no non-steering changes, skip Part B.

**This skill does not support auto-mode.** Always present findings and wait for user approval.

### Step 10: Apply Changes

Follow the detailed apply procedures in [references/migration-procedures.md](references/migration-procedures.md). In summary:

1. **Spec directory consolidation** — Apply merges from Step 4e (create directories, merge files, update cross-references, remove legacy directories).
2. **Spec frontmatter migration** — Apply updates from Step 4f (replace `**Issue**:` → `**Issues**:`, insert Change History sections).
3. **Markdown files** — Insert missing sections after their predecessor heading using `Edit`. Add `---` separator matching file style. Re-read to verify.
4. **Related Spec corrections** — Replace `**Related Spec**:` lines with resolved feature spec paths.
5. **JSON config** — Add missing keys only; never overwrite existing values.
6. **Persist declined sections** — Save unselected steering doc sections to `.claude/migration-exclusions.json`.
7. **Output summary** — Report changes applied, declined, skipped, and filtered sections with recommendations.

---

## Key Rules

1. **Never modify existing content** — Only insert new sections or add new keys
2. **Never create files** — Only update files that already exist (exceptions: `CHANGELOG.md`, `VERSION`, and `.claude/migration-exclusions.json` may be created if missing)
3. **Never overwrite values** — For JSON, only add keys that are absent
4. **Skip `feature.gherkin`** — These are generated, not templated
5. **Always interactive** — Present findings with per-section approval for steering docs and wait for user selection before applying
6. **Self-updating** — Read templates at runtime; never hardcode template content
7. **Filter irrelevant sections** — Use codebase analysis (Relevance Heuristic Table) to exclude steering doc sections with no evidence of relevance; persist user declines in `.claude/migration-exclusions.json`
8. **Conservative defaults** — When a missing section's heading does not match any keyword in the heuristic table, include it in the proposal and let the user decide

---

## Integration with SDLC Workflow

Run this skill periodically after plugin updates to keep project files current:

```
/setting-up-steering (one-time)
         ↓
/migrating-projects (after plugin updates)
         ↓
/creating-issues  →  /writing-specs  →  /implementing-specs  →  /verifying-specs  →  /creating-prs
```
