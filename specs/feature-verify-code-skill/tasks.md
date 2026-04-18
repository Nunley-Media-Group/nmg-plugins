# Tasks: Verifying Specs Skill

**Issues**: #7, #109
**Date**: 2026-03-03
**Status**: In Progress
**Author**: Claude Code (retroactive)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | [x] |
| Plugin Files | 2 | [x] |
| Templates/Content | 6 | [x] |
| Integration | 1 | [x] |
| Testing | 1 | [x] |
| Verification Gates (#109) | 7 | [x] |
| **Total** | **18** | |

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

### T001: Create Skill Directory Structure

**File(s)**: `plugins/nmg-sdlc/skills/verify-code/`, `plugins/nmg-sdlc/skills/verify-code/checklists/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Skill directory exists
- [x] Checklists subdirectory exists

---

## Phase 2: Plugin Files

### T002: Create Skill Definition

**File(s)**: `plugins/nmg-sdlc/skills/verify-code/SKILL.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] 9-step workflow documented
- [x] Auto-fix rules documented (fix <20 lines, defer larger)
- [x] Bug fix verification documented
- [x] Automation mode support documented

### T003: Create Architecture Reviewer Agent

**File(s)**: `plugins/nmg-sdlc/agents/architecture-reviewer.md`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Agent frontmatter with name, description, tools (Read, Glob, Grep)
- [x] Review process documented (map architecture, trace deps, evaluate checklists)
- [x] Output format documented (category scores, issues, observations)

---

## Phase 3: Templates/Content

### T004: Create SOLID Principles Checklist

**File(s)**: `plugins/nmg-sdlc/skills/verify-code/checklists/solid-principles.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] All 5 SOLID principles covered with evaluation criteria

### T005: Create Security Checklist

**File(s)**: `plugins/nmg-sdlc/skills/verify-code/checklists/security.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] OWASP-aligned security review criteria

### T006: Create Performance Checklist

**File(s)**: `plugins/nmg-sdlc/skills/verify-code/checklists/performance.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Performance patterns and anti-patterns documented

### T007: Create Testability Checklist

**File(s)**: `plugins/nmg-sdlc/skills/verify-code/checklists/testability.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] DI patterns, mock support, test isolation criteria

### T008: Create Error Handling Checklist

**File(s)**: `plugins/nmg-sdlc/skills/verify-code/checklists/error-handling.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Error hierarchy, propagation, and recovery patterns

### T009: Create Report Template

**File(s)**: `plugins/nmg-sdlc/skills/verify-code/checklists/report-template.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] Executive summary with scores
- [x] AC verification table
- [x] Task completion table
- [x] Fixes Applied and Remaining Issues sections

---

## Phase 4: Integration

### T010: Wire Agent to Skill

**File(s)**: `plugins/nmg-sdlc/skills/verify-code/SKILL.md`, `plugins/nmg-sdlc/agents/architecture-reviewer.md`
**Type**: Modify
**Depends**: T002, T003
**Status**: Complete
**Acceptance**:
- [x] Skill references architecture-reviewer via Task tool with correct subagent_type
- [x] Agent's skills field references verify-code

---

## Phase 5: Testing

### T011: Create BDD Feature File

**File(s)**: `specs/7-verify-code-skill/feature.gherkin`
**Type**: Create
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] All 5 acceptance criteria have corresponding scenarios

---

## Phase 6: Verification Gates (Issue #109)

### T012: Add Verification Gates Section to tech.md Template

**File(s)**: `plugins/nmg-sdlc/skills/setup-steering/templates/tech.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] `## Verification Gates` section exists in the template after `## Testing Standards`
- [x] Contains a table with columns: Gate, Condition, Action, Pass Criteria
- [x] Contains TODO comment instructing users to define project-specific gates
- [x] Contains example rows showing different condition patterns (`Always`, directory exists, files exist)
- [x] Contains documentation of condition evaluation rules and pass criteria evaluation rules

**Notes**: This section becomes the convention that verify-code reads. Place it after Testing Standards and before Environment Variables.

### T013: Add Gate Extraction to verify-code Step 1

**File(s)**: `plugins/nmg-sdlc/skills/verify-code/SKILL.md`
**Type**: Modify
**Depends**: T012
**Status**: Complete
**Acceptance**:
- [x] Step 1 includes instruction to check if `tech.md` contains a `## Verification Gates` section
- [x] If present, each table row is extracted as a named gate with: name, condition, action, pass criteria
- [x] If absent, no gates are enforced (backward-compatible — explicitly stated)
- [x] Extracted gates are noted as mandatory steps to be executed during Step 5

**Notes**: Gate extraction is a parsing step — read the markdown table rows from the section. The skill does not execute gates here, only extracts them.

### T014: Add Gate Execution Sub-Step 5f to verify-code Step 5

**File(s)**: `plugins/nmg-sdlc/skills/verify-code/SKILL.md`
**Type**: Modify
**Depends**: T013
**Status**: Complete
**Acceptance**:
- [x] Sub-step 5f exists after existing BDD/exercise verification
- [x] For each extracted gate: evaluates condition, executes action (if applicable), evaluates pass criteria
- [x] Condition evaluation supports: `Always`, `{path} directory exists`, `{glob} files exist in {path}`
- [x] Non-applicable gates are skipped (not reported as Incomplete)
- [x] Applicable but unexecutable gates (tool not found, timeout) are recorded as Incomplete with reason
- [x] Gate action is executed via Bash with exit code, stdout, and stderr captured
- [x] Pass criteria evaluation supports: exit code checks, artifact file existence, compound AND criteria
- [x] Each gate result is recorded: gate name, status (Pass/Fail/Incomplete), evidence

**Notes**: The skill evaluates textual pass criteria against actual results — it does NOT contain stack-specific logic. Pass criteria strings are interpreted at runtime.

### T015: Add Gate Status Aggregation to verify-code Steps 7/8/9

**File(s)**: `plugins/nmg-sdlc/skills/verify-code/SKILL.md`
**Type**: Modify
**Depends**: T014
**Status**: Complete
**Acceptance**:
- [x] Step 7 (report generation) includes "Steering Doc Verification Gates" section when gates were extracted
- [x] Step 8 (GitHub issue comment) includes gate results in the verification summary
- [x] Step 9 (output) includes gate result summary
- [x] Overall status logic: any gate Fail → status cannot exceed "Partial"; any gate Incomplete → status cannot exceed "Incomplete"
- [x] "Pass" status requires all applicable gates to pass (or no gates defined)
- [x] Status hierarchy documented: Pass > Partial > Incomplete

**Notes**: The status aggregation interacts with existing status logic from AC verification and architecture review. Gate results act as a ceiling on the overall status — they can lower it but never raise it.

### T016: Add Steering Doc Verification Gates Section to Report Template

**File(s)**: `plugins/nmg-sdlc/skills/verify-code/checklists/report-template.md`
**Type**: Modify
**Depends**: T014
**Status**: Complete
**Acceptance**:
- [x] "Steering Doc Verification Gates" section exists between "Exercise Test Results" and "Fixes Applied"
- [x] Contains table with columns: Gate, Status, Evidence
- [x] Contains gate summary line: X/Y passed, Z failed, W incomplete
- [x] Contains conditional note: "Omit entirely if tech.md has no `## Verification Gates` section"

### T017: Document Verification Gates Convention in README.md

**File(s)**: `README.md`
**Type**: Modify
**Depends**: T012
**Status**: Complete
**Acceptance**:
- [x] README documents the `## Verification Gates` section format for tech.md
- [x] Includes an example gate table with diverse condition/action patterns
- [x] Explains how gates are enforced during `/verify-code`
- [x] Explains the Pass/Fail/Incomplete status semantics
- [x] Mentions that existing projects can add the section via `/migrate-project`

### T018: Add BDD Scenarios for Verification Gates

**File(s)**: `specs/feature-verify-code-skill/feature.gherkin`
**Type**: Modify
**Depends**: T014
**Status**: Complete
**Acceptance**:
- [x] Scenarios exist for AC6 through AC13 (8 new scenarios)
- [x] Scenarios tagged with `# Added by issue #109` comment
- [x] Scenarios cover: gate definition format, extraction, enforcement, Incomplete status, report section, Pass prevention, stack-agnostic, migration

---

## Dependency Graph

```
Phase 1-5 (Issue #7 — Complete):
T001 ──┬──▶ T002 ──┬──▶ T003 ──▶ T004 ──▶ T005 ──▶ T006
       │           │
       │           └──▶ T007 ──▶ T008 ──▶ T009 ──▶ T010 ──▶ T011

Phase 6 (Issue #109 — Verification Gates):
T012 ──┬──▶ T013 ──▶ T014 ──┬──▶ T015
       │                     │
       │                     ├──▶ T016
       │                     │
       │                     └──▶ T018
       │
       └──▶ T017
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #7 | 2026-02-15 | Initial feature spec |
| #109 | 2026-03-03 | Add T012–T018: verification gates in tech.md template, gate extraction/execution/status in SKILL.md, report template section, README docs, BDD scenarios |

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure
