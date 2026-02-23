# Tasks: Spec Retrospective Skill

**Issues**: #1, #67
**Date**: 2026-02-15
**Status**: Complete
**Author**: Claude

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 3 | [x] |
| Backend | 8 | [x] |
| Frontend | 0 | N/A |
| Integration | 3 | [x] |
| Testing | 2 | [x] |
| **Total** | **16** | |

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
- [x] Template file exists at the correct path
- [x] Contains three sections: Missing Acceptance Criteria, Undertested Boundaries, Domain-Specific Gaps
- [x] Each section has a table with columns: Learning, Source Defect, Related Feature Spec, Recommendation
- [x] Includes metadata header (Last Updated, Defect Specs Analyzed, Learnings Generated)
- [x] Includes "How to Use This Document" section explaining the writing-specs integration

**Notes**: This is the output template that the SKILL.md workflow will use when generating `retrospective.md`. Follow the format designed in design.md.

### T002: Create running-retrospectives SKILL.md

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Create
**Depends**: T001
**Acceptance**:
- [x] YAML front matter includes name, description, allowed-tools
- [x] `name: running-retrospectives` matches directory name
- [x] `allowed-tools` includes Read, Glob, Grep, Write, Edit, Bash(gh:*)
- [x] Includes "When to Use" section
- [x] Includes "Automation Mode" section (checks `.claude/auto-mode`)
- [x] Includes numbered workflow steps matching design.md data flow
- [x] Step 1: Scan for defect specs via Glob + Grep for `Severity:` field
- [x] Step 2: Filter to specs with `Related Spec:` field
- [x] Step 3: Read each defect spec + linked feature spec
- [x] Step 4: Analyze gaps and classify into 3 pattern types
- [x] Step 5: Read existing `retrospective.md` if present
- [x] Step 6: Write/update `.claude/steering/retrospective.md` using template
- [x] Step 7: Output summary
- [x] Includes learning filtering criteria (exclude implementation bugs, tooling, infra, process)
- [x] Includes pattern type definitions with examples
- [x] Includes graceful handling for zero eligible defect specs
- [x] Includes "Integration with SDLC Workflow" section

**Notes**: This is the core deliverable. The skill is entirely prompt-based — Claude follows the instructions to perform analysis and generate the output. Ensure the workflow is detailed enough that Claude consistently produces correct output.

### T003: Define defect spec detection logic in SKILL.md

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify (refine T002 content)
**Depends**: T002
**Acceptance**:
- [x] SKILL.md includes explicit Glob pattern: `.claude/specs/*/requirements.md`
- [x] SKILL.md includes Grep pattern for `Severity:` to identify defect specs
- [x] SKILL.md includes Read instructions to extract `Related Spec:` field value
- [x] SKILL.md describes how to handle missing Related Spec (skip with note)
- [x] SKILL.md describes how to handle broken Related Spec links (warn, skip)
- [x] Detection logic is testable against the existing spec directory structure

**Notes**: This task refines the SKILL.md from T002 with the precise detection algorithm. In practice, T002 and T003 will be completed together — T003 exists to ensure detection logic gets explicit attention.

---

## Phase 2: Backend Implementation

*Note: This project is a plugin/template repository — "backend" here means the skill logic and template content, not server-side code.*

### T004: Define incremental update logic in SKILL.md

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify (refine T002 content)
**Depends**: T002
**Acceptance**:
- [x] SKILL.md describes reading existing `retrospective.md` before writing
- [x] Instructions cover: add new learnings from new defect specs
- [x] Instructions cover: preserve still-relevant existing learnings
- [x] Instructions cover: remove learnings whose source defect specs no longer exist
- [x] Full re-analysis approach documented (not append-only)

**Notes**: The incremental update logic is the most nuanced part of the skill. Each run does a full re-analysis of all eligible defect specs, then compares against the existing document to produce a clean update. This prevents stale learnings from accumulating.

### T005: Add Step 1.5 — Load State File and Compute Content Hashes

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [x] New "Step 1.5: Load State and Compute Hashes" section inserted after existing Step 1
- [x] Instructions specify reading `.claude/steering/retrospective-state.json` if it exists
- [x] Instructions specify handling malformed JSON (warn + treat as absent)
- [x] Instructions specify handling unrecognized `version` field (warn + treat as absent)
- [x] Instructions specify computing SHA-256 hash for each defect spec found in Step 1 using `shasum -a 256` with `sha256sum` fallback
- [x] Instructions specify partitioning specs into four categories: new (not in state), modified (hash differs), unchanged (hash matches), deleted (in state but not on disk)
- [x] Instructions specify reporting partition counts to the user

**Notes**: This is the foundational step for issue #67. All subsequent state-tracking modifications depend on the partition results. Define the state file schema inline (version, specs map with hash and lastAnalyzed fields).

### T006: Modify Step 2 — Filter Only New and Modified Specs

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: T005
**Acceptance**:
- [x] Step 2 instructions clarified to apply eligibility filtering and chain resolution only to new and modified specs
- [x] Unchanged specs are noted as already known-eligible (analyzed in a previous run)
- [x] Deleted specs are noted as removed from consideration

**Notes**: The existing Step 2 logic (filter eligible, resolve Related Spec chains) is unchanged — it just operates on a smaller input set.

### T007: Modify Step 3 — Analyze Only New and Modified Specs

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: T006
**Acceptance**:
- [x] Step 3 instructions clarified to analyze only new and modified eligible specs
- [x] Unchanged specs are explicitly noted as skipped (their learnings carried forward in Step 7)
- [x] Progress feedback indicates which specs are being analyzed vs. skipped

### T008: Modify Step 7 — Extract Carried-Forward Learnings

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: T005
**Acceptance**:
- [x] Step 7 instructions include carry-forward extraction logic
- [x] Instructions specify parsing the three pattern-type tables in existing `retrospective.md`
- [x] Instructions specify extracting evidence spec paths from each learning row's "Evidence (defect specs)" column
- [x] A learning is carried forward if ALL its evidence spec paths are in the "unchanged" set
- [x] A learning is NOT carried forward if ANY evidence spec is new, modified, or deleted
- [x] Carried-forward learnings are passed to Step 4 alongside freshly analyzed learnings

**Notes**: This is the key change to Step 7. The existing "incremental update strategy" (full re-analysis) is replaced with selective carry-forward. The step still reads the existing `retrospective.md` but now extracts specific learning rows rather than discarding the entire document.

### T009: Modify Step 4 — Aggregate Combined Learnings Set

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: T007, T008
**Acceptance**:
- [x] Step 4 instructions clarified that input is freshly analyzed learnings (from new/modified specs) + carried-forward learnings (from unchanged specs)
- [x] Deduplication/merging logic applies across the combined set
- [x] A carried-forward learning may be merged with a fresh learning if they share a root pattern type

### T010: Add Step 8.5 — Write State File

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: T005
**Acceptance**:
- [x] New "Step 8.5: Write State File" section inserted after existing Step 8
- [x] Instructions specify building the state object: new/modified specs get computed hash + today's date; unchanged specs preserve existing hash + lastAnalyzed date; deleted specs are omitted
- [x] Instructions specify setting `version` to `1`
- [x] Instructions specify writing `.claude/steering/retrospective-state.json` as formatted JSON (2-space indent)
- [x] Instructions specify using the Write tool (not Bash echo/cat)

### T011: Modify Step 9 — Updated Output Summary

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: T009, T010
**Acceptance**:
- [x] Step 9 summary includes spec partition breakdown: total, new, modified, skipped (unchanged), removed (deleted)
- [x] Step 9 summary includes learning source breakdown: new vs. carried forward
- [x] Step 9 mentions state file output path (`.claude/steering/retrospective-state.json`)
- [x] Auto-mode variant of summary is also updated

### T012: Update Graceful Handling Table

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: T005, T010
**Acceptance**:
- [x] Graceful Handling table includes entry for "State file missing" → first run behavior (full analysis)
- [x] Graceful Handling table includes entry for "State file malformed JSON" → warn + full re-analysis
- [x] Graceful Handling table includes entry for "State file unrecognized version" → warn + full re-analysis
- [x] Graceful Handling table includes entry for "Deleted spec in state file" → remove entry, remove sole-source learnings
- [x] Existing graceful handling entries preserved

---

## Phase 3: Frontend Implementation

*N/A — this is a CLI skill with no UI components.*

---

## Phase 4: Integration

### T013: Modify writing-specs SKILL.md to read retrospective

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [x] Phase 1 Process includes new step after reading `product.md`
- [x] New step is conditional: "If `.claude/steering/retrospective.md` exists, read it"
- [x] Instructions describe how to apply retrospective learnings to AC drafting
- [x] Retrospective doc is listed in the Steering Documents table
- [x] Existing step numbers are renumbered correctly
- [x] Feature and Defect paths both benefit from retrospective (not feature-only)

**Notes**: Minimal change — add one conditional read step and update the steering docs table. Do not change the template structure or existing workflow logic.

### T014: Register skill in plugin manifest and update README

**File(s)**: `plugins/nmg-sdlc/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `README.md`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [x] No registration needed — Claude Code auto-discovers skills in the `skills/` directory via `plugin.json`'s existing structure
- [x] Verify that the skill directory is at `plugins/nmg-sdlc/skills/running-retrospectives/` (correct path for auto-discovery)
- [x] Bump plugin version in both `plugin.json` and `marketplace.json`
- [x] Update CHANGELOG.md with new entries under `[Unreleased]`
- [x] Add `/running-retrospectives` to the SDLC Skills Reference table in `README.md`

**Notes**: The nmg-sdlc plugin already declares its skills directory. New skills are auto-discovered when placed in `plugins/nmg-sdlc/skills/{name}/SKILL.md`. The main action here is version bumping, changelog updates, and adding the new skill to the README skills reference.

---

## Phase 5: BDD Testing (Required)

### T015: Create BDD feature file for issue #1

**File(s)**: `.claude/specs/feature-retrospective-skill/feature.gherkin`
**Type**: Create
**Depends**: T002, T013
**Acceptance**:
- [x] All 5 base acceptance criteria from issue #1 requirements have corresponding scenarios
- [x] Uses Given/When/Then format
- [x] Includes happy path (AC1), integration (AC2), empty state (AC3), filtering (AC4), incremental update (AC5)
- [x] Includes error handling scenarios (broken Related Spec link, sparse defect spec)
- [x] Feature file is valid Gherkin syntax
- [x] Scenarios are independent and self-contained

### T016: Create BDD feature file for issue #67

**File(s)**: `.claude/specs/feature-retrospective-skill/feature.gherkin`
**Type**: Modify (append)
**Depends**: T005–T012
**Acceptance**:
- [x] All 10 acceptance criteria from issue #67 requirements have corresponding scenarios
- [x] Uses Given/When/Then format
- [x] Includes error handling scenarios (malformed state file)
- [x] Includes edge cases (deleted specs, first run)
- [x] Feature file is valid Gherkin syntax
- [x] Scenarios are independent and self-contained

---

## Dependency Graph

```
T001 ──▶ T002 ──┬──▶ T003
                │
                ├──▶ T004
                │
                ├──▶ T005 ──┬──▶ T006 ──▶ T007 ──┐
                │           │                     │
                │           ├──▶ T008 ────────────┤
                │           │                     ▼
                │           ├──▶ T009 ◀── (T007+T008 outputs)
                │           │         │
                │           ├──▶ T010 ─┤
                │           │         ▼
                │           └──▶ T011 ◀── (T009+T010 outputs)
                │           │
                │           └──▶ T012
                │
                ├──▶ T013
                │
                ├──▶ T014
                │
                └──▶ T015

T001–T014 ──▶ T016
```

---

## Change History

| Date | Issue | Summary |
|------|-------|---------|
| 2026-02-15 | #1 | Initial task list: T001–T007 (setup, backend, integration, testing for base retrospective skill) |
| 2026-02-22 | #67 | Added T008–T016: state tracking, hash computation, carry-forward, graceful handling, updated BDD file tasks; renumbered for sequential ordering |

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test tasks are included (T015, T016)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
- [x] All tasks marked complete (consolidated retrospective spec)
