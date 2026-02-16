# Design: Generating OpenClaw Config Skill

**Issue**: #13
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/generating-openclaw-config` skill generates a ready-to-use `sdlc-config.json` by reading the config template from the marketplace clone and substituting project-specific values (project path, plugins path). The skill resolves the project root via `git rev-parse --show-toplevel`, reads the template from `~/.claude/plugins/marketplaces/nmg-plugins/openclaw/scripts/sdlc-config.example.json`, substitutes placeholder values, writes the config to the project root, and updates `.gitignore` to exclude config and state files.

The skill lives in `plugins/nmg-sdlc/skills/generating-openclaw-config/` (moved from repo-level `.claude/skills/`) so it's available in all projects with nmg-sdlc installed.

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────┐
│    /generating-openclaw-config Skill          │
├──────────────────────────────────────────────┤
│  Step 1: Resolve project root (git)           │
│  Step 2: Read template from marketplace clone │
│  Step 3: Derive project name (basename)       │
│  Step 4: Resolve nmg-plugins path             │
│  Step 5: Substitute values in template        │
│  Step 6: Write sdlc-config.json               │
│  Step 7: Update .gitignore                    │
│  Step 8: Confirm and suggest next step        │
└──────────────────────────────────────────────┘
```

### Data Flow

```
1. Resolve project root via git rev-parse --show-toplevel
2. Read sdlc-config.example.json from marketplace clone
3. Derive project name from basename of project root
4. Substitute projectPath and pluginsPath placeholders
5. Write sdlc-config.json to project root
6. Add sdlc-config.json and .claude/sdlc-state.json to .gitignore
7. Output confirmation
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
| `plugins/nmg-sdlc/skills/generating-openclaw-config/SKILL.md` | Create | Skill definition with 8-step workflow |

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: [name]** | [approach] | [benefits] | [drawbacks] | Rejected — [reason] |
| **B: [name]** | [approach] | [benefits] | [drawbacks] | **Selected** |

---

## Security Considerations

- [x] No secrets in generated config
- [x] Config file is gitignored to prevent accidental commit
- [x] State file is also gitignored

---

## Performance Considerations

- [x] Template substitution is instant
- [x] Single file read and write operation

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Config Generation | BDD | Scenarios for generation and gitignore |

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
