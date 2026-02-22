# Defect Report: SDLC runner cross-cycle state contamination in issue number extraction

**Issue**: #62
**Date**: 2026-02-20
**Status**: Approved
**Author**: Claude (regenerated)
**Severity**: Critical
**Related Spec**: `.claude/specs/12-openclaw-sdlc-orchestration/`

---

## Reproduction

### Steps to Reproduce

1. Run the SDLC runner continuously with multiple sequential issues (e.g., #121, #122)
2. Let issue #121 complete its full 9-step cycle (PR merged)
3. The runner starts a new cycle and creates branch `122-fix-tabs-activate-list-sync` for issue #122
4. `extractStateFromStep` parses the step 2 JSON output — the first `#N` match is `#121` (from conversation context referencing the previous cycle)
5. `state.currentIssue` is set to `121` instead of `122`
6. Steps 3–4 run against issue #121's specs instead of #122's
7. `autoCommitIfDirty` commits with message `"feat: implement issue #121"` on branch 122

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | macOS (Darwin 25.3.0) |
| **Version / Commit** | nmg-plugins v2.12.6 |
| **Browser / Runtime** | Node.js, Claude Code CLI |
| **Configuration** | Continuous SDLC runner with multiple sequential issues |

### Frequency

Always — occurs whenever the previous issue's number appears before the new issue's number in the step 2 JSON output.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | After step 2 completes, `state.currentIssue` reflects the issue that was actually selected and branched (e.g., `122`), and the working tree is clean at cycle start |
| **Actual** | `state.currentIssue` was set to `121` (the previous issue) due to regex matching the first `#N` in the JSON output; working tree carried over uncommitted files from the previous cycle |

### Error Output

```
# No error — the bug is silent. The wrong issue number is assigned without any error.
# Symptom: branch `122-fix-tabs-activate-list-sync` receives commit "feat: implement issue #121"
```

---

## Root Cause

Two issues in `openclaw/scripts/sdlc-runner.mjs` combine to produce this defect:

1. **Fragile issue number extraction** — `extractStateFromStep` uses `output.match(/#(\d+)/)` to extract the selected issue number after step 2. This regex matches the **first** `#N` pattern anywhere in the entire JSON stdout blob (including conversation transcript, tool calls, and system prompt content). If a previously-completed issue number appears before the newly-selected one, `state.currentIssue` gets poisoned.

2. **No working tree cleanup between cycles** — Step 1's prompt is only `git checkout main && git pull`. It does not run `git clean -fd` or equivalent, so uncommitted or untracked files from the previous cycle persist and carry over to the next feature branch.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Issue number is extracted reliably from step 2 output

**Given** the SDLC runner completes step 2 (startIssue) and the Claude session selected issue #122
**When** `extractStateFromStep` parses the step 2 output
**Then** `state.currentIssue` is set to `122`, not any previously-referenced issue number

### AC2: Git branch name is used as ground truth for issue number

**Given** step 2 creates a feature branch named `122-feature-slug`
**When** the runner extracts state after step 2
**Then** the issue number is derived from the branch name (which is deterministic), not regex-matched from conversation text

### AC3: Working tree is clean at cycle start

**Given** the runner just completed a full 9-step cycle for issue #121
**When** the runner starts a new cycle (step 1)
**Then** the working tree is clean (no uncommitted or untracked files from the previous cycle)

### AC4: No regression — normal cycle still works

**Given** a clean repository with open issues
**When** the runner processes an issue through all 9 steps
**Then** the correct issue number is used in all commit messages, prompts, and state throughout the cycle

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Extract issue number from branch name (ground truth) instead of regex on JSON output | Must |
| FR2 | Add `git clean -fd` or equivalent working tree cleanup at cycle start (step 1) | Should |
| FR3 | Add a state validation check: `currentIssue` from extraction must match the branch name pattern | Should |

---

## Out of Scope

- Restructuring the step execution model (e.g., parallelism)
- Changes to the starting-issues skill itself
- Adding integration tests for multi-cycle scenarios (separate issue)

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC4)
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
