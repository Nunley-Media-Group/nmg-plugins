# Design: Starting Issues Skill

**Issues**: #10, #89, #127
**Date**: 2026-04-18
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/start-issue` skill provides issue selection and branch setup as the entry point to the development workflow. It follows a 4-step process: fetch milestones and issues, present selection via AskUserQuestion, confirm the selected issue, then create a linked feature branch and update the issue status to "In Progress" via GitHub's GraphQL API.

The skill supports milestone-scoped issue listing (falling back to all open issues if no milestones exist), direct issue number arguments for skipping selection, and unattended mode for headless oldest-first selection. The branch is created and linked via `gh issue develop`, which both creates the branch and associates it in GitHub's "Development" sidebar.

When running in unattended-mode and zero automatable issues are found, the skill now performs a diagnostic query to determine whether the problem is missing labels or genuinely no open work. It queries total open issues (in the same milestone scope, without the `automatable` label filter) and includes the count in the output, along with an actionable suggestion when labeled issues are missing.

Issue #127 adds a **Dependency Resolution** stage between the raw issue fetch and the selection presentation. The stage parses sub-issue / tracked-by links and `Depends on` / `Blocks` body cross-refs, builds a dependency graph, filters out issues with any open parent, topologically sorts the remainder (ties broken by issue number), and gracefully handles cycles by pushing cycle members to the end of the list.

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────┐
│         /start-issue Skill                │
├──────────────────────────────────────────────┤
│  Step 1: Identify Issue                       │
│    ├── Fetch milestones (gh api)              │
│    └── Fetch open issues (gh issue list)      │
│  Step 1a: Dependency Resolution (Issue #127)  │
│    ├── Fetch parent/subIssues & bodies        │
│    ├── Parse body cross-refs                  │
│    ├── Build dependency graph                 │
│    ├── Filter blocked (any open parent)       │
│    ├── Topological sort (Kahn's algorithm)    │
│    └── Cycle fallback → tail in #-order       │
│  Step 2: Present Selection (AskUserQuestion)  │
│  Step 3: Confirm Selection (gh issue view)    │
│  Step 1b: Diagnostics (unattended-mode, zero result) │
│    ├── gh issue list (no label filter)         │
│    └── Conditional suggestion output           │
│  Step 4: Create Branch & Update Status        │
│    ├── gh issue develop N --checkout          │
│    └── GraphQL: update Status → In Progress   │
└──────────────────────────────────────────────┘
```

### Data Flow

```
1. Fetch milestones and issues from GitHub
2. (Unattended-mode, zero automatable results) Run diagnostic query:
   a. Re-run `gh issue list` in same scope WITHOUT `--label automatable`
   b. Count total open issues
   c. If total > 0: output count + label suggestion, exit
   d. If total = 0: output "no open issues", exit
3. Dependency resolution (Issue #127):
   a. For each candidate issue, fetch parent/subIssues + body via GraphQL batch
   b. Parse `Depends on: #X` / `Blocks: #Y` cross-refs from bodies
   c. Build adjacency map: issue -> {parent_issues: Set<int>}
   d. Filter: drop any issue with an open parent
   e. Topologically sort survivors (Kahn's), break ties by issue # asc
   f. On cycle detection: log warning, append cycle members in # order
   g. Emit session note: "Filtered N blocked issues"
4. Present issue options to user (skip in unattended-mode)
5. User confirms selection (skip in unattended-mode)
6. Create feature branch via gh issue develop
7. Query GitHub Projects v2 for issue's project item
8. Update Status field to "In Progress" via GraphQL mutation
9. Output summary: issue, branch, milestone, status
```

---

## Dependency Resolution Design (Issue #127)

### Input

The set of candidate issues emitted by Step 1 — either milestone-scoped (interactive or unattended) or the repo-wide fallback set, with `automatable` label filter applied in unattended-mode.

### Fetch

Use a single `gh api graphql` call to fetch parent + sub-issue + body data for all candidate issues in one round-trip. The query selects each issue by number and requests:

```graphql
issue(number: N) {
  number
  state
  parent { number state }         # tracked-by link
  subIssues(first: 50) { nodes { number state } }
  body
}
```

For the parent's state, any non-`CLOSED` value (including `OPEN`) is treated as "open" (unresolved dependency).

Fallback: if the native `parent` / `subIssues` fields are unavailable on the account's GitHub plan, the query returns nulls — the resolver then relies solely on body cross-ref parsing (FR10).

### Body Cross-Ref Parser

Scan each issue body line-by-line (case-insensitive) for these patterns produced by `/draft-issue`:

| Pattern | Meaning | Example |
|---------|---------|---------|
| `^\s*Depends on:\s*(#\d+(?:\s*,\s*#\d+)*)` | The current issue depends on the listed issues (they are parents) | `Depends on: #42, #43` |
| `^\s*Blocks:\s*(#\d+(?:\s*,\s*#\d+)*)` | The current issue blocks the listed issues (they depend on current) | `Blocks: #99` |

Extract issue numbers with `#?(\d+)` from the captured list. Normalize: a `Blocks: #Y` on issue `X` is recorded as a `Depends on: #X` on issue `Y`.

### Graph Model

```
parentsOf: Map<issue_number, Set<parent_number>>
```

Populate from both native links (parent + inverse sub-issues) and body cross-refs. Deduplicate — an issue declared as a parent in both formats counts once.

### Blocked Filter

An issue `I` is **blocked** if any element of `parentsOf[I]` is not closed. "Closed" means the parent's GitHub state is `CLOSED`. Parents that don't exist or can't be resolved (e.g., cross-repo refs) are treated as closed (fail-open — the dependency is considered satisfied) so that typos or deleted issues don't halt the pipeline.

### Topological Sort

Use Kahn's algorithm over the filtered set:

1. Compute in-degree (count of parents that are **also in the candidate set** — external parents don't count, they're already closed by precondition).
2. Seed a priority queue with all zero-in-degree nodes, ordered by issue number ascending.
3. Pop lowest-numbered zero-in-degree node; append to output; decrement in-degrees of its children; enqueue newly-zero children.
4. Repeat until queue empty.

If any candidate remains un-emitted after the queue drains, those nodes form a cycle.

### Cycle Handling

1. Emit a warning line to the session log naming the cycle participants:
   ```
   WARNING: Dependency cycle detected among issues #A, #B, #C — placing at end of list in issue-number order.
   ```
2. Append the remaining (cycle) nodes to the output list in issue-number ascending order.
3. Continue — do **not** abort the skill.

### Session Note

After filtering, emit one line to stdout (before AskUserQuestion in interactive mode, or before auto-selection in unattended-mode):

```
Filtered N blocked issues from selection.
```

Where `N` is the count of issues removed by the blocked filter. If `N == 0`, still emit the line (it confirms dependency resolution ran, aiding observability per FR14).

### Fallback Behavior

If the GraphQL batch query fails entirely (network error, auth failure, API preview disabled):

1. Fall back to `gh issue view --json body` per issue to get bodies only.
2. Run body-cross-ref parsing only — native sub-issue data will be absent.
3. Proceed with filtering and topological sort on the reduced graph.
4. Log a warning: `WARNING: Native dependency links unavailable; using body cross-refs only.`

If even body fetching fails, log a warning and skip dependency resolution entirely — present issues in the current (issue-number-ascending) order. Do not abort.

---

## API / Interface Changes

### New Endpoints / Methods

| Endpoint / Method | Type | Auth | Purpose |
|-------------------|------|------|---------|
| `gh api graphql` batch query for parent/subIssues/body | GraphQL | Yes | Fetch dependency metadata for all candidates in one call |

### Request / Response Schemas

#### Dependency Metadata Batch Query (Issue #127)

**Input:** GraphQL query with owner, repo, and an array of issue numbers.

**Output (success):** For each issue — `number`, `state`, `parent { number, state }`, `subIssues { nodes { number, state } }`, `body`.

**Errors:**

| Code / Type | Condition |
|-------------|-----------|
| GraphQL field unavailable | Sub-issue preview not enabled on account — fall back to body-cross-ref parsing |
| Network/auth failure | Log warning, skip dependency resolution, preserve legacy ordering |

---

## Database / Storage Changes

None. Dependency resolution is stateless and computed per invocation.

---

## State Management

None. The dependency graph is built in-memory per invocation and discarded after selection.

---

## UI Components

N/A — `/start-issue` is a CLI skill driven by `AskUserQuestion`.

---

## Diagnostic Query Design (Issue #89)

### Trigger Condition

The diagnostic runs only when ALL of these are true:
1. Unattended-mode is active (`.claude/unattended-mode` exists)
2. The `gh issue list` call with `--label automatable` returns zero results

### Diagnostic Query

Re-run the same `gh issue list` command but **without** the `--label automatable` flag. Preserve all other filters (milestone scope, `-s open`):

```bash
# If milestone-scoped:
gh issue list -s open -m "<milestone>" --json number --jq 'length'

# If no milestone (all open):
gh issue list -s open --json number --jq 'length'
```

### Output Branching

| Total Open | Automatable | Output |
|-----------|-------------|--------|
| 0 | 0 | `No automatable issues found. 0 open issues in scope. Done. Awaiting orchestrator.` |
| N > 0 | 0 | `No automatable issues found (N open issues exist without the automatable label). Consider adding the automatable label to issues that should be picked up automatically. Done. Awaiting orchestrator.` |

### Scope Matching

The diagnostic query MUST match the same scope as the original query:
- If the original query was milestone-scoped (`-m "v2"`), the diagnostic query uses the same milestone filter
- If the original query was repo-wide (no milestone), the diagnostic query is also repo-wide
- This prevents misleading counts (e.g., 50 open issues repo-wide when the milestone has 0)

---

## File Changes

| File | Type | Purpose |
|------|------|---------|
| `plugins/nmg-sdlc/skills/start-issue/SKILL.md` | Modify | Add Step 1a "Dependency Resolution" section; update Step 1 and unattended-mode bullets to reference the filter; document session note output |

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Per-issue `gh issue view`** | Fetch parent/body data via N separate CLI calls | Simple, no GraphQL authoring | O(N) network calls; slow for large milestones | Rejected — violates NFR performance target |
| **B: Single GraphQL batch query** | One round-trip for all candidates | Fast; covers native + body-cross-ref data | Requires GraphQL authoring; depends on preview field availability | **Selected** — with body-only fallback for preview-unavailable accounts |
| **C: Abort on cycle** | Treat cycles as fatal errors | Forces users to fix the graph | Halts the pipeline; unfriendly for unattended mode | Rejected — AC11 mandates graceful degradation |
| **D: DFS topological sort** | Depth-first ordering | Simple recursive implementation | Harder to produce #-ascending tie-breaking between roots | Rejected — Kahn's gives explicit control over tie-break order |

---

## Security Considerations

- [x] All GitHub operations via authenticated `gh` CLI
- [x] GraphQL mutations scoped to status field only
- [x] No write access to issue content or labels
- [x] Body-cross-ref regex anchored to line start; no arbitrary-position matching to avoid pathological bodies causing runtime explosions

---

## Performance Considerations

- [x] Milestone and issue fetching are single API calls
- [x] Dependency metadata is fetched in **one** GraphQL batch call (not per-issue) — performance NFR target: ≤ 2s for 50 issues
- [x] Topological sort is O(V + E); negligible for realistic milestones
- [x] Branch creation via `gh issue develop` is fast
- [x] GraphQL queries for project status are lightweight

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Issue Selection | BDD | Interactive and unattended-mode scenarios |
| Branch Creation | BDD | Linked branch creation scenario |
| Status Update | BDD | GitHub Project status update scenario |
| Zero-Result Diagnostics | BDD | Diagnostic output with open issue count and label suggestion (AC6–AC8) |
| Dependency Resolution (Issue #127) | BDD | Blocked filter, topological order, cycle fallback, both wiring formats, session note (AC9–AC14) |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| GitHub sub-issue preview not enabled on account | Medium | Medium | Fall back to body-cross-ref parsing only; document in skill |
| Cross-repo `#N` refs in body mis-parsed as local | Low | Low | Body parser matches only bare `#N` on `Depends on` / `Blocks` lines; cross-repo refs use `owner/repo#N` and are ignored |
| Large milestone with deep dependency chains slows resolution | Low | Medium | Single GraphQL batch + O(V+E) sort; performance tested to 50 issues |
| Cycle introduced by operator error blocks pipeline | Low | Low | Graceful degradation — warning + tail placement, never abort |

---

## Open Questions

- [ ] [Technical question]
- [ ] [Architecture question]
- [ ] [Integration question]

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #10 | 2026-02-15 | Initial feature spec |
| #89 | 2026-02-25 | Add diagnostic query design for zero automatable issues in unattended-mode |
| #127 | 2026-04-18 | Add Dependency Resolution stage: GraphQL batch fetch, body-cross-ref parser, Kahn's topological sort, graceful cycle handling, session note |

## Validation Checklist

- [x] Architecture follows existing skill patterns
- [x] File changes documented
- [x] Security considerations addressed
- [x] Performance impact analyzed for new dependency resolution stage
- [x] Alternatives considered for batch query and sort algorithm
- [x] Risks identified with mitigations
