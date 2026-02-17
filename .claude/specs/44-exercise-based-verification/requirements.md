# Requirements: Exercise-Based Verification for Plugin Projects

**Issue**: #44
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude (from issue by rnunley-nmg)

---

## User Story

**As a** developer working on the nmg-sdlc plugin
**I want** `/verifying-specs` to exercise changed skills in Claude Code against a test project
**So that** skill changes are verified by actual invocation, not just static analysis of Markdown

---

## Background

The nmg-sdlc plugin is a Claude Code plugin where skills are Markdown instructions (SKILL.md files), not executable code. Traditional test coverage checks — verifying `.feature` files and step definitions exist — are insufficient for plugin projects. The only way to truly verify a skill change is to load the plugin and invoke the skill against a real project.

The steering docs (`tech.md`) already define the exercise-based verification strategy, test project scaffolding pattern, and dry-run evaluation approach, but `/verifying-specs` doesn't yet act on this guidance automatically. Skills that use `AskUserQuestion` require the Claude Agent SDK `canUseTool` callback (or Promptfoo's declarative wrapper) to test interactively; `claude -p` with `--disallowedTools AskUserQuestion` serves as a simpler fallback.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Detect Plugin Changes

**Given** `/verifying-specs` is running and has loaded the spec and diff
**When** the changed files include SKILL.md files or agent definition `.md` files
**Then** the skill flags the change as a "plugin change" requiring exercise-based verification

**Example**:
- Given: Diff includes `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md`
- When: Step 5 begins plugin-change detection
- Then: A flag is set indicating exercise-based verification is needed

### AC2: Scaffold Disposable Test Project

**Given** a plugin change has been detected
**When** Step 5 (Verify Test Coverage) executes
**Then** a minimal test project is created in the OS temp directory with:
- `.claude/steering/` containing minimal `product.md`, `tech.md`, `structure.md`
- A basic source file, `README.md`, and `.gitignore`
- An initialized git repo (`git init` + initial commit)

**Example**:
- Given: Plugin change detected for `writing-specs` skill
- When: Test project scaffolding runs
- Then: `/tmp/nmg-sdlc-test-{timestamp}/` exists with steering docs, `src/index.js`, `README.md`, `.gitignore`, and a git history with one commit

### AC3: Exercise Changed Skill via Agent SDK

**Given** a test project has been scaffolded
**When** the changed skill is exercised
**Then** the skill is invoked using the Claude Agent SDK with:
- `plugins: [{ type: "local", path: "./plugins/nmg-sdlc" }]`
- `workingDirectory` set to the test project path
- A `canUseTool` callback that intercepts `AskUserQuestion` and auto-selects the first option (deterministic)
- Captured output available for evaluation

**Example**:
- Given: Test project at `/tmp/nmg-sdlc-test-1234/`
- When: `writing-specs` skill is exercised via Agent SDK
- Then: All `AskUserQuestion` calls receive the first option; output messages are captured for evaluation

### AC4: Fallback to `claude -p` When Agent SDK Unavailable

**Given** the Claude Agent SDK is not available (not installed or import fails)
**When** exercise testing attempts to run
**Then** the skill falls back to `claude -p` with `--disallowedTools AskUserQuestion --append-system-prompt "Make reasonable default choices."` and notes that only the non-interactive path was tested

**Example**:
- Given: `@anthropic-ai/claude-agent-sdk` cannot be imported
- When: Exercise step runs
- Then: `claude -p` subprocess is used; verification report notes the fallback method

### AC5: Dry-Run Evaluation for GitHub-Integrated Skills

**Given** the changed skill creates GitHub resources (issues, PRs, status updates)
**When** exercise testing runs
**Then** the skill generates the content that WOULD be created (title, body, labels, commands) without creating real GitHub artifacts, and evaluates this content against the spec's acceptance criteria

**Example**:
- Given: `creating-issues` skill is being exercised
- When: The skill would normally run `gh issue create`
- Then: The generated issue title, body, and labels are captured and evaluated against ACs without the actual GitHub API call

### AC6: Evaluate Output Against Acceptance Criteria

**Given** exercise output has been captured (Agent SDK messages or subprocess stdout)
**When** evaluation runs
**Then** each AC from `requirements.md` is checked against the exercise output, marked Pass/Fail/Partial with evidence

**Example**:
- Given: Exercise of `writing-specs` produced output including file creation messages
- When: AC evaluation runs
- Then: Each AC gets a verdict: "AC1: Pass — requirements.md created at expected path" / "AC2: Fail — design.md missing"

### AC7: Report Template Includes Exercise Results

**Given** exercise-based verification was performed
**When** the verification report is generated (Step 7)
**Then** the report includes an "Exercise Test Results" section documenting:
- Which skill was exercised
- Test project configuration
- Exercise method used (Agent SDK with `canUseTool` / `claude -p` fallback)
- AskUserQuestion handling (programmatic answers provided / questions denied)
- Captured output summary
- AC evaluation results (pass/fail per criterion)

### AC8: Cleanup After Verification

**Given** exercise testing has completed (pass or fail)
**When** Step 5 finishes
**Then** the disposable test project directory is deleted

**Example**:
- Given: Exercise testing completed for `/tmp/nmg-sdlc-test-1234/`
- When: Step 5 cleanup runs
- Then: The directory no longer exists

### AC9: Graceful Degradation

**Given** exercise testing cannot run (e.g., Agent SDK not installed, `claude` CLI not available, timeout, permissions)
**When** the exercise step fails
**Then** the verification report notes that exercise testing was skipped with the reason, and recommends manual exercise testing as a follow-up

**Example**:
- Given: `claude` CLI is not on PATH
- When: Exercise step attempts to spawn a session
- Then: Report includes "Exercise testing skipped: claude CLI not found. Recommend manual exercise testing."

### AC10: Non-Plugin Projects Unchanged

**Given** `/verifying-specs` is running in a non-plugin project (no SKILL.md or agent definition files in the diff)
**When** Step 5 (Verify Test Coverage) executes
**Then** the existing BDD test coverage verification behavior runs unchanged — checking `.feature` files, Gherkin scenarios, step definitions, and executing the test command from `tech.md`

### Generated Gherkin Preview

```gherkin
Feature: Exercise-Based Verification for Plugin Projects
  As a developer working on the nmg-sdlc plugin
  I want /verifying-specs to exercise changed skills against a test project
  So that skill changes are verified by actual invocation

  Scenario: Detect plugin changes in diff
    Given /verifying-specs is running and has loaded the spec and diff
    When the changed files include SKILL.md or agent definition files
    Then the skill flags the change as a plugin change requiring exercise-based verification

  Scenario: Scaffold disposable test project
    Given a plugin change has been detected
    When Step 5 executes
    Then a minimal test project is created in the OS temp directory
    And it contains steering docs, source files, and an initialized git repo

  Scenario: Exercise changed skill via Agent SDK
    Given a test project has been scaffolded
    When the changed skill is exercised
    Then it is invoked via the Agent SDK with canUseTool callback
    And AskUserQuestion calls receive programmatic first-option answers
    And output is captured for evaluation

  Scenario: Fallback to claude -p when Agent SDK unavailable
    Given the Agent SDK is not available
    When exercise testing attempts to run
    Then claude -p is used with --disallowedTools AskUserQuestion
    And the report notes that only the non-interactive path was tested

  Scenario: Dry-run evaluation for GitHub-integrated skills
    Given the changed skill creates GitHub resources
    When exercise testing runs
    Then content is generated without creating real artifacts
    And the content is evaluated against acceptance criteria

  Scenario: Evaluate output against acceptance criteria
    Given exercise output has been captured
    When evaluation runs
    Then each AC is checked and marked Pass/Fail/Partial with evidence

  Scenario: Report includes exercise results
    Given exercise-based verification was performed
    When the verification report is generated
    Then it includes an Exercise Test Results section with method, output, and AC results

  Scenario: Cleanup after verification
    Given exercise testing has completed
    When Step 5 finishes
    Then the disposable test project directory is deleted

  Scenario: Graceful degradation when exercise testing fails
    Given exercise testing cannot run
    When the exercise step fails
    Then the report notes exercise testing was skipped with the reason

  Scenario: Non-plugin projects unchanged
    Given no SKILL.md or agent files are in the diff
    When Step 5 executes
    Then the existing BDD test coverage verification runs unchanged
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Detect SKILL.md and agent `.md` changes in the diff | Must | Pattern: `plugins/*/skills/*/SKILL.md` or `plugins/*/agents/*.md` |
| FR2 | Scaffold minimal test project per `structure.md` → Test Project Scaffolding | Must | In OS temp dir, deleted after use |
| FR3 | Invoke changed skill via Agent SDK `canUseTool` callback with programmatic `AskUserQuestion` answers | Must | Auto-select first option for deterministic testing |
| FR4 | Dry-run evaluation for GitHub-integrated skills (no real artifact creation) | Must | Generate content that WOULD be created; evaluate against ACs |
| FR5 | Evaluate exercise output against spec ACs | Must | Pass/Fail/Partial per AC with evidence |
| FR6 | Add "Exercise Test Results" section to report template | Must | Documents method, output, and AC evaluation |
| FR7 | Clean up test project on completion | Must | Delete temp dir regardless of pass/fail |
| FR8 | Existing Step 5 behavior preserved when no plugin changes detected | Must | Non-plugin projects use standard BDD verification |
| FR9 | Fallback to `claude -p` with `--disallowedTools AskUserQuestion` when Agent SDK unavailable | Should | Note fallback in report |
| FR10 | Graceful degradation when exercise testing is infeasible | Should | Report skipped with reason + manual follow-up recommendation |
| FR11 | Auto-mode support (non-interactive exercise, suppress verbose output) | Should | Consistent with existing auto-mode pattern |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Exercise testing adds acceptable time to verification (bounded by Agent SDK/subprocess timeout) |
| **Security** | No secrets stored in test project scaffolding; no real GitHub artifacts created during dry-run |
| **Reliability** | Graceful degradation when prerequisites unavailable; cleanup always runs |
| **Platforms** | Test project scaffolding uses OS temp dir (cross-platform); no hardcoded path separators |

---

## Dependencies

### Internal Dependencies
- [x] Steering docs define exercise-based verification strategy (`tech.md` → Testing Standards)
- [x] Test project scaffolding layout defined (`structure.md` → Test Project Scaffolding)
- [x] Existing `/verifying-specs` skill with Step 5 test coverage verification
- [x] OpenClaw runner's `claude -p` subprocess pattern (`sdlc-runner.mjs`) as reference

### External Dependencies
- [ ] Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) — for full interactive testing (optional; fallback exists)
- [x] `claude` CLI — for `claude -p` fallback
- [x] `gh` CLI — for dry-run evaluation of GitHub-integrated skills

### Blocked By
- None — steering docs already updated, this implements what they describe

---

## Out of Scope

- Creating a persistent test GitHub repository for exercise testing
- Changes to any skill other than `/verifying-specs` and its report template
- Changes to the architecture-reviewer agent or its checklists
- Automating exercise testing in CI/CD pipelines (future: Promptfoo integration)
- Exercise testing for template-only changes (templates are verified via static analysis)
- Promptfoo eval suite setup (separate future enhancement)
- Multi-skill exercise testing in a single verification run (one changed skill per exercise)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Plugin change detection accuracy | 100% of SKILL.md/agent changes detected | No false negatives in diff scanning |
| Exercise completion rate | Exercise runs to completion when prerequisites are met | No unhandled errors during scaffolding, invocation, or evaluation |
| Graceful degradation | 100% of failure modes produce a clear report entry | All known failure scenarios (no CLI, no SDK, timeout) handled |
| Existing behavior preservation | Zero regressions in non-plugin project verification | Standard BDD verification unchanged for non-plugin diffs |

---

## Open Questions

- [x] Agent SDK vs `claude -p` priority — resolved: Agent SDK is primary, `claude -p` is fallback
- [x] Test project scaffolding location — resolved: OS temp dir per `structure.md`
- [ ] Budget cap for Agent SDK exercise sessions — should there be a `max_budget_usd` limit?
- [ ] Timeout for exercise testing — what is a reasonable upper bound before declaring failure?

---

## Validation Checklist

Before moving to PLAN phase:

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases and error states are specified (AC4, AC8, AC9, AC10)
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented
