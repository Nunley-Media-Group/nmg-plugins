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

### Cross-Platform Compatibility

This project MUST work on macOS, Windows, and Linux. All contributions must respect cross-platform constraints:

| Constraint | Guideline |
|------------|-----------|
| File paths | Use forward slashes or `path.join()` — never hardcode `\` or `/` separators |
| Line endings | Files should use LF (`\n`); configure `.gitattributes` if needed |
| Shell commands in skills | Use POSIX-compatible commands; avoid Bash-specific syntax (e.g., `[[ ]]`, `<<<`) |
| Scripts | Node.js scripts must use `node:path` for path manipulation, never string concatenation |
| Case sensitivity | Treat file paths as case-sensitive (Linux is case-sensitive, macOS/Windows are not by default) |
| Symlinks | Do not rely on symlinks for core functionality (Windows requires elevated privileges) |
| Environment variables | Use cross-platform approaches; document platform differences where unavoidable |
| Executable permissions | Document `chmod +x` requirements; Windows users may need alternative setup |

### Security

| Requirement | Implementation |
|-------------|----------------|
| GitHub authentication | `GITHUB_TOKEN` env var or gh CLI auth |
| No secrets in code | Steering docs and specs committed to repo; no credentials |
| Plugin permissions | Declared in SKILL.md `allowedTools` sections |

---

## Claude Code Resource Development

**Before creating or modifying any Claude Code resource (skill, agent, hook, plugin manifest), review the official Claude Code documentation to ensure best practices are followed.**

### Skills (SKILL.md)

| Aspect | Best Practice |
|--------|---------------|
| Frontmatter | Use YAML frontmatter for `name`, `description`, `allowed-tools`, `model`, `context`, `user-invocable`, `disable-model-invocation`, `argument-hint` |
| Size | Keep under 500 lines — move detailed reference material to separate files |
| Arguments | Use `$ARGUMENTS` placeholder to capture user input |
| Supporting files | Place templates, examples, and scripts alongside SKILL.md in the skill directory |
| Dynamic context | Use `` !`command` `` syntax to inject shell output before Claude processes the skill |

### Hooks (hooks.json)

| Aspect | Best Practice |
|--------|---------------|
| Paths | Use `${CLAUDE_PLUGIN_ROOT}` for file references in hook commands |
| Matchers | Narrow scope with matchers (e.g., `Write\|Edit`) — don't fire on every tool use |
| Exit codes | Exit 0 = allow, exit 2 = block (stderr becomes Claude's feedback) |
| Hook types | `command` (shell script), `prompt` (single LLM call), `agent` (multi-turn with tools) |
| Events | `PreToolUse`, `PostToolUse`, `SessionStart`, `Stop`, `SubagentStart`, `SubagentStop`, etc. |

### Agents (.md files)

| Aspect | Best Practice |
|--------|---------------|
| Frontmatter | Use YAML frontmatter for `name`, `description`, `tools`, `disallowedTools`, `model`, `maxTurns`, `permissionMode` |
| Tool access | Grant only necessary tools — use `disallowedTools` to deny inherited ones |
| Focus | Each agent should excel at one specific task |
| Description | Write detailed descriptions — Claude uses them to decide when to delegate |

### Plugin Manifests

| Aspect | Best Practice |
|--------|---------------|
| plugin.json location | Only `plugin.json` goes inside `.claude-plugin/` — all other components at plugin root |
| Component paths | Must be relative, starting with `./` (no absolute or traversing paths) |
| Versioning | Semver (MAJOR.MINOR.PATCH); update both `plugin.json` and `marketplace.json` |
| Testing | Use `claude --plugin-dir ./my-plugin` during development |

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

## Verification Strategy — Behavioral Contracts

This project is prompt-based: skills are Markdown instructions that Claude Code executes. Traditional code quality metrics (test coverage, cyclomatic complexity) don't apply to most of the codebase. Instead, verification uses **Design by Contract** — each skill and component has preconditions, postconditions, invariants, and behavioral boundaries that `/verifying-specs` checks.

### Contract Framework

| Contract Type | Question It Answers |
|---------------|-------------------|
| **Preconditions** | What must be true before the skill/component runs? |
| **Postconditions** | What must be true after successful execution? |
| **Invariants** | What must remain true throughout execution? |
| **Behavioral boundaries** | What must the skill/component NOT do? |

### Skill-Level Contracts

Every skill has implicit contracts. When verifying a skill change, check:

#### Preconditions (Step 0 / Prerequisites)
- Required files exist (specs, steering docs, issues)
- Required tools are available (`gh` CLI, git)
- Correct branch / working directory state

#### Postconditions (Step N / Output)
- Output files created in the correct location and format
- GitHub issue/PR updated with expected content
- No orphaned files or partial state left behind
- Downstream skills can consume the output (e.g., `/writing-specs` output feeds `/implementing-specs`)

#### Invariants (Throughout Execution)
- Stack-agnostic: no project-specific technology hardcoded in skill instructions
- Steering docs used as the abstraction layer for project-specific details
- Auto-mode gates: interactive prompts present unless `.claude/auto-mode` exists
- Cross-platform: no platform-specific paths, commands, or assumptions

#### Behavioral Boundaries
- Skills must not modify files outside their declared scope
- Skills must not commit, push, or merge unless that is their explicit purpose
- Skills must not skip interactive gates in manual mode
- Skills must not introduce dependencies on external services not declared in tech.md

### Checklist Applicability

The architecture-reviewer checklists were designed for runtime codebases. Apply them to nmg-plugins with these adjustments:

| Checklist | Applies To | Skip For | Reinterpretation |
|-----------|-----------|----------|-----------------|
| SOLID | Scripts (sdlc-runner.mjs) | Markdown skills | For skills: SRP = one skill does one workflow step; DIP = skills reference steering docs, not hardcoded details |
| Security | Scripts, hook definitions | Markdown templates | Focus: no secrets in committed files, safe `gh` CLI patterns, no shell injection in skill commands |
| Performance | Hooks, runner script | Skills, templates | Focus: hook latency < 60s, runner timeouts configured, no blocking operations |
| Testability | All — reinterpret | N/A | For skills: steps can be followed manually with predictable results; scenarios are independent; templates produce valid output |
| Error Handling | Scripts, hooks | Markdown skills | Focus: runner exit codes, hook exit codes (0=allow, 2=block), graceful failures with meaningful stderr |

### Prompt Quality Verification

For Markdown skills, the "code quality" equivalent is prompt quality:

| Criterion | What to Check |
|-----------|---------------|
| **Unambiguous instructions** | Each step has one clear interpretation; no room for Claude to guess |
| **Complete workflow paths** | Happy path, error/edge cases, and auto-mode all covered |
| **Correct tool references** | Skills name the right tools (`Read`, `Glob`, `Grep` — not `cat`, `find`, `grep`) |
| **Logical step ordering** | Dependencies flow forward; no step references information from a later step |
| **Gate integrity** | Decision points have `AskUserQuestion` (or auto-mode bypass) |
| **Template-output chain** | Output format matches what downstream skills expect as input |
| **Cross-reference validity** | Links to templates, checklists, and other skills resolve correctly |

### Script Verification

For `sdlc-runner.mjs`, `install-openclaw-skill.sh`, and other runtime scripts, apply traditional contracts:

| Contract | Check |
|----------|-------|
| Preconditions | Required env vars documented; input validation at entry point |
| Postconditions | Non-zero exit on failure; meaningful stdout/stderr; no partial state on error |
| Invariants | Zero external dependencies (`node:*` only); cross-platform paths via `node:path` |
| Boundaries | No network calls beyond declared services; idempotent re-runs |

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
