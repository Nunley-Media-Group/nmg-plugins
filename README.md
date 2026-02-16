# nmg-plugins

Claude Code plugins by Nunley Media Group.

## Plugins

### nmg-sdlc

The **nmg-sdlc** plugin is a stack-agnostic, BDD spec-driven development toolkit that brings structured software delivery to Claude Code. It covers the entire development lifecycle through 11 slash-command skills — from issue creation and grooming with acceptance criteria, through three-phase specification writing (requirements, technical design, and task breakdown), to plan-mode implementation, automated verification, and PR creation with integrated versioning. A dedicated architecture reviewer agent scores every implementation across five quality checklists (SOLID principles, security, performance, testability, and error handling), while exercise-based verification can scaffold and test plugin projects end-to-end. Steering documents (`product.md`, `tech.md`, `structure.md`) let teams encode project-specific conventions that guide every skill, and a retrospective system analyzes past defects to continuously improve spec quality. The entire workflow runs interactively with human review gates, or fully headless through [OpenClaw](https://openclaw.ai/) integration — a deterministic Node.js runner that orchestrates Claude Code sessions to autonomously select issues, write specs, implement, verify, create PRs, monitor CI, and merge.

It provides a GitHub issue-driven workflow:

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

On first run, this analyzes your codebase and creates three documents in `.claude/steering/`. Re-running it when steering files already exist enters an enhancement flow that preserves your customizations:

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

Classifies the issue type (Bug or Enhancement/Feature), investigates the codebase for relevant context, then interviews you with type-specific questions. Assigns the issue to a version milestone (derived from the `VERSION` file). Produces a groomed issue with Given/When/Then acceptance criteria — enhancements include a "Current State" section from the investigation, bugs include a "Root Cause Analysis" section.

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

Determines the version bump (patch for bugs, minor for enhancements, major on milestone completion), updates the `VERSION` file, rolls `CHANGELOG.md` entries from `[Unreleased]` to a versioned heading, and updates any stack-specific version files declared in `tech.md`. Then creates a pull request with:
- Summary from the spec
- Acceptance criteria checklist
- Test plan
- Version bump details
- `Closes #42` to auto-close the issue on merge

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

### Versioning

The plugin includes an integrated versioning system built on a `VERSION` file (plain text semver at the project root). When `VERSION` exists, skills automatically:

- **`/creating-issues`** — Assigns issues to a milestone derived from the major version (e.g., `v2`), creating the milestone if needed
- **`/creating-prs`** — Classifies the version bump from issue labels, updates `VERSION`, rolls `CHANGELOG.md` entries to a versioned heading, and updates stack-specific files

The **classification matrix**:

| Issue Label | Bump Type | Example |
|-------------|-----------|---------|
| `bug` | Patch | 2.3.1 → 2.3.2 |
| `enhancement` | Minor | 2.3.1 → 2.4.0 |
| (milestone completion) | Major | 2.9.1 → 3.0.0 |

**Stack-specific files** (e.g., `package.json`, `Cargo.toml`) are declared in `tech.md`'s `## Versioning` section. The `/creating-prs` skill reads this mapping to update all version files in a single commit. Run `/migrating-projects` to bootstrap `CHANGELOG.md` and `VERSION` from git history if they don't exist yet.

## Skills Reference

### SDLC Skills

| Skill | Description |
|-------|-------------|
| `/starting-issues [#N]` | Select a GitHub issue, create a linked feature branch, and set the issue to In Progress |
| `/creating-issues [description]` | Interview user about a feature need, assign to version milestone, create groomed GitHub issue with BDD acceptance criteria |
| `/writing-specs #N` | Create BDD specifications from a GitHub issue: requirements, technical design, and task breakdown |
| `/implementing-specs #N` | Read specs for current branch, enter plan mode, then execute implementation tasks sequentially |
| `/verifying-specs #N` | Verify implementation against spec, fix findings, review architecture and test coverage, update GitHub issue |
| `/creating-prs #N` | Determine version bump, update VERSION/CHANGELOG/stack files, create PR with spec-driven summary |
| `/running-retrospectives` | Batch-analyze defect specs to identify spec-writing gaps and produce `.claude/steering/retrospective.md` with actionable learnings |
| `/setting-up-steering` | Set up or enhance project steering documents (product, tech, structure) — bootstraps on first run, enhances existing docs on subsequent runs |
| `/migrating-projects` | Update project specs, steering docs, configs, CHANGELOG, and VERSION to latest standards |
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
