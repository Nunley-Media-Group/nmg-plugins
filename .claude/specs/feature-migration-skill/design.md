# Design: Add Migration Skill

**Issues**: #25, #72, #95
**Date**: 2026-02-25
**Status**: Draft
**Author**: Claude

---

## Overview

The migration skill (`/migrating-projects`) is a prompt-based SKILL.md workflow that brings existing project files up to current plugin standards. Like all nmg-sdlc skills, it is a Markdown document that guides Claude through a structured process — no runtime code is required.

The skill follows a **scan → analyze → present → approve → apply** pattern. It reads the latest templates at runtime from the plugin's template directories, compares their heading structure against existing project files, identifies missing sections, and presents proposed additions for user review before modifying any files.

The core algorithm is **heading-based section diffing for Markdown files** and **key-level diffing for JSON configs**. The skill never rewrites existing content — it only inserts missing sections at the correct position with template placeholder content.

---

## Architecture

### Component Diagram

```
/migrating-projects (SKILL.md)
    │
    ├── Step 1: Locate Templates
    │   ├── Steering templates:  setting-up-steering/templates/*.md
    │   ├── Spec templates:      writing-specs/templates/*.md
    │   └── Config template:     openclaw/scripts/sdlc-config.example.json
    │
    ├── Step 2: Scan Project Files
    │   ├── Steering docs:       .claude/steering/*.md
    │   ├── Spec directories:    .claude/specs/*/{requirements,design,tasks}.md
    │   └── Config:              sdlc-config.json (project root)
    │
    ├── Step 3: Analyze Differences
    │   ├── Markdown files → Heading-based section diffing (## level)
    │   └── JSON configs   → Key-level diffing (root + steps)
    │
    ├── Step 4: Present Changes (Interactive Review Gate)
    │   └── Per-file summary of proposed additions
    │
    ├── Step 5: Apply Changes
    │   └── Insert missing sections / merge missing keys
    │
    └── Step 6: OpenClaw Skill Version Check
        └── Compare ~/.openclaw/skills/running-sdlc/ against source
```

### Data Flow

```
1. Skill resolves template directory paths from the installed plugin
2. Glob finds existing project files (steering docs, specs, config)
3. Read loads each template and its corresponding project file
4. Claude parses ## headings from both and identifies missing sections
5. For each missing section, Claude extracts the template content between headings
6. Proposed changes are presented as a per-file summary
7. User approves or rejects
8. If approved, Claude uses Edit to insert missing sections at correct positions
9. Summary report is output
```

---

## API / Interface Changes

### New Skill

| Skill | Location | Purpose |
|-------|----------|---------|
| `/migrating-projects` | `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` | Migrate project files to latest template standards |

### Skill Invocation

**Input:** No arguments required. The skill operates on the current project directory.

**Output:** Summary report listing all files analyzed and changes made.

**Errors:**

| Condition | Behavior |
|-----------|----------|
| No `.claude/steering/` directory found | Skip steering migration, report "no steering docs found" |
| No `.claude/specs/` directory found | Skip spec migration, report "no specs found" |
| No `sdlc-config.json` found | Skip config migration, report "no config found" |
| Template directories not resolvable | Error: "Cannot find plugin templates — is nmg-sdlc installed?" |
| User rejects changes | Abort with no modifications |

---

## Database / Storage Changes

No database or schema changes. This skill operates on local Markdown and JSON files only.

---

## State Management

No persistent state. The skill is stateless — it performs a full comparison on every invocation. There is no version tracking or migration history.

---

## UI Components

Not applicable — this is a CLI skill with text-based interaction.

---

## Detailed Design

### Section Diffing Algorithm (Markdown)

The core migration logic for Markdown files uses **heading-level comparison**:

1. **Parse headings** — Extract all `##`-level headings from both the template and the existing file
2. **Identify missing** — Find headings present in the template but absent in the existing file
3. **Determine insertion point** — For each missing heading, find the preceding heading (in template order) that exists in the project file; the missing section inserts after that section's content
4. **Extract template content** — The content for each missing section is the text between its heading and the next heading in the template (placeholder guidance, tables, etc.)

**Heading extraction approach:**
```
Template headings:  [## Mission, ## Target Users, ## Core Value, ## Product Principles, ## Success Metrics]
Existing headings:  [## Mission, ## Target Users, ## Success Metrics]
Missing:            [## Core Value, ## Product Principles]
```

**Insertion logic:**
- `## Core Value` → insert after `## Target Users` section content (predecessor in template order)
- `## Product Principles` → insert after `## Core Value` section content (which was just inserted)

**Template content boundaries:**
- Each template file contains the template inside a Markdown code block (` ```markdown ... ``` `)
- The skill must parse the **content inside the code block**, not the surrounding instructional text
- For templates with two variants (feature + defect), the feature variant is the first code block and the defect variant follows after a `# Defect` heading

### Spec Variant Detection

For spec files (`requirements.md`, `design.md`, `tasks.md`), the skill must determine whether to compare against the feature or defect template variant:

1. **Content-based detection (primary):** Check the first heading in the existing file:
   - `# Requirements:` or `# Design:` or `# Tasks:` → feature variant
   - `# Defect Report:` or `# Root Cause Analysis:` → defect variant
2. **No fallback to gh CLI needed** — the file heading is definitive since `/writing-specs` always uses these heading patterns

### JSON Config Diffing

For `sdlc-config.json`, the approach differs from Markdown:

1. **Read both files** — Parse the project's `sdlc-config.json` and the template `sdlc-config.example.json`
2. **Compare at root level** — Identify top-level keys in the template that are absent from the project config
3. **Compare at steps level** — Identify step keys (`steps.*`) in the template absent from the project config
4. **Merge strategy:**
   - Missing root keys → add with template default values
   - Missing step keys → add with template default values
   - Existing keys → preserve user values (never overwrite)
   - New keys within existing steps (e.g., a new `skill` field added to an existing step) → add with template default

### Config Value Drift Detection (from #95)

The existing JSON Config Diffing (Step 5) identifies **missing** keys — keys present in the template but absent from the project config. Config value drift detection extends this to also identify **divergent values** — keys present in both files but with different scalar values.

**Algorithm:**

1. After identifying missing keys (existing Step 5 logic), perform a second pass over keys that exist in **both** project config and template
2. For each common key, compare values:
   - **Root-level scalars** (e.g., `model`, `effort`, `maxRetriesPerStep`, `maxBounceRetries`, `maxLogDiskUsageMB`): direct value comparison
   - **Step sub-key scalars** (e.g., `steps.createPR.maxTurns`, `steps.verify.timeoutMin`, `steps.implement.model`): iterate over each step present in both configs, compare each sub-key value
   - **Skip non-scalars**: complex objects (e.g., `cleanup.processPatterns` array) and keys that exist in the project but not in the template (user additions) are excluded from drift comparison
3. Record each drifted value with:
   - Dotted key path (e.g., `steps.createPR.maxTurns`)
   - Current project value
   - Template default value

**Value comparison rules:**

| Scenario | Action |
|----------|--------|
| Key in both, same scalar value | No drift — skip |
| Key in both, different scalar value | Record as drift |
| Key in both, both are objects | Recurse into sub-keys (for `steps.*` nesting) |
| Key in both, one is object and one is scalar | Record as drift (type mismatch) |
| Key only in project (user addition) | Skip — not a drift candidate (FR32) |
| Key only in template (missing key) | Handled by existing Step 5 missing-key logic |

**Presentation (Step 9):**

Drifted values are reported in a new "Config Value Drift" section of the migration summary:

```
### Config Value Drift
- **steps.createPR.maxTurns**: `15` → `30` (template default)
- **steps.implement.maxTurns**: `80` → `100` (template default)
- **maxRetriesPerStep**: `2` → `3` (template default)
```

**Interactive approval (Step 9, Part C — new):**

In interactive mode, drifted values are presented via `AskUserQuestion` with `multiSelect: true`:

```
question: "The following config values differ from the current template defaults. Select which values to update (unselected values will be kept as-is):"
multiSelect: true
options:
  - label: "steps.createPR.maxTurns: 15 → 30"
    description: "Template default was updated from 15 to 30 in v2.17.0"
  - label: "steps.implement.maxTurns: 80 → 100"
    description: "Template default for implementation turns"
  - ...one option per drifted value
```

**Auto-mode behavior:**

When `.claude/auto-mode` exists, config value drift is:
- **Reported** in the summary output (so the orchestrator/user can see it)
- **NOT applied** — value updates are skipped without recording as "skipped operations" (they are informational, not deferred destructive operations)
- Rationale: drifted values may be intentional customizations (e.g., a project deliberately set lower `maxTurns` for cost control). Automatic updates could break working configurations.

**Application (Step 10):**

For each user-selected drifted value:
1. Read the current `sdlc-config.json`
2. Use `Edit` to replace the old value with the template default value
3. Preserve JSON formatting (2-space indentation per project JSON standards)
4. Re-read the file to verify the update

### OpenClaw Skill Version Check

1. **Read installed files** at `~/.openclaw/skills/running-sdlc/`
2. **Read source files** at `openclaw/skills/running-sdlc/` in the marketplace clone
3. **Compare content** — If any file differs, warn the user and suggest running `/installing-openclaw-skill`
4. **If not installed** — Skip with a note that OpenClaw skill is not installed locally

### Gherkin Files (feature.gherkin)

Gherkin files in `.claude/specs/*/feature.gherkin` are **excluded from section migration**. Unlike Markdown specs, Gherkin files contain project-specific scenarios that are not structurally comparable to the template. The template is a placeholder guide, not a structural standard. Migration of Gherkin files would risk corrupting hand-written test scenarios.

### Template Resolution

Templates are resolved at runtime from the installed plugin directory. The skill uses `Glob` to locate:

```
plugins/nmg-sdlc/skills/setting-up-steering/templates/*.md  → steering templates
plugins/nmg-sdlc/skills/writing-specs/templates/*.md         → spec templates
openclaw/scripts/sdlc-config.example.json                    → config template
```

The skill uses `${CLAUDE_PLUGIN_ROOT}` or resolves paths relative to the skill's own location within the plugin directory tree.

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Full file regeneration** | Re-run `/setting-up-steering` and `/writing-specs` to regenerate files from scratch | Simple, always produces latest format | Destroys all user-written content; requires re-filling every section | Rejected — violates content preservation requirement |
| **B: Heading-based section diffing** | Parse headings, identify missing sections, insert at correct position | Preserves user content; self-updating; lightweight | Requires careful heading parsing; can't detect renamed sections | **Selected** — best balance of safety and effectiveness |
| **C: Line-by-line diff/merge** | Full text diff between template and existing file | Catches every difference including within sections | Would flag all user customizations as "differences"; high false positive rate | Rejected — too noisy; would try to overwrite user content |
| **D: Version-tagged migrations** | Track template version in a metadata field, apply incremental patches per version | Precise; handles renames and reorganizations | Requires maintaining migration scripts per version; not self-updating | Rejected — violates self-updating design principle |
| **E: Feature manifest file** | Create a `feature.json` in each spec dir that tracks contributing issues and relationships | Structured, machine-parseable | Extra file to maintain, adds complexity, existing frontmatter is sufficient | Rejected — frontmatter in existing files is simpler |
| **F: Frontmatter in existing files** | Add `**Issues**` field and Change History section to existing spec files | No new files, builds on existing conventions, human-readable | Parsing Markdown frontmatter is less reliable than JSON | **Selected for issue tracking** — aligns with existing patterns, simpler |
| **G: Issue-number aliasing** | Keep `{issue#}-{slug}` naming but add symlinks from `feature-{slug}` | Backwards compatible, no migration needed | Symlinks break on Windows (violates cross-platform constraint in tech.md) | Rejected — cross-platform violation |
| **H: Spec database** | SQLite or JSON database tracking spec→issue relationships | Most flexible querying | Overkill for a Markdown-based workflow, external dependency | Rejected — violates process-over-tooling principle |

---

## Security Considerations

- [x] **Authentication**: No external auth required; operates on local files only
- [x] **Authorization**: Interactive review gate prevents unauthorized file modifications
- [x] **Input Validation**: Template paths resolved from known plugin directories; no user-supplied paths
- [x] **Data Sanitization**: Existing file content is never reprocessed or re-interpreted
- [x] **Sensitive Data**: No secrets or credentials involved; operates on Markdown and JSON config files

---

## Performance Considerations

- [x] **Caching**: Not needed — single-pass analysis within one skill invocation
- [x] **Pagination**: Not applicable
- [x] **Lazy Loading**: Templates loaded only for file types that exist in the project
- [x] **Indexing**: Not applicable
- [x] **Spec Discovery Performance**: Glob + Grep over existing specs completes within seconds even for 50+ spec directories

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Section diffing | BDD | Missing sections detected and inserted correctly |
| Content preservation | BDD | Existing content unchanged after migration |
| Variant detection | BDD | Feature vs defect templates applied correctly |
| JSON config diffing | BDD | Missing keys merged, existing values preserved |
| Edge cases | BDD | Already up-to-date, missing files, no project files |
| OpenClaw check | BDD | Outdated skill detected and reported |
| Spec discovery | BDD | Related specs found by keyword matching |
| Amendment fidelity | BDD | Sequential numbering preserved; no content loss during amendment |
| Consolidation | BDD | Legacy dirs merged into feature-prefixed dir correctly |
| Config value drift detection | BDD | Drifted scalar values detected for root and step keys |
| Config drift per-value approval | BDD | User selects which drifts to update; declined values preserved |
| Config drift auto-mode | BDD | Drift reported but not applied when auto-mode enabled |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Heading parsing misidentifies section boundaries | Low | Medium | Use `## ` prefix matching (standard ATX headings); validate against known template headings |
| Template code block parsing extracts wrong content | Low | High | Templates follow a consistent pattern (instructional text + single code block per variant); test with all current templates |
| Inserted sections break document flow | Low | Medium | Insert with proper `---` separators matching template style; user reviews before apply |
| JSON merge overwrites user-customized step values | Low | High | Only add missing keys; never modify existing key values |
| Renamed template sections cause false "missing" | Low | Low | Acceptable trade-off — skill inserts the new-name section; user can manually remove the old-name section during review |
| Keyword matching produces false positives (unrelated specs matched) | Medium | Low | Human confirmation gate; user can reject match and create new spec |
| Keyword matching misses related spec (false negative) | Medium | Medium | User can manually specify which spec to amend; keywords are extractable from issue title which should share terminology |
| Amendment corrupts existing spec content | Low | High | Amendments write full file content atomically (not partial edits); Change History provides audit trail |
| Legacy migration removes specs that shouldn't be consolidated | Low | High | Every consolidation requires explicit user confirmation; auto-mode does not apply to destructive consolidation |
| Branch name no longer matches spec directory | Medium | Low | Updated path resolution algorithm checks `**Issues**` frontmatter first, falls back to slug matching |
| Defect spec cross-references break during consolidation | Medium | Medium | Chain resolution with cycle detection (already proven in current migrating-projects Step 4a) |
| Drift detection flags intentional customizations | High | Low | Per-value selection lets users decline updates; auto-mode never auto-applies value changes |
| Drift detection misses nested values | Low | Medium | Recursive comparison for `steps.*` sub-keys; complex objects (arrays) excluded from comparison to avoid false positives |
| JSON formatting corrupted during drift update | Low | Medium | Use `Edit` to replace individual values; re-read file to verify after each update |

---

## Open Questions

- [x] Should `feature.gherkin` files be migrated? — **No**, they contain project-specific scenarios not structurally comparable to the template
- [x] How should template code blocks be parsed? — Extract content between ` ```markdown ` and ` ``` ` delimiters; first block is feature variant, content after `# Defect` heading is defect variant
- [x] What about `### ` (H3) level headings? — Only compare at `## ` level for section presence; H3 subheadings are part of their parent section's content and get included when a missing `## ` section is inserted

---

### From Issue #72

## Detailed Design: Writing-Specs Changes

### New Section: Feature Name Convention

The updated convention derives spec directory names from the issue type and title:

**Algorithm:**
1. Take the issue title (e.g., "Add dark mode toggle to settings")
2. Lowercase, replace spaces and special characters with hyphens
3. Remove leading/trailing hyphens, collapse consecutive hyphens
4. Determine prefix from issue type:
   - If issue has `bug` label → prefix `bug-`
   - Otherwise → prefix `feature-`
5. Result: `feature-add-dark-mode-toggle-to-settings` or `bug-login-crash-on-timeout`

**Fallback:** If the feature-name cannot be determined from context, use `Glob` to find `.claude/specs/*/requirements.md` and match against the current issue number (search the `**Issues**` frontmatter field) or branch name keywords.

### New Section: Spec Discovery

This section is added between "Defect Detection" and "Phase 1: SPECIFY". It runs only for non-bug issues.

**Process:**
1. Extract keywords from issue title: tokenize by spaces, filter stop words (`a`, `an`, `the`, `to`, `for`, `in`, `on`, `of`, `and`, `or`, `is`, `it`, `as`, `at`, `by`, `with`, `from`, `this`, `that`, `add`, `fix`, `update`, `implement`, `create`)
2. Run `Glob` for `.claude/specs/feature-*/requirements.md` to list all feature specs
3. If no feature specs exist, skip to "create new spec" flow
4. For each candidate spec file, run `Grep` using each keyword; count total hits
5. Rank candidates by total keyword hits; filter to candidates with at least 2 keyword hits
6. If one or more candidates found:
   - Read the top candidate's first heading and user story for context
   - Present to user via `AskUserQuestion`:
     - Option 1: "Amend existing spec: `feature-{slug}`" (with brief description)
     - Option 2: "Create new spec" (derives new `feature-{slug}` from current issue title)
   - If auto-mode: select Option 1 (amend) automatically
7. If no candidates found: proceed to create new spec

### Amendment Flow: Phase 1 — SPECIFY

When amending an existing spec:

1. Read existing `requirements.md`
2. Parse the `**Issues**` field to get current issue list
3. Parse all `### ACN:` headings to find the highest AC number
4. Parse the FR table to find the highest FR ID
5. Read the new issue content (from `gh issue view`)
6. Construct the amendment:
   - Append new issue number to `**Issues**` field
   - Update `**Date**` to today
   - Append new ACs (starting from next sequential number) under existing ACs
   - Append new FRs (starting from next sequential ID) to existing FR table
   - Append new items to Out of Scope if applicable
   - Add a Change History entry
7. Write the amended `requirements.md`

When creating a new spec (no amendment):
- Use the existing Phase 1 flow, but with `**Issues**: #N` (plural field name) and include a Change History section with the initial entry

### Amendment Flow: Phase 2 — PLAN

When amending:
1. Read existing `design.md`
2. Identify sections that need additions (new components, new API changes, new considerations)
3. Append new content to relevant sections rather than replacing
4. Add new issue to `**Issues**` field
5. If new alternatives exist, add to Alternatives Considered
6. Write amended `design.md`

### Amendment Flow: Phase 3 — TASKS

When amending:
1. Read existing `tasks.md`
2. Parse all `### TNNN:` headings to find the highest task number
3. Append new tasks starting from next sequential number
4. New tasks may form a new phase (e.g., "Phase 6: Enhancement — Issue #71") or be added to existing phases
5. Update Summary table with new phase/counts
6. Update Dependency Graph to include new tasks
7. Write amended `tasks.md`

For `feature.gherkin`:
1. Read existing file
2. Append new scenarios at the end (before any closing comments)
3. New scenarios are tagged with a comment indicating the contributing issue: `# Added by issue #71`

### Frontmatter Format

**Feature specs** (requirements.md, design.md, tasks.md):
```markdown
**Issues**: #42, #71
**Date**: 2026-02-22
**Status**: Draft | In Review | Approved
**Author**: [name]
```

**Defect specs** (unchanged — bugs are per-issue):
```markdown
**Issue**: #90
...
```

### Change History Section Format

Added to the bottom of `requirements.md` (before Validation Checklist), to `design.md`, and to `tasks.md`:

```markdown
## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #42 | 2026-01-15 | Initial feature spec: dark mode support |
| #71 | 2026-02-22 | Added toggle to settings panel, extended ACs |
```

## Detailed Design: Migrating-Projects Consolidation Steps

### New Step 4b: Detect Legacy Spec Directories

Between current Step 4a (Related Spec validation) and Step 5 (OpenClaw config):

1. Run `Glob` for `.claude/specs/*/requirements.md`
2. For each spec directory, classify by naming pattern:
   - Legacy: matches `{digits}-{slug}` pattern (e.g., `42-add-dark-mode`)
   - New: starts with `feature-` or `bug-` prefix
3. Collect all legacy directories into a candidate list
4. If no legacy directories found, skip consolidation steps

### New Step 4c: Cluster Legacy Specs by Feature

1. For each legacy spec, extract keywords from:
   - Directory name (strip issue number prefix)
   - First heading of `requirements.md` (feature name)
   - User story content
2. Compare keyword sets between all pairs of legacy specs
3. Group specs with significant keyword overlap (e.g., >50% shared keywords after stop word filtering)
4. For each group, determine the proposed feature name:
   - Use the most descriptive directory slug from the group (longest after stripping issue number)
   - Prefix with `feature-` (legacy bug specs are detected by `# Defect Report:` heading and excluded from consolidation)
5. Solo specs (no group) are also migration candidates: rename from `42-add-dark-mode` to `feature-add-dark-mode`

### New Step 4d: Present Consolidation Candidates

For each group (and solo migration candidates):

1. Show the source directories and proposed target name
2. Show a brief summary of each source spec's content (first heading, issue number, status)
3. Use `AskUserQuestion` for each group:
   - Option 1: "Consolidate into `feature-{slug}/`"
   - Option 2: "Skip — leave as-is"
   - **Auto-mode does NOT apply** — migration is always interactive (destructive operation: directories are deleted; requires human confirmation)

### New Step 4e: Apply Consolidation

For each approved group:

1. **Create new directory**: `.claude/specs/feature-{slug}/`
2. **Merge requirements.md**:
   - Start with the oldest spec's content as the base
   - Change `**Issue**` to `**Issues**` and collect all issue numbers
   - Append ACs and FRs from other specs with sequential numbering
   - Create Change History from all contributing specs
3. **Merge design.md**:
   - Start with oldest spec's design as base
   - Append unique sections from other specs
   - Update `**Issues**` frontmatter
4. **Merge tasks.md**:
   - Start with oldest spec's tasks as base
   - Append tasks from other specs with renumbered IDs
   - Mark tasks from already-implemented specs as completed
5. **Merge feature.gherkin**:
   - Concatenate all scenarios, tagged with source issue comments
6. **Update defect spec references** (per AC21):
   - `Grep` all `.claude/specs/*/requirements.md` for `**Related Spec**` fields pointing to any consolidated or renamed legacy directory
   - Update those fields to point to the new `feature-{slug}/` directory
   - Follow chain resolution through intermediate defect specs (with visited-set cycle detection)
7. **Remove legacy directories**: Delete the original `{issue#}-{slug}/` directories after successful consolidation

### New Step 4f: Migrate Legacy Frontmatter in Feature Specs

After consolidation (or independently, for feature specs that were already renamed but retain old frontmatter):

1. `Glob` for `.claude/specs/feature-*/requirements.md`, `.claude/specs/feature-*/design.md`, `.claude/specs/feature-*/tasks.md`
2. For each file, read the first 15 lines and check:
   - Is the first `# ` heading a feature variant (`# Requirements:`, `# Design:`, `# Tasks:`)? If `# Defect Report:` or `# Root Cause Analysis:`, skip.
   - Does the file contain `**Issue**: #` (singular) instead of `**Issues**: #` (plural)?
   - Is the `## Change History` section missing?
3. For files with singular `**Issue**`: propose replacing `**Issue**: #N` with `**Issues**: #N`
4. For files missing `## Change History`: propose adding the section before `## Validation Checklist` with a single entry
5. Present findings alongside other migration proposals in Step 9
6. Apply on user confirmation using `Edit`

## Detailed Design: Spec Path Resolution Algorithm

Downstream skills (`/implementing-specs`, `/verifying-specs`) resolve issue number → spec path. The updated algorithm:

```
Input: issue number N (e.g., 42)

1. Extract branch name: parse `N-{slug}` from current git branch
2. Try direct match: Glob `.claude/specs/feature-*/requirements.md`
   - For each: Read first 10 lines, extract **Issues** field
   - If **Issues** contains #N → return this spec path
3. Try legacy match: Glob `.claude/specs/N-*/requirements.md`
   - If exactly one result → return this spec path
4. Try bug match: Glob `.claude/specs/bug-*/requirements.md`
   - For each: Read first 10 lines, extract **Issue** field
   - If **Issue** is #N → return this spec path
5. Fallback: Try keyword match from branch slug against all spec directory names
6. If no match found: prompt "No specs found. Run /writing-specs #N first."
```

## Detailed Design: Downstream Skill Changes

### implementing-specs SKILL.md

**Changes (documentation only):**

1. Update Feature Name Convention section to describe the new naming:
   > The `{feature-name}` is the spec directory name. For specs created with v2.15+, this follows the `feature-{slug}` or `bug-{slug}` convention (e.g., `feature-dark-mode`). Legacy specs use `{issue#}-{slug}` (e.g., `42-add-dark-mode`).

2. Update the fallback resolution to also check the `**Issues**` frontmatter field:
   > **Fallback:** Use `Glob` to find `.claude/specs/*/requirements.md`. For each result, read the `**Issues**` (or legacy `**Issue**`) frontmatter field and match against the current issue number. If no frontmatter match, try matching the issue number or branch name keywords against the directory name.

### verifying-specs SKILL.md

Same changes as implementing-specs (equivalent section).

## Detailed Design: Template Changes

### requirements.md Template

**Feature variant** changes:
- Line `**Issue**: #[number]` → `**Issues**: #[number]`
- Add Change History section before Validation Checklist

**Defect variant**: No changes (keeps singular `**Issue**`, no Change History)

### design.md Template

**Feature variant** changes:
- Line `**Issue**: #[number]` → `**Issues**: #[number]`
- Add Change History section before Validation Checklist (same format as requirements.md)

**Defect variant**: No changes

### tasks.md Template

**Feature variant** changes:
- Line `**Issue**: #[number]` → `**Issues**: #[number]`
- Add Change History section before Validation Checklist (same format as requirements.md)

**Defect variant**: No changes

### Writing-Specs Workflow Diagram

```
                      ┌──────────────┐
                      │  Read Issue  │
                      │  (gh issue)  │
                      └──────┬───────┘
                             │
                      ┌──────▼───────┐
                      │ Check Labels │
                      └──────┬───────┘
                             │
                ┌────────────┼────────────┐
                │ bug label  │            │ no bug label
                ▼            │            ▼
         ┌──────────┐       │     ┌──────────────┐
         │ Create   │       │     │ Search for   │
         │ bug-slug │       │     │ existing     │
         │ directory│       │     │ feature-*    │
         └────┬─────┘       │     │ specs        │
              │              │     └──────┬───────┘
              │              │            │
              │              │     ┌──────▼───────┐
              │              │     │ Match found? │
              │              │     └──────┬───────┘
              │              │      yes   │   no
              │              │     ┌──────┼───────┐
              │              │     ▼      │       ▼
              │              │  ┌──────┐  │  ┌──────────┐
              │              │  │Confirm│  │  │ Create   │
              │              │  │amend? │  │  │ feature- │
              │              │  └──┬───┘  │  │ slug dir │
              │              │ yes │ no   │  └────┬─────┘
              │              │     │  │   │       │
              │              │     │  └───┼───────┤
              │              │     ▼      │       │
              │              │  ┌──────┐  │       │
              │              │  │Amend │  │       │
              │              │  │spec  │  │       │
              │              │  └──┬───┘  │       │
              │              │     │      │       │
              └──────────────┼─────┼──────┼───────┘
                             │     │      │
                      ┌──────▼─────▼──────▼──────┐
                      │   Phase 1: SPECIFY       │
                      │   (create or amend)       │
                      ├──────────────────────────┤
                      │   Phase 2: PLAN          │
                      │   (create or amend)       │
                      ├──────────────────────────┤
                      │   Phase 3: TASKS         │
                      │   (create or amend)       │
                      └──────────────────────────┘
```

### Migrating-Projects Consolidation Workflow Diagram

```
  Existing Steps 1-4a (unchanged)
         │
  ┌──────▼──────────────────────┐
  │ Step 4b: Detect Legacy      │  NEW
  │ Spec Directories            │
  │ (pattern: {issue#}-{slug})  │
  └──────┬──────────────────────┘
         │
  ┌──────▼──────────────────────┐
  │ Step 4c: Cluster by Feature │  NEW
  │ (keyword analysis across    │
  │  requirements + design)     │
  └──────┬──────────────────────┘
         │
  ┌──────▼──────────────────────┐
  │ Step 4d: Present Candidates │  NEW
  │ (user confirms each group)  │
  └──────┬──────────────────────┘
         │
  ┌──────▼──────────────────────┐
  │ Step 4e: Consolidate        │  NEW
  │ - Create feature-{slug}/    │
  │ - Merge spec files          │
  │ - Update defect refs        │
  │ - Remove legacy dirs        │
  └──────┬──────────────────────┘
         │
  Existing Steps 5-10 (unchanged)
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #25 | 2026-02-15 | Initial design: migration skill with heading-based section diffing |
| #72 | 2026-02-22 | Added feature-centric spec management design: spec discovery, amendment flow, consolidation steps, path resolution algorithm |
| #95 | 2026-02-25 | Added config value drift detection design: value comparison algorithm, per-value approval flow, auto-mode reporting behavior |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Architecture follows existing project patterns (per `structure.md`) — SKILL.md in `skills/migrating-projects/`
- [x] All API/interface changes documented with schemas — skill input/output/errors defined
- [x] Database/storage changes planned with migrations — N/A (no database)
- [x] State management approach is clear — stateless, full comparison each run
- [x] UI components and hierarchy defined — N/A (CLI skill)
- [x] Security considerations addressed — interactive gate, no auth needed
- [x] Performance impact analyzed — single-pass, no external APIs
- [x] Testing strategy defined — BDD scenarios per acceptance criterion
- [x] Alternatives were considered and documented — 8 options evaluated
- [x] Risks identified with mitigations — 11 risks documented
