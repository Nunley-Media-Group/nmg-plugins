---
name: migrating-projects
description: "Update project specs, steering docs, and configs to latest template standards."
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Edit, Bash(gh:*), AskUserQuestion
---

# Migrating Projects

Update existing project files (steering docs, specs, OpenClaw configs) to the latest template standards by diffing headings against current templates and merging missing sections — preserving all user content.

**This skill is self-updating.** It reads templates at runtime, so when templates gain new sections, this skill detects them automatically without any code changes.

## When to Use

- After updating the nmg-sdlc plugin (new template sections may exist)
- When steering docs or specs were created with an older plugin version
- To check whether project files are up to date with current standards

## What Gets Analyzed

```
.claude/steering/*.md          — Steering docs (product, tech, structure, retrospective)
.claude/specs/*/requirements.md — Spec requirements (feature + defect variants)
.claude/specs/*/design.md      — Spec designs (feature + defect variants)
.claude/specs/*/tasks.md       — Spec task breakdowns (feature + defect variants)
sdlc-config.json               — OpenClaw runner config (JSON key merge)
~/.openclaw/skills/running-sdlc/ — OpenClaw skill version check
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
5. **Extract missing sections** — For each missing heading, extract the full section content from the template (from the `## ` heading to the next `## ` heading or end of content).
6. **Determine insertion point** — Insert after the predecessor heading in template order. For example, if the template order is `## A`, `## B`, `## C` and `## B` is missing, insert it after the `## A` section's content.

**Example:**

```
Template headings:    ## Mission, ## Target Users, ## Core Value Proposition, ## Product Principles, ## Success Metrics
Existing headings:    ## Mission, ## Target Users, ## Core Value Proposition, ## Success Metrics
Missing:              ## Product Principles
Insert after:         ## Core Value Proposition (its predecessor in template order)
```

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

### Step 7: Present Findings

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

### OpenClaw Skill
- ⚠ Installed skill is outdated — run /installing-openclaw-skill to update
```

If everything is up to date, report:

```
Everything is up to date — no migration needed.
```

And stop here.

Otherwise, use `AskUserQuestion` to ask the user whether to proceed with the migration:

```
question: "Apply the migration changes listed above?"
options:
  - "Yes, apply all changes"
  - "No, cancel migration"
```

**This skill does not support auto-mode.** Always present findings and wait for user approval.

### Step 8: Apply Changes

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

#### JSON config

For the `sdlc-config.json`:

1. Read the current file
2. For each missing root-level key, add it with the template default value
3. For each missing step entry, add it with the template default values
4. For each existing step with missing sub-keys, add the missing sub-keys
5. Write the updated JSON (preserve existing values, only add missing keys)
6. Use `Edit` to add the missing keys — do not overwrite the entire file

#### Output summary

After applying changes, output a summary:

```
## Migration Complete

### Changes Applied
- **product.md** — Added sections: "Product Principles", "Brand Voice"
- **sdlc-config.json** — Added keys: "cleanup", "steps.merge"

### Skipped (already up to date)
- tech.md, structure.md, 42-add-auth/design.md

### Recommendations
- Review added sections and customize placeholder content
- Run /installing-openclaw-skill to update the OpenClaw skill
```

---

## Key Rules

1. **Never modify existing content** — Only insert new sections or add new keys
2. **Never create files** — Only update files that already exist
3. **Never overwrite values** — For JSON, only add keys that are absent
4. **Skip `feature.gherkin`** — These are generated, not templated
5. **Always interactive** — Present findings and wait for approval before applying
6. **Self-updating** — Read templates at runtime; never hardcode template content

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
