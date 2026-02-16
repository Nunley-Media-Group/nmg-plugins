# Design: Configurable Post-Step Process Cleanup

**Issue**: #24
**Date**: 2026-02-15
**Status**: Draft
**Author**: Claude (from issue by rnunley-nmg)

---

## Overview

This feature adds a configurable process cleanup mechanism to the SDLC runner (`openclaw/scripts/sdlc-runner.mjs`). When enabled via a `cleanup.processPatterns` config field, the runner will kill processes matching the configured patterns at key transition points: after every step completes, during escalation, and on graceful shutdown.

The implementation is minimal — a single `cleanupProcesses()` function called from three existing code paths. It uses `pgrep`/`pkill` with `-f` (full command-line matching) to find and kill processes, enabling operators to target specific process configurations (e.g., Chrome launched with `--remote-debugging-port`) rather than all instances of a binary.

The cleanup is entirely optional: when `cleanup.processPatterns` is absent from the config, no cleanup runs and behavior is identical to the current version.

---

## Architecture

### Component Diagram

```
sdlc-runner.mjs (existing)
├── Config loading (line ~72)
│   └── NEW: Read config.cleanup.processPatterns → store in CLEANUP_PATTERNS
│
├── runStep() (line ~948)
│   ├── runClaude() → subprocess completes
│   └── NEW: cleanupProcesses() ← called after runClaude() returns, before success/failure branching
│
├── escalate() (line ~734)
│   └── NEW: cleanupProcesses() ← called at top, before committing partial work
│
└── handleSignal() (line ~912)
    └── NEW: cleanupProcesses() ← called after killing subprocess, before committing
```

### Data Flow

```
1. Runner loads config → extracts cleanup.processPatterns (or empty array)
2. Step N runs via runClaude() → Claude subprocess exits
3. cleanupProcesses() runs:
   a. For each pattern, run `pgrep -f <pattern>` to find matching PIDs
   b. If PIDs found, run `pkill -f <pattern>` to kill them
   c. Log pattern, PID count, and kill result
4. Runner continues to success/failure handling for Step N
5. (Same cleanup runs on escalation and graceful shutdown)
```

---

## API / Interface Changes

### Config Schema Addition

The `cleanup` field is a new optional top-level key in `sdlc-config.json`:

```json
{
  "projectPath": "/path/to/project",
  "pluginsPath": "/path/to/nmg-plugins",
  "model": "opus",
  "cleanup": {
    "processPatterns": ["--remote-debugging-port", "chromium"]
  },
  "steps": { ... }
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `cleanup` | object | No | `undefined` | Cleanup configuration block |
| `cleanup.processPatterns` | string[] | No | `[]` | Array of patterns matched against full process command line via `pgrep -f` / `pkill -f` |

### New Function: `cleanupProcesses()`

```javascript
/**
 * Kill processes matching configured cleanup patterns.
 * Non-fatal — logs warnings on failure, never throws.
 */
function cleanupProcesses() { ... }
```

- **Called from**: `runStep()`, `escalate()`, `handleSignal()`
- **Behavior**: No-op when `CLEANUP_PATTERNS` is empty
- **Error handling**: Catches all errors; logs warnings; never prevents the runner from continuing
- **Self-protection**: Excludes the runner's own PID from kills

---

## Database / Storage Changes

### Schema Changes

| Table / Collection | Column / Field | Type | Nullable | Default | Change |
|--------------------|----------------|------|----------|---------|--------|
| [name] | [name] | [type] | Yes/No | [value] | Add/Modify/Remove |

### Migration Plan

```
-- Describe the migration approach
-- Reference tech.md for migration conventions
```

### Data Migration

[If existing data needs transformation, describe the approach]

---

## State Management

Reference `structure.md` and `tech.md` for the project's state management patterns.

### New State Shape

```
// Pseudocode — use project's actual language/framework
FeatureState {
  isLoading: boolean
  items: List<Item>
  error: string | null
  selected: Item | null
}
```

### State Transitions

```
Initial → Loading → Success (with data)
                  → Error (with message)

User action → Optimistic update → Confirm / Rollback
```

---

## UI Components

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| [name] | [path per structure.md] | [description] |

### Component Hierarchy

```
FeatureScreen
├── Header
├── Content
│   ├── LoadingState
│   ├── ErrorState
│   ├── EmptyState
│   └── DataView
│       ├── ListItem × N
│       └── DetailView
└── Actions
```

---

## Implementation Details

### Config Loading

At line ~76 (after existing config parsing), extract the patterns:

```javascript
const CLEANUP_PATTERNS = config.cleanup?.processPatterns || [];
```

### cleanupProcesses() Function

```javascript
function cleanupProcesses() {
  if (CLEANUP_PATTERNS.length === 0) return;

  for (const pattern of CLEANUP_PATTERNS) {
    try {
      // Find matching PIDs (excluding our own process tree)
      const pids = execSync(`pgrep -f ${shellEscape(pattern)}`, { encoding: 'utf8', timeout: 5000 })
        .trim()
        .split('\n')
        .filter(pid => pid && parseInt(pid, 10) !== process.pid);

      if (pids.length === 0) continue;

      // Kill matching processes
      execSync(`pkill -f ${shellEscape(pattern)}`, { timeout: 5000 });
      log(`[CLEANUP] Killed ${pids.length} process(es) matching "${pattern}"`);
    } catch (err) {
      // pgrep/pkill exit with code 1 when no processes match — that's fine
      if (err.status === 1) continue;
      log(`[CLEANUP] Warning: cleanup for pattern "${pattern}" failed: ${err.message}`);
    }
  }
}
```

**Pattern escaping**: Patterns are passed through shell escaping to prevent command injection. A simple `shellEscape()` helper wraps the pattern in single quotes with internal single-quote escaping.

```javascript
function shellEscape(str) {
  return "'" + str.replace(/'/g, "'\\''") + "'";
}
```

### Integration Points

**1. runStep() — after runClaude() returns (line ~982)**

```javascript
const result = await runClaude(step, state);
log(`Step ${step.number} exited with code ${result.exitCode} in ${result.duration}s`);

// NEW: Clean up orphaned processes after every step
cleanupProcesses();

if (result.exitCode === 0) {
  // ... existing success handling
```

This covers AC2 (post-step cleanup on success and failure) and implicitly AC3 (escalation, since `handleFailure()` is called from within `runStep()` after cleanup already ran).

**2. escalate() — at the top (line ~734)**

```javascript
async function escalate(step, reason, output = '') {
  const state = readState();
  const truncated = (output || '').slice(-500);

  // NEW: Clean up orphaned processes on escalation
  cleanupProcesses();

  log(`ESCALATION: Step ${step.number} — ${reason}`);
  // ... existing escalation logic
```

Safety net for AC3 — ensures cleanup happens even if escalation is triggered from a code path that bypasses the normal `runStep()` post-Claude cleanup.

**3. handleSignal() — after killing subprocess (line ~918)**

```javascript
async function handleSignal(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`Received ${signal}. Shutting down gracefully...`);

  if (currentProcess && !currentProcess.killed) {
    currentProcess.kill('SIGTERM');
  }

  // NEW: Clean up orphaned processes on shutdown
  cleanupProcesses();

  // ... existing commit/push logic
```

Covers AC4 (graceful shutdown).

### Config Example Update

Update `openclaw/scripts/sdlc-config.example.json` to include the new field with a comment-equivalent entry:

```json
{
  "cleanup": {
    "processPatterns": ["--remote-debugging-port"]
  }
}
```

### Documentation Update

Update `openclaw/skills/running-sdlc/SKILL.md` to document the new config option in its config reference section.

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Process group killing** | Use `kill -TERM -<pgid>` to kill the entire process group of each Claude subprocess | Kills all descendants automatically | Platform-specific; requires process group tracking; kills Claude subprocess too early on timeout | Rejected — too invasive, platform issues |
| **B: pgrep/pkill with -f** | Pattern-match against full command line | Simple; cross-platform (macOS + Linux); precise targeting via CLI flags | Requires user to know command-line patterns | **Selected** — matches issue requirements exactly |
| **C: Node.js process listing** | Use `node:child_process` to parse `ps aux` output and kill programmatically | Full control; richer logging | More code; `ps` output format varies across platforms; reinvents pkill | Rejected — unnecessary complexity |

---

## Security Considerations

- [ ] **Authentication**: [How auth is enforced]
- [ ] **Authorization**: [Permission checks required]
- [ ] **Input Validation**: [Validation approach]
- [ ] **Data Sanitization**: [How data is sanitized]
- [ ] **Sensitive Data**: [How sensitive data is handled]

---

## Performance Considerations

- [ ] **Caching**: [Caching strategy]
- [ ] **Pagination**: [Pagination approach for large datasets]
- [ ] **Lazy Loading**: [What loads lazily]
- [ ] **Indexing**: [Database indexes or search indexes needed]

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| cleanupProcesses() | Design artifact (Gherkin) | All 6 acceptance criteria as BDD scenarios |
| Config parsing | Design artifact (Gherkin) | Presence/absence of cleanup field |
| Integration points | Design artifact (Gherkin) | Cleanup called from runStep, escalate, handleSignal |

Since `sdlc-runner.mjs` is a zero-dependency script without a test framework, verification is performed via the `/verifying-specs` skill (manual or automated review against the spec) and the Gherkin feature file serves as a design artifact per `tech.md`.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Pattern matches unintended processes (e.g., user's browser) | Medium | High | Document that patterns should be specific (e.g., `--remote-debugging-port` not `chrome`); operator configures patterns |
| `pkill` kills the runner itself | Low | High | Filter `process.pid` from matches; use sufficiently specific patterns |
| `pgrep`/`pkill` not available on target OS | Low | Medium | Both are standard on macOS and Linux; out of scope for Windows |
| Cleanup delays step transitions | Low | Low | 5-second timeout on `pgrep`/`pkill`; non-fatal error handling |
| Double cleanup (runStep + escalate) | Low | None | Killing already-dead processes is a no-op; `pgrep` returns exit 1 when no matches |

---

## Open Questions

- [ ] Should there be a configurable grace period (SIGTERM then SIGKILL after delay) for cleaned-up processes, or is immediate `pkill` (SIGTERM) sufficient? Current design uses `pkill` which sends SIGTERM by default.

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Architecture follows existing project patterns (per `structure.md`)
- [x] All API/interface changes documented with schemas
- [x] N/A — Database/storage changes planned with migrations
- [x] N/A — State management approach is clear (no new state fields)
- [x] N/A — UI components and hierarchy defined
- [x] Security considerations addressed (shell escaping, PID filtering)
- [x] Performance impact analyzed (< 5s timeout, non-blocking)
- [x] Testing strategy defined (Gherkin design artifacts)
- [x] Alternatives were considered and documented
- [x] Risks identified with mitigations
