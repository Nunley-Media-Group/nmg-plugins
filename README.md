# nmg-plugins

Claude Code plugins by Nunley Media Group.

## Plugins

### nmg-sdlc

The **nmg-sdlc** plugin is a stack-agnostic, BDD spec-driven development toolkit that brings structured software delivery to Claude Code. It covers the entire development lifecycle — issue grooming with acceptance criteria, three-phase specification writing, plan-mode implementation, automated verification with integrated versioning, and PR creation — but the core flow is five commands: `/start-issue` → `/write-spec` → `/write-code` → `/verify-code` → `/open-pr`. Each command runs in a fresh context window with only the artifacts it needs — specs, steering docs, and issue metadata — keeping token usage small and efficient across the entire lifecycle. A dedicated architecture reviewer agent scores every implementation across five quality checklists (SOLID principles, security, performance, testability, and error handling), while a retrospective system analyzes past defects to continuously improve spec quality. Steering documents (`product.md`, `tech.md`, `structure.md`) let teams encode project-specific conventions that guide every step. A retrospective system (`/run-retro`) analyzes past defect specs to identify recurring gaps and produces actionable learnings in `retrospective.md` — which `/write-spec` and `/write-code` automatically consume, so lessons from previous cycles directly improve future specs and implementations. For Claude Code plugin projects, exercise-based verification goes beyond static checks — it scaffolds a temporary workspace, installs the plugin, and runs the changed skills end-to-end to validate they actually work. The entire workflow runs interactively with human review gates or fully headless through the built-in SDLC runner.

It provides a GitHub issue-driven workflow:

```
Step 1               Step 2                   Step 3                  Step 4                     Step 5                    Step 6
/draft-issue  →  /start-issue #42  →  /write-spec #42  →  /write-code #42  →  /verify-code #42  →  /open-pr #42
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

Run `/setup-steering` in your project to generate steering documents:

```bash
/setup-steering
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
/start-issue #42
```

Selects an issue (or presents a picker if no number is given), creates a linked feature branch via `gh issue develop`, and sets the issue to "In Progress" in any associated GitHub Project.

### Step 1: Create an Issue

```bash
/draft-issue "add user authentication"
```

Classifies the issue type (Bug or Enhancement/Feature), investigates the codebase for relevant context, then interviews you with type-specific questions. Assigns the issue to a version milestone (derived from the `VERSION` file). Produces a groomed issue with Given/When/Then acceptance criteria — enhancements include a "Current State" section from the investigation, bugs include a "Root Cause Analysis" section.

### Step 2: Write Specs

```bash
/write-spec #42
```

Reads the GitHub issue and creates three specification documents through human-gated phases:

1. **SPECIFY** — Requirements with BDD acceptance criteria
2. **PLAN** — Technical design with architecture decisions
3. **TASKS** — Phased implementation tasks with dependencies

Output: `.claude/specs/{feature-name}/requirements.md`, `design.md`, `tasks.md`, `feature.gherkin`

The `{feature-name}` is the issue number + kebab-case slug of the title (e.g., `42-add-precipitation-overlay`), matching the branch name format.

### Step 3: Implement

```bash
/write-code #42
```

Reads the specs, enters plan mode to design the implementation approach, then executes tasks sequentially after your approval.

### Step 4: Verify

```bash
/verify-code #42
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
/open-pr #42
```

Determines the version bump (patch for bugs, minor for enhancements, major on milestone completion), updates the `VERSION` file, rolls `CHANGELOG.md` entries from `[Unreleased]` to a versioned heading, and updates any stack-specific version files declared in `tech.md`. Then creates a pull request with:
- Summary from the spec
- Acceptance criteria checklist
- Test plan
- Version bump details
- `Closes #42` to auto-close the issue on merge

## Unattended Mode

The plugin supports fully automated operation through a deterministic Node.js runner (`scripts/sdlc-runner.mjs`) that drives the full development cycle — issue selection, spec writing, implementation, verification, PR creation, CI monitoring, and merge — looping continuously until no open issues remain.

### Setup

#### 1. Generate a project config

From within the target project (must have a `.claude/` directory):

```bash
/init-config
```

This writes `sdlc-config.json` to the project root and adds it to `.gitignore`. The config specifies the project path, per-step timeouts and turn limits, and which nmg-sdlc skills to inject.

#### 2. Launch the runner

From within a Claude Code session:

```bash
/run-loop
```

Or run directly:

```bash
node scripts/sdlc-runner.mjs --config /path/to/sdlc-config.json
```

Available flags: `--resume`, `--dry-run`, `--step N`, `--issue N`.

### Model & Effort Configuration

The runner supports per-step model and effort level configuration. Each step can use a different model (e.g., Opus for spec writing, Sonnet for mechanical tasks) and effort level (`low`, `medium`, `high`).

**Recommended model assignments:**

| Step | Model | Effort | Rationale |
|------|-------|--------|-----------|
| startCycle | (global) | — | Simple git operations |
| startIssue | sonnet | — | Mechanical: select issue, create branch |
| writeSpecs | opus | high | Creative: requires deep reasoning for spec quality |
| implement | opus | medium | Single invocation: skill handles planning internally |
| verify | sonnet | high | Checklist-driven: validates against spec criteria |
| commitPush | sonnet | — | Mechanical: git add/commit/push |
| createPR | sonnet | — | Template-driven: version bump + PR body |
| monitorCI | sonnet | — | Mechanical: poll + minimal fix |
| merge | sonnet | — | Mechanical: gh pr merge |

**Configuration layers (highest to lowest priority):**

1. **Step-level** — `steps.writeSpecs.model`
2. **Global** — top-level `model` / `effort`
3. **Default** — `opus` for model, unset for effort

The implement step uses a single invocation — the `write-code` skill handles planning internally via unattended mode. See `sdlc-config.example.json` for the full schema.

**Skill frontmatter:** Each SKILL.md includes a `model` field declaring its recommended model. This is informational for interactive use — the runner's config takes precedence for automated runs.

### Unattended-mode flag

> **Not to be confused with Claude Code's native Auto Mode.** Claude Code (since v2.1.83) ships its own "Auto Mode" — a permission feature that auto-approves safe tool calls via a classifier. This plugin's `.claude/unattended-mode` flag is independent: it signals that the SDLC runner is driving the session headlessly and causes skills to skip interactive gates. The two features are orthogonal — you can run either, both, or neither.

The runner creates `.claude/unattended-mode` automatically. When this file exists, skills skip interactive prompts. You can also toggle it manually:

```bash
# Enable unattended mode
mkdir -p .claude && touch .claude/unattended-mode

# Disable unattended mode
rm .claude/unattended-mode
```

When `.claude/unattended-mode` does not exist, skills work interactively as normal.

### Default behaviors in unattended mode

- **Issue selection**: picks the first open issue in the milestone, sorted by issue number ascending (oldest first)
- **Confirmations**: answers yes
- **Review gates**: auto-approves all phases (requirements, design, tasks)
- **Plan mode**: skipped — `EnterPlanMode` is never called (it would fail in a headless session); Claude designs the approach internally from specs
- **Skill output**: all "Next step" suggestions suppressed; skills output `Done. Awaiting orchestrator.` instead

### Safety net

`/verify-code` runs fully autonomously (even outside unattended mode) and validates the implementation against specs. It serves as the quality gate — catching deviations, running architecture review, and auto-fixing findings.

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

- **`/draft-issue`** — Assigns issues to a milestone derived from the major version (e.g., `v2`), creating the milestone if needed
- **`/open-pr`** — Classifies the version bump from issue labels, updates `VERSION`, rolls `CHANGELOG.md` entries to a versioned heading, and updates stack-specific files

The **classification matrix**:

| Issue Label | Bump Type | Example |
|-------------|-----------|---------|
| `bug` | Patch | 2.3.1 → 2.3.2 |
| `enhancement` | Minor | 2.3.1 → 2.4.0 |
| (milestone completion) | Major | 2.9.1 → 3.0.0 |

**Stack-specific files** (e.g., `package.json`, `Cargo.toml`) are declared in `tech.md`'s `## Versioning` section. The `/open-pr` skill reads this mapping to update all version files in a single commit. Run `/migrate-project` to bootstrap `CHANGELOG.md` and `VERSION` from git history if they don't exist yet.

### Verification Gates

The `## Verification Gates` section in `tech.md` declares mandatory verification steps that `/verify-code` enforces as hard gates. Each gate specifies when it applies, what command to run, and how to determine success.

**Gate table format:**

| Gate | Condition | Action | Pass Criteria |
|------|-----------|--------|---------------|
| Unit Tests | Always | `npm test` | Exit code 0 |
| E2E Tests | `e2e/` directory exists | `npm run test:e2e` | Exit code 0 |
| Robot E2E Tests | `integration_test/` directory exists | `flutter test integration_test/` | Exit code 0 |
| Coverage Threshold | Always | `npm run test:coverage` | Exit code 0 AND `coverage/lcov.info` file generated |

**Column semantics:**

| Column | Purpose |
|--------|---------|
| **Gate** | Human-readable name used in reports |
| **Condition** | When the gate applies: `Always`, `{path} directory exists`, or `{glob} files exist in {path}` |
| **Action** | Shell command to execute via Bash |
| **Pass Criteria** | Success check: `Exit code 0`, `{file} file generated`, or compound using `AND` |

**How gates are enforced:**

During `/verify-code` Step 5, each gate's condition is evaluated. If applicable, the action command runs and the pass criteria are checked against the actual result. Gate results appear in the verification report and GitHub issue comment.

**Status semantics:**

| Status | Meaning |
|--------|---------|
| **Pass** | Gate condition was met, action ran, and all pass criteria were satisfied |
| **Fail** | Gate condition was met, action ran, but one or more pass criteria were not satisfied |
| **Incomplete** | Gate condition was met but the action could not be executed (tool unavailable, timeout, etc.) |

Any gate Fail caps the overall verification status at "Partial". Any gate Incomplete caps it at "Incomplete". A "Pass" overall status requires all applicable gates to pass.

**Migration:** Existing projects can add the `## Verification Gates` section by running `/migrate-project` — the migration skill detects missing sections from the updated template and offers to add them.

## Skills Reference

### SDLC Skills

| Skill | Description |
|-------|-------------|
| `/start-issue [#N]` | Select a GitHub issue, create a linked feature branch, and set the issue to In Progress |
| `/draft-issue [description]` | Interview user about a feature need, assign to version milestone, create groomed GitHub issue with BDD acceptance criteria |
| `/write-spec #N` | Create BDD specifications from a GitHub issue: requirements, technical design, and task breakdown |
| `/write-code #N` | Read specs for current branch, enter plan mode, then execute implementation tasks sequentially |
| `/verify-code #N` | Verify implementation against spec, fix findings, review architecture and test coverage, update GitHub issue |
| `/open-pr #N` | Determine version bump, update VERSION/CHANGELOG/stack files, create PR with spec-driven summary |
| `/run-retro` | Batch-analyze defect specs to identify spec-writing gaps and produce `.claude/steering/retrospective.md` with actionable learnings |
| `/run-loop [#N]` | Run the full SDLC pipeline from within an active Claude Code session — processes a specific issue or loops over all open issues via `sdlc-runner.mjs` |
| `/setup-steering` | Set up or enhance project steering documents (product, tech, structure) — bootstraps on first run, enhances existing docs on subsequent runs |
| `/migrate-project` | Update project specs, steering docs, configs, CHANGELOG, and VERSION to latest standards |
| `/init-config` | Generate an `sdlc-config.json` for the SDLC runner, with project path auto-detected and written to the project root |

### Utility Skills

These are repo-level utilities (not part of the nmg-sdlc plugin itself):

| Skill | Description |
|-------|-------------|
| `/installing-locally` | Install or update all marketplace plugins to the local Claude Code plugin cache |

## Updating

```bash
/plugin marketplace update nmg-plugins
```

## License

MIT License. See [LICENSE](LICENSE) for details.
