# Root Cause Analysis: `startIssue` fails with dirty working tree from runner artifacts

**Date**: 2026-02-26
**Status**: Complete
**Author**: Claude

---

## Root Cause

The original gitignore fix (#57) added `ensureRunnerArtifactsGitignored()` to prevent runner artifacts from being committed. However, `.gitignore` only affects **untracked** files. If `.claude/sdlc-state.json` was committed to the target project before the fix, it remains tracked. Every time the runner writes to it, `git status --porcelain` shows it as modified (`M .claude/sdlc-state.json`).

The runner's own `validatePreconditions()` case 2 correctly filters `RUNNER_ARTIFACTS` from its dirty-tree check. But the `starting-issues` skill's Step 4 precondition uses raw `git status --porcelain` without any filtering — creating an asymmetry that causes the failure loop.

### Asymmetry Table

| Location | Filters RUNNER_ARTIFACTS? |
|----------|---------------------------|
| `validatePreconditions()` case 2 (runner-side) | YES |
| `starting-issues` SKILL.md Step 4 precondition | NO (the bug) |
| `autoCommitIfDirty()` dirty check | YES |
| `autoCommitIfDirty()` `git add -A` | NO (relies on .gitignore) |

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `openclaw/scripts/sdlc-runner.mjs` | ~582 | `RUNNER_ARTIFACTS` constant |
| `openclaw/scripts/sdlc-runner.mjs` | ~588-608 | `ensureRunnerArtifactsGitignored()` — adds to .gitignore but doesn't untrack |
| `openclaw/scripts/sdlc-runner.mjs` | ~1931-1932 | `main()` — calls ensureRunnerArtifactsGitignored() |
| `plugins/nmg-sdlc/skills/starting-issues/SKILL.md` | ~147-180 | Step 4 precondition — raw git status check |

---

## Fix Strategy

### Approach: Defense-in-depth (Runner self-heal + Skill resilience)

Two complementary fixes:

**Fix 1 — Runner-side (self-heal):** Add `untrackRunnerArtifactsIfTracked()` that uses `git ls-files --error-unmatch` to detect tracked artifacts and `git rm --cached` to untrack them. Called in `main()` after `ensureRunnerArtifactsGitignored()`. This is a one-time operation per project.

**Fix 2 — Skill-side (belt-and-suspenders):** Update `starting-issues` SKILL.md Step 4 to filter lines matching known runner artifact paths before evaluating whether the tree is clean.

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `openclaw/scripts/sdlc-runner.mjs` | Add `untrackRunnerArtifactsIfTracked()` function after `ensureRunnerArtifactsGitignored()` | Self-heals projects where artifacts were committed before gitignore fix |
| `openclaw/scripts/sdlc-runner.mjs` | Call `untrackRunnerArtifactsIfTracked()` in `main()` after `ensureRunnerArtifactsGitignored()` | Must run after gitignore is set up so untracked files stay out |
| `plugins/nmg-sdlc/skills/starting-issues/SKILL.md` | Update Step 4 to filter `.claude/sdlc-state.json` and `.claude/auto-mode` from `git status` output | Prevents skill from aborting on runner artifacts even if runner fix hasn't run yet |

### Blast Radius

- **Direct impact**: `sdlc-runner.mjs` gains one new function and one call site. `starting-issues` SKILL.md gains a filtering instruction in Step 4.
- **Indirect impact**: Target projects with tracked runner artifacts will see a `git rm --cached` operation on first run after the fix. This changes git status but does not delete any files.
- **Risk level**: Low — `git rm --cached` only removes from the index, not from the filesystem. The skill-side change is additive guidance.

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `git rm --cached` deletes the state file | None | `--cached` only removes from index, not filesystem |
| `git rm --cached` fails on non-tracked file | None | Wrapped in try/catch; `ls-files --error-unmatch` pre-check |
| Skill allows real dirty files through | None | Only filters specific runner artifact paths, not arbitrary files |
| Runner writes state after untracking | None | That's expected — file is now untracked and gitignored |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| Only fix the skill (filter-only) | Whitelist runner artifacts in the skill | Doesn't fix root cause; tracked file still causes noise in `git status` |
| Only fix the runner (untrack-only) | Self-heal in the runner | Doesn't protect against race conditions or pre-fix runner versions |
| Auto-commit state file before each step | Commit `sdlc-state.json` as part of the workflow | Adds noisy commits to git history |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns
