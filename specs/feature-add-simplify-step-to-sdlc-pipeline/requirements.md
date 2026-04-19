# Requirements: Add /simplify Step to SDLC Pipeline

**Issues**: #140
**Date**: 2026-04-19
**Status**: Draft
**Author**: Rich Nunley

---

## User Story

**As a** developer or automated SDLC pipeline
**I want** code simplified and cleaned immediately after implementation and before verification runs
**So that** verification operates on high-quality input and rework cycles caused by fixable style or complexity issues are minimized

---

## Background

The SDLC pipeline currently moves directly from `/write-code` to `/verify-code`. When implementation produces code that could be simplified (redundant logic, unnecessary abstractions, inconsistent patterns), the verifier sees that noise alongside genuine spec deviations — increasing false findings and rework.

The `simplify` skill is a standalone Claude Code marketplace skill that reviews changed code for reuse, quality, and efficiency, then fixes any issues found. It is NOT bundled with `nmg-sdlc` — it may or may not be present in any given project. Inserting a `/simplify` step between implementation and verification ensures verification always operates on already-cleaned code, while graceful-degradation behavior keeps the pipeline functional in projects that have not installed `simplify`.

The integration affects three surfaces:

1. The `write-code` skill (`plugins/nmg-sdlc/skills/write-code/SKILL.md`) — invokes simplify before signalling completion
2. The `verify-code` skill (`plugins/nmg-sdlc/skills/verify-code/SKILL.md`) — re-runs simplify after each fix in Step 6
3. The SDLC runner (`scripts/sdlc-runner.mjs`) and its config template — gains a `simplify` step between `implement` and `verify`

Reference: [GitHub issue #140](https://github.com/Nunley-Media-Group/nmg-plugins/issues/140).

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: write-code invokes /simplify after all tasks complete

**Given** implementation is complete AND the `simplify` skill is installed
**When** `write-code` reaches Step 6 (Signal Completion)
**Then** `/simplify` is invoked on the changed files, any findings are addressed immediately, and only after findings are cleared does the step signal completion

**Example**:
- Given: All tasks in `tasks.md` finished and the user has `simplify` installed (e.g., from the public Claude Code marketplace)
- When: write-code reaches its completion-signalling step
- Then: write-code probes for skill availability, invokes `/simplify`, applies any returned fixes, then prints "Implementation complete for issue #N"

### AC2: Graceful degradation when simplify is not installed

**Given** the `simplify` skill is NOT installed in the project
**When** `write-code` or `verify-code` would invoke it
**Then** a visible warning is logged (`simplify skill not available — skipping simplification pass`) and the step proceeds without simplification

**Example**:
- Given: A project where the marketplace skill `simplify` was never installed (probe finds no skill registered)
- When: write-code finishes its tasks
- Then: write-code emits the warning string verbatim and proceeds to its completion message; the step exits with the same success status it would have without simplify

### AC3: verify-code re-simplifies after fixing findings

**Given** `verify-code` has fixed one or more findings AND the `simplify` skill is installed
**When** it finishes applying a fix in Step 6 (Fix Findings)
**Then** `/simplify` is run on the affected code before re-verifying to ensure the fix itself is clean

**Example**:
- Given: verify-code finds 3 findings and applies fixes for them in Step 6a
- When: each fix is committed in memory and verify-code transitions to 6b/6c (re-test, re-verify)
- Then: `/simplify` runs over the affected files between fix application and re-verification

### AC4: SDLC runner gains a simplify step between implement and verify

**Given** the runner is running a full pipeline cycle
**When** the pipeline advances from `implement` (step 4) to `verify` (step 5)
**Then** a `simplify` step executes between them; if the skill is unavailable it logs a warning and skips gracefully rather than failing the run

**Example**:
- Given: `STEP_KEYS` declares `[startCycle, startIssue, writeSpecs, implement, simplify, verify, commitPush, createPR, monitorCI, merge]`
- When: the runner finishes step 4 successfully and probes for the simplify step
- Then: step 5 (`simplify`) executes; on success the runner proceeds to verify (now step 6); if simplify is unavailable the runner logs `[STATUS] simplify skill not available — skipping` and advances to verify with success

### AC5: Pipeline documentation is updated

**Given** any skill `## Integration with SDLC Workflow` section, the README pipeline diagram, or the `sdlc-config.example.json` step list
**When** this issue is complete
**Then** `/simplify` appears between `/write-code` and `/verify-code` in all pipeline depictions

**Example**:
- Given: README.md contains the diagram `/draft-issue → /start-issue → /write-spec → /write-code → /verify-code → /open-pr`
- When: the change is merged
- Then: every diagram is updated to `/draft-issue → /start-issue → /write-spec → /write-code → /simplify → /verify-code → /open-pr`, including diagrams inside each pipeline skill's `## Integration with SDLC Workflow` section

### Generated Gherkin Preview

```gherkin
Feature: Add /simplify step to SDLC pipeline

  Scenario: write-code invokes /simplify after all tasks complete
    Given implementation is complete and the simplify skill is installed
    When write-code reaches Step 6 (Signal Completion)
    Then /simplify is invoked on changed files
    And findings are addressed before completion is signalled

  Scenario: Graceful degradation when simplify is not installed
    Given the simplify skill is NOT installed
    When write-code or verify-code would invoke it
    Then a warning is logged and the step proceeds without simplification

  Scenario: verify-code re-simplifies after fixing findings
    Given verify-code has fixed one or more findings and simplify is installed
    When it finishes applying a fix
    Then /simplify is run on the affected code before re-verifying

  Scenario: SDLC runner gains a simplify step between implement and verify
    Given the runner is running a pipeline cycle
    When the pipeline advances from implement to verify
    Then a simplify step executes between them
    And if simplify is unavailable the step logs a warning and skips

  Scenario: Pipeline documentation is updated
    Given any skill Integration section, README diagram, or config step list
    When this issue is complete
    Then /simplify appears between /write-code and /verify-code in all depictions
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | `write-code` probes for simplify skill availability before invoking | Must | Probe via `Glob` over plugin/skills directories or a deterministic check the skill author can document; result must be observable in step output |
| FR2 | `write-code` invokes simplify and blocks step completion until findings are addressed | Must | Step 6 is the natural insertion point; the existing "Signal Completion" output moves to after simplify |
| FR3 | `write-code` logs a warning and continues if simplify is not found | Must | Warning string MUST be: `simplify skill not available — skipping simplification pass` |
| FR4 | `verify-code` applies the same simplify-then-verify pattern after each fix | Must | Insertion point is between Step 6a (Prioritize and Fix) and Step 6b (Run Tests After Fixes); same probe + warning pattern as write-code |
| FR5 | SDLC runner `STEP_KEYS` gains a `simplify` step between `implement` and `verify` | Must | Inserted at index 4 (`startCycle, startIssue, writeSpecs, implement, simplify, verify, ...`); `STEP_NUMBER` and `STEPS` derive from `STEP_KEYS` so they update automatically; downstream step numbers shift by one |
| FR6 | Runner skips the simplify step gracefully (warning, no failure) when skill unavailable | Should | Probe runs in the runner's prompt-builder or precondition; on miss the step logs `[STATUS] simplify skill not available — skipping` and returns success without invoking Claude |
| FR7 | README pipeline diagram and all skill integration sections updated | Must | Update `README.md` pipeline diagram, every `## Integration with SDLC Workflow` block in pipeline skills, and `sdlc-config.example.json` to include the simplify step |

### Derivative Functional Requirements (technical adjustments)

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR8 | `sdlc-config.example.json` adds a `simplify` entry to `steps{}` | Must | Provides config defaults for model/effort/maxTurns/timeout matching the lightweight nature of the step |
| FR9 | Runner unit tests cover the new step ordering | Must | Update existing `STEP_KEYS and STEPS` test (`scripts/__tests__/sdlc-runner.test.mjs`) to expect 10 steps with `simplify` at index 4 |
| FR10 | Hard-coded step numbers in runner prompts are still keyed off `STEP_NUMBER` (not literals) where they reference verify/commitPush/createPR/monitorCI/merge | Must | Inserting the new step shifts numbers; any literal usage (e.g., comments mentioning "step 5") should be re-validated |
| FR11 | CHANGELOG `[Unreleased]` entry added describing the new pipeline step | Must | Per repo conventions in CLAUDE.md |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Simplify pass should add no more than the per-step timeout configured in `sdlc-config.example.json` (default 10–15 min); skill availability probe must be O(1) — a single directory or registry lookup |
| **Security** | No new secrets introduced; simplify skill executes under the same `--dangerously-skip-permissions` envelope as other steps |
| **Reliability** | Probe-and-skip behaviour MUST be tested; an absent simplify skill must never cause the pipeline to fail |
| **Cross-Platform** | Probe must work on macOS, Windows, and Linux — use `node:path` and the existing skills-discovery pattern; no shell-specific globbing |
| **Platforms** | Reference `tech.md` — Claude Code CLI on macOS/Windows/Linux; Node.js v24+ for the runner |

---

## Data Requirements

### Input Data

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| Skill availability flag | boolean (computed) | True if a `simplify` skill is discoverable in the loaded plugin set | Yes |
| Changed file list | array of paths | Derived from `git diff` against the baseline branch | Yes (passed to simplify) |

### Output Data

| Field | Type | Description |
|-------|------|-------------|
| Simplify step status | enum (`ran`, `skipped`, `failed`) | Reported in skill output and in runner step logs |
| Files modified by simplify | array of paths | Captured for the verification report so reviewers see what changed |

---

## Dependencies

### Internal Dependencies
- [ ] Existing `write-code` skill (`plugins/nmg-sdlc/skills/write-code/SKILL.md`)
- [ ] Existing `verify-code` skill (`plugins/nmg-sdlc/skills/verify-code/SKILL.md`)
- [ ] SDLC runner (`scripts/sdlc-runner.mjs`) and its tests (`scripts/__tests__/sdlc-runner.test.mjs`)
- [ ] Runner config template (`scripts/sdlc-config.example.json`)
- [ ] README pipeline diagram (`README.md`)

### External Dependencies
- [ ] `simplify` skill from the Claude Code marketplace — NOT bundled, optional at runtime

### Blocked By
- None

---

## Out of Scope

- Changes to the `simplify` skill itself
- Changes to `/draft-issue`, `/write-spec`, `/start-issue`, or `/open-pr`
- Installing or bundling the `simplify` skill as part of nmg-sdlc
- Adding metrics or telemetry for simplify pass effectiveness
- Detecting whether simplify made meaningful changes (any change reported by simplify is accepted)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Verification false-finding rate | Lower vs. pre-change baseline (informal) | Compare verification reports before and after on a set of issues |
| Pipeline reliability when simplify absent | 100% | All runner tests covering "simplify unavailable" must pass |
| Documentation coverage | 100% | Every pipeline diagram in the repo names `simplify` between `/write-code` and `/verify-code` |

---

## Open Questions

- [ ] What is the canonical detection mechanism for an installed marketplace skill? (Design phase will answer — likely a `Glob` over `~/.claude/plugins/**/skills/simplify/SKILL.md` plus the active project's plugin dirs, or a documented "the runner trusts the prompt to detect")
- [ ] Should the runner also consult `sdlc-config.json` for an explicit `simplify.enabled = false` opt-out? (Design phase will decide; default behaviour is "enabled if installed")

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #140 | 2026-04-19 | Initial feature spec |

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements (the FR table calls out implementation surfaces, not implementations)
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases (skill absent in any of three call sites) are specified
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented
