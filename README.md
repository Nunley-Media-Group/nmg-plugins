# nmg-plugins

Claude Code plugins by Nunley Media Group.

## Plugins

### nmg-sdlc

Stack-agnostic BDD spec-driven development toolkit. Provides a GitHub issue-driven workflow:

```
Quick Start:
/starting-issues #42  →  /writing-specs #42  →  /implementing-specs #42
(select issue,           (run manually)          (run manually)
 create branch)

Full Workflow:
Step 1               Step 2                   Step 3                  Step 4                     Step 5                    Step 6
/creating-issues  →  /starting-issues #42  →  /writing-specs #42  →  /implementing-specs #42  →  /verifying-specs #42  →  /creating-prs #42
Interview user,      Select issue, create     Read issue, create      Read specs, enter plan     Verify implementation,    Create PR with
create groomed       linked branch, set       specs (requirements/    mode, create plan,         review architecture,      summary referencing
GitHub issue         status to In Progress    design/tasks)           then execute               update issue              specs and issue
```

## Installation

```bash
# Add the private marketplace
/plugin marketplace add nunley-media-group/nmg-plugins

# Install the plugin
/plugin install nmg-sdlc@nmg-plugins
```

For auto-updates from a private repo, ensure `GITHUB_TOKEN` is set with read access to the marketplace repository.

For local development or testing:

```bash
# Add from local path
/plugin marketplace add /path/to/nmg-plugins

# Install
/plugin install nmg-sdlc@nmg-plugins
```

## First-Time Setup

Run `/setting-up-steering` in your project to generate steering documents:

```bash
/setting-up-steering
```

This analyzes your codebase and creates three documents in `.claude/steering/`:

| Document | Purpose |
|----------|---------|
| `product.md` | Product vision, target users, feature priorities |
| `tech.md` | Tech stack, testing standards, coding conventions |
| `structure.md` | Code organization, layer architecture, naming |

Review and customize these documents — they provide project-specific context for all other skills.

## Workflow

### Quick Start: Start an Issue

```bash
/starting-issues #42
```

Selects an issue (or presents a picker if no number is given), creates a linked feature branch via `gh issue develop`, and sets the issue to "In Progress" in any associated GitHub Project.

### Step 1: Create an Issue

```bash
/creating-issues "add user authentication"
```

Interviews you about the feature need, refines it into a groomed user story with Given/When/Then acceptance criteria, and creates a GitHub issue.

### Step 2: Write Specs

```bash
/writing-specs #42
```

Reads the GitHub issue and creates three specification documents through human-gated phases:

1. **SPECIFY** — Requirements with BDD acceptance criteria
2. **PLAN** — Technical design with architecture decisions
3. **TASKS** — Phased implementation tasks with dependencies

Output: `.claude/specs/{feature-name}/requirements.md`, `design.md`, `tasks.md`, `feature.gherkin`

The `{feature-name}` is the issue number + kebab-case slug of the title (e.g., `42-add-precipitation-overlay`), matching the branch name format.

### Step 3: Implement

```bash
/implementing-specs #42
```

Reads the specs, enters plan mode to design the implementation approach, then executes tasks sequentially after your approval.

### Step 4: Verify

```bash
/verifying-specs #42
```

Verifies the implementation against the spec:
- Checks each acceptance criterion against actual code
- Runs architecture review via the dedicated `nmg-sdlc:architecture-reviewer` agent, scoring five checklists 1–5:

| Checklist | Focus |
|-----------|-------|
| SOLID Principles | Single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion |
| Security | OWASP-aligned input validation, authentication, authorization, data protection |
| Performance | Query efficiency, caching, lazy loading, resource management |
| Testability | Dependency injection, mock-friendly boundaries, deterministic behavior |
| Error Handling | Error hierarchy, propagation, recovery, logging |

- Checks BDD test coverage
- Fixes findings under ~20 lines of change; defers architectural changes or out-of-scope modifications
- Posts verification report as a comment on the GitHub issue

### Step 5: Create PR

```bash
/creating-prs #42
```

Creates a pull request with:
- Summary from the spec
- Acceptance criteria checklist
- Test plan
- `Closes #42` to auto-close the issue on merge

## Hooks

The plugin includes a `PostToolUse` hook that runs on every `Write` or `Edit` operation. It detects spec drift by reading active spec files (`.claude/specs/*/requirements.md`, `.claude/specs/*/design.md`) and checking whether file modifications align with the current specifications.

## Automation Mode

The plugin supports fully automated operation via [OpenClaw](https://openclaw.ai/), an AI agent platform that orchestrates Claude Code sessions. A deterministic Node.js runner drives the full development cycle — issue selection, spec writing, implementation, verification, PR creation, CI monitoring, and merge — looping continuously until no open issues remain.

### Setup

#### 1. Install OpenClaw

Follow the [OpenClaw getting started guide](https://openclaw.ai/) to install the `openclaw` CLI and connect it to your Discord server.

#### 2. Install the OpenClaw skill

The `/installing-openclaw-skill` skill copies the `running-sdlc` skill and SDLC runner script from the nmg-plugins marketplace clone to `~/.openclaw/skills/running-sdlc/`, patches a known CLI bug, and restarts the OpenClaw gateway. Run it from any project that has nmg-sdlc installed:

```bash
/installing-openclaw-skill
```

This is the recommended method. It sources files from the marketplace clone at `~/.claude/plugins/marketplaces/nmg-plugins/`, so make sure you've installed the plugin first (see [Installation](#installation)). Re-run it any time you update the plugin to keep the OpenClaw skill in sync.

Alternative install methods (for development or CI):

```bash
# From within the nmg-plugins repo — installs everything including the OpenClaw skill
/installing-locally

# Standalone shell script (copy mode)
./openclaw/scripts/install-openclaw-skill.sh

# Standalone shell script (symlink mode — stays in sync with the repo)
./openclaw/scripts/install-openclaw-skill.sh --link
```

#### 3. Generate a project config

From within the target project (must have a `.claude/` directory):

```bash
/generating-openclaw-config
```

This writes `sdlc-config.json` to the project root and adds it to `.gitignore`. The config specifies the project path, per-step timeouts and turn limits, which nmg-sdlc skills to inject, and an optional Discord channel ID for status updates.

#### 4. Launch the runner

Via OpenClaw (from Discord or the CLI):

```
/running-sdlc start --config /path/to/sdlc-config.json
```

Or run directly without OpenClaw:

```bash
node openclaw/scripts/sdlc-runner.mjs --config /path/to/sdlc-config.json --discord-channel 1234567890
```

The `--discord-channel` flag is optional. When launched via OpenClaw, the channel ID is auto-detected from the invoking Discord channel. It can also be set as `discordChannelId` in the config file.

See [`openclaw/README.md`](openclaw/README.md) for all commands (`start`, `status`, `stop`), flags (`--resume`, `--dry-run`, `--step N`), state files, and error handling details.

### Auto-mode flag

The runner creates `.claude/auto-mode` automatically. When this file exists, skills skip interactive prompts. You can also toggle it manually:

```bash
# Enable automation mode
mkdir -p .claude && touch .claude/auto-mode

# Disable automation mode
rm .claude/auto-mode
```

When `.claude/auto-mode` does not exist, skills work interactively as normal.

### Default behaviors in automation mode

- **Issue selection**: picks the first open issue in the milestone, sorted by issue number ascending (oldest first)
- **Confirmations**: answers yes
- **Review gates**: auto-approves all phases (requirements, design, tasks)
- **Plan mode**: skipped — `EnterPlanMode` is never called (it would fail in a headless session); Claude designs the approach internally from specs
- **Skill output**: all "Next step" suggestions suppressed; skills output `Done. Awaiting orchestrator.` instead

### Safety net

`/verifying-specs` runs fully autonomously (even outside automation mode) and validates the implementation against specs. It serves as the quality gate — catching deviations, running architecture review, and auto-fixing findings.

## Customization

The plugin provides the **process**. Your project provides **specifics** via steering docs:

| What to Customize | Where | Example |
|---|---|---|
| BDD framework | `tech.md` → Testing Standards | pytest-bdd, jest-cucumber, SpecFlow |
| Feature file location | `tech.md` | `tests/features/*.feature` |
| Step definition patterns | `tech.md` | Framework-specific code examples |
| Directory layout | `structure.md` | Project's actual paths |
| Design tokens / branding | `structure.md` | Project's design system |
| Target users | `product.md` | User personas and constraints |
| API conventions | `tech.md` | REST, GraphQL, gRPC |

## Skills Reference

### SDLC Skills

| Skill | Description |
|-------|-------------|
| `/starting-issues [#N]` | Select a GitHub issue, create a linked feature branch, and set the issue to In Progress |
| `/creating-issues [description]` | Interview user about a feature need, create groomed GitHub issue with BDD acceptance criteria |
| `/writing-specs #N` | Create BDD specifications from a GitHub issue: requirements, technical design, and task breakdown |
| `/implementing-specs #N` | Read specs for current branch, enter plan mode, then execute implementation tasks sequentially |
| `/verifying-specs #N` | Verify implementation against spec, fix findings, review architecture and test coverage, update GitHub issue |
| `/creating-prs #N` | Create a pull request with spec-driven summary, linking GitHub issue and spec documents |
| `/running-retrospectives` | Batch-analyze defect specs to identify spec-writing gaps and produce `.claude/steering/retrospective.md` with actionable learnings |
| `/setting-up-steering` | Analyze codebase and generate steering documents (product, tech, structure). Run once per project |
| `/installing-openclaw-skill` | Copy the OpenClaw running-sdlc skill from the marketplace clone to `~/.openclaw/skills/` and restart the gateway |
| `/generating-openclaw-config` | Generate an `sdlc-config.json` for the SDLC runner, with project path auto-detected and written to the project root |

### OpenClaw Skills

These skills are part of the [OpenClaw](https://openclaw.ai/) integration (in [`openclaw/`](openclaw/README.md)), not the nmg-sdlc plugin:

| Skill | Description |
|-------|-------------|
| `/running-sdlc start\|status\|stop --config <path>` | Launch, monitor, or stop the deterministic SDLC runner for a project. See [`openclaw/README.md`](openclaw/README.md) for setup and details |

### Utility Skills

These are repo-level utilities (not part of the nmg-sdlc plugin itself):

| Skill | Description |
|-------|-------------|
| `/installing-locally` | Install or update all marketplace plugins to the local Claude Code plugin cache, sync the OpenClaw skill, and restart the OpenClaw gateway |

## Updating

```bash
/plugin marketplace update nmg-plugins
```

## License

MIT License. See [LICENSE](LICENSE) for details.
