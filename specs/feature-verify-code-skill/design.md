# Design: Verifying Specs Skill

**Issues**: #7, #109
**Date**: 2026-03-03
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/verify-code` skill is the quality gate of the nmg-sdlc workflow. It performs a comprehensive 9-step verification: load specs, load issue, verify implementation against acceptance criteria, run architecture review via the `architecture-reviewer` subagent, verify test coverage, fix findings (under ~20 lines), generate a verification report, update the GitHub issue, and output results.

The architecture review is delegated to a dedicated `nmg-sdlc:architecture-reviewer` agent that evaluates code against five checklist dimensions: SOLID principles, security (OWASP-aligned), performance patterns, testability, and error handling. Six checklist files in `checklists/` provide the evaluation criteria, and a report template standardizes the output format.

For bug fixes, verification shifts focus to reproduction checks, `@regression` scenario validation, blast radius assessment, and minimal change audit.

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│              /verify-code Skill                           │
├──────────────────────────────────────────────────────────────┤
│  Step 1: Load specs + steering docs ──────────────────┐      │
│          ├── Extract verification gates from tech.md  │      │
│  Step 2: Load issue                                   │      │
│  Step 3: Verify implementation (AC by AC)             │      │
│  Step 4: Architecture review ─────────────────────┐   │      │
│  Step 5: Verify test coverage                     │   │      │
│          ├── BDD / exercise testing               │   │      │
│          └── Execute verification gates ◄─────────┼───┘      │
│  Step 6: Fix findings (<20 lines)                 │          │
│  Step 7: Generate report (includes gate results)  │          │
│  Step 8: Update GitHub issue                      │          │
│  Step 9: Output                                   │          │
└───────────────────────────────────────────────────┼──────────┘
                                                    │
                                                    ▼
                              ┌─────────────────────────────┐
                              │ architecture-reviewer Agent   │
                              │  ├── SOLID principles         │
                              │  ├── Security (OWASP)         │
                              │  ├── Performance              │
                              │  ├── Testability              │
                              │  └── Error handling           │
                              └─────────────────────────────┘
                                         │
                                         ▼
                              ┌─────────────────────────────┐
                              │     checklists/               │
                              │  ├── solid-principles.md      │
                              │  ├── security.md              │
                              │  ├── performance.md           │
                              │  ├── testability.md           │
                              │  ├── error-handling.md        │
                              │  └── report-template.md       │
                              └─────────────────────────────┘

Gate data flow:

    tech.md                    Step 1                  Step 5
 ┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
 │ ## Verifi-   │────▶│  Parse table,    │────▶│  For each gate:  │
 │ cation Gates │     │  extract gates   │     │  1. Check cond.  │
 │              │     │  as named steps  │     │  2. Run action   │
 │ | Gate | ... │     └──────────────────┘     │  3. Eval criteria│
 └─────────────┘                               │  4. Record result│
                                               └──────────────────┘
                                                        │
                                                        ▼
                                               ┌──────────────────┐
                                               │ Report: Steering │
                                               │ Doc Verification │
                                               │ Gates section    │
                                               └──────────────────┘
```

### Data Flow

```
1. Load spec files from specs/{feature-name}/
   1a. Load steering docs (steering/)
   1b. Parse ## Verification Gates table from tech.md → extract named gates
2. Read GitHub issue via gh issue view
3. For each AC: find implementing code via Glob/Grep → mark Pass/Fail
4. Spawn architecture-reviewer agent with Task tool
5. Check BDD scenario coverage against ACs
   5f. Execute each applicable verification gate:
       - Evaluate condition (file/dir exists, "always", etc.)
       - If applicable: run action via Bash, evaluate pass criteria
       - If not applicable: skip (not recorded as Incomplete)
       - If applicable but unexecutable: record as Incomplete with reason
6. Fix findings under ~20 lines; defer larger ones
7. Generate report from report-template.md (includes gate results section)
8. Post verification comment on GitHub issue
9. Output summary with scores, gate results, and recommendation
```

---

## Verification Gates Design

### Gate Definition Format (tech.md)

The `## Verification Gates` section in a project's `tech.md` declares mandatory verification steps using a structured table:

```markdown
## Verification Gates

| Gate | Condition | Action | Pass Criteria |
|------|-----------|--------|---------------|
| Robot E2E Tests | `integration_test/` directory exists | `flutter test integration_test/` | Exit code 0 |
| API Contract Tests | `contracts/` directory exists | `npm run test:contracts` | Exit code 0 |
| Accessibility Audit | Always | `npx pa11y-ci` | Exit code 0 |
| Coverage Threshold | Always | `npm run test:coverage` | `coverage/lcov.info` file generated AND exit code 0 |
```

**Column semantics:**

| Column | Purpose | Examples |
|--------|---------|----------|
| **Gate** | Human-readable gate name (used in report) | "Robot E2E Tests", "Load Tests" |
| **Condition** | When the gate applies — evaluated before execution | `Always`, `path/to/dir/ directory exists`, `*.feature files exist in test/` |
| **Action** | Shell command to execute | Any shell command; evaluated via Bash tool |
| **Pass Criteria** | How to determine success | `Exit code 0`, `Exit code 0 AND output contains "PASSED"`, `report.xml file generated` |

**Condition evaluation rules:**
- `Always` — gate always applies
- `{path} directory exists` — check via `test -d {path}`
- `{glob} files exist in {path}` — check via `ls {path}/{glob}` or Glob tool
- If no `## Verification Gates` section exists in tech.md → no gates are enforced (backward-compatible)

**Pass criteria evaluation rules:**
- `Exit code 0` — check the exit code of the Action command
- `{file} file generated` — check that the file exists after Action completes (artifact verification)
- Compound criteria use `AND` — all sub-criteria must be satisfied
- The skill evaluates these textual criteria against the actual result; it does NOT contain stack-specific logic

### Gate Execution Logic (Step 5f)

After BDD/exercise verification in Step 5, the skill executes each extracted gate:

```
For each gate extracted from tech.md:
  1. Evaluate Condition
     - If condition is not met → skip gate (not included in report)
     - If condition cannot be evaluated → record as Incomplete("Cannot evaluate condition: {reason}")

  2. Execute Action
     - Run the Action command via Bash
     - Capture exit code, stdout, and stderr
     - If command not found or prerequisites missing → record as Incomplete("Tool unavailable: {details}")
     - If command times out → record as Incomplete("Command timed out")

  3. Evaluate Pass Criteria
     - Parse the Pass Criteria string
     - Check exit code if specified
     - Check artifact existence if specified
     - Check output content if specified
     - All sub-criteria must pass → gate Pass
     - Any sub-criteria fails → gate Fail

  4. Record Result
     - Gate name, status (Pass/Fail/Incomplete), evidence (output excerpt or blocker reason)
```

### Status Aggregation

Gate results affect the overall verification status:

| Gate Results | Overall Status Impact |
|-------------|----------------------|
| All gates Pass | No effect (status determined by other factors) |
| Any gate Fail, none Incomplete | Overall status cannot exceed "Partial" |
| Any gate Incomplete, none Fail | Overall status cannot exceed "Incomplete" |
| Mix of Fail and Incomplete | Overall status cannot exceed "Incomplete" |
| No `## Verification Gates` section | No effect (backward-compatible) |

The hierarchy from best to worst: Pass > Partial > Incomplete > Fail.

### Report Template Section

A new "Steering Doc Verification Gates" section is added to `report-template.md` between "Exercise Test Results" and "Fixes Applied":

```markdown
## Steering Doc Verification Gates

*Include this section when verification gates were extracted from tech.md. Omit entirely if tech.md has no `## Verification Gates` section.*

| Gate | Status | Evidence |
|------|--------|----------|
| [gate name] | Pass / Fail / Incomplete | [output excerpt, artifact path, or blocker reason] |

**Gate Summary**: [X/Y] gates passed, [Z] failed, [W] incomplete
```

### Migration Path

The `setup-steering` tech.md template is updated to include the `## Verification Gates` section with placeholder content. The `migrate-project` skill is template-driven — it detects missing sections by comparing a project's `tech.md` headings against the template's headings. Adding the section to the template automatically enables migration detection for existing projects. No code changes to migrate-project are needed; the design relies on its existing section-merge mechanism.

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

## File Changes

| File | Type | Purpose |
|------|------|---------|
| `plugins/nmg-sdlc/skills/verify-code/SKILL.md` | Create (#7) / Modify (#109) | Skill definition — #109 adds gate extraction to Step 1 and gate execution sub-step 5f to Step 5, plus status aggregation logic |
| `plugins/nmg-sdlc/skills/verify-code/checklists/solid-principles.md` | Create (#7) | SOLID compliance checklist |
| `plugins/nmg-sdlc/skills/verify-code/checklists/security.md` | Create (#7) | Security review checklist |
| `plugins/nmg-sdlc/skills/verify-code/checklists/performance.md` | Create (#7) | Performance patterns checklist |
| `plugins/nmg-sdlc/skills/verify-code/checklists/testability.md` | Create (#7) | Testability assessment checklist |
| `plugins/nmg-sdlc/skills/verify-code/checklists/error-handling.md` | Create (#7) | Error handling checklist |
| `plugins/nmg-sdlc/skills/verify-code/checklists/report-template.md` | Create (#7) / Modify (#109) | Verification report template — #109 adds "Steering Doc Verification Gates" section |
| `plugins/nmg-sdlc/agents/architecture-reviewer.md` | Create (#7) | Architecture review agent definition |
| `plugins/nmg-sdlc/skills/setup-steering/templates/tech.md` | Modify (#109) | Add `## Verification Gates` section with table template and TODO comments |
| `README.md` | Modify (#109) | Document Verification Gates convention and tech.md gate format |

---

## Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| Read-only verification | Report findings without fixing | Rejected — auto-fix saves developer time |
| Fix everything | Auto-fix all findings regardless of size | Rejected — large fixes need human review |
| **Fix small, defer large** | Auto-fix <20 lines, defer the rest | **Selected** — safe and efficient |
| Prose-based gate detection | Parse natural language in tech.md to infer mandatory gates | Rejected — unreliable, ambiguous, not actionable (#109) |
| Separate gates.md file | Put gates in a standalone file outside tech.md | Rejected — adds file overhead; tech.md already defines technical constraints (#109) |
| **Structured table in tech.md** | `## Verification Gates` section with Name/Condition/Action/Pass Criteria columns | **Selected** — stack-agnostic, parseable, lives with other tech constraints (#109) |
| Hard fail on Incomplete gates | Treat Incomplete as Fail | Rejected — penalizes environments where tools are legitimately absent (#109) |
| **Incomplete as distinct status** | Separate Incomplete from Pass and Fail | **Selected** — distinguishes "didn't run" from "ran and failed" (#109) |

---

## Security Considerations

- [x] Verification reports contain file paths and findings, no secrets
- [x] GitHub issue comments are posted via authenticated `gh` CLI
- [x] Architecture reviewer has read-only access (Read, Glob, Grep)

---

## Performance Considerations

- [x] Architecture reviewer runs as a subagent (parallel with main context)
- [x] Checklist files are small Markdown, fast to read
- [x] Fix cycle is bounded by ~20 line threshold

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Verification Logic | BDD | Scenarios for AC verification, auto-fix, reporting |
| Architecture Review | BDD | Scenario for agent delegation |
| Defect Verification | BDD | Scenario for regression checks |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [risk] | Low/Med/High | Low/Med/High | [approach] |

---

## Open Questions

- [ ] [Technical question]
- [ ] [Architecture question]
- [ ] [Integration question]

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #7 | 2026-02-15 | Initial feature spec |
| #109 | 2026-03-03 | Add verification gates design: structured gate format in tech.md, gate extraction/execution logic, status aggregation, report template section, migration path via template update |

---

## Validation Checklist

- [x] Architecture follows existing skill patterns
- [x] All file changes documented
- [x] Security considerations addressed
- [x] Alternatives considered
