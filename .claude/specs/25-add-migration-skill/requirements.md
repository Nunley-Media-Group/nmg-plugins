# Requirements: Add Migration Skill

**Issue**: #25
**Date**: 2026-02-15
**Status**: Draft
**Author**: Claude

---

## User Story

**As a** developer using the nmg-sdlc plugin
**I want** a migration skill that updates my project's existing specs, steering docs, and configs to the latest plugin standards
**So that** I benefit from new template sections, improved structures, and evolving best practices without manually diffing templates

---

## Background

The nmg-sdlc plugin evolves over time — new sections get added to spec templates (e.g., NFRs, UI/UX requirements, Related Spec field for defects), steering doc templates gain new guidance areas, and structural conventions change. Projects that adopted the plugin at an earlier version retain their original file formats with no mechanism to bring them up to current standards.

The migration skill should be **self-updating by design**: it reads the latest templates at runtime from the plugin's template directories, so when templates change in a new plugin version, the migration skill automatically knows the new standards without needing its own code updated.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Steering Doc Migration — Happy Path

**Given** a project with steering docs (product.md, tech.md, structure.md) created by an older version of `/setting-up-steering`
**When** I run `/migrating-projects`
**Then** missing sections are identified in each steering doc and merged in while preserving all existing user-written content

**Example**:
- Given: A `product.md` missing the `## Product Principles` section that was added in a later template version
- When: `/migrating-projects` is run
- Then: The `## Product Principles` section is inserted at the correct location with placeholder guidance, and all existing content remains unchanged

### AC2: Spec Migration — Happy Path

**Given** a project with specs (requirements.md, design.md, tasks.md, feature.gherkin) created by an older version of `/writing-specs`
**When** I run `/migrating-projects`
**Then** missing sections are identified in each spec file and merged in while preserving all existing content

**Example**:
- Given: A `requirements.md` missing the `## Non-Functional Requirements` and `## UI/UX Requirements` sections
- When: `/migrating-projects` is run
- Then: Both sections are inserted at the correct location with template defaults, and all existing acceptance criteria and functional requirements remain unchanged

### AC3: User Content Preservation

**Given** a steering doc with user-customized content (e.g., mission statement, target users, tech stack details)
**When** the migration adds new template sections
**Then** all existing user-written content remains unchanged and new sections are inserted at the appropriate location with placeholder guidance

**Example**:
- Given: A `tech.md` with a filled-in `## Technology Stack` table listing React, PostgreSQL, etc.
- When: Migration adds a missing `## Claude Code Resource Development` section
- Then: The Technology Stack table content is byte-for-byte identical before and after migration

### AC4: Interactive Review Before Apply

**Given** proposed changes to one or more project files
**When** the migration analysis is complete
**Then** all proposed changes are presented to the user for review before any files are modified
**And** the user can approve or reject the migration

### AC5: Self-Updating via Runtime Template Reading

**Given** the plugin's templates have been updated in a new version (e.g., a new section added to requirements.md template)
**When** I run `/migrating-projects`
**Then** the skill detects the new template sections automatically without needing the migration skill itself to be updated

### AC6: OpenClaw Config Migration

**Given** a project with an `sdlc-config.json` created by an older version of `/generating-openclaw-config`
**When** I run `/migrating-projects`
**Then** missing config keys (e.g., new steps, changed defaults) are identified and merged into the existing config while preserving user-customized values (paths, timeouts, Discord channel ID)

### AC7: OpenClaw Skill Version Check

**Given** the OpenClaw `running-sdlc` skill is installed at `~/.openclaw/skills/running-sdlc/`
**When** I run `/migrating-projects`
**Then** the installed skill files are compared against the source in the marketplace clone
**And** a warning is displayed if they differ, suggesting the user run `/installing-openclaw-skill` to update

### AC8: Already Up-to-Date — No Changes

**Given** all project files already match the latest template structure
**When** I run `/migrating-projects`
**Then** the skill reports that everything is up to date and makes no file modifications

### AC9: Missing Files Are Skipped

**Given** a project that has only some steering docs (e.g., `product.md` exists but `structure.md` does not)
**When** I run `/migrating-projects`
**Then** only existing files are migrated
**And** missing files are not created (the user is directed to use `/setting-up-steering` or `/writing-specs` instead)

### Generated Gherkin Preview

```gherkin
Feature: Project Migration Skill
  As a developer using the nmg-sdlc plugin
  I want a migration skill that updates my project's files to latest standards
  So that I benefit from new template sections without manually diffing templates

  Scenario: Steering doc migration — happy path
    Given a project with steering docs created by an older plugin version
    When I run "/migrating-projects"
    Then missing sections are identified and merged into each steering doc
    And all existing user-written content is preserved

  Scenario: Spec migration — happy path
    Given a project with specs created by an older plugin version
    When I run "/migrating-projects"
    Then missing sections are identified and merged into each spec file
    And all existing content is preserved

  Scenario: User content preservation
    Given a steering doc with user-customized content
    When the migration adds new template sections
    Then all existing user-written content remains unchanged

  Scenario: Interactive review before apply
    Given proposed changes to project files
    When the migration analysis is complete
    Then all proposed changes are presented for user review
    And the user can approve or reject the migration

  Scenario: Self-updating via runtime template reading
    Given the plugin templates have been updated in a new version
    When I run "/migrating-projects"
    Then the skill detects new template sections automatically

  Scenario: OpenClaw config migration
    Given a project with an sdlc-config.json from an older version
    When I run "/migrating-projects"
    Then missing config keys are merged while preserving user-customized values

  Scenario: OpenClaw skill version check
    Given the OpenClaw running-sdlc skill is installed locally
    When I run "/migrating-projects"
    Then installed skill files are compared against the source
    And a warning is displayed if they differ

  Scenario: Already up-to-date — no changes
    Given all project files match the latest template structure
    When I run "/migrating-projects"
    Then the skill reports everything is up to date

  Scenario: Missing files are skipped
    Given a project with only some steering docs present
    When I run "/migrating-projects"
    Then only existing files are migrated
    And missing files are not created
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Scan `.claude/steering/` and compare each doc against the latest templates from `setting-up-steering/templates/` | Must | |
| FR2 | Scan `.claude/specs/*/` and compare each spec file against the latest templates from `writing-specs/templates/` | Must | |
| FR3 | Identify missing sections by comparing template headings/structure against existing file headings | Must | Markdown heading-based comparison |
| FR4 | Merge missing sections into existing files at the correct location, preserving all user content | Must | Insert at position matching template order |
| FR5 | Present a per-file summary of proposed changes for interactive review before applying | Must | |
| FR6 | Read templates at runtime from the plugin's template directories (never hardcode template content) | Must | Self-updating design |
| FR7 | Output a summary report of all changes made after migration completes | Should | |
| FR8 | Handle both feature and defect spec variants when migrating specs | Should | Detect variant from existing content |
| FR9 | Detect spec type (feature vs defect) from existing content or issue labels to apply the correct template | Should | Check for `# Defect Report:` heading or `bug` label |
| FR10 | Skip files that are already up to date (no unnecessary modifications) | Should | |
| FR11 | Scan project root for `sdlc-config.json` and compare against `openclaw/scripts/sdlc-config.example.json` | Must | JSON key-level diffing |
| FR12 | Merge missing config keys and new step definitions while preserving user-set values (projectPath, pluginsPath, discordChannelId, custom timeouts) | Must | |
| FR13 | Compare installed OpenClaw skill (`~/.openclaw/skills/running-sdlc/`) against source in marketplace clone and warn if outdated | Should | Suggest `/installing-openclaw-skill` |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Complete migration analysis within a single skill invocation; no external API calls beyond `gh` for label checks |
| **Security** | Never modify files without explicit user approval; no secrets or credentials in migration output |
| **Reliability** | If migration fails mid-apply, already-written files remain valid (each file is written atomically) |
| **Platforms** | Must work on macOS, Windows, and Linux per tech.md cross-platform requirements |

---

## UI/UX Requirements

| Element | Requirement |
|---------|-------------|
| **Interaction** | Interactive review gate before applying changes; user approves or rejects |
| **Loading States** | Display progress as each file category (steering, specs, config) is analyzed |
| **Error States** | Clear error message if template directories cannot be found |
| **Empty States** | Friendly message when everything is already up to date |

---

## Data Requirements

### Input Data

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| Project directory | Path | Must contain `.claude/` directory | Yes |
| Template directories | Paths | Must exist within installed plugin | Yes (resolved at runtime) |
| sdlc-config.json | JSON file | Valid JSON | No (skipped if absent) |

### Output Data

| Field | Type | Description |
|-------|------|-------------|
| Migration report | Markdown text | Per-file summary of sections added |
| Modified files | Markdown/JSON files | Updated project files with new sections merged |

---

## Dependencies

### Internal Dependencies
- [ ] `setting-up-steering/templates/` — steering doc templates (source of truth)
- [ ] `writing-specs/templates/` — spec file templates (source of truth)
- [ ] `openclaw/scripts/sdlc-config.example.json` — OpenClaw config template

### External Dependencies
- [ ] `gh` CLI — for checking issue labels when detecting spec type (feature vs defect)

### Blocked By
- None

---

## Out of Scope

- **Auto-mode support** — this skill is always interactive; migration is sensitive enough to require human review
- **Version tracking / incremental migrations** — always migrates to current standards in one shot
- **Migrating CLAUDE.md or hook configurations** — those are project-owned, not template-driven
- **Creating missing files** — the skill updates existing files, not bootstrapping new ones (use `/setting-up-steering` or `/writing-specs` for that)
- **Modifying user-written content** — only adds missing sections; never rewrites existing content
- **Auto-updating the OpenClaw skill** — the migration skill warns if outdated; use `/installing-openclaw-skill` to update
- **Regenerating `sdlc-config.json` from scratch** — the skill merges new keys, not replaces the file
- **Migrating `retrospective.md`** — generated by `/running-retrospectives` and not template-driven in the same way

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Content preservation | Zero user content lost during migration | Diff before/after shows only additions |
| Template coverage | All template sections detected and mergeable | Compare template section list against migration output |
| Self-updating accuracy | Skill detects new sections in updated templates without code changes | Test with a template that has an added section |

---

## Open Questions

- [x] Should `retrospective.md` be included in migration scope? — **No**, it is generated output from `/running-retrospectives`, not a user-authored doc from a template
- [x] How should defect vs feature spec variants be detected? — Check for `# Defect Report:` heading in existing `requirements.md` or fall back to `gh issue view` label check

---

## Validation Checklist

Before moving to PLAN phase:

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases and error states are specified (AC8, AC9)
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented (or resolved)
