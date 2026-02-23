# Design: Writing Specs Skill

**Issues**: #5, #16
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/writing-specs` skill is the specification engine of the nmg-sdlc workflow. It reads a GitHub issue and produces four spec documents through a 3-phase process: SPECIFY (requirements.md), PLAN (design.md), and TASKS (tasks.md + feature.gherkin). Each phase has a human review gate that can be bypassed in automation mode.

The skill includes a comprehensive template system with four template files in `plugins/nmg-sdlc/skills/writing-specs/templates/`. Each template has a primary (feature) variant and a defect variant, selected based on the presence of a `bug` label on the GitHub issue. The feature name used for the spec directory follows a deterministic algorithm: issue number + kebab-case slug of the title.

The skill serves as the bridge between issue definition and implementation — its output is consumed by `/implementing-specs` (reads specs to code) and `/verifying-specs` (validates code against specs).

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────────┐
│              /writing-specs Skill                  │
├──────────────────────────────────────────────────┤
│                                                    │
│  ┌─────────┐    ┌─────────┐    ┌─────────────┐   │
│  │ Phase 1 │───▶│ Phase 2 │───▶│   Phase 3   │   │
│  │ SPECIFY │    │  PLAN   │    │   TASKS     │   │
│  └────┬────┘    └────┬────┘    └──────┬──────┘   │
│       │              │                │           │
│   Review Gate    Review Gate     Review Gate      │
│       │              │                │           │
│   requirements.md  design.md    tasks.md          │
│                                 feature.gherkin   │
└──────────────────────────────────────────────────┘
        │                    │
        ▼                    ▼
┌──────────────┐    ┌──────────────────┐
│ templates/   │    │ .claude/specs/   │
│  ├ req.md    │    │  └ {feature}/    │
│  ├ design.md │    │    ├ req.md      │
│  ├ tasks.md  │    │    ├ design.md   │
│  └ feature.  │    │    ├ tasks.md    │
│    gherkin   │    │    └ feature.    │
└──────────────┘    │      gherkin     │
                    └──────────────────┘
```

### Data Flow

```
1. User invokes /writing-specs #N
2. Skill reads GitHub issue via gh issue view
3. Skill checks for bug label (defect detection)
4. Phase 1: Read steering/product.md → generate requirements.md from template
5. Human review gate (skip in auto-mode)
6. Phase 2: Read steering/tech.md, structure.md → generate design.md from template
7. Human review gate (skip in auto-mode)
8. Phase 3: Generate tasks.md and feature.gherkin from templates
9. Human review gate (skip in auto-mode)
10. Output summary with file paths
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
| `plugins/nmg-sdlc/skills/writing-specs/SKILL.md` | Create | Skill definition with 3-phase workflow |
| `plugins/nmg-sdlc/skills/writing-specs/templates/requirements.md` | Create | Requirements template (feature + defect variants) |
| `plugins/nmg-sdlc/skills/writing-specs/templates/design.md` | Create | Design template (feature + defect variants) |
| `plugins/nmg-sdlc/skills/writing-specs/templates/tasks.md` | Create | Tasks template (feature + defect variants) |
| `plugins/nmg-sdlc/skills/writing-specs/templates/feature.gherkin` | Create | Gherkin template (feature + defect variants) |
| `plugins/nmg-sdlc/skills/creating-issues/SKILL.md` | Modify | Add bug report template |
| `plugins/nmg-sdlc/skills/implementing-specs/SKILL.md` | Modify | Add bug fix implementation rules |
| `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md` | Modify | Add bug fix verification section |

---

## Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| Single-phase spec | One document covering everything | Rejected — too large, no review gates |
| AI-generated specs without templates | Free-form spec generation | Rejected — inconsistent output |
| **Template-driven 3-phase with gates** | Structured phases with human review | **Selected** — consistent, reviewable, iterative |
| Separate defect skill | Dedicated `/fixing-bugs` skill | Rejected — duplicates workflow; better to branch within existing skills |
| Manual template selection | User chooses template type | Rejected — error-prone; automatic label detection is reliable |
| **Label-based auto-routing** | `bug` label triggers defect variants | **Selected** — automatic, consistent, no user action needed |

---

## Security Considerations

- [x] Spec files contain only requirements and design, no secrets
- [x] GitHub issue access via authenticated `gh` CLI
- [x] No code execution during spec writing
- [x] Same security model for feature and defect templates
- [x] No additional permissions needed for defect handling
- [x] Label detection uses read-only `gh issue view`

---

## Performance Considerations

- [x] Each phase is a single pass through template + issue data
- [x] Steering doc reads are local file operations
- [x] Templates are lightweight Markdown
- [x] Label check is a single `gh issue view --json labels` call
- [x] Template routing adds no overhead (conditional in Markdown)
- [x] Flat task list (T001-T003) is simpler than feature tasks

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Phase Execution | BDD | Scenarios for each phase and review gate |
| Template Output | Manual | Verify generated specs match templates |
| Defect Detection | BDD | Scenario for bug label routing |
| Label Detection | BDD | Scenario for `bug` label routing |
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

### From Issue #16

## Defect Template Architecture

Defect spec handling is a cross-cutting enhancement that adds parallel template variants to every phase of the SDLC workflow. The `bug` label on a GitHub issue triggers automatic routing to defect-focused templates across all skills.

The defect templates are lighter than feature templates: Requirements focuses on reproduction and expected vs actual (omitting NFRs, UI/UX, data requirements); Design focuses on root cause analysis and fix strategy (omitting component diagrams, API schemas, DB migrations); Tasks uses a flat 2-4 task list (omitting the 5-phase structure); and Gherkin uses `@regression`-tagged scenarios focused on "bug is fixed" and "no regression." A complexity escape hatch allows supplementing defect variants with feature template sections for architectural bugs.

An optional "Related Spec" field in the defect requirements template enables traceability back to the original feature spec where the bug was found.

### Defect Routing Component Diagram

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

### Defect Data Flow

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

## Change History

| Date | Issue | Summary |
|------|-------|---------|
| 2026-02-15 | #5 | Initial design for writing-specs skill (3-phase template-driven workflow) |
| 2026-02-15 | #16 | Added defect template architecture: cross-cutting bug label routing, defect variant diagrams, cross-skill data flow |

---

## Validation Checklist

- [x] Architecture follows existing skill patterns
- [x] All file changes documented
- [x] Security considerations addressed
- [x] Alternatives considered
- [x] Architecture follows cross-cutting pattern consistently
