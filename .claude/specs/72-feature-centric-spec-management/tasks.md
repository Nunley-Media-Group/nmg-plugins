# Tasks: Feature-Centric Spec Management

**Issues**: #72
**Date**: 2026-02-22
**Status**: Planning
**Author**: Claude (nmg-sdlc)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Templates | 3 | [ ] |
| Writing-Specs Skill | 7 | [ ] |
| Migrating-Projects Skill | 5 | [ ] |
| Downstream Skills & Docs | 3 | [ ] |
| Testing | 1 | [ ] |
| **Total** | **19** | |

---

## Phase 1: Templates

### T001: Update requirements.md Template — Feature Variant Frontmatter and Change History

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/templates/requirements.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Feature variant (first code block) changes `**Issue**: #[number]` to `**Issues**: #[number]`
- [ ] Feature variant adds a `## Change History` section before `## Validation Checklist` with table columns: Issue, Date, Summary
- [ ] Defect variant (second code block) is unchanged — keeps singular `**Issue**: #[number]`
- [ ] Template renders as valid Markdown

**Notes**: Only the feature variant changes. The defect variant keeps singular `**Issue**` since each bug is per-issue. The Change History section template should show a single-row example: `| #[number] | [YYYY-MM-DD] | Initial feature spec |`.

### T002: Update design.md Template — Feature Variant Frontmatter and Change History

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/templates/design.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Feature variant changes `**Issue**: #[number]` to `**Issues**: #[number]`
- [ ] Feature variant adds a `## Change History` section before `## Validation Checklist` with same table format as T001
- [ ] Defect variant is unchanged
- [ ] Template renders as valid Markdown

### T003: Update tasks.md Template — Feature Variant Frontmatter and Change History

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/templates/tasks.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Feature variant changes `**Issue**: #[number]` to `**Issues**: #[number]`
- [ ] Feature variant adds a `## Change History` section before `## Validation Checklist` with same table format as T001
- [ ] Defect variant is unchanged
- [ ] Template renders as valid Markdown

---

## Phase 2: Writing-Specs Skill

### T004: Update Feature Name Convention Section

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Lines 32-43 (Feature Name Convention section) are replaced with the new naming algorithm:
  1. Take the issue title
  2. Lowercase, replace spaces and special characters with hyphens
  3. Remove leading/trailing hyphens, collapse consecutive hyphens
  4. Determine prefix: `bug-` if issue has `bug` label, otherwise `feature-`
  5. Result: `feature-{slug}` or `bug-{slug}` (no issue number in directory name)
- [ ] Notes that branch names still use `N-feature-name` format (mismatch is intentional)
- [ ] Fallback updated: search `**Issues**` (plural) frontmatter field and fall back to `**Issue**` (singular, legacy)
- [ ] Examples show both new (`feature-add-dark-mode-toggle`) and legacy (`42-add-dark-mode-toggle`) patterns

### T005: Add Spec Discovery Section

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: T004
**Acceptance**:
- [ ] New section "Spec Discovery" is inserted after "Defect Detection" (after line 78) and before "Steering Documents" (line 81)
- [ ] Section specifies it runs only for non-bug issues
- [ ] Describes keyword extraction: tokenize issue title, filter stop words (listed explicitly)
- [ ] Describes search: `Glob` for `.claude/specs/feature-*/requirements.md`
- [ ] Describes scoring: `Grep` each keyword against each candidate, count hits, rank
- [ ] Describes presentation: top match(es) shown to user via `AskUserQuestion` with options "Amend existing" / "Create new spec"
- [ ] Auto-mode behavior specified: auto-select "Amend existing" when match found
- [ ] No-match behavior specified: proceed directly to create new spec

### T006: Modify Phase 1 SPECIFY — Add Amendment Path

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: T005
**Acceptance**:
- [ ] Phase 1 Process section (lines 110-130) gains an amendment branch in addition to the existing create branch
- [ ] Amendment path: read existing `requirements.md`, parse `**Issues**` field, find highest AC/FR numbers, append new ACs and FRs with sequential numbering, add issue to `**Issues**`, add Change History entry
- [ ] Create path: uses `**Issues**: #N` (plural field name, even for first issue), includes initial Change History entry
- [ ] Output line (134) updated to note "Write to or amend" the spec file
- [ ] Defect variant (bug-labeled issues) always creates new `bug-{slug}` — never amends

### T007: Modify Phase 2 PLAN — Add Amendment Path

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: T006
**Acceptance**:
- [ ] Phase 2 Process section (lines 157-168) gains an amendment branch
- [ ] Amendment path: read existing `design.md`, add new issue to `**Issues**`, append new design sections/considerations without replacing existing content, add Change History entry
- [ ] Create path: uses `**Issues**: #N` (plural), includes initial Change History entry
- [ ] Output line (172) updated to note "Write to or amend"

### T008: Modify Phase 3 TASKS — Add Amendment Path

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: T007
**Acceptance**:
- [ ] Phase 3 Process section (lines 194-207) gains an amendment branch
- [ ] Amendment path for `tasks.md`: parse highest task number, append new tasks starting from next sequential number (either as new phase or additions to existing phases), update Summary table
- [ ] Amendment path for `feature.gherkin`: append new scenarios at end, tagged with `# Added by issue #N` comment
- [ ] Create path: uses `**Issues**: #N` (plural), includes initial Change History entry
- [ ] Output lines (225-227) updated to note "Write to or amend"

### T009: Update Defect Spec Related Spec Search Pattern

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: T004
**Acceptance**:
- [ ] Phase 1 defect variant step 7.2 (line 122) Glob pattern updated from `.claude/specs/*/requirements.md` to search both `feature-*` and legacy `*` patterns
- [ ] Step 7.4 heading detection logic unchanged (still checks for `# Requirements:` vs `# Defect Report:`)
- [ ] Note added that feature specs may be under either `feature-{slug}/` (new) or `{issue#}-{slug}/` (legacy) naming

### T010: Update After Completion, File Organization, and Workflow Overview

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: T005, T006, T007, T008
**Acceptance**:
- [ ] After Completion section (lines 254-267) mentions amendment: "Specs written to (or amended in) `.claude/specs/{feature-name}/`"
- [ ] File Organization section (lines 301-315) shows new naming: `feature-{slug}/` and `bug-{slug}/` examples
- [ ] Workflow Overview diagram (lines 47-54) updated to show the discovery step before SPECIFY

---

## Phase 3: Migrating-Projects Skill

### T011: Add Step 4b — Detect Legacy Spec Directories

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Modify
**Depends**: T004
**Acceptance**:
- [ ] New "Step 4b: Detect Legacy Spec Directories" inserted after Step 4a (after line 136)
- [ ] Describes: Glob `.claude/specs/*/requirements.md`, classify each by naming pattern (legacy `{digits}-{slug}` vs new `feature-`/`bug-` prefix)
- [ ] Collects legacy directories into a candidate list
- [ ] If no legacy directories found, skip Steps 4c-4e

### T012: Add Steps 4c-4d — Cluster and Present Consolidation Candidates

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Modify
**Depends**: T011
**Acceptance**:
- [ ] Step 4c "Cluster Legacy Specs by Feature" describes: extract keywords from directory name (strip issue number prefix) and spec content, compare keyword overlap between specs, group specs with significant overlap
- [ ] Step 4c excludes bug specs (identified by `# Defect Report:` heading) from consolidation grouping — they become solo `bug-{slug}` renames
- [ ] Step 4c describes proposed feature name derivation: most descriptive slug from the group, prefixed with `feature-`
- [ ] Step 4c handles solo specs: single legacy spec → simple rename from `{issue#}-{slug}` to `feature-{slug}` (or `bug-{slug}`)
- [ ] Step 4d "Present Consolidation Candidates" describes user confirmation via `AskUserQuestion` per group
- [ ] Step 4d includes auto-mode note: **this skill is always interactive — auto-mode does NOT apply** (consistent with the existing automation mode section at line 23)

### T013: Add Step 4e — Apply Consolidation

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Modify
**Depends**: T012
**Acceptance**:
- [ ] Step 4e "Apply Consolidation" describes the full merge process:
  1. Create new `feature-{slug}/` directory
  2. Merge `requirements.md`: oldest spec as base, change `**Issue**` to `**Issues**`, collect all issue numbers, append ACs/FRs from other specs with sequential numbering, create Change History
  3. Merge `design.md`: oldest spec as base, append unique sections from others, update `**Issues**`
  4. Merge `tasks.md`: oldest spec as base, append tasks from others with renumbered IDs, mark already-implemented tasks as completed
  5. Merge `feature.gherkin`: concatenate all scenarios tagged with source issue comments
  6. Update defect spec `**Related Spec**` references: Grep all `*/requirements.md` (filtering to defect specs by `# Defect Report:` heading — covers both already-renamed `bug-*/` and not-yet-renamed `{issue#}-*/` directories) for references to consolidated or renamed legacy dirs, update to new `feature-{slug}/`, follow chain resolution with cycle detection
  7. Remove legacy directories after successful merge
- [ ] Solo renames (single legacy spec → new prefix): just rename directory and update `**Issue**` → `**Issues**` frontmatter
- [ ] For bug spec solo renames: rename from `{issue#}-{slug}` to `bug-{slug}`, keep singular `**Issue**` field

### T014: Add Step 4f — Migrate Legacy Frontmatter in Feature Specs

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Modify
**Depends**: T013
**Acceptance**:
- [ ] New "Step 4f: Migrate Legacy Frontmatter" inserted after Step 4e
- [ ] Describes: Glob `feature-*/requirements.md`, `feature-*/design.md`, `feature-*/tasks.md`
- [ ] For each file: detect feature variant (by `# Requirements:` / `# Design:` / `# Tasks:` heading); skip defect variants
- [ ] Detect singular `**Issue**: #N` and propose replacing with `**Issues**: #N`
- [ ] Detect missing `## Change History` section and propose adding it with an initial entry derived from the existing `**Date**` and `**Issue**` fields
- [ ] Defect specs (`# Defect Report:`, `# Root Cause Analysis:`) are explicitly skipped — they keep singular `**Issue**`
- [ ] Findings presented alongside other migration proposals in Step 9

### T015: Update Step 9 Summary and Step 10 Apply

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Modify
**Depends**: T014
**Acceptance**:
- [ ] Step 9 summary example (lines 212-234) adds a "Spec Directory Consolidation" category showing proposed renames and merges
- [ ] Step 9 summary adds a "Spec Frontmatter Migration" category showing proposed `**Issue**` → `**Issues**` updates and missing Change History additions
- [ ] Step 9 approval flow: consolidation candidates are presented in Part B (alongside other changes) with per-group confirmation; frontmatter updates are included in Part B as well
- [ ] Step 10 apply section references the consolidation steps from Step 4e and frontmatter migration from Step 4f
- [ ] "What Gets Analyzed" section (lines 31-41) mentions spec directory naming detection and frontmatter format detection

---

## Phase 4: Downstream Skills & Documentation

### T016: Update implementing-specs Prerequisites and Examples

**File(s)**: `plugins/nmg-sdlc/skills/implementing-specs/SKILL.md`
**Type**: Modify
**Depends**: T004
**Acceptance**:
- [ ] Prerequisites line 27 updated: describes both new `feature-{slug}`/`bug-{slug}` naming and legacy `{issue#}-{slug}` naming
- [ ] Fallback resolution updated: search `**Issues**` (plural) frontmatter field first, fall back to `**Issue**` (singular, legacy), then try directory name matching
- [ ] Example 1 (line 177) updated to show new naming: `.claude/specs/feature-add-auth/`

### T017: Update verifying-specs Prerequisites

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md`
**Type**: Modify
**Depends**: T004
**Acceptance**:
- [ ] Prerequisites line 26 updated: same changes as T016 (describes both naming conventions, updated fallback resolution)

### T018: Update structure.md Spec Output Naming Conventions

**File(s)**: `.claude/steering/structure.md`
**Type**: Modify
**Depends**: T004
**Acceptance**:
- [ ] Spec Output naming table (lines 119-126) updated to show new convention: `feature-{slug}` / `bug-{slug}` instead of `{issue#}-{kebab-case-title}`
- [ ] Legacy convention mentioned as backwards-compatible
- [ ] Examples updated: `feature-dark-mode/` instead of `42-add-precipitation-overlay/`

---

## Phase 5: BDD Testing

### T019: Create BDD Feature File

**File(s)**: `.claude/specs/72-feature-centric-spec-management/feature.gherkin`
**Type**: Create
**Depends**: T010, T015, T016, T017
**Acceptance**:
- [ ] All 15 acceptance criteria from requirements.md have corresponding Gherkin scenarios
- [ ] Uses Given/When/Then format
- [ ] Scenarios are independent and self-contained
- [ ] Feature file is valid Gherkin syntax
- [ ] Includes scenarios for: spec discovery (happy path, no match, rejection), naming convention, multi-issue tracking, amendment content preservation, migrating-projects consolidation, defect cross-reference updates, downstream compatibility, auto-mode

---

## Dependency Graph

```
T001 ─────────────────────────────────────────────────────────────┐
T002 ─────────────────────────────────────────────────────────────┤
T003 ─────────────────────────────────────────────────────────────┤
                                                                  │
T004 ──┬──▶ T005 ──▶ T006 ──▶ T007 ──▶ T008 ──┐                 │
       │                                        ├──▶ T010 ───────┤
       │    T009 ◀──────────────────────────────┘                 │
       │                                                          │
       ├──▶ T011 ──▶ T012 ──▶ T013 ──▶ T014 ──▶ T015 ───────────┤
       │                                                          │
       ├──▶ T016 ─────────────────────────────────────────────────┤
       ├──▶ T017 ─────────────────────────────────────────────────┤
       └──▶ T018 ─────────────────────────────────────────────────┤
                                                                  │
                                                         T019 ◀──┘
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #72 | 2026-02-22 | Initial task breakdown for feature-centric spec management |

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test tasks are included (T018)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
