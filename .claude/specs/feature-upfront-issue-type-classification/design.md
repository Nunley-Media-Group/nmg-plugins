# Design: Upfront Issue Type Classification

**Issues**: #21
**Date**: 2026-02-15
**Status**: Draft
**Author**: Claude

---

## Overview

This feature modifies the creating-issues skill (`plugins/nmg-sdlc/skills/creating-issues/SKILL.md`) to add upfront type classification and type-specific codebase investigation before the interview phase. The change is entirely within a single Markdown skill definition — no new files, templates, or code are required.

The current 6-step workflow will be restructured to insert a classification step immediately after context gathering, followed by a type-specific investigation step. The existing interview, synthesis, review, and creation steps are then adapted to use the classified type. The skill's `allowed-tools` frontmatter already includes `Read`, `Glob`, and `Grep` (currently unused), so no frontmatter changes are needed for investigation capabilities.

The two issue body templates (feature/enhancement and bug report) will each gain one new section: "Current State" for enhancements and "Root Cause Analysis" for bugs.

---

## Architecture

### Component Diagram

```
creating-issues SKILL.md (single file modification)
┌────────────────────────────────────────────────────────────────┐
│  Step 1: Gather Context          (existing, minor update)      │
│  Step 2: Classify Issue Type     (NEW — AskUserQuestion)       │
│  Step 3: Investigate Codebase    (NEW — type-specific)         │
│     ├── Enhancement path: specs + source exploration           │
│     └── Bug path: search, trace, hypothesize, confirm          │
│  Step 4: Interview the User      (existing, adapted per type)  │
│  Step 5: Synthesize into Issue   (existing, new sections)      │
│  Step 6: Present Draft for Review (unchanged)                  │
│  Step 7: Create the Issue        (unchanged)                   │
│  Step 8: Output                  (unchanged)                   │
└────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User invokes /creating-issues [optional argument]
2. Step 1: Read argument + steering docs (existing)
3. Step 2: AskUserQuestion → "Bug" or "Enhancement/Feature"
4. Step 3: Based on classification:
   ├── Enhancement: Glob .claude/specs/ → Read relevant specs
   │                Glob/Grep source files → Read patterns
   │                → Produce "Current State" summary
   └── Bug:         Grep codebase for related code
                    Read affected files, trace paths
                    → Produce root cause hypothesis
                    → AskUserQuestion to confirm hypothesis
5. Step 4: Type-adapted interview (existing questions filtered by type)
6. Step 5: Synthesize issue body with new section included
7. Step 6–8: Review, create, output (unchanged)
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

## Detailed Design

### Step 2: Classify Issue Type (NEW)

Insert immediately after Step 1 (Gather Context). Uses `AskUserQuestion` with two options:

| Option | Label | Description |
|--------|-------|-------------|
| Bug | "Bug" | "Something is broken or behaving incorrectly" |
| Enhancement/Feature | "Enhancement / Feature" | "New capability or improvement to existing behavior" |

**Auto-mode bypass**: This step is skipped entirely. Auto-mode already skips the interview (Step 2 in current skill → Step 4 in new skill), so classification is not needed. The existing auto-mode instructions are updated to reference the new step numbers.

**If argument provides a clear signal** (e.g., user said "fix the broken X" or "add Y feature"), the skill should still ask the classification question — the argument seeds the interview, not the classification.

### Step 3: Investigate Codebase (NEW)

Two branches based on classification result:

#### Enhancement Path

1. **Explore existing specs**: `Glob` for `.claude/specs/*/requirements.md` and read any that relate to the area the user described
2. **Explore source code**: Use `Glob` and `Grep` to find files related to the enhancement area (e.g., if enhancing the creating-issues skill, find the SKILL.md, any templates, related hooks)
3. **Summarize findings**: Produce a "Current State" summary capturing:
   - What exists today (relevant code, patterns, specs)
   - How the current implementation works
   - What patterns should be preserved or built upon

If no relevant code or specs are found, note that explicitly and move on.

#### Bug Path

1. **Search for related code**: Use `Grep` to find code related to the bug description (error messages, function names, file patterns the user mentioned)
2. **Trace code paths**: `Read` the relevant files, follow the logic through the affected paths
3. **Form hypothesis**: Based on the investigation, formulate a root cause hypothesis describing:
   - What code is involved
   - What the incorrect behavior/assumption is
   - Why it manifests as the reported bug
4. **Confirm with user**: Present the hypothesis via `AskUserQuestion` with options like "Yes, that matches" / "Not quite — let me clarify"
5. If the user says "not quite", ask a follow-up clarifying question and revise the hypothesis

If investigation is inconclusive, note that and proceed with the user's description alone.

### Step 4: Interview the User (MODIFIED)

The existing Step 2 (Interview) becomes Step 4. The adaptive interview topics are restructured into two explicit branches:

**Enhancement questions** (skip any already answered via argument or investigation):
1. Who benefits from this? (persona/role)
2. What's the current pain point or gap?
3. What's the desired outcome?
4. What are the key acceptance criteria? (Given/When/Then)
5. What's in scope vs out of scope?
6. What's the priority? (MoSCoW)

**Bug questions** (skip any already answered):
1. What are the exact reproduction steps?
2. What's expected vs actual behavior?
3. What environment does this occur in?
4. How often does it happen?
5. Any error messages or stack traces?
6. When did this start? Recent changes?

This replaces the current "adapt questions based on the type of work" guidance with explicit type-specific question lists.

### Step 5: Synthesize into Issue Body (MODIFIED)

Both templates gain a new section. The section placement is between "## Background" and "## Acceptance Criteria".

#### Enhancement Template Addition

```markdown
## Current State

[Summary from Step 3 investigation — what exists today, relevant code patterns,
existing specs, and how the current implementation works. If no relevant code
was found, state that this is a greenfield addition.]
```

#### Bug Report Template Addition

```markdown
## Root Cause Analysis

[Hypothesis from Step 3 investigation — affected code paths, the incorrect
assumption or logic, and triggering conditions. If investigation was
inconclusive, state what is known and what needs further investigation.]

**User Confirmed**: Yes / Partially / Investigation inconclusive
```

### Steps 6–8: Unchanged

Steps 6 (Review), 7 (Create Issue), and 8 (Output) are unchanged. The review step naturally covers the new sections since the user sees the full draft.

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Infer type from argument** | Use LLM judgment to auto-classify from the user's description | No extra question | Unreliable for ambiguous descriptions; removes user agency | Rejected — classification should be explicit |
| **B: Three-option classification** | Separate "Feature" and "Enhancement" options | Finer granularity | Issue already groups feature/enhancement; bug vs non-bug is the meaningful distinction for investigation | Rejected — two options is cleaner |
| **C: Use Task/Explore subagent for investigation** | Delegate codebase exploration to a subagent | Deeper exploration, protects main context | Slower, heavier; investigation scope is bounded enough for direct Glob/Grep/Read | Rejected — direct tool use is sufficient |
| **D: Explicit question per step** | Ask classification via `AskUserQuestion` | Clear, explicit, user chooses | **Selected** — aligns with human-in-loop principle |

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
| Skill definition | BDD (Gherkin) | All 7 acceptance criteria become scenarios |
| Skill behavior | Manual testing | Install plugin locally, run `/creating-issues` for both bug and enhancement paths |
| Auto-mode | Manual testing | Verify auto-mode behavior unchanged with `.claude/auto-mode` present |

Since nmg-plugins is a template/plugin repository (not a runtime application), verification is done through the `/verifying-specs` skill and manual testing via `/installing-locally`.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Investigation adds excessive latency to issue creation | Medium | Low | Scope investigation to targeted Glob/Grep (not exhaustive scans); set expectation in skill text |
| Bug investigation hypothesis is wrong | Medium | Low | Always confirm with user before including; clearly label as hypothesis |
| Auto-mode regression | Low | High | Auto-mode section explicitly skips new steps; test both paths |
| Existing issue creation quality regresses | Low | Medium | Steps 6–8 unchanged; only new content is additive (new sections) |

---

## Open Questions

- None — all design decisions resolved.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #21 | 2026-02-15 | Initial feature spec |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Architecture follows existing project patterns (per `structure.md`) — single SKILL.md modification, no new files
- [x] All interface changes documented — new workflow steps and template sections fully specified
- [x] No database/storage changes
- [x] No state management changes
- [x] No UI component changes
- [x] Security considerations — N/A (no new auth, no new data exposure)
- [x] Performance impact analyzed — investigation adds Glob/Grep calls, bounded by targeted search
- [x] Testing strategy defined — BDD scenarios + manual testing
- [x] Alternatives considered and documented
- [x] Risks identified with mitigations
