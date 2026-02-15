# nmg-plugins Code Structure Steering

This document defines code organization, naming conventions, and patterns.
All code should follow these guidelines for consistency.

---

## Project Layout

```
nmg-plugins/
├── .claude-plugin/
│   └── marketplace.json          # Plugin registry (name, version, source path)
├── .claude/
│   ├── settings.local.json       # Local permission settings
│   ├── skills/
│   │   └── installing-locally/   # Repo-level utility skill
│   ├── steering/                 # Project steering documents (this directory)
│   └── specs/                    # BDD spec output directory
├── plugins/
│   └── nmg-sdlc/                 # The main plugin
│       ├── .claude-plugin/
│       │   └── plugin.json       # Plugin manifest (name, version, description)
│       ├── skills/               # Skill definitions (one dir per skill)
│       │   ├── creating-issues/
│       │   ├── creating-prs/
│       │   ├── generating-openclaw-config/
│       │   ├── implementing-specs/
│       │   ├── installing-openclaw-skill/
│       │   ├── setting-up-steering/
│       │   │   └── templates/    # Steering document templates
│       │   ├── starting-issues/
│       │   ├── verifying-specs/
│       │   │   └── checklists/   # Architecture review checklists
│       │   └── writing-specs/
│       │       └── templates/    # Spec document templates
│       ├── hooks/
│       │   └── hooks.json        # PostToolUse hook (spec drift detection)
│       └── agents/
│           └── architecture-reviewer.md  # Subagent for verification
├── openclaw/                     # OpenClaw integration (separate from plugin)
│   ├── scripts/
│   │   ├── sdlc-runner.mjs       # Deterministic SDLC orchestrator
│   │   ├── sdlc-config.example.json  # Config template
│   │   ├── install-openclaw-skill.sh  # Installer script
│   │   └── patch-openclaw-message-hang.mjs  # CLI bug workaround
│   ├── skills/
│   │   └── running-sdlc/
│   │       └── SKILL.md          # OpenClaw skill definition
│   └── README.md                 # OpenClaw integration docs
├── CLAUDE.md                     # Project instructions for Claude Code
├── CHANGELOG.md                  # Versioned changelog with [Unreleased] section
├── README.md                     # Public documentation
└── LICENSE                       # MIT License
```

---

## Layer Architecture

### Content Flow

```
Plugin Marketplace (.claude-plugin/marketplace.json)
    ↓ (indexes)
Plugin Package (plugins/nmg-sdlc/)
    ↓ (contains)
┌─────────────────────┐
│  Skills (SKILL.md)  │ ← Workflow definitions, prompt-based
└────────┬────────────┘
         ↓ (reference)
┌─────────────────────┐
│  Templates (*.md)   │ ← Output structure for specs and steering docs
└────────┬────────────┘
         ↓ (used by)
┌─────────────────────┐
│  Hooks (hooks.json) │ ← Runtime validation (spec drift detection)
└────────┬────────────┘
         ↓ (invokes)
┌─────────────────────┐
│  Agents (*.md)      │ ← Specialized subagents (architecture review)
└─────────────────────┘

OpenClaw (openclaw/) — optional automation layer
    ↓ (drives)
Claude Code sessions via `claude -p`
```

### Layer Responsibilities

| Layer | Does | Doesn't Do |
|-------|------|------------|
| Marketplace index | Registers plugins, tracks versions | Contain plugin logic |
| Plugin manifest | Declares plugin identity and metadata | Define workflows |
| Skills | Define SDLC workflow steps, prompt Claude | Execute code directly; skills are Markdown |
| Templates | Provide output structure for generated documents | Contain logic or conditionals |
| Hooks | Validate file modifications against specs at runtime | Modify files or block writes |
| Agents | Perform specialized analysis (architecture review) | Spawn subagents or use Task tool |
| OpenClaw scripts | Orchestrate `claude -p` sessions deterministically | Contain SDLC logic (that lives in skills) |

---

## Naming Conventions

### Directories

| Element | Convention | Example |
|---------|------------|---------|
| Skill directories | kebab-case | `writing-specs/`, `creating-issues/` |
| Template directories | `templates/` inside skill dir | `writing-specs/templates/` |
| Checklist directories | `checklists/` inside skill dir | `verifying-specs/checklists/` |
| Agent files | kebab-case `.md` | `architecture-reviewer.md` |

### Files

| Element | Convention | Example |
|---------|------------|---------|
| Skill definitions | `SKILL.md` (uppercase) | `writing-specs/SKILL.md` |
| Templates | kebab-case `.md` or `.gherkin` | `requirements.md`, `feature.gherkin` |
| Plugin manifests | `plugin.json` or `marketplace.json` | `.claude-plugin/plugin.json` |
| Scripts | kebab-case `.mjs` or `.sh` | `sdlc-runner.mjs`, `install-openclaw-skill.sh` |
| Config files | kebab-case `.json` | `sdlc-config.example.json` |

### Spec Output

| Element | Convention | Example |
|---------|------------|---------|
| Spec directories | `{issue#}-{kebab-case-title}` | `42-add-precipitation-overlay/` |
| Spec files | Fixed names | `requirements.md`, `design.md`, `tasks.md`, `feature.gherkin` |
| Location | `.claude/specs/{feature-name}/` | `.claude/specs/42-add-precipitation-overlay/` |

### Version Strings

| Element | Convention | Example |
|---------|------------|---------|
| Plugin version | Semver (major.minor.patch) | `2.4.0` |
| Marketplace collection version | Semver (independent of plugins) | `1.0.0` |

### Commit Messages

| Element | Convention | Example |
|---------|------------|---------|
| Format | Conventional commits | `feat:`, `fix:`, `docs:`, `chore:` |
| Scope | Optional, kebab-case | `feat(writing-specs): add defect template` |

---

## File Templates

### Skill Definition (SKILL.md)

```markdown
# [Skill Name]

[One-line description]

## When to Use
[Trigger conditions]

## Workflow
### Step 1: [Action]
[Instructions for Claude]

### Step N: [Action]
[Instructions for Claude]

## Integration with SDLC Workflow
[Where this skill fits in the pipeline]
```

### Plugin Manifest (plugin.json)

```json
{
  "name": "nmg-sdlc",
  "version": "X.Y.Z",
  "description": "...",
  "author": { "name": "Nunley Media Group" },
  "repository": "https://github.com/nunley-media-group/nmg-plugins"
}
```

---

## Import Order

### JavaScript (ESM — OpenClaw scripts)

```javascript
// 1. Node.js built-in modules (with node: prefix)
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

// 2. No external dependencies (zero-dependency scripts)
```

---

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Scoping drift hook to current spec only | Misses cross-spec violations | Check ALL specs on every Write/Edit |
| Updating only plugin.json version | Marketplace index becomes stale | Always update BOTH plugin.json and marketplace.json |
| Adding npm dependencies to scripts | Breaks zero-dependency portability | Use only Node.js built-in modules |
| Nesting subagents in architecture-reviewer | Task tool not available to agents | Use Read/Glob/Grep directly |
| Skipping [Unreleased] in CHANGELOG | Version history becomes inconsistent | Always add entries under [Unreleased] first |
| Hardcoding project-specific details in skills | Breaks stack-agnostic principle | Put specifics in steering docs, not skill definitions |

---

## References

- CLAUDE.md for project overview
- `.claude/steering/product.md` for product direction
- `.claude/steering/tech.md` for technical standards
