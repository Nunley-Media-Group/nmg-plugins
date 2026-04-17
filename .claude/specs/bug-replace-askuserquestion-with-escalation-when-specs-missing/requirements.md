# Defect Report: AskUserQuestion called instead of escalation when specs missing in unattended-mode

**Issues**: #85
**Date**: 2026-02-24
**Status**: Draft
**Author**: Claude
**Severity**: High
**Related Spec**: `.claude/specs/feature-write-code-skill/`

---

## Reproduction

### Steps to Reproduce

1. Set up `.claude/unattended-mode` in the project directory
2. Start work on an issue without running `/write-spec` first
3. SDLC runner invokes `/write-code #N` (step 4 — code)
4. The skill reaches Step 2 ("Read Specs"), finds no spec files
5. The skill calls `AskUserQuestion` to suggest running `/write-spec #N` first
6. In headless mode, the `AskUserQuestion` prompt goes nowhere and the session hangs

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | Any (cross-platform) |
| **Version / Commit** | nmg-sdlc v2.17.2 |
| **Browser / Runtime** | Claude Code CLI (headless via `claude -p`) |
| **Configuration** | `.claude/unattended-mode` present; no spec files at `.claude/specs/` |

### Frequency

Always — 100% reproducible when specs are missing and unattended-mode is active.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | When specs are missing and `.claude/unattended-mode` exists, the skill outputs an escalation message (e.g., "No specs found... Done. Awaiting orchestrator.") and exits cleanly, allowing the runner's bounce-back mechanism to retry the previous step (write-spec) |
| **Actual** | The skill calls `AskUserQuestion` regardless of unattended-mode, causing the headless session to hang on a prompt that will never be answered |

### Error Output

```
No error output — the session hangs indefinitely waiting for AskUserQuestion input.
Eventually the runner's per-step timeout fires and kills the session.
```

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Escalation message in unattended-mode when specs are missing

**Given** specs are missing for the target issue (no spec directory or missing files)
**And** `.claude/unattended-mode` exists in the project directory
**When** `/write-code` is invoked
**Then** the skill outputs an escalation message ending with "Done. Awaiting orchestrator."
**And** the skill does NOT call `AskUserQuestion`

### AC2: Interactive prompt preserved when unattended-mode is absent

**Given** specs are missing for the target issue
**And** `.claude/unattended-mode` does NOT exist in the project directory
**When** `/write-code` is invoked
**Then** the skill calls `AskUserQuestion` to prompt the user to run `/write-spec #N` first
**And** no escalation message is output

### AC3: Escalation message contains actionable context

**Given** specs are missing in unattended-mode
**When** the skill outputs an escalation message
**Then** the message includes which spec files are missing or that no spec directory was found
**And** the message names the prerequisite step (`/write-spec`)
**And** the message ends with the runner-expected sentinel: "Done. Awaiting orchestrator."

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Check for `.claude/unattended-mode` before calling `AskUserQuestion` on the missing-specs error path | Must |
| FR2 | Output escalation message in runner-compatible format (ending with "Done. Awaiting orchestrator.") when unattended-mode is active and specs are missing | Must |
| FR3 | Preserve existing interactive `AskUserQuestion` behavior when unattended-mode is absent | Must |

---

## Out of Scope

- Automatically running `/write-spec` as a recovery step within the skill
- Adding unattended-mode checks to other `AskUserQuestion` calls in the skill (the skill's Unattended Mode section already documents the global unattended-mode contract; only this specific missing-specs error path is affected)
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
