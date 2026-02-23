# Defect Report: Retrospective defect-spec discovery and Related Spec link validation

**Issue**: #68
**Date**: 2026-02-20
**Status**: Draft
**Author**: Claude
**Severity**: High
**Related Spec**: `.claude/specs/feature-retrospective-skill/` (also affects `feature-writing-specs-skill` and `feature-migration-skill`)

---

## Reproduction

### Steps to Reproduce

**Problem 1: Unreliable defect spec discovery**

1. Have a project with defect specs containing `**Severity**: High` in `.claude/specs/*/requirements.md`
2. Run `/running-retrospectives`
3. The skill instructs the agent to Grep for `\*{0,2}Severity\*{0,2}:` with glob `*/requirements.md`
4. Ripgrep returns 0 files because `*/requirements.md` doesn't match the directory depth — it needs `**/requirements.md`

**Problem 2: Cross-defect Related Spec links**

1. Have defect spec #57 whose `Related Spec` points to defect spec #17 (not a feature spec)
2. Run `/running-retrospectives` Step 3 — it reads both the defect spec and its "related feature spec"
3. The comparison is invalid because both are defect specs

**Problem 3: No Related Spec validation in migrating-projects**

1. Have defect specs with `Related Spec` pointing to other defect specs or nonexistent directories
2. Run `/migrating-projects`
3. No warning or error about invalid links — they persist silently

**Problem 4: writing-specs doesn't filter defect specs from Related Spec search**

1. File a bug about a component that already has a defect spec (e.g., "auto-mode")
2. Run `/writing-specs` — Phase 1 Step 7 searches all specs via Glob/Grep
3. A defect spec matches the keywords more strongly than the feature spec
4. The agent picks the defect spec as the Related Spec, creating a circular reference

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | Any (cross-platform) |
| **Version / Commit** | nmg-sdlc v2.12.8+ |
| **Browser / Runtime** | Claude Code CLI |
| **Configuration** | Default |

### Frequency

Always (deterministic in Problems 1 and 4; depends on spec topology for Problems 2 and 3)

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | `/running-retrospectives` reliably discovers all defect specs; Related Spec links always point to feature specs; `/migrating-projects` validates and corrects invalid links; `/writing-specs` only considers feature specs when populating Related Spec |
| **Actual** | Defect spec discovery returns 0 files depending on Grep glob interpretation; cross-defect Related Spec links cause invalid comparisons; `/migrating-projects` silently ignores invalid links; `/writing-specs` may select defect specs as Related Spec, creating circular references |

### Error Output

```
# Problem 1: Grep with glob `*/requirements.md` on .claude/specs/
# Expected: 14+ files found
# Actual: 0 files found (ripgrep glob doesn't match directory depth)

# Problem 4: writing-specs Phase 1 Step 7
# Searching for "auto-mode" across all specs
# Defect spec #17 (fix-auto-mode-cleanup-on-exit) matches "auto-mode" more strongly
# than feature spec #11 (automation-mode-support)
# Result: Related Spec set to defect spec #17 instead of feature spec #11
```

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Deterministic defect spec discovery

**Given** a project with defect specs containing `**Severity**: [value]` in `.claude/specs/*/requirements.md`
**When** `/running-retrospectives` executes Step 1
**Then** all defect specs are found on the first attempt without fallback patterns, regardless of how the agent calls the Grep tool

### AC2: Cross-defect Related Spec chain resolution

**Given** a defect spec whose `Related Spec` points to another defect spec (e.g., a regression)
**When** `/running-retrospectives` processes that defect in Step 3
**Then** the skill follows the chain to the root feature spec and performs the comparison against that feature spec

### AC3: Orphan defect spec handling

**Given** a defect spec whose `Related Spec` chain leads to a defect with no feature spec (circular reference or dead end)
**When** `/running-retrospectives` processes that defect in Step 2
**Then** the skill warns about the broken chain and skips the defect

### AC4: Migration validates Related Spec links

**Given** a project with defect specs where some `Related Spec` links point to other defect specs or nonexistent directories
**When** `/migrating-projects` runs its analysis phase
**Then** each defect spec's `Related Spec` link is validated: the target must exist and must be a feature spec (heading starts with `# Requirements:`)

### AC5: Migration reports and corrects invalid links

**Given** `/migrating-projects` detects a defect spec with an invalid `Related Spec` link
**When** findings are presented in Step 9
**Then** the finding includes the current (invalid) link and a suggested correction (the root feature spec), and if the user approves, the link is updated in the defect spec

### AC6: writing-specs filters defect specs from Related Spec search

**Given** `/writing-specs` is processing a defect issue and searching for a Related Spec
**When** the keyword search in Phase 1 Step 7 returns matching spec files
**Then** only feature specs (heading starts with `# Requirements:`) are considered as candidates — defect specs (heading starts with `# Defect Report:`) are excluded from the results

### AC7: writing-specs finds the root feature spec through defect chains

**Given** `/writing-specs` is processing a defect issue and the most relevant keyword matches are in defect specs
**When** no feature spec directly matches the keywords
**Then** the skill follows the matched defect specs' own `Related Spec` links to find the root feature spec and uses that as the Related Spec value

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Rewrite running-retrospectives Step 1 to instruct the agent to iterate over Glob results and grep individual file paths (not directory-level grep with unreliable glob) | Must |
| FR2 | Add cross-defect Related Spec chain resolution logic to running-retrospectives Step 3 | Must |
| FR3 | Add Related Spec link validation to migrating-projects as a new analysis step | Must |
| FR4 | migrating-projects must detect circular references in Related Spec chains | Must |
| FR5 | migrating-projects must suggest the root feature spec as the correction for cross-defect links | Must |
| FR6 | writing-specs Phase 1 Step 7 must filter Glob/Grep results to exclude defect specs (check first heading for `# Defect Report:`) before selecting a Related Spec | Must |
| FR7 | writing-specs Phase 1 Step 7 must follow defect-to-feature chains when only defect specs match the keyword search | Must |

---

## Out of Scope

- Changing the defect requirements template format (bold formatting is intentional)
- Validating feature spec content or structure (already covered by migrating-projects heading diff)
- Fixing existing invalid links manually (migrating-projects should handle this via AC5)
- Restructuring the retrospective skill beyond the discovery and chain resolution fixes
- Adding new fields to the defect template

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC3 covers broken chain handling; AC4-AC5 cover migration validation)
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
