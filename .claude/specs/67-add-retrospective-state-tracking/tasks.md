# Tasks: Retrospective State Tracking and Deduplication

**Issue**: #67
**Date**: 2026-02-22
**Status**: Planning
**Author**: Claude

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | [ ] |
| Backend | 6 | [ ] |
| Frontend | 0 (N/A) | - |
| Integration | 1 | [ ] |
| Testing | 1 | [ ] |
| **Total** | **9** | |

---

## Phase 1: Setup

### T001: Add Step 1.5 — Load State File and Compute Content Hashes

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] New "Step 1.5: Load State and Compute Hashes" section inserted after existing Step 1
- [ ] Instructions specify reading `.claude/steering/retrospective-state.json` if it exists
- [ ] Instructions specify handling malformed JSON (warn + treat as absent)
- [ ] Instructions specify handling unrecognized `version` field (warn + treat as absent)
- [ ] Instructions specify computing SHA-256 hash for each defect spec found in Step 1 using `shasum -a 256` with `sha256sum` fallback
- [ ] Instructions specify partitioning specs into four categories: new (not in state), modified (hash differs), unchanged (hash matches), deleted (in state but not on disk)
- [ ] Instructions specify reporting partition counts to the user

**Notes**: This is the foundational step — all subsequent modifications depend on the partition results. Define the state file schema inline (version, specs map with hash and lastAnalyzed fields).

---

## Phase 2: Backend Implementation

### T002: Modify Step 2 — Filter Only New and Modified Specs

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] Step 2 instructions clarified to apply eligibility filtering and chain resolution only to new and modified specs
- [ ] Unchanged specs are noted as already known-eligible (analyzed in a previous run)
- [ ] Deleted specs are noted as removed from consideration

**Notes**: The existing Step 2 logic (filter eligible, resolve Related Spec chains) is unchanged — it just operates on a smaller input set.

### T003: Modify Step 3 — Analyze Only New and Modified Specs

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [ ] Step 3 instructions clarified to analyze only new and modified eligible specs
- [ ] Unchanged specs are explicitly noted as skipped (their learnings carried forward in Step 7)
- [ ] Progress feedback indicates which specs are being analyzed vs. skipped

### T004: Modify Step 7 — Extract Carried-Forward Learnings

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] Step 7 instructions include carry-forward extraction logic
- [ ] Instructions specify parsing the three pattern-type tables in existing `retrospective.md`
- [ ] Instructions specify extracting evidence spec paths from each learning row's "Evidence (defect specs)" column
- [ ] A learning is carried forward if ALL its evidence spec paths are in the "unchanged" set
- [ ] A learning is NOT carried forward if ANY evidence spec is new, modified, or deleted
- [ ] Carried-forward learnings are passed to Step 4 alongside freshly analyzed learnings

**Notes**: This is the key change to Step 7. The existing "incremental update strategy" (full re-analysis) is replaced with selective carry-forward. The step still reads the existing `retrospective.md` but now extracts specific learning rows rather than discarding the entire document.

### T005: Modify Step 4 — Aggregate Combined Learnings Set

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: T003, T004
**Acceptance**:
- [ ] Step 4 instructions clarified that input is freshly analyzed learnings (from new/modified specs) + carried-forward learnings (from unchanged specs)
- [ ] Deduplication/merging logic applies across the combined set
- [ ] A carried-forward learning may be merged with a fresh learning if they share a root pattern type

### T006: Add Step 8.5 — Write State File

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] New "Step 8.5: Write State File" section inserted after existing Step 8
- [ ] Instructions specify building the state object: new/modified specs get computed hash + today's date; unchanged specs preserve existing hash + lastAnalyzed date; deleted specs are omitted
- [ ] Instructions specify setting `version` to `1`
- [ ] Instructions specify writing `.claude/steering/retrospective-state.json` as formatted JSON (2-space indent)
- [ ] Instructions specify using the Write tool (not Bash echo/cat)

### T007: Modify Step 9 — Updated Output Summary

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: T005, T006
**Acceptance**:
- [ ] Step 9 summary includes spec partition breakdown: total, new, modified, skipped (unchanged), removed (deleted)
- [ ] Step 9 summary includes learning source breakdown: new vs. carried forward
- [ ] Step 9 mentions state file output path (`.claude/steering/retrospective-state.json`)
- [ ] Auto-mode variant of summary is also updated

---

## Phase 3: Frontend Implementation

*N/A — This project is a Claude Code plugin with no frontend.*

---

## Phase 4: Integration

### T008: Update Graceful Handling Table

**File(s)**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md`
**Type**: Modify
**Depends**: T001, T006
**Acceptance**:
- [ ] Graceful Handling table includes entry for "State file missing" → first run behavior (full analysis)
- [ ] Graceful Handling table includes entry for "State file malformed JSON" → warn + full re-analysis
- [ ] Graceful Handling table includes entry for "State file unrecognized version" → warn + full re-analysis
- [ ] Graceful Handling table includes entry for "Deleted spec in state file" → remove entry, remove sole-source learnings
- [ ] Existing graceful handling entries preserved

---

## Phase 5: BDD Testing (Required)

### T009: Create BDD Feature File

**File(s)**: `.claude/specs/67-add-retrospective-state-tracking/feature.gherkin`
**Type**: Create
**Depends**: T001–T008
**Acceptance**:
- [ ] All 10 acceptance criteria from requirements.md have corresponding scenarios
- [ ] Uses Given/When/Then format
- [ ] Includes error handling scenarios (malformed state file)
- [ ] Includes edge cases (deleted specs, first run)
- [ ] Feature file is valid Gherkin syntax
- [ ] Scenarios are independent and self-contained

---

## Dependency Graph

```
T001 (Load state + hash)
  ├──▶ T002 (Filter new/modified) ──▶ T003 (Analyze new/modified)
  │                                          │
  ├──▶ T004 (Carry-forward extraction)       │
  │         │                                │
  │         └──────────────┬─────────────────┘
  │                        ▼
  │                  T005 (Aggregate combined)
  │                        │
  ├──▶ T006 (Write state)  │
  │         │              │
  │         └──────┬───────┘
  │                ▼
  ├──▶ T007 (Updated summary)
  │
  └──▶ T008 (Graceful handling)

T001–T008 ──▶ T009 (BDD feature file)
```

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test tasks are included (T009)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
