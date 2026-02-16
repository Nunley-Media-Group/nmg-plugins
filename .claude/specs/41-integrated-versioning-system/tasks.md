# Tasks: Integrated Versioning System

**Issue**: #41
**Date**: 2026-02-16
**Status**: Planning
**Author**: Claude (nmg-sdlc)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 2 | [ ] |
| Skill Modifications | 5 | [ ] |
| Frontend | 0 (N/A — prompt-based project) | — |
| Integration | 3 | [ ] |
| Testing | 1 | [ ] |
| **Total** | **11** | |

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

### T001: Add Versioning Section to Tech.md Steering Template

**File(s)**: `plugins/nmg-sdlc/skills/setting-up-steering/templates/tech.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] New `## Versioning` section exists after Technology Stack, before Technical Constraints
- [ ] Section includes explanatory text about the `VERSION` file as single source of truth
- [ ] Section includes a table for declaring stack-specific version file mappings (File | Path | Notes)
- [ ] Path Syntax subsection documents dot-notation for JSON/TOML files
- [ ] Section has `<!-- TODO: -->` placeholder rows consistent with existing template style
- [ ] Existing template content is unchanged

**Notes**: See design.md §3 for the exact section content. Follow the existing template's pattern of `<!-- TODO: -->` comments for user-customizable sections.

### T002: Create VERSION File for nmg-plugins Repository

**File(s)**: `VERSION` (project root)
**Type**: Create
**Depends**: None
**Acceptance**:
- [ ] `VERSION` file exists at project root
- [ ] Contains the current nmg-sdlc plugin version (read from `plugins/nmg-sdlc/.claude-plugin/plugin.json`)
- [ ] File is plain text, single line, no trailing newline beyond what's standard
- [ ] Version string is valid semver (X.Y.Z)

**Notes**: Read the current version from `plugin.json` to seed the file. This repository will now use the integrated versioning system it provides.

---

## Phase 2: Skill Modifications

### T003: Add Milestone Assignment to `/creating-issues`

**File(s)**: `plugins/nmg-sdlc/skills/creating-issues/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] New Step 2b "Assign Milestone" exists after type classification (Step 2), before investigation (Step 3)
- [ ] Step reads `VERSION` file to derive current major version as milestone default
- [ ] Handles missing `VERSION` file gracefully (defaults to "v0" or skips milestone)
- [ ] Manual mode: uses `AskUserQuestion` to present milestone options (default + custom number)
- [ ] Accepts a single number input (e.g., "3") and normalizes to "v3"
- [ ] Checks for existing milestone via `gh api repos/{owner}/{repo}/milestones`
- [ ] Creates milestone via `gh api --method POST` if it doesn't exist
- [ ] Passes milestone to `gh issue create` via `--milestone` flag in Step 7
- [ ] Auto-mode: defaults to current major version milestone without prompting
- [ ] Subsequent step numbers are renumbered to account for the insertion
- [ ] Existing skill functionality is preserved

**Notes**: See design.md §1 for detailed logic. The milestone query should use `gh api` not `gh milestone` (which doesn't exist).

### T004: Add Version Bump Classification to `/creating-prs`

**File(s)**: `plugins/nmg-sdlc/skills/creating-prs/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] New Step 1b "Determine Version Bump" exists after context reading (Step 1), before PR content generation (Step 2)
- [ ] Checks for `VERSION` file existence; skips all versioning if absent
- [ ] Reads current version from `VERSION` file
- [ ] Reads issue labels via `gh issue view #N --json labels`
- [ ] Applies classification matrix: `bug` → patch, `enhancement` → minor, default → minor
- [ ] Reads issue milestone via `gh issue view #N --json milestone`
- [ ] If milestone is set: queries open issue count via `gh api` to detect milestone completion
- [ ] If last open issue in milestone: overrides to major bump
- [ ] Calculates new version string (patch: x.y.Z+1, minor: x.Y+1.0, major: X+1.0.0)
- [ ] Manual mode: presents classification to developer via `AskUserQuestion` with override options (Accept / Patch / Minor / Major)
- [ ] Auto-mode: applies classified bump without confirmation

**Notes**: See design.md §2 Step 1b. The milestone completion check counts open issues — if exactly 1 remains (the current issue), that triggers the major bump proposal.

### T005: Add Version Artifact Updates to `/creating-prs`

**File(s)**: `plugins/nmg-sdlc/skills/creating-prs/SKILL.md`
**Type**: Modify
**Depends**: T004
**Acceptance**:
- [ ] New Step 1c "Update Version Artifacts" exists after version bump classification (Step 1b)
- [ ] Writes new version string to `VERSION` file
- [ ] Updates `CHANGELOG.md`: moves `[Unreleased]` content under new `## [{version}] - {YYYY-MM-DD}` heading
- [ ] Leaves `[Unreleased]` section empty after moving content
- [ ] Reads `.claude/steering/tech.md` for `## Versioning` section
- [ ] If Versioning section exists: parses table rows for file:path mappings
- [ ] Updates each declared stack-specific version file at the specified path
- [ ] If no Versioning section or empty table: skips stack-specific updates
- [ ] All version file changes are staged before PR creation
- [ ] PR body includes a "Version" note showing the bump type and new version
- [ ] Handles missing `CHANGELOG.md` gracefully (creates minimal one with the version heading)

**Notes**: See design.md §2 Step 1c. The CHANGELOG update must preserve existing content — only structural changes (moving [Unreleased] entries to versioned heading).

### T006: Add CHANGELOG Analysis to `/migrating-projects`

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] New Step 6b "Analyze CHANGELOG.md" exists after existing Step 6, before Step 7 (Present Findings)
- [ ] If no `CHANGELOG.md` exists: generates one from git history
  - [ ] Parses conventional commits (`git log --pretty=format:"%H|%s"`)
  - [ ] Reads git tags (`git tag --sort=version:refname`)
  - [ ] Groups commits by tag boundaries
  - [ ] Categorizes by type: `feat:` → Added, `fix:` → Fixed, `chore:/refactor:/build:` → Changed
  - [ ] If no tags: groups all under `[0.1.0]`
  - [ ] Includes `[Unreleased]` section for commits after latest tag
  - [ ] Uses Keep a Changelog preamble
- [ ] If `CHANGELOG.md` exists: reconciles with git history
  - [ ] Checks for `[Unreleased]` section, adds if missing
  - [ ] Checks for version headings matching git tags, adds missing ones
  - [ ] Restructures entries into `### Added / ### Changed / ### Fixed` categories if flat
  - [ ] Preserves manually-written entries that don't map to commits
  - [ ] Adds Keep a Changelog preamble if missing
- [ ] Records all changes as pending for Step 7 (Present Findings)
- [ ] Existing migration functionality is preserved

**Notes**: See design.md §4 Step 6b. The reconciliation logic should be additive — never delete existing content, only restructure and fill gaps.

### T007: Add VERSION Analysis to `/migrating-projects`

**File(s)**: `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md`
**Type**: Modify
**Depends**: T006
**Acceptance**:
- [ ] New Step 6c "Analyze VERSION File" exists after Step 6b (CHANGELOG analysis)
- [ ] Derives expected version from: (1) latest versioned CHANGELOG heading, (2) latest git tag, or (3) `0.1.0` default
- [ ] If no `VERSION` file: records "create VERSION with {version}" as pending
- [ ] If `VERSION` exists but doesn't match: records "update VERSION from {current} to {expected}" as pending
- [ ] If `VERSION` exists and matches: records "VERSION is up to date" (no change)
- [ ] Pending changes presented in Step 7 alongside other findings
- [ ] Applied in Step 8 using Write tool

**Notes**: See design.md §4 Step 6c. VERSION is always derived from the CHANGELOG output of Step 6b, so this step must run after CHANGELOG analysis.

---

## Phase 3: Frontend Implementation

*N/A — nmg-plugins is a prompt-based plugin repository with no frontend components.*

---

## Phase 4: Integration

### T008: Update nmg-plugins Steering Tech.md with Versioning Section

**File(s)**: `.claude/steering/tech.md`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] `## Versioning` section added to this project's `tech.md`
- [ ] Table declares stack-specific version files for this repo:
  - `plugins/nmg-sdlc/.claude-plugin/plugin.json` → `version`
  - `.claude-plugin/marketplace.json` → `plugins[0].version`
- [ ] Section follows the same format as the template from T001
- [ ] Existing `tech.md` content is unchanged

**Notes**: This makes nmg-plugins itself use the versioning system — `/creating-prs` will read this section to update `plugin.json` and `marketplace.json` automatically when bumping versions.

### T009: Update README.md with Versioning Documentation

**File(s)**: `README.md`
**Type**: Modify
**Depends**: T003, T004, T005, T006, T007
**Acceptance**:
- [ ] Versioning system documented as a feature/capability
- [ ] Explains `VERSION` file as single source of truth
- [ ] Documents the version classification matrix (bug→patch, enhancement→minor, milestone→major)
- [ ] Documents the `tech.md` Versioning section as the stack-specific bridge
- [ ] Documents milestone assignment in `/creating-issues`
- [ ] Updated skill descriptions reflect new versioning capabilities
- [ ] Existing README structure and content preserved

**Notes**: README is the primary public documentation. The versioning system changes user-facing behavior of 3 skills and adds a new concept (VERSION file), so README must be updated.

### T010: Update CHANGELOG.md

**File(s)**: `CHANGELOG.md`
**Type**: Modify
**Depends**: T003, T004, T005, T006, T007, T008
**Acceptance**:
- [ ] `[Unreleased]` section has entries for all changes in this feature
- [ ] Entries categorized under `### Added` (new versioning capabilities) and `### Changed` (modified skills)
- [ ] Entries are concise and user-facing (describe capabilities, not implementation details)
- [ ] Existing CHANGELOG content preserved

---

## Phase 5: BDD Testing

### T011: Create BDD Feature File

**File(s)**: `.claude/specs/41-integrated-versioning-system/feature.gherkin`
**Type**: Create
**Depends**: T003, T004, T005, T006, T007
**Acceptance**:
- [ ] All 11 acceptance criteria (AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8a, AC8b, AC9, AC10) have corresponding scenarios
- [ ] Uses Given/When/Then format consistently
- [ ] Scenarios are independent and self-contained
- [ ] Includes happy path, alternative paths, and edge cases
- [ ] Valid Gherkin syntax
- [ ] Feature description matches the user story

---

## Dependency Graph

```
T001 (template) ──────────────────────────────────────▶ T008 (this project's tech.md)
                                                              │
T002 (VERSION file) ─ (no deps)                               ▼
                                                         T009 (README)
T003 (creating-issues) ─ (no deps) ─────────────────▶ T009, T010, T011
                                                         ▲
T004 (creating-prs bump) ─ (no deps) ───────────────▶ T005 (creating-prs artifacts)
                                                    └──▶ T009, T010, T011
T005 (creating-prs artifacts) ──────────────────────▶ T009, T010, T011

T006 (migrating CHANGELOG) ─ (no deps) ────────────▶ T007 (migrating VERSION)
                                                    └──▶ T009, T010, T011
T007 (migrating VERSION) ──────────────────────────▶ T009, T010, T011

T008 (this project's tech.md) ─────────────────────▶ T010

T010 (CHANGELOG) ─ depends on all impl tasks

T011 (BDD feature) ─ depends on all impl tasks
```

**Execution order** (respecting dependencies):

1. **Parallel**: T001, T002, T003, T004, T006
2. **After T004**: T005
3. **After T006**: T007
4. **After T001**: T008
5. **After all impl tasks + T008**: T009, T010, T011 (parallelizable)

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] BDD test task included (T011)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
