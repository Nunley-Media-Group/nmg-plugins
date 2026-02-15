# Design: Verifying Specs Skill

**Issue**: #7
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/verifying-specs` skill is the quality gate of the nmg-sdlc workflow. It performs a comprehensive 9-step verification: load specs, load issue, verify implementation against acceptance criteria, run architecture review via the `architecture-reviewer` subagent, verify test coverage, fix findings (under ~20 lines), generate a verification report, update the GitHub issue, and output results.

The architecture review is delegated to a dedicated `nmg-sdlc:architecture-reviewer` agent that evaluates code against five checklist dimensions: SOLID principles, security (OWASP-aligned), performance patterns, testability, and error handling. Six checklist files in `checklists/` provide the evaluation criteria, and a report template standardizes the output format.

For bug fixes, verification shifts focus to reproduction checks, `@regression` scenario validation, blast radius assessment, and minimal change audit.

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────────────┐
│              /verifying-specs Skill                     │
├──────────────────────────────────────────────────────┤
│  Steps 1-2: Load specs + issue                         │
│  Step 3: Verify implementation (AC by AC)              │
│  Step 4: Architecture review ──────────────────┐       │
│  Step 5: Verify test coverage                  │       │
│  Step 6: Fix findings (<20 lines)              │       │
│  Step 7: Generate report                       │       │
│  Step 8: Update GitHub issue                   │       │
│  Step 9: Output                                │       │
└────────────────────────────────────────────────┼───────┘
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
```

### Data Flow

```
1. Load spec files from .claude/specs/{feature-name}/
2. Read GitHub issue via gh issue view
3. For each AC: find implementing code via Glob/Grep → mark Pass/Fail
4. Spawn architecture-reviewer agent with Task tool
5. Check BDD scenario coverage against ACs
6. Fix findings under ~20 lines; defer larger ones
7. Generate report from report-template.md
8. Post verification comment on GitHub issue
9. Output summary with scores and recommendation
```

---

## File Changes

| File | Type | Purpose |
|------|------|---------|
| `plugins/nmg-sdlc/skills/verifying-specs/SKILL.md` | Create | Skill definition with 9-step workflow |
| `plugins/nmg-sdlc/skills/verifying-specs/checklists/solid-principles.md` | Create | SOLID compliance checklist |
| `plugins/nmg-sdlc/skills/verifying-specs/checklists/security.md` | Create | Security review checklist |
| `plugins/nmg-sdlc/skills/verifying-specs/checklists/performance.md` | Create | Performance patterns checklist |
| `plugins/nmg-sdlc/skills/verifying-specs/checklists/testability.md` | Create | Testability assessment checklist |
| `plugins/nmg-sdlc/skills/verifying-specs/checklists/error-handling.md` | Create | Error handling checklist |
| `plugins/nmg-sdlc/skills/verifying-specs/checklists/report-template.md` | Create | Verification report template |
| `plugins/nmg-sdlc/agents/architecture-reviewer.md` | Create | Architecture review agent definition |

---

## Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| Read-only verification | Report findings without fixing | Rejected — auto-fix saves developer time |
| Fix everything | Auto-fix all findings regardless of size | Rejected — large fixes need human review |
| **Fix small, defer large** | Auto-fix <20 lines, defer the rest | **Selected** — safe and efficient |

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

## Validation Checklist

- [x] Architecture follows existing skill patterns
- [x] All file changes documented
- [x] Security considerations addressed
- [x] Alternatives considered
