# Requirements: Unattended Mode Support

**Issues**: #11, #71, #118
**Date**: 2026-04-16
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As an** automation platform operator,
**I want** all SDLC skills to detect a headless mode flag and bypass interactive prompts,
**So that** the full SDLC workflow can be driven by external agents without human intervention.

---

## Background

Automation mode enables external agents (like the SDLC runner) to drive the entire SDLC cycle without human input. When `.claude/unattended-mode` exists, skills skip all interactive prompts: `AskUserQuestion` calls, `EnterPlanMode` requests, and human review gates. This was developed iteratively — initial attempts used hook-level blocks (PermissionRequest auto-allow, PreToolUse blocks on AskUserQuestion and EnterPlanMode, Stop hook continuation), but these caused infinite retry loops because Claude interprets a blocked tool as "I need this but couldn't get it" and retries endlessly. The final solution moved automation awareness into the skills themselves, where each skill checks for `.claude/unattended-mode` and conditionally skips interactive steps.

---

## Acceptance Criteria

### AC1: Auto-Mode Flag Enables Headless Operation

**Given** `.claude/unattended-mode` exists in the project
**When** any SDLC skill is invoked
**Then** it operates without interactive prompts or human review gates

### AC2: Writing-Specs Skips Human Review Gates

**Given** unattended mode is active
**When** `/write-spec` runs
**Then** all 3 human review gates between phases are skipped automatically

### AC3: Implementing-Specs Skips Plan Mode

**Given** unattended mode is active
**When** `/write-code` runs
**Then** plan mode is skipped and implementation proceeds without approval

### AC4: Creating-Issues Infers Criteria

**Given** unattended mode is active
**When** `/draft-issue` is invoked with a feature description
**Then** it skips the interview and generates acceptance criteria from steering docs

### AC5: Starting-Issues Auto-Selects Oldest

**Given** unattended mode is active
**When** `/start-issue` runs without an issue number argument
**Then** it selects the oldest open issue automatically

### AC6: Skills Suppress Next-Step Suggestions

**Given** unattended mode is active
**When** any skill completes
**Then** next-step suggestions are suppressed to prevent unintended skill chaining

### AC7: Creating-Issues — Interactive Automatable Question

**Given** a user is running `/draft-issue` in interactive mode (no `.claude/unattended-mode`)
**When** the issue draft is being prepared (during the interview phase)
**Then** the user is asked "Is this issue suitable for automation?" with Yes/No options

### AC8: Creating-Issues — Automatable Label Applied When Yes

**Given** the user answers "Yes" to the automatable question
**When** the issue is created in GitHub
**Then** the `automatable` label is added to the issue alongside the type label (e.g., `enhancement,automatable`)

### AC9: Creating-Issues — No Automatable Label When No

**Given** the user answers "No" to the automatable question
**When** the issue is created
**Then** the issue is created with only the type label (no `automatable` label)

### AC10: Creating-Issues — Auto-Mode Defaults to Automatable

**Given** `/draft-issue` is running in unattended-mode (`.claude/unattended-mode` exists)
**When** the issue is created
**Then** the `automatable` label is added automatically without prompting

### AC11: Starting-Issues — Auto-Mode Filters by Automatable Label

**Given** `/start-issue` is running in unattended-mode
**When** it fetches issues from the milestone
**Then** only issues with the `automatable` label are eligible for selection (via `--label automatable` filter on `gh issue list`)

### AC12: Starting-Issues — Non-Automatable Issues Invisible to Runner

**Given** an open issue exists in the milestone WITHOUT the `automatable` label
**When** `/start-issue` runs in unattended-mode
**Then** the issue is not presented as a candidate and is skipped entirely

### AC13: Starting-Issues — Auto-Mode Empty Set When No Automatable Issues

**Given** `/start-issue` is running in unattended-mode
**And** open issues exist in the milestone but none have the `automatable` label
**When** the filtered issue list is retrieved
**Then** the skill reports no eligible issues and exits gracefully (does not fall back to selecting non-automatable issues)

### AC14: Starting-Issues — Interactive Mode Shows Automatable Indicator

**Given** `/start-issue` is running in interactive mode
**When** issues are presented for selection
**Then** each issue's description includes whether it has the `automatable` label (informational only, no filtering applied)

### AC15: Automatable Label Auto-Created If Missing

**Given** the `automatable` label does not yet exist in the GitHub repository
**When** `/draft-issue` attempts to apply it
**Then** the label is created automatically via `gh label create "automatable" --description "Suitable for automated SDLC processing" --color "0E8A16"`

### AC16: Automatable Label Creation Verified

**Given** `/draft-issue` has attempted to create and apply the `automatable` label
**When** the issue creation completes
**Then** the skill verifies the label is present on the created issue (postcondition check via `gh issue view` confirming the label exists, not just that the create command succeeded)

### AC17: Flag File Renamed to `.claude/unattended-mode`

**Given** the SDLC runner starts a cycle
**When** it creates the headless-execution flag
**Then** the file created is `.claude/unattended-mode` (not `.claude/unattended-mode`), and the runner's cleanup step on exit removes `.claude/unattended-mode`

### AC18: Skills Gate on the New Flag Name

**Given** a user invokes any SDLC skill (`draft-issue`, `start-issue`, `write-spec`, `write-code`, `verify-code`, `open-pr`, `run-loop`, `migrate-project`, `run-retro`)
**When** the skill reaches a point that previously checked `.claude/unattended-mode`
**Then** it checks `.claude/unattended-mode` instead, and its documented behavior is unchanged when the flag is present vs. absent

### AC19: Disambiguation from Claude Code's Native Auto Mode

**Given** Claude Code's native "Auto Mode" is active (system-reminder "Unattended mode is active" is present) and `.claude/unattended-mode` does **not** exist
**When** a user invokes a plugin skill with interactive gates (e.g., `/draft-issue`, `/write-spec`)
**Then** the skill runs its interactive gates normally (calls `AskUserQuestion`, enters plan mode, shows review prompts) and does not treat Claude Code's Auto Mode as a substitute for the plugin's unattended-mode flag

### AC20: Documentation Updated with Rename and Disambiguation Note

**Given** a user reads `README.md` or `steering/product.md`
**When** they look for automation-mode documentation
**Then** all references use "unattended-mode" / `.claude/unattended-mode`, and a short note explains the rename was made to disambiguate from Claude Code's native Auto Mode

### AC21: Historical Spec Bodies Rewritten

**Given** historical spec directories reference the old flag (e.g., `feature-automation-mode-support/`, `bug-fix-auto-mode-cleanup-on-exit/`, `bug-fix-sdlc-runner-auto-mode-gitignore/`, `bug-add-auto-mode-support-to-migrate-project-skill/`, `bug-fix-migrate-project-auto-mode/`)
**When** the rename is applied
**Then** the spec bodies reference `unattended-mode` / `.claude/unattended-mode`; directory names may be kept as-is (historical identifiers); git history preserves the original wording

### AC22: CHANGELOG Entry for the Rename

**Given** the change is merged
**When** a user reads `CHANGELOG.md`
**Then** an `[Unreleased]` entry documents the rename, its motivation (collision with Claude Code's native Auto Mode), and migration guidance for users who manually `touch .claude/unattended-mode`

### AC23: Runner Tests Updated

**Given** `scripts/__tests__/sdlc-runner.test.mjs` runs
**When** the suite references the flag path or related strings
**Then** all test expectations use `.claude/unattended-mode` and the suite passes

### AC24: No Regression for Existing Headless Flow

**Given** a user manually creates `.claude/unattended-mode` in a project
**When** they invoke `/write-spec #N` or `/write-code #N`
**Then** the skills behave identically to the pre-rename `.claude/unattended-mode` behavior — headless gates are suppressed, specs/code are generated without interactive prompts

### AC25: Claude Code Auto Mode Alone Does Not Suppress Plugin Gates

**Given** Claude Code's native "Auto Mode" is active (harness has injected its "Auto Mode Active" system-reminder) **and** `.claude/unattended-mode` does **not** exist
**When** a user invokes `/write-spec #N`, `/draft-issue`, `/verify-code #N`, or any other skill with documented human-review gates
**Then** the skill calls `AskUserQuestion` at every gate the spec requires, enters plan mode where specified, and does not suppress interactive review; the only condition that suppresses plugin gates is the presence of `.claude/unattended-mode`

### AC26: Old Flag Name Has No Effect

**Given** a user manually creates `.claude/unattended-mode` in a project after this rename is merged
**When** any SDLC skill or the runner executes
**Then** the old flag is ignored (no gate suppression, no runner recognition); only `.claude/unattended-mode` triggers headless behavior

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | `.claude/unattended-mode` flag file detection in all SDLC skills | Must | Simple file existence check |
| FR2 | Skip `AskUserQuestion` calls in unattended-mode | Must | Prevents interactive prompts |
| FR3 | Skip `EnterPlanMode` calls in unattended-mode | Must | Prevents plan approval gates |
| FR4 | Skip human review gates in `/write-spec` | Must | All 3 phase gates |
| FR5 | Auto-select issue in `/start-issue` | Must | Oldest-first |
| FR6 | Infer criteria in `/draft-issue` | Must | From steering docs |
| FR7 | Suppress next-step suggestions in all skills | Must | Outputs "Done. Awaiting orchestrator." |
| FR8 | `/draft-issue` asks "Is this issue suitable for automation?" during the interview in interactive mode | Must | Added as part of the interview flow |
| FR9 | The `automatable` label is applied to GitHub issues when the user answers yes or when in unattended-mode | Must | Applied alongside the type label |
| FR10 | `/start-issue` in unattended-mode filters `gh issue list` to only include issues with the `automatable` label | Must | Uses `--label automatable` flag |
| FR11 | `/start-issue` in interactive mode shows the automatable status as an indicator in the issue list | Should | Informational only, no filtering |
| FR12 | The `automatable` label is auto-created via `gh label create` if it doesn't exist in the repo | Must | Color `0E8A16` (green) |
| FR13 | `/start-issue` in unattended-mode exits gracefully when no automatable issues exist | Must | Reports empty set, no fallback to unlabeled issues |
| FR14 | `sdlc-runner.mjs` does not need changes — filtering happens at the `/start-issue` skill level | Must | Runner script unchanged |
| FR15 | Rename the flag file path from `.claude/unattended-mode` to `.claude/unattended-mode` everywhere in the codebase | Must | Mechanical rename; no behavior change |
| FR16 | Replace all user-facing and internal prose references to "unattended-mode" / "Unattended-mode" with "unattended-mode" / "Unattended-mode", preserving case conventions | Must | Includes skills, README, steering, CHANGELOG |
| FR17 | Update `scripts/sdlc-runner.mjs`: `RUNNER_ARTIFACTS`, flag creation, flag cleanup, soft-failure patterns, cross-cycle state-reset preservation logic | Must | All literal references — no dynamic strings |
| FR18 | Update all skill files under `plugins/nmg-sdlc/skills/*/SKILL.md` that reference unattended-mode (`draft-issue`, `start-issue`, `write-spec`, `write-code`, `verify-code`, `open-pr`, `run-loop`, `migrate-project`, `run-retro`) | Must | Conditional-logic blocks and prose |
| FR19 | Update `README.md` headless-flag section and `steering/product.md` references | Must | User-facing docs |
| FR20 | Update `scripts/__tests__/sdlc-runner.test.mjs` and any test fixtures that reference the flag path | Must | Tests must pass after rename |
| FR21 | Update `.gitignore`: replace `.claude/unattended-mode` with `.claude/unattended-mode` | Must | Line 11 today |
| FR22 | Rewrite historical `specs/` spec bodies to use the new terminology; directories may retain old names | Must | Git history preserves original wording |
| FR23 | Add `CHANGELOG.md` `[Unreleased]` entry documenting the rename and its motivation (disambiguation from Claude Code's native Auto Mode) | Must | User-facing release notes |
| FR24 | Add a short disambiguation note in `README.md` contrasting the plugin's `unattended-mode` with Claude Code's native Auto Mode | Must | Prevents future conflation |
| FR25 | Bump the plugin version in **both** `plugins/nmg-sdlc/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` | Should | Minor bump recommended (user-facing contract change) |
| FR26 | Include a one-time migration note in the CHANGELOG for users who manually `touch .claude/unattended-mode`: the plugin no longer reads the old name | Should | Migration guidance |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Unattended-mode check is a single file existence test |
| **Security** | Unattended-mode file must be created locally (no remote activation) |
| **Reliability** | All-or-nothing: unattended-mode affects all skills uniformly |

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
- [x] All SDLC skills (#3-#8, #10) for unattended-mode integration

### External Dependencies
- [x] Claude Code file system access for `.claude/unattended-mode` check

---

## Out of Scope

- Remote unattended-mode activation (must be set locally via flag file)
- Partial automation (all-or-nothing per session)
- Custom automation profiles with per-skill overrides
- Retroactively labeling existing issues as automatable
- Adding automation-difficulty tiers (e.g., "simple automation" vs "complex automation")
- Modifying `sdlc-runner.mjs` — filtering is handled entirely at the `/start-issue` skill level (applies to the #71 scope; #118 does update the runner for the rename)
- Modifying `/write-spec`, `/write-code`, or other downstream skills (applies to the #71 scope; #118 does touch all skills for the rename)
- (Issue #118) Changing the behavior of the unattended-mode flag itself — only the name changes
- (Issue #118) Supporting both old and new flag names simultaneously — clean cut; old name is dropped
- (Issue #118) Refactoring which skills check the flag, or how they check it
- (Issue #118) Changes to Claude Code's native Auto Mode behavior (out of this plugin's control)
- (Issue #118) Detecting Claude Code's Auto Mode from within a skill to adjust behavior based on it (the rename alone resolves the confusion)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| [metric] | [target value] | [how to measure] |

---

## Open Questions

- [ ] [Question needing stakeholder input]
- [ ] [Technical question to research]
- [ ] [UX question to validate]

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #11 | 2026-02-15 | Initial feature spec |
| #71 | 2026-02-22 | Add automatable label gate: question in `/draft-issue`, label filtering in `/start-issue` unattended-mode, label auto-creation, empty-set handling |
| #118 | 2026-04-16 | Rename `.claude/unattended-mode` → `.claude/unattended-mode` plugin-wide to disambiguate from Claude Code's native Auto Mode; clean cut (no dual-name support); no behavior change |

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Dependencies are identified
- [x] Out of scope is defined
