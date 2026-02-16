# Design: OpenClaw SDLC Orchestration

**Issue**: #12
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The SDLC runner (`openclaw/scripts/sdlc-runner.mjs`) is a Node.js script that orchestrates the complete SDLC cycle using deterministic `for`-loop step sequencing. Each step spawns a `claude -p` subprocess with a specific skill prompt, configurable maxTurns and timeout, and precondition validation. The runner handles retry logic with escalation, Discord status updates via `openclaw message send`, auto-commit of dirty work trees, and resume detection from git state.

The runner reads configuration from `sdlc-config.json`, which provides per-step settings (maxTurns, timeout, prompt templates). On startup, the runner inspects the git state (branch name, spec files, commit count, PR status, CI status) to determine if in-progress work exists and resumes from the correct step. State is tracked via `lastCompletedStep` in `.claude/sdlc-state.json`.

The companion OpenClaw skill (`openclaw/skills/running-sdlc/SKILL.md`) provides the Claude Code skill interface that OpenClaw uses to invoke the runner.

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────────┐
│            OpenClaw Platform                       │
│  ┌────────────────────────────────────────┐       │
│  │  running-sdlc Skill (SKILL.md)         │       │
│  │  → invokes sdlc-runner.mjs             │       │
│  └──────────────┬─────────────────────────┘       │
└─────────────────┼────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────┐
│         sdlc-runner.mjs (Node.js)                 │
├──────────────────────────────────────────────────┤
│  1. Load config (sdlc-config.json)                │
│  2. Detect in-progress work (git state)           │
│  3. For each step:                                │
│     a. Validate preconditions                     │
│     b. Post Discord status (start)                │
│     c. Spawn claude -p subprocess                 │
│     d. Handle success/failure                     │
│     e. Post Discord status (complete/fail)        │
│     f. Retry on failure (with escalation)         │
│     g. Auto-commit if dirty (step 4)              │
│  4. Track lastCompletedStep                       │
└──────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────┐    ┌──────────────────┐
│ claude -p   │    │ openclaw message  │
│ subprocesses│    │ send (Discord)    │
└─────────────┘    └──────────────────┘
```

### Data Flow

```
1. OpenClaw invokes running-sdlc skill
2. Runner loads sdlc-config.json
3. Runner checks git state for in-progress work
4. For each SDLC step (7 steps):
   a. Validate step preconditions (git branch, spec files, commits, PR, CI)
   b. Post Discord start message
   c. Spawn claude -p with skill prompt, maxTurns, timeout
   d. On success: track lastCompletedStep, post Discord success
   e. On failure: retry up to cap, escalate if exhausted
   f. After implementation: auto-commit dirty work tree
5. After all steps: post completion to Discord
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
| `openclaw/scripts/sdlc-runner.mjs` | Create | Main Node.js orchestrator script |
| `openclaw/scripts/sdlc-config.example.json` | Create | Config template with per-step settings |
| `openclaw/skills/running-sdlc/SKILL.md` | Create | OpenClaw skill that invokes the runner |

---

## Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| Prompt-engineered heartbeat loop | Claude drives the loop via prompt | Rejected — non-deterministic, unreliable step ordering |
| Shell script orchestrator | Bash script with claude -p calls | Rejected — limited error handling and state management |
| **Node.js deterministic runner** | for-loop with preconditions, retries, Discord | **Selected** — full control, reliable, maintainable |

---

## Security Considerations

- [x] No secrets in the runner script or config file
- [x] Discord channel ID is the only external identifier
- [x] `claude -p` subprocesses inherit the user's authentication
- [x] Config file is gitignored by the generating skill

---

## Performance Considerations

- [x] Each step bounded by configurable timeout
- [x] Discord messages have retry with backoff
- [x] Subprocess spawning is efficient (one at a time)
- [x] Resume from git state avoids re-running completed steps

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Step Sequencing | BDD | End-to-end cycle scenario |
| Preconditions | BDD | Validation scenario |
| Retry Logic | BDD | Failure and escalation scenario |
| Resume | BDD | In-progress detection scenario |

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

- [x] Architecture follows deterministic orchestration pattern
- [x] All file changes documented
- [x] Security considerations addressed
- [x] Alternatives considered (prompt-engineered loop rejected)
