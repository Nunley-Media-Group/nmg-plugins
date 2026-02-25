# Requirements: Integrated Versioning System

**Issues**: #41, #87
**Date**: 2026-02-25
**Status**: Draft
**Author**: Claude (nmg-sdlc)

---

## User Story

**As a** developer using nmg-sdlc
**I want** an integrated versioning system that tracks versions, manages milestones, and maintains a changelog as a built-in benefit of the SDLC workflow
**So that** every project using nmg-sdlc gets consistent, stack-agnostic versioning without additional tooling

---

## Background

Today, nmg-sdlc has no built-in versioning system. Version bumps are manual, CHANGELOG entries are hand-written, and milestones aren't part of the issue creation workflow. Projects using nmg-sdlc should get versioning "for free" — the SDLC pipeline already knows what changed (issue type, acceptance criteria, milestone context), so it can automatically determine the version impact and maintain versioning artifacts.

The versioning system must be stack-agnostic (a core product principle) — it produces universal artifacts (`VERSION` file, `CHANGELOG.md`) while steering docs bridge the gap to stack-specific version files (e.g., `package.json`, `Cargo.toml`, `pyproject.toml`).

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Milestone Assignment During Issue Creation — Happy Path

**Given** a developer is creating an issue via `/creating-issues`
**When** the interview reaches the milestone question
**Then** the skill presents milestone options defaulting to the current major version (derived from `VERSION` file, e.g., VERSION=2.3.1 → default milestone "v2"), allows the developer to provide a new milestone number (e.g., "3" → "v3"), and assigns the created issue to the chosen milestone

**Example**:
- Given: A project with `VERSION` file containing `2.3.1`
- When: Developer creates an issue and is asked about milestone
- Then: Default milestone is "v2"; developer can accept or type "3" for "v3"

### AC2: Milestone Auto-Creation

**Given** a developer specifies milestone "3" during `/creating-issues`
**When** no "v3" milestone exists on the GitHub repository
**Then** the skill creates the "v3" milestone via `gh` CLI before assigning the issue to it

**Example**:
- Given: No "v3" milestone exists on the repo
- When: Developer types "3" as the milestone
- Then: `gh api` creates "v3" milestone, then assigns the issue to it

### AC3: Automatic Version Bump Classification — Bug/Patch

**Given** a developer runs `/creating-prs` for an issue with the `bug` label
**When** the skill determines the version impact
**Then** it classifies the change as a **patch** bump (x.y.Z), presents the classification to the developer, and allows override before applying

**Example**:
- Given: Issue #50 has the `bug` label, current VERSION is `2.3.1`
- When: `/creating-prs` runs
- Then: Proposes version `2.3.2` (patch); developer can override to minor or major

### AC4: Minor Version Bump for User-Facing Changes

**Given** a developer runs `/creating-prs` for an issue with the `enhancement` label
**When** the skill determines the version impact
**Then** it classifies the change as a **minor** bump (x.Y.0)

**Example**:
- Given: Issue #51 has the `enhancement` label, current VERSION is `2.3.1`
- When: `/creating-prs` runs
- Then: Proposes version `2.4.0` (minor)

### AC5: Major Version Bump on Milestone Completion

**Given** a PR that closes the last open issue in milestone "v2"
**When** `/creating-prs` detects the milestone will be fully completed
**Then** it proposes a **major** version bump (X.0.0) and asks the developer to confirm before applying

**Example**:
- Given: Milestone "v2" has 5 issues, 4 already closed, this PR closes #5
- When: `/creating-prs` detects this is the last issue
- Then: Proposes version `3.0.0` (major) with confirmation prompt

### AC6: VERSION File and CHANGELOG Update in PR

**Given** `/creating-prs` has determined the version bump type (patch, minor, or major)
**When** the PR is being assembled
**Then** the PR includes: (1) an updated `VERSION` file with the new semver string, (2) `CHANGELOG.md` with `[Unreleased]` entries moved under a new version heading with today's date, and (3) any stack-specific version files identified in the project's `tech.md` versioning section

**Example**:
- Given: VERSION is `2.3.1`, bump type is minor, `[Unreleased]` has 3 entries
- When: PR is assembled
- Then: VERSION becomes `2.4.0`, CHANGELOG gets `## [2.4.0] - 2026-02-16` heading with those entries

### AC7: Steering Doc Bridge for Stack-Specific Version Files

**Given** a project's `.claude/steering/tech.md` contains a "Versioning" section listing stack-specific version files (e.g., `package.json:version`, `Cargo.toml:package.version`)
**When** `/creating-prs` bumps the version
**Then** it updates both the universal `VERSION` file and all declared stack-specific version files

**Example**:
- Given: tech.md Versioning section lists `package.json:version`
- When: Version bumps to `2.4.0`
- Then: Both `VERSION` and `package.json` `"version"` field are updated to `2.4.0`

### AC8a: Migration Creates CHANGELOG from Scratch

**Given** a project has no `CHANGELOG.md` but has git commit history using conventional commits
**When** a developer runs `/migrating-projects`
**Then** the skill generates a `CHANGELOG.md` from git history, grouping entries by conventional commit type (feat → Added, fix → Fixed, etc.) under version headings derived from git tags (or a single `[0.1.0]` if no tags exist), with an `[Unreleased]` section for commits after the latest tag

**Example**:
- Given: Repo has 20 conventional commits, 2 git tags (`v1.0.0`, `v1.1.0`)
- When: `/migrating-projects` runs
- Then: CHANGELOG has `## [Unreleased]`, `## [1.1.0]`, `## [1.0.0]` headings with categorized entries

### AC8b: Migration Updates Existing CHANGELOG to Match Template

**Given** a project has an existing `CHANGELOG.md` that doesn't conform to the Keep a Changelog template (e.g., missing categories, flat bullet lists, no `[Unreleased]` section, missing version headings)
**When** a developer runs `/migrating-projects`
**Then** the skill reconciles the existing CHANGELOG with git history — restructuring entries into proper Keep a Changelog format (Added, Changed, Deprecated, Removed, Fixed, Security), adding missing version headings from git tags, ensuring an `[Unreleased]` section exists, and preserving any manually-written entries that don't correspond to commits

**Example**:
- Given: CHANGELOG.md has a flat list of changes under a single heading, git has tags `v1.0.0` and `v2.0.0`
- When: `/migrating-projects` runs
- Then: CHANGELOG is restructured with `## [Unreleased]`, `## [2.0.0]`, `## [1.0.0]` headings, entries categorized by type, and manually-written entries preserved in their closest version section

### AC9: Migration Creates or Updates VERSION File

**Given** a project has no `VERSION` file, or has a `VERSION` file that is out of sync
**When** a developer runs `/migrating-projects`
**Then** the skill creates or updates the `VERSION` file with the version derived from the generated/updated CHANGELOG: (1) the latest versioned heading in `CHANGELOG.md`, (2) the latest git tag if no CHANGELOG headings exist, or (3) `0.1.0` as the default

**Example (create)**:
- Given: No VERSION file, CHANGELOG was just generated with latest heading `[1.1.0]`
- When: `/migrating-projects` runs
- Then: Creates `VERSION` file containing `1.1.0`

**Example (update)**:
- Given: VERSION contains `1.0.0`, but CHANGELOG was updated and latest heading is `[1.1.0]`
- When: `/migrating-projects` runs
- Then: Updates `VERSION` file to `1.1.0`

### AC10: Auto-Mode Compatibility

**Given** `.claude/auto-mode` exists in the project
**When** `/creating-issues` runs in auto-mode
**Then** the milestone defaults to the current major version without prompting, and `/creating-prs` auto-determines and applies the version bump without confirmation (including major bumps)

**Example**:
- Given: auto-mode enabled, VERSION is `2.3.1`, issue has `enhancement` label
- When: `/creating-issues` runs → `/creating-prs` runs
- Then: Milestone auto-set to "v2"; version auto-bumped to `2.4.0` with no prompts

### AC11: Single Authoritative Location for Classification Logic

**Given** the version classification matrix (label→bump type mapping) needs to be defined
**When** both `/creating-prs` and `sdlc-runner.mjs` need to determine a version bump
**Then** the classification rules are defined in a single authoritative location (a steering document section within `.claude/steering/tech.md`) that both consumers reference, rather than each embedding an independent copy of the matrix

**Example**:
- Given: `.claude/steering/tech.md` contains a `### Version Bump Classification` subsection under `## Versioning`
- When: `/creating-prs` needs to classify a bump type
- Then: It reads the matrix from `tech.md` rather than using an inline table
- And: `sdlc-runner.mjs` parses the same `tech.md` section to build its classification logic

### AC12: Both Consumers Reference Single Source

**Given** the classification logic exists in `tech.md`'s Version Bump Classification subsection
**When** `/creating-prs` skill determines a version bump
**Then** it reads the label→bump mappings from the steering document and applies them

**Given** the classification logic exists in `tech.md`'s Version Bump Classification subsection
**When** `sdlc-runner.mjs` performs its deterministic version bump postcondition
**Then** it parses the same steering document section and applies the same mappings

**Example**:
- Given: `tech.md` Version Bump Classification table contains `bug → patch`, `enhancement → minor`
- When: `/creating-prs` runs for a `bug`-labeled issue
- Then: It reads `tech.md`, finds the `bug` row, and classifies as patch
- And: `sdlc-runner.mjs` independently reads `tech.md`, finds the same `bug` row, and classifies as patch

### AC13: Single Change Point for New Mappings

**Given** a new label→bump mapping needs to be added (e.g., `security` → patch)
**When** the mapping is added to the Version Bump Classification table in `tech.md`
**Then** both `/creating-prs` and `sdlc-runner.mjs` pick up the new mapping without any code or skill changes

**Example**:
- Given: A project adds `| security | patch | Security vulnerability fix |` to the tech.md classification table
- When: `/creating-prs` runs for an issue labeled `security`
- Then: It finds the `security` row and classifies as patch — no SKILL.md change needed
- And: `sdlc-runner.mjs` finds the same row and classifies as patch — no script change needed

### Generated Gherkin Preview

```gherkin
Feature: Integrated Versioning System
  As a developer using nmg-sdlc
  I want an integrated versioning system
  So that every project gets consistent, stack-agnostic versioning

  Scenario: Milestone assignment during issue creation
    Given a developer is creating an issue via /creating-issues
    And the project VERSION file contains "2.3.1"
    When the interview reaches the milestone question
    Then the skill presents milestone "v2" as the default
    And allows the developer to specify a different milestone number

  Scenario: Milestone auto-creation
    Given a developer specifies milestone "3" during /creating-issues
    And no "v3" milestone exists on the GitHub repository
    When the issue is created
    Then the skill creates the "v3" milestone via gh CLI
    And assigns the issue to it

  Scenario: Patch bump for bug fixes
    Given a developer runs /creating-prs for an issue with the "bug" label
    And the current VERSION is "2.3.1"
    When the skill determines the version impact
    Then it classifies the change as a patch bump
    And proposes version "2.3.2"

  Scenario: Minor bump for enhancements
    Given a developer runs /creating-prs for an issue with the "enhancement" label
    And the current VERSION is "2.3.1"
    When the skill determines the version impact
    Then it classifies the change as a minor bump
    And proposes version "2.4.0"

  Scenario: Major bump on milestone completion
    Given a PR closes the last open issue in milestone "v2"
    And the current VERSION is "2.9.1"
    When /creating-prs detects the milestone will be fully completed
    Then it proposes a major version bump to "3.0.0"
    And asks the developer to confirm

  Scenario: VERSION file and CHANGELOG update
    Given /creating-prs has determined a minor bump
    And the current VERSION is "2.3.1"
    And CHANGELOG.md has entries under [Unreleased]
    When the PR is assembled
    Then VERSION file is updated to "2.4.0"
    And [Unreleased] entries move under "[2.4.0] - YYYY-MM-DD"

  Scenario: Stack-specific version file updates
    Given tech.md Versioning section lists "package.json:version"
    And the version bump is to "2.4.0"
    When /creating-prs updates version files
    Then both VERSION and package.json version are "2.4.0"

  Scenario: Migration creates CHANGELOG from scratch
    Given a project has no CHANGELOG.md
    And has conventional commit history with git tags
    When /migrating-projects runs
    Then it generates CHANGELOG.md grouped by commit type and version tags
    And includes an [Unreleased] section

  Scenario: Migration updates existing CHANGELOG to match template
    Given a project has a CHANGELOG.md that doesn't conform to Keep a Changelog format
    And has conventional commit history with git tags
    When /migrating-projects runs
    Then it restructures entries into proper Keep a Changelog categories
    And adds missing version headings from git tags
    And ensures an [Unreleased] section exists
    And preserves manually-written entries

  Scenario: Migration creates or updates VERSION file
    Given a project has no VERSION file or an out-of-sync VERSION file
    When /migrating-projects runs
    Then it sets VERSION to the latest versioned CHANGELOG heading
    Or falls back to latest git tag or "0.1.0"

  Scenario: Auto-mode skips all prompts
    Given .claude/auto-mode exists in the project
    When /creating-issues and /creating-prs run
    Then milestone defaults without prompting
    And version bump applies without confirmation

  Scenario: Classification matrix defined in single steering document
    Given the project's tech.md contains a Version Bump Classification table
    When /creating-prs or sdlc-runner.mjs needs to classify a version bump
    Then both read the matrix from tech.md rather than using inline definitions

  Scenario: Both consumers produce identical results from shared source
    Given tech.md defines "bug" maps to "patch" and "enhancement" maps to "minor"
    And an issue has the "bug" label
    When /creating-prs classifies the version bump
    And sdlc-runner.mjs classifies the version bump independently
    Then both classify the change as a patch bump

  Scenario: New label mapping requires only one change
    Given a new "security" to "patch" mapping is added to tech.md
    When /creating-prs runs for a "security"-labeled issue
    Then it classifies the change as a patch bump
    And no SKILL.md or sdlc-runner.mjs code changes are required
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | `/creating-issues` adds a milestone interview question with current major version as default; accepts a single number (1, 2, 3) to represent v1, v2, v3 | Must | Reads `VERSION` file to derive default |
| FR2 | `/creating-issues` auto-creates the GitHub milestone via `gh` CLI if it doesn't exist | Must | Uses `gh api` to create milestone |
| FR3 | `/creating-prs` auto-classifies version impact: `bug` → patch, `enhancement` → minor, milestone completion → major | Must | Label-based classification |
| FR4 | `/creating-prs` allows developer to override the auto-classified version bump type | Must | `AskUserQuestion` with bump options |
| FR5 | `/creating-prs` updates `VERSION` file (plain text semver) and `CHANGELOG.md` (moves `[Unreleased]` to versioned heading) | Must | Keep a Changelog format |
| FR6 | `/creating-prs` detects milestone completion (last issue closing) and proposes major bump with confirmation | Must | Queries milestone issue count via `gh api` |
| FR7 | Tech.md steering template adds a "Versioning" section for declaring stack-specific version files | Must | Added to `/setting-up-steering` template |
| FR8 | `/creating-prs` reads tech.md versioning section and updates declared stack-specific version files alongside `VERSION` | Must | Parses `file:json.path` format |
| FR9a | `/migrating-projects` generates `CHANGELOG.md` from scratch when none exists, using conventional commit parsing and git tags for version grouping | Must | Maps feat→Added, fix→Fixed, chore→Changed, etc. |
| FR9b | `/migrating-projects` updates an existing `CHANGELOG.md` to conform to Keep a Changelog template — restructures entries into categories, adds missing version headings from git tags, ensures `[Unreleased]` section, preserves manual entries | Must | Reconciles existing content with git history |
| FR10 | `/migrating-projects` creates or updates `VERSION` file to match the latest versioned heading in the generated/updated CHANGELOG; falls back to latest git tag or `0.1.0` if no headings exist | Must | VERSION always reflects CHANGELOG state |
| FR11 | Auto-mode: milestone defaults to current major version; all version bumps (including major) are fully automatic with no confirmation | Must | Consistent with auto-mode pattern |
| FR12 | `/setting-up-steering` tech.md template includes the new Versioning section | Must | Template update |
| FR13 | Version Bump Classification subsection in tech.md Versioning section defines label→bump mappings in a parseable table format (Label \| Bump Type \| Description columns) | Must | Single source of truth for classification |
| FR14 | `/creating-prs` reads classification matrix from `tech.md` Version Bump Classification table instead of using an inline matrix | Must | Replaces hardcoded table in SKILL.md Step 2 |
| FR15 | `sdlc-runner.mjs` `performDeterministicVersionBump()` parses `tech.md` Version Bump Classification table instead of using hardcoded if-else logic | Must | Replaces hardcoded logic in script |
| FR16 | Default classification (minor bump) applies when an issue label does not match any row in the tech.md classification table | Must | Preserves existing behavior for unlabeled issues |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Stack-agnostic** | `VERSION` file is a plain-text semver string readable by any build system; stack-specific files are opt-in via steering docs |
| **Cross-platform** | All `gh` CLI commands and file operations must work on macOS, Windows, and Linux |
| **Idempotent** | Running versioning steps multiple times must not double-bump or corrupt CHANGELOG |
| **Backwards compatible** | Projects without a `VERSION` file continue to work; versioning features activate only when `VERSION` exists |

---

## UI/UX Requirements

Reference `structure.md` and `product.md` for project-specific design standards.

| Element | Requirement |
|---------|-------------|
| **Interaction** | [Touch targets, gesture requirements] |
| **Typography** | [Minimum text sizes, font requirements] |
| **Contrast** | [Accessibility contrast requirements] |
| **Loading States** | [How loading should be displayed] |
| **Error States** | [How errors should be displayed] |
| **Empty States** | [How empty data should be displayed] |

---

## Data Requirements

### Input Data

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| [field] | [type] | [rules] | Yes/No |

### Output Data

| Field | Type | Description |
|-------|------|-------------|
| [field] | [type] | [what it represents] |

---

## Dependencies

### Internal Dependencies
- [x] `/creating-issues` skill exists and has the interview workflow
- [x] `/creating-prs` skill exists and creates PRs
- [x] `/setting-up-steering` skill exists and generates steering templates
- [ ] `/migrating-projects` skill (for CHANGELOG/VERSION generation from history)

### External Dependencies
- [x] GitHub CLI (`gh`) for milestone management
- [x] Git for commit history and tag parsing

### Blocked By
- None

---

## Out of Scope

- **Git tag creation** — Tags are a release artifact, not a PR artifact. Could be added in a future `/releasing` skill
- **CI/CD integration** — No hooks into CI pipelines for automated releases
- **Pre-release versions** — No alpha/beta/rc suffixes in this iteration
- **Multi-package monorepo versioning** — Single VERSION file per project
- **Retroactive milestone assignment** — Existing issues won't be assigned to milestones; only new issues going forward
- **Automated release notes** — GitHub Releases are not managed by this feature
- **Changing the actual classification rules** — The label→bump mappings (bug→patch, enhancement→minor, milestone→major) remain the same; only their location changes
- **Adding new version bump categories** — Only patch, minor, and major are supported
- **Modifying how version bumps are applied** — Only where classification is defined changes, not the bump execution logic

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Version consistency | VERSION file, CHANGELOG, and stack-specific files always in sync after `/creating-prs` | Verify all version references match after PR creation |
| Milestone adoption | All new issues created via `/creating-issues` have a milestone assigned | Check milestone assignment rate on issues |
| Automation reliability | Auto-mode completes versioning without manual intervention | OpenClaw full-cycle success rate |

---

## Open Questions

- [x] Minor bump semantics: Issue text mentions "1.0.0 to 1.0.1" for minor — confirmed as typo; standard semver minor (x.Y.0) applies
- [ ] Should `/creating-prs` warn if `VERSION` file doesn't exist yet and offer to create it, or silently skip versioning?
- [ ] For milestone completion detection: should the check count only issues in the current PR, or also recently merged PRs that haven't triggered a major bump yet?

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #41 | 2026-02-16 | Initial feature spec |
| #87 | 2026-02-25 | Deduplicate version bump classification logic — AC11-AC13, FR13-FR16 |

---

## Validation Checklist

Before moving to PLAN phase:

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases and error states are specified
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented
