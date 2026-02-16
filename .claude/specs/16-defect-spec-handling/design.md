# Design: Defect-Specific Spec Handling

**Issue**: #16
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

Defect spec handling is a cross-cutting enhancement that adds parallel template variants to every phase of the SDLC workflow. The `bug` label on a GitHub issue triggers automatic routing to defect-focused templates across all skills. This was implemented by adding defect variant sections to each of the four writing-specs templates and adding defect-specific behavior to the creating-issues, implementing-specs, and verifying-specs skills.

The defect templates are lighter than feature templates: Requirements focuses on reproduction and expected vs actual (omitting NFRs, UI/UX, data requirements); Design focuses on root cause analysis and fix strategy (omitting component diagrams, API schemas, DB migrations); Tasks uses a flat 2-4 task list (omitting the 5-phase structure); and Gherkin uses `@regression`-tagged scenarios focused on "bug is fixed" and "no regression." A complexity escape hatch allows supplementing defect variants with feature template sections for architectural bugs.

An optional "Related Spec" field in the defect requirements template enables traceability back to the original feature spec where the bug was found.

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────────┐
│           GitHub Issue with `bug` label            │
└────────────────────┬─────────────────────────────┘
                     │ triggers
                     ▼
┌──────────────────────────────────────────────────┐
│              Defect Template Routing               │
├──────────────────────────────────────────────────┤
│                                                    │
│  /creating-issues → Bug Report Template            │
│    ├── Reproduction steps                          │
│    ├── Expected/Actual behavior                    │
│    └── Environment table                           │
│                                                    │
│  /writing-specs → Defect Variants                  │
│    ├── requirements.md → Defect Requirements       │
│    │   (severity, reproduction, Related Spec)      │
│    ├── design.md → Root Cause Analysis             │
│    │   (fix strategy, blast radius, regression)    │
│    ├── tasks.md → Flat T001-T003                   │
│    └── feature.gherkin → @regression scenarios     │
│                                                    │
│  /implementing-specs → Minimal Change Mode         │
│    ├── Follow fix strategy precisely               │
│    ├── Minimize change scope                       │
│    └── Require regression test                     │
│                                                    │
│  /verifying-specs → Regression Verification        │
│    ├── Reproduction check                          │
│    ├── @regression scenario validation             │
│    ├── Blast radius audit                          │
│    └── Minimal change confirmation                 │
└──────────────────────────────────────────────────┘
```

### Data Flow

```
1. GitHub issue has `bug` label
2. Skill detects label via gh issue view --json labels
3. Template routing switches to defect variant
4. Creating-issues: bug report template with reproduction steps
5. Writing-specs Phase 1: defect requirements (severity, reproduction)
6. Writing-specs Phase 2: root cause analysis (fix strategy, blast radius)
7. Writing-specs Phase 3: flat task list (T001-T003) + @regression gherkin
8. Implementing-specs: follow fix strategy, minimal change, regression test
9. Verifying-specs: reproduction check, regression validation, blast radius audit
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
| `plugins/nmg-sdlc/skills/writing-specs/templates/requirements.md` | Modify | Add Defect Requirements Variant section |
| `plugins/nmg-sdlc/skills/writing-specs/templates/design.md` | Modify | Add Defect Design Variant (root cause analysis) |
| `plugins/nmg-sdlc/skills/writing-specs/templates/tasks.md` | Modify | Add Defect Tasks Variant (flat T001-T003) |
| `plugins/nmg-sdlc/skills/writing-specs/templates/feature.gherkin` | Modify | Add Defect Regression Scenarios variant |
| `plugins/nmg-sdlc/skills/creating-issues/SKILL.md` | Modify | Add bug report template |
| `plugins/nmg-sdlc/skills/writing-specs/SKILL.md` | Modify | Add defect detection and routing |
| `plugins/nmg-sdlc/skills/implementing-specs/SKILL.md` | Modify | Add bug fix implementation rules |
| `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md` | Modify | Add bug fix verification section |

---

## Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| Separate defect skill | Dedicated `/fixing-bugs` skill | Rejected — duplicates workflow; better to branch within existing skills |
| Manual template selection | User chooses template type | Rejected — error-prone; automatic label detection is reliable |
| **Label-based auto-routing** | `bug` label triggers defect variants | **Selected** — automatic, consistent, no user action needed |

---

## Security Considerations

- [x] Same security model as feature templates
- [x] No additional permissions needed for defect handling
- [x] Label detection uses read-only `gh issue view`

---

## Performance Considerations

- [x] Label check is a single `gh issue view --json labels` call
- [x] Template routing adds no overhead (conditional in Markdown)
- [x] Flat task list (T001-T003) is simpler than feature tasks

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Label Detection | BDD | Scenario for `bug` label routing |
| Template Output | BDD | Scenarios for each defect variant |
| Cross-Skill | BDD | Scenarios for implementation and verification behavior |

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

- [x] Architecture follows cross-cutting pattern consistently
- [x] All file changes documented
- [x] Security considerations addressed
- [x] Alternatives considered
