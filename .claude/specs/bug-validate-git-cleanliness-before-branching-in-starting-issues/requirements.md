# Defect Report: Validate git cleanliness before branching in /starting-issues

**Issue**: #84
**Date**: 2026-02-24
**Status**: Draft
**Author**: Claude
**Severity**: Medium
**Related Spec**: `.claude/specs/feature-starting-issues-skill/`

---

## Reproduction

### Steps to Reproduce

1. Make changes and stage them (`git add .`)
2. Encounter a commit failure (e.g., pre-commit hook rejects the commit)
3. Staged changes remain in the working tree
4. Run `/starting-issues` to begin work on a new issue
5. `gh issue develop` creates a new branch with the staged changes carried over
6. New feature branch starts with unrelated staged changes

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | Any (macOS, Linux, Windows) |
| **Version / Commit** | nmg-sdlc plugin v2.17.1 |
| **Browser / Runtime** | Claude Code CLI (any version) |
| **Configuration** | Any project using `/starting-issues` |

### Frequency

Always — whenever the working tree is dirty at the time `/starting-issues` is invoked.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | The skill checks `git status --porcelain` before branching and aborts with a clear error listing dirty files if the working tree is not clean |
| **Actual** | The skill proceeds directly to `gh issue develop` without checking, carrying over any staged or unstaged changes to the new feature branch |

### Error Output

```
No error is produced — the skill silently succeeds with a dirty tree,
which is the core problem.
```

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Dirty Working Tree Blocks Branch Creation

**Given** the working tree has uncommitted changes (staged or unstaged)
**When** `/starting-issues` is invoked
**Then** the skill runs `git status --porcelain` before calling `gh issue develop`
**And** the skill aborts with a clear error message before any branch is created

### AC2: Auto-Mode Escalation for Dirty Tree

**Given** the working tree has uncommitted changes
**And** `.claude/auto-mode` exists
**When** `/starting-issues` is invoked
**Then** the dirty working tree is reported as an escalation reason (not a silent abort)
**And** no branch is created

### AC3: Diagnostic Error Message Lists Dirty Files

**Given** the working tree has uncommitted changes
**When** the skill aborts due to the dirty tree check
**Then** the error message includes the list of dirty files (output of `git status --porcelain`)
**And** the message clearly indicates the user/runner should resolve these changes before retrying

### AC4: Clean Working Tree Proceeds Normally

**Given** the working tree is clean (no staged or unstaged changes)
**When** `/starting-issues` is invoked
**Then** the skill proceeds to branch creation without any abort or error

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Run `git status --porcelain` as a precondition check before `gh issue develop` (Step 4 of the skill) | Must |
| FR2 | Abort with clear error listing dirty files if the tree is not clean | Must |
| FR3 | In auto-mode, report the dirty tree as an escalation reason rather than silently aborting | Should |

---

## Out of Scope

- Automatically cleaning the working tree (stashing, resetting, discarding changes)
- Adding similar git cleanliness checks to other skills (each should be addressed individually if needed)
- Changing the `sdlc-runner.mjs` precondition checks (the runner already has its own guards)

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #84 | 2026-02-24 | Initial defect spec |

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC4 — clean tree proceeds normally)
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
