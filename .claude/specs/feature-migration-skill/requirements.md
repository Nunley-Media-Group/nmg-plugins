# Requirements: Add Migration Skill

**Issues**: #25, #72, #95
**Date**: 2026-02-25
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

<!-- From issue #72 -->

### AC10: Writing-Specs Detects Existing Feature Specs (Happy Path)

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

### AC11: Writing-Specs Creates New Feature Spec When No Match Exists

**Given** a feature issue `#80 "Add weather alerts"` exists
**And** no existing spec directory relates to weather alerts
**When** the user runs `/writing-specs #80`
**Then** the skill searches existing specs and finds no match
**And** creates a new spec directory named `feature-weather-alerts/`
**And** the spec frontmatter tracks `#80` as the contributing issue in the `**Issues**` field

### AC12: User Can Reject Spec Match and Create New Spec

**Given** an enhancement issue exists
**And** the skill finds a potential matching spec
**When** the user is asked to confirm the match
**And** the user rejects the match (says "No, create a new spec")
**Then** a new spec directory is created with a `feature-` prefixed name derived from the issue title
**And** the existing spec is left unchanged

### AC13: Spec Directory Naming Convention Changes

**Given** the new spec management system is in place
**When** a new spec is created (either fresh or via amendment)
**Then** feature/enhancement spec directories are prefixed with `feature-` (e.g., `feature-dark-mode/`)
**And** bug spec directories are prefixed with `bug-` (e.g., `bug-login-crash/`)
**And** the directory name uses a kebab-case slug derived from the issue title (no issue number in the directory name)
**And** issue numbers are tracked in spec frontmatter only

### AC14: Multi-Issue Frontmatter Tracking

**Given** a spec that has been amended by multiple issues
**When** the spec files are read
**Then** all contributing issue numbers are listed in a bold `**Issues**` frontmatter field formatted as `**Issues**: #42, #71, #85`
**And** each issue's contribution context is preserved in a Change History section listing the issue number, date added, and brief summary of what it contributed

**Example**:
- Frontmatter: `**Issues**: #42, #71, #85`
- Change History section entry: `| #71 | 2026-02-22 | Added dark mode toggle to settings panel |`

### AC15: Spec Match Discovery Uses Concrete Search Strategy

**Given** an issue with title "Add dark mode toggle to settings"
**When** the skill searches for existing related specs
**Then** it extracts keywords from the issue title (filtering out stop words like "add", "the", "to")
**And** runs `Glob` for `.claude/specs/feature-*/requirements.md` to list all feature specs (not `bug-` prefixed specs)
**And** runs `Grep` over matching spec files using the extracted keywords
**And** scores matches by keyword hit count to rank candidates
**And** presents the top match (or top 2-3 if scores are close) to the user for confirmation
**And** if no specs match any keywords, proceeds to create a new spec without prompting

### AC16: Amendment Preserves Existing Content

**Given** an existing feature spec with established requirements, design, and tasks
**When** the spec is amended with a new issue's requirements
**Then** all existing content is preserved — no existing ACs, FRs, design sections, or tasks are removed
**And** new acceptance criteria are appended to the existing ACs section with sequential numbering
**And** new functional requirements are appended to the existing FR table
**And** new design sections are added or existing ones are extended (not replaced)
**And** new tasks are appended as a new phase or added to existing phases as appropriate
**And** new Gherkin scenarios are appended to the existing feature.gherkin file

### AC17: Migrating-Projects Consolidates Legacy Specs

**Given** a project has legacy specs with issue-numbered directories (e.g., `42-add-dark-mode/`, `71-dark-mode-toggle/`)
**And** these specs relate to the same logical feature
**When** the user runs `/migrating-projects`
**Then** the skill detects spec directories that share a common feature via keyword analysis of their requirements and design content
**And** presents consolidation candidates to the user showing: the spec directories that would be merged, the proposed `feature-`-prefixed target name, and a summary of each spec's content
**And** upon confirmation, merges the specs into a single `feature-`-prefixed directory
**And** the merged spec's frontmatter lists all original issue numbers in the `**Issues**` field
**And** the merged requirements, design, and tasks reflect the combined state

### AC18: Migrating-Projects Requires User Confirmation for Consolidation

**Given** the migration skill has identified consolidation candidates
**When** presenting the candidates
**Then** each candidate group is shown with the spec directories that would be merged and the proposed feature name
**And** the user must explicitly approve each consolidation (no auto-consolidation)
**And** rejected consolidations are skipped without modification

### AC19: Migrating-Projects Handles Already-Implemented Specs

**Given** some legacy specs have already been fully implemented
**When** `/migrating-projects` consolidates them
**Then** completed specs are merged into the canonical feature spec representing the current state
**And** implementation status is noted in the Change History section of the merged spec

### AC20: Bug Specs Use bug- Prefix

**Given** a bug issue `#90 "Fix login crash on timeout"` with the `bug` label
**When** the user runs `/writing-specs #90`
**Then** the spec directory is created as `bug-login-crash-on-timeout/`
**And** the directory name uses the `bug-` prefix with the issue title slug
**And** bug specs are NOT candidates for consolidation — each bug gets its own directory

### AC21: Migrating-Projects Resolves Defect Spec Cross-References During Consolidation

**Given** legacy defect specs contain `**Related Spec**: .claude/specs/42-add-dark-mode/` pointing to a legacy feature spec
**And** that legacy feature spec is being consolidated into `feature-dark-mode/`
**When** consolidation completes
**Then** all defect specs' `**Related Spec**` fields that referenced the old directory are updated to point to the new `feature-`-prefixed directory
**And** chain resolution follows `Related Spec` links through intermediate defect specs (with cycle detection) to find all affected references

### AC22: Downstream Skills Work With New Naming Convention

**Given** specs exist under the new `feature-`/`bug-` naming convention
**When** a user runs `/implementing-specs` or `/verifying-specs` referencing the spec by path
**Then** the downstream skill correctly reads the spec files from the new directory structure
**And** the issue-to-spec path resolution (using branch name or issue number) successfully locates specs regardless of whether they use legacy `{issue#}-{slug}` or new `feature-`/`bug-` naming

### AC23: Migrating-Projects Updates Legacy Frontmatter

**Given** a project has feature specs (identified by `# Requirements:` heading) with the legacy singular `**Issue**: #42` frontmatter field
**And** the spec has already been renamed to a `feature-` prefixed directory (or is being renamed as part of consolidation)
**When** the user runs `/migrating-projects`
**Then** the skill detects feature-variant spec files with singular `**Issue**` instead of plural `**Issues**`
**And** proposes updating the frontmatter from `**Issue**: #42` to `**Issues**: #42`
**And** proposes adding a `## Change History` section if missing
**And** upon user confirmation, applies the frontmatter and Change History updates
**And** defect specs (identified by `# Defect Report:` heading) are left unchanged — they keep singular `**Issue**`

### AC24: Auto-Mode Compatibility

**Given** `.claude/auto-mode` exists in the project directory
**When** `/writing-specs` finds a matching existing spec
**Then** the skill auto-approves the amendment (no `AskUserQuestion` prompt for spec match confirmation)

> **Note**: `/migrating-projects` is intentionally excluded from auto-mode for consolidation steps. Migration is a destructive, irreversible operation (it deletes legacy directories and merges content), so it always requires human confirmation regardless of `.claude/auto-mode`. The existing automation mode section in `/migrating-projects` pre-dates this feature and correctly enforces this safety constraint.

<!-- From issue #95 -->

### AC25: Drifted Config Values Are Detected and Reported

**Given** the project's `sdlc-config.json` has a key that also exists in `sdlc-config.example.json`
**When** the scalar value differs from the template default
**Then** `/migrating-projects` includes the key in a "Config Value Drift" section of the migration summary, showing both the current value and the template default side-by-side

**Example**:
- Given: Project config has `"maxTurns": 15` under `steps.createPR`; template has `"maxTurns": 30`
- When: `/migrating-projects` is run
- Then: Summary shows `steps.createPR.maxTurns: 15 → 30 (template default)`

### AC26: Nested Step Values Are Also Compared

**Given** a step sub-key exists in both project config and template (e.g., `steps.createPR.maxTurns`)
**When** the value differs from the template default
**Then** the drift is detected and included in the Config Value Drift report

### AC27: User Is Asked Per-Value Whether to Accept Template Default

**Given** the migration summary shows config value drift findings
**When** the user proceeds with migration in interactive mode
**Then** they are asked via `AskUserQuestion` with `multiSelect: true` to select which drifted values to update to the template default (unselected values are left unchanged)

### AC28: Approved Updates Are Written, Declined Values Preserved

**Given** the user has selected some drifted values to update and skipped others
**When** the migration applies changes
**Then** selected values are updated to the template default in `sdlc-config.json`, and skipped values remain exactly as-is

### AC29: Auto-Mode Reports Drift but Does Not Apply Updates

**Given** `.claude/auto-mode` exists
**When** `/migrating-projects` runs and finds config value drift
**Then** the drift is included in the summary output but no values are automatically changed (value updates require explicit user approval even in auto-mode, as they may represent intentional customizations)

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
| FR14 | `/writing-specs` must search existing `feature-` prefixed spec directories for related features before creating a new spec | Must | Uses keyword extraction from issue title, then Grep over spec content |
| FR15 | When a match is found, the user must be asked to confirm amendment vs new spec creation (unless auto-mode) | Must | Present top match with spec name and brief content summary |
| FR16 | Spec directories must be prefixed with `feature-` or `bug-` followed by the issue title slug (no issue number) | Must | Slug algorithm: lowercase, replace spaces/special chars with hyphens, collapse consecutive hyphens |
| FR17 | Spec frontmatter must support tracking multiple contributing issue numbers with a `**Issues**` field | Must | Format: `**Issues**: #42, #71, #85` |
| FR18 | Each spec must include a Change History section tracking which issue contributed what | Should | Table format: issue number, date, summary |
| FR19 | `/migrating-projects` must detect and propose consolidation of related legacy specs | Must | Keyword analysis across requirements and design content |
| FR20 | All consolidation actions in `/migrating-projects` must require explicit user confirmation (unless auto-mode) | Must | Each group approved individually |
| FR21 | Amended specs must preserve all existing content and append new requirements/design/tasks | Must | No removal or replacement of existing content |
| FR22 | Keyword matching for related spec detection should extract meaningful terms from issue title (filtering stop words) and search spec requirements and design content | Should | Score by hit count; present top matches |
| FR23 | `/migrating-projects` must update `**Related Spec**` fields in defect specs when consolidating their referenced feature specs | Must | Chain resolution with cycle detection |
| FR24 | Downstream skills (`/implementing-specs`, `/verifying-specs`) must resolve specs by issue number regardless of naming convention | Must | Search both `{issue#}-*` and `feature-*/bug-*` patterns |
| FR25 | Bug specs are never candidates for consolidation — each bug gets its own `bug-{slug}/` directory | Must | Consolidation only applies to `feature-` specs |
| FR26 | `/migrating-projects` must detect feature-variant specs with legacy singular `**Issue**` frontmatter and propose updating to plural `**Issues**` with Change History | Must | Part of heading-diff + frontmatter analysis |
| FR27 | Compare scalar values of all keys present in both project config and template during Step 5 config analysis | Must | Extends existing key-level diffing with value-level comparison |
| FR28 | Report drifted values with current vs template default in migration summary under a "Config Value Drift" section | Must | Side-by-side display: `key: current → template` |
| FR29 | Present per-value `AskUserQuestion multiSelect` for drift update approval in interactive mode | Must | Each drifted value is an individually selectable option |
| FR30 | Apply approved drift updates using `Edit` tool, preserving JSON formatting | Must | Only selected values are updated; declined values untouched |
| FR31 | Auto-mode: report drift in summary only, skip approval and application of value updates | Must | Value updates may represent intentional customizations |
| FR32 | Skip comparison for keys present in project config but absent from template (user additions) | Should | Custom keys are user extensions, not drift candidates |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Complete migration analysis within a single skill invocation; no external API calls beyond `gh` for label checks |
| **Security** | Never modify files without explicit user approval; no secrets or credentials in migration output |
| **Reliability** | If migration fails mid-apply, already-written files remain valid (each file is written atomically) |
| **Platforms** | Must work on macOS, Windows, and Linux per tech.md cross-platform requirements |
| **Amendment Reliability** | Amendment must be atomic — if the process fails mid-amendment, existing spec content must not be corrupted; write to temp then move |
| **Backwards Compatibility** | Legacy `{issue#}-{slug}` spec directories continue to function until explicitly migrated |

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
| Issue number | Integer | Must correspond to an existing GitHub issue | Yes (for writing-specs) |
| Issue title | String | Used for slug generation and keyword extraction | Yes (from `gh issue view`) |
| Issue labels | String[] | `bug` label triggers `bug-` prefix | Yes (from `gh issue view`) |

### Output Data

| Field | Type | Description |
|-------|------|-------------|
| Migration report | Markdown text | Per-file summary of sections added |
| Modified files | Markdown/JSON files | Updated project files with new sections merged |
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
- [ ] `setting-up-steering/templates/` — steering doc templates (source of truth)
- [ ] `writing-specs/templates/` — spec file templates (source of truth)
- [ ] `openclaw/scripts/sdlc-config.example.json` — OpenClaw config template
- [ ] `/writing-specs` skill — must be modified to add spec discovery and amendment flow
- [ ] `/migrating-projects` skill — must be modified to add consolidation logic
- [ ] Spec templates (`requirements.md`, `design.md`, `tasks.md`, `feature.gherkin`) — must support multi-issue frontmatter and Change History section

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
- Automatic renaming of git branches to match new spec directory names
- Consolidation of bug specs (bugs remain individual per-issue specs with `bug-` prefix)
- Retroactive rewriting of spec content — consolidation merges structure, not rewrites prose
- Changes to `/implementing-specs` or `/verifying-specs` workflow logic (they already read specs by directory path; only the path resolution needs to handle both naming conventions)
- Spec versioning or diff tracking beyond issue frontmatter and Change History
- Renaming the `**Issue**` field in existing defect templates (defect specs still use singular `**Issue**` since each bug gets its own spec)
- Persisting declined drift findings across runs (drift is reported every run; user skips each time)
- Tracking historical defaults to distinguish "stale default" from "intentional customization" — all value diffs are surfaced; the user decides
- Updating complex nested objects (e.g., `implement.plan` sub-objects not present in the template) — only scalar values are compared
- Non-`sdlc-config.json` files for drift detection (steering docs and spec templates have separate migration logic)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Content preservation | Zero user content lost during migration | Diff before/after shows only additions |
| Template coverage | All template sections detected and mergeable | Compare template section list against migration output |
| Self-updating accuracy | Skill detects new sections in updated templates without code changes | Test with a template that has an added section |
| Spec discovery accuracy | Correct match found in >80% of cases where a related spec exists | Exercise testing: create a feature spec, then run `/writing-specs` for a related enhancement issue |
| Amendment fidelity | Zero content loss during amendment | Verify all pre-existing ACs, FRs, and design sections present after amendment |
| Migration completeness | All legacy specs consolidated into feature-prefixed directories when user approves | Count pre/post migration spec directories |
| Downstream compatibility | `/implementing-specs` and `/verifying-specs` work with both naming conventions | Exercise both skills against feature-prefixed specs |
| Drift detection accuracy | All drifted values detected with zero false negatives for scalar keys | Compare a config with known drifted values against the template |
| Drift update safety | Zero unintended value changes — only user-selected values are updated | Verify declined drifts remain unchanged after migration |

---

## Open Questions

- [x] Should `retrospective.md` be included in migration scope? — **No**, it is generated output from `/running-retrospectives`, not a user-authored doc from a template
- [x] How should defect vs feature spec variants be detected? — Check for `# Defect Report:` heading in existing `requirements.md` or fall back to `gh issue view` label check
- [x] Should the `**Issue**` field be renamed to `**Issues**` in existing templates? — Yes, for feature specs; defect specs keep singular `**Issue**` since they're per-bug
- [x] How should the amendment handle conflicting design decisions between original and new issue? — Append new sections; human review gate resolves conflicts
- [x] Should auto-mode auto-approve consolidation in `/migrating-projects`? — No; migration is destructive and always requires human confirmation

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #25 | 2026-02-15 | Initial feature spec: migration skill for steering docs, specs, and OpenClaw config |
| #72 | 2026-02-22 | Added feature-centric spec management: spec discovery, amendment flow, naming convention changes, consolidation logic |
| #95 | 2026-02-25 | Added config value drift detection to /migrating-projects Step 5: value comparison, per-value approval, auto-mode reporting |

---

## Validation Checklist

Before moving to PLAN phase:

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases and error states are specified (AC8, AC9, AC12, AC21, AC24)
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented (or resolved)
