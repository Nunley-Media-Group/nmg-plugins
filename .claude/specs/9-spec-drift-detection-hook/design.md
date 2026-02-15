# Design: Spec Drift Detection Hook

**Issue**: #9
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The spec drift detection hook is a PostToolUse hook that fires on every `Write` and `Edit` tool call. It uses a two-layer architecture: a `command`-type gate that short-circuits when no spec files exist, followed by an `agent`-type hook that reads all spec files and evaluates whether the file modification is consistent with the specifications.

The hook is defined in `plugins/nmg-sdlc/hooks/hooks.json` using Claude Code's hook configuration format. The command gate runs `ls .claude/specs/*/requirements.md` — if this fails (no specs exist), the hook chain stops immediately, avoiding expensive agent spawns. If specs exist, the agent hook reads them via Glob and evaluates alignment, returning a JSON response indicating OK or drift with an explanation.

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────┐
│         PostToolUse Hook Chain                 │
├──────────────────────────────────────────────┤
│                                                │
│  ┌─────────────────────────────┐               │
│  │ Gate: command type           │               │
│  │ ls .claude/specs/*/req.md    │──── fail ───▶ STOP (no specs)
│  └─────────┬───────────────────┘               │
│             │ success (specs exist)             │
│             ▼                                   │
│  ┌─────────────────────────────┐               │
│  │ Check: agent type            │               │
│  │ Read specs via Glob          │               │
│  │ Compare with $ARGUMENTS      │               │
│  │ Return {ok: true/false}      │               │
│  └─────────────────────────────┘               │
│                                                │
└──────────────────────────────────────────────┘
```

### Data Flow

```
1. Write or Edit tool completes
2. PostToolUse hook fires (matcher: Write|Edit)
3. Command gate: ls .claude/specs/*/requirements.md
4. If no specs → short-circuit, done
5. If specs exist → spawn agent
6. Agent globs for spec files (requirements.md, design.md)
7. Agent reads specs and compares with modification ($ARGUMENTS)
8. Agent returns {ok: true} or {ok: false, reason: "..."}
```

---

## File Changes

| File | Type | Purpose |
|------|------|---------|
| `plugins/nmg-sdlc/hooks/hooks.json` | Create | Hook configuration with command gate + agent hook |

---

## Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| Prompt-type hook (v1.0.0) | Inline prompt without spec reading | Rejected — can't read spec files |
| Agent-only hook | No command gate | Rejected — expensive on every Write/Edit |
| **Command gate + agent** | Short-circuit when no specs, agent when specs exist | **Selected** — efficient and thorough |

---

## Security Considerations

- [x] Agent has read-only access to spec files
- [x] No write operations in the hook
- [x] Hook is advisory — does not block file modifications

---

## Performance Considerations

- [x] Command gate short-circuits in <100ms when no specs exist
- [x] Agent timeout of 60 seconds prevents infinite hangs
- [x] Agent only reads spec files, not entire codebase

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Hook Firing | BDD | Scenarios for Write/Edit trigger |
| Command Gate | BDD | Scenario for no-specs short-circuit |
| Drift Detection | BDD | Scenario for spec violation flagging |

---

## Validation Checklist

- [x] Architecture follows Claude Code hook conventions
- [x] File changes documented
- [x] Security considerations addressed
- [x] Performance impact analyzed
- [x] Alternatives considered
