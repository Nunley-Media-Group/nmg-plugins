# Requirements: Route Skill Creation and Update Tasks Through /skill-creator

**Issues**: #141
**Date**: 2026-04-19
**Status**: Draft
**Author**: Rich Nunley

---

## User Story

**As a** developer implementing or modifying a Claude Code skill definition through the SDLC pipeline
**I want** `write-code`, `spec-implementer`, and `verify-code` to automatically route skill-related work through `/skill-creator`
**So that** all skill definitions — whether created new, updated, or fixed during verification — meet Anthropic's official best practices regardless of how the task was initiated

---

## Background

The nmg-sdlc pipeline currently treats `SKILL.md` files identically to any other source file. When a task involves creating or modifying a skill, `spec-implementer` authors the `SKILL.md` directly using `Write` or `Edit`, and `verify-code` fixes findings in `SKILL.md` files via direct edits. Both paths bypass the `/skill-creator` skill, which exists specifically to produce high-quality, consistently structured skill definitions (frontmatter, triggering descriptions, examples, structure).

`steering/tech.md` already declares the architectural invariant: *"Any time a skill is created or edited — whether by a human or by an SDLC workflow (spec implementation, verify-code autofix, etc.) — the work MUST be driven through the `skill-creator` skill."* The pipeline components must enforce this invariant, while degrading gracefully when `/skill-creator` is not installed in a downstream project.

Precedent for the probe-and-skip pattern exists in the codebase: `write-code` Step 5b and `verify-code` Step 6a-bis both probe for the `simplify` skill and fall through to a verbatim warning if unavailable. This feature applies the same pattern for `/skill-creator`.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Heuristic Detection of Skill-Related Work

**Given** `write-code` is executing tasks for an issue
**When** it inspects a task from `tasks.md` in the context of the issue
**Then** it classifies the task as skill-related when ANY of the following signals are present:
- The task's file path includes `SKILL.md`
- The task description contains the tokens `skill`, `SKILL.md`, or `skill definition`
- The issue title or body contains the token `skill`

**Example**:
- Given: a task `T004: Implement /foo skill → plugins/acme/skills/foo/SKILL.md`
- When: `write-code` reaches T004
- Then: T004 is classified as skill-related (path signal)

### AC2: write-code Routes Detected Skill Tasks Through /skill-creator

**Given** a skill task has been detected (per AC1) AND `/skill-creator` is installed
**When** `write-code` (or its delegate) reaches that task
**Then** it invokes `/skill-creator` for the task — passing the task context — rather than authoring the `SKILL.md` directly with `Write` or `Edit`
**And** the resulting `SKILL.md` exists at the task's declared file path after execution

### AC3: spec-implementer Applies the Same Routing

**Given** the `spec-implementer` agent is executing tasks sequentially
**When** it encounters a task classified as skill-related (same heuristics as AC1)
**Then** it invokes `/skill-creator` for that task
**And** it does not use `Write` or `Edit` to author the `SKILL.md` directly
**And** it falls back to direct authoring only when `/skill-creator` is unavailable (per AC5)

### AC4: verify-code Routes SKILL.md Fixes Through /skill-creator

**Given** `verify-code` has identified a finding whose affected file is a `SKILL.md` file AND `/skill-creator` is installed
**When** it applies the fix in Step 6a
**Then** the fix is routed through `/skill-creator` rather than applied via direct `Write`/`Edit` to the `SKILL.md` file
**And** the fix outcome is recorded in the verification report the same way direct fixes are

### AC5: Graceful Degradation When /skill-creator Is Not Installed

**Given** `/skill-creator` is not installed in the project (no matching plugin skill, no user skill, no system-reminder advertisement)
**When** any of `write-code`, `spec-implementer`, or `verify-code` would otherwise invoke `/skill-creator` for a skill task
**Then** the component emits the warning verbatim: `skill-creator not available — implementing skill directly`
**And** it proceeds with direct `Write`/`Edit` authoring
**And** the warning is visible in the session transcript or log output

### AC6: Conservative False-Positive Bias

**Given** a task has ambiguous skill signals (e.g., the word "skill" appears in the issue body but the task itself touches an unrelated file)
**When** the detection heuristic is applied
**Then** the task is routed through `/skill-creator` when available (false-positive preferred over false-negative)
**And** the warning from AC5 is not emitted (since skill-creator *is* available)

### AC7: Non-Skill Tasks Are Unaffected

**Given** a task with no skill signals (no `SKILL.md` in the path, no skill tokens in the description, no skill token in the issue title/body)
**When** the component executes the task
**Then** it uses direct `Write`/`Edit` authoring as today
**And** it does not probe for or invoke `/skill-creator`

### AC8: Unattended Mode Compatibility

**Given** `.claude/unattended-mode` exists at the project root
**When** any of the three components detects a skill task and invokes `/skill-creator`
**Then** no interactive prompts are introduced by the routing logic
**And** the probe-and-skip pattern behaves identically to manual mode (the probe is a filesystem/system-reminder check, not an `AskUserQuestion` gate)

### Generated Gherkin Preview

```gherkin
Feature: Route skill tasks through /skill-creator
  As a developer implementing or modifying a Claude Code skill definition
  I want write-code, spec-implementer, and verify-code to route skill work through /skill-creator
  So that all skill definitions meet Anthropic's official best practices

  Scenario: Skill task detected from SKILL.md path
    Given a task targets a file path ending in "SKILL.md"
    When the detection heuristic is applied
    Then the task is classified as skill-related

  Scenario: write-code invokes /skill-creator for detected task
    Given a skill task and /skill-creator is installed
    When write-code reaches the task
    Then /skill-creator is invoked for that task

  # ... one scenario per AC
```

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | `write-code` SKILL.md gains a detection step that classifies each task as skill-related using the three signals (path, description tokens, issue tokens) | Must | Must live alongside existing Step 5 Execute Tasks logic |
| FR2 | `write-code` invokes `/skill-creator` for detected skill tasks when available, using a probe-and-skip pattern modelled after the existing `simplify` probe in Step 5b | Must | Reuse the same three probe checks (user skills, plugin skills, system-reminder) |
| FR3 | `plugins/nmg-sdlc/agents/spec-implementer.md` gains the same detection and routing logic so the agent path stays consistent with the inline-fallback path | Must | Agent has `Write`/`Edit` access today; routing must override those tools for skill tasks when `/skill-creator` is available |
| FR4 | `verify-code` Step 6a routes SKILL.md fixes through `/skill-creator` when available | Must | Integrates with existing finding-fix loop; does not change report structure |
| FR5 | All three components probe for `/skill-creator` availability and emit the exact warning string `skill-creator not available — implementing skill directly` when unavailable, then proceed with direct authoring | Must | Verbatim warning enables log-scraping and user recognition |
| FR6 | Detection favours false positives — ambiguous tasks are routed to `/skill-creator` when it is available | Should | Per issue's explicit guidance: "skill-creator can always be asked to simply review and improve an existing file" |
| FR7 | The probe is a filesystem/system-reminder check, not an `AskUserQuestion` prompt, so unattended mode is preserved | Must | Matches existing simplify-probe convention |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | The detection heuristic adds negligible overhead — it is a string/path check per task, no network or filesystem calls beyond the existing probe |
| **Security** | No new credential or token requirements; routing uses the same Claude Code plugin permission model |
| **Accessibility** | N/A (skill-side behaviour; no UI) |
| **Reliability** | Graceful degradation is mandatory — a missing `/skill-creator` must never block the pipeline |
| **Platforms** | macOS, Windows, Linux — detection uses path-suffix matching on `SKILL.md` (case-sensitive — matches the project's cross-platform guidance in `steering/tech.md`) |

---

## UI/UX Requirements

Not applicable — this feature modifies skill and agent prompts only. No user-facing UI components are introduced.

The only user-visible artifact is the warning string in AC5, which must appear verbatim in the transcript when `/skill-creator` is unavailable.

---

## Data Requirements

### Input Data

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| Task file path | string | Matched against suffix `SKILL.md` | Yes |
| Task description | string | Tokenized and matched against `skill`, `SKILL.md`, `skill definition` | Yes |
| Issue title | string | Tokenized and matched against `skill` | Yes |
| Issue body | string | Tokenized and matched against `skill` | Yes |
| `/skill-creator` availability | boolean (probe result) | Derived from filesystem and system-reminder checks | Yes |

### Output Data

| Field | Type | Description |
|-------|------|-------------|
| Routing decision | enum `{skill-creator, direct}` | Which authoring path was taken for a given task |
| Warning emission | string (verbatim) | `skill-creator not available — implementing skill directly` (when applicable) |

---

## Dependencies

### Internal Dependencies
- [x] `write-code` skill (existing)
- [x] `verify-code` skill (existing)
- [x] `spec-implementer` agent (existing)
- [x] Existing `simplify` probe pattern — serves as the reference implementation for the probe-and-skip structure

### External Dependencies
- [ ] `/skill-creator` skill — *optional at runtime*; the whole point of the probe is to work when it's absent

### Blocked By
- None

---

## Out of Scope

- Changes to the `/skill-creator` skill itself
- Changes to `/draft-issue`, `/write-spec`, `/start-issue`, `/open-pr`, `/simplify`, or any skill not named above
- Adding a skill-creator step to the SDLC runner (`scripts/sdlc-runner.mjs`) — skill-creator is invoked within the existing implement/verify steps, not as a top-level pipeline step
- Any reference to or dependency on the `doing-skills-right` skill
- Changes to how `/skill-creator` accepts its arguments — the integration uses whatever contract `/skill-creator` already exposes
- Retrofitting existing `SKILL.md` files in the repo through `/skill-creator` — only new work goes through it

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Skill-task detection accuracy | 100% of tasks with `SKILL.md` in the path are detected | Manual exercise: seed tasks with each signal type, confirm classification |
| Graceful degradation | 0 pipeline failures in projects without `/skill-creator` | Manual exercise on a test project that lacks the skill |
| Warning string fidelity | Warning appears verbatim when `/skill-creator` missing | Grep transcript for the exact string |
| Architectural invariant compliance | `steering/tech.md` invariant "skills authored via `/skill-creator`" is enforced by the pipeline, not just documented | `/verify-code` on a subsequent skill-change PR should show zero direct-edit findings for SKILL.md authoring |

---

## Open Questions

- [ ] Does `/skill-creator` accept a single combined prompt for create-or-edit, or does it expose separate commands? *(Resolve during PLAN phase by reading the `/skill-creator` skill definition; the routing prompt will adapt to whatever contract exists.)*
- [ ] Should the verify-code path include the pre-fix `SKILL.md` content so `/skill-creator` understands what was already there? *(Resolved in PLAN: yes — finding context plus existing file content must be handed off.)*

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #141 | 2026-04-19 | Initial feature spec |

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Success metrics are measurable
- [x] Edge cases and error states are specified (AC5–AC8)
- [x] Dependencies are identified
- [x] Out of scope is defined
- [x] Open questions are documented
