# Tasks: Starting Issues Skill

**Issues**: #10, #89, #127
**Date**: 2026-04-18
**Status**: In Progress
**Author**: Claude Code (retroactive)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | [x] |
| Plugin Files | 1 | [x] |
| Integration | 1 | [x] |
| Testing | 1 | [x] |
| Enhancement — Issue #89 | 2 | [x] |
| Enhancement — Issue #127 | 4 | [~] |
| **Total** | **10** | |

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

### T001: Create Skill Directory

**File(s)**: `plugins/nmg-sdlc/skills/start-issue/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Directory exists

---

## Phase 2: Plugin Files

### T002: Create Skill Definition

**File(s)**: `plugins/nmg-sdlc/skills/start-issue/SKILL.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] SKILL.md has valid frontmatter with name, description, argument-hint, allowed-tools
- [x] Documents 4-step workflow (identify, select, confirm, branch/status)
- [x] Milestone-scoped issue listing with fallback
- [x] Automation mode behavior documented
- [x] GraphQL API usage for project status updates documented
- [x] Output summary format documented

---

## Phase 3: Integration

### T003: Configure Allowed Tools

**File(s)**: `plugins/nmg-sdlc/skills/start-issue/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] Allowed tools: Read, Glob, Grep, Bash(gh:*), Bash(git:*)

---

## Phase 4: Testing

### T004: Create BDD Feature File

**File(s)**: `specs/10-start-issue-skill/feature.gherkin`
**Type**: Create
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] All 5 acceptance criteria have corresponding scenarios

---

## Phase 5: Enhancement — Issue #89

### T005: Add Diagnostic Query and Output to Auto-Mode Empty Result Handling

**File(s)**: `plugins/nmg-sdlc/skills/start-issue/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] The "Auto-Mode: Empty Result Handling" section in Step 1 is updated to include a diagnostic query
- [x] When zero automatable issues are found, the skill instructs a second `gh issue list` call without `--label automatable` (preserving same milestone scope) to get total open issue count
- [x] When total open > 0: output includes count and a suggestion to check label assignment (AC6, AC7)
- [x] When total open = 0: output indicates no open issues without suggesting label checks (AC8)
- [x] The diagnostic query uses `--json number --jq 'length'` to count efficiently
- [x] Output still ends with `Done. Awaiting orchestrator.` for runner compatibility

**Notes**: Modify only the "Auto-Mode: Empty Result Handling" sub-section. The diagnostic flow has two branches based on total open count. Ensure scope matching — if the original query was milestone-scoped, the diagnostic query must use the same milestone filter.

### T006: Add BDD Scenarios for Diagnostic Output

**File(s)**: `specs/feature-start-issue-skill/feature.gherkin`
**Type**: Modify
**Depends**: T005
**Status**: Complete
**Acceptance**:
- [x] Scenario for AC6: diagnostic context included in zero-result output
- [x] Scenario for AC7: label suggestion when open issues exist without label
- [x] Scenario for AC8: no misleading suggestion when genuinely no open issues
- [x] All scenarios are valid Gherkin syntax

---

## Phase 6: Enhancement — Issue #127 (Blocked-Filter + Topological Order)

### T007: Add Step 1a "Dependency Resolution" Section to SKILL.md

**File(s)**: `plugins/nmg-sdlc/skills/start-issue/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] A new sub-section "Step 1a: Dependency Resolution" is inserted between Step 1 (Identify Issue) and Step 2 (Present Issue Selection)
- [x] The section documents the GraphQL batch query that fetches `parent`, `subIssues`, and `body` for every candidate in one round-trip (including the exact query shape from design.md)
- [x] The section documents the body cross-ref parser: case-insensitive, line-anchored patterns for `Depends on: #X` and `Blocks: #Y`; `Blocks: #Y` on issue `X` is normalized to `Depends on: #X` on issue `Y`
- [x] The section describes building `parentsOf: Map<issue, Set<parent>>` from the merged native + body data
- [x] The section describes the blocked filter: an issue is dropped if any parent is not in `CLOSED` state; missing / cross-repo parents are treated as closed (fail-open)
- [x] The section describes Kahn's topological sort with issue-number ascending tie-break among zero-in-degree nodes
- [x] The section describes cycle handling: emit a named-participants warning and append cycle members in issue-number order; never abort
- [x] The section describes the fallback chain: GraphQL failure → body-only fetch via `gh issue view --json body`; total failure → skip dependency resolution with a warning and preserve legacy ordering
- [x] The section specifies the one-line session note format: `Filtered N blocked issues from selection.`, emitted in both interactive and unattended mode before presentation/auto-selection, even when `N == 0`

**Notes**: Follow the design in `design.md` "Dependency Resolution Design (Issue #127)". Keep the SKILL.md prose concise — reference the spec for deep detail rather than duplicating it, but include enough for the implementer agent to work from SKILL.md alone.

### T008: Update Step 1 and Unattended-Mode References to Invoke the Filter

**File(s)**: `plugins/nmg-sdlc/skills/start-issue/SKILL.md`
**Type**: Modify
**Depends**: T007
**Status**: Complete
**Acceptance**:
- [x] Step 1 "Select Milestone and Fetch Issues" now notes that after fetching raw candidates, Step 1a runs before presentation
- [x] The "Unattended Mode" section near the top of SKILL.md is updated: "select the first available issue (sorted by issue number ascending — oldest first)" becomes "select the first unblocked `automatable` issue in topological order (ties broken by issue number ascending)"
- [x] Step 2 is updated to reference the topologically-ordered list from Step 1a rather than the raw fetch
- [x] The Workflow Overview diagram is updated to include Step 1a between Steps 1 and 2
- [x] No existing behavior in Step 4 or the Output section is altered

**Notes**: This task threads the new stage into the existing flow without duplicating logic. Make targeted edits — do not rewrite unrelated sections.

### T009: Add BDD Scenarios for Dependency Resolution

**File(s)**: `specs/feature-start-issue-skill/feature.gherkin`
**Type**: Modify
**Depends**: T007
**Status**: Complete
**Acceptance**:
- [x] Scenario for AC9: blocked issue is omitted from the selection list
- [x] Scenario for AC10: unblocked issues are ordered parent-before-descendant with issue-number tie-break
- [x] Scenario for AC11: cycle detection logs a warning and places cycle members at the end in issue-number order without aborting
- [x] Scenario for AC12: unattended mode never picks a blocked issue even when it has the lowest number
- [x] Scenario for AC13: session note reports the filtered blocked count (including `N == 0`)
- [x] Scenario for AC14: native sub-issue links and `Depends on` / `Blocks` body cross-refs are both parsed and merged
- [x] All new scenarios tagged or commented with `# Added by issue #127`
- [x] All scenarios are valid Gherkin syntax

### T010: Manually Exercise the Dependency-Aware Selection Flow

**File(s)**: (verification — no file changes)
**Type**: Verify
**Depends**: T007, T008, T009
**Status**: Pending manual exercise (requires interactive test repo setup — flagged for `/verify-code` follow-up)
**Acceptance**:
- [ ] Create a scratch branch/test repo with three issues: parent (open), child (depends on parent, open), sibling (no deps, open)
- [ ] Run `/start-issue` in interactive mode and confirm the child is NOT listed while parent and sibling are, with parent appearing before sibling (issue-number tie-break)
- [ ] Close parent; re-run and confirm child appears, ordered after sibling (by # asc)
- [ ] Introduce a cycle (two issues each declaring `Depends on` the other); re-run and confirm the warning is emitted and the run does not abort
- [ ] Toggle `.claude/unattended-mode` and confirm the unattended auto-pick honors the same filter and order
- [ ] Confirm the session note line is emitted in all four runs

**Notes**: Exercise testing is required for SKILL.md changes per the verify-code skill's conventions. Capture terminal output in the PR for review.

---

## Dependency Graph

```
T001 ──▶ T002 ──▶ T003 ──▶ T004
                  │
                  ├──▶ T005 ──▶ T006
                  │
                  └──▶ T007 ──▶ T008
                        │
                        └──▶ T009 ──▶ T010
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #10 | 2026-02-15 | Initial feature spec |
| #89 | 2026-02-25 | Add diagnostic tasks for zero automatable issues (T005–T006) |
| #127 | 2026-04-18 | Add dependency-resolution tasks: SKILL.md step insertion (T007), flow threading (T008), BDD scenarios (T009), exercise test (T010) |

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Acceptance criteria are verifiable
