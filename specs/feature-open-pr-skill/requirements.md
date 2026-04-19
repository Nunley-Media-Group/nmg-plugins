# Requirements: Creating PRs Skill

**Issues**: #8, #128
**Date**: 2026-04-18
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As a** developer ready to merge a verified feature,
**I want** a skill that creates a pull request with a summary automatically derived from my specs and verification results, and optionally stays with me to monitor CI and merge once green,
**So that** PR reviewers get full context linking the issue, specs, and implementation evidence without manual write-up, and I get the same hands-off ship experience the unattended runner already provides.

---

## Background

The `/open-pr` skill creates a GitHub pull request using `gh pr create` with a body that references the originating GitHub issue, links to the spec files in `specs/{feature-name}/`, and summarizes the implementation based on the tasks spec and verification report. The PR title and body are structured to give reviewers immediate context about what was built and why. In unattended mode, the skill outputs a completion signal for the orchestrator instead of suggesting next steps.

Issue #128 extends the interactive branch so the skill can optionally monitor CI and auto-merge after the PR is created. The unattended path (driven by `scripts/sdlc-runner.mjs`) already polls `gh pr checks` and runs `gh pr merge`; this enhancement closes the parity gap so interactive users who opt in get the same hands-off result. The unattended branch is unchanged — the runner retains ownership of CI monitoring and merging when the sentinel file is present.

---

## Acceptance Criteria

### AC1: PR Links to Originating Issue

**Given** I invoke `/open-pr` after verification
**When** the PR is created
**Then** the PR body contains a reference to the originating GitHub issue (e.g., `Closes #N`)

### AC2: PR References Spec Files

**Given** specs exist in `specs/{feature-name}/`
**When** the PR is created
**Then** the PR body links to the requirements, design, and tasks spec files

### AC3: PR Summary Reflects Implementation

**Given** the implementation and verification are complete
**When** the PR body is generated
**Then** it summarizes what was built, key decisions, and verification status

### AC4: Unattended Mode Outputs Completion Signal

**Given** unattended mode is active
**When** the PR is created
**Then** the skill outputs `Done. Awaiting orchestrator.` instead of suggesting next steps

### AC5: Interactive CI Monitor Opt-In — Happy Path

**Given** `/open-pr` has created a PR in interactive mode (the `.claude/unattended-mode` sentinel does NOT exist)
**When** the skill prompts the user and the user selects "Yes, monitor CI and auto-merge"
**Then** the skill polls PR checks until all required checks complete, squash-merges the PR via `gh pr merge --squash --delete-branch`, deletes the local feature branch, and returns the user to a clean state on `main`

### AC6: Interactive CI Monitor Opt-Out

**Given** `/open-pr` has created a PR in interactive mode
**When** the skill prompts the user and the user selects "No, I'll handle it"
**Then** the skill exits with the existing Step 6 "Next step: Wait for CI to pass..." output unchanged

### AC7: CI Failure During Monitoring — Report and Stop

**Given** the user opted in to monitoring
**When** any required check concludes in a non-success state (failure, timed_out, cancelled) or the PR is not mergeable
**Then** the skill prints each failing check's name and details URL, does NOT merge, does NOT delete the branch, and exits so the user can investigate

### AC8: Unattended-Mode Parity — No Interactive Prompt

**Given** the `.claude/unattended-mode` sentinel file exists
**When** `/open-pr` completes Step 6
**Then** no CI-monitor prompt is shown and the skill outputs `Done. Awaiting orchestrator.` so the runner retains ownership of CI monitoring and merging

### AC9: Active Suppression Regardless of Opt-In Default

**Given** the `.claude/unattended-mode` sentinel file exists
**When** `/open-pr` completes Step 6
**Then** the new CI-monitor prompt is actively suppressed — the skill MUST NOT attempt `AskUserQuestion`, MUST NOT poll checks, and MUST NOT invoke `gh pr merge`

*Retrospective-derived defensive check (see `steering/retrospective.md` → "Missing Acceptance Criteria" on explicitly excluded automation modes).*

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | PR creation via `gh pr create` with structured body | Must | |
| FR2 | Issue reference in PR body (e.g., `Closes #N`) | Must | Auto-closes issue on merge |
| FR3 | Links to spec files in the PR body | Must | requirements, design, tasks |
| FR4 | Implementation summary derived from specs and verification | Must | |
| FR5 | Automation mode support with completion signal | Must | `Done. Awaiting orchestrator.` |
| FR6 | After PR creation in interactive mode, prompt the user via `AskUserQuestion` with two options: monitor+merge, or skip | Must | Issue #128 |
| FR7 | On opt-in, poll the PR's checks (`gh pr checks <num>`) until all required checks reach a terminal state | Must | Issue #128 — mirror runner semantics |
| FR8 | On all-success, merge the PR with `gh pr merge --squash --delete-branch` and delete the local feature branch, returning to `main` | Must | Issue #128 — squash is hardcoded this iteration |
| FR9 | On any check failure, non-mergeable state, or integration absent (no checks configured), print check name(s) + details URL(s) and exit without merging or deleting the branch | Must | Issue #128 — covers CI failure + "no CI configured" graceful skip |
| FR10 | When `.claude/unattended-mode` exists, actively suppress the new prompt, polling, and merge invocation — preserve current unattended output | Must | Issue #128 |
| FR11 | Use a sensible polling cadence and timeout (30-second interval matching the runner, configurable constants documented in the skill) | Should | Issue #128 |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Single `gh pr create` call; polling uses 30s cadence to avoid rate-limit churn |
| **Security** | Uses authenticated `gh` CLI; no tokens in PR body |
| **Reliability** | Ensures branch is pushed before creating PR; failure path never merges or deletes the branch |
| **Idempotency** | Re-running `/open-pr` on an already-created PR must not double-post or double-merge |

---

## UI/UX Requirements

Reference `structure.md` and `product.md` for project-specific design standards.

| Element | Requirement |
|---------|-------------|
| **Interaction** | Two-option `AskUserQuestion` after PR creation (monitor+merge / skip) |
| **Loading States** | Poll progress output (e.g., "Checks pending: 3/5 complete") during monitoring |
| **Error States** | Failing check names + details URLs printed; terminal state reached, skill exits |
| **Empty States** | "No CI configured — nothing to monitor" message when `gh pr checks` reports no checks |

---

## Data Requirements

### Input Data

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| Issue number | integer | positive | Yes |
| `.claude/unattended-mode` sentinel | file | presence/absence | Yes (controls branch) |
| User selection | enum | {monitor, skip} | Yes (interactive branch only) |

### Output Data

| Field | Type | Description |
|-------|------|-------------|
| PR URL | string | Printed after `gh pr create` |
| Merge status | enum | {merged, failed, skipped} — interactive branch only |

---

## Dependencies

### Internal Dependencies
- [x] Writing specs skill (#5) for spec files to reference
- [x] Implementing specs skill (#6) for code to include
- [x] Verifying specs skill (#7) for verification status

### External Dependencies
- [x] `gh` CLI for PR creation, `gh pr checks`, `gh pr merge`
- [x] Git for branch management (`git branch -D`)

---

## Out of Scope

- Automatic PR review assignment
- Auto-retry or re-queueing of failed CI checks
- A merge-strategy picker (squash/rebase/merge commit) — squash is hardcoded for this iteration
- Post-merge `git checkout main && git pull` step
- Changes to the unattended orchestrator path in `scripts/sdlc-runner.mjs`
- Pre-merge conflict resolution (if the PR is not mergeable, treat it like a failure and stop)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Interactive ship completeness | Developer returns to a clean `main` without manual merge steps when opting in | Exercise test: opt-in path ends on `main` with branch gone |
| Unattended branch untouched | Runner-driven cycles still output `Done. Awaiting orchestrator.` at Step 6 | Dry-run eval of `/open-pr` with sentinel present shows no new prompt |

---

## Open Questions

- [ ] Should the polling timeout surface to config (e.g., steering docs) or stay as a skill-level constant? *(Decision: skill-level constant for this iteration; revisit if runner and skill diverge.)*

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #8 | 2026-02-15 | Initial feature spec |
| #128 | 2026-04-18 | Add interactive opt-in CI monitor + auto-merge path; preserve unattended branch behavior |

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Dependencies are identified
- [x] Out of scope is defined
