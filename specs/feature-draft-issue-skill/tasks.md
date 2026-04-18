# Tasks: Creating Issues Skill

**Issues**: #4, #116
**Date**: 2026-04-17
**Status**: In Progress
**Author**: Claude Code (retroactive + #116 amendment)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup (original) | 1 | [x] |
| Plugin Files (original) | 1 | [x] |
| Integration (original) | 1 | [x] |
| Testing (original) | 1 | [x] |
| **Phase 5: Readability Treatment (#116)** | 4 | [ ] |
| **Phase 6: Deeper Interview (#116)** | 5 | [ ] |
| **Phase 7: Unattended-Mode Removal + Breaking Change Plumbing (#116)** | 5 | [ ] |
| **Phase 8: Docs + Testing (#116)** | 3 | [ ] |
| **Total** | **21** | |

---

## Task Format

```
### T[NNN]: [Task Title]

**File(s)**: `{layer}/path/to/file`
**Type**: Create | Modify | Delete
**Depends**: T[NNN], T[NNN] (or None)
**Acceptance**:
- [ ] [Verifiable criterion 1]
- [ ] [Verifiable criterion 2]
```

---

## Phase 1: Setup (original)

### T001: Create Skill Directory
**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/`
**Type**: Create
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Directory exists at `plugins/nmg-sdlc/skills/draft-issue/`

---

## Phase 2: Plugin Files (original)

### T002: Create Skill Definition
**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Create
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] SKILL.md has valid frontmatter with name, description, argument-hint, allowed-tools
- [x] Documents 6-step workflow (gather context, interview, synthesize, review, create, output)
- [x] Includes feature/enhancement template with BDD acceptance criteria
- [x] Includes bug report template variant

---

## Phase 3: Integration (original)

### T003: Configure Allowed Tools
**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] Allowed tools include Read, Glob, Grep, Bash(gh:*), WebSearch, WebFetch
- [x] Skill is discoverable via Claude Code plugin system

---

## Phase 4: Testing (original)

### T004: Create BDD Feature File
**File(s)**: `specs/feature-draft-issue-skill/feature.gherkin`
**Type**: Create
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] All original 4 acceptance criteria have corresponding scenarios
- [x] Valid Gherkin syntax

---

## Phase 5: Readability Treatment (#116)

### T005: Add Workflow Overview ASCII diagram to SKILL.md
**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Pending
**Issue**: #116
**Acceptance**:
- [ ] SKILL.md contains a "## Workflow Overview" section near the top (after "When to Use") with an ASCII diagram showing all 9+ steps and marking human review gates at Step 5c and Step 7
- [ ] The diagram lists Step 1 through Step 9 with Step 5c labeled as a gate
- [ ] Covers AC8, FR11

### T006: Restructure each workflow step with Input/Process/Output subsections
**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify
**Depends**: T005
**Status**: Pending
**Issue**: #116
**Acceptance**:
- [ ] Every `### Step N:` section contains explicit `#### Input`, `#### Process`, `#### Output` subsections
- [ ] Steps 5c and 7 also contain `#### Human Review Gate` subsections
- [ ] Covers AC8, FR10

### T007: Add feature-vs-bug template comparison table near Step 6
**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify
**Depends**: T006
**Status**: Pending
**Issue**: #116
**Acceptance**:
- [ ] A markdown table appears near the Step 6 template blocks contrasting Feature and Bug templates across: Opening section, Context section, Reproduction, Expected vs Actual, AC count guidance, FR priority, Out of Scope
- [ ] Covers AC7, FR9

### T008: Rewrite Step 7 as inline summary + [1]/[2] menu with soft guard
**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify
**Depends**: T006
**Status**: Pending
**Issue**: #116
**Acceptance**:
- [ ] Step 7 Process section describes rendering an inline structured summary with fields: Title, User Story one-liner, numbered AC list with one-line G/W/T, FRs with MoSCoW priorities, Out of Scope, Labels
- [ ] Step 7 Process section specifies an `AskUserQuestion` with exactly two options: `[1] Approve — create the issue` and `[2] Revise — I'll describe what to change`
- [ ] Step 7 tracks `consecutiveRevises`; on the 4th iteration the menu expands to three options: `[1] Keep revising`, `[2] Reset and re-interview`, `[3] Accept as-is`
- [ ] `[2] Reset` returns the skill to Step 5 (re-interview with classification and milestone preserved)
- [ ] `[3] Accept as-is` proceeds to Step 8 as if Approve was selected
- [ ] Covers AC5, AC6, AC17, FR6, FR7, FR8, FR26

---

## Phase 6: Deeper Interview (#116)

### T009: Add adaptive-depth heuristic to Step 5 with borderline bias
**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify
**Depends**: T006
**Status**: Pending
**Issue**: #116
**Acceptance**:
- [ ] Step 5 Process section documents the heuristic selecting `core` vs `extended` depth from Step 4 signals (`filesFound`, `componentsInvolved`, `descriptionVagueness`)
- [ ] Borderline rule is specified: extended is selected when `descriptionVagueness ∈ [0.10, 0.15)` OR (`componentsInvolved == 1` AND `filesFound > 8`)
- [ ] Depth decision is emitted as a one-sentence user-visible log line
- [ ] Covers AC11, FR15, FR23

### T010: Add depth override step after heuristic log
**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify
**Depends**: T009
**Status**: Pending
**Issue**: #116
**Acceptance**:
- [ ] Immediately after the depth log line, Step 5 presents an `AskUserQuestion` with two options: `[1] Use {heuristic_pick} interview (recommended)` and `[2] Use {other_depth} interview`
- [ ] When the user overrides (selects `[2]`), the skill emits a one-line session note (e.g., `"(heuristic chose core, user selected extended)"`) before the interview begins
- [ ] Covers AC15, FR22, FR29

### T011: Expand Step 5 Feature path with NFR/edge/related-feature rounds
**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify
**Depends**: T009
**Status**: Pending
**Issue**: #116
**Acceptance**:
- [ ] The Feature interview documents 4 extended-depth rounds: R1 Persona & outcome, R2 ACs & scope, R3 NFRs & edge cases, R4 Related features & priority
- [ ] Core-depth variant collapses to 3 rounds (R3 omitted, R4's priority folded into R2)
- [ ] Covers AC9, FR12

### T012: Expand Step 5 Bug path with edge-case/regression round and add end probe
**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify
**Depends**: T009
**Status**: Pending
**Issue**: #116
**Acceptance**:
- [ ] Bug interview adds R3: edge cases beyond primary repro + related behavior that must not regress
- [ ] Reproduction remains the bug-path primary focus (R1, R2 preserved)
- [ ] The final interview round (Feature or Bug) ends with a one-line free-text probe: `"Before I play back my understanding, is there anything I haven't asked that matters here?"` whose answer is folded into the understanding block
- [ ] Covers AC9, FR13, FR24

### T013: Insert Step 5c Playback and Confirm with depth-proportional playback
**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify
**Depends**: T011, T012
**Status**: Pending
**Issue**: #116
**Acceptance**:
- [ ] New `### Step 5c: Playback and Confirm` section appears between Step 5b and Step 6, with Input/Process/Output/Human Review Gate subsections
- [ ] Core-depth path renders a one-line confirm: `"Drafting an issue for {persona} that {outcome}. In-scope: {...}. Out-of-scope: {...}"` followed by `[1] Looks right — draft the issue` / `[2] Something's off — let me clarify`
- [ ] Extended-depth path renders the full 5-line structured block (Persona, Outcome, ACs, Scope in, Scope out) followed by the same two-option menu
- [ ] Skill does not advance to Step 6 until the user selects `[1]`; `[2]` accepts a free-text clarification, revises the playback, and re-renders
- [ ] Covers AC10, AC16, FR14, FR25

---

## Phase 7: Unattended-Mode Removal + Breaking Change Plumbing (#116)

### T014: Remove Unattended Mode section + per-step blockquotes; add sign-post sentence
**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Pending
**Issue**: #116
**Acceptance**:
- [ ] Top-level `## Unattended Mode` section is removed
- [ ] All per-step `> Unattended-mode: This step is skipped.` (or equivalent) blockquotes are removed
- [ ] Where the Unattended Mode section used to be, a single sign-post sentence remains: `"As of v6.0.0, /draft-issue no longer honors .claude/unattended-mode. Issue drafting requires interactive input."`
- [ ] Step 9 Output no longer has an `[If .claude/unattended-mode exists]:` branch
- [ ] `grep -i "unattended" plugins/nmg-sdlc/skills/draft-issue/SKILL.md` returns only the sign-post sentence
- [ ] Covers AC12, AC18, FR16, FR17, FR28

### T015: Enrich Step 5b automatable question with downstream-impact explanation
**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify
**Depends**: T014
**Status**: Pending
**Issue**: #116
**Acceptance**:
- [ ] Step 5b `AskUserQuestion` body includes a 1–2 line prefix explaining the `automatable` label's effect on downstream skills (`/write-spec`, `/write-code`, `/verify-code`, `/open-pr`) and that it does NOT affect `/draft-issue` itself
- [ ] Covers AC14, FR19

### T016: Add STEP_KEYS sentinel comment to sdlc-runner.mjs
**File(s)**: `scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Status**: Pending
**Issue**: #116
**Acceptance**:
- [ ] Above the `const STEP_KEYS = [...]` declaration, a comment reads: `// NOTE: draftIssue is intentionally absent. /draft-issue is interactive-only as of plugin v6.0.0 (issue #116). Do not add it here — see plugins/nmg-sdlc/skills/draft-issue/SKILL.md for the rationale.`
- [ ] `STEP_KEYS` array is unchanged (still 9 entries: startCycle, startIssue, writeSpecs, implement, verify, commitPush, createPR, monitorCI, merge)
- [ ] Covers AC13, FR18, FR28

### T017: Document runner interactive-only status in sdlc-config.example.json
**File(s)**: `scripts/sdlc-config.example.json`
**Type**: Modify
**Depends**: T016
**Status**: Pending
**Issue**: #116
**Acceptance**:
- [ ] A comment-style key `_draft_issue_note` is added to the root object with the value: `"draft-issue is interactive-only as of plugin v6.0.0 (issue #116); do not add a draftIssue step"`
- [ ] Existing `steps` object is unchanged
- [ ] JSON remains valid
- [ ] Covers AC13, FR18

### T018: Bump plugin version to v6.0.0 (BREAKING) and update CHANGELOG
**File(s)**: `plugins/nmg-sdlc/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`
**Type**: Modify
**Depends**: T005, T006, T007, T008, T009, T010, T011, T012, T013, T014, T015, T016, T017
**Status**: Pending
**Issue**: #116
**Acceptance**:
- [ ] `plugins/nmg-sdlc/.claude-plugin/plugin.json` `"version"` is `"6.0.0"`
- [ ] `.claude-plugin/marketplace.json` plugin entry `"version"` is `"6.0.0"` (matching plugin.json)
- [ ] `CHANGELOG.md` has `[Unreleased]` entries describing readability treatment, deeper interview, and — under a `### Changed (BREAKING)` subsection — the removal of unattended-mode support from `/draft-issue`
- [ ] Covers AC18, FR21, FR27

---

## Phase 8: Docs + Testing (#116)

### T019: Update README.md to reflect new review-gate UX and interactive-only status
**File(s)**: `README.md`
**Type**: Modify
**Depends**: T008, T014
**Status**: Pending
**Issue**: #116
**Acceptance**:
- [ ] README section describing `/draft-issue` notes the inline summary + approve/revise review UX and the Step 5c playback
- [ ] README notes `/draft-issue` is interactive-only as of v6.0.0 and explicitly does not participate in unattended-mode workflows
- [ ] Any stale language implying `/draft-issue` can run under the runner is removed
- [ ] Covers FR20

### T020: Add regression test asserting STEP_KEYS excludes draftIssue
**File(s)**: `scripts/__tests__/sdlc-runner.test.mjs`
**Type**: Modify
**Depends**: T016
**Status**: Pending
**Issue**: #116
**Acceptance**:
- [ ] New Jest test asserts `STEP_KEYS.includes('draftIssue') === false`
- [ ] Test has a clear name such as `'STEP_KEYS does not contain draftIssue — /draft-issue is interactive-only (v6.0.0, issue #116)'`
- [ ] Existing tests continue to pass
- [ ] Covers AC13, FR18

### T021: Update feature.gherkin with #116 scenarios
**File(s)**: `specs/feature-draft-issue-skill/feature.gherkin`
**Type**: Modify
**Depends**: T008, T010, T013, T014
**Status**: Pending
**Issue**: #116
**Acceptance**:
- [ ] New scenarios cover AC5–AC18 (one scenario per AC, with original scenarios preserved)
- [ ] Scenarios tagged `# Added by issue #116` group them visually
- [ ] Gherkin remains syntactically valid
- [ ] Covers every AC added by #116

---

## Dependency Graph

```
Phase 1–4 (original): T001 → T002 → {T003, T004}  [all complete]

Phase 5 (Readability):
  T005 ──▶ T006 ──┬──▶ T007
                  └──▶ T008

Phase 6 (Deeper Interview):
  T006 ──▶ T009 ──┬──▶ T010
                  ├──▶ T011 ──┐
                  └──▶ T012 ──┴──▶ T013

Phase 7 (Unattended Removal):
  T014 (parallel with Phase 5/6) ──▶ T015
  T016 (parallel) ──▶ T017
  {T005..T017} ──▶ T018  (version bump after all skill/runner changes)

Phase 8 (Docs + Testing):
  T008, T014 ──▶ T019
  T016 ──▶ T020
  T008, T010, T013, T014 ──▶ T021

Critical path: T005 → T006 → T009 → T012 → T013 → T018 → T019/T020/T021
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #4 | 2026-02-15 | Initial feature spec (T001–T004 complete) |
| #116 | 2026-04-17 | Added Phase 5 (Readability: T005–T008), Phase 6 (Deeper Interview: T009–T013), Phase 7 (Unattended-Mode Removal + Breaking Change: T014–T018), Phase 8 (Docs + Testing: T019–T021). Major version bump v5.2.0 → v6.0.0. |

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure
- [x] Every AC from #116 is covered by at least one task (AC5 → T008, AC6 → T008, AC7 → T007, AC8 → T005/T006, AC9 → T011/T012, AC10 → T013, AC11 → T009, AC12 → T014, AC13 → T016/T017/T020, AC14 → T015, AC15 → T010, AC16 → T013, AC17 → T008, AC18 → T014/T018)
