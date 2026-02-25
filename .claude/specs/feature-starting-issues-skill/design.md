# Design: Starting Issues Skill

**Issues**: #10, #89
**Date**: 2026-02-25
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/starting-issues` skill provides issue selection and branch setup as the entry point to the development workflow. It follows a 4-step process: fetch milestones and issues, present selection via AskUserQuestion, confirm the selected issue, then create a linked feature branch and update the issue status to "In Progress" via GitHub's GraphQL API.

The skill supports milestone-scoped issue listing (falling back to all open issues if no milestones exist), direct issue number arguments for skipping selection, and automation mode for headless oldest-first selection. The branch is created and linked via `gh issue develop`, which both creates the branch and associates it in GitHub's "Development" sidebar.

When running in auto-mode and zero automatable issues are found, the skill now performs a diagnostic query to determine whether the problem is missing labels or genuinely no open work. It queries total open issues (in the same milestone scope, without the `automatable` label filter) and includes the count in the output, along with an actionable suggestion when labeled issues are missing.

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────┐
│         /starting-issues Skill                │
├──────────────────────────────────────────────┤
│  Step 1: Identify Issue                       │
│    ├── Fetch milestones (gh api)              │
│    └── Fetch open issues (gh issue list)      │
│  Step 2: Present Selection (AskUserQuestion)  │
│  Step 3: Confirm Selection (gh issue view)    │
│  Step 1b: Diagnostics (auto-mode, zero result) │
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
2. (Auto-mode, zero automatable results) Run diagnostic query:
   a. Re-run `gh issue list` in same scope WITHOUT `--label automatable`
   b. Count total open issues
   c. If total > 0: output count + label suggestion, exit
   d. If total = 0: output "no open issues", exit
3. Present issue options to user (skip in auto-mode)
4. User confirms selection (skip in auto-mode)
5. Create feature branch via gh issue develop
6. Query GitHub Projects v2 for issue's project item
7. Update Status field to "In Progress" via GraphQL mutation
8. Output summary: issue, branch, milestone, status
```

---

## API / Interface Changes

### New Endpoints / Methods

| Endpoint / Method | Type | Auth | Purpose |
|-------------------|------|------|---------|
| [path or signature] | [GET/POST/etc or method] | [Yes/No] | [description] |

### Request / Response Schemas

#### [Endpoint or Method Name]

**Input:**
```json
{
  "field1": "string",
  "field2": 123
}
```

**Output (success):**
```json
{
  "id": "string",
  "field1": "string",
  "createdAt": "ISO8601"
}
```

**Errors:**

| Code / Type | Condition |
|-------------|-----------|
| [error code] | [when this happens] |

---

## Database / Storage Changes

### Schema Changes

| Table / Collection | Column / Field | Type | Nullable | Default | Change |
|--------------------|----------------|------|----------|---------|--------|
| [name] | [name] | [type] | Yes/No | [value] | Add/Modify/Remove |

### Migration Plan

```
-- Describe the migration approach
-- Reference tech.md for migration conventions
```

### Data Migration

[If existing data needs transformation, describe the approach]

---

## State Management

Reference `structure.md` and `tech.md` for the project's state management patterns.

### New State Shape

```
// Pseudocode — use project's actual language/framework
FeatureState {
  isLoading: boolean
  items: List<Item>
  error: string | null
  selected: Item | null
}
```

### State Transitions

```
Initial → Loading → Success (with data)
                  → Error (with message)

User action → Optimistic update → Confirm / Rollback
```

---

## UI Components

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| [name] | [path per structure.md] | [description] |

### Component Hierarchy

```
FeatureScreen
├── Header
├── Content
│   ├── LoadingState
│   ├── ErrorState
│   ├── EmptyState
│   └── DataView
│       ├── ListItem × N
│       └── DetailView
└── Actions
```

---

## Diagnostic Query Design (Issue #89)

### Trigger Condition

The diagnostic runs only when ALL of these are true:
1. Auto-mode is active (`.claude/auto-mode` exists)
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
| `plugins/nmg-sdlc/skills/starting-issues/SKILL.md` | Create → Modify | Skill definition with 4-step workflow; add diagnostic output to auto-mode empty result handling |

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: [name]** | [approach] | [benefits] | [drawbacks] | Rejected — [reason] |
| **B: [name]** | [approach] | [benefits] | [drawbacks] | **Selected** |

---

## Security Considerations

- [x] All GitHub operations via authenticated `gh` CLI
- [x] GraphQL mutations scoped to status field only
- [x] No write access to issue content or labels

---

## Performance Considerations

- [x] Milestone and issue fetching are single API calls
- [x] Branch creation via `gh issue develop` is fast
- [x] GraphQL queries for project status are lightweight

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Issue Selection | BDD | Interactive and auto-mode scenarios |
| Branch Creation | BDD | Linked branch creation scenario |
| Status Update | BDD | GitHub Project status update scenario |
| Zero-Result Diagnostics | BDD | Diagnostic output with open issue count and label suggestion (AC6–AC8) |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [risk] | Low/Med/High | Low/Med/High | [approach] |

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
| #89 | 2026-02-25 | Add diagnostic query design for zero automatable issues in auto-mode |

## Validation Checklist

- [x] Architecture follows existing skill patterns
- [x] File changes documented
- [x] Security considerations addressed
