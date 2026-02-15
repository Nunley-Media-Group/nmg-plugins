# Design: Creating PRs Skill

**Issue**: #8
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/creating-prs` skill is the final step of the interactive SDLC workflow. It gathers context from the GitHub issue, spec files, git state, and verification results, then generates a structured PR body and creates the pull request via `gh pr create`. The skill uses conventional commit prefixes for PR titles and includes acceptance criteria as a checklist for reviewers.

The skill has `disable-model-invocation: true` in its frontmatter, meaning it follows the SKILL.md instructions deterministically without model-driven behavior. This makes PR creation predictable and reproducible.

---

## Architecture

### Component Diagram

```
┌────────────────────────────────────────────┐
│          /creating-prs Skill                │
├────────────────────────────────────────────┤
│  Step 1: Read Context                       │
│    ├── gh issue view #N                     │
│    ├── .claude/specs/{feature}/req.md        │
│    ├── .claude/specs/{feature}/tasks.md      │
│    ├── git status, git log, git diff         │
│  Step 2: Generate PR Content                 │
│    ├── Title (conventional commit prefix)    │
│    └── Body (summary, ACs, test plan, specs) │
│  Step 3: Push and Create PR                  │
│    ├── git push -u origin HEAD               │
│    └── gh pr create                          │
│  Step 4: Output                              │
└────────────────────────────────────────────┘
```

### Data Flow

```
1. Read issue, specs, and git state
2. Generate PR title with conventional commit prefix
3. Generate PR body with summary, AC checklist, test plan, spec links
4. Ensure branch is pushed to remote
5. Create PR via gh pr create
6. Output PR URL and summary
```

---

## File Changes

| File | Type | Purpose |
|------|------|---------|
| `plugins/nmg-sdlc/skills/creating-prs/SKILL.md` | Create | Skill definition with 4-step workflow |

---

## Security Considerations

- [x] PR creation via authenticated `gh` CLI
- [x] No tokens or secrets in PR body
- [x] `Closes #N` links are safe GitHub references

---

## Performance Considerations

- [x] Single `gh pr create` API call
- [x] Local file reads for specs and git state
- [x] `disable-model-invocation: true` — deterministic execution

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| PR Creation | BDD | Scenarios for issue linking, spec references, auto-mode |

---

## Validation Checklist

- [x] Architecture follows existing skill patterns
- [x] File changes documented
- [x] Security considerations addressed
