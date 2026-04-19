# Design: Creating PRs Skill

**Issues**: #8, #128
**Date**: 2026-04-18
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/open-pr` skill is the final step of the interactive SDLC workflow. It gathers context from the GitHub issue, spec files, git state, and verification results, then generates a structured PR body and creates the pull request via `gh pr create`. The skill uses conventional commit prefixes for PR titles and includes acceptance criteria as a checklist for reviewers.

The skill has `disable-model-invocation: true` in its frontmatter, meaning it follows the SKILL.md instructions deterministically without model-driven behavior. This makes PR creation predictable and reproducible.

**Issue #128 extension:** After PR creation completes in interactive mode, the skill now offers an optional CI-monitor + auto-merge step that mirrors the unattended runner's semantics (`gh pr checks` polling → `gh pr merge --squash --delete-branch` → local branch cleanup). The unattended branch of the skill remains untouched — when `.claude/unattended-mode` exists, the runner retains full ownership of monitoring and merging.

---

## Architecture

### Component Diagram

```
┌────────────────────────────────────────────┐
│          /open-pr Skill                     │
├────────────────────────────────────────────┤
│  Step 1: Read Context                       │
│    ├── gh issue view #N                     │
│    ├── specs/{feature}/req.md               │
│    ├── specs/{feature}/tasks.md             │
│    ├── git status, git log, git diff        │
│  Step 2: Determine Version Bump             │
│  Step 3: Update Version Artifacts           │
│  Step 4: Generate PR Content                │
│    ├── Title (conventional commit prefix)   │
│    └── Body (summary, ACs, test plan, specs)│
│  Step 5: Push and Create PR                 │
│    ├── git push -u origin HEAD              │
│    └── gh pr create                         │
│  Step 6: Output (base case)                 │
│                                             │
│  Step 7 (Issue #128, interactive only):     │
│    ├── AskUserQuestion: monitor or skip?    │
│    ├── If monitor:                          │
│    │    ├── Poll gh pr checks (30s cadence) │
│    │    ├── On all-success:                 │
│    │    │    ├── gh pr merge --squash       │
│    │    │    │   --delete-branch            │
│    │    │    └── git branch -D <branch>     │
│    │    └── On failure/non-mergeable:       │
│    │         └── print failing checks,      │
│    │            exit (no merge, no delete)  │
│    └── If skip: fall through to Step 6 out  │
└────────────────────────────────────────────┘

Unattended branch (.claude/unattended-mode present):
  Step 6 output: "Done. Awaiting orchestrator."
  Step 7 actively suppressed (no prompt, no poll, no merge)
  sdlc-runner.mjs continues to own CI + merge.
```

### Data Flow

```
1. Read issue, specs, and git state
2. Determine version bump (if VERSION file exists)
3. Update VERSION + CHANGELOG + stack-specific files
4. Generate PR title + body
5. Ensure branch is pushed; gh pr create
6. Output PR URL (interactive: "Next step..." / unattended: "Done. Awaiting orchestrator.")

[Interactive-only, Issue #128]
7. Prompt: monitor CI + auto-merge, or skip?
   ├── monitor → poll gh pr checks every 30s
   │     ├── all success → gh pr merge --squash --delete-branch → git branch -D
   │     └── any failure / non-mergeable / no checks → print, exit without merging
   └── skip → exit with original Step 6 "Next step" output
```

---

## File Changes

| File | Type | Purpose |
|------|------|---------|
| `plugins/nmg-sdlc/skills/open-pr/SKILL.md` | Create | Original (Issue #8): 4-step workflow |
| `plugins/nmg-sdlc/skills/open-pr/SKILL.md` | Modify | Issue #128: Add Step 7 (interactive CI monitor + auto-merge); update `allowed-tools` to add `Bash(sleep:*)` (required for 30-second poll interval — not covered by `Bash(gh:*)` or `Bash(git:*)`); restructure Step 6 output so the existing "Next step..." message becomes the opt-out fallback |
| `specs/feature-open-pr-skill/feature.gherkin` | Modify | Add scenarios for AC5–AC9 |

---

## API / Interface Changes

### New Shell Invocations (Issue #128)

| Command | Purpose | Notes |
|---------|---------|-------|
| `gh pr checks <num> --json name,state,link` | Poll required checks with structured output | `state` values: SUCCESS, FAILURE, PENDING, IN_PROGRESS, CANCELLED, TIMED_OUT, SKIPPED |
| `gh pr checks <num>` (fallback) | Plain-text fallback when `--json` not available | Parse "no checks reported" to detect no-CI scenario |
| `gh pr merge <num> --squash --delete-branch` | Squash-merge and delete the remote branch atomically | Preferred over separate `gh pr merge` + `gh api` branch delete |
| `gh pr view <num> --json mergeable,mergeStateStatus` | Pre-merge mergeability check | Treat `CONFLICTING` or non-`CLEAN` mergeStateStatus as a failure |
| `git branch -D <branch>` | Delete the local feature branch after remote merge | Run `git checkout main` first to detach from the branch being deleted |
| `git checkout main` | Return to main before deleting the feature branch | Required since `git branch -D` cannot delete the checked-out branch |

### Polling Cadence

| Constant | Value | Rationale |
|----------|-------|-----------|
| Poll interval | 30 seconds | Matches `sdlc-runner.mjs` Step 8 prompt (line 937) — keeps runner/skill behavior aligned |
| Poll timeout | 30 minutes total | Generous enough for typical CI runs; prevents a stuck skill from hanging the user's session indefinitely |
| Max polls | 60 (30min / 30s) | Deterministic upper bound |

### Terminal-State Mapping

| `gh pr checks` state | Skill action |
|----------------------|--------------|
| SUCCESS | Keep polling other checks; all SUCCESS → merge |
| PENDING, IN_PROGRESS, QUEUED | Keep polling |
| FAILURE, CANCELLED, TIMED_OUT | Report failure, exit without merging |
| SKIPPED, NEUTRAL | Treat as SUCCESS (standard GitHub semantics) |
| "no checks reported" (plain text) | Report "No CI configured — skipping auto-merge"; exit without merging (graceful skip per retrospective learning on absent integrations) |

---

## Database / Storage Changes

None. The skill operates on GitHub state (via `gh`) and local git state only.

---

## State Management

None. Skill state is implicit in shell invocations; no persistent state files are introduced.

---

## UI Components

No UI components. The new interactions are text-mode:
- `AskUserQuestion` with two options (monitor vs skip)
- Periodic status output during polling (e.g., `Polling checks... 3/5 complete`)
- Final status line (merged / failed / skipped)

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Always monitor unless user declines** | Default to monitoring post-PR-create | Faster ship cycle | Surprising; changes default behavior for existing users | Rejected — keep opt-in explicit |
| **B: Prompt with opt-in option (selected)** | Two-choice AskUserQuestion, user explicitly opts in | Preserves existing behavior for skeptics; clear intent | One extra prompt | **Selected** |
| **C: Separate `/ship` skill** | New skill that wraps `/open-pr` + monitor + merge | Keeps `/open-pr` surface untouched | Duplicates skill surface; two similar skills is confusing | Rejected — the enhancement belongs in `/open-pr` |
| **D: Reuse runner's gh pr checks loop verbatim** | Mirror the exact runner prompt for polling | Zero behavioral drift | Runner's prompt is for a `claude -p` subprocess; in-skill we execute directly | Partially adopted — reuse the 30s cadence and "no checks reported" handling, but express as deterministic skill steps rather than an AI-driven retry loop |

---

## Security Considerations

- [x] PR creation via authenticated `gh` CLI — no tokens in PR body
- [x] `gh pr merge` uses the same authenticated session — no elevated privilege
- [x] `git branch -D` only operates on the local feature branch (never `main`, never force-pushes)
- [x] Check details URLs come from `gh pr checks --json link` — not user-controlled input, safe to print
- [x] `Closes #N` links are safe GitHub references

---

## Performance Considerations

- [x] Single `gh pr create` API call
- [x] 30-second poll cadence avoids rate-limit churn (matches runner)
- [x] 30-minute total polling timeout prevents indefinite hangs
- [x] `disable-model-invocation: true` — deterministic execution, no model cost during polling loop
- [x] Local file reads for specs and git state

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| PR Creation | BDD | Scenarios for issue linking, spec references, unattended-mode (AC1–AC4) |
| Interactive CI monitor | BDD | Opt-in happy path, opt-out, CI failure, no-CI, unattended suppression (AC5–AC9) |
| Exercise test | Manual | Load modified plugin, invoke `/open-pr` against a test repo with a real PR; verify both branches (interactive + unattended) |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Polling hangs indefinitely on stuck CI | Medium | High | 30-minute total timeout with explicit failure message |
| Skill merges a PR the user didn't intend to merge | Low | High | Two-option opt-in prompt; unattended branch actively suppresses |
| `git branch -D` fails because branch is checked out | Medium | Low | Explicitly `git checkout main` before deletion |
| Non-mergeable PR silently slips through | Low | High | Pre-merge `gh pr view --json mergeable` check; treat non-`CLEAN` as failure |
| Rate-limit from overly aggressive polling | Low | Medium | 30s cadence matches runner; `gh` CLI handles auth backoff |
| Interactive prompt leaks into unattended run | Low | High | Sentinel check gates the entire Step 7 block; AC9 is an active-suppression test |

---

## Open Questions

- [x] Polling cadence? *(30s — matches runner.)*
- [x] Merge strategy? *(Squash, hardcoded for this iteration — see Out of Scope.)*
- [ ] Should a future iteration surface merge strategy via `AskUserQuestion`? *(Deferred — out of scope for #128.)*

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #8 | 2026-02-15 | Initial feature spec |
| #128 | 2026-04-18 | Add interactive CI monitor + auto-merge design (Step 7); mirror runner polling cadence; document opt-in/opt-out and active unattended suppression |

---

## Validation Checklist

- [x] Architecture follows existing skill patterns
- [x] File changes documented
- [x] Security considerations addressed
- [x] Alternatives considered
- [x] Polling semantics aligned with `sdlc-runner.mjs` for consistency
- [x] Unattended branch behavior preserved (AC9 defensive check)
