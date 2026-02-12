# nmg-plugins

Claude Code plugins by Nunley Media Group.

## Plugins

### nmg-sdlc

Stack-agnostic BDD spec-driven development toolkit. Provides a GitHub issue-driven workflow:

```
Quick Start:
/beginning-dev  →  /starting-issues  →  /writing-specs #N  →  /implementing-specs #N
                    ▲ runs automatically

Standalone Issue Start:
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

### Quick Start: Beginning Dev

```bash
/beginning-dev
```

The fastest way to start working. Delegates to `/starting-issues` to present open issues from your current milestone, lets you pick one, creates a linked feature branch, and sets the issue to "In Progress" — then automatically chains through `/writing-specs` and `/implementing-specs`. You can also pass an issue number directly:

```bash
/beginning-dev #42
```

### Standalone: Start an Issue

```bash
/starting-issues #42
```

If you already have an issue and just need to set up a branch, use this directly. It selects an issue (or presents a picker if no number is given), creates a linked feature branch via `gh issue develop`, and sets the issue to "In Progress" in any associated GitHub Project.

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

Output: `.claude/specs/{feature}/requirements.md`, `design.md`, `tasks.md`, `feature.gherkin`

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
- Runs architecture review (SOLID, security, performance, testability, error handling)
- Checks BDD test coverage
- Fixes any issues found during verification
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

## Automation Mode

The plugin supports fully automated operation for external agents like [OpenClaw](https://openclaw.ai/). Since v1.6.0, skills detect `.claude/auto-mode` directly and skip interactive prompts — no hook-level interception needed. Two hooks remain:

| Hook | Type | Behavior |
|------|------|----------|
| Spec drift detection | `PostToolUse` | Checks file modifications against active specs |
| Waiting notification | `Notification` | Notifies Discord via OpenClaw when CC is waiting for input (60s debounce) |
| Stop notification | `Stop` | Notifies Discord via OpenClaw when a session ends |

Both notification hooks read the Discord channel from the `OPENCLAW_DISCORD_CHANNEL` environment variable (set by OpenClaw before launching sessions). They only fire when both auto-mode and the env var are present.

### Enable / Disable

Create the flag file to enable, remove it to disable:

```bash
# Enable automation mode
mkdir -p .claude && touch .claude/auto-mode

# Disable automation mode
rm .claude/auto-mode
```

When `.claude/auto-mode` does not exist, skills work interactively as normal and the stop hook is a no-op.

### Default behaviors in automation mode

- **Issue selection**: picks the first issue in the milestone
- **Confirmations**: answers yes
- **Review gates**: auto-approves all phases (requirements, design, tasks)
- **Draft approvals**: approves as-is
- **Plan mode**: skipped — Claude designs the approach internally from specs

OpenClaw is responsible for session lifecycle management (permissions, continuation, restarts).

### Safety net

`/verifying-specs` runs fully autonomously (even outside automation mode) and validates the implementation against specs. It serves as the quality gate — catching deviations, running architecture review, and auto-fixing findings.

### Example: OpenClaw automation prompt

See [`openclaw-automation-prompt.md`](openclaw-automation-prompt.md) for a complete prompt you can give to an [OpenClaw](https://openclaw.ai/) agent to continuously develop issues end-to-end. It uses automation mode to drive the full SDLC cycle — start issue, write specs, implement, verify, create PR, monitor CI, merge — with Discord status updates at every step.

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

| Skill | Description |
|-------|-------------|
| `/beginning-dev [#N]` | Pick a GitHub issue, create feature branch, then chain through writing-specs and implementing-specs |
| `/starting-issues [#N]` | Select a GitHub issue, create linked feature branch, set issue to In Progress |
| `/creating-issues [description]` | Interview user about a feature need, create groomed GitHub issue with BDD acceptance criteria |
| `/writing-specs #N` | Create BDD specifications from a GitHub issue: requirements, technical design, and task breakdown |
| `/implementing-specs #N` | Read specs, enter plan mode, then execute implementation tasks sequentially |
| `/verifying-specs #N` | Verify implementation against spec, fix findings, review architecture and test coverage, update GitHub issue |
| `/creating-prs #N` | Create a pull request with spec-driven summary, linking GitHub issue and spec documents |
| `/setting-up-steering` | Analyze codebase and generate steering documents (product, tech, structure) — run once per project |

## Updating

```bash
/plugin marketplace update nmg-plugins
```

## License

Proprietary. Copyright Nunley Media Group.
