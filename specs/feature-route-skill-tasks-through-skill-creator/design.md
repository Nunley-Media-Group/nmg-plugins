# Design: Route Skill Creation and Update Tasks Through /skill-creator

**Issues**: #141
**Date**: 2026-04-19
**Status**: Draft
**Author**: Rich Nunley

---

## Overview

This change adds a detection-and-routing layer to three existing pipeline components — the `write-code` skill, the `spec-implementer` agent, and the `verify-code` skill — so that any task or finding touching a `SKILL.md` file is funneled through the `/skill-creator` skill rather than hand-authored via `Write`/`Edit`. Detection uses three conservative signals (path suffix, description tokens, issue tokens). Routing is guarded by a probe-and-skip pattern identical in shape to the existing `simplify` probe already present in `write-code` Step 5b and `verify-code` Step 6a-bis. When `/skill-creator` is unavailable, each component emits a verbatim warning (`skill-creator not available — implementing skill directly`) and falls back to direct authoring.

No runtime code is changed — this is entirely a prompt-engineering change across three Markdown files. The agent path (`spec-implementer.md`) and the inline-fallback path (`write-code` Step 5 fallback) receive the same logic so behaviour is consistent regardless of which execution branch fires. The verify-code integration plugs into the existing Step 6a finding-fix loop without changing report structure.

The design intentionally imports zero new patterns: the probe triple (`~/.claude/skills/*/SKILL.md`, `~/.claude/plugins/**/skills/*/SKILL.md`, system-reminder advertisement) is copied verbatim from the simplify probe, and the warning-string convention matches existing precedent. This keeps the change low-risk and easy to verify by comparison.

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                      Pipeline Components                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌────────────────┐        ┌────────────────┐                     │
│  │   write-code   │───────▶│ spec-implementer│                    │
│  │    SKILL.md    │  Task  │     (agent)     │                    │
│  └────────┬───────┘        └────────┬────────┘                    │
│           │                         │                              │
│           │ (inline fallback)       │                              │
│           ▼                         ▼                              │
│  ┌────────────────────────────────────────────┐                   │
│  │       SKILL-TASK DETECTOR (shared logic)   │                   │
│  │  - path suffix SKILL.md                    │                   │
│  │  - description tokens {skill, SKILL.md,    │                   │
│  │    skill definition}                       │                   │
│  │  - issue title/body token {skill}          │                   │
│  └──────────────────┬─────────────────────────┘                   │
│                     │                                              │
│                     ▼                                              │
│  ┌────────────────────────────────────────────┐                   │
│  │       SKILL-CREATOR PROBE (shared logic)   │                   │
│  │  - ~/.claude/skills/skill-creator/SKILL.md │                   │
│  │  - ~/.claude/plugins/**/skills/            │                   │
│  │      skill-creator/SKILL.md                │                   │
│  │  - system-reminder advertises skill-creator│                   │
│  └──────────────────┬─────────────────────────┘                   │
│          available │              │ unavailable                   │
│                    ▼              ▼                                │
│          ┌──────────────┐   ┌─────────────────┐                   │
│          │ /skill-creator│   │  Write / Edit   │                   │
│          │  invocation   │   │  + warning msg  │                   │
│          └──────────────┘   └─────────────────┘                   │
│                                                                    │
│  ┌────────────────┐                                                │
│  │   verify-code  │  Step 6a Fix Findings                          │
│  │    SKILL.md    │────────▶ (same detector + probe)               │
│  └────────────────┘                                                │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Component enters its task/finding loop (write-code Step 5, spec-implementer step 3, or verify-code Step 6a)
2. For each task or finding, run the SKILL-TASK DETECTOR over:
   - file path
   - task/finding description
   - issue title + body (cached once at component entry)
3. If NOT a skill task → proceed with existing direct-authoring flow (unchanged)
4. If a skill task → run the SKILL-CREATOR PROBE
5. If /skill-creator available → invoke it with task context and any existing file content, then continue
6. If /skill-creator unavailable → emit verbatim warning and fall back to Write/Edit
7. Record the routing decision in the component's normal output (task-done note, verification report row)
```

---

## API / Interface Changes

### No New External APIs

This change introduces zero new endpoints, commands, or tool interfaces. All routing is internal to the Markdown prompts.

### Internal Contracts

#### SKILL-TASK DETECTOR (shared specification)

A task or finding is classified as **skill-related** when ANY of the following is true:

| Signal | Check |
|--------|-------|
| Path suffix | The task's target file path, when normalized, ends with `/SKILL.md` (case-sensitive) |
| Description tokens | The task description or finding summary contains one of: `skill`, `SKILL.md`, `skill definition` (case-insensitive word-boundary match; `skills` matches, `skillet` does not) |
| Issue tokens | The issue title or issue body contains `skill` (case-insensitive word-boundary match) |

The detector is deliberately conservative — any single signal triggers routing. This satisfies AC6 (false-positive bias).

#### SKILL-CREATOR PROBE (shared specification)

Mirror of the existing simplify probe. `/skill-creator` is considered available if ANY of:

1. `Glob` finds `~/.claude/skills/skill-creator/SKILL.md`
2. `Glob` finds `~/.claude/plugins/**/skills/skill-creator/SKILL.md`
3. The available-skills list in the current system reminder advertises a skill named `skill-creator` (or matches `*:skill-creator`)

The probe is a filesystem + system-reminder check. It does NOT use `AskUserQuestion`, preserving unattended-mode behaviour (AC8).

#### Invocation Contract (when available)

When routing to `/skill-creator`, each component passes:

- **Task/finding context**: A concise handoff describing what needs to be produced or fixed (task title, acceptance criteria, or finding summary)
- **Target file path**: The `SKILL.md` path the skill should land at
- **Existing content (if any)**: For edits and verify-code fixes, the current file contents so `/skill-creator` can update rather than rewrite from scratch
- **Steering docs pointer**: A reference to `steering/` so `/skill-creator` can consult project conventions

The exact invocation shape matches how the simplify probe invokes `/simplify` today — the component uses the Skill tool or `/skill-creator` invocation syntax exposed by Claude Code at runtime.

#### Warning String (when unavailable)

Emitted verbatim, enclosed in a code block (matching the simplify-probe precedent in `write-code` Step 5b):

```
skill-creator not available — implementing skill directly
```

---

## Database / Storage Changes

None. This feature does not touch persistent storage.

---

## State Management

No new state is introduced. Two ephemeral per-run values are used:

| Value | Scope | Purpose |
|-------|-------|---------|
| `isSkillTask: boolean` | Per task/finding | Detector output; consumed immediately by routing decision |
| `skillCreatorAvailable: boolean` | Per component invocation | Probe result; may be cached once per run to avoid re-probing every task |

Caching is optional — the probe is cheap (one or two `Glob` calls). Components SHOULD cache the probe result for the duration of their run so the warning is emitted at most once per run even if multiple skill tasks exist.

---

## UI Components

Not applicable — no UI.

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Hard-require `/skill-creator`** | Fail the pipeline if `/skill-creator` is not installed when a skill task is detected | Enforces the architectural invariant strictly | Breaks the pipeline for downstream projects that don't install skill-creator; violates the graceful-degradation principle in `steering/product.md` | Rejected — violates stated principle |
| **B: Detect in a shared include file** | Extract detector and probe into a single shared Markdown include referenced by all three components | DRY; one place to update heuristics | Claude Code Markdown skills don't support includes/transclusion today; would introduce a non-standard convention | Rejected — no native include support |
| **C: Inline detection + probe per component** | Duplicate the detector and probe blocks in all three files with identical wording | Simple; matches existing precedent (simplify probe is already duplicated across write-code and verify-code) | Three copies to keep in sync | **Selected** — consistent with existing project convention; low maintenance burden given the blocks are small and stable |
| **D: Route everything through `/skill-creator`** | Drop the detector; invoke `/skill-creator` for every task and let it decide whether skill work is needed | Simplest; zero detection bugs | Excessive overhead for non-skill tasks; `/skill-creator` isn't designed as a general-purpose router | Rejected — wrong tool for non-skill work |
| **E: Detect but don't route in `spec-implementer`** | Only change `write-code` and `verify-code`; let the agent keep using direct edits | Smaller change surface | Creates an inconsistency — the agent path (default when manual mode delegates via Task) would bypass the invariant | Rejected — violates issue FR3 |

---

## Security Considerations

- [x] **Authentication**: No change — routing inherits Claude Code's existing plugin permission model
- [x] **Authorization**: `/skill-creator` is invoked with the same tool permissions as the calling component
- [x] **Input Validation**: Detection runs on trusted spec content (task descriptions, issue body) already present in the pipeline; no new external input surface
- [x] **Data Sanitization**: Task context passed to `/skill-creator` is passed as prompt content, not as shell arguments — no injection risk
- [x] **Sensitive Data**: No secrets or credentials are involved

---

## Performance Considerations

- [x] **Caching**: Probe result cached per component run (see State Management)
- [x] **Detection cost**: O(1) per task — a few string checks
- [x] **Probe cost**: Two `Glob` calls per component run (cached), plus one system-reminder scan — negligible
- [x] **Skill-creator invocation cost**: Inherits `/skill-creator`'s own runtime profile; not measured here

No hot paths are affected.

---

## Testing Strategy

Per `steering/tech.md`, this project uses **exercise-based verification** — skills are Markdown, not executable code. Traditional unit tests don't apply. Testing combines Gherkin specs (acceptance criteria) with Claude Code exercise runs against a disposable test project.

| Layer | Type | Coverage |
|-------|------|----------|
| Detection heuristic | Exercise | Seed tasks with each signal type (path, description, issue) — confirm each triggers routing; seed a non-skill task — confirm it does not |
| Probe behaviour | Exercise | Run against test project with `/skill-creator` installed (route taken), then uninstall and re-run (warning emitted, fallback taken) |
| write-code integration | Exercise | Invoke `/nmg-sdlc:write-code #N` in a test project with a seeded skill-task spec; confirm `/skill-creator` is called |
| spec-implementer integration | Exercise | Invoke write-code in a mode that delegates to spec-implementer (non-unattended), confirm agent routes skill tasks |
| verify-code integration | Exercise | Seed a finding in a `SKILL.md` file; invoke `/nmg-sdlc:verify-code #N`; confirm the fix is routed through `/skill-creator` |
| Graceful degradation | Exercise | Remove `/skill-creator`; re-run each of the above; confirm the verbatim warning appears and the fallback authoring produces the file |
| Unattended mode | Exercise | Create `.claude/unattended-mode` in test project; confirm no new interactive prompts are introduced by routing |

The `feature.gherkin` file in this spec enumerates the concrete scenarios.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Detection false negatives (a skill task slips through as direct-authored) | Medium | Medium | Conservative detector (three independent signals, any one triggers); false-positive bias documented in AC6 |
| `/skill-creator` invocation contract changes in a future version | Low | Low | Invocation uses the public skill interface; any breakage surfaces as an obvious failure rather than silent corruption |
| Warning string drifts in one of the three components | Low | Low | Verbatim string specified in FR5; a grep against the three files can enforce consistency in verify-code |
| Probe cost compounds on runs with many tasks | Low | Low | Probe is cached per component run |
| Routing adds latency to every skill task | Low | Low | Inherent tradeoff of going through a dedicated skill; accepted per the architectural invariant |

---

## Open Questions

- [ ] **Resolved**: Q from requirements.md ("does /skill-creator accept a single combined prompt") — the invocation is via the standard Claude Code skill mechanism; the component passes a prompt describing the work and the target path, and `/skill-creator` handles both create and edit cases internally. Matches how `/simplify` is invoked today.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #141 | 2026-04-19 | Initial feature design |

---

## Validation Checklist

- [x] Architecture follows existing project patterns (per `structure.md`) — reuses simplify-probe pattern
- [x] All API/interface changes documented (none external; internal detector and probe specified)
- [x] Database/storage changes planned — none
- [x] State management approach is clear — ephemeral per-run values only
- [x] UI components and hierarchy defined — N/A
- [x] Security considerations addressed
- [x] Performance impact analyzed
- [x] Testing strategy defined — exercise-based per `tech.md`
- [x] Alternatives were considered and documented
- [x] Risks identified with mitigations
