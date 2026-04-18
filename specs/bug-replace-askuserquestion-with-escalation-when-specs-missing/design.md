# Root Cause Analysis: AskUserQuestion called instead of escalation when specs missing in unattended-mode

**Issues**: #85
**Date**: 2026-02-24
**Status**: Draft
**Author**: Claude

---

## Root Cause

The `/write-code` skill (`plugins/nmg-sdlc/skills/write-code/SKILL.md`) has a missing-specs error path in Step 2 ("Read Specs") that instructs Claude to prompt the user when spec files are not found. The instruction on line 59 reads:

> If specs don't exist, prompt: "No specs found. Run `/write-spec #N` first."

The word "prompt" causes Claude to use `AskUserQuestion`, which is the correct behavior in interactive mode. However, this instruction has no unattended-mode guard. The skill's Unattended Mode section (lines 20–23) establishes the general principle — "Do NOT call `AskUserQuestion`" — but does not override this specific error path. When Claude encounters the missing-specs condition, it follows the more specific instruction ("prompt") rather than the general unattended-mode principle.

Other skills (e.g., `/start-issue` lines 145–156) handle unattended-mode error paths explicitly by outputting an escalation message ending with "Done. Awaiting orchestrator." and then exiting. The `/write-code` skill's missing-specs path simply lacks this pattern.

The runner (`scripts/sdlc-runner.mjs`) already validates spec preconditions before running step 4 (lines 781–803) — it checks for all 4 spec files. When preconditions fail, the runner retries the previous step (write-spec). But when preconditions pass initially and the skill itself discovers missing specs at a more granular level (e.g., wrong directory resolved, partial specs), the skill's `AskUserQuestion` call causes a hang instead of a clean exit that the runner can handle.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `plugins/nmg-sdlc/skills/write-code/SKILL.md` | 59 | Missing-specs error path — unconditionally says "prompt" without unattended-mode guard |
| `plugins/nmg-sdlc/skills/write-code/SKILL.md` | 20–23 | Unattended Mode section — establishes general unattended-mode contract but doesn't cover this error path explicitly |

### Triggering Conditions

- `.claude/unattended-mode` exists (headless automation via the SDLC runner)
- Spec files are missing or the spec directory cannot be found for the target issue
- The runner's precondition check passes (e.g., a spec directory exists but is incomplete, or a different feature's specs are found) but the skill's own check fails
- Claude follows the specific "prompt" instruction over the general "do not call AskUserQuestion" guidance

---

## Fix Strategy

### Approach

Add an unattended-mode conditional to the missing-specs error path in Step 2 of the write-code SKILL.md. This follows the established pattern from `/start-issue` (lines 145–156): check for `.claude/unattended-mode`, output an escalation message with the runner-expected sentinel, and exit.

The fix is a single edit to one file. The instruction on line 59 will be expanded from a single-line "prompt" instruction into a conditional block:

- **Unattended-mode present**: Output an escalation message that identifies which specs are missing, names `/write-spec` as the prerequisite, and ends with "Done. Awaiting orchestrator."
- **Unattended-mode absent**: Use `AskUserQuestion` to prompt the user (preserving existing interactive behavior).

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `plugins/nmg-sdlc/skills/write-code/SKILL.md` | Replace the single-line "prompt" instruction in Step 2 with an unattended-mode conditional block | Follows the established pattern from other skills; prevents `AskUserQuestion` in headless sessions while preserving interactive behavior |

### Blast Radius

- **Direct impact**: `plugins/nmg-sdlc/skills/write-code/SKILL.md` — Step 2 error path only
- **Indirect impact**: The runner (`sdlc-runner.mjs`) already handles clean skill exits via its precondition validation and bounce-back logic. No runner changes needed — the skill's clean exit will be handled by existing mechanisms.
- **Risk level**: Low — the change only affects a single error path in one skill, adding a conditional that other skills already use successfully

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Interactive mode behavior changes | Low | AC2 explicitly requires `AskUserQuestion` still be used when unattended-mode is absent; the conditional preserves existing behavior |
| Escalation message format not recognized by runner | Low | Using the same "Done. Awaiting orchestrator." sentinel as all other skills; runner treats clean exit + failed preconditions as bounce-back triggers |
| Unattended-mode check instruction ignored by Claude | Low | Other skills use the exact same conditional pattern successfully; phrasing the check as an explicit if/else block with concrete actions makes it unambiguous |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
