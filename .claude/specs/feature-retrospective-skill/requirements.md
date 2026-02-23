# Requirements: Spec Retrospective Skill

**Issues**: #1, #67
**Date**: 2026-02-15
**Status**: Draft
**Author**: Claude

---

## User Story

**As a** developer using the nmg-sdlc workflow
**I want** defect patterns to automatically feed back into how specs are written
**So that** future specs avoid the same gaps that led to past bugs

---

## Background

When a defect is found in an existing feature, its defect spec optionally links back to the original feature spec via the **Related Spec** field. This creates a traceable relationship between "what we specified" and "what we missed." Currently, these learnings are lost — there's no mechanism to analyze defect history and feed actionable guidance back into the spec-writing process.

A new `/running-retrospectives` skill will batch-analyze all defect specs, correlate them with their related feature specs, identify recurring patterns in spec gaps, and produce a steering doc (`.claude/steering/retrospective.md`). The `/writing-specs` skill will then read this doc during Phase 1 (SPECIFY) to apply project-specific learnings when writing new specs.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Retrospective Skill Produces Steering Doc — Happy Path

**Given** defect specs exist in `.claude/specs/` with Related Spec links to feature specs
**When** the user runs `/running-retrospectives`
**Then** the skill analyzes all defect specs, correlates them with their related feature specs, identifies patterns (missing acceptance criteria, undertested boundaries, domain-specific gaps), and creates or updates `.claude/steering/retrospective.md` with actionable learnings

**Example**:
- Given: `.claude/specs/20-login-timeout-bug/requirements.md` exists with `Related Spec: .claude/specs/5-login-feature/` and root cause "missing AC for session timeout edge case"
- When: User invokes `/running-retrospectives`
- Then: `retrospective.md` includes a learning like "Authentication specs should include session timeout and expiry edge cases"

### AC2: Writing-Specs Reads Retrospective During Phase 1

**Given** a `.claude/steering/retrospective.md` file exists with learnings
**When** the user runs `/writing-specs` to create a new feature spec
**Then** Phase 1 (SPECIFY) reads the retrospective doc and applies relevant learnings when drafting acceptance criteria and requirements

**Example**:
- Given: `retrospective.md` contains "Authentication specs should include session timeout edge cases"
- When: User runs `/writing-specs` for a new auth-related feature
- Then: The generated requirements include acceptance criteria addressing session timeout scenarios

### AC3: Graceful Handling When No Defect Specs Exist

**Given** no defect specs exist in `.claude/specs/` (or none have Related Spec links)
**When** the user runs `/running-retrospectives`
**Then** the skill reports that no defect patterns were found and does not create or modify the retrospective doc

**Example**:
- Given: `.claude/specs/` contains only feature specs, no defect specs with Related Spec fields
- When: User invokes `/running-retrospectives`
- Then: Skill outputs "No defect specs with Related Spec links found. No retrospective generated."

### AC4: Only Spec-Quality Learnings Are Captured

**Given** defect specs with various root causes exist
**When** the skill analyzes them
**Then** only learnings that would improve `/writing-specs` effectiveness are included (e.g., missing AC patterns, undertested boundaries, domain-specific requirement gaps) — implementation bugs, tooling issues, or infrastructure failures are excluded

**Example**:
- Given: Three defect specs — one caused by missing AC for edge case, one caused by a typo in implementation code, one caused by CI misconfiguration
- When: Skill analyzes all three
- Then: Only the missing-AC defect produces a learning; the implementation typo and CI issue are excluded

### AC5: Retrospective Doc Is Incrementally Updated

**Given** a `.claude/steering/retrospective.md` already exists from a previous run
**When** the user runs `/running-retrospectives` again after new defect specs are added
**Then** the doc is updated with new learnings while preserving still-relevant existing learnings, and outdated entries are removed

**Example**:
- Given: Existing `retrospective.md` has 3 learnings; 2 new defect specs have been added since last run
- When: User runs `/running-retrospectives`
- Then: New learnings are added, existing relevant learnings are preserved, and any learnings no longer supported by current defect specs are removed

<!-- From issue #67 -->
### AC6: State File Created on First Run

**Given** no `.claude/steering/retrospective-state.json` exists
**When** the retrospectives skill completes a run
**Then** a `retrospective-state.json` file is written to `.claude/steering/` containing an entry for each analyzed defect spec with its file path and content hash
**And** the file is valid JSON

**Example**:
- Given: Fresh clone with defect specs but no state file
- When: User runs `/running-retrospectives`
- Then: `.claude/steering/retrospective-state.json` is created with entries for all analyzed specs

<!-- From issue #67 -->
### AC7: Unchanged Specs Are Skipped

**Given** a `retrospective-state.json` exists with hashes from a previous run
**And** some defect specs have not changed since that run
**When** the retrospectives skill runs again
**Then** unchanged defect specs are skipped (not re-analyzed)
**And** their existing learnings are preserved in the output

**Example**:
- Given: State file records 5 specs; 3 have not changed
- When: Skill runs again
- Then: Only the 2 changed/new specs are re-analyzed; learnings from the 3 unchanged specs are carried forward

<!-- From issue #67 -->
### AC8: Modified Specs Are Re-Analyzed

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

<!-- From issue #67 -->
### AC9: New Specs Are Analyzed

**Given** a `retrospective-state.json` exists from a previous run
**And** a new defect spec has been added to the repo
**When** the retrospectives skill runs again
**Then** the new spec is analyzed
**And** its entry is added to the state file

**Example**:
- Given: State file has 5 entries; a 6th defect spec was added
- When: Skill runs
- Then: The new spec is analyzed and the state file now has 6 entries

<!-- From issue #67 -->
### AC10: Deleted Specs Are Cleaned Up

**Given** a `retrospective-state.json` references a defect spec that no longer exists
**When** the retrospectives skill runs again
**Then** the deleted spec's entry is removed from the state file
**And** learnings sourced solely from the deleted spec are removed from the retrospective output

**Example**:
- Given: State file references `.claude/specs/99-old-bug/requirements.md` which has been deleted
- When: Skill runs
- Then: Entry for spec 99 is removed; learnings citing only spec 99 are removed

<!-- From issue #67 -->
### AC11: Each Retrospective Finding Is Unique

**Given** the skill has completed its aggregation pass
**When** the final learnings list is produced
**Then** no two learnings in the output have the same or substantially overlapping core pattern
**And** near-duplicate learnings are merged, combining their evidence references

**Example**:
- Given: Two defect specs both reveal a missing-AC pattern about artifact lifecycle cleanup
- When: Aggregation runs
- Then: A single merged learning appears with both defect specs listed as evidence

<!-- From issue #67 -->
### AC12: State File Format Is Valid JSON

**Given** the retrospectives skill completes successfully
**When** `retrospective-state.json` is written
**Then** it is valid JSON containing at minimum: a map of analyzed spec paths, each with a content hash (string) and the date last analyzed (ISO 8601 string)

**Example**:
- Given: Skill completes successfully
- When: State file is written
- Then: File parses as valid JSON with structure like `{ "specs": { ".claude/specs/20-fix/requirements.md": { "hash": "sha256:abc...", "lastAnalyzed": "2026-02-22" } }, "version": 1 }`

<!-- From issue #67 -->
### AC13: Graceful Degradation When State File Is Malformed

**Given** a `retrospective-state.json` exists but contains invalid JSON or an unrecognized schema
**When** the retrospectives skill runs
**Then** the skill logs a warning that the state file is corrupt/unrecognized
**And** falls back to a full re-analysis (as if no state file exists)
**And** overwrites the malformed file with a valid state file upon completion

**Example**:
- Given: State file contains `{broken json`
- When: Skill runs
- Then: Warning logged, full re-analysis performed, valid state file written

<!-- From issue #67 -->
### AC14: Output Summary Distinguishes New vs. Carried-Forward Learnings

**Given** the skill has completed a run with both new analyses and carried-forward learnings
**When** the output summary is displayed
**Then** the summary distinguishes counts of new vs. carried-forward learnings (e.g., "3 new, 5 carried forward")

**Example**:
- Given: 2 new specs analyzed, 4 unchanged specs carried forward
- When: Summary displayed
- Then: Output shows "Learnings: 3 new, 5 carried forward" (or similar breakdown)

<!-- From issue #67 -->
### AC15: Content Hash Computed Before Analysis

**Given** a defect spec is eligible for analysis
**When** the skill processes it
**Then** a content hash (SHA-256) is computed from the spec's `requirements.md` file content before analysis begins
**And** this hash is used for comparison against the stored hash in the state file

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | New `/running-retrospectives` skill (SKILL.md) that batch-analyzes all defect specs in `.claude/specs/` | Must | Skill follows standard SKILL.md structure |
| FR2 | Skill identifies defect specs by scanning for `Severity:` and `Related Spec:` fields in `requirements.md` files | Must | Defect specs use the defect requirements template |
| FR3 | Skill correlates defect specs with related feature specs via the Related Spec field | Must | Follows link to read original feature spec |
| FR4 | Skill classifies learnings into three pattern types: missing acceptance criteria, undertested boundaries, domain-specific requirement gaps | Must | Only these three categories |
| FR5 | Skill creates or updates `.claude/steering/retrospective.md` with structured, actionable learnings | Must | Structured format for machine readability |
| FR6 | Learnings are filtered to only those that improve spec-writing effectiveness | Must | Exclude implementation, tooling, infra issues |
| FR7 | `/writing-specs` Phase 1 (SPECIFY) reads `retrospective.md` when it exists | Must | Minimal change to writing-specs SKILL.md |
| FR8 | Skill supports automation mode (skip user prompts when `.claude/auto-mode` exists) | Should | Consistent with other skills |
| FR9 | Retrospective doc uses a structured, parseable format with headings per pattern type | Should | Enables writing-specs to extract relevant sections |
| FR10 | Skill gracefully handles zero defect specs (no file created, informational message) | Must | |
| FR11 | Incremental updates preserve still-relevant learnings and remove outdated ones | Must | Full re-analysis on each run, not append-only |
| FR12 | Compute a SHA-256 content hash for each eligible defect spec's `requirements.md` before analysis | Must | Hash is the change-detection mechanism |
| FR13 | Persist analyzed spec hashes to `.claude/steering/retrospective-state.json` after each run | Must | State file is committed to repo for persistence across clones |
| FR14 | On subsequent runs, compare current spec hashes against stored hashes and skip unchanged specs | Must | Core efficiency optimization |
| FR15 | Re-analyze specs whose content hash has changed since last run, updating the stored hash | Must | Ensures learnings stay current with spec modifications |
| FR16 | Remove state entries for defect specs that no longer exist on disk | Must | Prevents stale state accumulation |
| FR17 | Preserve learnings from unchanged specs without re-deriving them (carry forward from previous `retrospective.md` output) | Should | Requires reading existing `retrospective.md` to extract per-spec learnings |
| FR18 | Ensure the deduplication pass reliably catches near-duplicate learnings and merges them, combining evidence references | Must | Applies across both new and carried-forward learnings |
| FR19 | Update the Step 9 output summary to distinguish new vs. carried-forward learnings | Should | E.g., "3 new, 5 carried forward" |
| FR20 | Fall back to full re-analysis when state file is missing, malformed, or has unrecognized schema version | Must | Backward compatibility with first run and corruption recovery |
| FR21 | Include a `version` field in the state file schema for future schema evolution | Should | Allows graceful migration if schema changes later |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Skill execution should complete within reasonable time for batch analysis of all specs; no hard time limit in manual mode. Unchanged specs must be skipped without LLM analysis; only hash computation and state file comparison required for skipped specs |
| **Reliability** | Graceful degradation when defect specs have incomplete fields (missing Related Spec, missing severity). Malformed state file must not prevent the skill from running; fallback to full re-analysis |
| **Maintainability** | Retrospective doc is human-readable and editable — teams may curate auto-generated learnings |
| **Consistency** | Follows existing skill conventions: SKILL.md format, auto-mode support, SDLC integration section. State file and `retrospective.md` must remain in sync |
| **Portability** | SHA-256 hashing must use a cross-platform method available in Claude Code's tool set (e.g., Bash `shasum -a 256` or equivalent) |

---

## UI/UX Requirements

| Element | Requirement |
|---------|-------------|
| **Skill Output** | Clear summary of how many defect specs were analyzed, how many learnings produced, pattern type breakdown |
| **Progress Feedback** | Status messages during analysis: "Scanning defect specs...", "Correlating with feature specs...", "Generating learnings...". During incremental runs, indicate which specs are being skipped vs. analyzed |
| **Error States** | Informational message when no defect specs found; warning when Related Spec links point to nonexistent specs; warning on malformed state file |
| **Retrospective Doc** | Human-readable with clear section headers; editable by teams for curation |
| **Output Summary** | Step 9 summary must show: total specs, skipped count, new count, modified count, deleted count, and new vs. carried-forward learning counts |

---

## Data Requirements

### Input Data

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| Defect spec `requirements.md` | Markdown file | Must contain `Severity:` field to identify as defect | Yes |
| `Related Spec` field | File path string | Must point to existing spec directory | No (defects without this field are skipped) |
| Related feature spec files | Markdown files | Must exist at the referenced path | No (warn if missing) |
| `retrospective-state.json` | JSON file | Must be valid JSON with `version` and `specs` fields; malformed triggers fallback | No (first run) |
| Existing `retrospective.md` | Markdown file | Used to extract carried-forward learnings for unchanged specs | No (first run) |

### Output Data

| Field | Type | Description |
|-------|------|-------------|
| `.claude/steering/retrospective.md` | Markdown file | Structured learnings document organized by pattern type |
| `.claude/steering/retrospective-state.json` | JSON file | Map of analyzed spec paths with content hashes and analysis dates |
| Console output | Text | Summary of analysis: specs scanned, learnings generated, pattern breakdown, new vs. carried-forward breakdown |

---

## Dependencies

### Internal Dependencies
- [x] Defect requirements template with optional Related Spec field (Issue #16 — completed)
- [x] Steering documents infrastructure (`.claude/steering/`) (Issue #3 — completed)
- [x] `/writing-specs` skill with Phase 1 steering doc integration (Issue #5 — completed)

### External Dependencies
- SHA-256 hashing capability (available via Bash `shasum -a 256` on macOS/Linux, `certutil` or `sha256sum` on Windows — skill should use a cross-platform approach)

### Blocked By
- None — all dependencies are already implemented

---

## Out of Scope

- Per-defect incremental mode (future enhancement — this issue covers batch analysis only)
- Modifying the `/writing-specs` SKILL.md template structure itself (the retrospective is guidance, not template changes)
- Retrospectives for non-spec concerns (implementation quality, tooling, infrastructure)
- Automatic triggering of retrospectives (user must explicitly invoke the skill)
- Analysis of defect specs without Related Spec links (these are skipped — no feature spec to correlate against)
- Modifying existing defect specs to add missing Related Spec fields
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
| Defect spec coverage | 100% of defect specs with Related Spec links are analyzed | Count analyzed vs total eligible |
| Learning actionability | Every learning maps to a concrete spec-writing improvement | Manual review of output |
| Writing-specs integration | Retrospective learnings visibly influence new spec ACs | Compare specs written before/after retrospective |
| Skip efficiency | Unchanged specs are not re-analyzed | State file hash comparison prevents redundant analysis |
| Deduplication accuracy | Zero near-duplicate learnings in output | Manual review of retrospective output across multiple runs |
| Backward compatibility | First run (no state file) produces identical output to current behavior | Compare output with and without state file |
| State file integrity | State file always valid JSON after skill completion | Automated JSON parse check |

---

## Open Questions

- [x] ~~What structured format should `retrospective.md` use?~~ → Resolved: headings per pattern type (Missing Acceptance Criteria, Undertested Boundaries, Domain-Specific Gaps) with bullet-point learnings under each
- [ ] Should the skill produce a summary diff showing what changed in incremental updates?
- [ ] Should the state file track the hash of the related feature spec in addition to the defect spec? (If the feature spec changes, the correlation analysis might produce different learnings even though the defect spec hasn't changed.)

---

## Change History

| Date | Issue | Summary |
|------|-------|---------|
| 2026-02-15 | #1 | Initial spec: `/running-retrospectives` skill, batch defect analysis, `retrospective.md` steering doc, writing-specs integration |
| 2026-02-22 | #67 | Added content-hash-based state tracking, skip-unchanged optimization, deduplication (AC6–AC15, FR12–FR21) |

---

## Validation Checklist

Before moving to PLAN phase:

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases and error states are specified
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented (or resolved)
