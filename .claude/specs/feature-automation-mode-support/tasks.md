# Tasks: Automation Mode Support

**Issues**: #11, #71
**Date**: 2026-02-22
**Status**: Complete
**Author**: Claude Code (retroactive)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| 1: Plugin Files (#11) | 6 | [x] |
| 2: Integration (#11) | 1 | [x] |
| 3: Testing (#11) | 1 | [x] |
| 4: Automatable Label Gate (#71) | 8 | [x] |
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

## Phase 1: Plugin Files

### T001: Add Auto-Mode to Creating-Issues

**File(s)**: `plugins/nmg-sdlc/skills/creating-issues/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Automation Mode section added
- [x] Skip interview, infer criteria from steering docs
- [x] Output "Done. Awaiting orchestrator." at completion

### T002: Add Auto-Mode to Starting-Issues

**File(s)**: `plugins/nmg-sdlc/skills/starting-issues/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Automation Mode section added
- [x] Auto-select oldest issue when no argument provided
- [x] Skip selection and confirmation steps

### T003: Add Auto-Mode to Writing-Specs

**File(s)**: `plugins/nmg-sdlc/skills/writing-specs/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Automation Mode section added
- [x] All 3 review gates pre-approved
- [x] Do not call AskUserQuestion at any gate

### T004: Add Auto-Mode to Implementing-Specs

**File(s)**: `plugins/nmg-sdlc/skills/implementing-specs/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Automation Mode section added
- [x] Do not call EnterPlanMode (design approach internally)
- [x] All approval gates pre-approved

### T005: Add Auto-Mode to Verifying-Specs

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Automation Mode section added
- [x] All approval gates pre-approved

### T006: Add Auto-Mode to Creating-PRs

**File(s)**: `plugins/nmg-sdlc/skills/creating-prs/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Orchestrator completion signal: "Done. Awaiting orchestrator."

---

## Phase 2: Integration

### T007: Verify Cross-Skill Consistency

**File(s)**: All SKILL.md files
**Type**: Verify
**Depends**: T001-T006
**Status**: Complete
**Acceptance**:
- [x] All skills check `.claude/auto-mode` consistently
- [x] All skills suppress next-step suggestions in auto-mode
- [x] Completion signal is consistent across all skills

---

## Phase 3: Testing

### T008: Create BDD Feature File

**File(s)**: `.claude/specs/11-automation-mode-support/feature.gherkin`
**Type**: Create
**Depends**: T007
**Status**: Complete
**Acceptance**:
- [x] All 6 acceptance criteria have corresponding scenarios

---

## Phase 4: Automatable Label Gate (Issue #71)

### T009: Add Automatable Question to Creating-Issues Interactive Mode

**File(s)**: `plugins/nmg-sdlc/skills/creating-issues/SKILL.md`
**Type**: Modify
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] New step added after Step 5 (Interview) and before Step 6 (Synthesize) asking "Is this issue suitable for automation?" via `AskUserQuestion` with Yes/No options
- [x] The step is clearly marked as skipped in auto-mode (with a `> **Auto-mode**:` note)
- [x] The user's answer is recorded for use in Step 8

**Notes**: Insert as Step 5b or renumber subsequent steps. The question uses `AskUserQuestion` with two options: "Yes — suitable for hands-off automation" and "No — requires human judgment". Keep the step concise — one question, not an explanation of automation.

### T010: Update Creating-Issues Auto-Mode to Default Automatable

**File(s)**: `plugins/nmg-sdlc/skills/creating-issues/SKILL.md`
**Type**: Modify
**Depends**: T009
**Status**: Complete
**Acceptance**:
- [x] Automation Mode section updated to state that the `automatable` label is applied by default in auto-mode
- [x] No `AskUserQuestion` call for the automatable question in auto-mode
- [x] The auto-mode documentation bullet clearly states the default behavior

**Notes**: Add to the existing Automation Mode section at the top of the workflow. One additional bullet: "Apply the `automatable` label automatically (skip the automatable question)."

### T011: Add Label Auto-Creation and Postcondition Check to Creating-Issues Step 8

**File(s)**: `plugins/nmg-sdlc/skills/creating-issues/SKILL.md`
**Type**: Modify
**Depends**: T009
**Status**: Complete
**Acceptance**:
- [x] Step 8 updated to check if the `automatable` label exists before issue creation using `gh label list --search automatable --json name --jq '.[].name'`
- [x] If the label doesn't exist, it's created via `gh label create "automatable" --description "Suitable for automated SDLC processing" --color "0E8A16"`
- [x] The `--label` flag in `gh issue create` conditionally includes `automatable` based on the user's answer (or auto-mode default)
- [x] After issue creation, a postcondition check verifies the label was applied: `gh issue view #N --json labels --jq '.labels[].name'` and confirms `automatable` is present (if intended)
- [x] If the postcondition check fails, a warning is included in the Step 9 output

**Notes**: The label auto-creation should happen in step 8's "Check labels" substep (8.1-8.2), before the `gh issue create` call. The postcondition check goes after the issue is created, before Step 9's output.

### T012: Add Automatable Label Filter to Starting-Issues Auto-Mode

**File(s)**: `plugins/nmg-sdlc/skills/starting-issues/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] Auto-mode `gh issue list` commands in Step 1 include `--label automatable` flag
- [x] Both milestone-filtered and non-milestone-filtered variants updated
- [x] The Automation Mode section documents that only `automatable`-labeled issues are eligible in auto-mode

**Notes**: Update three locations in the skill: (1) the Automation Mode section at the top, (2) the "Zero viable milestones" fallback command, (3) the milestone-specific command. Add `--label automatable` to each `gh issue list` call used in auto-mode only.

### T013: Add Empty-Set Handling to Starting-Issues Auto-Mode

**File(s)**: `plugins/nmg-sdlc/skills/starting-issues/SKILL.md`
**Type**: Modify
**Depends**: T012
**Status**: Complete
**Acceptance**:
- [x] When the auto-mode filtered issue list returns zero results, the skill reports "No automatable issues found in milestone [name]" (or "No automatable issues found" if no milestone)
- [x] The skill exits gracefully without attempting to select or create a branch
- [x] The output format is: `No automatable issues found. Done. Awaiting orchestrator.`
- [x] The skill does NOT fall back to selecting non-automatable issues

**Notes**: Add a conditional check after the `gh issue list` call in auto-mode. If the JSON result is an empty array, output the message and stop. This is a new early-exit path in Step 1.

### T014: Add Automatable Indicator to Starting-Issues Interactive Mode

**File(s)**: `plugins/nmg-sdlc/skills/starting-issues/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] In interactive mode (Step 2), each issue option's description includes `(automatable)` if the issue has the `automatable` label
- [x] Issues without the label show their existing description (labels or "No labels") without the indicator
- [x] The `--json` output in Step 1 already includes `labels`, so no additional API call is needed
- [x] No filtering is applied in interactive mode — all issues are shown

**Notes**: The `gh issue list --json number,title,labels` already returns label data. When constructing the `AskUserQuestion` options in Step 2, check if `automatable` is in the labels array and append the indicator to the description string.

### T015: Verify Cross-Skill Consistency for Automatable Label

**File(s)**: `plugins/nmg-sdlc/skills/creating-issues/SKILL.md`, `plugins/nmg-sdlc/skills/starting-issues/SKILL.md`
**Type**: Verify
**Depends**: T009, T010, T011, T012, T013, T014
**Status**: Complete
**Acceptance**:
- [x] The label name `automatable` is consistent across both skills (no typos, no case differences)
- [x] The `gh label create` command uses the exact color `0E8A16` and description `"Suitable for automated SDLC processing"`
- [x] `/creating-issues` applies the label → `/starting-issues` filters by the same label
- [x] Auto-mode behavior is documented consistently in both skills' Automation Mode sections

### T016: Add BDD Scenarios for Automatable Label Gate

**File(s)**: `.claude/specs/feature-automation-mode-support/feature.gherkin`
**Type**: Modify
**Depends**: T015
**Status**: Complete
**Acceptance**:
- [x] Scenarios added for AC7–AC16 (10 new scenarios)
- [x] Each scenario tagged with `# Added by issue #71` comment
- [x] Scenarios cover: interactive question, label applied, no label, auto-mode default, filter, invisible, empty set, indicator, auto-create, postcondition

---

## Dependency Graph

```
Phase 1-3 (Issue #11, complete):
T001 ──┬──▶ T007 ──▶ T008
T002 ──┤
T003 ──┤
T004 ──┤
T005 ──┤
T006 ──┘

Phase 4 (Issue #71):
T001 ──▶ T009 ──▶ T010
                ──▶ T011
T002 ──▶ T012 ──▶ T013
       ──▶ T014
T009, T010, T011, T012, T013, T014 ──▶ T015 ──▶ T016
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #11 | 2026-02-15 | Initial feature spec |
| #71 | 2026-02-22 | Add Phase 4: automatable label gate — 8 tasks across creating-issues and starting-issues skills |

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] All 6 skills modified consistently (#11)
- [x] Phase 4 tasks map to specific ACs from issue #71
- [x] File paths reference actual skill locations per structure.md
