# Verification Report: draft-issue skill

**Issues**: #4, #116
**Date**: 2026-04-18
**Reviewer**: Claude Code (`/verify-code`)
**Scope**: Issue #116 — readability treatment, deeper interview, unattended-mode removal

---

## Executive Summary

| Category | Score (1-5) |
|----------|-------------|
| Spec Compliance | 5 |
| SOLID (reinterpreted for skills) | 5 |
| Security | 5 |
| Performance | 5 |
| Testability | 5 |
| Error Handling | 5 |
| Prompt Quality | 5 (after fix) |
| **Overall** | **5** |

**Status**: Pass
**Fixes applied**: 1
**Remaining issues**: 0

---

## Acceptance Criteria Verification (Issue #116)

| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| AC1 | Interactive interview gathers requirements | Pass | `SKILL.md:188-269` — Step 5 adaptive interview |
| AC2 | Issue body follows BDD template | Pass | `SKILL.md:378-435` — Feature template with Given/When/Then |
| AC3 | Bug report uses defect template | Pass | `SKILL.md:437-497` — Bug template with Environment table |
| AC4 | Superseded by AC12 | N/A | Unattended-mode path intentionally removed |
| AC5 | Inline review summary replaces open-ended prompts | Pass | `SKILL.md:515-535` — structured summary with Title, User Story, ACs, FRs, Out of Scope, Labels |
| AC6 | Revise path loops until approval | Pass | `SKILL.md:550-552` — free-text follow-up, wholesale redraft, loop |
| AC7 | Tables contrast Feature vs Bug templates | Pass | `SKILL.md:368-377` — 7-row comparison table |
| AC8 | Steps restructured with Input/Process/Output | Pass | Every step uses `#### Input/Process/Output`; 5c and 7 add `#### Human Review Gate`; Workflow Overview at `SKILL.md:30-52` |
| AC9 | Interview probes NFRs, edge cases, related features | Pass | `SKILL.md:238-253` — Feature R3 (NFRs & edge cases), R4 (related & priority); Bug R3 (edge cases & regression risk) |
| AC10 | Understanding check before drafting | Pass | `SKILL.md:303-350` — Step 5c with human review gate |
| AC11 | Adaptive interview depth based on complexity | Pass | `SKILL.md:200-216` — depth table + user-visible log line |
| AC12 | Unattended-mode support removed | Pass | Only one "unattended" reference in `SKILL.md:28` — the v6.0.0 sign-post sentence |
| AC13 | SDLC runner cannot invoke draft-issue | Pass | `scripts/sdlc-runner.mjs:156-158` comment + `scripts/__tests__/sdlc-runner.test.mjs:1338-1340` regression test |
| AC14 | Automatable question explains downstream impact | Pass | `SKILL.md:282-295` — body references `/write-spec`, `/write-code`, `/verify-code`, `/open-pr` |
| AC15 | User can override depth decision | Pass | `SKILL.md:217-230` — two-option override menu with session note on override |
| AC16 | Playback length scales with interview depth | Pass | `SKILL.md:313-330` — one-line core vs 5-line extended |
| AC17 | Revise loop adds soft guard after three iterations | Pass | `SKILL.md:554-578` — counter tracking + expanded menu + no auto-termination |
| AC18 | Breaking change sign-post + major version bump | Pass | `plugin.json:3` and `marketplace.json` both at `6.0.0`; `CHANGELOG.md` has `### Changed (BREAKING)`; SKILL.md sign-post at line 28; STEP_KEYS comment at `sdlc-runner.mjs:156-158` |

**Coverage**: 17/17 active ACs pass (AC4 is intentionally superseded by AC12).

---

## Task Completion

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1-4 (original) | T001-T004 | Complete (pre-existing) |
| Phase 5: Readability | T005-T008 | Complete |
| Phase 6: Deeper Interview | T009-T013 | Complete |
| Phase 7: Unattended-Mode Removal | T014-T018 | Complete |
| Phase 8: Docs + Testing | T019-T021 | Complete |

All 21 tasks verified against file contents.

---

## Architecture Assessment

Per `tech.md` checklist applicability for skills (markdown), SOLID is reinterpreted (SRP/DIP only) and Security/Performance/Error-Handling apply narrowly to the tiny runner touch (one comment + one test).

### SOLID (reinterpreted)
- **SRP**: Skill still does one workflow step — drafting an issue. Added steps (5c, depth heuristic) are within that responsibility.
- **DIP**: Skill references steering docs (`product.md`, `tech.md`, `structure.md`); no stack-specific details hardcoded.

### Security
- No secrets in committed files.
- `gh issue create` invocation unchanged; all flags remain quoted in shell examples.
- No shell injection risk introduced by the runner comment or the test addition.

### Performance
- Heuristic is O(1) over pre-computed signals.
- No new blocking operations.
- Runner untouched functionally.

### Testability
- Linear, deterministic step shape — each step has explicit Input/Process/Output.
- Regression test covers STEP_KEYS invariant.
- Skill is exercise-testable via Agent SDK (`canUseTool` callback for AskUserQuestion).

### Error Handling
- Skill handles inconclusive investigation, missing VERSION file, milestone creation failures.
- Runner and test changes introduce no new error paths.

### Prompt Quality
- Instructions are unambiguous (after the fix described below).
- All gates have `AskUserQuestion`: classification, milestone, bug-hypothesis confirm, depth override, automatable, playback confirm, review menu, expanded guard menu (8 total).
- Tool references correct throughout.
- Cross-references resolve (steering docs, templates, downstream skills).
- No skill-level auto-termination; soft guard correctly expands menu rather than exiting loop.

---

## Test Coverage

| Layer | Status | Notes |
|-------|--------|-------|
| BDD scenarios | Pass | 18 Gherkin scenarios in `feature.gherkin`; every new AC (AC5-AC18) has a scenario (several ACs have multiple) |
| Runner regression test | Pass | `STEP_KEYS.includes('draftIssue') === false` asserted |
| Jest suite | Pass | 207/207 tests passing (post-fix) |

---

## Exercise Testing

**Not feasible in this verification session** — the skill is heavily interactive with 8 `AskUserQuestion` gates. Exercise testing requires either the Claude Agent SDK with `canUseTool` handler or `claude -p` with AskUserQuestion denied (which only exercises the deny path). Per `tech.md` Testing Standards → "If exercise testing is not feasible during automated verification, `/verify-code` should explicitly note this in the verification report and recommend manual exercise testing as a follow-up."

**Recommended manual dogfooding** after merge:
1. Invoke `/draft-issue` interactively against a test project with low file count and low vagueness → verify core-depth heuristic picks and one-line playback renders.
2. Invoke `/draft-issue` against a complex area → verify extended-depth heuristic picks and full 5-line playback renders.
3. Select `[2] Revise` three times → verify expanded menu appears on the fourth round with `[1] Keep revising / [2] Reset / [3] Accept as-is`.
4. Create a `.claude/unattended-mode` file and invoke `/draft-issue` → verify the skill still runs the full interactive workflow.

---

## Fixes Applied

| Severity | Category | Location | Issue | Fix |
|----------|----------|----------|-------|-----|
| Medium | Prompt quality | `plugins/nmg-sdlc/skills/draft-issue/SKILL.md:559-562` | Counter-reset semantics were ambiguous: line 560 said "Resets to 0 on any [1] (Approve) or [3] (Accept-as-is)" but `[1]` also appears in the expanded menu as "Keep revising" (which should NOT reset). Line also omitted `[2] Reset` as a reset trigger, contradicting `design.md:311`. | Rewrote the counter list to disambiguate: increment on two-option `[2] Revise` or expanded `[1] Keep revising`; reset on two-option `[1] Approve`, expanded `[2] Reset`, or expanded `[3] Accept as-is`. Added a one-line clarifier to the 7.5 heading noting the guard fires on the fourth review round. |

---

## Remaining Issues

None.

---

## Recommendation

**Ready for PR.** All 17 active acceptance criteria pass. The single medium-severity prompt-quality finding was fixed in-session. Tests (207/207) pass after the fix. Version bump, CHANGELOG BREAKING entry, and in-file sign-post are all in place. Manual dogfooding of the interactive review UX is recommended as a follow-up but does not block the PR.

Next step: `/open-pr #116`.
