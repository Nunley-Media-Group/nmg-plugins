# Root Cause Analysis: SDLC runner commits auto-mode file to target projects

**Issue**: #57
**Date**: 2026-02-19
**Status**: Draft
**Author**: Claude

---

## Root Cause

The SDLC runner creates two temporary artifacts in the target project: `.claude/auto-mode` (a flag file for headless operation) and `.claude/sdlc-state.json` (runner state). The `RUNNER_ARTIFACTS` constant at line 477 enumerates these files and is used by `autoCommitIfDirty()` at lines 496-500 to filter them from the "should we commit?" decision. However, this filtering only controls **whether** a commit happens — once the decision to commit is made, `git add -A` stages **everything** not in `.gitignore`.

The nmg-plugins repo itself has these patterns in its `.gitignore`, so the bug is invisible during dogfooding. But target projects configured via `sdlc-config.json` may not have them gitignored, causing runner artifacts to be silently committed alongside real implementation changes.

There are four `git('add -A')` call sites, and only one (`autoCommitIfDirty` at line 512) has the artifact filtering logic. The other three (failure handler at line 983, escalation handler at line 1037, signal handler at line 1273) perform unconditional `git add -A` without any filtering.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `openclaw/scripts/sdlc-runner.mjs` | 477 | `RUNNER_ARTIFACTS` constant — lists the files to protect |
| `openclaw/scripts/sdlc-runner.mjs` | 490-521 | `autoCommitIfDirty()` — filters artifacts from dirty check but `git add -A` still stages them |
| `openclaw/scripts/sdlc-runner.mjs` | 977-990 | `handleFailure()` — unconditional `git add -A` before retry |
| `openclaw/scripts/sdlc-runner.mjs` | 1033-1041 | `escalate()` — unconditional `git add -A` before escalation |
| `openclaw/scripts/sdlc-runner.mjs` | 1269-1277 | Signal handler — unconditional `git add -A` on shutdown |
| `openclaw/scripts/sdlc-runner.mjs` | 1433-1440 | `main()` — creates `.claude/auto-mode` without ensuring gitignore coverage |

### Triggering Conditions

- Target project's `.gitignore` does not include `.claude/auto-mode` or `.claude/sdlc-state.json`
- Any of the four `git add -A` call sites executes
- The runner artifacts exist in the working tree at commit time

---

## Fix Strategy

### Approach

Add an `ensureRunnerArtifactsGitignored()` function that checks the target project's `.gitignore` for each `RUNNER_ARTIFACTS` entry and appends any missing patterns. Call this function in `main()` **before** creating `.claude/auto-mode` (before line 1434). This is a single-point fix — once the artifacts are in `.gitignore`, all four `git add -A` call sites automatically exclude them.

The function will:
1. Read the existing `.gitignore` (or start with an empty string if it doesn't exist)
2. Check each `RUNNER_ARTIFACTS` entry against existing lines
3. Append missing entries with a comment header
4. Write the file only if changes were made

This approach is idempotent (safe to call multiple times) and preserves existing `.gitignore` content.

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `openclaw/scripts/sdlc-runner.mjs` | Add `ensureRunnerArtifactsGitignored()` function near line 477 (after `RUNNER_ARTIFACTS`) | Centralizes the gitignore check next to the artifact list it references |
| `openclaw/scripts/sdlc-runner.mjs` | Call `ensureRunnerArtifactsGitignored()` in `main()` before auto-mode creation (before line 1434) | Ensures artifacts are gitignored before any are created |

### Blast Radius

- **Direct impact**: Only `sdlc-runner.mjs` is modified — one new function and one new call site
- **Indirect impact**: Target project `.gitignore` files gain new entries on first run. This is additive-only and does not affect existing entries.
- **Risk level**: Low — the fix is additive (appending to `.gitignore`) and only runs once per project (subsequent runs detect existing entries and skip)

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing `.gitignore` entries corrupted | Low | Function reads the full file, only appends, never modifies existing lines |
| Missing newline before appended entries | Low | Function checks if file ends with newline and adds one if needed |
| `.gitignore` created when it shouldn't be | Low | Creating a `.gitignore` with runner artifact entries is safe — it doesn't affect the project's existing git behavior for tracked files |
| Runner cleanup (removeAutoMode) breaks | Low | The cleanup function deletes the file directly with `fs.unlinkSync` — gitignore status has no effect on file deletion |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| Replace `git add -A` with explicit pathspecs | Change all four call sites to `git add` specific files instead of `-A` | More invasive change; would need to enumerate all legitimate files to stage, which varies per step. Also explicitly marked out of scope in the issue. |
| Add `.gitignore` entries to the runner config template | Require users to configure gitignore patterns in `sdlc-config.json` | Shifts responsibility to the user; easy to forget; the runner creates these files so it should protect them |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
