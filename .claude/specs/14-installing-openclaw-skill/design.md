# Design: Installing OpenClaw Skill

**Issue**: #14
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/installing-openclaw-skill` skill provides a 5-step workflow for deploying the OpenClaw running-sdlc skill locally: create destination directory, copy skill files from the marketplace clone, run the CLI hang patch, restart the gateway, and report results. The skill sources all files from `~/.claude/plugins/marketplaces/nmg-plugins/openclaw/`.

A standalone installer script (`openclaw/scripts/install-openclaw-skill.sh`) provides the same functionality outside of Claude Code, with an additional `--link` mode that symlinks instead of copying — useful for development where you want changes to reflect immediately.

The CLI hang patch (`patch-openclaw-message-hang.mjs`) is an idempotent script that fixes a known Discord.js WebSocket hang bug in the `openclaw message send` command. It checks whether the patch is already applied, the bug is fixed upstream, or openclaw isn't installed.

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────┐
│    /installing-openclaw-skill                  │
├──────────────────────────────────────────────┤
│  Step 1: mkdir -p ~/.openclaw/skills/running-sdlc
│  Step 2: cp SKILL.md, sdlc-runner.mjs, config │
│  Step 3: node patch-openclaw-message-hang.mjs  │
│  Step 4: openclaw gateway restart              │
│  Step 5: Report results                        │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│    install-openclaw-skill.sh (standalone)      │
│  --link mode: symlink instead of copy          │
└──────────────────────────────────────────────┘
```

### Data Flow

```
1. Create destination directory
2. Copy SKILL.md, sdlc-runner.mjs, sdlc-config.example.json
3. Run CLI hang patch (idempotent)
4. Source nvm and restart OpenClaw gateway
5. Report success/warnings
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
| `plugins/nmg-sdlc/skills/installing-openclaw-skill/SKILL.md` | Create | Skill definition with 5-step workflow |
| `openclaw/scripts/install-openclaw-skill.sh` | Create | Standalone installer with --link mode |

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: [name]** | [approach] | [benefits] | [drawbacks] | Rejected — [reason] |
| **B: [name]** | [approach] | [benefits] | [drawbacks] | **Selected** |

---

## Security Considerations

- [x] Sources from local marketplace clone only
- [x] No remote downloads during installation
- [x] Gateway restart uses authenticated `openclaw` CLI

---

## Performance Considerations

- [x] File copy is instant
- [x] Patch script is idempotent and fast
- [x] Gateway restart is the only potentially slow operation

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Installation | BDD | Scenarios for copy, patch, restart |
| Standalone Script | BDD | Scenario for --link mode |

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
