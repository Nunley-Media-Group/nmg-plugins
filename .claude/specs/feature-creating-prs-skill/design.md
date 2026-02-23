# Design: Creating PRs Skill

**Issues**: #8
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/creating-prs` skill is the final step of the interactive SDLC workflow. It gathers context from the GitHub issue, spec files, git state, and verification results, then generates a structured PR body and creates the pull request via `gh pr create`. The skill uses conventional commit prefixes for PR titles and includes acceptance criteria as a checklist for reviewers.

The skill has `disable-model-invocation: true` in its frontmatter, meaning it follows the SKILL.md instructions deterministically without model-driven behavior. This makes PR creation predictable and reproducible.

---

## Architecture

### Component Diagram

```
┌────────────────────────────────────────────┐
│          /creating-prs Skill                │
├────────────────────────────────────────────┤
│  Step 1: Read Context                       │
│    ├── gh issue view #N                     │
│    ├── .claude/specs/{feature}/req.md        │
│    ├── .claude/specs/{feature}/tasks.md      │
│    ├── git status, git log, git diff         │
│  Step 2: Generate PR Content                 │
│    ├── Title (conventional commit prefix)    │
│    └── Body (summary, ACs, test plan, specs) │
│  Step 3: Push and Create PR                  │
│    ├── git push -u origin HEAD               │
│    └── gh pr create                          │
│  Step 4: Output                              │
└────────────────────────────────────────────┘
```

### Data Flow

```
1. Read issue, specs, and git state
2. Generate PR title with conventional commit prefix
3. Generate PR body with summary, AC checklist, test plan, spec links
4. Ensure branch is pushed to remote
5. Create PR via gh pr create
6. Output PR URL and summary
```

---

## File Changes

| File | Type | Purpose |
|------|------|---------|
| `plugins/nmg-sdlc/skills/creating-prs/SKILL.md` | Create | Skill definition with 4-step workflow |

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

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: [name]** | [approach] | [benefits] | [drawbacks] | Rejected — [reason] |
| **B: [name]** | [approach] | [benefits] | [drawbacks] | **Selected** |

---

## Security Considerations

- [x] PR creation via authenticated `gh` CLI
- [x] No tokens or secrets in PR body
- [x] `Closes #N` links are safe GitHub references

---

## Performance Considerations

- [x] Single `gh pr create` API call
- [x] Local file reads for specs and git state
- [x] `disable-model-invocation: true` — deterministic execution

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| PR Creation | BDD | Scenarios for issue linking, spec references, auto-mode |

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
| #8 | 2026-02-15 | Initial feature spec |

---

## Validation Checklist

- [x] Architecture follows existing skill patterns
- [x] File changes documented
- [x] Security considerations addressed
