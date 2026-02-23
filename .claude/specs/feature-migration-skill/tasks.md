# Tasks: Add Migration Skill

**Issues**: #25, #72
**Date**: 2026-02-15
**Status**: Planning
**Author**: Claude

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | [x] |
| Backend (Skill Implementation) | 1 | [x] |
| Integration | 3 | [x] |
| Testing | 1 | [x] |
| Templates (from #72) | 3 | [x] |
| Writing-Specs Skill (from #72) | 7 | [x] |
| Migrating-Projects Skill (from #72) | 5 | [x] |
| Downstream Skills & Docs (from #72) | 3 | [x] |
| BDD Testing (from #72) | 1 | [x] |
| **Total** | **25** | |

---

## Task Format

Each task follows this structure:

```
### T[NNN]: [Task Title]

**File(s)**: `{layer}/path/to/file`
**Type**: Create | Modify | Delete
**Depends**: T[NNN], T[NNN] (or None)
**Acceptance**:
- [ ] [Verifiable criterion 1]
- [ ] [Verifiable criterion 2]

**Notes**: [Optional implementation hints]
```

Map `{layer}/` placeholders to actual project paths using `structure.md`.

---

## Phase 1: Setup

### T001: Create migrating-projects skill directory

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Create
**Depends**: None
**Acceptance**:
- [x] Directory `plugins/nmg-sdlc/skills/migrating-projects/` exists
- [x] `SKILL.md` file is created (content comes in T002)

---

## Phase 2: Skill Implementation

### T002: Write the SKILL.md for `/migrating-projects`

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [x] SKILL.md follows the standard skill structure (title, When to Use, Workflow steps, Integration with SDLC Workflow)
- [x] Skill is not user-invocable with arguments (no `$ARGUMENTS` — operates on current project)
- [x] Step 1: Resolve template paths — locate `setting-up-steering/templates/`, `writing-specs/templates/`, `openclaw/scripts/sdlc-config.example.json` from the installed plugin
- [x] Step 2: Scan project files — use `Glob` to find steering docs, spec files, and `sdlc-config.json`
- [x] Step 3: Analyze steering docs — read each template, extract headings from the code block, compare against existing steering docs, identify missing `##`-level sections
- [x] Step 4: Analyze spec files — for each spec directory, detect variant (feature vs defect) by checking first `#` heading, compare against correct template variant, identify missing `##`-level sections
- [x] Step 5: Analyze OpenClaw config — read `sdlc-config.json` and template, identify missing keys at root and `steps` level
- [x] Step 6: Check OpenClaw skill version — compare `~/.openclaw/skills/running-sdlc/` against source in marketplace clone
- [x] Step 7: Present findings — display per-file summary of proposed additions for interactive review
- [x] Step 8: Apply changes — if approved, use `Edit` to insert missing sections at correct positions; for JSON config, merge missing keys
- [x] Step 9: Output summary — report all changes made
- [x] No auto-mode support (skill is always interactive)
- [x] Heading extraction instructions explain how to parse template code blocks (content between ` ```markdown ` and ` ``` `)
- [x] Insertion logic instructions explain positioning (insert after the predecessor section in template order)
- [x] Variant detection instructions explain how to identify feature vs defect specs
- [x] JSON merge instructions explain key-level diffing (add missing keys, never overwrite existing values)
- [x] `feature.gherkin` files explicitly excluded from migration
- [x] Includes handling for "already up to date" case
- [x] Includes handling for missing project files (skip, don't create)
- [x] Allowed tools include `Read`, `Glob`, `Grep`, `Edit`, `Bash(gh:*)`, `AskUserQuestion`

**Notes**: This is the core deliverable. The SKILL.md must contain clear, unambiguous instructions for Claude to execute the heading-based section diffing algorithm. Include concrete examples of heading extraction, comparison, and insertion. The skill must be self-updating — all template knowledge comes from reading files at runtime, never hardcoded.

---

## Phase 3: Integration

### T003: Update README.md with new skill

**File(s)**: `README.md`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [x] `/migrating-projects` added to the SDLC Skills table in the Skills Reference section
- [x] Description matches the skill purpose: "Update project specs, steering docs, and configs to latest template standards"
- [x] Positioned logically in the table (after `/setting-up-steering` since it's a maintenance skill)

### T004: Update CHANGELOG.md

**File(s)**: `CHANGELOG.md`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [x] Entry added under `[Unreleased]` → `### Added` section
- [x] Entry describes the new `/migrating-projects` skill with key capabilities
- [x] Follows existing changelog style (bold skill name, em-dash, description)

### T005: Bump plugin version (2.6.0 → 2.7.0)

**File(s)**: `plugins/nmg-sdlc/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [x] `plugins/nmg-sdlc/.claude-plugin/plugin.json` → `"version"` updated to `"2.7.0"`
- [x] `.claude-plugin/marketplace.json` → plugin entry `"version"` updated to `"2.7.0"`
- [x] `metadata.version` in `marketplace.json` is NOT changed (it's the collection version)

---

## Phase 4: BDD Testing

### T006: Create BDD feature file

**File(s)**: `.claude/specs/25-add-migration-skill/feature.gherkin`
**Type**: Create
**Depends**: T002
**Acceptance**:
- [x] All 9 acceptance criteria from requirements.md have corresponding scenarios
- [x] Uses Given/When/Then format
- [x] Scenarios are independent and self-contained
- [x] Includes happy paths, edge cases, and error handling
- [x] Valid Gherkin syntax

---

## Phase 5: Templates (from #72)

### T007: Update requirements.md Template — Feature Variant Frontmatter and Change History

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/templates/requirements.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [x] Feature variant (first code block) changes `**Issue**: #[number]` to `**Issues**: #[number]`
- [x] Feature variant adds a `## Change History` section before `## Validation Checklist` with table columns: Issue, Date, Summary
- [x] Defect variant (second code block) is unchanged — keeps singular `**Issue**: #[number]`
- [x] Template renders as valid Markdown

**Notes**: Only the feature variant changes. The defect variant keeps singular `**Issue**` since each bug is per-issue. The Change History section template should show a single-row example: `| #[number] | [YYYY-MM-DD] | Initial feature spec |`.

### T008: Update design.md Template — Feature Variant Frontmatter and Change History

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/templates/design.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [x] Feature variant changes `**Issue**: #[number]` to `**Issues**: #[number]`
- [x] Feature variant adds a `## Change History` section before `## Validation Checklist` with same table format as T007
- [x] Defect variant is unchanged
- [x] Template renders as valid Markdown

### T009: Update tasks.md Template — Feature Variant Frontmatter and Change History

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/templates/tasks.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [x] Feature variant changes `**Issue**: #[number]` to `**Issues**: #[number]`
- [x] Feature variant adds a `## Change History` section before `## Validation Checklist` with same table format as T007
- [x] Defect variant is unchanged
- [x] Template renders as valid Markdown

---

## Phase 6: Writing-Specs Skill (from #72)

### T010: Update Feature Name Convention Section

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [x] Feature Name Convention section replaced with the new naming algorithm (feature-/bug- prefix, no issue number in directory name)
- [x] Notes that branch names still use `N-feature-name` format (mismatch is intentional)
- [x] Fallback updated: search `**Issues**` (plural) frontmatter field and fall back to `**Issue**` (singular, legacy)
- [x] Examples show both new (`feature-add-dark-mode-toggle`) and legacy (`42-add-dark-mode-toggle`) patterns

### T011: Add Spec Discovery Section

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: T010
**Acceptance**:
- [x] New section "Spec Discovery" is inserted after "Defect Detection" and before "Steering Documents"
- [x] Section specifies it runs only for non-bug issues
- [x] Describes keyword extraction: tokenize issue title, filter stop words (listed explicitly)
- [x] Describes search: `Glob` for `.claude/specs/feature-*/requirements.md`
- [x] Describes scoring: `Grep` each keyword against each candidate, count hits, rank
- [x] Describes presentation: top match(es) shown to user via `AskUserQuestion` with options "Amend existing" / "Create new spec"
- [x] Auto-mode behavior specified: auto-select "Amend existing" when match found
- [x] No-match behavior specified: proceed directly to create new spec

### T012: Modify Phase 1 SPECIFY — Add Amendment Path

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: T011
**Acceptance**:
- [x] Phase 1 Process section gains an amendment branch in addition to the existing create branch
- [x] Amendment path: read existing `requirements.md`, parse `**Issues**` field, find highest AC/FR numbers, append new ACs and FRs with sequential numbering, add issue to `**Issues**`, add Change History entry
- [x] Create path: uses `**Issues**: #N` (plural field name, even for first issue), includes initial Change History entry
- [x] Output line updated to note "Write to or amend" the spec file
- [x] Defect variant (bug-labeled issues) always creates new `bug-{slug}` — never amends

### T013: Modify Phase 2 PLAN — Add Amendment Path

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: T012
**Acceptance**:
- [x] Phase 2 Process section gains an amendment branch
- [x] Amendment path: read existing `design.md`, add new issue to `**Issues**`, append new design sections/considerations without replacing existing content, add Change History entry
- [x] Create path: uses `**Issues**: #N` (plural), includes initial Change History entry
- [x] Output line updated to note "Write to or amend"

### T014: Modify Phase 3 TASKS — Add Amendment Path

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: T013
**Acceptance**:
- [x] Phase 3 Process section gains an amendment branch
- [x] Amendment path for `tasks.md`: parse highest task number, append new tasks starting from next sequential number (either as new phase or additions to existing phases), update Summary table
- [x] Amendment path for `feature.gherkin`: append new scenarios at end, tagged with `# Added by issue #N` comment
- [x] Create path: uses `**Issues**: #N` (plural), includes initial Change History entry
- [x] Output lines updated to note "Write to or amend"

### T015: Update Defect Spec Related Spec Search Pattern

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: T010
**Acceptance**:
- [x] Phase 1 defect variant Related Spec Glob pattern updated to search both `feature-*` and legacy `*` patterns
- [x] Heading detection logic unchanged (still checks for `# Requirements:` vs `# Defect Report:`)
- [x] Note added that feature specs may be under either `feature-{slug}/` (new) or `{issue#}-{slug}/` (legacy) naming

### T016: Update After Completion, File Organization, and Workflow Overview

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: T011, T012, T013, T014
**Acceptance**:
- [x] After Completion section mentions amendment: "Specs written to (or amended in) `.claude/specs/{feature-name}/`"
- [x] File Organization section shows new naming: `feature-{slug}/` and `bug-{slug}/` examples
- [x] Workflow Overview diagram updated to show the discovery step before SPECIFY

---

## Phase 7: Migrating-Projects Skill (from #72)

### T017: Add Step 4b — Detect Legacy Spec Directories

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Modify
**Depends**: T010
**Acceptance**:
- [x] New "Step 4b: Detect Legacy Spec Directories" inserted after Step 4a
- [x] Describes: Glob `.claude/specs/*/requirements.md`, classify each by naming pattern (legacy `{digits}-{slug}` vs new `feature-`/`bug-` prefix)
- [x] Collects legacy directories into a candidate list
- [x] If no legacy directories found, skip Steps 4c-4e

### T018: Add Steps 4c-4d — Cluster and Present Consolidation Candidates

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Modify
**Depends**: T017
**Acceptance**:
- [x] Step 4c "Cluster Legacy Specs by Feature" describes keyword extraction from directory name and spec content
- [x] Step 4c excludes bug specs (identified by `# Defect Report:` heading) from consolidation grouping
- [x] Step 4c describes proposed feature name derivation: most descriptive slug, prefixed with `feature-`
- [x] Step 4c handles solo specs: single legacy spec → simple rename to `feature-{slug}` (or `bug-{slug}`)
- [x] Step 4d "Present Consolidation Candidates" describes user confirmation via `AskUserQuestion` per group
- [x] Step 4d includes auto-mode note: **this skill is always interactive — auto-mode does NOT apply**

### T019: Add Step 4e — Apply Consolidation

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Modify
**Depends**: T018
**Acceptance**:
- [x] Step 4e "Apply Consolidation" describes the full merge process (create dir, merge all spec files, update defect refs, remove legacy dirs)
- [x] Solo renames handled: single legacy spec → new prefix, update `**Issue**` → `**Issues**` frontmatter
- [x] For bug spec solo renames: rename from `{issue#}-{slug}` to `bug-{slug}`, keep singular `**Issue**` field

### T020: Add Step 4f — Migrate Legacy Frontmatter in Feature Specs

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Modify
**Depends**: T019
**Acceptance**:
- [x] New "Step 4f: Migrate Legacy Frontmatter" inserted after Step 4e
- [x] Describes: Glob `feature-*/requirements.md`, `feature-*/design.md`, `feature-*/tasks.md`
- [x] For each file: detect feature variant by heading; skip defect variants
- [x] Detect singular `**Issue**: #N` and propose replacing with `**Issues**: #N`
- [x] Detect missing `## Change History` section and propose adding it with an initial entry
- [x] Defect specs explicitly skipped — they keep singular `**Issue**`
- [x] Findings presented alongside other migration proposals in Step 9

### T021: Update Step 9 Summary and Step 10 Apply

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Modify
**Depends**: T020
**Acceptance**:
- [x] Step 9 summary adds a "Spec Directory Consolidation" category showing proposed renames and merges
- [x] Step 9 summary adds a "Spec Frontmatter Migration" category showing proposed frontmatter updates
- [x] Step 9 approval flow: consolidation candidates presented with per-group confirmation; frontmatter updates included
- [x] Step 10 apply section references consolidation steps from Step 4e and frontmatter migration from Step 4f
- [x] "What Gets Analyzed" section mentions spec directory naming detection and frontmatter format detection

---

## Phase 8: Downstream Skills & Documentation (from #72)

### T022: Update implementing-specs Prerequisites and Examples

**File(s)**: `plugins/nmg-sdlc/skills/implementing-specs/SKILL.md`
**Type**: Modify
**Depends**: T010
**Acceptance**:
- [x] Prerequisites updated: describes both new `feature-{slug}`/`bug-{slug}` naming and legacy `{issue#}-{slug}` naming
- [x] Fallback resolution updated: search `**Issues**` (plural) frontmatter field first, fall back to `**Issue**` (singular, legacy), then try directory name matching
- [x] Example updated to show new naming: `.claude/specs/feature-add-auth/`

### T023: Update verifying-specs Prerequisites

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md`
**Type**: Modify
**Depends**: T010
**Acceptance**:
- [x] Prerequisites updated: same changes as T022 (describes both naming conventions, updated fallback resolution)

### T024: Update structure.md Spec Output Naming Conventions

**File(s)**: `.claude/steering/structure.md`
**Type**: Modify
**Depends**: T010
**Acceptance**:
- [x] Spec Output naming table updated to show new convention: `feature-{slug}` / `bug-{slug}` instead of `{issue#}-{kebab-case-title}`
- [x] Legacy convention mentioned as backwards-compatible
- [x] Examples updated: `feature-dark-mode/` instead of `42-add-precipitation-overlay/`

---

## Phase 9: BDD Testing (from #72)

### T025: Create BDD Feature File for Issue #72

**File(s)**: `.claude/specs/72-feature-centric-spec-management/feature.gherkin`
**Type**: Create
**Depends**: T016, T021, T022, T023
**Acceptance**:
- [x] All 15 acceptance criteria from requirements.md (issue #72) have corresponding Gherkin scenarios
- [x] Uses Given/When/Then format
- [x] Scenarios are independent and self-contained
- [x] Feature file is valid Gherkin syntax
- [x] Includes scenarios for: spec discovery (happy path, no match, rejection), naming convention, multi-issue tracking, amendment content preservation, migrating-projects consolidation, defect cross-reference updates, downstream compatibility, auto-mode

---

## Dependency Graph

```
T001 ──▶ T002 ──┬──▶ T003
                ├──▶ T004
                ├──▶ T005
                └──▶ T006

T007 ─────────────────────────────────────────────────────────────┐
T008 ─────────────────────────────────────────────────────────────┤
T009 ─────────────────────────────────────────────────────────────┤
                                                                  │
T010 ──┬──▶ T011 ──▶ T012 ──▶ T013 ──▶ T014 ──┐                 │
       │                                        ├──▶ T016 ───────┤
       │    T015 ◀──────────────────────────────┘                 │
       │                                                          │
       ├──▶ T017 ──▶ T018 ──▶ T019 ──▶ T020 ──▶ T021 ───────────┤
       │                                                          │
       ├──▶ T022 ─────────────────────────────────────────────────┤
       ├──▶ T023 ─────────────────────────────────────────────────┤
       └──▶ T024 ─────────────────────────────────────────────────┤
                                                                  │
                                                         T025 ◀──┘
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #25 | 2026-02-15 | Initial task breakdown: migration skill for steering docs, specs, and OpenClaw config (6 tasks) |
| #72 | 2026-02-22 | Added 19 tasks for feature-centric spec management: templates, writing-specs amendment flow, migrating-projects consolidation, downstream skill updates |

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test tasks are included (T006, T025)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
