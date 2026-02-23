# Root Cause Analysis: SDLC runner cross-cycle state contamination in issue number extraction

**Issue**: #62
**Date**: 2026-02-20
**Status**: Approved
**Author**: Claude (regenerated)

---

## Root Cause

The SDLC runner's `extractStateFromStep` function used a fragile regex (`output.match(/#(\d+)/)`) to extract the selected issue number from the step 2 Claude session output. This regex matched the **first** `#N` pattern anywhere in the entire JSON stdout blob — which includes the full conversation transcript, tool calls, tool results, and system prompt content. When a previously-completed issue number appeared in the output before the newly-selected issue number, `state.currentIssue` was poisoned with the wrong value.

Compounding this, step 1's prompt (`git checkout main && git pull`) did not include any working tree cleanup. Uncommitted or untracked files from the previous cycle persisted and carried over to the next feature branch, creating additional cross-cycle contamination.

The `detectAndHydrateState` function (line 214) already correctly extracted issue numbers from branch names using `branch.match(/^(\d+)-(.+)$/)`, proving the branch-name approach was reliable. The inconsistency between these two extraction methods was the core design flaw.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `openclaw/scripts/sdlc-runner.mjs` | ~1102-1131 | `extractStateFromStep` — post-step state extraction, specifically the step 2 handler |
| `openclaw/scripts/sdlc-runner.mjs` | ~798 | Step 1 prompt — `buildClaudeArgs` function, missing working tree cleanup commands |

### Triggering Conditions

- The runner must process multiple issues sequentially (multi-cycle operation)
- The step 2 JSON output must contain a reference to a previous issue number before the current one
- This is virtually guaranteed in practice because Claude's conversation context includes system prompt content and prior tool results that reference completed issues

---

## Fix Strategy

### Approach

Replace the fragile regex-on-output approach with deterministic branch-name extraction, matching the pattern already used by `detectAndHydrateState`. After step 2 completes, the runner checks which branch git is on (`git rev-parse --abbrev-ref HEAD`), then extracts the issue number from the branch name pattern `{number}-{slug}`. This is deterministic because `/starting-issues` always creates branches in this format.

For working tree cleanup, add `git clean -fd && git checkout -- .` to step 1's prompt so that the working tree is pristine before each new cycle begins.

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `openclaw/scripts/sdlc-runner.mjs` (`extractStateFromStep`, step 2 handler) | Replace regex-on-output with branch name extraction via `git rev-parse --abbrev-ref HEAD` + `branch.match(/^(\d+)-/)` | Branch name is deterministic ground truth; conversation output is unreliable |
| `openclaw/scripts/sdlc-runner.mjs` (`extractStateFromStep`, step 2 handler) | Remove regex fallback entirely; log warning if branch extraction fails | Prevents silent fallback to the fragile regex path |
| `openclaw/scripts/sdlc-runner.mjs` (`buildClaudeArgs`, step 1 prompt) | Add `git clean -fd && git checkout -- .` to step 1's prompt | Ensures working tree is clean at cycle start, preventing file carryover |

### Blast Radius

- **Direct impact**: `extractStateFromStep` step 2 handler and `buildClaudeArgs` step 1 prompt
- **Indirect impact**: All downstream steps (3–9) that depend on `state.currentIssue` — these now receive the correct value
- **Risk level**: Low — the branch-name extraction approach is identical to what `detectAndHydrateState` already uses successfully

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Branch extraction fails if step 2 doesn't create a branch (e.g., Claude errors out) | Low | Warning logged; `currentIssue` stays null, which triggers existing error handling in `preconditionsMet` |
| `git clean -fd` removes intentional untracked files | Very Low | Step 1 always starts from main; no intentional untracked files should exist at cycle boundaries |
| Branch name doesn't follow `{number}-{slug}` pattern | Very Low | `/starting-issues` always creates branches in this format; `detectAndHydrateState` relies on the same assumption |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| Improve the regex to be more targeted | Use a more specific pattern to find the newly-selected issue number in Claude's output | The conversation output is inherently unpredictable; any regex approach is fragile |
| Use structured output from Claude (JSON mode) | Ask Claude to output the selected issue number in a structured format | Adds complexity; branch name is simpler and already deterministic |
| Parse `gh issue` output after step 2 | Query GitHub API for the most recently-assigned issue | Adds an API call; branch name is local and instant |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
