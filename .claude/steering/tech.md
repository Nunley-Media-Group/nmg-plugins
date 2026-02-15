# nmg-plugins Technical Steering

This document defines the technology stack, constraints, and integration standards.
All technical decisions should align with these guidelines.

---

## Architecture Overview

```
Claude Code CLI
    ↓ (plugin system)
nmg-sdlc Plugin
    ├── Skills (SKILL.md files — prompt-based workflows)
    ├── Hooks (PostToolUse — spec drift detection)
    ├── Agents (architecture-reviewer — subagent for verification)
    └── Templates (spec, steering, checklist files)

OpenClaw (optional automation layer)
    ├── running-sdlc Skill (Discord-triggered)
    └── sdlc-runner.mjs (Node.js orchestrator)
        └── Spawns `claude -p` subprocesses per SDLC step
```

---

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Plugin host | Claude Code CLI | Latest |
| Skill definitions | Markdown (SKILL.md) | N/A |
| Hook definitions | JSON + Agent prompts | N/A |
| Automation runner | Node.js (ESM) | v24+ |
| Issue tracker | GitHub Issues + Projects | gh CLI |
| Automation platform | OpenClaw | Latest |

### External Services

| Service | Purpose | Notes |
|---------|---------|-------|
| GitHub API | Issue/PR management, branch creation | Via `gh` CLI; requires `GITHUB_TOKEN` |
| Discord | Status updates from OpenClaw | Via `openclaw message send` |
| Claude API | Powers Claude Code sessions | Underlying LLM for all skills |

---

## Technical Constraints

### Performance

| Metric | Target | Rationale |
|--------|--------|-----------|
| Spec drift hook latency | < 60s per check | PostToolUse agent must not block the developer |
| Skill execution | Reasonable for task complexity | Skills are interactive; no hard time limits in manual mode |
| Runner step timeout | Per-step config (5–30 min) | Prevents runaway automation sessions |

### Security

| Requirement | Implementation |
|-------------|----------------|
| GitHub authentication | `GITHUB_TOKEN` env var or gh CLI auth |
| No secrets in code | Steering docs and specs committed to repo; no credentials |
| Plugin permissions | Declared in SKILL.md `allowedTools` sections |

---

## Coding Standards

### Markdown (Skills, Templates, Steering)

```markdown
# GOOD patterns
- Use ATX-style headings (# not ===)
- Tables for structured data
- Code blocks with language hints
- Clear section hierarchy: H1 > H2 > H3
- TODO comments with <!-- TODO: --> for user-customizable sections

# BAD patterns
- Inline HTML (except comments)
- Deeply nested lists (prefer tables)
- Ambiguous placeholder text
```

### JavaScript (OpenClaw Scripts)

```javascript
// GOOD patterns
- ESM imports (import/from)
- Node.js built-in modules (node:child_process, node:fs, node:path)
- parseArgs for CLI argument parsing
- JSDoc comments for script headers
- Explicit error handling with process.exit codes

// BAD patterns
- CommonJS require()
- External npm dependencies (scripts must be zero-dependency)
- Synchronous I/O in hot paths
```

### JSON (Plugin Manifests, Config)

```json
// GOOD patterns
- Consistent 2-space indentation
- Descriptive field names (camelCase)
- Version strings following semver

// BAD patterns
- Trailing commas
- Comments (not valid JSON)
- Deeply nested structures
```

---

## API / Interface Standards

### Plugin Interface

Skills are defined as Markdown files (`SKILL.md`) with:
- Workflow steps (numbered, imperative)
- `allowedTools` sections listing permitted tool patterns
- Integration with SDLC Workflow section
- Auto-mode conditionals for headless operation

### GitHub CLI (`gh`)

```bash
# Issue operations
gh issue view <number> --json title,body,labels
gh issue develop <number> --checkout
gh issue comment <number> --body "..."

# PR operations
gh pr create --title "..." --body "..."
gh pr checks <number>
gh pr merge <number> --merge
```

---

## Testing Standards

### BDD Testing (Required for nmg-sdlc)

**Every acceptance criterion MUST have a Gherkin test.**

| Layer | Framework | Location |
|-------|-----------|----------|
| BDD specs | Gherkin feature files | `.claude/specs/{feature-name}/feature.gherkin` |

<!-- TODO: If this project had runtime code to test, specify the BDD framework here.
     Since nmg-plugins is a plugin/template repository, Gherkin specs serve as
     design artifacts rather than executable tests. -->

### Gherkin Feature Files

```gherkin
# .claude/specs/{feature-name}/feature.gherkin
Feature: [Feature name from issue title]
  As a [developer/automation agent]
  I want [capability]
  So that [benefit]

  Scenario: [Acceptance criterion]
    Given [precondition]
    When [action]
    Then [expected outcome]
```

### Validation Approach

Since nmg-plugins is a template/plugin repository (not a runtime application), verification is done through:

| Type | Method | Location |
|------|--------|----------|
| Spec verification | `/verifying-specs` skill | Manual or automated |
| Architecture review | `architecture-reviewer` agent | 5 checklists scored 1–5 |
| Drift detection | PostToolUse hook | Runs on every Write/Edit |
| Manual testing | Install plugin locally, run skills | `/installing-locally` |

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub access for `gh` CLI and marketplace updates |

### Optional

| Variable | Description |
|----------|-------------|
| `OPENCLAW_DISCORD_CHANNEL` | Discord channel ID for automation status updates |

---

## References

- CLAUDE.md for project overview
- `.claude/steering/product.md` for product direction
- `.claude/steering/structure.md` for code organization
