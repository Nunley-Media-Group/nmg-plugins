# Tasks: Running SDLC Loop Skill

**Issues**: #107
**Date**: 2026-02-25
**Status**: Planning
**Author**: Claude Code

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Runner Enhancement | 3 (T001–T003) | [ ] |
| Skill Creation | 2 (T004–T005) | [ ] |
| Integration & Docs | 2 (T006–T007) | [ ] |
| Testing | 2 (T008–T009) | [ ] |
| **Total** | **9** | |

---

## Phase 1: Runner Enhancement

### T001: Add `--issue` CLI Flag Parsing and Validation

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] `--issue` option added to `parseArgs` options as `{ type: 'string' }`
- [ ] Parsed value stored in module-level `SINGLE_ISSUE_NUMBER` variable (null when not provided, integer when provided)
- [ ] Invalid values (non-numeric, zero, negative) produce a clear error and `process.exit(1)`
- [ ] `--help` output updated to include `--issue <N>` with description: "Process only issue #N then exit (single-cycle mode)"
- [ ] Startup log includes `Single issue mode: #N` when flag is provided
- [ ] `SINGLE_ISSUE_NUMBER` is accessible in test helpers (`__test__` export)

**Notes**: Follow the existing pattern for `SINGLE_STEP` and `RESUME` — module-level variable, parsed inside the `isMainModule` guard, exposed via `__test__`.

### T002: Modify Step 2 Prompt for Targeted Issue Selection

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] When `SINGLE_ISSUE_NUMBER` is set, step 2 prompt is: `"Start issue #N. Create a linked feature branch and set the issue to In Progress. Skill instructions are appended to your system prompt. Resolve relative file references from ${skillRoot}/."` (where N is the issue number)
- [ ] When `SINGLE_ISSUE_NUMBER` is null, step 2 prompt is unchanged from current behavior
- [ ] The escalated issues exclusion list is NOT appended to the prompt when `SINGLE_ISSUE_NUMBER` is set (not applicable for single-issue mode)

**Notes**: Modify the `prompts` object in `buildClaudeArgs()`. The step 2 prompt is at `prompts[2]`.

### T003: Add Single-Cycle Exit and Escalation Behavior

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] After step 9 succeeds with `SINGLE_ISSUE_NUMBER` set: log completion message, call `removeAutoMode()`, break from main loop, exit with code 0
- [ ] On escalation with `SINGLE_ISSUE_NUMBER` set: log escalation, call `removeAutoMode()`, exit with code 1 (do not loop to next issue)
- [ ] `hasOpenIssues()` and `hasNonEscalatedIssues()` checks at top of main loop are skipped when `SINGLE_ISSUE_NUMBER` is set (the specific issue's existence is validated by step 2)
- [ ] Post-step-2 escalated issue safety check is skipped when `SINGLE_ISSUE_NUMBER` is set (user explicitly chose this issue)

**Notes**: The exit after step 9 should be in the main loop's `for` block, after the `extractStateFromStep` call succeeds. The escalation exit should be in the `escalate()` function. Guard the `hasOpenIssues`/`hasNonEscalatedIssues` checks and the post-step-2 safety check with `if (!SINGLE_ISSUE_NUMBER)`.

---

## Phase 2: Skill Creation

### T004: Create `running-sdlc-loop/SKILL.md`

**File(s)**: `plugins/nmg-sdlc/skills/running-sdlc-loop/SKILL.md`
**Type**: Create
**Depends**: T001, T002, T003
**Acceptance**:
- [ ] SKILL.md has correct YAML frontmatter: `name`, `description`, `argument-hint`, `model: sonnet`, `allowed-tools`
- [ ] Skill handles argument parsing: no argument = loop mode, `#N` or `N` = single-issue mode
- [ ] Step 1: Checks for `sdlc-config.json` at project root; if missing, invokes `Skill("nmg-sdlc:generating-openclaw-config")` to create it
- [ ] Step 2: Reads config to extract `pluginsPath`; derives runner path as `<pluginsPath>/openclaw/scripts/sdlc-runner.mjs`; verifies runner exists
- [ ] Step 3: Builds and executes command: `CLAUDECODE="" node <runner-path> --config <config-path>` (loop mode) or `CLAUDECODE="" node <runner-path> --config <config-path> --issue N` (single-issue mode)
- [ ] Step 4: Reports runner output, exit code, and log path
- [ ] Includes auto-mode section noting the runner creates/removes `.claude/auto-mode` automatically
- [ ] Includes "Integration with SDLC Workflow" section
- [ ] Cross-platform: uses POSIX-compatible commands only
- [ ] References the OpenClaw `running-sdlc` skill pattern for log tailing

**Notes**: Follow structure patterns from existing skills (e.g., `starting-issues/SKILL.md`). The OpenClaw `running-sdlc/SKILL.md` is the primary reference for runner invocation, path resolution, and log handling. The key differences: (1) `CLAUDECODE=""` prefix, (2) `--issue N` flag support, (3) no Discord channel resolution, (4) no `nohup` (runs in foreground, blocking until complete or Bash timeout).

### T005: Validate SKILL.md with `/doing-skills-right`

**File(s)**: `plugins/nmg-sdlc/skills/running-sdlc-loop/SKILL.md`
**Type**: Verify
**Depends**: T004
**Acceptance**:
- [ ] `/doing-skills-right` run against the SKILL.md produces no critical findings
- [ ] All required structural elements present: frontmatter, allowed-tools, auto-mode section, integration section
- [ ] Any findings from the review are addressed by editing SKILL.md

**Notes**: This is AC5 from requirements.md. The implementer MUST run `/doing-skills-right` and fix any issues before proceeding.

---

## Phase 3: Integration & Documentation

### T006: Update README.md

**File(s)**: `README.md`
**Type**: Modify
**Depends**: T004
**Acceptance**:
- [ ] New skill listed in the Skills Reference section
- [ ] Description matches the skill's purpose (run full SDLC pipeline from within Claude Code)
- [ ] Usage examples for both loop mode and single-issue mode
- [ ] Differentiation from the OpenClaw `running-sdlc` skill explained

### T007: Update CHANGELOG.md

**File(s)**: `CHANGELOG.md`
**Type**: Modify
**Depends**: T004, T001
**Acceptance**:
- [ ] Entry added under `[Unreleased]` section
- [ ] Entry describes both changes: new skill + runner `--issue` flag
- [ ] Follows conventional commit style in the changelog entry

---

## Phase 4: Testing

### T008: Add Unit Tests for `--issue` Flag

**File(s)**: `openclaw/scripts/__tests__/sdlc-runner.test.mjs`
**Type**: Modify
**Depends**: T001, T002, T003
**Acceptance**:
- [ ] Test: `--issue` flag is parsed correctly as integer from CLI args
- [ ] Test: Invalid `--issue` values (non-numeric, zero, negative) produce errors
- [ ] Test: Step 2 prompt includes specific issue number when `SINGLE_ISSUE_NUMBER` is set
- [ ] Test: Step 2 prompt uses default (select next automatable) when `SINGLE_ISSUE_NUMBER` is null
- [ ] Test: Escalated issue exclusion is NOT included in step 2 prompt when `SINGLE_ISSUE_NUMBER` is set
- [ ] All existing tests continue to pass (no regressions)

**Notes**: Follow existing test patterns in the test file. Use `__test__.setConfig()` to configure state. Mock `buildClaudeArgs` calls to verify prompt content.

### T009: Create BDD Feature File

**File(s)**: `.claude/specs/feature-add-skill-to-run-full-sdlc-pipeline-loop-from-within-claude-code/feature.gherkin`
**Type**: Create
**Depends**: T004
**Acceptance**:
- [ ] All 8 acceptance criteria from requirements.md have corresponding scenarios
- [ ] Scenarios use Given/When/Then format
- [ ] Feature file is valid Gherkin syntax
- [ ] Scenarios are independent and self-contained

---

## Dependency Graph

```
T001 ──┬──▶ T002
       │
       ├──▶ T003
       │
       └──┬─▶ T008
          │
T001+T002+T003 ──▶ T004 ──┬──▶ T005
                           │
                           ├──▶ T006
                           │
                           ├──▶ T007
                           │
                           └──▶ T009
```

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #107 | 2026-02-25 | Initial feature spec |

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test tasks are included (T005, T008, T009)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
