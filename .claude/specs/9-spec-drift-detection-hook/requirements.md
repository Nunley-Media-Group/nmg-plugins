# Requirements: Spec Drift Detection Hook

**Issue**: #9
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## User Story

**As a** developer working on a codebase with active specs,
**I want** automatic detection when my file modifications drift from existing specifications,
**So that** I catch unintended spec violations in real-time rather than discovering them during verification.

---

## Background

The spec alignment PostToolUse hook fires on every `Write` and `Edit` tool call, checking whether the file modification is consistent with all active specs in `.claude/specs/`. The hook intentionally checks ALL specs — not just the spec for the current branch — ensuring that any file change, even outside the SDLC workflow, is validated against every existing specification. Originally a `prompt`-type hook, it was upgraded to an `agent`-type hook so it can read spec files when checking for drift. A `command`-type gate was added that short-circuits when no spec files exist, avoiding expensive agent spawns on every Write/Edit in projects without specs.

---

## Acceptance Criteria

### AC1: Drift Detected on File Edit

**Given** specs exist in `.claude/specs/`
**When** I edit a file that conflicts with a spec's requirements
**Then** the hook flags the drift with an explanation of which spec requirement is violated

### AC2: All Specs Are Checked

**Given** multiple specs exist for different features
**When** I edit any file in the project
**Then** the hook checks the modification against ALL existing specs, not just the current branch's spec

### AC3: No-Op When No Specs Exist

**Given** no spec files exist in `.claude/specs/`
**When** I edit any file
**Then** the hook short-circuits immediately without spawning an agent

### AC4: Hook Fires on Write and Edit

**Given** specs exist in the project
**When** I use the Write or Edit tool
**Then** the PostToolUse hook fires and checks for spec alignment

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR1 | PostToolUse hook on Write and Edit tool calls | Must | Matcher: `Write\|Edit` |
| FR2 | Agent-type hook that reads spec files for drift comparison | Must | Can use Glob/Read |
| FR3 | Check modifications against ALL existing specs | Must | Not just current branch |
| FR4 | Command-type gate that short-circuits when no specs exist | Must | `ls .claude/specs/*/requirements.md` |
| FR5 | Clear drift explanation referencing specific spec requirements | Must | JSON response with reason |

---

## Non-Functional Requirements

| Aspect | Requirement |
|--------|-------------|
| **Performance** | Command gate short-circuits in <100ms when no specs exist |
| **Security** | Hook reads spec files only, no write access |
| **Reliability** | Agent timeout of 60 seconds prevents hangs |

---

## Dependencies

### Internal Dependencies
- [x] Plugin scaffold (#2) for hook infrastructure
- [x] Writing specs skill (#5) for spec files to check against

### External Dependencies
- [x] Claude Code PostToolUse hook system

---

## Out of Scope

- Automatic drift resolution or code correction
- Blocking file writes that violate specs (advisory only)
- Drift detection for non-code files (e.g., images, binaries)

---

## Validation Checklist

- [x] User story follows "As a / I want / So that" format
- [x] All acceptance criteria use Given/When/Then format
- [x] No implementation details in requirements
- [x] All criteria are testable and unambiguous
- [x] Dependencies are identified
- [x] Out of scope is defined
