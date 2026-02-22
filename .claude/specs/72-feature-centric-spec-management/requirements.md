# Requirements: Feature-Centric Spec Management

**Issues**: #72
**Date**: 2026-02-22
**Status**: Draft
**Author**: Claude (nmg-sdlc)

---

## User Story

**As a** developer using the nmg-sdlc workflow
**I want** enhancement specs to amend existing feature specs rather than creating duplicates
**So that** each feature has a single canonical spec that evolves over time and maintains traceability to all contributing issues

---

## Background

The SDLC workflow currently treats every issue identically: `/writing-specs` creates a fresh spec directory named `{issue#}-{kebab-title}/` with no awareness of related existing specs. Over time, iterative feature work produces multiple disconnected spec directories for what is logically the same feature, making it hard to understand the current state of a feature's requirements.

This enhancement introduces feature-centric spec management: spec directories are named by type and feature (e.g., `feature-dark-mode/`, `bug-login-crash/`) rather than by issue number, and multiple issues can contribute to a single feature spec. `/writing-specs` gains an exploration step to detect existing related specs and amend them, and `/migrating-projects` gains consolidation logic to merge legacy issue-numbered specs into canonical feature specs.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Writing-Specs Detects Existing Feature Specs (Happy Path)

**Given** an enhancement issue `#71 "Add dark mode toggle to settings"` exists
**And** a spec directory `.claude/specs/feature-dark-mode/` already exists from a prior issue
**When** the user runs `/writing-specs #71`
**Then** the skill searches existing `feature-` prefixed spec directories by keyword matching on issue title, requirements content, and design content
**And** presents the user with the match and asks: "This appears to be an enhancement to the existing 'feature-dark-mode' spec. Amend existing spec?"
**And** upon confirmation, amends the existing spec files with the new requirements, design changes, and tasks
**And** adds `#71` to the spec's `**Issues**` frontmatter alongside the original issue(s)

**Example**:
- Given: Issue #71 "Add dark mode toggle to settings"; existing spec `.claude/specs/feature-dark-mode/requirements.md` contains "dark mode" in its user story
- When: User runs `/writing-specs #71`
- Then: Skill finds `feature-dark-mode` as a match, presents it for confirmation, and upon approval amends the existing spec

### AC2: Writing-Specs Creates New Feature Spec When No Match Exists

**Given** a feature issue `#80 "Add weather alerts"` exists
**And** no existing spec directory relates to weather alerts
**When** the user runs `/writing-specs #80`
**Then** the skill searches existing specs and finds no match
**And** creates a new spec directory named `feature-weather-alerts/`
**And** the spec frontmatter tracks `#80` as the contributing issue in the `**Issues**` field

### AC3: User Can Reject Spec Match and Create New Spec

**Given** an enhancement issue exists
**And** the skill finds a potential matching spec
**When** the user is asked to confirm the match
**And** the user rejects the match (says "No, create a new spec")
**Then** a new spec directory is created with a `feature-` prefixed name derived from the issue title
**And** the existing spec is left unchanged

### AC4: Spec Directory Naming Convention Changes

**Given** the new spec management system is in place
**When** a new spec is created (either fresh or via amendment)
**Then** feature/enhancement spec directories are prefixed with `feature-` (e.g., `feature-dark-mode/`)
**And** bug spec directories are prefixed with `bug-` (e.g., `bug-login-crash/`)
**And** the directory name uses a kebab-case slug derived from the issue title (no issue number in the directory name)
**And** issue numbers are tracked in spec frontmatter only

### AC5: Multi-Issue Frontmatter Tracking

**Given** a spec that has been amended by multiple issues
**When** the spec files are read
**Then** all contributing issue numbers are listed in a bold `**Issues**` frontmatter field formatted as `**Issues**: #42, #71, #85`
**And** each issue's contribution context is preserved in a Change History section listing the issue number, date added, and brief summary of what it contributed

**Example**:
- Frontmatter: `**Issues**: #42, #71, #85`
- Change History section entry: `| #71 | 2026-02-22 | Added dark mode toggle to settings panel |`

### AC6: Spec Match Discovery Uses Concrete Search Strategy

**Given** an issue with title "Add dark mode toggle to settings"
**When** the skill searches for existing related specs
**Then** it extracts keywords from the issue title (filtering out stop words like "add", "the", "to")
**And** runs `Glob` for `.claude/specs/feature-*/requirements.md` to list all feature specs (not `bug-` prefixed specs)
**And** runs `Grep` over matching spec files using the extracted keywords
**And** scores matches by keyword hit count to rank candidates
**And** presents the top match (or top 2-3 if scores are close) to the user for confirmation
**And** if no specs match any keywords, proceeds to create a new spec without prompting

### AC7: Amendment Preserves Existing Content

**Given** an existing feature spec with established requirements, design, and tasks
**When** the spec is amended with a new issue's requirements
**Then** all existing content is preserved — no existing ACs, FRs, design sections, or tasks are removed
**And** new acceptance criteria are appended to the existing ACs section with sequential numbering
**And** new functional requirements are appended to the existing FR table
**And** new design sections are added or existing ones are extended (not replaced)
**And** new tasks are appended as a new phase or added to existing phases as appropriate
**And** new Gherkin scenarios are appended to the existing feature.gherkin file

### AC8: Migrating-Projects Consolidates Legacy Specs

**Given** a project has legacy specs with issue-numbered directories (e.g., `42-add-dark-mode/`, `71-dark-mode-toggle/`)
**And** these specs relate to the same logical feature
**When** the user runs `/migrating-projects`
**Then** the skill detects spec directories that share a common feature via keyword analysis of their requirements and design content
**And** presents consolidation candidates to the user showing: the spec directories that would be merged, the proposed `feature-`-prefixed target name, and a summary of each spec's content
**And** upon confirmation, merges the specs into a single `feature-`-prefixed directory
**And** the merged spec's frontmatter lists all original issue numbers in the `**Issues**` field
**And** the merged requirements, design, and tasks reflect the combined state

### AC9: Migrating-Projects Requires User Confirmation for Consolidation

**Given** the migration skill has identified consolidation candidates
**When** presenting the candidates
**Then** each candidate group is shown with the spec directories that would be merged and the proposed feature name
**And** the user must explicitly approve each consolidation (no auto-consolidation)
**And** rejected consolidations are skipped without modification

### AC10: Migrating-Projects Handles Already-Implemented Specs

**Given** some legacy specs have already been fully implemented
**When** `/migrating-projects` consolidates them
**Then** completed specs are merged into the canonical feature spec representing the current state
**And** implementation status is noted in the Change History section of the merged spec

### AC11: Bug Specs Use bug- Prefix

**Given** a bug issue `#90 "Fix login crash on timeout"` with the `bug` label
**When** the user runs `/writing-specs #90`
**Then** the spec directory is created as `bug-login-crash-on-timeout/`
**And** the directory name uses the `bug-` prefix with the issue title slug
**And** bug specs are NOT candidates for consolidation — each bug gets its own directory

### AC12: Migrating-Projects Resolves Defect Spec Cross-References During Consolidation

**Given** legacy defect specs contain `**Related Spec**: .claude/specs/42-add-dark-mode/` pointing to a legacy feature spec
**And** that legacy feature spec is being consolidated into `feature-dark-mode/`
**When** consolidation completes
**Then** all defect specs' `**Related Spec**` fields that referenced the old directory are updated to point to the new `feature-`-prefixed directory
**And** chain resolution follows `Related Spec` links through intermediate defect specs (with cycle detection) to find all affected references

### AC13: Downstream Skills Work With New Naming Convention

**Given** specs exist under the new `feature-`/`bug-` naming convention
**When** a user runs `/implementing-specs` or `/verifying-specs` referencing the spec by path
**Then** the downstream skill correctly reads the spec files from the new directory structure
**And** the issue-to-spec path resolution (using branch name or issue number) successfully locates specs regardless of whether they use legacy `{issue#}-{slug}` or new `feature-`/`bug-` naming

### AC15: Migrating-Projects Updates Legacy Frontmatter

**Given** a project has feature specs (identified by `# Requirements:` heading) with the legacy singular `**Issue**: #42` frontmatter field
**And** the spec has already been renamed to a `feature-` prefixed directory (or is being renamed as part of consolidation)
**When** the user runs `/migrating-projects`
**Then** the skill detects feature-variant spec files with singular `**Issue**` instead of plural `**Issues**`
**And** proposes updating the frontmatter from `**Issue**: #42` to `**Issues**: #42`
**And** proposes adding a `## Change History` section if missing
**And** upon user confirmation, applies the frontmatter and Change History updates
**And** defect specs (identified by `# Defect Report:` heading) are left unchanged — they keep singular `**Issue**`

### AC14: Auto-Mode Compatibility

**Given** `.claude/auto-mode` exists in the project directory
**When** `/writing-specs` finds a matching existing spec
**Then** the skill auto-approves the amendment (no `AskUserQuestion` prompt for spec match confirmation)

> **Note**: `/migrating-projects` is intentionally excluded from auto-mode for consolidation steps. Migration is a destructive, irreversible operation (it deletes legacy directories and merges content), so it always requires human confirmation regardless of `.claude/auto-mode`. The existing automation mode section in `/migrating-projects` pre-dates this feature and correctly enforces this safety constraint.

### Generated Gherkin Preview

```gherkin
Feature: Feature-Centric Spec Management
  As a developer using the nmg-sdlc workflow
  I want enhancement specs to amend existing feature specs rather than creating duplicates
  So that each feature has a single canonical spec that evolves over time

  Scenario: Writing-Specs detects and amends existing feature spec
    Given an enhancement issue "#71" titled "Add dark mode toggle to settings" exists
    And a spec directory "feature-dark-mode" already exists from a prior issue
    When the user runs "/writing-specs #71"
    Then the skill finds "feature-dark-mode" as a related spec
    And presents the match for user confirmation
    And upon confirmation, amends the existing spec with new requirements
    And adds "#71" to the spec Issues frontmatter

  Scenario: Writing-Specs creates new feature spec when no match exists
    Given a feature issue "#80" titled "Add weather alerts" exists
    And no existing spec directory relates to weather alerts
    When the user runs "/writing-specs #80"
    Then a new spec directory "feature-weather-alerts" is created
    And the spec frontmatter tracks "#80" as the contributing issue

  Scenario: User rejects spec match and creates new spec
    Given an enhancement issue exists
    And the skill finds a potential matching spec
    When the user rejects the match
    Then a new feature-prefixed spec directory is created
    And the existing spec is left unchanged

  Scenario: Bug specs use bug- prefix
    Given a bug issue "#90" titled "Fix login crash on timeout"
    When the user runs "/writing-specs #90"
    Then a spec directory "bug-login-crash-on-timeout" is created
    And the directory uses the "bug-" prefix

  Scenario: Multi-issue frontmatter tracking
    Given a spec amended by issues "#42", "#71", and "#85"
    When the spec files are read
    Then the Issues field lists all three issue numbers
    And each issue has an entry in the Change History section

  Scenario: Amendment preserves existing content
    Given an existing feature spec with established requirements and design
    When the spec is amended with a new issue
    Then all existing content is preserved
    And new acceptance criteria are appended with sequential numbering
    And new Gherkin scenarios are appended to the feature file

  Scenario: Migrating-Projects consolidates legacy specs
    Given legacy specs "42-add-dark-mode" and "71-dark-mode-toggle" exist
    When the user runs "/migrating-projects"
    Then the skill detects the specs share a common feature
    And presents consolidation candidates for user confirmation
    And upon confirmation merges into "feature-dark-mode"

  Scenario: Migrating-Projects requires confirmation per consolidation
    Given consolidation candidates are identified
    When the user rejects a consolidation
    Then that group is skipped without modification

  Scenario: Defect spec cross-references updated during consolidation
    Given a defect spec references legacy path "42-add-dark-mode"
    And that spec is consolidated into "feature-dark-mode"
    When consolidation completes
    Then the defect spec Related Spec field is updated to the new path

  Scenario: Auto-mode skips interactive confirmations
    Given ".claude/auto-mode" exists
    When "/writing-specs" finds a matching spec
    Then amendment is auto-approved without prompting
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | `/writing-specs` must search existing `feature-` prefixed spec directories for related features before creating a new spec | Must | Uses keyword extraction from issue title, then Grep over spec content |
| FR2 | When a match is found, the user must be asked to confirm amendment vs new spec creation (unless auto-mode) | Must | Present top match with spec name and brief content summary |
| FR3 | Spec directories must be prefixed with `feature-` or `bug-` followed by the issue title slug (no issue number) | Must | Slug algorithm: lowercase, replace spaces/special chars with hyphens, collapse consecutive hyphens |
| FR4 | Spec frontmatter must support tracking multiple contributing issue numbers with a `**Issues**` field | Must | Format: `**Issues**: #42, #71, #85` |
| FR5 | Each spec must include a Change History section tracking which issue contributed what | Should | Table format: issue number, date, summary |
| FR6 | `/migrating-projects` must detect and propose consolidation of related legacy specs | Must | Keyword analysis across requirements and design content |
| FR7 | All consolidation actions in `/migrating-projects` must require explicit user confirmation (unless auto-mode) | Must | Each group approved individually |
| FR8 | Amended specs must preserve all existing content and append new requirements/design/tasks | Must | No removal or replacement of existing content |
| FR9 | Keyword matching for related spec detection should extract meaningful terms from issue title (filtering stop words) and search spec requirements and design content | Should | Score by hit count; present top matches |
| FR10 | `/migrating-projects` must update `**Related Spec**` fields in defect specs when consolidating their referenced feature specs | Must | Chain resolution with cycle detection |
| FR11 | Downstream skills (`/implementing-specs`, `/verifying-specs`) must resolve specs by issue number regardless of naming convention | Must | Search both `{issue#}-*` and `feature-*/bug-*` patterns |
| FR12 | Bug specs are never candidates for consolidation — each bug gets its own `bug-{slug}/` directory | Must | Consolidation only applies to `feature-` specs |
| FR13 | `/migrating-projects` must detect feature-variant specs with legacy singular `**Issue**` frontmatter and propose updating to plural `**Issues**` with Change History | Must | Part of heading-diff + frontmatter analysis |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Spec discovery (Glob + Grep over existing specs) should complete within a few seconds even for projects with 50+ spec directories |
| **Reliability** | Amendment must be atomic — if the process fails mid-amendment, existing spec content must not be corrupted; write to temp then move |
| **Platforms** | All path construction must use forward slashes or platform-agnostic joins; no hardcoded separators |
| **Backwards Compatibility** | Legacy `{issue#}-{slug}` spec directories continue to function until explicitly migrated |

---

## Data Requirements

### Input Data

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| Issue number | Integer | Must correspond to an existing GitHub issue | Yes |
| Issue title | String | Used for slug generation and keyword extraction | Yes (from `gh issue view`) |
| Issue labels | String[] | `bug` label triggers `bug-` prefix | Yes (from `gh issue view`) |

### Output Data — Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `**Issues**` | Comma-separated `#N` references | All contributing issue numbers (replaces single `**Issue**` field) |
| `**Date**` | ISO date | Date of last amendment |
| `**Status**` | Enum | Draft, In Review, Approved |

### Output Data — Change History Section

| Column | Type | Description |
|--------|------|-------------|
| Issue | `#N` reference | The contributing issue number |
| Date | ISO date | When the amendment was made |
| Summary | String | Brief description of what was added |

---

## Dependencies

### Internal Dependencies
- [ ] `/writing-specs` skill — must be modified to add spec discovery and amendment flow
- [ ] `/migrating-projects` skill — must be modified to add consolidation logic
- [ ] Spec templates (`requirements.md`, `design.md`, `tasks.md`, `feature.gherkin`) — must support multi-issue frontmatter and Change History section

### External Dependencies
- [ ] `gh` CLI — for reading issue metadata (title, labels)

### Blocked By
- None

---

## Out of Scope

- Automatic renaming of git branches to match new spec directory names
- Consolidation of bug specs (bugs remain individual per-issue specs with `bug-` prefix)
- Retroactive rewriting of spec content — consolidation merges structure, not rewrites prose
- Changes to `/implementing-specs` or `/verifying-specs` workflow logic (they already read specs by directory path; only the path resolution needs to handle both naming conventions)
- Spec versioning or diff tracking beyond issue frontmatter and Change History
- Renaming the `**Issue**` field in existing defect templates (defect specs still use singular `**Issue**` since each bug gets its own spec)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Spec discovery accuracy | Correct match found in >80% of cases where a related spec exists | Exercise testing: create a feature spec, then run `/writing-specs` for a related enhancement issue |
| Amendment fidelity | Zero content loss during amendment | Verify all pre-existing ACs, FRs, and design sections present after amendment |
| Migration completeness | All legacy specs consolidated into feature-prefixed directories when user approves | Count pre/post migration spec directories |
| Downstream compatibility | `/implementing-specs` and `/verifying-specs` work with both naming conventions | Exercise both skills against feature-prefixed specs |

---

## Open Questions

- [x] Should the `**Issue**` field be renamed to `**Issues**` in existing templates? — Yes, for feature specs; defect specs keep singular `**Issue**` since they're per-bug
- [x] How should the amendment handle conflicting design decisions between original and new issue? — Append new sections; human review gate resolves conflicts
- [x] Should auto-mode auto-approve consolidation in `/migrating-projects`? — Yes, per AC14

---

## Validation Checklist

Before moving to PLAN phase:

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases and error states are specified (AC3 rejection, AC12 cross-references, AC14 auto-mode)
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented and resolved

### Retrospective Learnings Applied

| Learning | Application |
|----------|-------------|
| Specify exact formatting variants for markdown fields | AC5 specifies bold `**Issues**` field format and Change History table structure |
| Include ACs for chain resolution of cross-reference links | AC12 requires chain resolution through defect specs with cycle detection during consolidation |
| Specify data retrieval strategy for selection interfaces | AC6 specifies concrete search strategy: keyword extraction → Glob → Grep → scoring → presentation |
| Include ACs for the discovery mechanism that populates cross-reference fields | AC6 specifies the full discovery pipeline rather than relying on agent intuition |
| Include defensive AC for excluded integration modes | AC14 specifies auto-mode behavior; AC13 is a defensive AC ensuring downstream skills work with new naming |
| Specify relevance filtering for template application | AC8 consolidation presentation includes per-spec content summary so users can make informed decisions |
