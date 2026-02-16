# Design: Plugin Scaffold and Marketplace Infrastructure

**Issue**: #2
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The plugin scaffold establishes the foundational infrastructure for the nmg-plugins marketplace. It defines two JSON manifest formats — a marketplace-level index (`marketplace.json`) and a per-plugin manifest (`plugin.json`) — that together describe available plugins, their versions, and their locations within the repository. A repo-level `/installing-locally` skill reads the marketplace index, discovers plugins, and copies them to the user's local `~/.claude/plugins/` cache using `rsync`.

The architecture follows a registry pattern: the marketplace index is the single source of truth for plugin discovery, while each plugin's own manifest carries its metadata. The installation skill bridges the gap between the repository and the local Claude Code runtime by syncing versioned snapshots into a well-known cache directory.

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────┐
│              nmg-plugins Repository              │
├─────────────────────────────────────────────────┤
│  .claude-plugin/marketplace.json  (registry)     │
│  plugins/nmg-sdlc/                               │
│    └── .claude-plugin/plugin.json (manifest)     │
│  .claude/skills/installing-locally/SKILL.md      │
│  README.md                                       │
└───────────────────────┬─────────────────────────┘
                        │ /installing-locally
                        ▼
┌─────────────────────────────────────────────────┐
│           Local User Environment                 │
│  ~/.claude/plugins/                              │
│    ├── known_marketplaces.json                   │
│    ├── installed_plugins.json                    │
│    ├── marketplaces/nmg-plugins/ (git clone)     │
│    └── cache/nmg-plugins/{plugin}/{version}/     │
└─────────────────────────────────────────────────┘
```

### Data Flow

```
1. User invokes /installing-locally
2. Skill pulls latest marketplace repo (git pull)
3. Skill reads marketplace.json to discover plugins
4. For each plugin, rsync source → versioned cache directory
5. Skill updates installed_plugins.json with version, path, SHA
6. Skill syncs OpenClaw skill (if present)
7. Skill restarts OpenClaw gateway (if available)
8. Skill reports installation summary
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
| `.claude-plugin/marketplace.json` | Create | Marketplace index with plugins array |
| `plugins/nmg-sdlc/.claude-plugin/plugin.json` | Create | Plugin manifest with name, version, author |
| `.claude/skills/installing-locally/SKILL.md` | Create | Repo-level installation skill |
| `README.md` | Create | Documentation with installation instructions |

---

## Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| Single manifest file | One JSON file for both registry and plugin metadata | Rejected — separating concerns allows plugins to be self-describing |
| npm-style packaging | Use npm packages for plugin distribution | Rejected — too heavy for Markdown-based plugin content |
| **Registry + manifest pattern** | Marketplace index for discovery, per-plugin manifest for metadata | **Selected** — clean separation, extensible |

---

## Security Considerations

- [x] No secrets or credentials in any manifest file
- [x] Installation uses local file copy only (no remote downloads)
- [x] `rsync --delete` cleans up stale files from previous versions
- [x] `chmod +x` only applied to hook scripts, not arbitrary files

---

## Performance Considerations

- [x] Local file copy via `rsync` is fast (sub-second for plugin size)
- [x] `git pull` only fetches incremental changes
- [x] Idempotent — safe to re-run without side effects

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Marketplace Index | Manual | Validate JSON structure and plugin entries |
| Plugin Manifest | Manual | Validate metadata fields |
| Installation Skill | BDD | Scenarios for install, update, and reporting |

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

- [x] Architecture follows plugin marketplace patterns
- [x] File changes documented with purpose
- [x] Security considerations addressed
- [x] Performance impact analyzed
- [x] Alternatives considered and documented
