# Requirements: Integrated Versioning System

**Issues**: #41, #87, #139
**Date**: 2026-04-19
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

**Given** a developer is creating an issue via `/draft-issue`
**When** the interview reaches the milestone question
**Then** the skill presents milestone options defaulting to the current major version (derived from `VERSION` file, e.g., VERSION=1.5.1 → default milestone "v1"), allows the developer to provide a new milestone number (e.g., "3" → "v2"), and assigns the created issue to the chosen milestone

**Example**:
- Given: A project with `VERSION` file containing `1.5.1`
- When: Developer creates an issue and is asked about milestone
- Then: Default milestone is "v1"; developer can accept or type "3" for "v2"

### AC2: Milestone Auto-Creation

**Given** a developer specifies milestone "3" during `/draft-issue`
**When** no "v2" milestone exists on the GitHub repository
**Then** the skill creates the "v2" milestone via `gh` CLI before assigning the issue to it

**Example**:
- Given: No "v2" milestone exists on the repo
- When: Developer types "3" as the milestone
- Then: `gh api` creates "v2" milestone, then assigns the issue to it

### AC3: Automatic Version Bump Classification — Bug/Patch

**Given** a developer runs `/open-pr` for an issue with the `bug` label
**When** the skill determines the version impact
**Then** it classifies the change as a **patch** bump (x.y.Z), presents the classification to the developer, and allows override before applying

**Example**:
- Given: Issue #50 has the `bug` label, current VERSION is `1.5.1`
- When: `/open-pr` runs
- Then: Proposes version `1.5.2` (patch); developer can override to minor or major

### AC4: Minor Version Bump for User-Facing Changes

**Given** a developer runs `/open-pr` for an issue with the `enhancement` label
**When** the skill determines the version impact
**Then** it classifies the change as a **minor** bump (x.Y.0)

**Example**:
- Given: Issue #51 has the `enhancement` label, current VERSION is `1.5.1`
- When: `/open-pr` runs
- Then: Proposes version `1.6.0` (minor)

### AC5: Major Version Bumps Are Manual Only

**Given** a developer decides a major version bump is needed
**When** `/open-pr` presents the version bump classification
**Then** the developer can override the auto-classified bump type to **major** (X.0.0) via the confirmation prompt
**And** no automatic major bump detection occurs (milestone completion does not trigger major bumps)

**Example**:
- Given: Current VERSION is `1.9.1`, developer wants to release v3
- When: `/open-pr` proposes a minor bump to `1.10.0`
- Then: Developer overrides to "Major", resulting in version `2.0.0`

### AC6: VERSION File and CHANGELOG Update in PR

**Given** `/open-pr` has determined the version bump type (patch, minor, or major)
**When** the PR is being assembled
**Then** the PR includes: (1) an updated `VERSION` file with the new semver string, (2) `CHANGELOG.md` with `[Unreleased]` entries moved under a new version heading with today's date, and (3) any stack-specific version files identified in the project's `tech.md` versioning section

**Example**:
- Given: VERSION is `1.5.1`, bump type is minor, `[Unreleased]` has 3 entries
- When: PR is assembled
- Then: VERSION becomes `1.6.0`, CHANGELOG gets `## [1.6.0] - 2026-02-16` heading with those entries

### AC7: Steering Doc Bridge for Stack-Specific Version Files

**Given** a project's `steering/tech.md` contains a "Versioning" section listing stack-specific version files (e.g., `package.json:version`, `Cargo.toml:package.version`)
**When** `/open-pr` bumps the version
**Then** it updates both the universal `VERSION` file and all declared stack-specific version files

**Example**:
- Given: tech.md Versioning section lists `package.json:version`
- When: Version bumps to `1.6.0`
- Then: Both `VERSION` and `package.json` `"version"` field are updated to `1.6.0`

### AC8a: Migration Creates CHANGELOG from Scratch

**Given** a project has no `CHANGELOG.md` but has git commit history using conventional commits
**When** a developer runs `/migrate-project`
**Then** the skill generates a `CHANGELOG.md` from git history, grouping entries by conventional commit type (feat → Added, fix → Fixed, etc.) under version headings derived from git tags (or a single `[0.1.0]` if no tags exist), with an `[Unreleased]` section for commits after the latest tag

**Example**:
- Given: Repo has 20 conventional commits, 2 git tags (`v1.0.0`, `v1.1.0`)
- When: `/migrate-project` runs
- Then: CHANGELOG has `## [Unreleased]`, `## [1.1.0]`, `## [1.0.0]` headings with categorized entries

### AC8b: Migration Updates Existing CHANGELOG to Match Template

**Given** a project has an existing `CHANGELOG.md` that doesn't conform to the Keep a Changelog template (e.g., missing categories, flat bullet lists, no `[Unreleased]` section, missing version headings)
**When** a developer runs `/migrate-project`
**Then** the skill reconciles the existing CHANGELOG with git history — restructuring entries into proper Keep a Changelog format (Added, Changed, Deprecated, Removed, Fixed, Security), adding missing version headings from git tags, ensuring an `[Unreleased]` section exists, and preserving any manually-written entries that don't correspond to commits

**Example**:
- Given: CHANGELOG.md has a flat list of changes under a single heading, git has tags `v1.0.0` and `v2.0.0`
- When: `/migrate-project` runs
- Then: CHANGELOG is restructured with `## [Unreleased]`, `## [2.0.0]`, `## [1.0.0]` headings, entries categorized by type, and manually-written entries preserved in their closest version section

### AC9: Migration Creates or Updates VERSION File

**Given** a project has no `VERSION` file, or has a `VERSION` file that is out of sync
**When** a developer runs `/migrate-project`
**Then** the skill creates or updates the `VERSION` file with the version derived from the generated/updated CHANGELOG: (1) the latest versioned heading in `CHANGELOG.md`, (2) the latest git tag if no CHANGELOG headings exist, or (3) `0.1.0` as the default

**Example (create)**:
- Given: No VERSION file, CHANGELOG was just generated with latest heading `[1.1.0]`
- When: `/migrate-project` runs
- Then: Creates `VERSION` file containing `1.1.0`

**Example (update)**:
- Given: VERSION contains `1.0.0`, but CHANGELOG was updated and latest heading is `[1.1.0]`
- When: `/migrate-project` runs
- Then: Updates `VERSION` file to `1.1.0`

### AC10: Auto-Mode Compatibility

**Given** `.claude/unattended-mode` exists in the project
**When** `/draft-issue` runs in unattended-mode
**Then** the milestone defaults to the current major version without prompting, and `/open-pr` auto-determines and applies the version bump without confirmation (patch or minor only; major bumps require manual override)

**Example**:
- Given: unattended-mode enabled, VERSION is `1.5.1`, issue has `enhancement` label
- When: `/draft-issue` runs → `/open-pr` runs
- Then: Milestone auto-set to "v1"; version auto-bumped to `1.6.0` with no prompts

### AC11: Single Authoritative Location for Classification Logic

**Given** the version classification matrix (label→bump type mapping) needs to be defined
**When** both `/open-pr` and `sdlc-runner.mjs` need to determine a version bump
**Then** the classification rules are defined in a single authoritative location (a steering document section within `steering/tech.md`) that both consumers reference, rather than each embedding an independent copy of the matrix

**Example**:
- Given: `steering/tech.md` contains a `### Version Bump Classification` subsection under `## Versioning`
- When: `/open-pr` needs to classify a bump type
- Then: It reads the matrix from `tech.md` rather than using an inline table
- And: `sdlc-runner.mjs` parses the same `tech.md` section to build its classification logic

### AC12: Both Consumers Reference Single Source

**Given** the classification logic exists in `tech.md`'s Version Bump Classification subsection
**When** `/open-pr` skill determines a version bump
**Then** it reads the label→bump mappings from the steering document and applies them

**Given** the classification logic exists in `tech.md`'s Version Bump Classification subsection
**When** `sdlc-runner.mjs` performs its deterministic version bump postcondition
**Then** it parses the same steering document section and applies the same mappings

**Example**:
- Given: `tech.md` Version Bump Classification table contains `bug → patch`, `enhancement → minor`
- When: `/open-pr` runs for a `bug`-labeled issue
- Then: It reads `tech.md`, finds the `bug` row, and classifies as patch
- And: `sdlc-runner.mjs` independently reads `tech.md`, finds the same `bug` row, and classifies as patch

### AC13: Single Change Point for New Mappings

**Given** a new label→bump mapping needs to be added (e.g., `security` → patch)
**When** the mapping is added to the Version Bump Classification table in `tech.md`
**Then** both `/open-pr` and `sdlc-runner.mjs` pick up the new mapping without any code or skill changes

**Example**:
- Given: A project adds `| security | patch | Security vulnerability fix |` to the tech.md classification table
- When: `/open-pr` runs for an issue labeled `security`
- Then: It finds the `security` row and classifies as patch — no SKILL.md change needed
- And: `sdlc-runner.mjs` finds the same row and classifies as patch — no script change needed

### AC14: Milestone completion no longer overrides bump type in /open-pr

**Given** an issue is the last open issue in its milestone
**When** `/open-pr #N` runs (interactively or unattended)
**Then** the bump type is determined solely by the label-based classification matrix (enhancement → minor, bug → patch, fallback → minor) — no milestone open-count query is performed and no major bump is proposed

**Example**:
- Given: Issue #200 has `enhancement` label and is the only open issue in milestone "v1"
- When: `/open-pr #200` runs
- Then: The skill classifies the bump as minor (per the `enhancement` row in tech.md) and does not query `gh api repos/:owner/:repo/milestones/:id --jq '.open_issues'`

### AC15: /open-pr accepts an explicit --major argument for intentional major bumps

**Given** a developer runs `/open-pr #N --major`
**When** the skill reaches Step 2 (Determine Version Bump)
**Then** it proposes a major bump in the `AskUserQuestion` bump menu as the pre-selected option (the developer still confirms)

**Example**:
- Given: Issue #201 has `enhancement` label, current VERSION is `1.49.1`, developer invokes `/open-pr #201 --major`
- When: Step 2 presents the bump menu
- Then: The menu shows Major (2.0.0) as the pre-selected/recommended option, with Minor and Patch as alternatives the developer may still choose

### AC16: --major in unattended-mode is an escalation, not a silent apply

**Given** `.claude/unattended-mode` is present and the skill is invoked with `--major`
**When** the skill reaches Step 2
**Then** it halts with an escalation message: `"ESCALATION: --major flag requires human confirmation — unattended mode cannot apply a major version bump"` and exits without bumping or creating a PR

**Example**:
- Given: `.claude/unattended-mode` exists, runner invokes `/open-pr #202 --major`
- When: Step 2 is reached
- Then: The skill prints the escalation message and terminates; no VERSION or CHANGELOG changes are written, no PR is created, and the runner receives a non-success signal

### AC17: LLM inference that "breaking = major" is corrected in tech.md and the template

**Given** a `### Changed (BREAKING)` section appears in a version entry
**When** an LLM reads `steering/tech.md` to decide the bump type
**Then** the steering text is unambiguous: `### Changed (BREAKING)` sections are minor bumps — the breaking nature must be communicated via a **`BREAKING CHANGE:`** bold prefix on the relevant bullet, and a `### Migration Notes` sub-section is recommended; no bump-type override applies

**Example**:
- Given: `steering/tech.md` no longer contains the "Milestone completion override" paragraph; it explicitly states that `### Changed (BREAKING)` uses minor bump with `**BREAKING CHANGE:**` bullet prefix
- When: An LLM running `/open-pr` reads tech.md while assembling the CHANGELOG entry for an `enhancement`-labeled issue with breaking changes
- Then: It classifies the bump as minor (per the label matrix) and formats the changelog entry with a `**BREAKING CHANGE:**` bullet prefix and optional `### Migration Notes` sub-section, without inferring a major bump

*Note:* The `tech.md` template (in `plugins/nmg-sdlc/skills/onboard-project/templates/tech.md`) and the project's own `steering/tech.md` both need this update so the guidance propagates to new projects via `/onboard-project` and is authoritative for this project.

### AC18: README no longer documents "major on milestone completion"

**Given** a developer reads the README to understand versioning
**When** they look at the version bump table and the `/open-pr` skill description
**Then** no text claims milestone completion triggers a major bump; the table shows only the label-based rules (bug → patch, enhancement → minor); and the `argument-hint` for `/open-pr` reflects `[#issue-number] [--major]`

**Example**:
- Given: A developer opens README.md at the version bump and skills sections
- When: They read the bump-type table and the `/open-pr` entry
- Then: The table has no row referencing "milestone completion"; the `/open-pr` description mentions only label-based classification and the opt-in `--major` flag

### Generated Gherkin Preview

```gherkin
Feature: Integrated Versioning System
  As a developer using nmg-sdlc
  I want an integrated versioning system
  So that every project gets consistent, stack-agnostic versioning

  Scenario: Milestone assignment during issue creation
    Given a developer is creating an issue via /draft-issue
    And the project VERSION file contains "1.5.1"
    When the interview reaches the milestone question
    Then the skill presents milestone "v1" as the default
    And allows the developer to specify a different milestone number

  Scenario: Milestone auto-creation
    Given a developer specifies milestone "3" during /draft-issue
    And no "v2" milestone exists on the GitHub repository
    When the issue is created
    Then the skill creates the "v2" milestone via gh CLI
    And assigns the issue to it

  Scenario: Patch bump for bug fixes
    Given a developer runs /open-pr for an issue with the "bug" label
    And the current VERSION is "1.5.1"
    When the skill determines the version impact
    Then it classifies the change as a patch bump
    And proposes version "1.5.2"

  Scenario: Minor bump for enhancements
    Given a developer runs /open-pr for an issue with the "enhancement" label
    And the current VERSION is "1.5.1"
    When the skill determines the version impact
    Then it classifies the change as a minor bump
    And proposes version "1.6.0"

  Scenario: Major bump via manual override
    Given a developer runs /open-pr for an enhancement issue
    And the current VERSION is "1.9.1"
    When /open-pr proposes a minor bump to "1.10.0"
    And the developer overrides the classification to "Major"
    Then the version bumps to "2.0.0"

  Scenario: VERSION file and CHANGELOG update
    Given /open-pr has determined a minor bump
    And the current VERSION is "1.5.1"
    And CHANGELOG.md has entries under [Unreleased]
    When the PR is assembled
    Then VERSION file is updated to "1.6.0"
    And [Unreleased] entries move under "[1.6.0] - YYYY-MM-DD"

  Scenario: Stack-specific version file updates
    Given tech.md Versioning section lists "package.json:version"
    And the version bump is to "1.6.0"
    When /open-pr updates version files
    Then both VERSION and package.json version are "1.6.0"

  Scenario: Migration creates CHANGELOG from scratch
    Given a project has no CHANGELOG.md
    And has conventional commit history with git tags
    When /migrate-project runs
    Then it generates CHANGELOG.md grouped by commit type and version tags
    And includes an [Unreleased] section

  Scenario: Migration updates existing CHANGELOG to match template
    Given a project has a CHANGELOG.md that doesn't conform to Keep a Changelog format
    And has conventional commit history with git tags
    When /migrate-project runs
    Then it restructures entries into proper Keep a Changelog categories
    And adds missing version headings from git tags
    And ensures an [Unreleased] section exists
    And preserves manually-written entries

  Scenario: Migration creates or updates VERSION file
    Given a project has no VERSION file or an out-of-sync VERSION file
    When /migrate-project runs
    Then it sets VERSION to the latest versioned CHANGELOG heading
    Or falls back to latest git tag or "0.1.0"

  Scenario: Unattended-mode skips all prompts
    Given .claude/unattended-mode exists in the project
    When /draft-issue and /open-pr run
    Then milestone defaults without prompting
    And version bump applies without confirmation

  Scenario: Classification matrix defined in single steering document
    Given the project's tech.md contains a Version Bump Classification table
    When /open-pr or sdlc-runner.mjs needs to classify a version bump
    Then both read the matrix from tech.md rather than using inline definitions

  Scenario: Both consumers produce identical results from shared source
    Given tech.md defines "bug" maps to "patch" and "enhancement" maps to "minor"
    And an issue has the "bug" label
    When /open-pr classifies the version bump
    And sdlc-runner.mjs classifies the version bump independently
    Then both classify the change as a patch bump

  Scenario: New label mapping requires only one change
    Given a new "security" to "patch" mapping is added to tech.md
    When /open-pr runs for a "security"-labeled issue
    Then it classifies the change as a patch bump
    And no SKILL.md or sdlc-runner.mjs code changes are required

  # Added by issue #139
  Scenario: Milestone completion does not trigger a major bump
    Given an issue has the "enhancement" label
    And it is the last open issue in its milestone
    When /open-pr runs
    Then the skill classifies the bump as minor via the label matrix
    And does not query the milestone open-issue count

  # Added by issue #139
  Scenario: --major flag pre-selects major bump in the confirmation menu
    Given a developer runs "/open-pr #N --major"
    When the skill reaches the version bump confirmation step
    Then the AskUserQuestion bump menu presents Major as the recommended option

  # Added by issue #139
  Scenario: --major in unattended-mode escalates without bumping
    Given ".claude/unattended-mode" exists
    And the skill is invoked with the "--major" flag
    When the skill reaches the version bump step
    Then it prints "ESCALATION: --major flag requires human confirmation — unattended mode cannot apply a major version bump"
    And exits without writing VERSION, CHANGELOG, or creating a PR

  # Added by issue #139
  Scenario: Breaking-change guidance in steering does not imply major bump
    Given steering/tech.md no longer contains a "Milestone completion override" paragraph
    And it documents that "### Changed (BREAKING)" uses a minor bump with a "**BREAKING CHANGE:**" bullet prefix
    When an LLM reads tech.md to classify an enhancement with breaking changes
    Then it proposes a minor bump
    And it formats the CHANGELOG entry with the "**BREAKING CHANGE:**" prefix

  # Added by issue #139
  Scenario: README documents only label-based bump rules
    Given the README version-bump table
    When a reader inspects it
    Then no row references milestone completion
    And the /open-pr argument-hint is "[#issue-number] [--major]"
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | `/draft-issue` adds a milestone interview question with current major version as default; accepts a single number (1, 2, 3) to represent v1, v2, v3 | Must | Reads `VERSION` file to derive default |
| FR2 | `/draft-issue` auto-creates the GitHub milestone via `gh` CLI if it doesn't exist | Must | Uses `gh api` to create milestone |
| FR3 | `/open-pr` auto-classifies version impact: `bug` → patch, `enhancement` → minor, default → minor | Must | Label-based classification; major bumps are manual only |
| FR4 | `/open-pr` allows developer to override the auto-classified version bump type | Must | `AskUserQuestion` with bump options |
| FR5 | `/open-pr` updates `VERSION` file (plain text semver) and `CHANGELOG.md` (moves `[Unreleased]` to versioned heading) | Must | Keep a Changelog format |
| FR6 | `/open-pr` allows manual override to major bump via confirmation prompt | Must | Major bumps are a developer decision, not automatic |
| FR7 | Tech.md steering template adds a "Versioning" section for declaring stack-specific version files | Must | Added to `/setup-steering` template |
| FR8 | `/open-pr` reads tech.md versioning section and updates declared stack-specific version files alongside `VERSION` | Must | Parses `file:json.path` format |
| FR9a | `/migrate-project` generates `CHANGELOG.md` from scratch when none exists, using conventional commit parsing and git tags for version grouping | Must | Maps feat→Added, fix→Fixed, chore→Changed, etc. |
| FR9b | `/migrate-project` updates an existing `CHANGELOG.md` to conform to Keep a Changelog template — restructures entries into categories, adds missing version headings from git tags, ensures `[Unreleased]` section, preserves manual entries | Must | Reconciles existing content with git history |
| FR10 | `/migrate-project` creates or updates `VERSION` file to match the latest versioned heading in the generated/updated CHANGELOG; falls back to latest git tag or `0.1.0` if no headings exist | Must | VERSION always reflects CHANGELOG state |
| FR11 | Unattended-mode: milestone defaults to current major version; patch and minor version bumps are fully automatic with no confirmation; major bumps are not applied automatically | Must | Consistent with unattended-mode pattern |
| FR12 | `/setup-steering` tech.md template includes the new Versioning section | Must | Template update |
| FR13 | Version Bump Classification subsection in tech.md Versioning section defines label→bump mappings in a parseable table format (Label \| Bump Type \| Description columns) | Must | Single source of truth for classification |
| FR14 | `/open-pr` reads classification matrix from `tech.md` Version Bump Classification table instead of using an inline matrix | Must | Replaces hardcoded table in SKILL.md Step 2 |
| FR15 | `sdlc-runner.mjs` `performDeterministicVersionBump()` parses `tech.md` Version Bump Classification table instead of using hardcoded if-else logic | Must | Replaces hardcoded logic in script |
| FR16 | Default classification (minor bump) applies when an issue label does not match any row in the tech.md classification table | Must | Preserves existing behavior for unlabeled issues |
| FR17 | Remove Step 2.4 (milestone-completion check) from `open-pr/SKILL.md` entirely | Must | Milestone open-count no longer overrides the label matrix |
| FR18 | Add `--major` argument to `/open-pr`; when passed, pre-select major in the Step 2 bump menu | Must | Opt-in only; developer still confirms via `AskUserQuestion` |
| FR19 | When `--major` is combined with unattended-mode, emit escalation message and exit without bumping | Must | Exit message: `ESCALATION: --major flag requires human confirmation — unattended mode cannot apply a major version bump` |
| FR20 | Update `steering/tech.md` — remove "Milestone completion override" paragraph; add `**BREAKING CHANGE:**` prefix guidance and recommended `### Migration Notes` sub-section note | Must | Removes double-signal that primes LLMs to infer breaking = major |
| FR21 | Update `plugins/nmg-sdlc/skills/onboard-project/templates/tech.md` with identical changes so new projects inherit the correct policy | Must | Template must match authoritative steering |
| FR22 | Update `README.md` — remove `(milestone completion)` row from the version bump table and update `/open-pr` description to remove "major on milestone completion" language | Must | Lines 140, 267, 276 per issue |
| FR23 | Update `open-pr/SKILL.md` `argument-hint` to `[#issue-number] [--major]` | Must | Surfaces the new opt-in flag in the skill manifest |

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
- [x] `/draft-issue` skill exists and has the interview workflow
- [x] `/open-pr` skill exists and creates PRs
- [x] `/setup-steering` skill exists and generates steering templates
- [ ] `/migrate-project` skill (for CHANGELOG/VERSION generation from history)

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
- **Changing the actual classification rules** — The label→bump mappings (bug→patch, enhancement→minor) remain the same; only their location changes
- **Adding new version bump categories** — Only patch, minor, and major are supported
- **Modifying how version bumps are applied** — Only where classification is defined changes, not the bump execution logic
- **`scripts/sdlc-runner.mjs` changes** — The runner already enforces patch-and-minor-only; no major-bump path exists and none is being added (issue #139)
- **`/draft-issue` milestone naming** — The skill reads the current major version to suggest a milestone label; that is a display convention, not a bump trigger (issue #139)
- **`/start-issue` milestone filtering** — Not in scope for issue #139

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Version consistency | VERSION file, CHANGELOG, and stack-specific files always in sync after `/open-pr` | Verify all version references match after PR creation |
| Milestone adoption | All new issues created via `/draft-issue` have a milestone assigned | Check milestone assignment rate on issues |
| Automation reliability | Unattended-mode completes versioning without manual intervention | SDLC runner full-cycle success rate |

---

## Open Questions

- [x] Minor bump semantics: Issue text mentions "1.0.0 to 1.0.1" for minor — confirmed as typo; standard semver minor (x.Y.0) applies
- [ ] Should `/open-pr` warn if `VERSION` file doesn't exist yet and offer to create it, or silently skip versioning?
- [ ] For milestone completion detection: should the check count only issues in the current PR, or also recently merged PRs that haven't triggered a major bump yet?

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #41 | 2026-02-16 | Initial feature spec |
| #87 | 2026-02-25 | Deduplicate version bump classification logic — AC11-AC13, FR13-FR16 |
| #139 | 2026-04-19 | Enforce manual-only major version policy: remove /open-pr milestone override, add `--major` flag, fix breaking-change steering guidance — AC14-AC18, FR17-FR23 |

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
