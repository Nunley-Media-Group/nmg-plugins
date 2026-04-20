# Design: First-Class Epic Support and Multi-PR Delivery Flow

**Issues**: #149
**Date**: 2026-04-19
**Status**: Draft
**Author**: Rich Nunley

---

## Overview

This feature adds a third first-class issue type — **Epic** — to the nmg-sdlc pipeline, plus a **seal-spec** flow and sibling-aware coordination across four existing pipeline skills. The goal is to eliminate today's improvised coordination for multi-PR features: an epic issue becomes a genuine coordination artifact, the umbrella spec gets committed without a version bump via seal-spec, child issues resolve back to the parent spec by link (not keyword), and both `/open-pr` and `sdlc-runner.mjs` become sibling/dependency-aware.

The changes are **surgical and local to four existing files** — no new skill is added. Epic support is threaded through `/draft-issue` (classification + body template), `/write-spec` (parent-link resolution + seal-spec), `/open-pr` (sibling-aware bumping), and `sdlc-runner.mjs` (topological ordering). No new external dependencies: all GitHub coordination goes through existing `gh` CLI calls, and dependency graphs are re-derived from live GitHub state on every runner tick per the retrospective learning about stale-cache contamination.

Where the changes are prompt-only (Markdown skill edits), `skill-creator` drives the authoring per the `Invariant: Skills must be authored via /skill-creator` contract in `steering/structure.md`. Where the change is code (`sdlc-runner.mjs`), standard edit tools apply.

---

## Architecture

### Component Diagram

The feature fans out across three skill files and one Node.js script, all within the existing plugin layer per `steering/structure.md`. No new layer is introduced.

```
┌───────────────────────────────────────────────────────────────────────┐
│                           SDLC Pipeline (existing)                     │
├───────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐         │
│  │ /draft-issue   │──▶│ /start-issue   │──▶│ /write-spec    │         │
│  │ + Epic class.  │   │ (unchanged)    │   │ + parent link  │         │
│  │ + Epic body    │   │                │   │ + seal-spec    │         │
│  └───────┬────────┘   └────────────────┘   └───────┬────────┘         │
│          │ (creates children)                       │ (seal commit)    │
│          ▼                                          ▼                  │
│   GitHub Issues ◀───────────────────────────── specs/{feature}/        │
│   (epic + sub-issues)                                                  │
│                                                                        │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐         │
│  │ /write-code    │──▶│ /verify-code   │──▶│ /open-pr       │         │
│  │ (unchanged)    │   │ (unchanged)    │   │ + sibling bump │         │
│  └────────────────┘   └────────────────┘   └───────┬────────┘         │
│                                                    │                   │
└────────────────────────────────────────────────────┼──────────────────-┘
                                                     │
                                                     ▼
                                              ┌──────────────┐
                                              │ sdlc-runner  │
                                              │ + topo queue │
                                              └──────────────┘
```

### Data Flow: Epic Lifecycle

```
1. User invokes /draft-issue with a multi-phase description
2. Step 1b-1d detects multi-phase signals → Step 2 offers Epic classification
3. User picks Epic → Step 6 synthesizes epic coordination body (Goal / Phases / Child Checklist)
4. Step 10 creates epic issue, then creates each child via the existing batch mechanism
5. Each child issue gets a "Depends on: #epic" line in its body and native GH sub-issue parent link
6. User invokes /write-spec on the EPIC → writes requirements/design/tasks describing multi-PR rollout
7. At Phase 3 gate approval, /write-spec detects multi-PR trigger → offers seal-spec
8. Seal-spec: commit specs/{feature}/, push, print next-step `/start-issue #{first-child}`
9. User (or runner) invokes /start-issue on first child → branch created
10. User invokes /write-spec on child → parent-link resolver finds epic spec → amendment mode
11. Normal /write-code → /verify-code → /open-pr flow on the child
12. /open-pr checks sibling state → patch bump (if other children still open) or minor (if final child)
13. Runner, on each tick, builds dependency graph → skips blocked children → picks next unblocked
```

---

## API / Interface Changes

All changes are internal to the plugin; there are no public API or HTTP interface changes. The "interfaces" below are the observable contracts between skills and between the runner and GitHub.

### New Skill Interfaces

| Interface | Type | Purpose |
|-----------|------|---------|
| `/draft-issue` Epic type output | Issue body contract | Consumed by `/write-spec` parent-link resolution |
| `/write-spec` seal-spec commit | Git commit with specific message shape | Signals to runner/human that spec is sealed |
| `/open-pr` PR body classification line | `**Bump:** patch \| minor (epic child: intermediate \| final)` | Audit trail for bump decision |

### Epic Issue Body Contract (Step 6 of /draft-issue, Epic variant)

**Required shape** (consumed by `/write-spec` parent-link resolution and `/open-pr` sibling detection):

```markdown
## Goal

[1-3 sentences describing what this epic delivers when all children merge.]

## Delivery Phases

| Phase | Child Issue | Depends On | Summary |
|-------|-------------|------------|---------|
| 1 | #{placeholder-1} | — | [short desc] |
| 2 | #{placeholder-2} | #{placeholder-1} | [short desc] |

## Success Criteria

Each child issue owns its own acceptance criteria — this epic is a coordination document only.

## Child Issues

- [ ] #{placeholder-1} — [short desc]
- [ ] #{placeholder-2} — [short desc]
```

After Step 10 creates children, placeholders are replaced with real issue numbers and the body is edited in place via `gh issue edit`.

### Child Issue Body Contract

Every child created via an Epic's batch flow MUST include these lines in its body so `/write-spec` and `/open-pr` can discover the parent:

```markdown
Depends on: #{epic-number}
<!-- and, if the child has intra-epic prerequisites -->
Depends on: #{sibling-number}
```

The `Depends on:` line is the authoritative cross-ref. GitHub's native sub-issue parent field is set in parallel (via `gh issue edit --add-parent`), giving a redundant signal.

### `/open-pr` Sibling-Detection Query

```bash
# Given current issue #N with Depends on: #E in body
gh issue view $E --json closedByPullRequestsReferences,state,body
# Parse #E's "Child Issues" checklist and body cross-refs
# For each child issue #C (excluding #N), query:
gh issue view $C --json state,closedByPullRequestsReferences
# Classify: all closed with merged PRs → minor bump; any open or no merged PR → patch bump
```

### Runner Dependency-Graph Query (each tick, no cache)

```bash
# For each open issue in the current milestone:
gh issue view $N --json number,state,body,parent,closedByPullRequestsReferences
# Parse body for: Depends on: #A, #B → edge list
# GitHub sub-issue parent field → add implicit parent→child edge
# Build adjacency list; compute which issues are ready (all deps have merged PRs)
# Pick lowest-numbered ready issue
```

---

## Database / Storage Changes

### `sdlc-state.json` (runtime state, **not** persisted across cycles)

No schema change. Dependency graphs are **deliberately not cached** in `sdlc-state.json` per the retrospective learning "When specifying features that loop over multiple work units with shared runtime state, specs say 'reset state between iterations' at a high level but omit ACs about the data source used to derive identifiers." The graph is re-derived from live `gh issue view` output on every runner tick to prevent stale-state contamination across cycles.

### Spec Frontmatter (no change to format)

The existing `**Issues**: #A, #B` plural field is already sufficient. No new frontmatter fields. The Change History table is extended when children amend a parent spec — existing mechanism.

### Epic Issue Body (no database — it IS the coordination state)

Epic issue bodies are authoritative state for:
- Which children belong to the epic (Child Issues checklist)
- Phase ordering (Delivery Phases table)

No separate database or config file tracks these — GitHub issues ARE the source of truth, per `steering/product.md`'s "Spec as source of truth" principle extended to cross-issue coordination.

---

## State Management

### Epic Classification State (within `/draft-issue`)

The classification is a one-time decision at Step 2. State transitions:

```
Step 1 (Capture) → Step 1b-1d (Detect multi-issue) → Step 2 (Classify)
  ↓
  ├── User picks Feature → existing flow (Steps 3–10)
  ├── User picks Bug → existing flow (Steps 3–10)
  └── User picks Epic → Step 6 uses Epic template → Step 10 creates epic + children in batch
```

### Seal-Spec State (within `/write-spec`)

The seal decision is a one-time action at the end of Phase 3. State transitions:

```
Phase 3 approved → Check design.md for multi-PR trigger
  ↓
  ├── Not multi-PR → Existing "After Completion" message
  └── Multi-PR → Offer seal option
      ↓
      ├── User declines seal → Existing "After Completion" message with manual hint
      └── User approves seal
          ↓
          ├── Spec already sealed at current HEAD → print no-op message
          └── Fresh seal → commit + push + offer child creation
                ↓
                ├── Decline child creation → print manual next-step hint
                └── Approve → re-invoke /draft-issue Steps 1b-1d in batch mode
```

Seal detection is stateless — `git log --grep='^docs: seal umbrella spec for #N$'` against the current branch determines if the seal commit already exists.

### Runner Dependency-Graph State

Graph is rebuilt on every call to `selectNextIssue()`. No persistence. The existing `sdlc-state.json` fields are unchanged.

---

## UI Components

**N/A** — this is a CLI/skill feature. The only "UI" is:

| Surface | Change |
|---------|--------|
| `AskUserQuestion` in `/draft-issue` Step 2 | Add third option "Epic" with description |
| `AskUserQuestion` at `/write-spec` Phase 3 gate | Add "Seal and transition" option when multi-PR trigger fires |
| Runner stdout log lines | New `[runner] skipping #N — blocked by unmerged dependencies: #A` format |
| PR body footer | New `**Bump:** patch (epic child: intermediate)` classification line |

All four surfaces respect `.claude/unattended-mode` per FR8.

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Standalone `/seal-spec` skill** | Extract seal-spec into its own user-invocable skill | Cleaner separation, reusable outside `/write-spec` | Extra skill to maintain, breaks pipeline "one skill per step" invariant, requires users to remember a new command | Rejected — keep inline per issue guidance; revisit in a follow-up if seal-spec reuse emerges |
| **B: Inline seal-spec in `/write-spec` Phase 3** | Add seal option to the Phase 3 approval gate when multi-PR trigger detected | No new skill, preserves pipeline chain, trigger-driven (only appears when relevant) | `/write-spec` grows slightly; users can't invoke seal-spec standalone | **Selected** |
| **C: Cache dependency graph in `sdlc-state.json`** | Persist graph across runner ticks for performance | Faster runner tick (one `gh` call instead of N) | Stale-cache contamination risk (retrospective learning `bug-fix-sdlc-runner-cross-cycle-state-contamination`); graph becomes wrong after any manual GitHub edit | Rejected |
| **D: Re-derive graph from GitHub each tick** | No caching; every `selectNextIssue()` queries `gh issue list` + per-issue `gh issue view` | Always current, resilient to manual GH edits | N API calls per tick | **Selected** — N is bounded (~20 in practice), and `gh` calls are sub-second |
| **E: Regex-only parent detection** | Parse only `Depends on: #N` lines from issue body | Zero dependency on GitHub sub-issue feature | Fails on child issues created without the body convention (e.g., manual GitHub-first children) | Rejected |
| **F: GitHub sub-issue API only** | Use only `gh issue view --json parent` | Cleaner, uses platform primitive | Legacy epic issues (#138) have no native parent link; breaks backward compatibility | Rejected |
| **G: Hybrid parent detection** | Parse body cross-refs + GitHub sub-issue parent field; union the candidate set | Covers both legacy issues and new ones | Slightly more complex resolution logic | **Selected** |
| **H: New `epic` label created eagerly at skill load** | Pre-create the label when `/draft-issue` loads | Label always present | Unexpected side effect on non-epic runs | Rejected |
| **I: Create `epic` label lazily on first epic issue** | Use existing `gh label list` → `gh label create` pattern from Step 10 (lines 931–950 of draft-issue/SKILL.md) | Follows existing idiom, zero side effect on non-epic runs | Trivial extra check | **Selected** |

---

## Detailed Change Plan (per-file)

### 1. `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`

All edits below go through `skill-creator` per the "Skills must be authored via `/skill-creator`" invariant.

**Step 2 extension (around lines 383–401):**
- Add "Epic" as a third option alongside Feature and Bug in the `AskUserQuestion` call
- Description: "A coordinated set of child issues delivering one logical feature across multiple PRs"
- Auto-detection: when Step 1b's signals fire (`distinctComponents ≥ 4`, multi-phase language, explicit `multiple PRs` keyword), mark Epic as "(Recommended)"
- Unattended-mode rule: never auto-select Epic; default to Feature unless the user description contains `Type: epic` on its own line

**New Step 6 Epic body template (around lines 699+):**
- New inline template matching the Epic Issue Body Contract above
- Placeholders for child issues are filled by Step 10

**Step 10 extension (around lines 931–950):**
- After creating the epic issue, invoke the existing batch child-creation mechanism from Steps 1b–1d with the epic's issue number as the parent
- For each child: include `Depends on: #{epic-number}` in the body, set `gh issue edit --add-parent {epic-number}` if the CLI supports it, apply labels inherited from the epic's milestone and type
- Lazy-create the `epic` label using the existing `gh label list` / `gh label create` pattern from lines 931–950; apply `epic` + `enhancement` to the parent; apply `enhancement` (not `epic`) to each child

### 2. `plugins/nmg-sdlc/skills/write-spec/SKILL.md`

**Spec Discovery extension (around lines 100–135):**
- Prepend a new Step 0: "Parent-link resolution"
  1. Extract `Depends on: #N` and `Blocks: #N` lines from the current issue body (multiple allowed)
  2. Query `gh issue view --json parent` for the GH sub-issue parent field
  3. Build candidate parent issue number set (union of body cross-refs + parent field)
  4. For each candidate, Glob `specs/*/requirements.md` and read `**Issues**` frontmatter
  5. If match found AND parent spec directory is committed: enter amendment mode
  6. If candidate found but spec directory is uncommitted: fail loudly with the AC7c message
  7. Cycle detection: maintain a visited set across recursive parent resolution (for nested epics) and terminate with a cycle-detected error on re-visit
- Keep existing keyword-based spec discovery as a fallback when no parent-link match

**Phase 3 seal-spec extension (around lines 311–415, new sub-section after the current approval gate):**
- After the user approves the tasks summary, check `design.md` for multi-PR trigger:
  - Presence of `## Multi-PR Rollout` section, OR
  - FR row whose Requirement text references "multiple PRs" or "multi-PR"
- If trigger fires (and not unattended mode): present seal option via `AskUserQuestion`
  - Option 1: "Seal and transition — commit specs, push, create child issues"
  - Option 2: "Don't seal — I'll handle child-issue creation manually"
- Seal action:
  1. Check for existing seal commit via `git log --format=%H --grep='^docs: seal umbrella spec for #{N}$' HEAD`
  2. If exists: print `Spec already sealed at commit {sha}` and skip to child creation
  3. Else: `git add specs/{feature-name}/ && git commit -m "docs: seal umbrella spec for #{N}"`
  4. `git push origin HEAD`
  5. Prompt for child-issue creation; if approved, re-invoke `/draft-issue` batch mechanism with the epic's delivery phases as the batch input
- Unattended-mode rule: auto-execute seal and auto-create children when trigger fires; suppress the two `AskUserQuestion` calls

### 3. `plugins/nmg-sdlc/skills/open-pr/SKILL.md`

**Step 2 extension (around lines 73–99):**
- After classifying bump type from the issue's labels, run sibling detection:
  1. Parse current issue body for `Depends on: #E` lines → candidate parent
  2. Fallback to `gh issue view --json parent` for sub-issue parent
  3. If parent found AND parent is labeled `epic`:
     - Read parent's Child Issues checklist from body
     - For each child (excluding current): `gh issue view $C --json state,closedByPullRequestsReferences`
     - All closed with merged PRs → keep the label-based bump (minor for enhancement)
     - Any open or no merged PR → **downgrade** to patch bump, flag as "intermediate"
- Otherwise: keep existing label-based bump

**Step 3 extension (around lines 105–108):**
- If bump was downgraded to intermediate-patch: append ` (partial delivery — see epic #{E})` to the primary CHANGELOG bullet
- Add `**Bump:** {patch|minor} (epic child: {intermediate|final})` line to the PR body footer

**Edge case AC7d (two PRs racing plugin.json):**
- After the bump-and-commit, before push: `git fetch origin && git merge-base --is-ancestor HEAD origin/main`
- If non-zero (base is stale): `git pull --rebase origin {base-branch}`
- Re-compute bump against the now-current `plugin.json` version
- If rebase has conflicts in `plugin.json` OR `marketplace.json`: abort with a clear error, do NOT force-push

### 4. `scripts/sdlc-runner.mjs`

**Milestone-issue selection (around lines 900–921):**
- Extract the current inline issue-selection prompt into a new JS function `selectNextIssueFromMilestone(milestone)` that:
  1. Lists all open `automatable`-labeled issues in the milestone via `gh issue list -s open -m "<milestone>" --label automatable --json number,body`
  2. For each candidate, fetches `gh issue view $N --json state,body,parent,closedByPullRequestsReferences`
  3. Builds an in-memory adjacency list from `Depends on: #N` body lines + parent field
  4. Filters to issues whose every dependency is either (a) closed with at least one merged PR, or (b) not in the milestone (external dep — assumed satisfied)
  5. Returns the lowest-numbered ready issue, or null if none ready
- If null returned but issues exist in the queue: exit non-zero with diagnostic listing every blocked issue and its unresolved blockers
- The adjacency list is built fresh per call — **not** stored in `sdlc-state.json`

**Existing `sdlc-state.json` fields:** unchanged. The runner continues to track `currentIssue`, `currentBranch`, etc. per cycle.

**Logging:** add `console.log('[runner] skipping #${N} — blocked by unmerged dependencies: ${blockers.join(', ')}')` inside the filter loop.

---

## Security Considerations

| Area | Implementation |
|------|----------------|
| **Authentication** | No new auth — all GitHub calls go through existing `gh` CLI and its auth |
| **Input Validation** | `Depends on: #N` body parsing must accept only digits and reject arbitrary strings (regex `/Depends on: #(\d+)\b/gi`) — prevents injection via malicious issue bodies |
| **Shell Safety** | All `gh` invocations use array-argument form (no string interpolation); issue numbers are validated as integers before passing to shell |
| **No Secrets** | `epic` label creation, child issue creation, sub-issue parent linking — all use `gh` CLI only; no tokens handled directly |
| **Force-Push Guard** | AC7d rebase flow MUST NOT force-push; conflicts escalate with a message (this is a hard invariant per the existing git-safety protocol) |

---

## Performance Considerations

| Area | Target | Mitigation |
|------|--------|------------|
| **Parent-link resolution** | < 5s for epics with up to 20 children | Bounded by N `gh issue view` calls; each is sub-second. No caching needed at N=20 |
| **Runner per-tick cost** | + ~2–5 seconds per tick for epics with children | `gh issue list` is one call; per-child `gh issue view` is one call each; at typical epic size (< 10 children) this is < 10s total; acceptable for an autonomous runner |
| **Seal-spec flow** | Single `git add` + `git commit` + `git push` | Same cost as any other commit; no scaling concern |
| **`/open-pr` sibling check** | < 3s added | N+1 calls (parent + each sibling); typically ≤ 5 siblings |

**Explicit non-optimization**: The runner does NOT cache the dependency graph between ticks per the retrospective-driven tradeoff in Alternative C vs D.

---

## Testing Strategy

Per `steering/tech.md` "Exercise-Based Verification": skills are Markdown, so testing means loading the plugin and exercising the changed skills against a test project.

| Layer | Type | Coverage |
|-------|------|----------|
| `sdlc-runner.mjs` changes | Unit (Jest) | `selectNextIssueFromMilestone()` — happy path, all-blocked, external deps, cycle detection |
| `/draft-issue` Epic classification | Exercise test (Agent SDK) | Feature/Bug/Epic branching; auto-detection heuristic; unattended-mode default |
| `/draft-issue` Epic body template | Exercise test (Agent SDK) + dry-run | Generated epic body matches the Epic Issue Body Contract; `epic` label applied |
| `/write-spec` parent-link resolution | Exercise test (Agent SDK) | Three scenarios: (a) valid parent link + committed spec → amendment, (b) valid parent link + uncommitted → AC7c loud failure, (c) no parent link → keyword fallback; plus cycle-detection case |
| `/write-spec` seal-spec flow | Exercise test (Agent SDK) | Trigger detection; seal commit shape; idempotency re-run; child-creation invocation; unattended auto-execute |
| `/open-pr` sibling-aware bumping | Exercise test + dry-run | All-closed → minor; any-open → patch + CHANGELOG note; AC7d rebase-and-retry |
| BDD feature file | Gherkin | All 11 scenarios in the requirements Gherkin Preview |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Parent-link resolution picks wrong parent when child has multiple `Depends on:` lines | Medium | Medium | Prefer native GH sub-issue parent field as tiebreaker; if still ambiguous, require user confirmation (or in unattended mode, abort with diagnostic) |
| `gh` CLI version doesn't support `--json parent` | Low | High | Runtime check: if `--json parent` returns nothing across all issues, fall back to body-only resolution and log a warning; document minimum `gh` version in `steering/tech.md` |
| Seal-spec commits sensitive files by accident | Low | High | Seal only stages `specs/{feature-name}/` — never `git add -A`; uses explicit path argument |
| Runner dependency-graph query becomes expensive at large epic size (> 50 children) | Low | Medium | Add a bounded concurrency limit on `gh issue view` (e.g., 5 parallel); if average tick exceeds 30s, revisit caching with a versioned invalidation key |
| Two runners running simultaneously against the same milestone pick the same "ready" issue | Low | Medium | Existing runner single-instance lock (per `sdlc-state.json`) already prevents this; no additional guard needed |
| Changing label logic (downgrade to patch for intermediate) breaks existing bump classification for non-epic PRs | Medium | High | Sibling check is gated on parent being labeled `epic` — non-epic PRs flow through unchanged path |
| A child PR closes the epic prematurely via "Closes #{epic}" | Medium | Medium | Add AC7a warning in `/open-pr`: if the current PR body contains `Closes #{E}` and `#{E}` is labeled `epic`, prompt/escalate before submit |
| `skill-creator` refuses to add novel sections to existing skills | Low | Medium | Prepare test cases ahead of implementation; if rejected, iterate on description/frontmatter before content |

---

## Open Questions

- [ ] AC6 — Should the runner itself ever "process" an epic issue (running an empty `/write-code` just to close it), or always skip epics in the milestone queue? **Tentative answer**: always skip epics. The epic is closed automatically when its last child PR merges (via GH's "Closes #{epic}" from the final child's PR body).
- [ ] AC5 sibling-detection scope — cross-milestone siblings count or not? **Tentative answer**: all children listed in the epic's Child Issues checklist, regardless of milestone. This matches the semantic intent (the epic's deliverable).
- [ ] Seal-spec on the epic vs on the first child — the spec directory convention dictates that the umbrella spec lives under the epic's branch. After seal, does the first child branch off `main` or off the epic's sealed branch? **Tentative answer**: off `main`, then amends the parent spec in its own commits. This avoids a long-lived epic branch.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #149 | 2026-04-19 | Initial feature spec |

---

## Validation Checklist

- [x] Architecture follows existing project patterns (per `structure.md`) — no new layers, changes are local to four existing files
- [x] All API/interface changes documented with schemas — Epic Body Contract, Child Body Contract, PR body line format
- [x] Database/storage changes planned — deliberate non-change (no graph caching in `sdlc-state.json`)
- [x] State management approach is clear — per-skill state transitions diagrammed
- [x] UI components — N/A; surfaces limited to AskUserQuestion options, stdout log lines, PR body line
- [x] Security considerations addressed — input validation, shell safety, no force-push
- [x] Performance impact analyzed — bounded N, sub-10s tick cost
- [x] Testing strategy defined — exercise testing via Agent SDK per `tech.md`
- [x] Alternatives were considered and documented — 9 options across 3 decisions
- [x] Risks identified with mitigations — 9 risks assessed
