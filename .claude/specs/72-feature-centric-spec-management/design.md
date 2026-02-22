# Design: Feature-Centric Spec Management

**Issues**: #72
**Date**: 2026-02-22
**Status**: Draft
**Author**: Claude (nmg-sdlc)

---

## Overview

This feature modifies two SDLC skills (`/writing-specs` and `/migrating-projects`) and updates spec templates to support feature-centric spec management. The core architectural change is that spec directories shift from issue-centric naming (`{issue#}-{slug}`) to feature-centric naming (`feature-{slug}` / `bug-{slug}`), with multiple issues able to contribute to a single feature spec via an amendment flow.

The design affects four categories of artifacts: (1) the `/writing-specs` SKILL.md workflow, which gains a spec discovery and amendment flow; (2) the `/migrating-projects` SKILL.md workflow, which gains legacy spec consolidation; (3) spec templates, which gain multi-issue frontmatter and Change History; and (4) downstream skill documentation in `/implementing-specs` and `/verifying-specs`, which need updated path resolution descriptions.

Since all modified artifacts are Markdown skill definitions and templates (not runtime code), the architecture is prompt-workflow-oriented rather than component-oriented.

---

## Architecture

### Workflow Diagram — Writing-Specs (Modified)

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

### Workflow Diagram — Migrating-Projects (New Consolidation Steps)

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

### Data Flow — Spec Discovery in Writing-Specs

```
1. Extract issue title → tokenize → filter stop words → keyword list
2. Glob `.claude/specs/feature-*/requirements.md` → candidate specs
3. For each candidate: Grep keywords against requirements.md content
4. Score candidates by keyword hit count
5. Rank by score → present top match(es) to user
6. User confirms → amend OR reject → create new
```

### Data Flow — Amendment Process

```
1. Read existing spec file (requirements.md / design.md / tasks.md / feature.gherkin)
2. Parse current content:
   - Extract **Issues** field → list of issue numbers
   - Extract highest AC/FR/task number
   - Identify insertion points for new content
3. Construct amended version:
   - Add new issue to **Issues** field
   - Append new ACs with next sequential number
   - Append new FRs with next sequential ID
   - Append new design sections
   - Append new tasks (new phase or additions to existing phases)
   - Append new Gherkin scenarios to feature.gherkin
   - Add Change History entry
4. Write amended file atomically (write full content, not partial edits)
```

---

## Detailed Design: Writing-Specs Changes

### New Section: Feature Name Convention (replaces current lines 32-43)

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

### New Section: Spec Discovery (inserted before Phase 1)

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

### Modified Section: Phase 1 — SPECIFY (Amendment Path)

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

### Modified Section: Phase 2 — PLAN (Amendment Path)

When amending:
1. Read existing `design.md`
2. Identify sections that need additions (new components, new API changes, new considerations)
3. Append new content to relevant sections rather than replacing
4. Add new issue to `**Issues**` field
5. If new alternatives exist, add to Alternatives Considered
6. Write amended `design.md`

### Modified Section: Phase 3 — TASKS (Amendment Path)

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

### Modified Section: Frontmatter Format

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

### New Section: Change History

Added to the bottom of `requirements.md` (before Validation Checklist), to `design.md`, and to `tasks.md`:

```markdown
## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #42 | 2026-01-15 | Initial feature spec: dark mode support |
| #71 | 2026-02-22 | Added toggle to settings panel, extended ACs |
```

---

## Detailed Design: Migrating-Projects Changes

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
6. **Update defect spec references** (per AC12):
   - `Grep` all `.claude/specs/*/requirements.md` for `**Related Spec**` fields pointing to any consolidated or renamed legacy directory — search ALL spec directories (both `bug-*/` already renamed and `{issue#}-*/` not yet renamed), filtering to defect specs by checking for `# Defect Report:` heading
   - Update those fields to point to the new `feature-{slug}/` directory
   - Follow chain resolution through intermediate defect specs (with visited-set cycle detection)
7. **Remove legacy directories**: Delete the original `{issue#}-{slug}/` directories after successful consolidation

### New Step 4f: Migrate Legacy Frontmatter in Feature Specs

After consolidation (or independently, for feature specs that were already renamed but retain old frontmatter):

1. `Glob` for `.claude/specs/feature-*/requirements.md`, `.claude/specs/feature-*/design.md`, `.claude/specs/feature-*/tasks.md`
2. For each file, read the first 15 lines and check:
   - Is the first `# ` heading a feature variant (`# Requirements:`, `# Design:`, `# Tasks:`)? If `# Defect Report:` or `# Root Cause Analysis:`, skip (defect specs keep singular `**Issue**`).
   - Does the file contain `**Issue**: #` (singular) instead of `**Issues**: #` (plural)?
   - Is the `## Change History` section missing?
3. For files with singular `**Issue**`: propose replacing `**Issue**: #N` with `**Issues**: #N`
4. For files missing `## Change History`: propose adding the section before `## Validation Checklist` with a single entry: `| #N | [original date from **Date** field] | Initial feature spec |`
5. Present findings alongside other migration proposals in Step 9
6. Apply on user confirmation using `Edit` — replace the `**Issue**:` line and insert the Change History section

This step runs on ALL feature-variant specs in `feature-*/` directories, not just those being consolidated. It catches specs that were:
- Created by the new `/writing-specs` but somehow have stale frontmatter
- Renamed from legacy directories but not yet updated
- Already in the new naming convention from a prior partial migration

---

## Detailed Design: Template Changes

### requirements.md Template

**Feature variant** changes:
- Line `**Issue**: #[number]` → `**Issues**: #[number]`
- Add Change History section before Validation Checklist:

```markdown
---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #[number] | [YYYY-MM-DD] | Initial feature spec |
```

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

---

## Detailed Design: Downstream Skill Changes

### implementing-specs SKILL.md

**Changes (documentation only):**

1. Update Feature Name Convention section (currently line 27) to describe the new naming:
   > The `{feature-name}` is the spec directory name. For specs created with v2.15+, this follows the `feature-{slug}` or `bug-{slug}` convention (e.g., `feature-dark-mode`). Legacy specs use `{issue#}-{slug}` (e.g., `42-add-dark-mode`).

2. Update the fallback resolution to also check the `**Issues**` frontmatter field:
   > **Fallback:** Use `Glob` to find `.claude/specs/*/requirements.md`. For each result, read the `**Issues**` (or legacy `**Issue**`) frontmatter field and match against the current issue number. If no frontmatter match, try matching the issue number or branch name keywords against the directory name.

### verifying-specs SKILL.md

Same changes as implementing-specs (lines 26-27 equivalent).

---

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

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Feature manifest file** | Create a `feature.json` in each spec dir that tracks contributing issues and relationships | Structured, machine-parseable | Extra file to maintain, adds complexity, existing frontmatter is sufficient | Rejected — frontmatter in existing files is simpler |
| **B: Frontmatter in existing files** | Add `**Issues**` field and Change History section to existing spec files | No new files, builds on existing conventions, human-readable | Parsing Markdown frontmatter is less reliable than JSON | **Selected** — aligns with existing patterns, simpler |
| **C: Issue-number aliasing** | Keep `{issue#}-{slug}` naming but add symlinks from `feature-{slug}` | Backwards compatible, no migration needed | Symlinks break on Windows (violates cross-platform constraint in tech.md) | Rejected — cross-platform violation |
| **D: Spec database** | SQLite or JSON database tracking spec→issue relationships | Most flexible querying | Overkill for a Markdown-based workflow, external dependency | Rejected — violates process-over-tooling principle |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Keyword matching produces false positives (unrelated specs matched) | Medium | Low | Human confirmation gate; user can reject match and create new spec |
| Keyword matching misses related spec (false negative) | Medium | Medium | User can manually specify which spec to amend; keywords are extractable from issue title which should share terminology |
| Amendment corrupts existing spec content | Low | High | Amendments write full file content atomically (not partial edits); Change History provides audit trail |
| Legacy migration removes specs that shouldn't be consolidated | Low | High | Every consolidation requires explicit user confirmation; auto-mode can be disabled |
| Branch name no longer matches spec directory | Medium | Low | Updated path resolution algorithm checks `**Issues**` frontmatter first, falls back to slug matching |
| Defect spec cross-references break during consolidation | Medium | Medium | Chain resolution with cycle detection (already proven in current migrating-projects Step 4a) |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Architecture follows existing project patterns (per `structure.md`) — all changes are to SKILL.md files and templates
- [x] All interface changes documented — frontmatter format, naming convention, new workflow steps
- [x] No database/storage changes — only Markdown files
- [x] State management approach is clear — spec directories are the state; frontmatter tracks relationships
- [x] No UI components — CLI-only workflow
- [x] Security considerations addressed — no new external service dependencies, no credentials
- [x] Performance impact analyzed — Glob+Grep over spec directories is fast even at 50+ specs
- [x] Alternatives were considered and documented
- [x] Risks identified with mitigations
- [x] Cross-platform constraints respected — no symlinks, no platform-specific paths
