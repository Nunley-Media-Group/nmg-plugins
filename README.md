# nmg-plugins

Claude Code plugins by Nunley Media Group.

## Plugins

### nmg-sdlc

Stack-agnostic BDD spec-driven development toolkit. Provides a GitHub issue-driven workflow:

```
Quick Start:
/beginning-dev  →  (picks issue)  →  /writing-specs #N  →  /implementing-specs #N
                                      ▲ runs automatically   ▲ runs automatically

Full Workflow:
Step 1               Step 2                  Step 3                     Step 4                    Step 5
/creating-issues  →  /writing-specs #42  →  /implementing-specs #42  →  /verifying-specs #42  →  /creating-prs #42
Interview user,      Read issue, create      Read specs, enter plan     Verify implementation,    Create PR with
create groomed       specs (requirements/    mode, create plan,         review architecture,      summary referencing
GitHub issue         design/tasks)           then execute               update issue              specs and issue
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

The fastest way to start working. Presents open issues from your current milestone, lets you pick one, then automatically runs `/writing-specs` and `/implementing-specs` for it. You can also pass an issue number directly:

```bash
/beginning-dev #42
```

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
| `/beginning-dev` | Pick an issue, then chain through writing-specs and implementing-specs |
| `/creating-issues` | Interview user, create GitHub issue with BDD acceptance criteria |
| `/writing-specs #N` | Create requirements, design, and task specs from issue |
| `/implementing-specs #N` | Read specs, plan, and execute implementation |
| `/verifying-specs #N` | Verify implementation, review architecture, update issue |
| `/creating-prs #N` | Create PR with spec-driven summary |
| `/setting-up-steering` | One-time: generate steering docs from codebase |

## Updating

```bash
/plugin marketplace update nmg-plugins
```

## License

Proprietary. Copyright Nunley Media Group.
