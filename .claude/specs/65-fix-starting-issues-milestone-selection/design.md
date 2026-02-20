# Root Cause Analysis: Starting-issues milestone selection iterates through random milestones

**Issue**: #65
**Date**: 2026-02-19
**Status**: Draft
**Author**: Claude Code

---

## Root Cause

The `/starting-issues` skill's Step 1 fetches milestone titles using `gh api repos/{owner}/{repo}/milestones --jq '.[].title'`, which strips all metadata — including the `open_issues` count that the GitHub API already returns. The subsequent instruction says "fetch open issues from the current/next milestone" but provides no algorithm for determining which milestone is "current" or "next." This ambiguity forces the agent to guess, iterating through milestones one-by-one with `gh issue list -m "<milestone>"` until it finds one with results.

The root issue is twofold: (1) the `--jq` filter discards the `open_issues` count that would enable filtering, and (2) the skill provides no deterministic selection logic for choosing among multiple milestones. On repos with many milestones where only one has open issues (e.g., chrome-cli with 8 milestones), this causes the agent to waste turns trying empty milestones before finding the right one.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `plugins/nmg-sdlc/skills/starting-issues/SKILL.md` | 45–63 | Step 1: Milestone fetching and issue discovery — the `gh api` call and the ambiguous "current/next" instruction |

### Triggering Conditions

- Repo has multiple milestones (more than one)
- Not all milestones have open issues (common as milestones are completed)
- `/starting-issues` is invoked without an explicit issue number argument
- The agent must discover issues by milestone rather than by direct number

---

## Fix Strategy

### Approach

Replace the milestone-fetching logic in Step 1 with a deterministic two-step process: (1) fetch milestones with `open_issues` metadata and filter to those with `open_issues > 0`, (2) apply selection logic based on the filtered result count. This changes only the "Fetch Milestones" and "Fetch Issues by Milestone" subsections of Step 1 — no other steps are affected.

The `gh api` call will use a `--jq` filter that returns both `title` and `open_issues`, then the skill instructions will provide explicit logic for three cases: zero viable milestones (fallback to all open issues), exactly one viable milestone (auto-select it), or multiple viable milestones (present to user, or pick first alphabetically in auto-mode).

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `plugins/nmg-sdlc/skills/starting-issues/SKILL.md` (lines 45–63) | Replace `--jq '.[].title'` with `--jq '[.[] | select(.open_issues > 0) | {title: .title, open_issues: .open_issues}] | sort_by(.title)'`; add deterministic selection logic for 0/1/N viable milestones | Fetches metadata needed for filtering, eliminates guessing |

### Blast Radius

- **Direct impact**: `plugins/nmg-sdlc/skills/starting-issues/SKILL.md` — only the milestone discovery subsection of Step 1
- **Indirect impact**: None — Step 2 (issue selection), Step 3 (confirmation), and Step 4 (branch creation) are unchanged. The output of Step 1 (a list of issues from a milestone) remains the same shape; only how the milestone is chosen changes.
- **Risk level**: Low — the fix narrows behavior (from ambiguous to deterministic), doesn't change the data flowing to downstream steps, and the fallback path (no milestones → all open issues) is preserved.

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Repos with no milestones stop working | Low | Existing fallback path preserved: "If no milestones are found... fall back to all open issues" |
| `--jq` filter syntax incompatible with older `gh` versions | Low | `select()` and `sort_by()` are standard jq built-ins available in all supported `gh` CLI versions |
| Auto-mode milestone selection differs from previous behavior | Low | Previous behavior was non-deterministic (guessing); new behavior (first alphabetically) is strictly better and matches the "oldest first" convention used for issue selection |
| Multiple viable milestones no longer iterate automatically | Low | The iteration was the bug — presenting options (or auto-selecting first) is the intended fix per AC3 |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| Fetch milestones with `due_on` and sort by due date | Would prioritize milestones by deadline | Adds complexity; not all milestones have due dates set; `open_issues > 0` filter is sufficient to solve the reported bug |
| Keep title-only fetch, add instruction to check issue count per milestone | Would tell agent to run `gh issue list` for each milestone and track which has results | This is essentially documenting the current buggy behavior — it still iterates through milestones |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
