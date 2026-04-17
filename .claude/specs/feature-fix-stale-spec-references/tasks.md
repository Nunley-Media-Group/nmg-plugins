# Tasks: Fix Stale Spec References

**Issues**: #114
**Date**: 2026-04-16
**Status**: Planning
**Author**: Rich Nunley

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Setup (Inventory) | 1 | [ ] |
| Runner Code Change | 3 | [ ] |
| Spec Mechanical Pass | 2 | [ ] |
| Spec Semantic Pass | 5 | [ ] |
| Integration (CHANGELOG) | 1 | [ ] |
| Testing (Verification) | 2 | [ ] |
| **Total** | **14 tasks** | |

*Note: This feature mixes documentation and a small code change. The standard 5-phase breakdown is adapted — "Setup" becomes inventory; "Backend" becomes the runner code change; "Frontend" becomes the two spec-cleanup passes; "Integration" is the CHANGELOG entry; "Testing" is the grep sweep and Jest run.*

---

## Phase 1: Setup (Inventory)

### T001: Capture baseline drift inventory

**File(s)**: `.claude/specs/feature-fix-stale-spec-references/inventory.txt` (scratch — not committed)
**Type**: Create (local-only)
**Depends**: None
**Acceptance**:
- [ ] Grep each AC8 pattern against `.claude/specs/` (excluding this spec's own dir) and record file paths + match counts
- [ ] Record the list of `postDiscord` call sites in `scripts/sdlc-runner.mjs` with line numbers
- [ ] The inventory is used to confirm coverage during T013 verification; it does not need to be committed

**Notes**: Use `Grep` with `output_mode: "content"` and `-n: true` for each pattern. Store results locally for reference while editing.

---

## Phase 2: Runner Code Change (FR8)

### T002: Remove `postDiscord()` and inline call sites in `sdlc-runner.mjs`

**File(s)**: `scripts/sdlc-runner.mjs`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] `async function postDiscord(message)` definition at line ~456 is deleted (including its 3-line body)
- [ ] All 21 call sites are rewritten from `await postDiscord(msg)` to `log(\`[STATUS] ${msg}\`)`
- [ ] The SIGTERM fire-and-forget call at line ~1688 becomes a plain `log('[STATUS] …')` with no `.catch()` chain
- [ ] The `postDiscord` entry in the module's export object (line ~2124) is removed
- [ ] `grep -n postDiscord scripts/sdlc-runner.mjs` returns zero matches
- [ ] File still parses as valid JS (no `node --check` errors)

**Notes**: Per design.md, the `[STATUS]` prefix must be preserved at each call site. For the dedup opportunity at line 1132–1133, keep both log lines if in doubt — behavioral parity wins over code aesthetics.

### T003: Update runner Jest tests for `postDiscord` removal

**File(s)**: `scripts/__tests__/sdlc-runner.test.mjs`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [ ] The "F2: postDiscord is a log-only wrapper" describe block (lines ~1382–1385) is deleted
- [ ] The "handleSignal source does not await postDiscord" assertion (lines ~2059–2063) is either deleted or rewritten to assert that `handleSignal` source does not `await log(` — preserving the original non-blocking-in-signal-handler intent
- [ ] `grep -n postDiscord scripts/__tests__/sdlc-runner.test.mjs` returns zero matches
- [ ] Jest still finds and imports runner exports correctly (no `undefined` reference errors)

### T004: Run Jest suite and confirm green

**File(s)**: none (verification only)
**Type**: Verify
**Depends**: T002, T003
**Acceptance**:
- [ ] `cd scripts && npm test` exits 0
- [ ] No test failures or new skipped tests compared to baseline

---

## Phase 3: Spec Mechanical Pass

### T005: Replace `openclaw/scripts/` with `scripts/` across specs

**File(s)**: ~25 spec files under `.claude/specs/feature-*/**` and `.claude/specs/bug-*/**`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] Apply rules M1–M4 from design.md in order (specific paths first, catch-all last)
- [ ] For each affected file, use `Edit` with `replace_all: true`
- [ ] After this task, `grep -r 'openclaw/scripts/' .claude/specs/` returns zero matches
- [ ] Spot-check 3 files: the surrounding prose still reads coherently

### T006: Replace `generating-openclaw-config` with `init-config` across specs

**File(s)**: 9 spec files identified in design.md S1
**Type**: Modify
**Depends**: T005
**Acceptance**:
- [ ] Use `Edit` with `replace_all: true` for each affected file
- [ ] After this task, `grep -r 'generating-openclaw-config' .claude/specs/` returns zero matches
- [ ] Spot-check: surrounding prose references to the skill name still read coherently ("the `init-config` skill…" is grammatical)

---

## Phase 4: Spec Semantic Pass

### T007: Remove `installing-openclaw-skill` references

**File(s)**: `feature-per-step-model-effort-config/{design.md,feature.gherkin,tasks.md}`, `feature-migrate-project-skill/{requirements.md,design.md,feature.gherkin}`, `bug-opus-rate-limits/{requirements.md,feature.gherkin,tasks.md}`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] Per design.md S1 strategy: remove list entries, delete install-skill-specific ACs/scenarios, rewrite narrative prose
- [ ] After this task, `grep -r 'installing-openclaw-skill' .claude/specs/` returns zero matches
- [ ] Every affected paragraph reads coherently after the removal (no dangling "like , " clauses)

### T008: Remove Discord references and rewrite dependent ACs

**File(s)**: `bug-sdlc-runner-edge-case-fixes/`, `bug-text-pattern-soft-failure-detection-sdlc-runner/`, `feature-migrate-project-skill/feature.gherkin`, `bug-fix-silent-commitpush-failure/`, `bug-add-auto-mode-support-to-migrate-project-skill/`, `feature-add-skill-to-run-full-sdlc-pipeline-loop-from-within-claude-code/requirements.md`, `feature-run-retro-skill/feature.gherkin`, `bug-detect-soft-failures-runner-tests/`, `bug-opus-rate-limits/`, and any other spec with a Discord mention per T001 inventory
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] Replace behavioral descriptions: "Discord posting" / "posts to Discord" → "status notification to the orchestration log"
- [ ] Replace `postDiscord()` references in specs → describe the current `log()` call directly
- [ ] Remove `discordChannelId` references entirely (the field no longer exists in config)
- [ ] For `bug-sdlc-runner-edge-case-fixes/` F2 section: preserve structure, rewrite to note the fix was applied (non-blocking sleep) without naming Discord
- [ ] Delete `feature-migrate-project-skill/feature.gherkin:64` Discord-channel-preservation scenario
- [ ] After this task: `grep -r 'postDiscord\|discordChannelId' .claude/specs/` returns zero matches; `grep -r -i 'discord' .claude/specs/` returns zero matches outside this spec's own directory

### T009: Remove `~/.openclaw/` and gateway-restart references

**File(s)**: `feature-installing-locally-skill/{design.md,feature.gherkin,verification.md,tasks.md}`, `feature-migrate-project-skill/{requirements.md,feature.gherkin}`
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] Remove Steps 5 (Copy OpenClaw skill files) and 6 (Restart OpenClaw gateway) from installation-locally workflow diagrams
- [ ] Renumber subsequent steps and update scenario/AC counts accordingly
- [ ] Remove `~/.openclaw/` from architecture diagrams (e.g., `feature-installing-locally-skill/design.md:37`)
- [ ] Delete gherkin scenarios that test OpenClaw skill sync or gateway restart (e.g., `feature-installing-locally-skill/feature.gherkin:21–29`)
- [ ] Delete AC6/AC7 in `feature-migrate-project-skill/requirements.md` (check `~/.openclaw/` and `/installing-openclaw-skill`) and the corresponding scenarios
- [ ] Update `feature-installing-locally-skill/verification.md:33` AC3 to reflect the current workflow (no OpenClaw sync)
- [ ] After this task: `grep -r '~/\.openclaw/' .claude/specs/` returns zero matches

### T010: Redirect `feature-openclaw-runner-operations` references

**File(s)**: `bug-fix-write-spec-defect-related-spec-search/requirements.md` (lines ~8, 57, 66, 68, 102, 103), `bug-text-pattern-soft-failure-detection-sdlc-runner/requirements.md` (line ~8)
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] Replace each occurrence of `feature-openclaw-runner-operations` with `feature-add-skill-to-run-full-sdlc-pipeline-loop-from-within-claude-code`
- [ ] Confirm the redirect target exists: `.claude/specs/feature-add-skill-to-run-full-sdlc-pipeline-loop-from-within-claude-code/requirements.md` is present
- [ ] Read each rewritten sentence and confirm the surrounding prose still reads correctly
- [ ] After this task: `grep -r 'feature-openclaw-runner-operations' .claude/specs/` returns zero matches

### T011: Update automatic major-version bump language

**File(s)**: `bug-fix-inconsistent-version-bumping/{requirements.md,design.md,tasks.md}` and any other spec identified by T001 inventory that describes milestone-triggered automatic major bumps
**Type**: Modify
**Depends**: T001
**Acceptance**:
- [ ] Locate passages describing "milestone completion triggers major version bump" or "last issue in milestone → major"
- [ ] Rewrite to describe the v4.3.0 behavior: major bumps are manual only; milestone completion no longer affects bump classification
- [ ] Where appropriate, defer to `tech.md`'s Version Bump Classification table instead of restating the rules
- [ ] After this task: the spec content is consistent with the current `sdlc-runner.mjs` version-bump logic

---

## Phase 5: Integration

### T012: Add CHANGELOG entry for `postDiscord` removal

**File(s)**: `CHANGELOG.md`
**Type**: Modify
**Depends**: T002
**Acceptance**:
- [ ] Under `## [Unreleased]`, add a one-line entry describing the removal (e.g., `### Changed — Removed the legacy \`postDiscord()\` pass-through from \`sdlc-runner.mjs\`; status notifications now go directly through \`log()\` (behavior unchanged)`)
- [ ] The entry follows the existing CHANGELOG style (section heading, concise wording)
- [ ] No entry is added for the spec cleanup itself — the cleanup is tracked by the GitHub issue and does not change user-visible behavior

---

## Phase 6: Testing (Verification)

### T013: Run AC8 drift sweep and confirm zero matches

**File(s)**: none (verification only)
**Type**: Verify
**Depends**: T005, T006, T007, T008, T009, T010, T011
**Acceptance**:
For each of the following patterns, `grep -r <pattern> .claude/specs/ --exclude-dir=feature-fix-stale-spec-references` returns zero matches:
- [ ] `openclaw/scripts/`
- [ ] `generating-openclaw-config`
- [ ] `installing-openclaw-skill`
- [ ] `postDiscord`
- [ ] `discordChannelId`
- [ ] `feature-openclaw-runner-operations`
- [ ] `~/.openclaw/`
- [ ] case-insensitive `openclaw`
- [ ] case-insensitive `discord`

**And**:
- [ ] `grep -n postDiscord scripts/sdlc-runner.mjs` returns zero matches
- [ ] `grep -n postDiscord scripts/__tests__/sdlc-runner.test.mjs` returns zero matches

### T014: Final runner smoke + Jest re-run

**File(s)**: none (verification only)
**Type**: Verify
**Depends**: T002, T003, T013
**Acceptance**:
- [ ] `cd scripts && npm test` still exits 0 (no regressions between T004 and this final run)
- [ ] `node scripts/sdlc-runner.mjs --help` (or equivalent no-op invocation supported by the runner) runs without throwing
- [ ] A short manual read of the runner's startup log output confirms `[STATUS]` prefixes are present at the same trigger points as before

---

## Dependency Graph

```
T001 ──┬──▶ T002 ──▶ T003 ──▶ T004
       │                         │
       │                         └──▶ T012
       │
       ├──▶ T005 ──▶ T006 ─┐
       ├──▶ T007 ──────────┤
       ├──▶ T008 ──────────┼──▶ T013 ──▶ T014
       ├──▶ T009 ──────────┤
       ├──▶ T010 ──────────┤
       └──▶ T011 ──────────┘
```

Critical path: T001 → T002 → T003 → T004 → T013 → T014 (runner-change branch is the longest because Jest must be green before the final sweep).

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #114 | 2026-04-16 | Initial task breakdown for documentation drift cleanup + `postDiscord` runner removal |

---

## Validation Checklist

- [x] Each task has a single responsibility
- [x] Dependencies correctly mapped (T001 inventory gates everything; T002 gates T003/T004/T012; spec tasks T005–T011 are independent after T001; T013/T014 gate the final verify)
- [x] Acceptance criteria are verifiable via grep or `npm test`
- [x] File paths reference actual project structure
- [x] Regression test (T004) is included for the runner change
- [x] Final drift-sweep task (T013) exists and covers every AC8 pattern
- [x] No circular dependencies
