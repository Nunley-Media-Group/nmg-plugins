# Root Cause Analysis: Text-Pattern Soft Failure Detection Missing from SDLC Runner

**Issues**: #86
**Date**: 2026-02-25
**Status**: Draft
**Author**: Claude (nmg-sdlc)

---

## Root Cause

The `detectSoftFailure()` function in `sdlc-runner.mjs` was designed to catch failures where Claude Code exits with code 0 but did not actually succeed. It does this by parsing the stream-json output for two JSON-level indicators: `subtype: "error_max_turns"` and non-empty `permission_denials`. This was the correct initial implementation (issue #38) because those were the known soft failure modes at the time.

However, some failure modes produce text-only output that never appears in the structured JSON result. For example, when a skill calls `EnterPlanMode` in a headless/pipe session, Claude Code prints a text error message to stdout (not as a JSON-structured event) and continues or exits cleanly. Similarly, `AskUserQuestion` called when auto-mode is active may produce text warnings. The `detectSoftFailure()` function calls `extractResultFromStream()` to get the JSON result object and inspects only its fields — it never scans the raw stdout/stderr text for failure indicators.

The existing `matchErrorPattern()` function _does_ scan raw text output, but it only runs inside `handleFailure()` — which is the non-zero exit code path or the path after a soft failure has already been detected. There is no text scanning in the exit-code-0 success path before `detectSoftFailure()` returns its verdict.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `openclaw/scripts/sdlc-runner.mjs` | 1061–1079 | `detectSoftFailure()` — only checks JSON fields, never scans raw text |
| `openclaw/scripts/sdlc-runner.mjs` | 1036–1051 | `matchErrorPattern()` / `IMMEDIATE_ESCALATION_PATTERNS` — existing text scanning, but only used in the failure path |
| `openclaw/scripts/sdlc-runner.mjs` | 1669–1676 | Call site in `runStep()` — calls `detectSoftFailure(result.stdout)` and posts Discord on match |

### Triggering Conditions

- A skill produces a text-based failure message on stdout or stderr (e.g., "EnterPlanMode called in headless session")
- The Claude Code process exits with code 0
- The JSON result object does not contain `error_max_turns` subtype or `permission_denials`
- The runner's exit-code-0 path calls `detectSoftFailure()` which finds no JSON failure indicators
- The step is classified as successful

---

## Fix Strategy

### Approach

Add text-pattern scanning to `detectSoftFailure()`. After the existing JSON checks (which remain unchanged), if no JSON-based soft failure is found, scan the raw stdout string against a new constant array of regex patterns representing known text-based failure indicators. If any pattern matches, return a soft failure result with a `text_pattern:` reason prefix.

The patterns are defined as a module-level constant array (`TEXT_FAILURE_PATTERNS`) for maintainability, following the same pattern as the existing `IMMEDIATE_ESCALATION_PATTERNS` and `BENIGN_DENIED_TOOLS` constants. Each entry includes a regex and a human-readable label used in the reason string and Discord messages.

The function signature and return type remain unchanged — callers already handle `{ isSoftFailure: true, reason: string }` — so no changes are needed at the call site in `runStep()` or in `handleFailure()`.

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `openclaw/scripts/sdlc-runner.mjs` | Add `TEXT_FAILURE_PATTERNS` constant array near existing `IMMEDIATE_ESCALATION_PATTERNS` (~line 1036) | Centralizes text patterns for maintainability; follows existing code pattern |
| `openclaw/scripts/sdlc-runner.mjs` | Extend `detectSoftFailure()` to scan raw `stdout` against `TEXT_FAILURE_PATTERNS` after JSON checks (~line 1077) | Core fix — detects text-based failures that JSON inspection misses |
| `openclaw/scripts/__tests__/sdlc-runner.test.mjs` | Add test cases for text-pattern soft failure detection | Regression prevention — ensures new and existing detection paths are covered |

### Blast Radius

- **Direct impact**: `detectSoftFailure()` function — gains an additional code path that returns `isSoftFailure: true` for text pattern matches
- **Indirect impact**: `runStep()` (line ~1671) — will now trigger the soft failure path for text-based failures (same as JSON failures). `handleFailure()` will be called, which triggers retry/escalation. `postDiscord()` will include the `text_pattern:` reason.
- **Risk level**: Low — the new code path only fires when a known text pattern is found AND no JSON soft failure was detected. The return type is identical to existing soft failure returns. All downstream handling (retry, escalation, Discord) is unchanged.

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| False positive: a pattern matches normal output text | Low | Patterns are specific (e.g., `EnterPlanMode` is not a word that appears in normal success output). Test with representative success output samples. |
| JSON soft failure detection breaks | Very Low | JSON checks execute first, before text scanning. Only if JSON returns no failure does text scanning run. Existing tests cover JSON path. |
| Text scanning adds latency | Very Low | Regex scanning a few KB of stdout against 3-5 patterns is negligible. No network calls or I/O involved. |
| Pattern list becomes stale as new failure modes emerge | Low | Patterns are in a clearly-named constant. Adding new patterns is a one-line change with no structural risk. |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| Extend `matchErrorPattern()` and call it from the exit-code-0 path | Reuse existing text scanning infrastructure | `matchErrorPattern()` returns `{ action: 'escalate' | 'wait' }` which is semantically different from soft failure detection. Conflating the two would complicate both paths. Better to keep them separate. |
| Make patterns configurable via `sdlc-config.json` | Allow per-project customization of failure patterns | Over-engineering for the current need. The patterns are universal to Claude Code behavior, not project-specific. Can be added later if needed. |

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #86 | 2026-02-25 | Initial defect design |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
