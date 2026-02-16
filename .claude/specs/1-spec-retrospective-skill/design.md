# Design: Spec Retrospective Skill

**Issue**: #1
**Date**: 2026-02-15
**Status**: Draft
**Author**: Claude

---

## Overview

This feature adds a new `/running-retrospectives` skill to the nmg-sdlc plugin and a small integration point in `/writing-specs`. The skill scans all defect specs in `.claude/specs/`, identifies those with `Related Spec` links back to feature specs, analyzes the gap between what the feature spec covered and what the defect revealed, classifies findings into three pattern types, and writes a structured `.claude/steering/retrospective.md` steering document. The `/writing-specs` skill then reads this document during Phase 1 alongside the existing steering docs.

The design is intentionally simple: the skill is a prompt-based workflow (SKILL.md) with one template for the output document. No agents, hooks, or scripts are needed. The skill uses Glob/Grep/Read to scan specs, then Write to produce the output. The heavy lifting — pattern analysis and learning extraction — is done by the LLM following structured instructions in the SKILL.md.

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    nmg-sdlc Plugin                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Skills (existing)                                          │
│  ┌─────────────────┐                                        │
│  │ /writing-specs  │──reads──▶ .claude/steering/*           │
│  └────────┬────────┘          (product, tech, structure,    │
│           │                    + NEW: retrospective.md)     │
│           │                                                 │
│  Skills (new)                                               │
│  ┌──────────────────────────┐                               │
│  │ /running-retrospectives  │                               │
│  └────────┬─────────────────┘                               │
│           │                                                 │
│           ├──reads──▶ .claude/specs/*/requirements.md        │
│           │           (scan for defect specs with            │
│           │            Related Spec links)                   │
│           │                                                 │
│           ├──reads──▶ .claude/specs/{related}/requirements.md│
│           │           (read the linked feature spec)         │
│           │                                                 │
│           └──writes─▶ .claude/steering/retrospective.md     │
│                       (structured learnings by pattern type) │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User invokes /running-retrospectives
2. Skill scans .claude/specs/*/requirements.md for defect indicators
   (Severity: field identifies defect specs)
3. Filters to defect specs that have a Related Spec: field
4. For each eligible defect spec:
   a. Read the defect requirements.md (reproduction, ACs, root cause context)
   b. Read the related feature spec's requirements.md
   c. Compare: what did the feature spec cover vs what the defect revealed?
   d. Classify the gap into a pattern type
5. Aggregate learnings across all defect specs
6. Read existing retrospective.md (if it exists) for incremental update
7. Write .claude/steering/retrospective.md with structured learnings
8. Output summary to user
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

### New Files

| File | Purpose |
|------|---------|
| `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md` | Skill definition — workflow, automation mode, integration |
| `plugins/nmg-sdlc/skills/running-retrospectives/templates/retrospective.md` | Template for the output steering document |

### Modified Files

| File | Change | Rationale |
|------|--------|-----------|
| `plugins/nmg-sdlc/skills/writing-specs/SKILL.md` | Add `retrospective.md` to Phase 1 steering doc reads | FR7 — writing-specs consumes retrospective learnings |
| `README.md` | Add `/running-retrospectives` to the SDLC Skills Reference table | Discoverability — all skills listed in the README |

---

## SKILL.md Design

### Metadata

```yaml
---
name: running-retrospectives
description: "Analyze defect specs to identify spec-writing gaps and produce actionable learnings."
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(gh:*)
---
```

### Workflow Steps

| Step | Action | Tools Used |
|------|--------|------------|
| 1 | Scan `.claude/specs/*/requirements.md` for defect specs (contain `Severity:` field) | Glob, Grep |
| 2 | Filter to defect specs with `Related Spec:` field | Read (each candidate) |
| 3 | For each eligible defect: read defect spec + linked feature spec | Read |
| 4 | Analyze gap between feature spec coverage and defect finding | LLM analysis |
| 5 | Classify each learning into pattern type | LLM analysis |
| 6 | Read existing `retrospective.md` if present (for incremental update) | Read |
| 7 | Write/update `.claude/steering/retrospective.md` using template | Write |
| 8 | Output summary | Console output |

### Defect Spec Detection Strategy

Defect specs are identified by scanning for the `**Severity**:` field in `requirements.md` files. This field is unique to the defect requirements template and does not appear in feature specs. The detection approach:

```
1. Glob: .claude/specs/*/requirements.md
2. Grep each file for "Severity:" — matches are defect specs
3. Read matched files, extract Related Spec field
4. Skip files without Related Spec (no feature spec to correlate)
```

### Pattern Classification

The skill classifies each learning into exactly one of three categories:

| Pattern Type | Description | Example |
|-------------|-------------|---------|
| **Missing Acceptance Criteria** | The feature spec lacked ACs for the scenario that caused the bug | Feature spec for login had no AC for session timeout expiry |
| **Undertested Boundaries** | The feature spec had related ACs but didn't cover the boundary condition | Feature spec tested valid inputs but not empty string or max-length |
| **Domain-Specific Gaps** | The feature spec missed domain knowledge that should have been captured | Financial feature spec didn't consider rounding rules for currency |

### Learning Filtering Logic

The skill EXCLUDES learnings that fall outside spec-writing scope:

| Exclude Category | Rationale | Example |
|-----------------|-----------|---------|
| Implementation bugs | Code-level errors, not spec gaps | Off-by-one error, wrong variable name |
| Tooling issues | Build/CI/toolchain problems | Webpack config error, dependency conflict |
| Infrastructure failures | Environment/deployment issues | Server timeout, DNS misconfiguration |
| Process failures | Workflow/communication gaps | Missing code review, skipped testing |

The heuristic: if the defect could have been prevented by a better-written feature spec (more ACs, tighter boundary definitions, deeper domain analysis), it produces a learning. If not, it's excluded.

---

## Retrospective Document Format

### Template Structure

```markdown
# Spec Retrospective

**Last Updated**: [YYYY-MM-DD]
**Defect Specs Analyzed**: [count]
**Learnings Generated**: [count]

---

## How to Use This Document

This document is automatically generated by `/running-retrospectives` and read by
`/writing-specs` during Phase 1 (SPECIFY). When writing new feature specs, consult
the relevant sections below to avoid repeating past spec gaps.

---

## Missing Acceptance Criteria

Defects caused by scenarios that the original feature spec did not cover at all.

| Learning | Source Defect | Related Feature Spec | Recommendation |
|----------|--------------|---------------------|----------------|
| [description] | .claude/specs/[defect]/ | .claude/specs/[feature]/ | [actionable guidance] |

---

## Undertested Boundaries

Defects caused by boundary conditions the original feature spec addressed
insufficiently.

| Learning | Source Defect | Related Feature Spec | Recommendation |
|----------|--------------|---------------------|----------------|
| [description] | .claude/specs/[defect]/ | .claude/specs/[feature]/ | [actionable guidance] |

---

## Domain-Specific Gaps

Defects caused by domain knowledge the original feature spec failed to capture.

| Learning | Source Defect | Related Feature Spec | Recommendation |
|----------|--------------|---------------------|----------------|
| [description] | .claude/specs/[defect]/ | .claude/specs/[feature]/ | [actionable guidance] |
```

### Design Decisions for Format

- **Tables per section**: Structured for machine readability (writing-specs can parse) and human readability
- **Source traceability**: Every learning links back to its defect spec and related feature spec
- **Actionable recommendations**: Each learning includes a concrete "when writing specs for X, also consider Y" guidance
- **Three fixed sections**: Matches the three pattern types; writing-specs can scan for the relevant section heading

---

## Writing-Specs Integration Design

### Change to `/writing-specs` Phase 1

The modification is minimal — add one read step and one instruction to the existing Phase 1 process:

**Current Phase 1 Process (step 3):**
```
3. Read `.claude/steering/product.md` for user context and product vision
```

**Updated Phase 1 Process (add after step 3):**
```
3. Read `.claude/steering/product.md` for user context and product vision
4. If `.claude/steering/retrospective.md` exists, read it and apply relevant
   learnings when drafting acceptance criteria — especially for features in
   domains where past defects revealed spec gaps
```

Subsequent step numbers shift by 1. The retrospective is read but does not change the template structure — it provides additional context that influences the LLM's AC generation.

### Why Conditional Read (Not Required)

The retrospective doc is optional because:
- New projects won't have defect specs yet
- Projects without defect patterns shouldn't be blocked
- The skill should work identically to today when no retrospective exists

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Subagent-based analysis** | Create a dedicated agent (like architecture-reviewer) to analyze defect specs | Reusable analysis; could be invoked from other contexts | Over-engineered for prompt-based analysis; adds complexity | Rejected — SKILL.md with LLM analysis is sufficient |
| **B: Per-defect incremental mode** | Process one defect at a time as they're filed | Lower latency per invocation | Complex state management; harder to identify cross-defect patterns | Rejected — batch mode captures patterns across defects (per issue scope) |
| **C: Inline in writing-specs** | Build analysis directly into `/writing-specs` Phase 1 | No new skill needed | Violates single-responsibility; makes writing-specs slower; can't run analysis independently | Rejected — separate skill is cleaner |
| **D: Structured SKILL.md + template** | New skill with workflow steps, output template, and writing-specs integration | Simple, follows existing patterns, separately invocable | Requires manual invocation (not automatic) | **Selected** |

---

## Security Considerations

- [ ] **Authentication**: [How auth is enforced]
- [ ] **Authorization**: [Permission checks required]
- [ ] **Input Validation**: [Validation approach]
- [ ] **Data Sanitization**: [How data is sanitized]
- [ ] **Sensitive Data**: [How sensitive data is handled]

---

## Performance Considerations

- [ ] **Caching**: [Caching strategy]
- [ ] **Pagination**: [Pagination approach for large datasets]
- [ ] **Lazy Loading**: [What loads lazily]
- [ ] **Indexing**: [Database indexes or search indexes needed]

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Skill workflow | BDD (Gherkin) | All 5 acceptance criteria become scenarios |
| Defect detection | BDD scenario | Correctly identifies defect specs via Severity field |
| Pattern classification | BDD scenario | Correctly classifies learnings into 3 types |
| Learning filtering | BDD scenario | Excludes non-spec learnings |
| Incremental update | BDD scenario | Preserves existing learnings, adds new, removes outdated |
| Writing-specs integration | BDD scenario | Phase 1 reads and applies retrospective when present |
| Graceful degradation | BDD scenario | Handles missing Related Spec, no defect specs, empty specs |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LLM misclassifies learning pattern type | Medium | Low | Three-type taxonomy is simple; examples in SKILL.md guide classification |
| Defect spec lacks enough detail for analysis | Medium | Low | Skill warns about sparse defect specs; produces best-effort learnings |
| Retrospective doc grows unwieldy over many runs | Low | Medium | Incremental update removes outdated learnings; human curation encouraged |
| Writing-specs ignores retrospective learnings | Low | Medium | Explicit instruction in SKILL.md to apply learnings; examples provided |
| Related Spec link points to deleted/moved spec | Low | Low | Skill warns about broken links; skips that defect spec |

---

## Open Questions

- None remaining — all design decisions resolved.

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Architecture follows existing project patterns (per `structure.md`)
- [x] All file changes documented
- [x] No database/storage changes needed (file-based output)
- [x] State management N/A (stateless skill, file output)
- [x] UI components N/A (CLI skill, console output)
- [x] Security considerations N/A (no auth, no external services beyond existing gh CLI)
- [x] Performance impact minimal (batch scan of local files)
- [x] Testing strategy defined (BDD scenarios for all ACs)
- [x] Alternatives were considered and documented
- [x] Risks identified with mitigations
