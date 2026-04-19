# Tasks: Add /simplify Step to SDLC Pipeline

**Issues**: #140
**Date**: 2026-04-19
**Status**: Planning
**Author**: Rich Nunley

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup (probe contract docs) | 1 | [ ] |
| Skill updates (write-code, verify-code) | 2 | [ ] |
| Runner & config updates | 3 | [ ] |
| Documentation updates | 3 | [ ] |
| Testing (BDD + runner unit) | 2 | [ ] |
| **Total** | **11** | |

---

## Phase 1: Setup

### T001: Document the simplify-skill probe pattern in shared location

**File(s)**: `plugins/nmg-sdlc/skills/write-code/SKILL.md` (inline), `plugins/nmg-sdlc/skills/verify-code/SKILL.md` (inline)
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Probe pattern documented identically in both skills
- [ ] Probe instruction lists both filesystem lookups (`~/.claude/skills/simplify/SKILL.md`, `~/.claude/plugins/**/skills/simplify/SKILL.md`) and the system-reminder available-skills list
- [ ] Warning string `simplify skill not available — skipping simplification pass` defined verbatim and reused at every call site

**Notes**: This is a documentation-only setup task — the probe is a prompt instruction, not new code. Defining it once in each skill avoids drift.

---

## Phase 2: Skill Updates

### T002: Update write-code SKILL.md to invoke /simplify before signalling completion

**File(s)**: `plugins/nmg-sdlc/skills/write-code/SKILL.md`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] New sub-step "5b: Simplify Pass" inserted between Step 5 (Execute Tasks) and Step 6 (Signal Completion)
- [ ] Sub-step includes the probe-and-skip instruction from T001
- [ ] Existing Step 6 output text moves AFTER the simplify pass and only emits when simplify either ran successfully or was gracefully skipped
- [ ] `## Integration with SDLC Workflow` diagram updated to show `/write-code → /simplify → /verify-code`
- [ ] Unattended-mode behaviour explicitly preserved (no `AskUserQuestion` introduced)

### T003: Update verify-code SKILL.md to re-run /simplify after fix application

**File(s)**: `plugins/nmg-sdlc/skills/verify-code/SKILL.md`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] New sub-step "6a-bis: Simplify After Fix" inserted between Step 6a (Prioritize and Fix) and Step 6b (Run Tests After Fixes)
- [ ] Sub-step uses the probe-and-skip pattern from T001
- [ ] Sub-step runs only when at least one fix was actually applied in 6a (no-op otherwise to avoid an unnecessary Claude turn)
- [ ] `## Integration with SDLC Workflow` diagram updated to show `/write-code → /simplify → /verify-code`
- [ ] Unattended-mode behaviour preserved

---

## Phase 3: Runner & Config Updates

### T004: Insert `simplify` into STEP_KEYS in sdlc-runner.mjs

**File(s)**: `scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None (parallel-safe with T002, T003)
**Acceptance**:
- [ ] `STEP_KEYS` array contains `'simplify'` at index 4 (between `'implement'` and `'verify'`)
- [ ] `STEPS` and `STEP_NUMBER` derive correctly (already auto-derived — no manual change needed)
- [ ] `prompts` object in `buildClaudeArgs` adds entry for the new step number 5 with the probe-and-skip prompt from design.md
- [ ] All previously-existing prompt entries renumber: verify=6, commitPush=7, createPR=8, monitorCI=9, merge=10
- [ ] Switch statements in precondition checks (`case 5:` etc.) renumber alongside; verify case is now `case 6`, etc.
- [ ] Audit comments mentioning "Step N" — update where the referenced step has shifted; this includes the comment block around `case 5: { // Verify ...`, the `Step 4` comment in the auto-commit path (line ~1972), and any others surfaced by `grep -nE "[Ss]tep ?[5-9]"` in the file
- [ ] No literal step numbers used in code paths that should reference symbolic step keys — replace with `STEP_NUMBER.<key>` where appropriate
- [ ] New step has no precondition (returns `{ ok: true }`) — implement this default so step transitions don't bounce back to implement on simplify

**Notes**: Reference design.md "State Management" section for the renumbering table. The simplify step has no git-observable artifact (similar to verify), so its precondition mirrors verify's lightweight checks (or simply returns ok).

### T005: Add `simplify` entry to sdlc-config.example.json

**File(s)**: `scripts/sdlc-config.example.json`
**Type**: Modify
**Depends**: T004
**Acceptance**:
- [ ] New `simplify` entry placed between `implement` and `verify`:
  ```json
  "simplify":     { "model": "sonnet", "effort": "medium", "maxTurns": 60,  "timeoutMin": 15 }
  ```
- [ ] No `skill` field set — runner uses the prompt-only path (no `--append-system-prompt`) since simplify is an external skill, not part of nmg-sdlc
- [ ] JSON remains valid (no trailing commas; 2-space indent matches existing entries)

### T006: Update runner step prompt for simplify (probe-and-skip)

**File(s)**: `scripts/sdlc-runner.mjs` (within `buildClaudeArgs.prompts`)
**Type**: Modify (subset of T004 if combined; tracked separately for clarity)
**Depends**: T004
**Acceptance**:
- [ ] `prompts[5]` returns the probe-and-skip prompt template from design.md (Probe Contract → "New Runner Prompt")
- [ ] Prompt explicitly tells Claude to exit 0 on the skip path (so the runner treats it as success)
- [ ] Prompt references `git diff main...HEAD --name-only` for the changed-files list
- [ ] Warning string in the prompt matches FR3 verbatim

---

## Phase 4: Documentation Updates

### T007: Update README pipeline diagram and skill table

**File(s)**: `README.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Pipeline diagram (currently `/onboard-project → /draft-issue → /start-issue → /write-spec → /write-code → /verify-code → /open-pr`) updated to insert `/simplify` between `/write-code` and `/verify-code`
- [ ] If the SDLC Skills table includes a row about simplify integration, it notes that simplify is an optional external skill; no row is added FOR `/simplify` itself (it lives in another marketplace)
- [ ] Any prose mentioning the `/write-code → /verify-code` adjacency is updated

### T008: Update Integration sections in remaining pipeline skills

**File(s)**: `plugins/nmg-sdlc/skills/draft-issue/SKILL.md`, `plugins/nmg-sdlc/skills/start-issue/SKILL.md`, `plugins/nmg-sdlc/skills/write-spec/SKILL.md`, `plugins/nmg-sdlc/skills/open-pr/SKILL.md`, `plugins/nmg-sdlc/skills/run-retro/SKILL.md` (if it includes a pipeline diagram)
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Every `## Integration with SDLC Workflow` block in pipeline skills shows `/write-code → /simplify → /verify-code`
- [ ] No skill's `## Integration with SDLC Workflow` block omits the new step
- [ ] Final verification: `grep -rn "/write-code" plugins/nmg-sdlc/skills/*/SKILL.md` shows every diagram is followed by `/simplify` before `/verify-code`

### T009: Add CHANGELOG entry under [Unreleased]

**File(s)**: `CHANGELOG.md`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] Entry added under `## [Unreleased]` describing the new pipeline step
- [ ] Entry notes the graceful-degradation behaviour (no failure when simplify is absent)
- [ ] Entry references issue #140
- [ ] Section heading style matches existing entries (e.g., `### Added`, `### Changed`)

---

## Phase 5: Testing

### T010: Update runner unit tests for new STEP_KEYS

**File(s)**: `scripts/__tests__/sdlc-runner.test.mjs`
**Type**: Modify
**Depends**: T004
**Acceptance**:
- [ ] `describe('STEP_KEYS and STEPS', ...)` block updated to expect length 10
- [ ] Index assertion checks `simplify` at index 4
- [ ] `STEP_KEYS.toEqual([...])` literal updated to include `'simplify'` in the correct position
- [ ] Existing test "STEP_KEYS does not contain draftIssue" still passes (no change needed — sanity-check after edit)
- [ ] New test: `STEP_NUMBER.simplify === 5` and `STEP_NUMBER.verify === 6` (and the cascade through merge=10)
- [ ] All tests pass: `cd scripts && npm test` exits 0

### T011: Create BDD feature file with all 5 ACs as scenarios

**File(s)**: `specs/feature-add-simplify-step-to-sdlc-pipeline/feature.gherkin`
**Type**: Create
**Depends**: T002, T003, T004
**Acceptance**:
- [ ] All 5 acceptance criteria from `requirements.md` represented as scenarios
- [ ] File uses valid Gherkin syntax
- [ ] Scenarios are independent (no shared mutable state)
- [ ] Scenarios use concrete examples (not "foo"/"bar")
- [ ] Header comment links back to `specs/feature-add-simplify-step-to-sdlc-pipeline/requirements.md` and issue #140

---

## Dependency Graph

```
T001 ─┬─▶ T002 ─┐
      └─▶ T003 ─┤
                ├─▶ T011
T004 ──▶ T005   │
  │             │
  └─▶ T006 ─────┤
  └─▶ T010      │
                │
T007 ───────────┤
T008 ───────────┤
T009 ───────────┘
```

Critical path: **T001 → T002 → T011** (longest chain at 3 tasks).

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #140 | 2026-04-19 | Initial task breakdown |

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test tasks are included (T010, T011)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
