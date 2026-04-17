# Tasks: Unattended Mode Support

**Issues**: #11, #71, #118
**Date**: 2026-04-16
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
| 5: Rename to Unattended-Mode (#118) | 12 | [x] |
| **Total** | **28** | |

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

**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Unattended Mode section added
- [x] Skip interview, infer criteria from steering docs
- [x] Output "Done. Awaiting orchestrator." at completion

### T002: Add Auto-Mode to Starting-Issues

**File(s)**: `plugins/nmg-sdlc/skills/start-issue/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Unattended Mode section added
- [x] Auto-select oldest issue when no argument provided
- [x] Skip selection and confirmation steps

### T003: Add Auto-Mode to Writing-Specs

**File(s)**: `plugins/nmg-sdlc/skills/write-spec/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Unattended Mode section added
- [x] All 3 review gates pre-approved
- [x] Do not call AskUserQuestion at any gate

### T004: Add Auto-Mode to Implementing-Specs

**File(s)**: `plugins/nmg-sdlc/skills/write-code/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Unattended Mode section added
- [x] Do not call EnterPlanMode (design approach internally)
- [x] All approval gates pre-approved

### T005: Add Auto-Mode to Verifying-Specs

**File(s)**: `plugins/nmg-sdlc/skills/verify-code/SKILL.md`
**Type**: Modify
**Depends**: None
**Status**: Complete
**Acceptance**:
- [x] Unattended Mode section added
- [x] All approval gates pre-approved

### T006: Add Auto-Mode to Creating-PRs

**File(s)**: `plugins/nmg-sdlc/skills/open-pr/SKILL.md`
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
- [x] All skills check `.claude/unattended-mode` consistently
- [x] All skills suppress next-step suggestions in unattended-mode
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

**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify
**Depends**: T001
**Status**: Complete
**Acceptance**:
- [x] New step added after Step 5 (Interview) and before Step 6 (Synthesize) asking "Is this issue suitable for automation?" via `AskUserQuestion` with Yes/No options
- [x] The step is clearly marked as skipped in unattended-mode (with a `> **Unattended-mode**:` note)
- [x] The user's answer is recorded for use in Step 8

**Notes**: Insert as Step 5b or renumber subsequent steps. The question uses `AskUserQuestion` with two options: "Yes — suitable for hands-off automation" and "No — requires human judgment". Keep the step concise — one question, not an explanation of automation.

### T010: Update Creating-Issues Auto-Mode to Default Automatable

**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify
**Depends**: T009
**Status**: Complete
**Acceptance**:
- [x] Unattended Mode section updated to state that the `automatable` label is applied by default in unattended-mode
- [x] No `AskUserQuestion` call for the automatable question in unattended-mode
- [x] The unattended-mode documentation bullet clearly states the default behavior

**Notes**: Add to the existing Unattended Mode section at the top of the workflow. One additional bullet: "Apply the `automatable` label automatically (skip the automatable question)."

### T011: Add Label Auto-Creation and Postcondition Check to Creating-Issues Step 8

**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
**Type**: Modify
**Depends**: T009
**Status**: Complete
**Acceptance**:
- [x] Step 8 updated to check if the `automatable` label exists before issue creation using `gh label list --search automatable --json name --jq '.[].name'`
- [x] If the label doesn't exist, it's created via `gh label create "automatable" --description "Suitable for automated SDLC processing" --color "0E8A16"`
- [x] The `--label` flag in `gh issue create` conditionally includes `automatable` based on the user's answer (or unattended-mode default)
- [x] After issue creation, a postcondition check verifies the label was applied: `gh issue view #N --json labels --jq '.labels[].name'` and confirms `automatable` is present (if intended)
- [x] If the postcondition check fails, a warning is included in the Step 9 output

**Notes**: The label auto-creation should happen in step 8's "Check labels" substep (8.1-8.2), before the `gh issue create` call. The postcondition check goes after the issue is created, before Step 9's output.

### T012: Add Automatable Label Filter to Starting-Issues Auto-Mode

**File(s)**: `plugins/nmg-sdlc/skills/start-issue/SKILL.md`
**Type**: Modify
**Depends**: T002
**Status**: Complete
**Acceptance**:
- [x] Unattended-mode `gh issue list` commands in Step 1 include `--label automatable` flag
- [x] Both milestone-filtered and non-milestone-filtered variants updated
- [x] The Unattended Mode section documents that only `automatable`-labeled issues are eligible in unattended-mode

**Notes**: Update three locations in the skill: (1) the Unattended Mode section at the top, (2) the "Zero viable milestones" fallback command, (3) the milestone-specific command. Add `--label automatable` to each `gh issue list` call used in unattended-mode only.

### T013: Add Empty-Set Handling to Starting-Issues Auto-Mode

**File(s)**: `plugins/nmg-sdlc/skills/start-issue/SKILL.md`
**Type**: Modify
**Depends**: T012
**Status**: Complete
**Acceptance**:
- [x] When the unattended-mode filtered issue list returns zero results, the skill reports "No automatable issues found in milestone [name]" (or "No automatable issues found" if no milestone)
- [x] The skill exits gracefully without attempting to select or create a branch
- [x] The output format is: `No automatable issues found. Done. Awaiting orchestrator.`
- [x] The skill does NOT fall back to selecting non-automatable issues

**Notes**: Add a conditional check after the `gh issue list` call in unattended-mode. If the JSON result is an empty array, output the message and stop. This is a new early-exit path in Step 1.

### T014: Add Automatable Indicator to Starting-Issues Interactive Mode

**File(s)**: `plugins/nmg-sdlc/skills/start-issue/SKILL.md`
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

**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`, `plugins/nmg-sdlc/skills/start-issue/SKILL.md`
**Type**: Verify
**Depends**: T009, T010, T011, T012, T013, T014
**Status**: Complete
**Acceptance**:
- [x] The label name `automatable` is consistent across both skills (no typos, no case differences)
- [x] The `gh label create` command uses the exact color `0E8A16` and description `"Suitable for automated SDLC processing"`
- [x] `/draft-issue` applies the label → `/start-issue` filters by the same label
- [x] Unattended-mode behavior is documented consistently in both skills' Unattended Mode sections

### T016: Add BDD Scenarios for Automatable Label Gate

**File(s)**: `.claude/specs/feature-automation-mode-support/feature.gherkin`
**Type**: Modify
**Depends**: T015
**Status**: Complete
**Acceptance**:
- [x] Scenarios added for AC7–AC16 (10 new scenarios)
- [x] Each scenario tagged with `# Added by issue #71` comment
- [x] Scenarios cover: interactive question, label applied, no label, unattended-mode default, filter, invisible, empty set, indicator, auto-create, postcondition

---

## Phase 5: Rename to Unattended-Mode (Issue #118)

### T017: Rename flag in `sdlc-runner.mjs`

**File(s)**: `scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Line 549: `RUNNER_ARTIFACTS` uses `.claude/unattended-mode` (not `.claude/unattended-mode`)
- [ ] Line 599: `fs.unlinkSync(path.join(PROJECT_PATH, '.claude', 'unattended-mode'))`
- [ ] Line 600: log message says `Removed .claude/unattended-mode flag`
- [ ] Line 1062: soft-failure regex pattern and label updated to `unattended-mode` (both the `/…/i` regex body and the string label)
- [ ] Line 1220 comment: updated to reference `unattended-mode`
- [ ] Lines 1869–1875: variable renamed `autoModePath` → `unattendedModePath`; path literal updated; log message says `Created .claude/unattended-mode flag`
- [ ] `grep -n "unattended-mode\|autoMode" scripts/sdlc-runner.mjs` returns zero matches

**Notes**: Exactly 8 occurrences to update per the Phase 2 audit. Keep everything else (cross-cycle state preservation logic, BENIGN_DENIED_TOOLS set) unchanged.

### T018: Rename flag in runner tests

**File(s)**: `scripts/__tests__/sdlc-runner.test.mjs`
**Type**: Modify
**Depends**: T017
**Acceptance**:
- [ ] All 16 `unattended-mode` references replaced with `unattended-mode` (paths + prose)
- [ ] `node --test scripts/__tests__/sdlc-runner.test.mjs` passes (AC23)
- [ ] `grep -n "unattended-mode\|autoMode" scripts/__tests__/sdlc-runner.test.mjs` returns zero matches

**Notes**: Tests must be updated **after** the runner change or they will fail mid-way. Run tests after this task to confirm green.

### T019: Update `.gitignore`

**File(s)**: `.gitignore`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Line 11: `.claude/unattended-mode` replaced with `.claude/unattended-mode`
- [ ] Only one change on the line — no duplicates, no stale entry

### T020: Rename flag in all plugin skills

**File(s)**:
- `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`
- `plugins/nmg-sdlc/skills/start-issue/SKILL.md`
- `plugins/nmg-sdlc/skills/write-spec/SKILL.md`
- `plugins/nmg-sdlc/skills/write-code/SKILL.md`
- `plugins/nmg-sdlc/skills/verify-code/SKILL.md`
- `plugins/nmg-sdlc/skills/open-pr/SKILL.md`
- `plugins/nmg-sdlc/skills/run-loop/SKILL.md`
- `plugins/nmg-sdlc/skills/migrate-project/SKILL.md`
- `plugins/nmg-sdlc/skills/migrate-project/references/migration-procedures.md`
- `plugins/nmg-sdlc/skills/run-retro/SKILL.md`

**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] All occurrences of `.claude/unattended-mode` → `.claude/unattended-mode` in each file
- [ ] All occurrences of "unattended-mode" / "Unattended-mode" / "unattended mode" → "unattended-mode" / "Unattended-mode" / "unattended mode" preserving case
- [ ] "Unattended Mode" section headings renamed to "Unattended Mode" in all skills
- [ ] `migrate-project` skill's active-ignore behavior preserved (still defensively ignores the flag per its original intent; only the name changes)
- [ ] `grep -rn "unattended-mode\|Unattended-mode\|unattended mode\|Unattended mode" plugins/nmg-sdlc/skills/` returns zero matches

**Notes**: Audit counts per Phase 2 addendum: draft-issue 9, start-issue 13, write-spec 10, write-code 9, verify-code 5, open-pr 3, run-loop 4, migrate-project 22, migration-procedures 1, run-retro 3 — total ~79. Use `Edit` with `replace_all=true` for the exact path literal and case-preserving prose substitutions within each file. Re-read each file after edits to confirm no stragglers.

### T021: Update `README.md` with rename and disambiguation callout

**File(s)**: `README.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] All 6 `unattended-mode` references replaced with `unattended-mode` (preserving case)
- [ ] Section heading "Unattended-mode flag" renamed to "Unattended-mode flag"
- [ ] Added a disambiguation callout near the section (per design): short paragraph contrasting this plugin's `unattended-mode` with Claude Code's native Auto Mode
- [ ] `grep -n "unattended-mode\|Unattended-mode" README.md` returns zero matches outside the disambiguation callout (where "Claude Code's Auto Mode" appears as proper-noun reference to CC's feature — this is allowed and intentional)

**Notes**: AC19 and AC25 hinge on this callout being clear. Use the exact callout text from the design's "Disambiguation Note (for README)" subsection. "Claude Code's Auto Mode" as a proper noun referring to CC's feature is preserved — only the plugin's own concept is renamed.

### T022: Update steering docs

**File(s)**: `.claude/steering/product.md`, `.claude/steering/tech.md`, `.claude/steering/structure.md`, `.claude/steering/retrospective.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] All 12 total occurrences across the four files replaced with `unattended-mode` / `Unattended-mode`
- [ ] `retrospective.md` learnings that reference prior defect specs by directory name keep the directory name unchanged (historical identifier) but rewrite the prose/path text to `unattended-mode`
- [ ] `grep -rn "unattended-mode\|Unattended-mode" .claude/steering/` returns zero matches

**Notes**: Steering docs shape future spec writing — updating them ensures new specs use the new term from the outset.

### T023: Rewrite historical spec bodies

**File(s)**: All files under `.claude/specs/*/` except the current feature spec's files (requirements.md, design.md, tasks.md, feature.gherkin, verification.md for `feature-automation-mode-support/` already amended above)
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] All body occurrences of `.claude/unattended-mode` → `.claude/unattended-mode` across all historical specs
- [ ] All body occurrences of "unattended-mode" / "Unattended-mode" / "unattended mode" → "unattended-mode" / "Unattended-mode" / "unattended mode"
- [ ] **Directory names preserved** (e.g., `bug-fix-auto-mode-cleanup-on-exit/` remains; body rewrites only)
- [ ] `feature-automation-mode-support/feature.gherkin` scenario names that reference old term are updated (T028 handles the new scenarios; this task updates the existing AC1–AC16 scenario wording for terminology consistency)
- [ ] `grep -rn "\.claude/unattended-mode" .claude/specs/` returns zero matches
- [ ] `grep -rn "unattended-mode\|Unattended-mode" .claude/specs/` returns only matches that are inside the directory-name portion of a file path in the body of a spec (e.g., `bug-fix-auto-mode-cleanup-on-exit/` referenced as a path — these are historical identifiers and intentionally kept)

**Notes**: Use a combination of `Grep -l` to list files with matches, then `Edit` with `replace_all=true` on each. The exception list is narrow: (1) directory names in file paths, (2) the CHANGELOG.md historical entries (covered separately in T024). Use care with `feature.gherkin` files — their scenario "Given" lines use the flag path as a literal test input; that literal must also be updated to `unattended-mode`. For `verification.md` files that reference runner output, update them to reflect the new log messages.

### T024: Add `[Unreleased]` entry to `CHANGELOG.md`

**File(s)**: `CHANGELOG.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] New `[Unreleased]` entry under a `### Changed` (or similar) heading documents: the rename, the motivation (disambiguation from Claude Code's native Auto Mode), and migration guidance
- [ ] Migration note explicitly states: "If you previously created `.claude/unattended-mode` manually to enable headless mode, rename or recreate it as `.claude/unattended-mode`. The runner creates the flag automatically, so users who run only via `/run-loop` do not need to take action."
- [ ] **Historical entries are NOT rewritten** — the existing 31 occurrences of `unattended-mode` in prior release sections remain verbatim as release-log history
- [ ] Entry also references issue #118 for traceability

**Notes**: Per Phase 2 design, historical CHANGELOG entries must remain unchanged. Only the new `[Unreleased]` entry uses the new terminology.

### T025: Bump plugin version

**File(s)**: `plugins/nmg-sdlc/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`
**Type**: Modify
**Depends**: T017, T018, T019, T020, T021, T022, T023, T024
**Acceptance**:
- [ ] `plugins/nmg-sdlc/.claude-plugin/plugin.json` `"version"` field bumped (minor recommended per design; confirm target at release time)
- [ ] `.claude-plugin/marketplace.json` plugin entry `"version"` bumped to match
- [ ] `metadata.version` in marketplace.json **unchanged** (collection version, not plugin version — per CLAUDE.md)
- [ ] Both files still parse as valid JSON

**Notes**: Do this at the end so the version reflects all the rename work together. Per memory: CLAUDE.md specifies both files must be bumped in lockstep.

### T026: Run runner test suite and verify pass

**File(s)**: N/A (verification)
**Type**: Verify
**Depends**: T017, T018
**Acceptance**:
- [ ] `node --test scripts/__tests__/sdlc-runner.test.mjs` exits 0 with no failures
- [ ] No test is skipped or conditionally excluded due to the rename
- [ ] Output includes a pass count consistent with pre-rename baseline

**Notes**: AC23 maps directly to this check. If this fails, fix the runner or test — do not silence.

### T027: Post-rename grep audit

**File(s)**: N/A (verification across repo)
**Type**: Verify
**Depends**: T017, T018, T019, T020, T021, T022, T023, T024, T025
**Acceptance**:
- [ ] `grep -rn "\.claude/unattended-mode" . --exclude-dir=.git --exclude-dir=node_modules --exclude=CHANGELOG.md` returns zero matches
- [ ] `grep -rn "unattended-mode\|Unattended-mode" . --exclude-dir=.git --exclude-dir=node_modules --exclude=CHANGELOG.md` returns only: (a) directory names under `.claude/specs/` (historical identifiers), (b) proper-noun references to Claude Code's "Auto Mode" feature in README disambiguation callout
- [ ] Manually spot-check the non-zero matches to confirm they are expected exceptions
- [ ] `ls .claude/unattended-mode .claude/unattended-mode 2>&1` shows neither exists locally at end of audit (both absent or only `.claude/unattended-mode` absent; no stale `.claude/unattended-mode` from dev environment)

**Notes**: This is the safety net. Any unexpected match indicates a missed file from T017–T024. The CHANGELOG is intentionally excluded because T024 preserves historical entries.

### T028: Add BDD scenarios for unattended-mode rename

**File(s)**: `.claude/specs/feature-automation-mode-support/feature.gherkin`
**Type**: Modify
**Depends**: T017, T018, T019, T020, T021, T022, T023, T024, T025
**Acceptance**:
- [ ] New scenarios added covering AC17–AC26 (10 new scenarios)
- [ ] Each new scenario tagged with `# Added by issue #118`
- [ ] Existing AC1–AC16 scenarios rewritten to reference `.claude/unattended-mode` instead of `.claude/unattended-mode` (part of T023, but re-verified here)
- [ ] Scenarios cover: flag rename (AC17), skill gate rename (AC18), CC Auto Mode disambiguation (AC19, AC25), docs updated (AC20), historical specs rewritten (AC21), CHANGELOG entry (AC22), runner tests (AC23), no regression (AC24), old name ignored (AC26)

**Notes**: The file's top comment `# File: .claude/specs/11-automation-mode-support/…` references a legacy directory name and may be updated for accuracy, but is optional (historical identifier).

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

Phase 5 (Issue #118):
T017 ──▶ T018 ──▶ T026
T019 (independent)
T020 (independent, parallel to T017/T021/T022/T023)
T021 (independent)
T022 (independent)
T023 (independent)
T024 (independent)
T017, T018, T019, T020, T021, T022, T023, T024 ──▶ T025
T017..T025 ──▶ T027 ──▶ T028

Critical path: T017 ──▶ T018 ──▶ T026/T025 ──▶ T027 ──▶ T028
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #11 | 2026-02-15 | Initial feature spec |
| #71 | 2026-02-22 | Add Phase 4: automatable label gate — 8 tasks across draft-issue and start-issue skills |
| #118 | 2026-04-16 | Add Phase 5: rename `.claude/unattended-mode` → `.claude/unattended-mode` — 12 tasks (runner, tests, gitignore, 9 skills, README + disambiguation callout, 4 steering docs, ~60 historical specs, CHANGELOG [Unreleased], version bump, test + grep verification, BDD scenarios for AC17–AC26) |

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies correctly mapped
- [x] All 6 skills modified consistently (#11)
- [x] Phase 4 tasks map to specific ACs from issue #71
- [x] File paths reference actual skill locations per structure.md
