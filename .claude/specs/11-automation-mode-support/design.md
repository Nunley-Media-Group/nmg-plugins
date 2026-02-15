# Design: Automation Mode Support

**Issue**: #11
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

Automation mode is a cross-cutting concern that modifies the behavior of every SDLC skill. When `.claude/auto-mode` exists, each skill conditionally skips interactive steps: AskUserQuestion calls, EnterPlanMode requests, and human review gates. The implementation is skill-level awareness rather than hook-level blocking, because hook-based approaches caused infinite retry loops where Claude would endlessly attempt blocked tools.

The design is intentionally simple: a single flag file (`.claude/auto-mode`) triggers headless behavior. Each skill's SKILL.md includes an "Automation Mode" section that documents exactly which steps are skipped and what alternative behavior is used. Skills output "Done. Awaiting orchestrator." instead of next-step suggestions, providing a clean handoff signal for external orchestrators like OpenClaw.

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────┐
│            .claude/auto-mode (flag file)          │
└────────────────────┬────────────────────────────┘
                     │ checked by
                     ▼
┌─────────────────────────────────────────────────┐
│              All SDLC Skills                      │
├─────────────────────────────────────────────────┤
│  /creating-issues  → skip interview, infer ACs   │
│  /starting-issues  → auto-select oldest issue    │
│  /writing-specs    → skip 3 review gates          │
│  /implementing-specs → skip EnterPlanMode         │
│  /verifying-specs  → skip approval gates          │
│  /creating-prs     → output orchestrator signal   │
└─────────────────────────────────────────────────┘
```

### Data Flow

```
1. Skill is invoked
2. Skill checks for .claude/auto-mode file existence
3. If auto-mode:
   a. Skip interactive prompts (AskUserQuestion)
   b. Skip plan mode (EnterPlanMode)
   c. Skip review gates (proceed immediately)
   d. Use alternative behavior (infer, auto-select, etc.)
   e. Output "Done. Awaiting orchestrator." at completion
4. If not auto-mode:
   a. Normal interactive behavior
   b. Suggest next steps at completion
```

---

## File Changes

| File | Type | Purpose |
|------|------|---------|
| `plugins/nmg-sdlc/skills/creating-issues/SKILL.md` | Modify | Add Automation Mode section |
| `plugins/nmg-sdlc/skills/starting-issues/SKILL.md` | Modify | Add Automation Mode section |
| `plugins/nmg-sdlc/skills/writing-specs/SKILL.md` | Modify | Add Automation Mode section |
| `plugins/nmg-sdlc/skills/implementing-specs/SKILL.md` | Modify | Add Automation Mode section |
| `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md` | Modify | Add Automation Mode section |
| `plugins/nmg-sdlc/skills/creating-prs/SKILL.md` | Modify | Add orchestrator signal output |

---

## Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| Hook-based blocking (v1.5.0) | Block AskUserQuestion/EnterPlanMode via hooks | Rejected — caused infinite retry loops |
| Environment variable | Use env var instead of flag file | Rejected — less discoverable than a file |
| **Skill-level awareness** | Each skill checks flag file | **Selected** — clean, no retry issues |

---

## Security Considerations

- [x] Auto-mode must be activated locally (no remote triggers)
- [x] Flag file is a simple empty file, no configuration surface
- [x] All-or-nothing prevents partial automation confusion

---

## Performance Considerations

- [x] File existence check is sub-millisecond
- [x] No additional overhead when auto-mode is inactive
- [x] Skills skip steps, so auto-mode is generally faster

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Auto-Mode Detection | BDD | Scenario for flag file presence |
| Per-Skill Behavior | BDD | Scenarios for each skill's auto-mode behavior |
| Completion Signal | BDD | Scenario for orchestrator handoff |

---

## Validation Checklist

- [x] Architecture follows cross-cutting pattern consistently
- [x] All skill modifications documented
- [x] Security considerations addressed
- [x] Alternatives considered (hook-based approach rejected with clear rationale)
