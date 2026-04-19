# Design: /end-loop Skill

**Issues**: #122
**Date**: 2026-04-18
**Status**: Draft
**Author**: Claude Code

---

## Overview

`/end-loop` is a new user-invocable skill in the `nmg-sdlc` plugin that tears down the SDLC runner's unattended state. It is the explicit counterpart to `/run-loop`: one command to stop the loop cleanly, regardless of whether the runner is live, crashed, or already gone.

The skill is prompt-based Markdown (`SKILL.md`), consistent with every other skill in the plugin. It uses `Bash` with short Node one-liners for cross-platform process-liveness and SIGTERM operations, and `Bash(rm:*)` for file removal. All logic mirrors `RUNNER_ARTIFACTS` and `removeUnattendedMode()` in `scripts/sdlc-runner.mjs` so that artifact path conventions stay in one place.

The skill does not introduce a runtime script — it is instructions that Claude Code executes via tool calls. This preserves the project's skill-as-prompt architectural invariant.

---

## Architecture

### Component Diagram

Reference `steering/structure.md` for the plugin layer architecture.

```
┌──────────────────────────────────────────────────────────┐
│                    Plugin Layer                            │
├──────────────────────────────────────────────────────────┤
│  plugins/nmg-sdlc/skills/end-loop/SKILL.md                │
│      └── (prompt instructions only — no JS code)          │
└───────────────────────────┬──────────────────────────────┘
                            │ references
                            ▼
┌──────────────────────────────────────────────────────────┐
│              Runtime Artifacts (target project)            │
│  .claude/unattended-mode        (flag file)                │
│  .claude/sdlc-state.json        (state file, has runnerPid)│
└──────────────────────────────────────────────────────────┘
                            ▲ managed by
                            │
┌──────────────────────────────────────────────────────────┐
│                    Runner Script Layer                     │
│  scripts/sdlc-runner.mjs                                   │
│      RUNNER_ARTIFACTS (line 552) — the authoritative list  │
│      removeUnattendedMode() (line 600) — reference helper  │
└──────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User invokes /end-loop
2. Skill checks for .claude/ directory existence
   - Missing → report "not a runner project" and exit 0
3. Skill checks for either RUNNER_ARTIFACT
   - Neither exists → report "already disabled" and exit 0
4. Skill reads .claude/sdlc-state.json if present
   - Parse attempt wrapped in try/catch — malformed JSON is opaque
   - On success, extract integer `runnerPid`
5. For a valid runnerPid: check liveness via `node -e "try { process.kill(<pid>, 0); } catch { process.exit(1); }"`
   - Exit 0 → alive → attempt SIGTERM via `node -e "try { process.kill(<pid>, 'SIGTERM'); } catch (e) { console.error(e.code || e.message); process.exit(1); }"`
   - SIGTERM failure → capture error code/message, continue to deletion
   - Exit 1 → dead → skip signalling silently
6. Delete both files with `rm -f` (tolerates missing files)
   - Permission-denied on a file that exists → capture error, exit non-zero after reporting
7. Emit summary: removed files + signalled PID (if any) + any errors
```

---

## API / Interface Changes

### New Skill

| Skill | Invocation | Arguments | Purpose |
|-------|------------|-----------|---------|
| `nmg-sdlc:end-loop` | `/end-loop` or `/nmg-sdlc:end-loop` | None | Tear down unattended mode and runner state |

### Skill Frontmatter

```yaml
---
name: end-loop
description: "Stop unattended mode and clear runner state. Use when user says 'end loop', 'stop loop', 'kill the runner', 'exit unattended mode', 'disable unattended mode', 'cleanup runner artifacts', or 'stop SDLC automation'. Pairs with /run-loop — signals the runner PID (if live) and removes .claude/unattended-mode and .claude/sdlc-state.json."
argument-hint: ""
disable-model-invocation: true
allowed-tools: Read, Bash(test:*), Bash(node:*), Bash(rm:*), Bash(ls:*)
---
```

`Bash(node:*)` is required for cross-platform PID operations. `Bash(rm:*)` is required for file deletion. Both follow the run-loop skill's precedent.

### Output Contract

Happy path summary (AC1):
```
Stopped unattended mode.
  Signalled runner PID 12345 (SIGTERM)
  Removed .claude/unattended-mode
  Removed .claude/sdlc-state.json
```

Already-disabled (AC2, AC7):
```
Unattended mode already disabled — nothing to do.
```

No .claude directory (AC4):
```
Not a runner project — no .claude directory found.
```

Partial failure (AC5):
```
Stopped unattended mode (with warnings).
  Failed to signal PID 12345: Operation not permitted
  Removed .claude/unattended-mode
  Removed .claude/sdlc-state.json
```

Deletion failure (AC8):
```
Failed to remove .claude/unattended-mode: Permission denied
```
Exit code non-zero in this case.

---

## Database / Storage Changes

None. This skill only removes files; it never writes.

### Migration Plan

None — no schema or persistent state introduced.

### Data Migration

None.

---

## State Management

Stateless skill. Each invocation reads current filesystem state, acts, and exits. No runtime state is preserved between invocations.

### State Transitions

```
Enabled (artifacts present) → Disabled (artifacts removed)
Disabled (no artifacts) → Disabled (unchanged, reported as "already disabled")
Enabled-with-live-pid → Disabled-and-signalled
Enabled-with-dead-pid → Disabled (signal skipped silently)
Enabled-with-malformed-state → Disabled (PID extraction skipped, files still removed)
```

---

## UI Components

None. Command-line skill with plain text output only.

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Add a runtime script (`scripts/end-loop.mjs`)** | New Node.js script invoked by a thin skill | Reusable logic outside Claude Code; unit-testable with Jest | Adds a second place artifact paths are defined (risk of drift with `RUNNER_ARTIFACTS`); contradicts the skill-as-prompt architectural invariant for single-workflow skills | Rejected — overkill for a ~20-line cleanup workflow |
| **B: Skill with inline Bash and Node one-liners** | Pure prompt-based skill driving Bash + `node -e "..."` | Follows existing skill convention; zero new scripts; trivial to maintain | Error handling less ergonomic than a script; platform-sensitive choices live in the skill text | **Selected** — aligns with the plugin's skill-as-prompt invariant |
| **C: Add `--end` flag to `sdlc-runner.mjs`** | Extend the existing runner with a teardown subcommand | Keeps all artifact logic in one file | Runner is about orchestration, not point-cleanup; overloads its surface area; discoverability worse than a named skill | Rejected — wrong home for the capability |
| **D: SIGKILL escalation after SIGTERM** | Wait briefly, then SIGKILL if still alive | More aggressive cleanup of runaway runners | Introduces blocking wait; out of scope per the issue (SIGTERM only) | Rejected — issue scope excludes SIGKILL |

---

## Security Considerations

- [x] **Authentication**: N/A — local filesystem operation with the invoking user's permissions
- [x] **Authorization**: OS-level permissions enforce what files the user can delete and which processes they can signal. The skill does not attempt to escalate privileges.
- [x] **Input Validation**: `runnerPid` from `sdlc-state.json` is validated as a positive integer before passing to `process.kill`. Non-numeric or negative values skip SIGTERM to prevent signalling arbitrary processes (e.g., `process.kill(-1, 'SIGTERM')` would broadcast to the process group).
- [x] **Data Sanitization**: PID is interpolated into `node -e` command via `Bash`. The integer-validation step prevents shell injection; non-integer values never reach the command.
- [x] **Sensitive Data**: `sdlc-state.json` is deleted, not logged. Its contents (branch names, issue numbers) are not surfaced in skill output beyond the `runnerPid`.

---

## Performance Considerations

- [x] **Caching**: N/A
- [x] **Pagination**: N/A
- [x] **Lazy Loading**: N/A
- [x] **Indexing**: N/A
- [x] **Blocking operations**: SIGTERM is fire-and-forget — the skill does not wait for the runner process to exit. Total runtime in the happy path is dominated by `node -e` startup (~100ms on macOS); comfortably under the 2-second NFR target.

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Skill behaviour | Exercise testing (per `steering/tech.md`) | All 8 ACs exercised against a disposable test project with fabricated artifacts |
| Gherkin scenarios | BDD feature file | 1:1 mapping to ACs — happy path, already-disabled, dead PID, no .claude dir, SIGTERM failure, malformed state, idempotent re-run, permission-denied |
| Prompt quality | Manual review against `steering/tech.md` Prompt Quality table | Unambiguous instructions, complete workflow paths, correct tool references |

Exercise scenarios use `/tmp/`-based test projects per the Test Project Pattern. Live-PID scenarios spawn a benign background process (`node -e "setInterval(()=>{},1000)"` forked into the background) and use its PID as the fake `runnerPid`.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| PID reuse — `runnerPid` points to an unrelated process that coincidentally has the same PID | Low | High (could signal the wrong process) | Accepted risk: same risk the runner itself carries. Documented in AC5 — if SIGTERM fails (permission denied on unrelated process), the skill reports and continues. No programmatic way to verify PID identity without introducing a handshake protocol (out of scope). |
| Malformed `sdlc-state.json` causes JSON.parse to throw | Medium | Low | Explicit try/catch per AC6; file is deleted as opaque. |
| Cross-platform `rm -f` differences | Low | Low | `rm -f` is POSIX. Claude Code on Windows runs in a POSIX shell environment (git-bash/WSL) per the project's cross-platform invariants. Documented fallback: if `rm` is unavailable, the skill can use `node -e "require('node:fs').unlinkSync('...')"`. |
| Skill drifts from `RUNNER_ARTIFACTS` in `sdlc-runner.mjs` | Medium | Medium | Skill explicitly references `scripts/sdlc-runner.mjs:552` in comments; `/verify-code` should flag any change that adds a new runner artifact without updating the skill. |

---

## Open Questions

- [ ] None.

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #122 | 2026-04-18 | Initial feature spec |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Architecture follows existing project patterns (per `structure.md`) — skill-as-prompt pattern
- [x] All API/interface changes documented with schemas — new skill frontmatter and output contract
- [x] Database/storage changes planned with migrations — N/A
- [x] State management approach is clear — stateless
- [x] UI components and hierarchy defined — CLI output only
- [x] Security considerations addressed — PID integer validation, no privilege escalation
- [x] Performance impact analyzed — under 2s happy path
- [x] Testing strategy defined — exercise testing + Gherkin
- [x] Alternatives were considered and documented
- [x] Risks identified with mitigations
