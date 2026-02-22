# Requirements: Retrospective State Tracking and Deduplication

**Issue**: #67
**Date**: 2026-02-22
**Status**: Draft
**Author**: Claude

---

## User Story

**As a** spec author (human or OpenClaw automation agent)
**I want** the retrospectives skill to track which defect specs it has already analyzed and skip unchanged ones
**So that** retrospective runs are efficient, avoid redundant LLM work, and never produce duplicate learnings

---

## Background

The `/running-retrospectives` skill currently performs a full re-analysis of every defect spec on every invocation. It has no persistent state tracking — no record of which specs were previously analyzed or what content they contained. This causes wasted effort (re-analyzing unchanged specs), potential near-duplicate learnings across incremental runs, and unnecessary LLM token consumption. As OpenClaw automates SDLC cycles and retrospectives run more frequently, these inefficiencies compound. A content-hash-based tracking mechanism would let the skill skip unchanged specs while re-analyzing modified ones to keep learnings accurate.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: State File Created on First Run

**Given** no `.claude/steering/retrospective-state.json` exists
**When** the retrospectives skill completes a run
**Then** a `retrospective-state.json` file is written to `.claude/steering/` containing an entry for each analyzed defect spec with its file path and content hash
**And** the file is valid JSON

**Example**:
- Given: Fresh clone with defect specs but no state file
- When: User runs `/running-retrospectives`
- Then: `.claude/steering/retrospective-state.json` is created with entries for all analyzed specs

### AC2: Unchanged Specs Are Skipped

**Given** a `retrospective-state.json` exists with hashes from a previous run
**And** some defect specs have not changed since that run
**When** the retrospectives skill runs again
**Then** unchanged defect specs are skipped (not re-analyzed)
**And** their existing learnings are preserved in the output

**Example**:
- Given: State file records 5 specs; 3 have not changed
- When: Skill runs again
- Then: Only the 2 changed/new specs are re-analyzed; learnings from the 3 unchanged specs are carried forward

### AC3: Modified Specs Are Re-Analyzed

**Given** a `retrospective-state.json` exists with hashes from a previous run
**And** a previously-analyzed defect spec has been modified
**When** the retrospectives skill runs again
**Then** the modified spec is re-analyzed
**And** its hash is updated in the state file
**And** its learnings in the output reflect the updated content

**Example**:
- Given: Spec `48-fix-severity-grep/requirements.md` was modified since last run (hash mismatch)
- When: Skill runs
- Then: The spec is re-analyzed and its state entry updated with the new hash

### AC4: New Specs Are Analyzed

**Given** a `retrospective-state.json` exists from a previous run
**And** a new defect spec has been added to the repo
**When** the retrospectives skill runs again
**Then** the new spec is analyzed
**And** its entry is added to the state file

**Example**:
- Given: State file has 5 entries; a 6th defect spec was added
- When: Skill runs
- Then: The new spec is analyzed and the state file now has 6 entries

### AC5: Deleted Specs Are Cleaned Up

**Given** a `retrospective-state.json` references a defect spec that no longer exists
**When** the retrospectives skill runs again
**Then** the deleted spec's entry is removed from the state file
**And** learnings sourced solely from the deleted spec are removed from the retrospective output

**Example**:
- Given: State file references `.claude/specs/99-old-bug/requirements.md` which has been deleted
- When: Skill runs
- Then: Entry for spec 99 is removed; learnings citing only spec 99 are removed

### AC6: Each Retrospective Finding Is Unique

**Given** the skill has completed its aggregation pass
**When** the final learnings list is produced
**Then** no two learnings in the output have the same or substantially overlapping core pattern
**And** near-duplicate learnings are merged, combining their evidence references

**Example**:
- Given: Two defect specs both reveal a missing-AC pattern about artifact lifecycle cleanup
- When: Aggregation runs
- Then: A single merged learning appears with both defect specs listed as evidence

### AC7: State File Format Is Valid JSON

**Given** the retrospectives skill completes successfully
**When** `retrospective-state.json` is written
**Then** it is valid JSON containing at minimum: a map of analyzed spec paths, each with a content hash (string) and the date last analyzed (ISO 8601 string)

**Example**:
- Given: Skill completes successfully
- When: State file is written
- Then: File parses as valid JSON with structure like `{ "specs": { ".claude/specs/20-fix/requirements.md": { "hash": "sha256:abc...", "lastAnalyzed": "2026-02-22" } }, "version": 1 }`

### AC8: Graceful Degradation When State File Is Malformed

**Given** a `retrospective-state.json` exists but contains invalid JSON or an unrecognized schema
**When** the retrospectives skill runs
**Then** the skill logs a warning that the state file is corrupt/unrecognized
**And** falls back to a full re-analysis (as if no state file exists)
**And** overwrites the malformed file with a valid state file upon completion

**Example**:
- Given: State file contains `{broken json`
- When: Skill runs
- Then: Warning logged, full re-analysis performed, valid state file written

### AC9: Output Summary Distinguishes New vs. Carried-Forward Learnings

**Given** the skill has completed a run with both new analyses and carried-forward learnings
**When** the output summary is displayed
**Then** the summary distinguishes counts of new vs. carried-forward learnings (e.g., "3 new, 5 carried forward")

**Example**:
- Given: 2 new specs analyzed, 4 unchanged specs carried forward
- When: Summary displayed
- Then: Output shows "Learnings: 3 new, 5 carried forward" (or similar breakdown)

### AC10: Content Hash Computed Before Analysis

**Given** a defect spec is eligible for analysis
**When** the skill processes it
**Then** a content hash (SHA-256) is computed from the spec's `requirements.md` file content before analysis begins
**And** this hash is used for comparison against the stored hash in the state file

### Generated Gherkin Preview

```gherkin
Feature: Retrospective State Tracking and Deduplication
  As a spec author (human or OpenClaw automation agent)
  I want the retrospectives skill to track analyzed defect specs and skip unchanged ones
  So that retrospective runs are efficient and never produce duplicate learnings

  Scenario: State file created on first run
    Given no ".claude/steering/retrospective-state.json" exists
    When the retrospectives skill completes a run
    Then a "retrospective-state.json" is written with entries for each analyzed defect spec
    And each entry contains the spec's file path and content hash

  Scenario: Unchanged specs are skipped
    Given a "retrospective-state.json" exists with hashes from a previous run
    And some defect specs have not changed since that run
    When the retrospectives skill runs again
    Then unchanged defect specs are not re-analyzed
    And their existing learnings are preserved in the output

  Scenario: Modified specs are re-analyzed
    Given a "retrospective-state.json" exists with hashes from a previous run
    And a previously-analyzed defect spec has been modified
    When the retrospectives skill runs again
    Then the modified spec is re-analyzed
    And its hash is updated in the state file

  Scenario: New specs are analyzed
    Given a "retrospective-state.json" exists from a previous run
    And a new defect spec has been added
    When the retrospectives skill runs again
    Then the new spec is analyzed and added to the state file

  Scenario: Deleted specs are cleaned up
    Given a "retrospective-state.json" references a defect spec that no longer exists
    When the retrospectives skill runs again
    Then the deleted spec's entry is removed from the state file
    And learnings sourced solely from the deleted spec are removed

  Scenario: Each finding is unique
    Given the skill has completed its aggregation pass
    When the final learnings list is produced
    Then no two learnings have overlapping core patterns
    And near-duplicates are merged with combined evidence references

  Scenario: State file format is valid JSON
    Given the retrospectives skill completes successfully
    When "retrospective-state.json" is written
    Then it is valid JSON with spec paths, content hashes, and analysis dates

  Scenario: Graceful degradation with malformed state file
    Given a "retrospective-state.json" exists but contains invalid JSON
    When the retrospectives skill runs
    Then a warning is logged
    And a full re-analysis is performed
    And a valid state file is written

  Scenario: Output summary distinguishes new vs carried-forward learnings
    Given the skill completes with both new analyses and carried-forward learnings
    When the output summary is displayed
    Then the summary shows counts of new vs carried-forward learnings

  Scenario: Content hash computed before analysis
    Given a defect spec is eligible for analysis
    When the skill processes it
    Then a SHA-256 hash is computed from the spec content before analysis
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | Compute a SHA-256 content hash for each eligible defect spec's `requirements.md` before analysis | Must | Hash is the change-detection mechanism |
| FR2 | Persist analyzed spec hashes to `.claude/steering/retrospective-state.json` after each run | Must | State file is committed to repo for persistence across clones |
| FR3 | On subsequent runs, compare current spec hashes against stored hashes and skip unchanged specs | Must | Core efficiency optimization |
| FR4 | Re-analyze specs whose content hash has changed since last run, updating the stored hash | Must | Ensures learnings stay current with spec modifications |
| FR5 | Remove state entries for defect specs that no longer exist on disk | Must | Prevents stale state accumulation |
| FR6 | Preserve learnings from unchanged specs without re-deriving them (carry forward from previous `retrospective.md` output) | Should | Requires reading existing `retrospective.md` to extract per-spec learnings |
| FR7 | Ensure the deduplication pass reliably catches near-duplicate learnings and merges them, combining evidence references | Must | Applies across both new and carried-forward learnings |
| FR8 | Update the Step 9 output summary to distinguish new vs. carried-forward learnings | Should | E.g., "3 new, 5 carried forward" |
| FR9 | Fall back to full re-analysis when state file is missing, malformed, or has unrecognized schema version | Must | Backward compatibility with first run and corruption recovery |
| FR10 | Include a `version` field in the state file schema for future schema evolution | Should | Allows graceful migration if schema changes later |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Unchanged specs must be skipped without LLM analysis; only hash computation and state file comparison required for skipped specs |
| **Reliability** | Malformed state file must not prevent the skill from running; fallback to full re-analysis |
| **Consistency** | State file and `retrospective.md` must remain in sync — every spec referenced in state must have its learnings reflected in the output |
| **Portability** | SHA-256 hashing must use a cross-platform method available in Claude Code's tool set (e.g., Bash `shasum -a 256` or equivalent) |

---

## UI/UX Requirements

| Element | Requirement |
|---------|-------------|
| **Progress Feedback** | During analysis, indicate which specs are being skipped vs. analyzed (e.g., "Skipping 3 unchanged specs, analyzing 2 new/modified specs") |
| **Output Summary** | Step 9 summary must show: total specs, skipped count, new count, modified count, deleted count, and new vs. carried-forward learning counts |
| **Warning Messages** | Warn on: malformed state file (falling back to full analysis), deleted specs being cleaned up |

---

## Data Requirements

### Input Data

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| Defect spec `requirements.md` files | Markdown files | Must exist at `.claude/specs/*/requirements.md` with `# Defect Report:` heading | Yes |
| `retrospective-state.json` | JSON file | Must be valid JSON with `version` and `specs` fields; malformed triggers fallback | No (first run) |
| Existing `retrospective.md` | Markdown file | Used to extract carried-forward learnings for unchanged specs | No (first run) |

### Output Data

| Field | Type | Description |
|-------|------|-------------|
| `.claude/steering/retrospective-state.json` | JSON file | Map of analyzed spec paths with content hashes and analysis dates |
| `.claude/steering/retrospective.md` | Markdown file | Updated retrospective with new + carried-forward learnings |
| Console summary | Text | Counts of specs processed, skipped, and learning breakdown |

---

## Dependencies

### Internal Dependencies
- [x] `/running-retrospectives` skill exists (Issue #1 — completed)
- [x] Defect spec template with `Related Spec` field (Issue #16 — completed)
- [x] `.claude/steering/` directory infrastructure (Issue #3 — completed)

### External Dependencies
- SHA-256 hashing capability (available via Bash `shasum -a 256` on macOS/Linux, `certutil` or `sha256sum` on Windows — skill should use a cross-platform approach)

### Blocked By
- None

---

## Out of Scope

- Changing the retrospective output format (`.claude/steering/retrospective.md` structure stays the same)
- Adding semantic/embeddings-based similarity for deduplication — the existing aggregation approach is sufficient
- Tracking state across different git branches or worktrees
- Caching individual learning text in the state file (only spec hashes and metadata are tracked; learnings are extracted from the existing `retrospective.md`)
- Automatic triggering of retrospectives based on new defect spec creation
- Migration tooling for future state file schema versions (the `version` field enables this but migration logic is deferred)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Skip efficiency | Unchanged specs are not re-analyzed | State file hash comparison prevents redundant analysis |
| Deduplication accuracy | Zero near-duplicate learnings in output | Manual review of retrospective output across multiple runs |
| Backward compatibility | First run (no state file) produces identical output to current behavior | Compare output with and without state file |
| State file integrity | State file always valid JSON after skill completion | Automated JSON parse check |

---

## Open Questions

- [ ] Should the state file track the hash of the related feature spec in addition to the defect spec? (If the feature spec changes, the correlation analysis might produce different learnings even though the defect spec hasn't changed.)

---

## Retrospective Learnings Applied

The following learnings from `.claude/steering/retrospective.md` were considered when drafting these requirements:

| Learning | How Applied |
|----------|-------------|
| Features creating persistent artifacts need complete lifecycle ACs (creation, persistence, cleanup) | AC1 covers creation, AC5 covers cleanup of deleted specs, AC7 covers format validity, AC8 covers corruption recovery |
| Features consuming context documents at multiple stages should enumerate which documents are read at each stage | FR3/FR6 specify that state file is read at the start (for hash comparison) and `retrospective.md` is read for carried-forward learnings; state file is written at the end |
| Features producing synthesized output from multiple inputs need ACs for abstraction level and merge behavior | AC6 specifies deduplication merge behavior; FR7 requires merging evidence references |
| AI agent postcondition verification needed for prompt-based operations | AC7 specifies the state file must be valid JSON (verifiable postcondition); AC10 specifies hash computation happens before analysis |
| Graceful degradation when optional integrations are absent | AC8 covers malformed state file fallback; FR9 covers missing state file |

---

## Validation Checklist

Before moving to PLAN phase:

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases and error states are specified (malformed state, deleted specs, first run)
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented
