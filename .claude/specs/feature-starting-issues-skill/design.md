# Design: Starting Issues Skill

**Issues**: #10
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/starting-issues` skill provides issue selection and branch setup as the entry point to the development workflow. It follows a 4-step process: fetch milestones and issues, present selection via AskUserQuestion, confirm the selected issue, then create a linked feature branch and update the issue status to "In Progress" via GitHub's GraphQL API.

The skill supports milestone-scoped issue listing (falling back to all open issues if no milestones exist), direct issue number arguments for skipping selection, and automation mode for headless oldest-first selection. The branch is created and linked via `gh issue develop`, which both creates the branch and associates it in GitHub's "Development" sidebar.

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
│  Step 4: Create Branch & Update Status        │
│    ├── gh issue develop N --checkout          │
│    └── GraphQL: update Status → In Progress   │
└──────────────────────────────────────────────┘
```

### Data Flow

```
1. Fetch milestones and issues from GitHub
2. Present issue options to user (skip in auto-mode)
3. User confirms selection (skip in auto-mode)
4. Create feature branch via gh issue develop
5. Query GitHub Projects v2 for issue's project item
6. Update Status field to "In Progress" via GraphQL mutation
7. Output summary: issue, branch, milestone, status
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

## File Changes

| File | Type | Purpose |
|------|------|---------|
| `plugins/nmg-sdlc/skills/starting-issues/SKILL.md` | Create | Skill definition with 4-step workflow |

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

## Validation Checklist

- [x] Architecture follows existing skill patterns
- [x] File changes documented
- [x] Security considerations addressed
