# Defect Report: Creating-issues skill does not read tech.md and structure.md during investigation

**Issue**: #27
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude Code
**Severity**: Medium
**Related Spec**: `.claude/specs/4-creating-issues-skill/`

---

## Reproduction

### Steps to Reproduce

1. Ensure `.claude/steering/tech.md` exists with constraints relevant to an enhancement area (e.g., the "Claude Code Resource Development" directive on line 85)
2. Ensure `.claude/steering/structure.md` exists with architectural patterns
3. Run `/creating-issues` and describe an enhancement to a Claude Code resource (e.g., modifying a SKILL.md)
4. Observe Step 3 (Investigate Codebase) — it explores existing specs and source code but never reads `tech.md` or `structure.md`
5. The resulting issue is missing acceptance criteria derived from steering document constraints

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | macOS (Darwin 25.3.0) |
| **Version / Commit** | nmg-sdlc 2.6.0 |
| **Browser / Runtime** | Claude Code CLI (latest) |
| **Configuration** | Standard plugin installation with all three steering docs present |

### Frequency

Always — the skill never reads `tech.md` or `structure.md` in any code path during Step 3.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | Step 3 reads `tech.md` and `structure.md` during investigation, surfacing any constraints relevant to the enhancement area — which are then incorporated into the issue's acceptance criteria or notes |
| **Actual** | Step 3 only explores existing specs and source code. `tech.md` and `structure.md` are never consulted, so constraints like "review Claude Code docs before modifying CC resources" are invisible and absent from the created issue |

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Bug Is Fixed — Steering Docs Are Read During Investigation

**Given** `.claude/steering/tech.md` and `.claude/steering/structure.md` exist in the project
**When** the creating-issues skill reaches Step 3 (Investigate Codebase)
**Then** it reads `tech.md` and `structure.md` alongside the existing spec/source exploration and surfaces any constraints relevant to the enhancement area

### AC2: No Regression — Product Steering Still Read in Step 1

**Given** `.claude/steering/product.md` exists in the project
**When** the creating-issues skill executes Step 1 (Gather Context)
**Then** `product.md` is still read for product vision, users, and priorities as it is today

### AC3: Constraints Surface in Issue Output

**Given** `tech.md` contains a constraint relevant to the enhancement area (e.g., "review Claude Code docs before modifying CC resources")
**When** the issue is synthesized in Step 5
**Then** the relevant constraint is reflected in the issue's acceptance criteria or notes section

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Step 3 reads `tech.md` and `structure.md` during investigation for both enhancement and bug flows | Must |
| FR2 | Relevant constraints from steering docs are surfaced in the investigation summary | Must |
| FR3 | Existing Step 1 `product.md` reading is unchanged | Must |

---

## Out of Scope

- Changing which steering docs Step 1 reads (product context gathering is separate from technical investigation)
- Adding new steering document types beyond the existing three
- Changes to the writing-specs or other skills (even if they have similar gaps)
- Auto-mode flow changes (auto-mode skips Step 3 entirely)

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
