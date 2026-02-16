# Defect Report: Detect Soft Failures (error_max_turns) and Add Runner Test Suite

**Issue**: #38
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude (nmg-sdlc)
**Severity**: High
**Related Spec**: `.claude/specs/12-openclaw-sdlc-orchestration/` (defective spec — success check only examines exit code)

---

## Reproduction

### Steps to Reproduce

1. Configure the SDLC runner for a project with open issues (e.g., `chrome-cli` with issue #103)
2. Run `/running-sdlc start --config <project-path>`
3. `startIssue` step runs — Claude calls `AskUserQuestion` (denied in pipe mode) repeatedly until max turns
4. Step exits code 0 with `subtype: "error_max_turns"` and `permission_denials` in JSON output
5. Runner treats exit code 0 as success, advances to `writeSpecs`
6. `writeSpecs` preconditions fail (no issue set, no branch created)
7. Bounce loop → escalation → consecutive escalation → halt

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | macOS (Darwin 25.3.0) |
| **Runner version** | sdlc-runner.mjs (~1450 lines, no version tracking) |
| **Model** | opus |
| **Configuration** | maxTurns: 15 for startIssue, maxRetriesPerStep: 3 |

### Frequency

Always — any step that burns all turns without completing its goal will be misreported as success.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | Runner detects `subtype: "error_max_turns"` or `permission_denials` in JSON output and treats the step as a failure, entering the retry/escalation path |
| **Actual** | Runner only checks `exitCode === 0` (line ~1201) and treats the step as successful, advancing to the next step which immediately fails preconditions |

### Error Output

```
# Runner log shows step treated as success despite soft failure:
# Step exits code 0 → runner advances → next step fails preconditions → bounce loop
# JSON output contains: { "subtype": "error_max_turns", ... }
# But runner never parses subtype or permission_denials fields
```

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Runner Detects error_max_turns as Failure

**Given** a step exits with code 0
**When** the JSON output contains `subtype: "error_max_turns"`
**Then** the runner treats the step as a failure and enters the retry/escalation path

### AC2: Runner Detects Permission Denials as Failure

**Given** a step exits with code 0
**When** the JSON output contains non-empty `permission_denials`
**Then** the runner treats the step as a failure and enters the retry/escalation path

### AC3: Normal Exit Code 0 Still Treated as Success

**Given** a step exits with code 0
**When** the JSON output has `subtype: "success"` and no `permission_denials`
**Then** the runner treats the step as success and advances normally

### AC4: Auto-Mode Instruction Is More Prominent

**Given** the `starting-issues` SKILL.md
**When** Claude reads the skill in headless mode
**Then** the Automation Mode instruction is positioned and formatted to maximize model compliance (e.g., moved above workflow, bolded critical directive, repeated in Step 2)

### AC5: Comprehensive Jest BDD Test Suite Covers All Runner Functionality

**Given** the `sdlc-runner.mjs` script (~1450 lines, currently zero tests)
**When** the test suite is run via `npm test` or `jest`
**Then** all core runner functionality has test coverage including:
- Precondition validation for all 9 steps
- State extraction from step output (`extractStateFromStep`)
- Bounce loop detection and threshold logic
- Failure handling (immediate escalation patterns, rate limiting, retries)
- Consecutive escalation detection and halt
- Same-issue loop detection (escalated issues set)
- State hydration from git/filesystem (`detectAndHydrateState`)
- Auto-mode file lifecycle (creation, removal, exclusion from dirty checks)
- Soft failure detection (error_max_turns, permission_denials)

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Parse JSON output from `claude -p --output-format json` for `subtype` and `permission_denials` after each step | Must |
| FR2 | Treat `error_max_turns` subtype as step failure regardless of exit code | Must |
| FR3 | Treat non-empty `permission_denials` as step failure regardless of exit code | Must |
| FR4 | Comprehensive Jest BDD test suite for all runner functionality | Must |
| FR5 | Improve auto-mode instruction prominence in starting-issues SKILL.md | Should |

---

## Out of Scope

- Changes to Claude Code's exit code behavior (that's upstream)
- Changes to failure loop detection logic (#33, working correctly)
- Runner-level auto-selection of issues (bypassing the skill entirely)
- Configurable soft failure patterns
- Changes to any SDLC skills other than `starting-issues` (AC4 only)

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed (High — causes wasted cost and cascading failures)
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC3 — normal success still works)
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
