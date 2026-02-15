# Design: Creating Issues Skill

**Issue**: #4
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/creating-issues` skill implements an adaptive interview workflow that gathers feature requirements from the user and produces well-structured GitHub issues. The skill supports two modes: interactive (with 2-3 rounds of adaptive questioning) and automation (skipping the interview entirely, inferring criteria from steering docs).

The skill produces issues in one of two templates: a feature/enhancement template (User Story, Background, Acceptance Criteria in Given/When/Then, Functional Requirements, Out of Scope) or a bug report template (reproduction steps, expected/actual behavior, environment table, defect-focused acceptance criteria). The output format directly feeds `/writing-specs` for downstream spec generation.

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────┐
│          /creating-issues Skill              │
├─────────────────────────────────────────────┤
│  Step 1: Gather Context                      │
│    └── Read .claude/steering/product.md      │
│  Step 2: Interview User (or skip in auto)    │
│    └── AskUserQuestion (2-3 rounds)          │
│  Step 3: Synthesize Issue Body               │
│    ├── Feature template                      │
│    └── Bug report template                   │
│  Step 4: Present Draft for Review            │
│  Step 5: Create Issue (gh issue create)      │
│  Step 6: Output summary                      │
└─────────────────────────────────────────────┘
```

### Data Flow

```
1. User invokes /creating-issues [description]
2. Skill reads steering docs for product context
3. Interactive: adaptive interview (2-3 rounds)
   Auto: infer criteria from steering docs + description
4. Synthesize into feature or bug report template
5. Present draft for review (skip in auto)
6. Create issue via gh issue create
7. Output issue URL and next steps
```

---

## File Changes

| File | Type | Purpose |
|------|------|---------|
| `plugins/nmg-sdlc/skills/creating-issues/SKILL.md` | Create | Skill definition with 6-step workflow |

---

## Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| Free-form issue creation | No template, user writes freely | Rejected — inconsistent format |
| Form-based template | Fixed-field GitHub issue template | Rejected — too rigid, loses conversational context |
| **Adaptive interview** | Guided conversation with template output | **Selected** — balances structure with flexibility |

---

## Security Considerations

- [x] Issues created via authenticated `gh` CLI
- [x] No sensitive data included in issue templates
- [x] Interview content stays within the Claude session

---

## Performance Considerations

- [x] Single `gh issue create` call for issue creation
- [x] Steering doc reads are local file operations
- [x] Interview rounds are user-paced, not system-bound

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Issue Creation | BDD | Scenarios for feature, bug, and auto-mode |
| Template Output | Manual | Verify issue body matches expected format |

---

## Validation Checklist

- [x] Architecture follows existing skill patterns
- [x] File changes documented
- [x] Security considerations addressed
- [x] Alternatives considered
