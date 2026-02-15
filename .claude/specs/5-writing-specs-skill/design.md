# Design: Writing Specs Skill

**Issue**: #5
**Date**: 2026-02-15
**Status**: Approved
**Author**: Claude Code (retroactive)

---

## Overview

The `/writing-specs` skill is the specification engine of the nmg-sdlc workflow. It reads a GitHub issue and produces four spec documents through a 3-phase process: SPECIFY (requirements.md), PLAN (design.md), and TASKS (tasks.md + feature.gherkin). Each phase has a human review gate that can be bypassed in automation mode.

The skill includes a comprehensive template system with four template files in `plugins/nmg-sdlc/skills/writing-specs/templates/`. Each template has a primary (feature) variant and a defect variant, selected based on the presence of a `bug` label on the GitHub issue. The feature name used for the spec directory follows a deterministic algorithm: issue number + kebab-case slug of the title.

The skill serves as the bridge between issue definition and implementation — its output is consumed by `/implementing-specs` (reads specs to code) and `/verifying-specs` (validates code against specs).

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────────┐
│              /writing-specs Skill                  │
├──────────────────────────────────────────────────┤
│                                                    │
│  ┌─────────┐    ┌─────────┐    ┌─────────────┐   │
│  │ Phase 1 │───▶│ Phase 2 │───▶│   Phase 3   │   │
│  │ SPECIFY │    │  PLAN   │    │   TASKS     │   │
│  └────┬────┘    └────┬────┘    └──────┬──────┘   │
│       │              │                │           │
│   Review Gate    Review Gate     Review Gate      │
│       │              │                │           │
│   requirements.md  design.md    tasks.md          │
│                                 feature.gherkin   │
└──────────────────────────────────────────────────┘
        │                    │
        ▼                    ▼
┌──────────────┐    ┌──────────────────┐
│ templates/   │    │ .claude/specs/   │
│  ├ req.md    │    │  └ {feature}/    │
│  ├ design.md │    │    ├ req.md      │
│  ├ tasks.md  │    │    ├ design.md   │
│  └ feature.  │    │    ├ tasks.md    │
│    gherkin   │    │    └ feature.    │
└──────────────┘    │      gherkin     │
                    └──────────────────┘
```

### Data Flow

```
1. User invokes /writing-specs #N
2. Skill reads GitHub issue via gh issue view
3. Skill checks for bug label (defect detection)
4. Phase 1: Read steering/product.md → generate requirements.md from template
5. Human review gate (skip in auto-mode)
6. Phase 2: Read steering/tech.md, structure.md → generate design.md from template
7. Human review gate (skip in auto-mode)
8. Phase 3: Generate tasks.md and feature.gherkin from templates
9. Human review gate (skip in auto-mode)
10. Output summary with file paths
```

---

## File Changes

| File | Type | Purpose |
|------|------|---------|
| `plugins/nmg-sdlc/skills/writing-specs/SKILL.md` | Create | Skill definition with 3-phase workflow |
| `plugins/nmg-sdlc/skills/writing-specs/templates/requirements.md` | Create | Requirements template (feature + defect variants) |
| `plugins/nmg-sdlc/skills/writing-specs/templates/design.md` | Create | Design template (feature + defect variants) |
| `plugins/nmg-sdlc/skills/writing-specs/templates/tasks.md` | Create | Tasks template (feature + defect variants) |
| `plugins/nmg-sdlc/skills/writing-specs/templates/feature.gherkin` | Create | Gherkin template (feature + defect variants) |

---

## Alternatives Considered

| Option | Description | Decision |
|--------|-------------|----------|
| Single-phase spec | One document covering everything | Rejected — too large, no review gates |
| AI-generated specs without templates | Free-form spec generation | Rejected — inconsistent output |
| **Template-driven 3-phase with gates** | Structured phases with human review | **Selected** — consistent, reviewable, iterative |

---

## Security Considerations

- [x] Spec files contain only requirements and design, no secrets
- [x] GitHub issue access via authenticated `gh` CLI
- [x] No code execution during spec writing

---

## Performance Considerations

- [x] Each phase is a single pass through template + issue data
- [x] Steering doc reads are local file operations
- [x] Templates are lightweight Markdown

---

## Testing Strategy

| Layer | Type | Coverage |
|-------|------|----------|
| Phase Execution | BDD | Scenarios for each phase and review gate |
| Template Output | Manual | Verify generated specs match templates |
| Defect Detection | BDD | Scenario for bug label routing |

---

## Validation Checklist

- [x] Architecture follows existing skill patterns
- [x] All file changes documented
- [x] Security considerations addressed
- [x] Alternatives considered
