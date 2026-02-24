# Root Cause Analysis: Detect Soft Failures (error_max_turns) and Add Runner Test Suite

**Issue**: #38
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude (nmg-sdlc)

---

## Root Cause

The SDLC runner's success check (`sdlc-runner.mjs` line 1201) evaluates only `result.exitCode === 0` and never inspects the JSON output produced by `claude -p --output-format json`. When Claude hits its maximum turn limit without completing the goal, it exits with code 0 but sets `subtype: "error_max_turns"` in its JSON output. Similarly, when tool calls are denied (e.g., `AskUserQuestion` in pipe mode), Claude records them in `permission_denials` but still exits 0.

The runner now uses `--output-format stream-json` (newline-delimited JSON events) and parses the final result via `extractResultFromStream()`, which `extractSessionId()` also uses to extract the `session_id` field. The `detectSoftFailure()` function uses `extractResultFromStream()` to check the `subtype` and `permission_denials` fields that indicate the step did not actually succeed.

A contributing factor is that the `starting-issues` SKILL.md positions the Automation Mode instruction (lines 18–22) as a mid-page section. While the instruction is correct ("skip `AskUserQuestion` when `.claude/auto-mode` exists"), it's not prominent enough for reliable model compliance in headless pipe mode. Claude ignored the instruction and called `AskUserQuestion` repeatedly, each call denied, consuming all turns.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `openclaw/scripts/sdlc-runner.mjs` | 1201–1208 | Success path — assumes exit code 0 = step success, never parses JSON output |
| `openclaw/scripts/sdlc-runner.mjs` | 379–385 | `extractSessionId()` — already parses JSON for `session_id` but ignores `subtype` and `permission_denials` |
| `openclaw/scripts/sdlc-runner.mjs` | 957–1010 | `extractStateFromStep()` — reads `result.stdout` but only for issue/branch/PR extraction, not failure indicators |
| `plugins/nmg-sdlc/skills/starting-issues/SKILL.md` | 18–22 | Automation Mode instruction — correct content but insufficient prominence |

### Triggering Conditions

- A step runs in headless mode (`claude -p`) with `--output-format json`
- The step calls a tool that is denied in pipe mode (e.g., `AskUserQuestion`)
- Claude retries the denied tool until it hits `maxTurns`, then exits with code 0
- The JSON output contains `subtype: "error_max_turns"` and non-empty `permission_denials`
- The runner checks only `exitCode === 0` and advances to the next step

---

## Fix Strategy

### Approach

Add a `detectSoftFailure(stdout)` function that uses `extractResultFromStream()` to parse the stream-json output and checks for two soft failure indicators: `subtype: "error_max_turns"` and non-empty `permission_denials`. Insert this check immediately after the `exitCode === 0` check in `runStep()`, before state extraction. If a soft failure is detected, route to `handleFailure()` as if the step had returned a non-zero exit code.

To make the runner testable, refactor the module to guard the CLI bootstrap behind an `isMainModule` check and export all internal functions. Create a comprehensive Jest test suite under `openclaw/scripts/__tests__/` with mocked `node:child_process` and `node:fs` dependencies.

For the `starting-issues` SKILL.md, add a bold critical callout at the top of the file (below frontmatter) and reinforce the directive inside Step 2 where `AskUserQuestion` is used.

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `openclaw/scripts/sdlc-runner.mjs` | Add `detectSoftFailure(stdout)` function | Parses JSON output for `subtype: "error_max_turns"` and `permission_denials` |
| `openclaw/scripts/sdlc-runner.mjs` | Insert soft failure check in `runStep()` after line 1201 | Routes soft failures to `handleFailure()` instead of advancing |
| `openclaw/scripts/sdlc-runner.mjs` | Guard CLI bootstrap with `isMainModule` check; export internal functions | Enables importing functions for testing without triggering CLI execution |
| `openclaw/scripts/__tests__/sdlc-runner.test.mjs` | Create comprehensive Jest test suite | Covers all core runner functionality per AC5 |
| `openclaw/scripts/package.json` | Add Jest as dev dependency with ESM config | Required to run the test suite |
| `plugins/nmg-sdlc/skills/starting-issues/SKILL.md` | Add prominent automation callout at top; reinforce in Step 2 | Increases model compliance for auto-mode behavior |

### Blast Radius

- **Direct impact**: `runStep()` success path in `sdlc-runner.mjs`, `starting-issues` SKILL.md
- **Indirect impact**: All callers of `runStep()` (main loop, single-step mode) — they receive the same return values (`'ok'`, `'retry'`, `'escalated'`, etc.) so no interface change needed
- **Risk level**: Low — the soft failure check is additive (new code path for a previously unhandled case), and the SKILL.md change is instructional text only

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Normal exit-code-0 success treated as failure | Low | `detectSoftFailure()` checks specific fields (`subtype`, `permission_denials`); `subtype: "success"` with no denials passes through unchanged. AC3 regression test validates this. |
| JSON parse failure on non-JSON output | Low | Wrap parsing in try/catch — if stdout isn't valid JSON, treat as non-soft-failure (preserve current behavior). Steps that don't produce JSON still work. |
| Refactoring for exports breaks CLI execution | Low | Guard is `isMainModule` at the end of the file; all function definitions remain unchanged. Test verifies CLI still launches correctly. |
| Starting-issues auto-mode change affects manual mode | None | The added callout only applies when `.claude/auto-mode` exists; manual-mode workflow is unchanged. |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| Parse JSON in `extractStateFromStep()` | Check `subtype` during state extraction instead of adding a separate function | Mixes failure detection with state extraction; harder to test and reason about. Separate function has clearer responsibility. |
| Check `permission_denials` only in error patterns | Add `permission_denials` to `IMMEDIATE_ESCALATION_PATTERNS` regex array | Wouldn't catch `error_max_turns`. Also, these patterns match against string output, not parsed JSON fields — less precise. |
| Move runner logic into a separate importable module | Extract all functions into `sdlc-runner-lib.mjs`, keep `sdlc-runner.mjs` as thin CLI wrapper | Too much refactoring for a defect fix. The `isMainModule` guard achieves testability with minimal change. |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references (line 1201, lines 379–385)
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed (low — additive change)
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md` — ESM, zero-dependency, `node:*` only for runner; markdown for skill)
