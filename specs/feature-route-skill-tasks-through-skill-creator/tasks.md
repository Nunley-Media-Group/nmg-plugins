# Tasks: Route Skill Creation and Update Tasks Through /skill-creator

**Issues**: #141
**Date**: 2026-04-19
**Status**: Planning
**Author**: Rich Nunley

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 1 | [ ] |
| Backend | 3 | [ ] |
| Frontend | 0 | [ ] |
| Integration | 2 | [ ] |
| Testing | 3 | [ ] |
| **Total** | **9** | |

**Note on phasing**: This is a prompt-engineering change across three Markdown files. The "Backend" phase here means *authoring the detector + probe + routing blocks into each pipeline component's Markdown*. There are no frontend components. The "Testing" phase is exercise-based per `steering/tech.md`.

---

## Phase 1: Setup

### T001: Confirm /skill-creator Invocation Contract

**File(s)**: N/A (research task)
**Type**: Research
**Depends**: None
**Acceptance**:
- [ ] Read `/skill-creator` skill definition (wherever installed — `~/.claude/plugins/**/skills/skill-creator/SKILL.md` or similar)
- [ ] Document the expected invocation shape (argument format, whether it handles create vs. edit, what context it accepts)
- [ ] Capture the contract in a short note in this tasks file under Notes, so downstream tasks can reference it consistently

**Notes**: Goal is to ensure the three routing blocks in T002–T004 pass the same arguments the same way. If `/skill-creator` is not installed anywhere on the current system, read its online documentation or treat the invocation as a prompt-based handoff (same shape as `/simplify`).

---

## Phase 2: Backend (Prompt Authoring)

### T002: Add Detector, Probe, and Routing to write-code SKILL.md

**File(s)**: `plugins/nmg-sdlc/skills/write-code/SKILL.md`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] A new numbered sub-step (e.g., Step 5a or inserted before current Step 5b Simplify Pass) defines the SKILL-TASK DETECTOR with the three signals from design.md
- [ ] The SKILL-CREATOR PROBE block mirrors the structure of the existing simplify probe in Step 5b (three checks, available/unavailable branches)
- [ ] Routing logic is wired into both Step 5 (delegated path via Task tool to spec-implementer) and the inline-fallback sub-section under Step 5
- [ ] When available, `/skill-creator` is invoked for detected tasks with task context + target path + existing content (when editing)
- [ ] When unavailable, the verbatim warning `skill-creator not available — implementing skill directly` is emitted in a fenced code block
- [ ] Unattended-mode behaviour is preserved — no new `AskUserQuestion` calls added
- [ ] Probe result is cached per run (single emission of warning when multiple skill tasks exist)

**Notes**: Place the detector+probe blocks near the existing simplify probe for visual consistency. Keep wording parallel to the simplify block so a diff review can confirm structural equivalence.

### T003: Add Detector, Probe, and Routing to spec-implementer Agent

**File(s)**: `plugins/nmg-sdlc/agents/spec-implementer.md`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] `Execution Process` step 3 gains sub-steps for detection and routing, OR a new step is added before step 3 that classifies tasks
- [ ] The SKILL-TASK DETECTOR uses the same three signals as T002
- [ ] The SKILL-CREATOR PROBE uses the same three checks as T002
- [ ] Routing logic invokes `/skill-creator` when available; falls back to `Write`/`Edit` with the verbatim warning when unavailable
- [ ] The `Implementation Rules` section is updated so the "Do NOT call EnterPlanMode" rule is joined by a new rule: "Skill tasks must be routed through `/skill-creator` when available"
- [ ] The agent's `tools` frontmatter does not need changes (Skill invocation is inherent to skills running inside Claude Code sessions)

**Notes**: The agent runs in a headless subagent context. Confirm the Skill tool (or equivalent `/skill-creator` invocation mechanism) is reachable from subagent context; if not, document the constraint and have the agent fall back to direct authoring with the warning — this is still better than hand-authored skills from the inline path.

### T004: Add Detector, Probe, and Routing to verify-code Step 6a

**File(s)**: `plugins/nmg-sdlc/skills/verify-code/SKILL.md`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] Step 6a (Prioritize and Fix) gains a pre-fix classification: findings whose affected file matches the detector are marked as skill findings
- [ ] For skill findings, the SKILL-CREATOR PROBE runs (cached per verify-code run)
- [ ] When available, the fix is applied via `/skill-creator` invocation (passing finding details, existing file content, target path) instead of `Write`/`Edit`
- [ ] When unavailable, verbatim warning emitted and direct `Write`/`Edit` fix proceeds
- [ ] Step 6a-bis Simplify After Fix is unaffected — its probe and logic remain as today
- [ ] The verification report's "Fixes Applied" table gains a column or note indicating the routing path taken (skill-creator vs. direct) so reviewers can see the invariant was honored

**Notes**: Place the detector+probe blocks above the existing simplify probe (6a-bis) for logical ordering — detection runs *during* 6a, not after. Do not change the report schema dramatically; a single column add or a suffix on the "Fix" cell is sufficient.

---

## Phase 3: Frontend

*Not applicable — this feature has no UI changes.*

---

## Phase 4: Integration

### T005: Cross-File Consistency Check

**File(s)**: `plugins/nmg-sdlc/skills/write-code/SKILL.md`, `plugins/nmg-sdlc/skills/verify-code/SKILL.md`, `plugins/nmg-sdlc/agents/spec-implementer.md`
**Type**: Modify
**Depends**: T002, T003, T004
**Acceptance**:
- [ ] The SKILL-TASK DETECTOR wording (signal list) is identical across the three files
- [ ] The SKILL-CREATOR PROBE wording (three checks) is identical across the three files
- [ ] The verbatim warning string matches exactly: `skill-creator not available — implementing skill directly`
- [ ] The warning is always presented in a fenced code block (matching simplify-probe precedent)
- [ ] A grep for the warning string returns exactly three hits (one per file)

**Notes**: This is a final polish pass to ensure the three copies stay in sync. Use `Grep` with `output_mode: content` to diff wording. Alternative C in design.md (inline copies) is explicit about this maintenance cost; this task formalizes the sync check.

### T006: Update CHANGELOG

**File(s)**: `CHANGELOG.md`
**Type**: Modify
**Depends**: T002, T003, T004
**Acceptance**:
- [ ] A new bullet appears under `[Unreleased]` describing the feature at a user-visible level (e.g., "feat: route skill creation/update tasks through /skill-creator")
- [ ] Entry references issue #141
- [ ] CHANGELOG conventions preserved (format, section ordering)

**Notes**: Do not bump plugin.json or marketplace.json versions — that is `/open-pr`'s responsibility per `steering/tech.md`.

---

## Phase 5: BDD Testing (Required)

**Every acceptance criterion MUST have a Gherkin test.** Testing is exercise-based per `steering/tech.md` — Gherkin scenarios enumerate what to exercise against a disposable test project.

### T007: Write BDD Feature File

**File(s)**: `specs/feature-route-skill-tasks-through-skill-creator/feature.gherkin`
**Type**: Create
**Depends**: T002, T003, T004
**Acceptance**:
- [ ] All eight acceptance criteria (AC1–AC8) from requirements.md are represented as scenarios
- [ ] Scenarios use Given/When/Then format
- [ ] Error/degradation scenarios (AC5, AC7) are present
- [ ] Edge-case scenarios (AC6 conservative false-positive, AC8 unattended mode) are present
- [ ] Feature file is valid Gherkin syntax

**Notes**: This task's output file is authored as part of the spec phase — mark acceptance complete when the file matches requirements.md's ACs.

### T008: Exercise-Test Routing Against Test Project With /skill-creator Installed

**File(s)**: N/A (exercise run; no file artifact required beyond the verification report)
**Type**: Verify
**Depends**: T002, T003, T004, T007
**Acceptance**:
- [ ] A disposable test project is scaffolded per `steering/structure.md` → "Test Project Scaffolding"
- [ ] The test project includes (or has access to) `/skill-creator`
- [ ] Seed a skill task in the test project's `tasks.md` (one targeting `SKILL.md`)
- [ ] Run `/nmg-sdlc:write-code` against it; confirm `/skill-creator` is invoked (check transcript for invocation, confirm target SKILL.md exists after run)
- [ ] Repeat for `/nmg-sdlc:verify-code` after seeding a `SKILL.md` finding
- [ ] Repeat via the agent path (non-unattended mode, which delegates to spec-implementer)
- [ ] Confirm non-skill tasks still use direct `Write`/`Edit` (AC7)

**Notes**: Use the Agent SDK approach from `steering/tech.md` if `AskUserQuestion` gates interfere with automated exercise. Otherwise `claude -p` with `--disallowedTools AskUserQuestion` is sufficient for smoke coverage.

### T009: Exercise-Test Graceful Degradation Without /skill-creator

**File(s)**: N/A (exercise run)
**Type**: Verify
**Depends**: T008
**Acceptance**:
- [ ] Repeat the T008 exercise in a test project that does NOT have `/skill-creator` installed (no matching user skill, no matching plugin skill)
- [ ] Confirm the verbatim warning `skill-creator not available — implementing skill directly` appears in the transcript for each of the three components (write-code, spec-implementer, verify-code) when it processes a skill task
- [ ] Confirm the fallback `Write`/`Edit` produces the expected `SKILL.md` output
- [ ] Confirm no pipeline failure occurs — the skill run completes normally

**Notes**: The two-project approach (with and without `/skill-creator`) directly exercises AC2 vs AC5. Retain transcript evidence in the verification report per `steering/tech.md` → Dry-Run Evaluation guidance.

---

## Dependency Graph

```
T001 ──┬──▶ T002 ──┐
       ├──▶ T003 ──┼──▶ T005 ──▶ T006
       └──▶ T004 ──┘     │
                          └──▶ T007 ──▶ T008 ──▶ T009
```

T002, T003, T004 can be executed in parallel once T001 completes.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #141 | 2026-04-19 | Initial feature tasks |

---

## Validation Checklist

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test tasks are included for each layer (exercise tests per tech.md)
- [x] No circular dependencies
- [x] Tasks are in logical execution order
