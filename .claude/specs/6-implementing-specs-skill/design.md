# Design: Implementing Specs Skill

**Issue**: #6
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/implementing-specs` skill is the execution engine of the nmg-sdlc workflow. It reads spec documents, enters plan mode for user approval, then executes implementation tasks sequentially. The skill supports both interactive mode (with plan approval) and automation mode (headless execution).

The skill follows a 6-step workflow: identify context (from argument, branch, or user input), read specs, read steering documents, design implementation approach (plan mode), execute tasks sequentially, and signal completion. For bug fixes, it follows the defect spec's fix strategy with minimal change scope.

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────┐
│        /implementing-specs Skill              │
├──────────────────────────────────────────────┤
│  Step 1: Identify Context (issue/branch)      │
│  Step 2: Read Specs                           │
│    ├── requirements.md                        │
│    ├── design.md                              │
│    ├── tasks.md                               │
│    └── feature.gherkin                        │
│  Step 3: Read Steering Docs                   │
│    ├── tech.md                                │
│    └── structure.md                           │
│  Step 4: Design Approach (EnterPlanMode)      │
│  Step 5: Execute Tasks (sequential)           │
│  Step 6: Signal Completion                    │
└──────────────────────────────────────────────┘
```

### Data Flow

```
1. User invokes /implementing-specs #N
2. Identify issue from argument, branch name, or user input
3. Read all spec files from .claude/specs/{feature-name}/
4. Read steering docs for project conventions
5. Interactive: EnterPlanMode for approval
   Auto: design approach internally, skip plan mode
6. Execute each task from tasks.md sequentially
7. Self-check each task against acceptance criteria
8. Signal completion with summary
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
| `plugins/nmg-sdlc/skills/implementing-specs/SKILL.md` | Create | Skill definition with 6-step workflow |

---

## Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| Parallel task execution | Execute multiple tasks concurrently | Rejected — dependencies require ordering |
| No plan mode | Jump straight to coding | Rejected — user approval prevents wasted effort |
| **Sequential with plan mode** | Plan first, then execute in order | **Selected** — methodical, reviewable |

---

## Security Considerations

- [x] Generated code follows project conventions from steering docs
- [x] No arbitrary code execution outside Claude Code tools
- [x] Spec-driven implementation prevents unauthorized scope expansion

---

## Performance Considerations

- [x] Sequential execution avoids resource conflicts
- [x] Spec files are small (Markdown), fast to read
- [x] Resumable from last incomplete task

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Task Execution | BDD | Scenarios for sequential execution, plan mode, auto-mode |
| Bug Fix Mode | BDD | Scenario for minimal change scope |

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

## Validation Checklist

- [x] Architecture follows existing skill patterns
- [x] File changes documented
- [x] Security considerations addressed
- [x] Alternatives considered
