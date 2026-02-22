---
name: setting-up-steering
description: "Set up or enhance project steering documents (product, tech, structure). Use when user says 'set up steering', 'initialize project', 'create steering docs', or 'update steering'. Bootstraps from templates on first run, enhances existing files in-place on subsequent runs."
model: opus
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Task, Write, Edit, Bash(ls:*), Bash(git:*), Bash(wc:*), AskUserQuestion
---

# Setting Up Steering

Generate or enhance project steering documents by analyzing the codebase. These documents provide project-specific context that the other SDLC skills reference.

**First run bootstraps the steering documents from templates. Subsequent runs detect existing files and offer an enhancement flow** so you can iteratively improve your docs without regeneration.

## When to Use

- First time setting up nmg-sdlc in a project
- When `.claude/steering/` directory doesn't exist
- When you want to enhance or update existing steering documents
- After major project changes (new framework, reorganization, etc.)

## What Gets Created / Modified

```
.claude/
├── steering/
│   ├── product.md     — Product vision, users, priorities
│   ├── tech.md        — Tech stack, testing, coding standards
│   └── structure.md   — Code organization, layers, naming
└── specs/             — Empty directory for future specs
```

In bootstrap mode, all three files are generated from templates. In enhancement mode, existing files are modified in-place using `Edit` to preserve your customizations.

---

## Workflow

### Step 0: Detect Existing Steering Files

Check whether steering documents already exist:

1. Use `Glob` to check for:
   - `.claude/steering/product.md`
   - `.claude/steering/tech.md`
   - `.claude/steering/structure.md`

2. **If at least one file is found** → go to **Enhancement Flow**
3. **If no files are found** (directory missing, empty, or contains only non-steering files) → go to **Bootstrap Flow**

---

### Enhancement Flow

Use this flow when existing steering files are detected.

#### E1: Report Findings

List which steering files were found and which are missing:

```
Found existing steering documents:
  ✓ .claude/steering/product.md
  ✓ .claude/steering/tech.md
  ✗ .claude/steering/structure.md  (missing)

Entering enhancement mode — your existing content will be preserved.
```

If any files are missing, note them and offer to generate them from templates as part of the enhancement.

#### E2: Ask What to Enhance

Use `AskUserQuestion` with an **open-ended question** (no predefined menu) to ask the user what they want to improve or update:

```
What would you like to enhance or update in your steering documents?

Examples: "update the tech stack — we switched from Jest to Vitest",
"add our new API module to structure.md", "refresh product.md priorities"
```

#### E3: Read, Modify, Write

1. Read the relevant steering file(s) based on the user's request
2. If the request involves codebase changes, scan the codebase to gather updated information (same techniques as Bootstrap Step 1)
3. Apply changes using `Edit` (not `Write`) to preserve existing content and customizations
4. If any files were missing (noted in E1), generate them from templates using `Write`

#### E4: Confirm Changes

Summarize what was modified and in which file(s):

```
Updated steering documents:

  product.md  — Updated feature priorities to reflect Q2 roadmap
  structure.md — Generated from template (was missing)

Your customizations in tech.md were preserved (no changes needed).
```

---

### Bootstrap Flow

Use this flow when no steering files exist.

#### Step 1: Scan the Codebase

Analyze the project to discover:

1. **Languages and frameworks**:
   - Look for `package.json`, `pubspec.yaml`, `Cargo.toml`, `go.mod`, `requirements.txt`, `pyproject.toml`, `*.csproj`, `Gemfile`, `build.gradle`, `pom.xml`
   - Check file extensions to identify primary languages
   - Identify frameworks from dependencies

2. **Project structure**:
   - Map the top-level directory layout
   - Identify source directories, test directories, config directories
   - Note monorepo structure if applicable

3. **Testing setup**:
   - Identify test framework(s) from dependencies
   - Find test directories and naming conventions
   - Check for BDD/Gherkin support
   - Look for CI configuration

4. **Existing documentation**:
   - Read `README.md` if it exists
   - Read `CLAUDE.md` if it exists
   - Read any existing architecture docs

5. **Development tools**:
   - Package manager (npm, yarn, pnpm, pip, cargo, go, etc.)
   - Linter configuration (eslint, pylint, clippy, etc.)
   - Formatter configuration (prettier, black, rustfmt, etc.)
   - CI/CD configuration

#### Step 2: Generate Steering Documents

Using the discovered information, generate three documents from templates:

##### product.md

From [templates/product.md](templates/product.md):
- Pre-fill with project name and description (from README/package.json)
- Leave mission, users, and priorities as templates for the user to customize
- Include placeholders for user journeys

##### tech.md

From [templates/tech.md](templates/tech.md):
- Pre-fill the tech stack table with discovered languages, frameworks, versions
- Pre-fill testing table with discovered test frameworks and locations
- Pre-fill coding standards section based on detected linter/formatter config
- Include BDD testing section (always — this is central to nmg-sdlc)
- Include environment variables section with discovered vars

##### structure.md

From [templates/structure.md](templates/structure.md):
- Pre-fill with the actual project directory layout
- Identify and document layer architecture (if discernible)
- Document naming conventions based on existing code
- Note any patterns discovered (DI, state management, etc.)

#### Step 3: Write Files

1. Create `.claude/steering/` directory
2. Write `product.md`, `tech.md`, `structure.md`
3. Create `.claude/specs/` directory (empty, for future specs)

#### Step 4: Prompt User

```
Steering documents created at .claude/steering/:

  product.md  — Product vision (needs your input on mission, users, priorities)
  tech.md     — Tech stack (pre-filled, review coding standards and testing)
  structure.md — Code structure (pre-filled, review layer responsibilities)

Please review and customize these documents. They provide context for all
nmg-sdlc skills (/writing-specs, /implementing-specs, /verifying-specs).

Key sections to customize:
  product.md  → Mission, Target Users, Feature Prioritization
  tech.md     → BDD Testing table (framework, feature file location)
  tech.md     → Coding Standards (project-specific conventions)
  structure.md → Layer Responsibilities (what each layer does/doesn't do)
```

---

## What the User Should Customize

| Document | Section | Why |
|----------|---------|-----|
| `product.md` | Mission | Only the team knows the product vision |
| `product.md` | Target Users | User personas drive acceptance criteria |
| `product.md` | Feature Prioritization | MoSCoW priorities guide spec writing |
| `tech.md` | BDD Testing | Framework choice and file locations |
| `tech.md` | Coding Standards | Project-specific rules beyond linter config |
| `structure.md` | Layer Responsibilities | What each layer does and doesn't do |
| `structure.md` | Anti-Patterns | Project-specific patterns to avoid |

---

## Integration with SDLC Workflow

This is a setup and maintenance step. Run it once to bootstrap, then again whenever steering documents need updating:

```
/setting-up-steering (bootstrap or enhance)
         ↓
/creating-issues  →  /writing-specs #N  →  /implementing-specs #N  →  /verifying-specs #N  →  /creating-prs #N
```
