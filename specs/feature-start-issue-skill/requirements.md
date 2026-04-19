# Requirements: Starting Issues Skill

**Issues**: #10, #89, #127
**Date**: 2026-04-18
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As a** developer ready to begin work on a feature,
**I want** a skill that lets me select a GitHub issue, creates a linked feature branch, and sets the issue to In Progress,
**So that** I can start development with proper branch hygiene and issue tracking without manual setup.

---

## Background

The `/start-issue` skill was extracted from the earlier `/beginning-dev` skill to provide standalone issue selection and branch setup. It lists open GitHub issues, lets the developer select one (or accepts an issue number argument in unattended-mode), creates a feature branch linked to the issue via `gh issue develop`, and updates the issue status to "In Progress" in any associated GitHub Project. In unattended mode, issues are sorted by number ascending (oldest first) and selected automatically without user confirmation.

Issue #127 extends the skill to be dependency-aware: it reads the sub-issue / "Depends on" wiring produced by `/draft-issue` (Issues #124, #125) and filters out blocked issues, ordering the remaining candidates topologically so parents always appear before their children.

---

## Acceptance Criteria

### AC1: Issue Selection Presents Open Issues

**Given** I invoke `/start-issue` in interactive mode
**When** the skill starts
**Then** it lists open GitHub issues for me to select from

### AC2: Feature Branch Is Created and Linked

**Given** I select a GitHub issue
**When** branch setup completes
**Then** a feature branch is created and linked to the issue via `gh issue develop`

### AC3: Issue Status Is Updated

**Given** a feature branch is created
**When** the issue is linked
**Then** the issue status is set to "In Progress" in any associated GitHub Project

### AC4: Unattended Mode Auto-Selects Oldest Issue

**Given** unattended mode is active
**When** `/start-issue` runs
**Then** it selects the oldest open issue (lowest number) without user confirmation

### AC5: Issue Number Can Be Provided as Argument

**Given** I invoke `/start-issue` with an issue number
**When** the skill runs
**Then** it skips issue selection and uses the provided issue number directly

### AC6: Diagnostic Context in Zero-Result Auto-Mode Output

**Given** `/start-issue` finds zero automatable issues in unattended-mode
**When** the result is returned
**Then** it additionally queries the total open issue count (without the `automatable` label filter, in the same milestone scope)
**And** includes it in the output (e.g., "No automatable issues found (N open issues exist without the automatable label)")

### AC7: Suggestion When Open Issues Exist Without Label

**Given** total open issues > 0 but automatable issues = 0
**When** the zero-result diagnostic output is returned
**Then** the output suggests checking label assignment as a potential cause (e.g., "Consider adding the `automatable` label to issues that should be picked up automatically.")

### AC8: No Misleading Suggestion When No Open Issues Exist

**Given** total open issues = 0 and automatable issues = 0
**When** the zero-result diagnostic output is returned
**Then** the output indicates no work is available without suggesting label checks (e.g., "No automatable issues found. 0 open issues in scope.")

### AC9: Blocked Issues Are Filtered From Selection

**Given** an issue whose declared dependencies (via sub-issue parent link or "Depends on" body cross-ref) include any issue in `open` state
**When** `/start-issue` builds its selection list (interactive or unattended)
**Then** the blocked issue is omitted from the list entirely

### AC10: Unblocked Issues Are Topologically Ordered

**Given** the set of unblocked issues for the current scope
**When** the selection list is rendered
**Then** issues are ordered topologically so that parents appear before their descendants
**And** ties (siblings at the same DAG level) break by issue number ascending to preserve current predictability

### AC11: Cycles Are Detected and Handled Gracefully

**Given** a cycle exists in the dependency graph among the candidate issues
**When** topological ordering runs
**Then** the cycle is logged as a warning with the cycle participants
**And** the affected issues are placed at the end of the list in issue-number order
**And** the run does not abort

### AC12: Unattended Mode Honors Blocked-Filter

**Given** unattended mode is active
**When** `/start-issue` auto-selects the next issue
**Then** it picks the first unblocked `automatable` issue in topological order
**And** never selects a blocked issue, even if that issue has the lowest number

### AC13: Session Note Reports Filtered Count

**Given** `/start-issue` has filtered zero or more blocked issues from the candidate set
**When** the selection list is emitted (or auto-selection completes)
**Then** a one-line session note reports how many issues were filtered as blocked (e.g., "Filtered 3 blocked issues from selection")

### AC14: Dependencies Are Read From Both Wiring Formats

**Given** an issue whose parents are declared via GitHub native sub-issue / tracked-by relationships
**Or** via `Depends on: #X` / `Blocks: #Y` body cross-refs
**When** dependency resolution runs
**Then** both wiring formats are parsed and merged into the same dependency graph

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | List open GitHub issues for interactive selection | Must | Via AskUserQuestion |
| FR2 | Feature branch creation linked via `gh issue develop` | Must | Creates and checks out branch |
| FR3 | Issue status update to "In Progress" in GitHub Projects | Must | Via GraphQL API |
| FR4 | Automation mode with oldest-first issue selection | Must | `.claude/unattended-mode` check |
| FR5 | Direct issue number argument support | Must | Skips selection steps |
| FR6 | Query total open issue count (same scope, without label filter) when automatable count is zero in unattended-mode | Must | Second `gh issue list` without `--label` |
| FR7 | Include total open issue count in zero-result diagnostic output | Must | Enhances the "No automatable issues found" message |
| FR8 | Suggest checking label assignment when open issues > 0 but automatable = 0 | Should | Actionable guidance for operators |
| FR9 | Parse dependency relationships from GitHub native sub-issue / tracked-by links | Must | Via `gh issue view --json parent,subIssues` or equivalent GraphQL |
| FR10 | Parse dependency relationships from body cross-refs: `Depends on: #X` and `Blocks: #Y` | Must | Merge with native-link graph |
| FR11 | Filter out any issue whose dependencies include an open issue | Must | Applies to both interactive and unattended modes |
| FR12 | Topologically order the remaining issues; break ties by issue number ascending | Must | Parents before descendants |
| FR13 | Detect cycles; log a warning and place cycle members at the end in issue-number order without aborting | Must | Graceful degradation |
| FR14 | Emit a one-line session note reporting the count of filtered blocked issues | Should | Observability |
| FR15 | Apply the same filter + order in unattended-mode (selects the first unblocked `automatable` issue in topological order) | Must | AC12 compliance |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Dependency resolution must complete within ~2 seconds for milestones up to 50 issues; prefer a single GraphQL batch query over per-issue `gh issue view` calls where practical |
| **Security** | Uses authenticated `gh` CLI for all GitHub operations |
| **Reliability** | Graceful skip if issue is not in any GitHub Project; graceful degradation on cycle detection |

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
- [x] Plugin scaffold (#2)
- [x] Dependency wiring in `/draft-issue` (#124, #125) — required for any dependency data to exist

### External Dependencies
- [x] `gh` CLI for issue listing, branch creation, GraphQL API
- [x] GitHub Projects v2 API for status updates
- [x] GitHub sub-issue / tracked-by relationship API (preview feature exposed via `gh api graphql`)

---

## Out of Scope

- Issue assignment to specific developers
- Branch naming customization beyond the default `gh issue develop` format
- Multi-issue selection for batch work
- Automatically applying the `automatable` label to issues
- Changing how the `automatable` label is managed by `/draft-issue`
- Adding resilience for other label types
- Creating, editing, or inferring dependency relationships — owned by `/draft-issue` (#124, #125); `/start-issue` only reads existing wiring
- Resolving cycles automatically — graceful degradation only
- Cross-repository dependency resolution — single-repo scope

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
| #10 | 2026-02-15 | Initial feature spec |
| #89 | 2026-02-25 | Add diagnostics for zero automatable issues in unattended-mode: open issue count, label suggestion |
| #127 | 2026-04-18 | Filter blocked issues and topologically order selection; read sub-issue and body-cross-ref dependency wiring; graceful cycle handling; apply to unattended mode |

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Dependencies are identified
- [x] Out of scope is defined
