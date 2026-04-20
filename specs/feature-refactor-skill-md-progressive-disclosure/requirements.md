# Requirements: Refactor SKILL.md via Progressive Disclosure

**Issues**: #138, #145, #146
**Date**: 2026-04-19
**Status**: Draft
**Author**: Rich Nunley

---

## User Story

**As a** nmg-sdlc plugin maintainer and as a Claude Code agent invoking these skills,
**I want** every SKILL.md body to fit inside Anthropic's progressive-disclosure guidance (≤ 300 lines) with variant- and cross-skill-shared content extracted into `references/` loaded on demand,
**So that** skills trigger faster and with less context bloat, duplicated content is maintained in one place, and skill bodies stay focused on the trigger + workflow skeleton rather than every edge case and variant.

---

## Background

Anthropic's skill-authoring guidance (surfaced via the `skill-creator` skill) targets SKILL.md bodies under 500 lines and pushes variant-specific or conditionally-loaded content into `references/`. Several nmg-sdlc skills have outgrown that target substantially — `draft-issue` is 1087 lines, `upgrade-project` is 572, `write-spec` is 516. `verify-code` already demonstrates the split in-repo with its `checklists/` + `references/` layout; this issue extends the pattern plugin-wide and additionally extracts content that is duplicated across skills into shared references under `plugins/nmg-sdlc/references/`.

Baseline line counts captured at issue authoring time:

| Skill | Lines |
|-------|-------|
| draft-issue | 1087 |
| upgrade-project | 572 |
| write-spec | 516 |
| onboard-project | 473 |
| start-issue | 406 |
| verify-code | 379 |
| run-retro | 307 |
| open-pr | 293 |
| write-code | 218 |

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Every SKILL.md Fits Within Its Size Target

**Given** the nmg-sdlc plugin after this refactor ships
**When** `wc -l plugins/nmg-sdlc/skills/*/SKILL.md` is run
**Then** every file reports ≤ 300 lines and each per-skill target is met:

| Skill | Target |
|-------|--------|
| draft-issue | ≤ 300 |
| upgrade-project | ≤ 250 |
| write-spec | ≤ 250 |
| onboard-project | ≤ 280 |
| start-issue | ≤ 220 |
| verify-code | ≤ 220 |
| run-retro | ≤ 180 |
| open-pr | ≤ 180 |
| write-code | ≤ 180 |

### AC2: Zero Observable Behavior Change (Exercise Testing)

**Given** a refactored skill and a known-good project fixture
**When** the skill is invoked end-to-end against the fixture via `/verify-code`'s exercise-testing path (plugin-scoped skills)
**Then** it produces artifacts that are byte-equivalent (deterministic outputs) or spec-equivalent (model-authored outputs graded against a rubric) to the pre-refactor baseline captured on the same fixture.

### AC3: Shared Content Lives in Exactly One Place

**Given** the six cross-skill references listed below
**When** `grep -r` is run plugin-wide for the characteristic phrases of each
**Then** each block of duplicated content appears in exactly one file under `plugins/nmg-sdlc/references/`, and every consuming SKILL.md contains a single named pointer to that file with the triggering condition stated explicitly.

| Shared reference | Consumed by |
|------------------|-------------|
| `legacy-layout-gate.md` | 8 pipeline skills |
| `unattended-mode.md` | every pipeline skill |
| `feature-naming.md` | draft-issue, start-issue, write-spec, verify-code, open-pr |
| `versioning.md` | open-pr, draft-issue |
| `steering-schema.md` | onboard-project, write-spec, verify-code, open-pr |
| `spec-frontmatter.md` | write-spec, verify-code, run-retro |

### AC4: Slash-Command Surface Unchanged

**Given** the plugin before and after the refactor
**When** the slash-command surface is enumerated from every SKILL.md (by collecting the skill name from each SKILL.md path and cross-checking frontmatter `description`)
**Then** the set of commands is identical — no additions, removals, or renames.

### AC5: Frontmatter Byte-Identical

**Given** any skill's frontmatter before and after the refactor
**When** the frontmatter blocks are diffed
**Then** `description`, `allowed-tools`, `model`, `effort`, and `argument-hint` are byte-identical; only body content below the frontmatter moves.

### AC6: Content-Inventory Audit Passes Deterministically

**Given** a pre-refactor content inventory of each SKILL.md (every Input/Process/Output/Human-Review-Gate/unattended-mode clause enumerated as discrete inventory items)
**When** an automated audit script checks the inventory against the refactored SKILL.md body plus its `references/` files
**Then** every inventory item maps to exactly one destination, and any intentional removal is listed in the PR body with justification. The audit is a deterministic grep-based check, not a read-through — it runs in CI on the refactor PRs and fails the build on unmapped items.

### AC7: Pointer Grammar Is Explicit and Uniform

**Given** any pointer from a SKILL.md to a reference file
**When** the pointer line is inspected
**Then** it follows the shape `Read `references/{name}.md` when {triggering-condition}` — the reference path is in backticks, the triggering condition is stated in the same sentence, and each SKILL.md uses the same phrasing template so a reader can scan pointers consistently.

### AC8: Reference-File Budget Per Skill

**Given** any skill's directory after the refactor
**When** the per-skill `references/` directory is listed
**Then** it contains ≤ 5 reference files, and any reference file > 300 lines includes a table of contents in its first 30 lines.

### AC9: Shared-Reference Normative Fidelity

**Given** any shared reference file under `plugins/nmg-sdlc/references/`
**When** its content is compared against the pre-refactor SKILL.md passages it consolidates
**Then** the normative intent of every consuming skill is preserved — no consumer loses a directive, gains an unintended directive, or sees a directive rewritten to change its operational meaning. Wording may be unified across consumers; semantics may not drift.

### AC10: Claude Code GitHub App Review Workflow Is Enabled And Required

**Given** the Claude Code GitHub App is already installed on the Nunley-Media-Group org with access to this repo
**When** PR 1 ships
**Then** a `.github/workflows/claude-review.yml` workflow runs `anthropics/claude-code-action@v1` on every PR (on `opened` and `synchronize`) and on issue-comment events that contain `@claude`, so every PR — including the subsequent refactor PRs in this effort — receives an automated review that reads the repo's `CLAUDE.md` and steering docs
**And** the workflow is declared a **required status check** on `main` branch-protection rules, so a failing or missing Claude review blocks merge.

### AC11: Claude Review Must Pass Before Merge

**Given** the Claude review workflow has posted a review on a PR
**When** Claude's review verdict is `REQUEST_CHANGES` (or the workflow exits non-zero for any reason)
**Then** the workflow's check status is `failure` and the PR cannot be merged until a follow-up push triggers a passing Claude review
**And** a passing review (`APPROVE` or `COMMENT` without blocking findings) sets the workflow's check status to `success`.

### Generated Gherkin Preview

```gherkin
Feature: Refactor SKILL.md via Progressive Disclosure

  Scenario: Every SKILL.md fits within its size target
    Given the nmg-sdlc plugin after this refactor ships
    When `wc -l plugins/nmg-sdlc/skills/*/SKILL.md` is run
    Then every file reports ≤ 300 lines and each per-skill target is met

  Scenario: Zero observable behavior change via exercise testing
    Given a refactored skill and a known-good project fixture
    When the skill is invoked end-to-end against the fixture
    Then artifacts match the pre-refactor baseline byte-equivalent or spec-equivalent

  Scenario: Shared content lives in exactly one place
    Given the six cross-skill references
    When `grep -r` is run plugin-wide for their characteristic phrases
    Then each block appears in exactly one file under `plugins/nmg-sdlc/references/`

  Scenario: Slash-command surface unchanged
    Given the plugin before and after the refactor
    When the slash-command surface is enumerated
    Then the set of commands is identical

  Scenario: Frontmatter byte-identical
    Given any skill's frontmatter before and after the refactor
    When the frontmatter blocks are diffed
    Then all declared fields are byte-identical

  Scenario: Content-inventory audit passes deterministically
    Given a pre-refactor content inventory of each SKILL.md
    When the audit script runs in CI
    Then every inventory item maps to exactly one destination with no unmapped items

  Scenario: Pointer grammar is explicit and uniform
    Given any pointer from a SKILL.md to a reference file
    When the pointer line is inspected
    Then it follows `Read ``references/{name}.md`` when {triggering-condition}`

  Scenario: Reference-file budget per skill
    Given any skill's directory after the refactor
    When the per-skill `references/` directory is listed
    Then it contains ≤ 5 files, and any file > 300 lines has a TOC

  Scenario: Shared-reference normative fidelity
    Given any shared reference file
    When its content is compared against the passages it consolidates
    Then the normative intent of every consuming skill is preserved

  Scenario: Claude Code GitHub App review workflow is enabled and required
    Given the Claude Code GitHub App is already installed on the org
    When PR 1 ships
    Then `.github/workflows/claude-review.yml` runs on every PR and on @claude comments
    And the workflow is a required status check that blocks merge when Claude requests changes

  Scenario: Claude review must pass before merge
    Given the Claude review workflow posted a REQUEST_CHANGES verdict on a PR
    When the PR is evaluated for mergeability
    Then the workflow check status is `failure` and merge is blocked
    And a subsequent push that yields an APPROVE verdict flips the check to `success`
```

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Create `plugins/nmg-sdlc/references/` with the 6 shared reference files: `legacy-layout-gate.md`, `unattended-mode.md`, `feature-naming.md`, `versioning.md`, `steering-schema.md`, `spec-frontmatter.md`. | Must |
| FR2 | Refactor `draft-issue` to ≤ 300 lines by extracting multi-issue pipeline, Claude Design URL ingestion, interview depth, feature-vs-bug templates, and examples into per-skill `references/`. | Must |
| FR3 | Refactor `upgrade-project` (≤ 250), `write-spec` (≤ 250), `onboard-project` (≤ 280). | Must |
| FR4 | Refactor `start-issue` (≤ 220), `verify-code` (≤ 220), `run-retro` (≤ 180), `open-pr` (≤ 180), `write-code` (≤ 180). | Must |
| FR5 | Soften rigid `ERROR:` / `MUST` / `NEVER` blocks with reasoning-first prose. Applies to the legacy-layout gate wording as well — no downstream parser depends on the current `ERROR:` prefix, so the message may be freely reworded. | Should |
| FR6 | Collapse redundant "When to Use" / "Prerequisites" / "Next step" boilerplate; frontmatter `description:` already carries triggering. | Should |
| FR7 | Each pointer from a SKILL.md to a reference file states the triggering condition explicitly and follows the uniform pointer grammar defined in AC7. | Must |
| FR8 | Per-skill reference-file count ≤ 5; reference files > 300 lines include a TOC in the first 30 lines. | Should |
| FR9 | Version bump to 1.53.0 (minor) with CHANGELOG entry naming the refactor pattern and line-count reductions per skill. Update both `plugins/nmg-sdlc/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`. | Must |
| FR10 | Roll out in 4 PRs: (1) additive shared references, (2) `draft-issue` pilot, (3) `write-spec` + `onboard-project` + `upgrade-project`, (4) remainder. | Could |
| FR11 | Ship a permanent content-inventory audit script under `scripts/` (supporting AC6) that runs locally and in CI on every PR touching SKILL.md. Commit a baseline inventory file with this refactor; re-baseline only on intentional content removals documented in the PR body. | Must |
| FR12 | Update `steering/structure.md` to document the new `references/` layer (plugin-shared + per-skill) in the layer-architecture diagram. | Should |
| FR13 | Update `README.md` only if the refactor changes how users interact with the plugin; if interaction surface is unchanged (per AC4/AC5), no README update is required. | Must |
| FR14 | Add `.github/workflows/claude-review.yml` invoking `anthropics/claude-code-action@v1` on `pull_request` (`opened`, `synchronize`) and on `issue_comment` events containing `@claude`. The job must exit non-zero when Claude requests changes, and must be configured as a required status check on `main`. Ship in PR 1 so every subsequent refactor PR is gated on a passing Claude review. | Must |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Every refactored SKILL.md triggers against `skill-creator`-style descriptions no slower than the pre-refactor baseline; body-size reduction should improve triggering latency but must not regress it. |
| **Reliability** | The plugin loads without errors on Claude Code versions currently in the plugin's supported range. Missing reference files referenced from a SKILL.md must fail loudly (not silently skip). |
| **Maintainability** | Duplication across SKILL.md bodies is eliminated for the six shared references. Future edits to shared content touch exactly one file. |
| **Observability** | The content-inventory audit script prints a diff of inventory items → destinations so reviewers can see coverage at a glance. |
| **Platforms** | No new platform assumptions. Reference files are plain Markdown; audit script follows `tech.md` conventions (Node built-ins or POSIX shell only). |

---

## Dependencies

### Internal Dependencies
- [x] Existing `verify-code` `checklists/` + `references/` layout (precedent)
- [x] Existing steering documents (`steering/structure.md` will be updated per FR12)

### External Dependencies
- None. Refactor is entirely plugin-internal.

### Blocked By
- None.

---

## Out of Scope

- No new skills.
- No changes to `scripts/sdlc-runner.mjs` or any runner behavior.
- No changes to `.claude/unattended-mode` semantics.
- No changes to skill frontmatter (`model`, `effort`, `allowed-tools`, `description`, `argument-hint`).
- No slash-command renames, additions, or removals.
- No changes to retrospective semantics or the `architecture-reviewer` agent.
- No migration tooling for user projects — this is entirely plugin-internal.
- No changes to existing templates under `plugins/nmg-sdlc/skills/*/templates/` beyond moving content between a skill's SKILL.md and its `references/`.

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Total SKILL.md line count | ≥ 50% reduction plugin-wide | Sum of `wc -l plugins/nmg-sdlc/skills/*/SKILL.md` before vs after |
| Per-skill targets met | 9 of 9 skills at or below their AC1 line target | Post-refactor `wc -l` audit |
| Content-inventory coverage | 100% of inventory items mapped | Audit script exit code + printed diff |
| Shared-content duplication | Zero duplication of the 6 shared blocks | `grep -r` for characteristic phrases in each block |
| Exercise-test pass rate | 100% of refactored skills pass exercise tests | `/verify-code` exercise outputs match pre-refactor baseline |

---

## Open Questions

- [x] ~~Is the content-inventory audit script one-shot or permanent?~~ **Resolved 2026-04-19: permanent.** Codified in FR11.
- [x] ~~Does FR5 apply to the legacy-layout gate's exact `ERROR:` string?~~ **Resolved 2026-04-19: yes, reword freely.** No downstream parser depends on it outside the SDLC itself. Codified in FR5.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #138 | 2026-04-19 | Initial feature spec |
| #145 | 2026-04-19 | Phase 1 child — additive infrastructure (shared `references/`, audit script + CI, Claude review workflow); no SKILL.md edits. Maps to tasks T001–T008 and covers AC3/AC6/AC10 + FR1/FR5/FR11/FR14. |
| #145 | 2026-04-19 | Promoted the Claude-review workflow from advisory to required-pass gate. Added AC11 and tightened FR14 and AC10 accordingly — the workflow must exit non-zero on REQUEST_CHANGES and be declared a required status check on `main`. |
| #146 | 2026-04-19 | Phase 2 child — scope is the `draft-issue` pilot (AC1 line target for one skill, AC2 exercise-test parity, AC5 frontmatter byte-identity, AC6 audit-clean-after-baseline-regen, AC7 pointer grammar, FR2/FR7/FR8). Maps to tasks T009–T012. No new ACs or FRs — child ACs narrow umbrella ACs to the draft-issue file only. |

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements (AC6 references "audit script" as a capability, not a specific implementation)
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases and error states are specified (AC9 covers semantic drift; NFR-Reliability covers missing-reference failure)
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented
