# Requirements: Automation Mode Support

**Issues**: #11, #71
**Date**: 2026-02-22
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As an** automation platform operator,
**I want** all SDLC skills to detect a headless mode flag and bypass interactive prompts,
**So that** the full SDLC workflow can be driven by external agents without human intervention.

---

## Background

Automation mode enables external agents (like OpenClaw) to drive the entire SDLC cycle without human input. When `.claude/auto-mode` exists, skills skip all interactive prompts: `AskUserQuestion` calls, `EnterPlanMode` requests, and human review gates. This was developed iteratively — initial attempts used hook-level blocks (PermissionRequest auto-allow, PreToolUse blocks on AskUserQuestion and EnterPlanMode, Stop hook continuation), but these caused infinite retry loops because Claude interprets a blocked tool as "I need this but couldn't get it" and retries endlessly. The final solution moved automation awareness into the skills themselves, where each skill checks for `.claude/auto-mode` and conditionally skips interactive steps.

---

## Acceptance Criteria

### AC1: Auto-Mode Flag Enables Headless Operation

**Given** `.claude/auto-mode` exists in the project
**When** any SDLC skill is invoked
**Then** it operates without interactive prompts or human review gates

### AC2: Writing-Specs Skips Human Review Gates

**Given** automation mode is active
**When** `/writing-specs` runs
**Then** all 3 human review gates between phases are skipped automatically

### AC3: Implementing-Specs Skips Plan Mode

**Given** automation mode is active
**When** `/implementing-specs` runs
**Then** plan mode is skipped and implementation proceeds without approval

### AC4: Creating-Issues Infers Criteria

**Given** automation mode is active
**When** `/creating-issues` is invoked with a feature description
**Then** it skips the interview and generates acceptance criteria from steering docs

### AC5: Starting-Issues Auto-Selects Oldest

**Given** automation mode is active
**When** `/starting-issues` runs without an issue number argument
**Then** it selects the oldest open issue automatically

### AC6: Skills Suppress Next-Step Suggestions

**Given** automation mode is active
**When** any skill completes
**Then** next-step suggestions are suppressed to prevent unintended skill chaining

### AC7: Creating-Issues — Interactive Automatable Question

**Given** a user is running `/creating-issues` in interactive mode (no `.claude/auto-mode`)
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

**Given** `/creating-issues` is running in auto-mode (`.claude/auto-mode` exists)
**When** the issue is created
**Then** the `automatable` label is added automatically without prompting

### AC11: Starting-Issues — Auto-Mode Filters by Automatable Label

**Given** `/starting-issues` is running in auto-mode
**When** it fetches issues from the milestone
**Then** only issues with the `automatable` label are eligible for selection (via `--label automatable` filter on `gh issue list`)

### AC12: Starting-Issues — Non-Automatable Issues Invisible to Runner

**Given** an open issue exists in the milestone WITHOUT the `automatable` label
**When** `/starting-issues` runs in auto-mode
**Then** the issue is not presented as a candidate and is skipped entirely

### AC13: Starting-Issues — Auto-Mode Empty Set When No Automatable Issues

**Given** `/starting-issues` is running in auto-mode
**And** open issues exist in the milestone but none have the `automatable` label
**When** the filtered issue list is retrieved
**Then** the skill reports no eligible issues and exits gracefully (does not fall back to selecting non-automatable issues)

### AC14: Starting-Issues — Interactive Mode Shows Automatable Indicator

**Given** `/starting-issues` is running in interactive mode
**When** issues are presented for selection
**Then** each issue's description includes whether it has the `automatable` label (informational only, no filtering applied)

### AC15: Automatable Label Auto-Created If Missing

**Given** the `automatable` label does not yet exist in the GitHub repository
**When** `/creating-issues` attempts to apply it
**Then** the label is created automatically via `gh label create "automatable" --description "Suitable for automated SDLC processing" --color "0E8A16"`

### AC16: Automatable Label Creation Verified

**Given** `/creating-issues` has attempted to create and apply the `automatable` label
**When** the issue creation completes
**Then** the skill verifies the label is present on the created issue (postcondition check via `gh issue view` confirming the label exists, not just that the create command succeeded)

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | `.claude/auto-mode` flag file detection in all SDLC skills | Must | Simple file existence check |
| FR2 | Skip `AskUserQuestion` calls in auto-mode | Must | Prevents interactive prompts |
| FR3 | Skip `EnterPlanMode` calls in auto-mode | Must | Prevents plan approval gates |
| FR4 | Skip human review gates in `/writing-specs` | Must | All 3 phase gates |
| FR5 | Auto-select issue in `/starting-issues` | Must | Oldest-first |
| FR6 | Infer criteria in `/creating-issues` | Must | From steering docs |
| FR7 | Suppress next-step suggestions in all skills | Must | Outputs "Done. Awaiting orchestrator." |
| FR8 | `/creating-issues` asks "Is this issue suitable for automation?" during the interview in interactive mode | Must | Added as part of the interview flow |
| FR9 | The `automatable` label is applied to GitHub issues when the user answers yes or when in auto-mode | Must | Applied alongside the type label |
| FR10 | `/starting-issues` in auto-mode filters `gh issue list` to only include issues with the `automatable` label | Must | Uses `--label automatable` flag |
| FR11 | `/starting-issues` in interactive mode shows the automatable status as an indicator in the issue list | Should | Informational only, no filtering |
| FR12 | The `automatable` label is auto-created via `gh label create` if it doesn't exist in the repo | Must | Color `0E8A16` (green) |
| FR13 | `/starting-issues` in auto-mode exits gracefully when no automatable issues exist | Must | Reports empty set, no fallback to unlabeled issues |
| FR14 | `sdlc-runner.mjs` does not need changes — filtering happens at the `/starting-issues` skill level | Must | Runner script unchanged |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Auto-mode check is a single file existence test |
| **Security** | Auto-mode file must be created locally (no remote activation) |
| **Reliability** | All-or-nothing: auto-mode affects all skills uniformly |

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
- [x] All SDLC skills (#3-#8, #10) for auto-mode integration

### External Dependencies
- [x] Claude Code file system access for `.claude/auto-mode` check

---

## Out of Scope

- Remote auto-mode activation (must be set locally via flag file)
- Partial automation (all-or-nothing per session)
- Custom automation profiles with per-skill overrides
- Retroactively labeling existing issues as automatable
- Adding automation-difficulty tiers (e.g., "simple automation" vs "complex automation")
- Modifying `sdlc-runner.mjs` — filtering is handled entirely at the `/starting-issues` skill level
- Modifying `/writing-specs`, `/implementing-specs`, or other downstream skills

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
| #71 | 2026-02-22 | Add automatable label gate: question in `/creating-issues`, label filtering in `/starting-issues` auto-mode, label auto-creation, empty-set handling |

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Dependencies are identified
- [x] Out of scope is defined
