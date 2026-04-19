# Defect Report: SDLC runner escalates verify step on expected test-scaffold permission denials

**Issue**: (tracked with #122 commit)
**Date**: 2026-04-18
**Status**: Fixed
**Author**: Claude (spec agent)
**Severity**: High
**Related Spec**: `specs/bug-detect-soft-failures-runner-tests/`

---

## Reproduction

### Steps to Reproduce

1. Configure an SDLC runner against any project using the `nmg-sdlc` plugin (macOS or Linux).
2. Ensure `sdlc-config.json` uses the default step definitions with `verify-code` as the Step 5 skill.
3. Launch the runner: `node scripts/sdlc-runner.mjs --config sdlc-config.json`.
4. Let the pipeline reach Step 5 (`verify`) on any issue whose verification exercises a skill in a disposable test project (the documented `/tmp/nmg-sdlc-test-{timestamp}/` scaffold pattern).
5. Observe the `verify` subprocess emit `permission_denials` for `Write` and/or `Bash` targeting paths inside `os.tmpdir()` (e.g., `/var/folders/.../nmg-sdlc-test-*/...` on macOS).
6. Observe the runner flag the step as a soft failure and immediately escalate ("Matched unrecoverable pattern: permission denied").
7. After two consecutive escalations the runner's failure-loop guard halts the entire cycle.

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | macOS (`os.tmpdir()` → `/var/folders/.../T/`), Linux (`/tmp`), Windows (`%TEMP%`) |
| **Version / Commit** | `plugins/nmg-sdlc` v6.1.0 — `scripts/sdlc-runner.mjs` |
| **Component** | `detectSoftFailure()` in `scripts/sdlc-runner.mjs` |
| **Configuration** | Any config that runs `verify-code` as Step 5 (default) |

### Frequency

Deterministic — happens every time `verify-code` exercises a skill that writes to its `/tmp/nmg-sdlc-test-*/` scaffold (which is the documented exercise-testing pattern, so "every verify run for a skill change" in practice).

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | Permission denials targeting paths inside the OS temp directory are treated as benign. The `verify` step still completes (`exit 0`) and the pipeline advances to Step 6 (`commitPush`). |
| **Actual** | `detectSoftFailure()` reports `permission_denials: Write, Bash` as a soft failure. The runner treats the reason string as an "unrecoverable pattern" and escalates immediately. After two consecutive escalations (e.g., this plus an unrelated escalation on another issue), the failure-loop guard halts the runner. |

### Error Output

```
[STATUS] Step 5 (verify) soft failure: permission_denials: Bash, Write, Write
Immediate escalation: matched pattern "permission denied"
FAILURE LOOP DETECTED: consecutive escalations
Issues: #115, #122
Last step: 5 (verify)
Reason: Matched unrecoverable pattern: permission denied
```

---

## Root Cause

1. `verify-code` creates an ephemeral test project at `os.tmpdir()/nmg-sdlc-test-{timestamp}/` to exercise skill changes in isolation — this is the documented test-scaffold pattern in `steering/structure.md`.
2. The `claude -p` subprocess runs with `--dangerously-skip-permissions`, which suppresses Claude Code's permission prompts, but does not override the sandbox constraint that writes must stay inside the project root.
3. When the subprocess Writes to files under the scaffold directory (e.g., `.claude/unattended-mode`, `.claude/sdlc-state.json`), the sandbox records permission denials in the result JSON's `permission_denials` array.
4. `detectSoftFailure()` only filters `BENIGN_DENIED_TOOLS` (`EnterPlanMode`, `ExitPlanMode`, `AskUserQuestion`). It does not consider the denial's target path, so any scaffold-write denial escalates.
5. Once the escalation fires, `IMMEDIATE_ESCALATION_PATTERNS` matches `/permission denied/i` against the reason string, and two such escalations (across cycles or issues) trip the failure-loop guard.

## Fix Requirements

**FR1.** `detectSoftFailure()` MUST treat `permission_denials` entries whose `tool_input` references a path inside `os.tmpdir()` as benign, regardless of tool name.

**FR2.** The filter MUST be cross-platform — it must use `os.tmpdir()` (not a hardcoded `/tmp` or `/var/folders` prefix) so the behavior is identical on macOS, Linux, and Windows.

**FR3.** Denials targeting paths outside the OS temp directory MUST still escalate as before, even when a scaffold denial is present in the same batch.

**FR4.** The change MUST be covered by unit tests in `scripts/__tests__/sdlc-runner.test.mjs`:
- One test asserting `isSoftFailure: false` when all denials are scaffold-path denials.
- One test asserting `isSoftFailure: true` when at least one denial is outside the temp dir (even if scaffold denials are also present).

**FR5.** No change to `BENIGN_DENIED_TOOLS` or `IMMEDIATE_ESCALATION_PATTERNS` — the fix is purely additive to the filtering logic.

## Acceptance Criteria

- **AC1.** The `verify` step no longer soft-fails solely because the exercise-test scaffold write was sandbox-denied.
- **AC2.** The failure-loop guard no longer trips on false-positive `permission denied` reasons from scaffold writes.
- **AC3.** Jest unit tests pass for both the scaffold-benign case and the mixed-denial case.
- **AC4.** The fix applies automatically to all projects using the `nmg-sdlc` plugin — no per-project configuration required.
