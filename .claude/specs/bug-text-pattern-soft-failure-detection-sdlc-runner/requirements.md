# Defect Report: Text-Pattern Soft Failure Detection Missing from SDLC Runner

**Issues**: #86
**Date**: 2026-02-25
**Status**: Draft
**Author**: Claude (nmg-sdlc)
**Severity**: High
**Related Spec**: `.claude/specs/feature-openclaw-runner-operations/`

---

## Reproduction

### Steps to Reproduce

1. Configure the SDLC runner (`sdlc-runner.mjs`) for a project with open issues
2. Run a step where a skill outputs a text-based failure (e.g., "EnterPlanMode called in headless session" or "AskUserQuestion called in auto-mode")
3. The Claude Code session exits with code 0
4. The JSON output contains `subtype: "success"` or no structured failure indicators
5. The runner's `detectSoftFailure()` checks only JSON fields (`subtype`, `permission_denials`) and finds nothing
6. The step is treated as successful despite the text-based failure
7. Subsequent steps fail or produce incorrect results, wasting retry cycles

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | Any (cross-platform runner) |
| **Runner version** | `openclaw/scripts/sdlc-runner.mjs` (current main) |
| **Model** | Any model used with the runner |
| **Configuration** | Any config that triggers a skill producing text-based error output |

### Frequency

Always — any step that produces a text-based failure message on stdout/stderr while exiting code 0 will be misclassified as successful.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | The runner scans stdout/stderr for known text failure patterns (e.g., `EnterPlanMode`, `AskUserQuestion.*auto-mode`, `permission denied`) and treats matches as soft failures with the same retry/escalation behavior as JSON-detected failures |
| **Actual** | `detectSoftFailure()` only inspects parsed JSON fields (`subtype`, `permission_denials`). Text-based failures are invisible to it. The step is marked as successful and the runner advances to the next step. |

### Error Output

```
# Runner log shows step treated as success:
[timestamp] Step 3 exited with code 0 in 45s
[timestamp] Step 3 (writeSpecs) complete.

# But stdout contained undetected failure text:
# "EnterPlanMode called in headless session — cannot enter plan mode without a TTY"
# or "AskUserQuestion called in auto-mode — this skill does not support auto-mode"
```

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Regex Scan for Known Text Failure Patterns

**Given** a step exits with code 0
**When** the runner evaluates the step result via `detectSoftFailure()`
**Then** the raw stdout and stderr are scanned against a configurable list of regex patterns for known text-based failures (e.g., `EnterPlanMode`, `AskUserQuestion.*auto-mode`)

**Example**:
- Given: Step output contains "EnterPlanMode called in headless session"
- When: `detectSoftFailure()` processes the output
- Then: Returns `{ isSoftFailure: true, reason: 'text_pattern: EnterPlanMode' }`

### AC2: Text-Pattern Failures Treated as Soft Failures

**Given** a known text failure pattern is detected in stdout/stderr
**When** the runner processes the detection result
**Then** the failure follows the same retry/escalation path as JSON-detected soft failures (enters `handleFailure()`)

**Example**:
- Given: `detectSoftFailure()` returns `{ isSoftFailure: true, reason: 'text_pattern: ...' }`
- When: The runner evaluates the exit-code-0 path
- Then: `handleFailure()` is called (same as `error_max_turns` or `permission_denials`)

### AC3: Discord Status Messages Include Detected Patterns

**Given** a text-pattern soft failure is detected
**When** the runner posts a Discord status message about the failure
**Then** the message includes the matched pattern text for debugging visibility

**Example**:
- Given: Pattern `EnterPlanMode` matched in step 3 output
- When: Discord message is sent
- Then: Message reads "Step 3 (writeSpecs) soft failure: text_pattern: EnterPlanMode"

### AC4: Failure Pattern List Is Maintainable

**Given** the list of known text failure patterns
**When** a developer needs to add or remove a pattern
**Then** the patterns are defined in a single, clearly documented constant array (not scattered inline throughout the code)

### AC5: No Regression — JSON-Based Soft Failures Still Detected

**Given** a step exits with code 0 and JSON output contains `subtype: "error_max_turns"` or non-empty `permission_denials`
**When** the runner evaluates the step result via `detectSoftFailure()`
**Then** the existing JSON-based soft failure detection still works correctly (not broken by the new text scanning)

### AC6: No Regression — Normal Success Still Passes

**Given** a step exits with code 0 with no failure indicators (neither JSON nor text patterns)
**When** the runner evaluates the step result
**Then** the step is treated as successful and the runner advances normally

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Add regex scan of stdout/stderr for configurable list of known text failure patterns in `detectSoftFailure()` | Must |
| FR2 | Treat text-pattern matches as soft failures with the same `{ isSoftFailure: true, reason: '...' }` return format | Must |
| FR3 | Include detected pattern text in Discord status messages (via existing `postDiscord()` call for soft failures) | Should |
| FR4 | Define failure patterns as a named constant array at module level for easy maintenance | Should |
| FR5 | Export the new text pattern scanning function for testability | Should |

---

## Out of Scope

- Changing how skills output errors (addressed per-skill, not in the runner)
- Adding new JSON-structured failure types to Claude Code itself
- Modifying `matchErrorPattern()` (which handles non-zero exit codes — a different code path)
- Making the pattern list configurable via `sdlc-config.json` (future enhancement)
- Changes to retry/escalation logic itself (already working correctly)

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #86 | 2026-02-25 | Initial defect spec |

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed (High — causes silent failures wasting retry cycles)
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC5, AC6)
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
