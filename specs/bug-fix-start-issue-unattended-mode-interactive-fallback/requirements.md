# Defect Report: start-issue skill falls back to interactive prompt in unattended mode

**Issue**: (tracked with #122 commit)
**Date**: 2026-04-18
**Status**: Fixed
**Author**: Claude (spec agent)
**Severity**: High
**Related**: `specs/bug-fix-runner-detectandhydratestate-skips-verify/`

---

## Reproduction

### Steps to Reproduce

1. Run the SDLC runner in continuous loop mode (`/run-loop` with no args, or `node scripts/sdlc-runner.mjs --config …`).
2. Allow one full issue cycle to complete (verify → merge).
3. After Step 9 (merge) advances to the next cycle's Step 1 (startCycle) and Step 2 (startIssue), observe Step 2 exit cleanly (exit 0) WITHOUT creating a feature branch.
4. The runner logs `Warning: branch-based issue extraction failed after step 2 — currentIssue will be null`.
5. Step 3 (writeSpecs) preconditions fail (`feature branch exists`), bouncing to Step 2 again.
6. After 3 bounces, the bounce-loop guard escalates Step 2 with reason `"Precondition check for step 3 failed 3 times: Still on main, expected feature branch"`.

### Environment

| Factor | Value |
|--------|-------|
| **Component** | `plugins/nmg-sdlc/skills/start-issue/SKILL.md` and runner Step 2 prompt in `scripts/sdlc-runner.mjs` |
| **Applicable to** | All projects using `nmg-sdlc` when running in unattended mode without a pinned issue number |
| **Trigger** | Any continuous SDLC cycle where Step 2 is invoked without an argument |

### Observed Output

From the subprocess result JSON:

```
"result": "The interactive picker isn't capturing selections in this context. Here are the open issues — please reply with the issue number you'd like to start:\n\n| # | Title | Milestone |\n|---|-------|-----------|\n| **#124** | ... |"
```

The subprocess tried `AskUserQuestion`, got denied (`AskUserQuestion` is in `BENIGN_DENIED_TOOLS`), then emitted markdown asking the user to reply — in a context where there is no user to reply.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | In unattended mode, Step 2 must deterministically select an issue (first `automatable` issue from the first viable milestone alphabetically), run `gh issue develop <N> --checkout`, and exit with HEAD on the new `<number>-<slug>` branch. |
| **Actual** | The model follows the interactive path, calls `AskUserQuestion`, gets denied, then emits a markdown prompt addressed to a non-existent user. The subprocess exits 0 but HEAD stays on `main`. |

---

## Root Cause

Two reinforcing failures:

1. **Skill-level**: `SKILL.md` includes the unattended-mode directive at the top ("NEVER call AskUserQuestion") and a dedicated section at lines 20–25, but the model does not reliably follow these instructions — especially when the model's default path is the interactive picker. When `AskUserQuestion` is denied, the model falls back to text-based user prompting rather than to the skill's documented deterministic selection path.

2. **Runner-level**: The Step 2 prompt (`buildClaudeArgs`) contains only a short "Select and start the next GitHub issue from the current milestone" directive — it doesn't reinforce the unattended-mode path or spell out the deterministic formula. It also lacks a postcondition check: if Step 2 exits 0 without producing a feature branch, the runner logs a warning but advances to Step 3 anyway, causing a bounce loop instead of a direct failure.

---

## Fix Requirements

**FR1.** The runner's Step 2 prompt MUST, in unattended mode (no `SINGLE_ISSUE_NUMBER`), spell out the deterministic selection formula inline: fetch milestones → sort alphabetically → pick the first with open issues → list `--label automatable` issues → pick the lowest-numbered → `gh issue develop <N> --checkout`.

**FR2.** The runner's Step 2 prompt MUST explicitly forbid `AskUserQuestion` and forbid emitting text that asks the user to reply.

**FR3.** After Step 2 exits with code 0, the runner MUST check whether a feature branch is checked out. If HEAD is still on `main` (or `state.currentIssue` is null), the runner MUST treat the step as a soft failure and enter the retry/escalation path.

**FR4.** The fix MUST apply to all projects using `nmg-sdlc` — it must live in the shared runner and/or skill, not in project-specific configuration.

**FR5.** The existing `--label automatable` filter MUST remain — unattended mode must only pick issues marked safe for automation.

## Acceptance Criteria

- **AC1.** A fresh unattended cycle picks the lowest-numbered `automatable` issue from the first viable milestone without any `AskUserQuestion` attempt.
- **AC2.** If no `automatable` issues exist, Step 2 emits the documented diagnostic message and exits without creating a branch — runner then halts cleanly.
- **AC3.** A Step 2 that exits 0 but fails to create a branch is treated as a failure, not silently advanced.
- **AC4.** The retry path for Step 2 does not amplify into a bounce loop — the postcondition check short-circuits before Step 3 runs.

## Fix Summary

1. Expand the Step 2 unattended prompt in `scripts/sdlc-runner.mjs` → `buildClaudeArgs` to include a step-by-step deterministic selection formula and an explicit "Do NOT call AskUserQuestion" instruction.
2. Add a postcondition gate in `runStep` after Step 2 success: when `state.currentBranch === 'main'` or `state.currentIssue` is missing, route through `handleFailure` instead of advancing.
