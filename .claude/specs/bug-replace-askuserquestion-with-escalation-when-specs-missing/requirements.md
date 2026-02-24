# Defect Report: AskUserQuestion called instead of escalation when specs missing in auto-mode

**Issues**: #85
**Date**: 2026-02-24
**Status**: Draft
**Author**: Claude
**Severity**: High
**Related Spec**: `.claude/specs/feature-implementing-specs-skill/`

---

## Reproduction

### Steps to Reproduce

1. Set up `.claude/auto-mode` in the project directory
2. Start work on an issue without running `/writing-specs` first
3. OpenClaw runner invokes `/implementing-specs #N` (step 4 — code)
4. The skill reaches Step 2 ("Read Specs"), finds no spec files
5. The skill calls `AskUserQuestion` to suggest running `/writing-specs #N` first
6. In headless mode, the `AskUserQuestion` prompt goes nowhere and the session hangs

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | Any (cross-platform) |
| **Version / Commit** | nmg-sdlc v2.17.2 |
| **Browser / Runtime** | Claude Code CLI (headless via `claude -p`) |
| **Configuration** | `.claude/auto-mode` present; no spec files at `.claude/specs/` |

### Frequency

Always — 100% reproducible when specs are missing and auto-mode is active.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | When specs are missing and `.claude/auto-mode` exists, the skill outputs an escalation message (e.g., "No specs found... Done. Awaiting orchestrator.") and exits cleanly, allowing the runner's bounce-back mechanism to retry the previous step (writing-specs) |
| **Actual** | The skill calls `AskUserQuestion` regardless of auto-mode, causing the headless session to hang on a prompt that will never be answered |

### Error Output

```
No error output — the session hangs indefinitely waiting for AskUserQuestion input.
Eventually the runner's per-step timeout fires and kills the session.
```

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Escalation message in auto-mode when specs are missing

**Given** specs are missing for the target issue (no spec directory or missing files)
**And** `.claude/auto-mode` exists in the project directory
**When** `/implementing-specs` is invoked
**Then** the skill outputs an escalation message ending with "Done. Awaiting orchestrator."
**And** the skill does NOT call `AskUserQuestion`

### AC2: Interactive prompt preserved when auto-mode is absent

**Given** specs are missing for the target issue
**And** `.claude/auto-mode` does NOT exist in the project directory
**When** `/implementing-specs` is invoked
**Then** the skill calls `AskUserQuestion` to prompt the user to run `/writing-specs #N` first
**And** no escalation message is output

### AC3: Escalation message contains actionable context

**Given** specs are missing in auto-mode
**When** the skill outputs an escalation message
**Then** the message includes which spec files are missing or that no spec directory was found
**And** the message names the prerequisite step (`/writing-specs`)
**And** the message ends with the runner-expected sentinel: "Done. Awaiting orchestrator."

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Check for `.claude/auto-mode` before calling `AskUserQuestion` on the missing-specs error path | Must |
| FR2 | Output escalation message in runner-compatible format (ending with "Done. Awaiting orchestrator.") when auto-mode is active and specs are missing | Must |
| FR3 | Preserve existing interactive `AskUserQuestion` behavior when auto-mode is absent | Must |

---

## Out of Scope

- Automatically running `/writing-specs` as a recovery step within the skill
- Adding auto-mode checks to other `AskUserQuestion` calls in the skill (the skill's Automation Mode section already documents the global auto-mode contract; only this specific missing-specs error path is affected)
- Changes to the runner's precondition validation or bounce-back logic

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #85 | 2026-02-24 | Initial defect spec |

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC2)
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
