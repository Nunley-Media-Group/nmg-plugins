# Tasks: Spec Retrospective Skill

**Issue**: #1
**Date**: 2026-02-15
**Status**: Planning
**Author**: Claude

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 2 | [ ] |
| Backend | 2 | [ ] |
| Frontend | 0 | N/A |
| Integration | 2 | [ ] |
| Testing | 1 | [ ] |
| **Total** | **7** | |

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

### T001: Create retrospective template

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/templates/retrospective.md`
**Type**: Create
**Depends**: None
**Acceptance**:
- [ ] Template file exists at the correct path
- [ ] Contains three sections: Missing Acceptance Criteria, Undertested Boundaries, Domain-Specific Gaps
- [ ] Each section has a table with columns: Learning, Source Defect, Related Feature Spec, Recommendation
- [ ] Includes metadata header (Last Updated, Defect Specs Analyzed, Learnings Generated)
- [ ] Includes "How to Use This Document" section explaining the writing-specs integration

**Notes**: This is the output template that the SKILL.md workflow will use when generating `retrospective.md`. Follow the format designed in design.md.

### T002: Create running-retrospectives SKILL.md

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [ ] YAML front matter includes name, description, allowed-tools
- [ ] `name: running-retrospectives` matches directory name
- [ ] `allowed-tools` includes Read, Glob, Grep, Write, Edit, Bash(gh:*)
- [ ] Includes "When to Use" section
- [ ] Includes "Automation Mode" section (checks `.claude/auto-mode`)
- [ ] Includes numbered workflow steps matching design.md data flow
- [ ] Step 1: Scan for defect specs via Glob + Grep for `Severity:` field
- [ ] Step 2: Filter to specs with `Related Spec:` field
- [ ] Step 3: Read each defect spec + linked feature spec
- [ ] Step 4: Analyze gaps and classify into 3 pattern types
- [ ] Step 5: Read existing `retrospective.md` if present
- [ ] Step 6: Write/update `.claude/steering/retrospective.md` using template
- [ ] Step 7: Output summary
- [ ] Includes learning filtering criteria (exclude implementation bugs, tooling, infra, process)
- [ ] Includes pattern type definitions with examples
- [ ] Includes graceful handling for zero eligible defect specs
- [ ] Includes "Integration with SDLC Workflow" section

**Notes**: This is the core deliverable. The skill is entirely prompt-based — Claude follows the instructions to perform analysis and generate the output. Ensure the workflow is detailed enough that Claude consistently produces correct output.

---

## Phase 2: Backend Implementation

*Note: This project is a plugin/template repository — "backend" here means the skill logic and template content, not server-side code.*

### T003: Define defect spec detection logic in SKILL.md

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify (refine T002 content)
**Depends**: T002
**Acceptance**:
- [ ] SKILL.md includes explicit Glob pattern: `.claude/specs/*/requirements.md`
- [ ] SKILL.md includes Grep pattern for `Severity:` to identify defect specs
- [ ] SKILL.md includes Read instructions to extract `Related Spec:` field value
- [ ] SKILL.md describes how to handle missing Related Spec (skip with note)
- [ ] SKILL.md describes how to handle broken Related Spec links (warn, skip)
- [ ] Detection logic is testable against the existing spec directory structure

**Notes**: This task refines the SKILL.md from T002 with the precise detection algorithm. In practice, T002 and T003 will be completed together — T003 exists to ensure detection logic gets explicit attention.

### T004: Define incremental update logic in SKILL.md

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify (refine T002 content)
**Depends**: T002
**Acceptance**:
- [ ] SKILL.md describes reading existing `retrospective.md` before writing
- [ ] Instructions cover: add new learnings from new defect specs
- [ ] Instructions cover: preserve still-relevant existing learnings
- [ ] Instructions cover: remove learnings whose source defect specs no longer exist
- [ ] Full re-analysis approach documented (not append-only)

**Notes**: The incremental update logic is the most nuanced part of the skill. Each run does a full re-analysis of all eligible defect specs, then compares against the existing document to produce a clean update. This prevents stale learnings from accumulating.

---

## Phase 3: Frontend Implementation

*N/A — this is a CLI skill with no UI components.*

---

## Phase 4: Integration

### T005: Modify writing-specs SKILL.md to read retrospective

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [ ] Phase 1 Process includes new step after reading `product.md`
- [ ] New step is conditional: "If `.claude/steering/retrospective.md` exists, read it"
- [ ] Instructions describe how to apply retrospective learnings to AC drafting
- [ ] Retrospective doc is listed in the Steering Documents table
- [ ] Existing step numbers are renumbered correctly
- [ ] Feature and Defect paths both benefit from retrospective (not feature-only)

**Notes**: Minimal change — add one conditional read step and update the steering docs table. Do not change the template structure or existing workflow logic.

### T006: Register skill in plugin manifest and update README

**File(s)**: `plugins/nmg-sdlc/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `README.md`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [ ] No registration needed — Claude Code auto-discovers skills in the `skills/` directory via `plugin.json`'s existing structure
- [ ] Verify that the skill directory is at `plugins/nmg-sdlc/skills/running-retrospectives/` (correct path for auto-discovery)
- [ ] Bump plugin version in both `plugin.json` and `marketplace.json`
- [ ] Update CHANGELOG.md with new entries under `[Unreleased]`
- [ ] Add `/running-retrospectives` to the SDLC Skills Reference table in `README.md`

**Notes**: The nmg-sdlc plugin already declares its skills directory. New skills are auto-discovered when placed in `plugins/nmg-sdlc/skills/{name}/SKILL.md`. The main action here is version bumping, changelog updates, and adding the new skill to the README skills reference.

---

## Phase 5: BDD Testing (Required)

### T007: Create BDD feature file

**File(s)**: `.claude/specs/1-spec-retrospective-skill/feature.gherkin`
**Type**: Create
**Depends**: T002, T005
**Acceptance**:
- [ ] All 5 acceptance criteria from requirements.md have corresponding scenarios
- [ ] Uses Given/When/Then format
- [ ] Includes happy path (AC1), integration (AC2), empty state (AC3), filtering (AC4), incremental update (AC5)
- [ ] Includes error handling scenarios (broken Related Spec link, sparse defect spec)
- [ ] Feature file is valid Gherkin syntax
- [ ] Scenarios are independent and self-contained

---

## Dependency Graph

```
T001 ──▶ T002 ──┬──▶ T003
                │
                ├──▶ T004
                │
                ├──▶ T005
                │
                ├──▶ T006
                │
                └──▶ T007
```

*T002 is the central dependency — the SKILL.md must exist before refinement (T003, T004), integration (T005, T006), or testing (T007) can proceed. T003 and T004 refine T002 in-place. T005, T006, and T007 are independent of each other.*

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test tasks are included (T007)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
