# Tasks: Configurable Post-Step Process Cleanup

**Issue**: #24
**Date**: 2026-02-15
**Status**: Planning
**Author**: Claude (from issue by rnunley-nmg)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup | 2 | [ ] |
| Backend | 1 | [ ] |
| Integration | 3 | [ ] |
| Documentation | 2 | [ ] |
| Testing | 1 | [ ] |
| **Total** | **9** | |

---

## Phase 1: Setup

### T001: Add CLEANUP_PATTERNS config constant

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] `CLEANUP_PATTERNS` constant extracted from `config.cleanup?.processPatterns` with `[]` default
- [ ] Placed after existing config loading block (after line ~77)
- [ ] No error thrown when `cleanup` key is absent from config

### T002: Add shellEscape() helper function

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: None
**Acceptance**:
- [ ] `shellEscape()` function wraps input in single quotes with proper escaping
- [ ] Handles strings containing single quotes (e.g., `it's`)
- [ ] Placed in the "Shell helpers" section (near line ~350)

---

## Phase 2: Backend Implementation

### T003: Implement cleanupProcesses() function

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T001, T002
**Acceptance**:
- [ ] Function is a no-op when `CLEANUP_PATTERNS` is empty
- [ ] For each pattern, runs `pgrep -f` to find matching PIDs
- [ ] Filters out the runner's own PID (`process.pid`)
- [ ] Runs `pkill -f` to kill matching processes
- [ ] Logs `[CLEANUP] Killed N process(es) matching "pattern"` for each pattern with matches
- [ ] Catches `pgrep`/`pkill` exit code 1 (no matches) silently
- [ ] Catches other errors and logs a warning without throwing
- [ ] Uses `shellEscape()` for pattern arguments
- [ ] 5-second timeout on `execSync` calls
- [ ] Placed after shell helpers section, before precondition validation

---

## Phase 3: Integration

### T004: Wire cleanup into runStep() — post-step cleanup

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T003
**Acceptance**:
- [ ] `cleanupProcesses()` called after `runClaude()` returns, before the `exitCode === 0` branch
- [ ] Runs on both success and failure paths (called before the if/else)
- [ ] Does not interfere with existing step result handling
- [ ] Satisfies AC2 (post-step cleanup after every step)

### T005: Wire cleanup into escalate() — escalation cleanup

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T003
**Acceptance**:
- [ ] `cleanupProcesses()` called at the top of `escalate()`, before committing partial work
- [ ] Does not interfere with existing escalation logic
- [ ] Satisfies AC3 (cleanup runs on escalation)

### T006: Wire cleanup into handleSignal() — graceful shutdown cleanup

**File(s)**: `openclaw/scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T003
**Acceptance**:
- [ ] `cleanupProcesses()` called after killing the current subprocess, before committing work
- [ ] Does not interfere with existing signal handling or process exit
- [ ] Satisfies AC4 (cleanup runs on graceful shutdown)

---

## Phase 4: Documentation

### T007: Update sdlc-config.example.json

**File(s)**: `openclaw/scripts/sdlc-config.example.json`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] New `cleanup` object with `processPatterns` array added to the example config
- [ ] Example pattern is realistic (e.g., `--remote-debugging-port`)
- [ ] Placed at a logical position in the JSON (after `model` or `discordChannelId`)
- [ ] Valid JSON syntax

### T008: Update OpenClaw SKILL.md with cleanup config documentation

**File(s)**: `openclaw/skills/running-sdlc/SKILL.md`
**Type**: Modify
**Depends**: T007
**Acceptance**:
- [ ] New section or table row documenting `cleanup.processPatterns` config field
- [ ] Describes purpose, format, and example values
- [ ] Notes that cleanup is optional and backward-compatible

---

## Phase 5: BDD Testing (Required)

### T009: Create BDD feature file

**File(s)**: `.claude/specs/24-configurable-post-step-process-cleanup/feature.gherkin`
**Type**: Create
**Depends**: T004, T005, T006
**Acceptance**:
- [ ] All 6 acceptance criteria from requirements.md are scenarios
- [ ] Uses Given/When/Then format
- [ ] Includes both happy path and no-op (backward-compatible) scenarios
- [ ] Feature file is valid Gherkin syntax

---

## Dependency Graph

```
T001 ──┬──▶ T003 ──┬──▶ T004
       │           ├──▶ T005
T002 ──┘           └──▶ T006
                          │
T001 ──▶ T007 ──▶ T008   │
                          ▼
              T004, T005, T006 ──▶ T009
```

---

## Validation Checklist

Before moving to IMPLEMENT phase:

- [x] Each task has single responsibility
- [x] Dependencies are correctly mapped
- [x] Tasks can be completed independently (given dependencies)
- [x] Acceptance criteria are verifiable
- [x] File paths reference actual project structure (per `structure.md`)
- [x] Test tasks are included
- [x] No circular dependencies
- [x] Tasks are in logical execution order
