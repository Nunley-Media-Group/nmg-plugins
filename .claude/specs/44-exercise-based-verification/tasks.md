# Tasks: Exercise-Based Verification for Plugin Projects

**Issue**: #44
**Date**: 2026-02-16
**Status**: Planning
**Author**: Claude (from issue by rnunley-nmg)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 0 | N/A |
| Skill Implementation | 5 | [ ] |
| Report Template | 1 | [ ] |
| Integration | 1 | [ ] |
| Testing | 1 | [ ] |
| **Total** | **8** | |

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

No setup tasks — this feature modifies existing Markdown files only. No migrations, types, or new file structures needed.

---

## Phase 2: Skill Implementation

These tasks modify `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md` to add exercise-based verification as a conditional branch in Step 5.

### T001: Add Plugin Change Detection to Step 5

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Step 5 begins with a plugin change detection sub-step (5a)
- [ ] Instructions tell Claude to run `git diff main...HEAD --name-only` and check for patterns: `plugins/*/skills/*/SKILL.md`, `plugins/*/agents/*.md`
- [ ] If plugin changes detected, skill branches to exercise-based verification (sub-steps 5b–5e)
- [ ] If no plugin changes detected, existing BDD test coverage verification runs unchanged
- [ ] Detection logic is clearly documented with the file patterns it matches

**Notes**: Insert the conditional branch at the start of Step 5, before the existing BDD verification content. The existing content becomes the "else" branch. Template-only changes (without accompanying SKILL.md change) do not trigger exercise testing per Out of Scope.

### T002: Add Test Project Scaffolding Instructions

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] Sub-step 5b instructs Claude to create a temp directory using cross-platform approach
- [ ] Scaffold includes: `.claude/steering/` with minimal `product.md`, `tech.md`, `structure.md`
- [ ] Scaffold includes: `src/index.js`, `README.md`, `.gitignore`, `package.json`
- [ ] Instructions include `git init && git add -A && git commit -m "initial"`
- [ ] Temp directory path is recorded for later cleanup
- [ ] Layout matches `structure.md` → Test Project Scaffolding

**Notes**: Use `Write` tool for file creation, `Bash` for git init. Reference the minimal content from design.md section 5b.

### T003: Add Exercise Invocation Instructions (Agent SDK + Fallback)

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [ ] Sub-step 5c describes the Agent SDK invocation method (primary)
- [ ] Includes inline Node.js snippet template for Agent SDK with `canUseTool` callback
- [ ] `canUseTool` intercepts `AskUserQuestion` and auto-selects first option
- [ ] Plugin loaded via `plugins: [{ type: "local", path: ... }]`
- [ ] `workingDirectory` set to test project path
- [ ] Output captured to temp file for evaluation
- [ ] Fallback to `claude -p` with `--disallowedTools AskUserQuestion` clearly described
- [ ] Fallback notes in report that only non-interactive path was tested
- [ ] 5-minute timeout described for exercise subprocess
- [ ] For GitHub-integrated skills: dry-run prompt prepended to prevent real artifact creation

**Notes**: The Agent SDK check is done by attempting to import the module. The `claude -p` pattern follows `sdlc-runner.mjs` subprocess invocation style. Dry-run instructions prepend context to the exercise prompt telling Claude not to execute `gh` commands that create/modify/delete resources.

### T004: Add Output Evaluation and Cleanup Instructions

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md`
**Type**: Modify
**Depends**: T003
**Acceptance**:
- [ ] Sub-step 5d instructs Claude to read the captured output and evaluate against each AC from `requirements.md`
- [ ] Each AC gets a verdict: Pass / Fail / Partial with evidence
- [ ] For file-creating skills: check the test project filesystem for expected artifacts
- [ ] For GitHub-integrated skills: evaluate generated `gh` command content against ACs
- [ ] Sub-step 5e instructs cleanup: `rm -rf {test-project-path}`
- [ ] Cleanup runs regardless of exercise success or failure
- [ ] Exercise findings are fed into Step 6 (Fix Findings) like any other finding

**Notes**: Claude performs the evaluation by reasoning about AC satisfaction from the captured output. This is consistent with how Step 3 (Verify Implementation) already works.

### T005: Add Graceful Degradation Handling

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md`
**Type**: Modify
**Depends**: T003
**Acceptance**:
- [ ] If Agent SDK import fails AND `claude` CLI not found: skip exercise testing entirely
- [ ] If exercise subprocess times out (5 min): kill process and report skip
- [ ] If exercise produces an error: capture error, report as finding, continue
- [ ] All skip/failure scenarios produce a clear entry in the verification report
- [ ] Skipped exercise testing includes recommendation for manual follow-up
- [ ] Non-fatal: graceful degradation never blocks the rest of the verification workflow

**Notes**: Graceful degradation follows the same pattern as existing Step 5 — report gaps, don't block.

---

## Phase 3: Report Template

### T006: Add Exercise Test Results Section to Report Template

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/checklists/report-template.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] New "Exercise Test Results" section added after the existing "Test Coverage" section
- [ ] Section includes: skill exercised, test project path, exercise method, AskUserQuestion handling, duration
- [ ] Section includes: captured output summary, AC evaluation table (AC / Description / Verdict / Evidence)
- [ ] Section includes: notes field for observations (fallback method, dry-run mode, etc.)
- [ ] Skipped variant included: reason and manual follow-up recommendation
- [ ] Section is clearly marked as conditional ("included when exercise-based verification was performed")

**Notes**: The section template follows the format described in design.md → Report Template Extension.

---

## Phase 4: Integration

### T007: Verify Step 5 ↔ Report Template Consistency

**File(s)**: `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md`, `plugins/nmg-sdlc/skills/verifying-specs/checklists/report-template.md`
**Type**: Verify (review, no file changes expected)
**Depends**: T001, T002, T003, T004, T005, T006
**Acceptance**:
- [ ] Step 7 (Generate Verification Report) references the new Exercise Test Results section
- [ ] All data captured during sub-steps 5a–5e has a corresponding field in the report template
- [ ] The existing report sections (Test Coverage, Fixes Applied, Remaining Issues) still work with exercise findings
- [ ] Auto-mode behavior is consistent: no `AskUserQuestion` calls in the exercise path when `.claude/auto-mode` exists
- [ ] Cross-reference between Step 5 exercise output and Step 7 report generation is clear

**Notes**: This is a review task to ensure the skill and template are consistent. Make minor edits if gaps are found.

---

## Phase 5: BDD Testing

### T008: Create BDD Feature File

**File(s)**: `.claude/specs/44-exercise-based-verification/feature.gherkin`
**Type**: Create
**Depends**: T001, T006
**Acceptance**:
- [ ] All 10 acceptance criteria from requirements.md have corresponding Gherkin scenarios
- [ ] Scenarios use Given/When/Then format
- [ ] Feature file is valid Gherkin syntax
- [ ] Includes happy path (AC1–AC3), alternative paths (AC4–AC5), error handling (AC8–AC9), and edge cases (AC10)
- [ ] Scenarios are independent and self-contained

**Notes**: This feature file serves as the verification criteria for exercise-based testing of the modified `/verifying-specs` skill itself (dogfooding).

---

## Dependency Graph

```
T001 ──▶ T002 ──▶ T003 ──┬──▶ T004 ──▶ T007
                          │
                          └──▶ T005 ──▶ T007
                                        ▲
T006 ───────────────────────────────────┘

T001 ──▶ T008
T006 ──▶ T008
```

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test task is included (T008 — BDD feature file)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
