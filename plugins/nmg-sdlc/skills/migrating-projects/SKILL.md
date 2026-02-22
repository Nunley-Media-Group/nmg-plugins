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

#### Relevance Heuristic Table

Use this table to determine whether a missing template section is relevant to the project. For each missing heading, check if it matches a keyword (case-insensitive substring match against the heading text). If it matches, run `Glob` with the associated patterns **one at a time, stopping at the first match** — if any pattern returns results, the section is relevant (include it) and skip remaining patterns. If **none** return results, the section is irrelevant — exclude it.

| Heading Keyword | Codebase Evidence (Glob Patterns) |
|----------------|----------------------------------|
| `Database` | `**/migrations/**`, `**/schema.*`, `**/*database*`, `**/*prisma*`, `**/*knexfile*`, `**/sequelize*`, `**/typeorm*`, `**/drizzle*`, `**/*.sql`, `**/models/**` |
| `API / Interface Standards` | `**/routes/**`, `**/controllers/**`, `**/api/**`, `**/endpoints/**`, `**/*router*`, `**/swagger*`, `**/openapi*` |
| `Design Tokens` or `UI Standards` | `**/components/**`, `**/*.css`, `**/*.scss`, `**/*.styled.*`, `**/theme*`, `**/tokens*`, `**/*.tsx`, `**/*.vue`, `**/*.svelte` |

**Conservative default:** If a missing heading does not match any keyword in this table, include it in the proposal. The table is a filter for known-irrelevant sections, not a whitelist.

#### Exclusion File Schema

The `.claude/migration-exclusions.json` file stores section headings the user has previously declined:

```json
{
  "excludedSections": {
    "tech.md": ["Database Standards", "API / Interface Standards"],
    "structure.md": ["Design Tokens / UI Standards (if applicable)"]
  }
}
```

- Keys are steering doc filenames (not full paths)
- Values are arrays of exact heading text (without the `## ` prefix)
- Only sections explicitly declined by the user are stored
- Stale entries (for headings removed from templates) are harmless

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
- **42-add-auth/requirements.md** — Add 1 missing section: "UI/UX Requirements"
- **42-add-auth/design.md** — Up to date
- **15-fix-login/requirements.md** (defect) — Up to date

### OpenClaw Config
- **sdlc-config.json** — Add 2 missing keys: "cleanup", "steps.merge"

### Related Spec Links
- **17-fix-auto-mode-cleanup-on-exit/requirements.md** — Related Spec points to defect spec; suggested correction: `.claude/specs/11-automation-mode-support/`
- **42-fix-session-bug/requirements.md** — Related Spec points to nonexistent directory; suggested correction: N/A

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

#### Part B: Other changes (all-or-nothing)

If there are proposed spec file sections, Related Spec corrections, OpenClaw config keys, CHANGELOG fixes, or VERSION changes, ask separately:

```
question: "Apply the remaining migration changes (spec files, Related Spec corrections, config, changelog)?"
options:
  - "Yes, apply all"
  - "No, cancel"
```

If there are no non-steering changes, skip Part B.

**This skill does not support auto-mode.** Always present findings and wait for user approval.

### Step 10: Apply Changes

If the user approves:

#### Markdown files (steering docs and specs)

For each file with missing sections:

1. Read the file
2. For each missing section (in template order):
   - Find the predecessor section's heading in the file
   - Locate the end of the predecessor section (the line before the next `## ` heading, or end of file)
   - Use `Edit` to insert the missing section content (including `---` separator and `## ` heading) after the predecessor section
3. After all insertions, re-read the file to verify the new headings are present

**Insertion format:** Insert a blank line, then `---`, then a blank line, then the full section content from the template (heading + body). Match the separator style used in the rest of the file.

#### Related Spec corrections

For each defect spec with an approved Related Spec correction (from Step 4a findings):

1. Read the defect spec's `requirements.md`
2. Use `Edit` to replace the `**Related Spec**:` line with the corrected value (the resolved feature spec path, or `N/A`)

#### JSON config

For the `sdlc-config.json`:

1. Read the current file
2. For each missing root-level key, add it with the template default value
3. For each missing step entry, add it with the template default values
4. For each existing step with missing sub-keys, add the missing sub-keys
5. Write the updated JSON (preserve existing values, only add missing keys)
6. Use `Edit` to add the missing keys — do not overwrite the entire file

#### Persist declined sections

After applying approved changes, persist any newly declined steering doc sections:

1. Read `.claude/migration-exclusions.json` from the project root (or start with `{ "excludedSections": {} }` if it doesn't exist)
2. For each steering doc section that was **proposed but not selected** by the user in Step 9 Part A, add the heading text to the `excludedSections` array for that file
3. Write the updated JSON to `.claude/migration-exclusions.json` using `Write`

**Important:** Only add newly declined sections. Do not remove existing entries — they represent prior user decisions.

#### Output summary

After applying changes, output a summary:

```
## Migration Complete

### Changes Applied
- **product.md** — Added sections: "Product Principles"
- **sdlc-config.json** — Added keys: "cleanup", "steps.merge"

### Declined (will be skipped in future runs)
- **product.md** — "Brand Voice" (saved to .claude/migration-exclusions.json)

### Skipped (already up to date)
- tech.md, structure.md, 42-add-auth/design.md

### Filtered by relevance (no codebase evidence)
- **tech.md** — "Database Standards", "API / Interface Standards"

### Recommendations
- Review added sections and customize placeholder content
- Run /installing-openclaw-skill to update the OpenClaw skill
- To re-propose a declined section, remove it from .claude/migration-exclusions.json
```

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
