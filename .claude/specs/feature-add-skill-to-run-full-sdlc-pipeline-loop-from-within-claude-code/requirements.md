# Requirements: Running SDLC Loop Skill

**Issues**: #107
**Date**: 2026-02-25
**Status**: Draft
**Author**: Claude Code

---

## User Story

**As a** developer using Claude Code
**I want** a single skill that orchestrates the full SDLC pipeline across all automatable issues
**So that** I can drive the same continuous loop that OpenClaw provides, but natively from within a Claude Code session

---

## Background

The nmg-sdlc toolkit provides individual skills for each SDLC phase (`/creating-issues`, `/starting-issues`, `/writing-specs`, `/implementing-specs`, `/verifying-specs`, `/creating-prs`). Today, chaining these into a continuous loop requires either running each skill manually in sequence or setting up OpenClaw, which orchestrates the loop externally via `sdlc-runner.mjs` and `claude -p` subprocesses.

Neither option is accessible from within an active Claude Code session. This skill fills that gap by orchestrating the full pipeline natively — picking automatable issues, running each phase in sequence via the `Skill` tool, and looping until the milestone is clear. It is a parallel capability to the OpenClaw runner, not a replacement.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Loop Mode — Processes All Automatable Issues Sequentially

**Given** I invoke `/nmg-sdlc:running-sdlc-loop` with no arguments and there are open issues labelled `automatable` in the current milestone
**When** the skill executes
**Then** it selects the oldest automatable issue, runs it through the full pipeline (start-issue -> write-specs -> implement-specs -> verify-specs -> create-pr), then loops to the next issue until none remain
**And** upon completing all issues, it outputs a summary listing each issue processed and its final status

**Example**:
- Given: Milestone `v3` has issues #107 (automatable), #108 (automatable), #109 (not automatable)
- When: `/nmg-sdlc:running-sdlc-loop` is invoked
- Then: Issues #107 and #108 are processed in order; #109 is skipped; summary shows both completed

### AC2: Single-Issue Mode — Runs Pipeline for a Specific Issue

**Given** I invoke `/nmg-sdlc:running-sdlc-loop #107`
**When** the skill executes
**Then** it runs only issue #107 through the full pipeline (start-issue -> write-specs -> implement-specs -> verify-specs -> create-pr)
**And** it exits when the PR is created, outputting the PR URL and issue number

**Example**:
- Given: Issue #107 exists and is open
- When: `/nmg-sdlc:running-sdlc-loop #107`
- Then: Pipeline runs for #107 only, outputs "PR created for #107: <url>"

### AC3: No Automatable Issues — Diagnostic Exit

**Given** I invoke `/nmg-sdlc:running-sdlc-loop` with no arguments and no issues are labelled `automatable` in the open milestone
**When** the skill executes
**Then** it outputs a clear diagnostic message ("No automatable issues found in milestone vN") including the milestone name and the count of total open issues (without the `automatable` label) for context
**And** it exits cleanly without error

**Example**:
- Given: Milestone `v3` has 5 open issues, none with `automatable` label
- When: `/nmg-sdlc:running-sdlc-loop`
- Then: Output says "No automatable issues found in milestone v3 (5 open issues exist without the automatable label)"

### AC4: Pipeline Failure — Halts and Reports

**Given** a phase skill (e.g., `/verifying-specs`) reports a failure or exits unexpectedly for the current issue
**When** the failure is detected
**Then** the skill halts the loop, reports the failure with the issue number and failed phase name
**And** it does not proceed to the next issue or the next phase

**Example**:
- Given: Issue #107 is being processed, `/implementing-specs` fails
- When: Failure is detected
- Then: Output says "Pipeline halted: #107 failed at implementing-specs. <error details>"

### AC5: SKILL.md Validated with /doing-skills-right

**Given** the SKILL.md for this new skill has been written
**When** the implementer runs `/doing-skills-right` against it
**Then** all required structural elements (frontmatter, allowed-tools, auto-mode section, integration section) are present and the skill passes the best-practice review

### AC6: State Isolation Between Loop Iterations

**Given** the runner is in loop mode processing multiple issues sequentially
**When** the runner finishes one issue (step 9: merge) and starts the next cycle
**Then** cycle state is reset (currentIssue, currentBranch, featureName, retries)
**And** the runner checks out main and pulls latest before selecting the next issue
**And** the issue number for the next cycle is derived from the branch name after step 2 (ground truth), not from parsing previous output

**Example**:
- Given: Issue #107 merged successfully, runner loops
- When: Step 1 (startCycle) runs for the next cycle
- Then: State is reset, main is checked out, and the next automatable issue is selected fresh

### AC7: Phase Postcondition Verification

**Given** the runner completes a phase step
**When** it evaluates whether to proceed to the next step
**Then** it validates preconditions for the next step (which are effectively postconditions of the current step) before proceeding

**Example preconditions validated by the runner**:
- Before step 4 (implement): spec files exist (requirements.md, design.md, tasks.md, feature.gherkin)
- Before step 5 (verify): commits exist ahead of main on feature branch
- Before step 7 (createPR): branch pushed to remote with no unpushed commits
- Before step 8 (monitorCI): PR exists for current branch
- Before step 9 (merge): CI checks passing

### AC8: Auto-Mode Propagation

**Given** the runner is launched by the skill
**When** the runner starts
**Then** it creates `.claude/auto-mode` automatically (if not already present)
**And** each `claude -p` subprocess detects `.claude/auto-mode` and suppresses interactive prompts
**And** `.claude/auto-mode` is removed when the runner exits

### Generated Gherkin Preview

```gherkin
Feature: Running SDLC Loop
  As a developer using Claude Code
  I want a single skill that orchestrates the full SDLC pipeline
  So that I can drive the same continuous loop natively from within Claude Code

  Scenario: Loop mode processes all automatable issues
    Given open issues labelled "automatable" exist in the current milestone
    When I invoke "/nmg-sdlc:running-sdlc-loop" with no arguments
    Then it processes each automatable issue through the full pipeline sequentially
    And outputs a summary of all processed issues

  Scenario: Single-issue mode runs pipeline for a specific issue
    Given issue #107 exists and is open
    When I invoke "/nmg-sdlc:running-sdlc-loop #107"
    Then it runs only issue #107 through the full pipeline
    And exits when the PR is created

  Scenario: No automatable issues produces diagnostic exit
    Given no issues are labelled "automatable" in the current milestone
    When I invoke "/nmg-sdlc:running-sdlc-loop"
    Then it outputs "No automatable issues found in milestone vN"
    And exits cleanly

  Scenario: Pipeline failure halts and reports
    Given a phase skill fails during processing of an issue
    When the failure is detected
    Then the loop halts and reports the issue number and failed phase
    And does not proceed to the next issue

  Scenario: SKILL.md passes best-practice review
    Given the SKILL.md has been written
    When "/doing-skills-right" is run against it
    Then all structural elements pass validation

  Scenario: State isolation between loop iterations
    Given the skill is processing multiple issues in loop mode
    When it finishes one issue and begins the next
    Then no state from the previous iteration carries over
    And the issue number is re-derived from gh issue list

  Scenario: Phase postcondition verification
    Given a phase skill completes
    When the loop evaluates success
    Then it verifies the phase's expected postcondition artifact or state change

  Scenario: Auto-mode propagation
    Given ".claude/auto-mode" exists
    When the loop invokes phase skills
    Then each phase skill suppresses interactive prompts independently
    And the loop skill itself never calls AskUserQuestion
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Skill accepts optional issue number argument; when omitted, runner loops all automatable issues | Must | Argument via `$ARGUMENTS`; maps to `--issue N` runner flag |
| FR2 | Runner creates `.claude/auto-mode` on startup and removes it on exit; phase skills detect it independently | Must | Runner already does this; no skill-level auto-mode management needed |
| FR3 | Runner selects issues via `gh issue list` (sorted oldest first) in `claude -p` subprocesses | Must | Existing runner behavior; `/starting-issues` auto-mode pattern |
| FR4 | Skill invokes `sdlc-runner.mjs` — the same script OpenClaw uses — with `CLAUDECODE=""` to enable subprocess spawning | Must | Phase sequence handled by runner: startCycle -> startIssue -> writeSpecs -> implement -> verify -> commitPush -> createPR -> monitorCI -> merge |
| FR5 | Runner manages state via `sdlc-state.json` with per-step tracking, retry counts, and cycle detection | Must | Existing runner behavior; no duplicate state management in skill |
| FR6 | On pipeline failure, runner escalates with issue number, failed step, and retry history; in single-issue mode (`--issue`), exits with code 1 | Must | Existing escalation for loop mode; new exit behavior for `--issue` mode |
| FR7 | SKILL.md frontmatter declares all required tools (`allowed-tools`) | Must | Must include Read, Glob, Grep, Bash(node:*), Bash(test:*), Bash(cat:*), Skill |
| FR8 | SKILL.md includes "Integration with SDLC Workflow" section | Must | Shows where the loop skill fits relative to individual phase skills |
| FR9 | Skill is validated with `/doing-skills-right` during implementation | Must | Structural compliance gate |
| FR10 | Runner resets cycle state after step 9 and re-selects issues fresh each cycle (state isolation) | Must | Existing runner behavior via `extractStateFromStep` step 9 reset |
| FR11 | Runner validates preconditions before each step (postconditions of previous step) | Must | Existing runner behavior via `validatePreconditions()` |
| FR12 | Runner `--issue N` flag restricts processing to a single issue and exits after one cycle | Must | New runner enhancement |
| FR13 | Skill locates or generates `sdlc-config.json` before invoking the runner | Must | Invokes `/generating-openclaw-config` if config is missing |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Reliability** | Each loop iteration must be independent — failure in one issue does not corrupt state for diagnosis |
| **Observability** | Task list provides real-time progress visibility; final summary shows all processed issues |
| **Platforms** | POSIX-compatible shell commands only; cross-platform per `tech.md` constraints |
| **Security** | No secrets handled; relies on existing `gh` CLI authentication |

---

## Dependencies

### Internal Dependencies
- [x] `/starting-issues` skill — invoked to create branch and set issue status
- [x] `/writing-specs` skill — invoked to generate spec documents
- [x] `/implementing-specs` skill — invoked to execute implementation
- [x] `/verifying-specs` skill — invoked to verify implementation
- [x] `/creating-prs` skill — invoked to create pull request
- [x] `/doing-skills-right` skill — used to validate SKILL.md during implementation

### External Dependencies
- [x] `gh` CLI — for issue listing, milestone queries
- [x] `git` — for branch state verification

### Blocked By
- None — all dependent skills already exist

---

## Out of Scope

- Discord status notifications (remains OpenClaw's responsibility)
- CI monitoring and auto-merge (handled by OpenClaw)
- Replacing the OpenClaw runner (`sdlc-runner.mjs`) — this is a parallel capability for in-session use
- Creating new issues or assigning milestones (handled by `/creating-issues`)
- Retry logic for failed phases — the skill halts on failure rather than retrying
- Configurable timeouts per phase (the OpenClaw runner handles this; in-session execution has no hard time limits)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Full-loop completion | Processes all automatable issues in a milestone without manual intervention | Invoke in auto-mode against a milestone with 2+ automatable issues |
| Single-issue completion | Produces a PR from a single issue invocation | Invoke with a specific issue number and confirm PR creation |
| Failure isolation | Failure in one phase produces a clear diagnostic without corrupting state | Trigger a failure scenario and verify clean halt |
| Skill validation | SKILL.md passes `/doing-skills-right` review | Run `/doing-skills-right` post-implementation |

---

## Open Questions

- (none — all requirements are clear from the issue and existing patterns)

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #107 | 2026-02-25 | Initial feature spec |

---

## Validation Checklist

Before moving to PLAN phase:

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases and error states are specified (AC3, AC4, AC6)
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented (or resolved)
