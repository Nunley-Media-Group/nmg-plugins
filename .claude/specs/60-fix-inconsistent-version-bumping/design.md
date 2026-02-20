# Root Cause Analysis: Inconsistent version bumping in automated SDLC runs

**Issue**: #60
**Date**: 2026-02-19
**Status**: Draft
**Author**: Claude (nmg-sdlc)

---

## Root Cause

Version bumping in automated SDLC runs is non-deterministic because the version bump logic lives exclusively in the `/creating-prs` skill (Steps 2–3), which is delivered as appended system prompt text to a `claude -p` subprocess. The runner's Step 7 prompt (line 810 of `sdlc-runner.mjs`) is generic:

```
"Create a pull request for branch ${branch} targeting main for issue #${issue}."
```

Under turn/time pressure or token budget constraints, the LLM sometimes skips the skill's Steps 2–3 (version bump determination and artifact updates) and jumps directly to PR creation (Step 4). This produces a valid PR but without the version bump commit.

The runner has no postcondition validation for Step 7 — unlike steps 3, 6, and 8 which have `validateSpecs()`, `validatePush()`, and `validateCI()` respectively. Without a postcondition check, the runner cannot detect the missing version bump and cannot trigger a retry.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `openclaw/scripts/sdlc-runner.mjs` | 810 | Step 7 prompt — generic, no mention of version bumping |
| `openclaw/scripts/sdlc-runner.mjs` | 1369–1427 | Postcondition gates for steps 3, 4, 6, 8 — Step 7 has none |
| `plugins/nmg-sdlc/skills/creating-prs/SKILL.md` | 40–87 | Steps 2–3 define version bumping but are LLM-discretionary |

### Triggering Conditions

- The project has a `VERSION` file (versioning is active)
- The runner is in auto-mode (no interactive confirmation to force the LLM through the version bump flow)
- The LLM subprocess has consumed many turns (e.g., reading specs, checking git state) before reaching the version bump steps, increasing the chance of skipping them
- Retry scenarios (where prior work is "saved" before restarting) compound the issue — the retry also omits the bump

---

## Fix Strategy

### Approach

The fix uses a **defense-in-depth** strategy with three layers:

1. **Deterministic version bump step**: Add a new `validateVersionBump()` postcondition gate after Step 7 that checks whether `VERSION` changed relative to `main`. If not, the runner performs the version bump deterministically via shell commands (no LLM involved) — reading `VERSION`, issue labels, milestone, and `tech.md` to compute the bump type and update all version artifacts. This is committed and pushed before retrying Step 7 or proceeding.

2. **Reinforced prompt**: Strengthen the Step 7 prompt to explicitly mention version bumping as mandatory, reducing the chance the LLM skips it in the first place.

3. **Preserved skill flow**: The `/creating-prs` skill's Steps 2–3 remain unchanged — they still handle version bumping for manual (interactive) use. When running in auto-mode under the runner, the deterministic postcondition acts as a safety net if the LLM skips the skill's version bump steps.

This approach was chosen over making the version bump a separate runner step (e.g., Step 6.5) because:
- It preserves the existing step numbering and config schema
- It follows the established pattern of postcondition gates (steps 3, 6, 8)
- It avoids running version bumping twice when the LLM does follow Steps 2–3 correctly

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `openclaw/scripts/sdlc-runner.mjs` (line 810) | Add explicit version bump mandate to Step 7 prompt | Defense-in-depth: LLM is told to bump versions (AC2) |
| `openclaw/scripts/sdlc-runner.mjs` (new function ~line 1260) | Add `validateVersionBump()` function | Postcondition check: detects missing version bump (AC3) |
| `openclaw/scripts/sdlc-runner.mjs` (new function ~line 1260) | Add `performDeterministicVersionBump()` function | Recovery: performs the version bump if missing (AC1) |
| `openclaw/scripts/sdlc-runner.mjs` (after line 1427) | Add Step 7 postcondition gate calling `validateVersionBump()` and `performDeterministicVersionBump()` | Integrates the postcondition into the step execution flow (AC1/AC3) |

### Blast Radius

- **Direct impact**: `sdlc-runner.mjs` — Step 7 prompt text, new validation function, postcondition gate in `runStep()`
- **Indirect impact**: Projects that use the SDLC runner will now always get version bumps on PR creation (which is the intended behavior per spec #41). Projects without a `VERSION` file are unaffected (the check is skipped).
- **Risk level**: Low — the postcondition only activates when a `VERSION` file exists and the version wasn't bumped. The deterministic bump mirrors the exact same logic already in `/creating-prs` Steps 2–3.

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Double version bump (LLM bumps in skill + runner bumps in postcondition) | Low | `validateVersionBump()` checks `git diff main -- VERSION` — if the LLM already bumped, the diff will show changes and the postcondition passes. No double bump. |
| Deterministic bump uses wrong bump type | Low | Uses the same classification matrix as `/creating-prs` Step 2: `bug` → patch, `enhancement`/other → minor, last milestone issue → major |
| Runner crashes if `VERSION` file has invalid content | Low | Guard: if `VERSION` doesn't contain valid semver, skip version bumping (same guard as `/creating-prs` Step 2) |
| Manual workflow regression (AC4) | Very Low | No changes to `/creating-prs` SKILL.md — the skill's interactive flow via `AskUserQuestion` is untouched |
| Runner step config changes break existing configs | Very Low | No changes to step numbering or config schema — only prompt text and postcondition logic change |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| Separate runner step (Step 6.5) for version bumping | Add a dedicated step between commit/push and PR creation | Changes step numbering, breaks existing configs, requires step key additions. The postcondition pattern is more consistent with existing architecture. |
| Pre-step hook in Step 7 | Run version bump before launching `claude -p` for Step 7 | Would require a new "pre-step" concept in the runner. The postcondition pattern already exists and is well-tested. |
| Only reinforce the prompt (no postcondition) | Just make the Step 7 prompt more explicit about version bumping | Insufficient — the issue evidence shows 50% failure even with the skill's explicit Steps 2–3. Prompt reinforcement alone is not deterministic. |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
