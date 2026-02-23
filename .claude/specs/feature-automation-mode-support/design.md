# Design: Automation Mode Support

**Issues**: #11, #71
**Date**: 2026-02-22
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
│                    → apply `automatable` label    │
│  /starting-issues  → filter by `automatable`     │
│                    → auto-select oldest eligible  │
│  /writing-specs    → skip 3 review gates          │
│  /implementing-specs → skip EnterPlanMode         │
│  /verifying-specs  → skip approval gates          │
│  /creating-prs     → output orchestrator signal   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│         GitHub `automatable` Label                │
├─────────────────────────────────────────────────┤
│  Color: #0E8A16 (green)                          │
│  Description: "Suitable for automated SDLC       │
│                processing"                        │
│  Applied by: /creating-issues (Step 8)           │
│  Filtered by: /starting-issues (Step 1)          │
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

### Automatable Label Flow (`/creating-issues`)

```
1. Interview phase runs (or auto-mode infers criteria)
2. After interview, before synthesizing issue body:
   a. Interactive mode: Ask "Is this issue suitable for automation?" (Yes/No)
   b. Auto-mode: Default to Yes (all auto-created issues are automatable)
3. Ensure `automatable` label exists in the repo:
   a. Run `gh label list --search automatable --json name --jq '.[].name'`
   b. If not found: `gh label create "automatable" --description "Suitable for automated SDLC processing" --color "0E8A16"`
4. Issue creation (Step 8):
   a. If automatable=Yes: add `automatable` to the `--label` list (e.g., `--label "enhancement,automatable"`)
   b. If automatable=No: omit `automatable` from labels
5. Postcondition check:
   a. Run `gh issue view #N --json labels --jq '.labels[].name'`
   b. Verify `automatable` is present (if it should be)
   c. If missing despite intent, warn in output
```

### Automatable Label Filter Flow (`/starting-issues`)

```
1. Auto-mode issue fetch:
   a. Add `--label automatable` to all `gh issue list` commands:
      - With milestone: `gh issue list -s open -m "<milestone>" --label automatable -L 10 --json number,title,labels`
      - Without milestone: `gh issue list -s open --label automatable -L 10 --json number,title,labels`
   b. If result is empty: report "No automatable issues found" and exit gracefully
2. Interactive mode issue fetch:
   a. Fetch issues WITHOUT label filter (all issues visible)
   b. When presenting options in Step 2, append "(automatable)" indicator to description
      for issues that have the `automatable` label
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
| `plugins/nmg-sdlc/skills/creating-issues/SKILL.md` | Modify | Add Automation Mode section; add automatable question (new Step 5b); update Step 8 to conditionally include `automatable` label; add label auto-creation; add postcondition check |
| `plugins/nmg-sdlc/skills/starting-issues/SKILL.md` | Modify | Add Automation Mode section; add `--label automatable` filter in auto-mode issue fetching; add empty-set handling; add automatable indicator in interactive mode |
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
| Filter in sdlc-runner.mjs | Add `--label automatable` in the runner script | Rejected — filtering at skill level is more cohesive; runner stays agnostic to label semantics |
| Separate `automation-eligible` label | Use a different label name | Rejected — `automatable` is shorter, clearer, and matches the concept directly |
| Runner-level `hasAutomatableIssues()` | Add runner function for label checking | Deferred — follow-up issue if runner needs to distinguish "no open issues" from "no automatable issues" |

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
| Automatable Question (Interactive) | BDD | Scenario: user asked, answers Yes → label applied; answers No → label omitted |
| Automatable Label (Auto-Mode) | BDD | Scenario: auto-mode → label applied without prompting |
| Label Auto-Creation | BDD | Scenario: label missing → created with correct color/description |
| Label Postcondition | BDD | Scenario: after issue creation → verify label present |
| Starting-Issues Filter | BDD | Scenario: auto-mode → only automatable issues returned |
| Starting-Issues Empty Set | BDD | Scenario: no automatable issues → graceful exit |
| Starting-Issues Indicator | BDD | Scenario: interactive mode → automatable indicator shown |

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

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #11 | 2026-02-15 | Initial feature spec |
| #71 | 2026-02-22 | Add automatable label gate: data flows for label creation, filtering, postcondition verification; updated file changes for creating-issues and starting-issues |

## Validation Checklist

- [x] Architecture follows cross-cutting pattern consistently
- [x] All skill modifications documented
- [x] Security considerations addressed
- [x] Alternatives considered (hook-based approach rejected with clear rationale)
