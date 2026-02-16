# Design: Setting Up Steering Skill

**Issue**: #3
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/setting-up-steering` skill performs a comprehensive codebase analysis to generate three steering documents that serve as shared context for all downstream SDLC skills. The skill scans for package manifests, dependency files, test frameworks, CI configuration, and existing documentation to populate templates with project-specific information.

The three output documents — `product.md`, `tech.md`, and `structure.md` — are written to `.claude/steering/` and provide the foundation that `/creating-issues`, `/writing-specs`, `/implementing-specs`, and `/verifying-specs` all reference for project-specific context. The skill also creates an empty `.claude/specs/` directory for future spec storage.

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────┐
│        /setting-up-steering Skill             │
├──────────────────────────────────────────────┤
│  Step 1: Scan codebase                        │
│    ├── Package files (package.json, etc.)     │
│    ├── Source directories                     │
│    ├── Test frameworks                        │
│    ├── CI configuration                       │
│    └── Existing docs (README, CLAUDE.md)      │
│                                               │
│  Step 2: Generate from templates              │
│    ├── templates/product.md → product.md      │
│    ├── templates/tech.md → tech.md            │
│    └── templates/structure.md → structure.md   │
│                                               │
│  Step 3: Write to .claude/steering/           │
│  Step 4: Prompt user for customization        │
└──────────────────────────────────────────────┘
```

### Data Flow

```
1. Skill invoked by user
2. Glob/Grep/Read scan for package files, deps, config
3. Template files read from skills/setting-up-steering/templates/
4. Templates populated with discovered data
5. Three documents written to .claude/steering/
6. Empty .claude/specs/ directory created
7. User prompted to review and customize
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
| `plugins/nmg-sdlc/skills/setting-up-steering/SKILL.md` | Create | Skill definition with 4-step workflow |
| `plugins/nmg-sdlc/skills/setting-up-steering/templates/product.md` | Create | Product steering template |
| `plugins/nmg-sdlc/skills/setting-up-steering/templates/tech.md` | Create | Technical steering template |
| `plugins/nmg-sdlc/skills/setting-up-steering/templates/structure.md` | Create | Code structure template |

---

## Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| Manual document creation | User writes steering docs from scratch | Rejected — too much upfront effort |
| **Codebase-scanned templates** | Auto-populate templates from scanning | **Selected** — fast bootstrap with customization |

---

## Security Considerations

- [x] No secrets captured from environment variables or config files
- [x] Steering docs contain only structural/architectural information
- [x] Read-only access to codebase during scanning

---

## Performance Considerations

- [x] Glob/Grep scans are bounded to known file patterns
- [x] Single-pass scanning — no redundant reads
- [x] Template population is string-based, no heavy processing

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Skill Workflow | BDD | Scenarios for document generation |
| Template Output | Manual | Verify populated content matches project |

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

- [x] Architecture follows existing plugin skill patterns
- [x] File changes documented
- [x] Security considerations addressed
- [x] Performance impact analyzed
- [x] Alternatives considered
