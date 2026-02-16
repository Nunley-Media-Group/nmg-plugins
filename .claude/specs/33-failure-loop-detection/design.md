# Design: Failure Loop Detection and Halt

**Issue**: #33
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude

---

## Overview

The SDLC runner's outer `while (!shuttingDown)` loop has no failure cap. After an escalation, it immediately picks up the next (or same) issue and can fail again indefinitely. This design adds three in-memory tracking mechanisms — consecutive escalation count, an escalated-issues set, and a per-cycle bounce counter — with a new `haltFailureLoop()` function that exits immediately without cleanup, preserving state for manual inspection.

All changes are confined to `openclaw/scripts/sdlc-runner.mjs`. The approach modifies the existing `escalate()` function, the `handleFailure()` / `runStep()` retry-previous paths, and the main loop's cycle management. No new files, no external dependencies, no changes to the skill layer.

---

## Architecture

### Component Diagram

```
sdlc-runner.mjs
├── In-Memory Tracking (new)
│   ├── consecutiveEscalations: number    ← reset on successful step 9
│   ├── escalatedIssues: Set<number>      ← grows per session, never reset
│   └── bounceCount: number               ← reset at start of each cycle
│
├── haltFailureLoop(type, details) (new)
│   ├── Posts diagnostic to Discord
│   └── process.exit(1) — NO cleanup
│
├── escalate() (modified)
│   ├── Records issue in escalatedIssues
│   ├── Increments consecutiveEscalations
│   ├── Checks threshold → haltFailureLoop() if exceeded
│   └── Normal cleanup (commit, checkout main, reset state) if under threshold
│
├── handleFailure() (modified)
│   └── retry-previous path: increments bounceCount, checks threshold
│
├── runStep() (modified)
│   └── Precondition retry-previous path: increments bounceCount, checks threshold
│
├── buildClaudeArgs() (modified)
│   └── Step 2 prompt: includes escalated issue exclusion list
│
└── main() loop (modified)
    ├── Before step 2: check if non-escalated issues exist
    ├── After step 2: verify selected issue is not in escalatedIssues
    ├── Start of cycle: reset bounceCount
    └── After successful step 9: reset consecutiveEscalations
```

### Data Flow

```
1. Step fails → handleFailure() or runStep() precondition check
2. If retry-previous: increment bounceCount → if > MAX_RETRIES, escalate + halt
3. If escalation: escalate() → add issue to set, increment consecutive count
4. If consecutiveEscalations >= 2: haltFailureLoop() → Discord + exit(1)
5. If normal escalation: cleanup as usual → outer loop continues
6. Before next step 2: filter open issues against escalatedIssues
7. If all issues escalated: haltFailureLoop() → Discord + exit(1)
8. If step 9 succeeds: reset consecutiveEscalations to 0
```

---

## API / Interface Changes

### New Endpoints / Methods

| Endpoint / Method | Type | Auth | Purpose |
|-------------------|------|------|---------|
| [path or signature] | [GET/POST/etc or method] | [Yes/No] | [description] |

### Request / Response Schemas

#### [Endpoint or Method Name]

**Input:**
```json
{
  "field1": "string",
  "field2": 123
}
```

**Output (success):**
```json
{
  "id": "string",
  "field1": "string",
  "createdAt": "ISO8601"
}
```

**Errors:**

| Code / Type | Condition |
|-------------|-----------|
| [error code] | [when this happens] |

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

## Detailed Changes

### 1. New In-Memory Tracking Variables

**Location**: After line 79 (after config loading, before step definitions)

```javascript
// Failure loop detection — in-memory, not persisted to state file
let consecutiveEscalations = 0;
const escalatedIssues = new Set();
let bounceCount = 0;
```

These are module-level variables, scoped to the runner process lifetime. They are intentionally NOT persisted to `sdlc-state.json` — a fresh runner start gets a clean slate.

### 2. New `haltFailureLoop()` Function

**Location**: After `escalate()` (after line 815)

```javascript
async function haltFailureLoop(loopType, details) {
  const diagnostic = [
    `FAILURE LOOP DETECTED: ${loopType}`,
    ...details,
    `Consecutive escalations: ${consecutiveEscalations}`,
    `Escalated issues: ${[...escalatedIssues].map(n => '#' + n).join(', ') || 'none'}`,
    'Runner halting. State preserved for manual inspection.',
    'sdlc-state.json, .claude/auto-mode, and working tree left as-is.',
  ].filter(Boolean).join('\n');

  log(diagnostic);
  await postDiscord(diagnostic);
  process.exit(1);
}
```

**Key design decision**: This function does NOT call `removeAutoMode()`, `updateState()`, or `git checkout main`. It exits immediately, preserving the full failure state for debugging. This is the critical difference from `escalate()`.

### 3. Modified `escalate()` Function

**Current behavior** (lines 777–815): Commits partial work, checks out main, posts diagnostic, removes auto-mode, resets state.

**New behavior**: Before cleanup, record the issue in `escalatedIssues`, increment `consecutiveEscalations`, and check the threshold. If threshold is reached, delegate to `haltFailureLoop()` instead of doing normal cleanup.

```javascript
async function escalate(step, reason, output = '') {
  const state = readState();
  const truncated = (output || '').slice(-500);

  // --- NEW: Track failure loop metrics ---
  if (state.currentIssue) {
    escalatedIssues.add(state.currentIssue);
  }
  consecutiveEscalations++;

  if (consecutiveEscalations >= 2) {
    await haltFailureLoop('consecutive escalations', [
      `${consecutiveEscalations} consecutive cycles resulted in escalation.`,
      `Last step: ${step.number} (${step.key})`,
      `Reason: ${reason}`,
      `Affected issues: ${[...escalatedIssues].map(n => '#' + n).join(', ')}`,
      truncated ? `Last output: ...${truncated}` : '',
    ]);
    // haltFailureLoop calls process.exit, so this line is unreachable
  }
  // --- END NEW ---

  cleanupProcesses();
  log(`ESCALATION: Step ${step.number} — ${reason}`);

  // ... rest of existing escalate() unchanged ...
}
```

### 4. Modified `handleFailure()` — Bounce Loop Detection

**Current behavior** (line 738): Returns `'retry-previous'` without any limit checking.

**New behavior**: Increment `bounceCount` before returning. If threshold exceeded, escalate and halt.

```javascript
// In handleFailure(), the retry-previous path (around line 738):
if (!preconds.ok) {
  bounceCount++;
  if (bounceCount > MAX_RETRIES) {
    log(`Bounce loop detected: ${bounceCount} step-back transitions exceed threshold ${MAX_RETRIES}`);
    await escalate(step, `Bounce loop: ${bounceCount} step-back transitions in cycle`, output);
    // escalate() will either halt (if consecutive threshold met) or do normal cleanup
    return 'escalated';
  }
  log(`Step ${step.number} preconditions failed: ${preconds.reason}. Will retry step ${prevStep.number}. (bounce ${bounceCount}/${MAX_RETRIES})`);
  await postDiscord(`Step ${step.number} preconditions failed: ${preconds.reason}. Retrying Step ${prevStep.number}. (bounce ${bounceCount}/${MAX_RETRIES})`);
  return 'retry-previous';
}
```

### 5. Modified `runStep()` — Bounce Loop Detection on Precondition Failure

**Current behavior** (lines 1021–1035): Returns `'retry-previous'` with per-step retry counting.

**New behavior**: Also increment `bounceCount` and check threshold.

```javascript
// In runStep(), the precondition retry-previous path (around line 1021):
if (step.number > 1) {
  bounceCount++;
  if (bounceCount > MAX_RETRIES) {
    log(`Bounce loop detected: ${bounceCount} step-back transitions exceed threshold ${MAX_RETRIES}`);
    await escalate(step, `Bounce loop: ${bounceCount} step-back transitions in cycle`);
    return 'escalated';
  }
  // ... existing retry logic for previous step ...
}
```

### 6. Modified `buildClaudeArgs()` — Issue Exclusion List

**Current behavior** (line 577): Step 2 prompt says "Select and start the next GitHub issue".

**New behavior**: If `escalatedIssues` is non-empty, append an exclusion clause.

```javascript
// In buildClaudeArgs(), step 2 prompt:
let step2Prompt = `Select and start the next GitHub issue from the current milestone. ...`;
if (escalatedIssues.size > 0) {
  const exclusionList = [...escalatedIssues].map(n => '#' + n).join(', ');
  step2Prompt += ` IMPORTANT: Do NOT select any of these previously-escalated issues: ${exclusionList}. Choose a different open issue.`;
}
```

### 7. Modified Main Loop — Cycle Management

**Reset `bounceCount` at cycle start** (before the for-loop):

```javascript
// Before for-loop at line 1223:
bounceCount = 0;
```

**Check for non-escalated issues before step 2** (inside the for-loop, after step 1 completes):

After step 2 succeeds, verify the selected issue isn't in the escalated set:

```javascript
// After step 2's extractStateFromStep():
if (step.number === 2 && state.currentIssue && escalatedIssues.has(state.currentIssue)) {
  // Claude selected an escalated issue despite the exclusion prompt
  await haltFailureLoop('all issues escalated', [
    `All remaining open issues have been escalated in this session.`,
    `Escalated issues: ${[...escalatedIssues].map(n => '#' + n).join(', ')}`,
    `Last selected: #${state.currentIssue}`,
  ]);
}
```

**Reset `consecutiveEscalations` on successful cycle** (step 9 success):

```javascript
// After step 9 completes successfully:
if (step.number === 9) {
  consecutiveEscalations = 0;
}
```

### 8. New `hasNonEscalatedIssues()` Helper

**Location**: After `hasOpenIssues()` (after line 889)

```javascript
function hasNonEscalatedIssues() {
  if (escalatedIssues.size === 0) return true;
  try {
    const issues = gh('issue list --state open --json number');
    const parsed = JSON.parse(issues);
    return parsed.some(issue => !escalatedIssues.has(issue.number));
  } catch {
    return true; // Conservative: assume non-escalated issues exist
  }
}
```

**Used in the main loop** before entering the cycle:

```javascript
if (!DRY_RUN && !hasNonEscalatedIssues()) {
  await haltFailureLoop('all issues escalated', [
    `All open issues have been escalated in this session.`,
    `Escalated issues: ${[...escalatedIssues].map(n => '#' + n).join(', ')}`,
  ]);
}
```

---

## Alternatives Considered

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| **A: Persistent tracking** | Store failure loop counters in `sdlc-state.json` | Survives restarts | Complicates state management; stale data after manual intervention | Rejected — issue explicitly scopes to in-memory only |
| **B: Configurable thresholds** | Add `maxConsecutiveEscalations`, `maxBounces` to config | Flexible per-project | Over-engineering for first iteration; issue explicitly says hardcode defaults | Rejected — out of scope |
| **C: Modify `escalate()` to accept cleanup flag** | Pass `skipCleanup: true` to `escalate()` | Reuses existing function | Increases complexity of `escalate()`, changes its contract | Rejected — separate `haltFailureLoop()` is clearer |
| **D: Separate `haltFailureLoop()` + check-before-escalate** | Increment counter and check before doing cleanup | Clean separation of concerns, single responsibility | Two functions for exit behavior | **Selected** — clearest contract |

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
| Failure loop detection | BDD (Gherkin) | All 5 acceptance criteria as scenarios |
| `haltFailureLoop()` | Design artifact | Posts diagnostic, exits without cleanup |
| `escalate()` modifications | Design artifact | Tracks issues and consecutive count |
| Bounce count tracking | Design artifact | Increments on retry-previous, resets per cycle |
| Issue exclusion | Design artifact | Step 2 prompt includes exclusion list |

Per `tech.md`, this project uses Gherkin specs as design artifacts rather than executable tests. Verification is done through `/verifying-specs`.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `process.exit(1)` in `haltFailureLoop()` prevents graceful async cleanup | Low | Medium | Discord message is posted before exit; state is preserved on disk |
| Step 2 prompt exclusion ignored by Claude | Low | Low | Post-step-2 safety check detects and halts if escalated issue selected |
| `bounceCount` threshold too low for complex step dependencies | Low | Medium | Reuses `maxRetriesPerStep` (default 3) — matches existing per-step tolerance |
| `hasNonEscalatedIssues()` GitHub query fails | Low | Low | Conservative fallback returns `true` (assumes issues exist) |

---

## Open Questions

- [ ] [Technical question]
- [ ] [Architecture question]
- [ ] [Integration question]

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Architecture follows existing project patterns (per `structure.md`)
- [x] All changes confined to a single file (`sdlc-runner.mjs`)
- [x] No new external dependencies (uses only `node:*` built-ins)
- [x] State management approach is clear (in-memory tracking, no persistence)
- [x] Security considerations addressed (no new secrets or auth)
- [x] Performance impact analyzed (negligible — in-memory counters and sets)
- [x] Testing strategy defined (Gherkin design artifacts)
- [x] Alternatives were considered and documented
- [x] Risks identified with mitigations
- [x] Cross-platform compatibility maintained (no platform-specific code)
