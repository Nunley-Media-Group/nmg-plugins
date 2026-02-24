# Root Cause Analysis: Validate git cleanliness before branching in /starting-issues

**Issue**: #84
**Date**: 2026-02-24
**Status**: Draft
**Author**: Claude

---

## Root Cause

The `/starting-issues` skill (`plugins/nmg-sdlc/skills/starting-issues/SKILL.md`) proceeds directly from issue selection (Steps 1–3) to branch creation (Step 4) without verifying that the git working tree is clean. Step 4 begins by checking the current branch name via `git branch --show-current`, then calls `gh issue develop N --checkout --name N-feature-name` to create and switch to the feature branch.

The `gh issue develop` command creates a new branch from the current HEAD and checks it out. If there are staged or unstaged changes in the working tree, git carries those changes into the new branch. This means unrelated modifications from a previous failed commit, aborted merge, or other workflow step silently leak into the new feature branch.

The `sdlc-runner.mjs` orchestrator has its own precondition checks at the runner level, but the skill itself has no guard. This means direct invocation of `/starting-issues` (not via the runner) is vulnerable to dirty-tree issues.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `plugins/nmg-sdlc/skills/starting-issues/SKILL.md` | 119–135 (Step 4) | Branch creation logic — no working tree check before `gh issue develop` |

### Triggering Conditions

- The working tree has staged changes (from a failed `git commit`, a partial `git add`, etc.)
- OR the working tree has unstaged modifications (edited files not yet staged)
- AND `/starting-issues` is invoked (either interactively or via auto-mode)
- The skill reaches Step 4 and proceeds to `gh issue develop` without checking tree cleanliness

---

## Fix Strategy

### Approach

Add a precondition check at the very beginning of Step 4 (before the existing `git branch --show-current` check) that runs `git status --porcelain` and inspects the output. If the output is non-empty, the skill aborts with an error message that lists the dirty files.

For auto-mode, the error output follows the escalation pattern used elsewhere in the skill (e.g., the "No automatable issues found" exit): a structured message that the `sdlc-runner.mjs` can parse as a reason for escalation.

This is a Markdown-only change — the SKILL.md file is a prompt, not executable code. The fix adds a new subsection to Step 4 with clear instructions for Claude to follow.

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `plugins/nmg-sdlc/skills/starting-issues/SKILL.md` | Add a "Working Tree Check" subsection at the beginning of Step 4, before the existing branch check. Instructions: run `git status --porcelain`, if output is non-empty abort with error listing dirty files. In auto-mode, format as escalation. | Addresses the root cause — no cleanliness guard before branching |

### Blast Radius

- **Direct impact**: `plugins/nmg-sdlc/skills/starting-issues/SKILL.md` — one file modified, one new subsection added
- **Indirect impact**: The `sdlc-runner.mjs` orchestrator already has its own precondition checks, so this change is additive defense-in-depth. The runner's behavior is unchanged.
- **Risk level**: Low — the change adds a guard that only triggers when the tree is dirty. Clean-tree invocations are completely unaffected.

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| False positive: skill aborts on a clean tree | Very Low | `git status --porcelain` produces no output on a clean tree — the check is well-defined |
| Auto-mode escalation format mismatch with runner expectations | Low | Use the same output pattern already established in the skill ("Done. Awaiting orchestrator." for successful exits, structured error message for failures) |
| POSIX compatibility of `git status --porcelain` | Very Low | `--porcelain` is a stable, cross-platform git flag designed for script consumption |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| Auto-stash before branching | Run `git stash` to save dirty state, branch, then restore | Too magical — user may not realize changes were stashed; violates "out of scope" in the issue |
| Check only staged changes | Only abort if `git diff --cached` is non-empty | Incomplete — unstaged changes also carry over to the new branch and cause confusion |

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #84 | 2026-02-24 | Initial defect design |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
