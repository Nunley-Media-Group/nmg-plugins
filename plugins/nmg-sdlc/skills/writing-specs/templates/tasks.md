# Tasks Template

Use this template to create implementation tasks in the **TASKS** phase.

Reference `.claude/steering/structure.md` to map task file paths to the project's actual directory layout.

---

```markdown
# Tasks: [Feature Name]

**Issues**: #[number]
**Date**: [YYYY-MM-DD]
**Status**: Planning | In Progress | Complete
**Author**: [name]

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | [count] | [ ] |
| Backend | [count] | [ ] |
| Frontend | [count] | [ ] |
| Integration | [count] | [ ] |
| Testing | [count] | [ ] |
| **Total** | [total] | |

---

## Task Format

Each task follows this structure:

```
### T[NNN]: [Task Title]

**File(s)**: `{layer}/path/to/file`
**Type**: Create | Modify | Delete
**Depends**: T[NNN], T[NNN] (or None)
**Acceptance**:
- [ ] [Verifiable criterion 1]
- [ ] [Verifiable criterion 2]

**Notes**: [Optional implementation hints]
```

Map `{layer}/` placeholders to actual project paths using `structure.md`.

---

## Phase 1: Setup

### T001: [Database migration / Schema setup]

**File(s)**: `{data-layer}/migrations/...` or `{data-layer}/schema/...`
**Type**: Create
**Depends**: None
**Acceptance**:
- [ ] Migration runs without errors
- [ ] Schema changes match design spec
- [ ] Rollback works cleanly

### T002: [Type definitions / Interfaces]

**File(s)**: `{data-layer}/types/...` or `{data-layer}/models/...`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Types/interfaces compile without errors
- [ ] Types match database/API schema
- [ ] Types exported from appropriate index

---

## Phase 2: Backend Implementation

### T003: [Data access layer]

**File(s)**: `{data-layer}/repositories/...` or `{data-layer}/data/...`
**Type**: Create
**Depends**: T001, T002
**Acceptance**:
- [ ] All CRUD operations implemented
- [ ] Uses parameterized queries (SQL injection safe)
- [ ] Error handling for data access failures
- [ ] Unit tests pass

### T004: [Business logic layer]

**File(s)**: `{business-layer}/services/...`
**Type**: Create
**Depends**: T003
**Acceptance**:
- [ ] Business logic implemented per design
- [ ] Input validation
- [ ] Error handling with appropriate error types
- [ ] Unit tests pass

### T005: [Request handler / Controller]

**File(s)**: `{entry-layer}/controllers/...` or `{entry-layer}/handlers/...`
**Type**: Create
**Depends**: T004
**Acceptance**:
- [ ] All endpoints/handlers implemented per API spec
- [ ] Request validation
- [ ] Proper response codes/formats
- [ ] Response format matches spec

### T006: [Route registration / Endpoint wiring]

**File(s)**: `{entry-layer}/routes/...`
**Type**: Create or Modify
**Depends**: T005
**Acceptance**:
- [ ] Routes/endpoints registered with correct paths
- [ ] Auth/middleware applied where needed
- [ ] Endpoints accessible and responding

---

## Phase 3: Frontend Implementation

### T007: [Client-side model]

**File(s)**: `{presentation-layer}/models/...`
**Type**: Create
**Depends**: T002
**Acceptance**:
- [ ] Model matches API response schema
- [ ] Serialization/deserialization works
- [ ] Immutable with update method (if applicable)
- [ ] Unit tests for serialization

### T008: [Client-side service / API client]

**File(s)**: `{presentation-layer}/services/...`
**Type**: Create
**Depends**: T007
**Acceptance**:
- [ ] All API calls implemented
- [ ] Error handling with typed exceptions
- [ ] Uses project's HTTP client pattern
- [ ] Unit tests pass

### T009: [State management]

**File(s)**: `{presentation-layer}/state/...` or `{presentation-layer}/providers/...`
**Type**: Create
**Depends**: T008
**Acceptance**:
- [ ] State class defined (immutable if applicable)
- [ ] Loading/error states handled
- [ ] State transitions match design spec
- [ ] Unit tests for state transitions

### T010: [UI components]

**File(s)**: `{presentation-layer}/components/...` or `{presentation-layer}/widgets/...`
**Type**: Create
**Depends**: T009
**Acceptance**:
- [ ] Components match design specs
- [ ] Uses project's design tokens (no hardcoded values)
- [ ] Loading/error/empty states
- [ ] Component tests pass

### T011: [Screen / Page]

**File(s)**: `{presentation-layer}/screens/...` or `{presentation-layer}/pages/...`
**Type**: Create
**Depends**: T010
**Acceptance**:
- [ ] Screen layout matches design
- [ ] State management integration working
- [ ] Navigation implemented

---

## Phase 4: Integration

### T012: [Navigation / Routing]

**File(s)**: `{presentation-layer}/config/routes...`
**Type**: Modify
**Depends**: T011
**Acceptance**:
- [ ] Route registered
- [ ] Navigation from other screens works
- [ ] Deep linking configured (if applicable)

### T013: [State registration / DI wiring]

**File(s)**: `{presentation-layer}/main...` or `{presentation-layer}/app...`
**Type**: Modify
**Depends**: T009
**Acceptance**:
- [ ] State/provider registered
- [ ] Accessible throughout app
- [ ] No circular dependencies

### T014: [Cross-feature integration]

**File(s)**: [varies]
**Type**: Modify
**Depends**: T012, T013
**Acceptance**:
- [ ] Entry points from existing features
- [ ] Data flows correctly between features
- [ ] No regressions in existing features

---

## Phase 5: BDD Testing (Required)

**Every acceptance criterion MUST have a Gherkin test.**

Reference `tech.md` for BDD framework and file locations.

### T015: [Create BDD feature file]

**File(s)**: `{test-layer}/features/[feature].feature`
**Type**: Create
**Depends**: T006, T011
**Acceptance**:
- [ ] All acceptance criteria from requirements.md are scenarios
- [ ] Uses Given/When/Then format
- [ ] Includes error handling scenarios
- [ ] Feature file is valid Gherkin syntax

### T016: [Implement step definitions]

**File(s)**: `{test-layer}/steps/[feature]...`
**Type**: Create
**Depends**: T015
**Acceptance**:
- [ ] All scenarios have step definitions
- [ ] Steps use project's BDD framework patterns (per tech.md)
- [ ] Tests pass

### T017: [Unit tests (supplementary)]

**File(s)**: `{test-layer}/unit/...`
**Type**: Create
**Depends**: T003, T009
**Acceptance**:
- [ ] Service/business logic unit tested
- [ ] Model serialization tested
- [ ] Edge cases covered

---

## Dependency Graph

```
T001 ──┬──▶ T002 ──┬──▶ T003 ──▶ T004 ──▶ T005 ──▶ T006
       │           │
       │           └──▶ T007 ──▶ T008 ──▶ T009 ──▶ T010 ──▶ T011
       │                                    │
       │                                    └──▶ T012, T013 ──▶ T014
       │
       └──▶ T015 ──▶ T016, T017
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #[number] | [YYYY-MM-DD] | Initial feature spec |

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [ ] Each task has single responsibility
- [ ] Dependencies are correctly mapped
- [ ] Tasks can be completed independently (given dependencies)
- [ ] Acceptance criteria are verifiable
- [ ] File paths reference actual project structure (per `structure.md`)
- [ ] Test tasks are included for each layer
- [ ] No circular dependencies
- [ ] Tasks are in logical execution order
```

---

# Defect Tasks Variant

**Use this variant when the GitHub issue has the `bug` label.** It replaces the phased feature task breakdown above with a flat 2–4 task list focused on fix, test, and verify. Omit the 5-phase structure, dependency graph, and 17-task breakdown.

---

```markdown
# Tasks: [Bug Summary]

**Issue**: #[number]
**Date**: [YYYY-MM-DD]
**Status**: Planning | In Progress | Complete
**Author**: [name]

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| T001 | Fix the defect | [ ] |
| T002 | Add regression test | [ ] |
| T003 | Verify no regressions | [ ] |

---

### T001: Fix the Defect

**File(s)**: `path/to/affected/file(s)`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Bug no longer reproduces using the steps from requirements.md
- [ ] Root cause from design.md is addressed (not just symptoms)
- [ ] No unrelated changes included in the diff

**Notes**: Follow the fix strategy from design.md. Keep changes minimal.

### T002: Add Regression Test

**File(s)**: `{test-layer}/features/[feature-name].feature`, `{test-layer}/steps/...`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] Gherkin scenario reproduces the original bug condition
- [ ] Scenario tagged `@regression`
- [ ] Step definitions implemented
- [ ] Test passes with the fix applied
- [ ] Test fails if the fix is reverted (confirms it catches the bug)

### T003: Verify No Regressions

**File(s)**: [existing test files]
**Type**: Verify (no file changes)
**Depends**: T001, T002
**Acceptance**:
- [ ] All existing tests pass
- [ ] No side effects in related code paths (per blast radius from design.md)

### T004: [Additional Fix Task — if needed]

*Include only if the fix spans multiple files or requires a separate preparatory change. Most defects need only T001–T003.*

**File(s)**: `path/to/file`
**Type**: Modify
**Depends**: [dependency]
**Acceptance**:
- [ ] [Specific criterion]

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [ ] Tasks are focused on the fix — no feature work
- [ ] Regression test is included (T002)
- [ ] Each task has verifiable acceptance criteria
- [ ] No scope creep beyond the defect
- [ ] File paths reference actual project structure (per `structure.md`)
```
