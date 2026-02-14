# Design Template

Use this template to create technical designs in the **PLAN** phase.

---

```markdown
# Design: [Feature Name]

**Issue**: #[number]
**Date**: [YYYY-MM-DD]
**Status**: Draft | In Review | Approved
**Author**: [name]

---

## Overview

[2-3 paragraph technical summary: what will be built, key architectural decisions, integration points. Reference the requirements spec for context.]

---

## Architecture

### Component Diagram

Reference `structure.md` for the project's layer architecture.

```
┌──────────────────────────────────────────────────────────┐
│                    Presentation Layer                      │
├──────────────────────────────────────────────────────────┤
│  ┌──────────┐    ┌──────────┐    ┌──────────┐           │
│  │   View   │───▶│ State Mgr│───▶│  Model   │           │
│  └──────────┘    └──────────┘    └──────────┘           │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                    Business Logic Layer                    │
├──────────────────────────────────────────────────────────┤
│  ┌──────────┐    ┌──────────┐    ┌──────────┐           │
│  │ Handler  │───▶│ Service  │───▶│Data Access│           │
│  └──────────┘    └──────────┘    └──────────┘           │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                    External Layer                          │
│  Database  │  External APIs  │  File System  │  Cache     │
└──────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User performs [action]
2. Presentation layer captures input
3. State manager validates and delegates
4. Business logic processes request
5. Data access layer fetches/stores data
6. Response flows back through layers
7. State manager updates, view rebuilds
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

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: [name]** | [approach] | [benefits] | [drawbacks] | Rejected — [reason] |
| **B: [name]** | [approach] | [benefits] | [drawbacks] | **Selected** |

---

## Security Considerations

- [ ] **Authentication**: [How auth is enforced]
- [ ] **Authorization**: [Permission checks required]
- [ ] **Input Validation**: [Validation approach]
- [ ] **Data Sanitization**: [How data is sanitized]
- [ ] **Sensitive Data**: [How sensitive data is handled]

---

## Performance Considerations

- [ ] **Caching**: [Caching strategy]
- [ ] **Pagination**: [Pagination approach for large datasets]
- [ ] **Lazy Loading**: [What loads lazily]
- [ ] **Indexing**: [Database indexes or search indexes needed]

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Business Logic | Unit | Core methods, error handling |
| Data Access | Unit | Queries, data mapping |
| State Management | Unit | State transitions |
| UI Components | Component | Rendering, interactions |
| Feature | Integration (BDD) | End-to-end acceptance criteria |

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

Before moving to TASKS phase:

- [ ] Architecture follows existing project patterns (per `structure.md`)
- [ ] All API/interface changes documented with schemas
- [ ] Database/storage changes planned with migrations
- [ ] State management approach is clear
- [ ] UI components and hierarchy defined
- [ ] Security considerations addressed
- [ ] Performance impact analyzed
- [ ] Testing strategy defined
- [ ] Alternatives were considered and documented
- [ ] Risks identified with mitigations
```

---

# Defect Design Variant

**Use this variant when the GitHub issue has the `bug` label.** It replaces the feature design template above with a root cause analysis focused on minimal, targeted fixes. Omit Component diagram, Data Flow, API schemas, Database schemas/migrations, State Management, UI Components/hierarchy, Security checklist, Performance checklist, and full Testing Strategy table.

---

```markdown
# Root Cause Analysis: [Bug Summary]

**Issue**: #[number]
**Date**: [YYYY-MM-DD]
**Status**: Draft | In Review | Approved
**Author**: [name]

---

## Root Cause

[2-3 paragraphs explaining why the bug occurs. Describe the code path, the incorrect assumption or logic error, and the conditions that trigger it.]

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `path/to/file` | [line range] | [what this code does in the bug path] |

### Triggering Conditions

- [Condition 1 that must be true]
- [Condition 2 that must be true]
- [Why these conditions weren't caught before]

---

## Fix Strategy

### Approach

[1-2 paragraphs: what will change and why this is the minimal correct fix.]

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `path/to/file` | [what changes] | [why this fixes the root cause] |

### Blast Radius

[Assessment of what other code paths or features could be affected by this change. Reference callers, dependents, and shared state.]

- **Direct impact**: [files/functions directly modified]
- **Indirect impact**: [callers or dependents of modified code]
- **Risk level**: Low / Medium / High

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| [What could break] | Low/Med/High | [How the regression test or fix guards against it] |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| [Alternative fix] | [approach] | [why the chosen approach is better] |

*Omit this section if only one reasonable fix approach exists.*

---

## Validation Checklist

Before moving to TASKS phase:

- [ ] Root cause is identified with specific code references
- [ ] Fix is minimal — no unrelated refactoring
- [ ] Blast radius is assessed
- [ ] Regression risks are documented with mitigations
- [ ] Fix follows existing project patterns (per `structure.md`)
```
