---
name: creating-prs
description: "Create a pull request with spec-driven summary, linking GitHub issue and spec documents. Use when user says 'create PR', 'open pull request', 'submit for review', or 'make a PR for issue #N'. Handles version bumping, changelog updates, and links specs and acceptance criteria."
argument-hint: "[#issue-number]"
model: sonnet
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(gh:*), Bash(git:*), AskUserQuestion
---

# Creating PRs

Create a pull request with a spec-driven summary that links to the GitHub issue and references specification documents.

## When to Use

- After implementation is complete and verified via `/verifying-specs`
- When ready to submit code for review

## Prerequisites

1. Implementation is complete (all tasks from `tasks.md` done). The `{feature-name}` in spec paths is the issue number + kebab-case slug of the title (e.g., `42-add-precipitation-overlay`), matching the branch name. If unsure, use `Glob` to find `.claude/specs/*/requirements.md` and match against the current issue number or branch name.
2. Verification has passed (via `/verifying-specs`)
3. Changes are committed to a feature branch

---

## Workflow

### Step 1: Read Context

Gather all information needed for the PR:

1. **Read the issue**: `gh issue view #N` for title, description, acceptance criteria
2. **Read the spec**: `.claude/specs/{feature-name}/requirements.md` for acceptance criteria
3. **Read tasks**: `.claude/specs/{feature-name}/tasks.md` for testing phase
4. **Read git state**:
   - `git status` — any uncommitted changes?
   - `git log main..HEAD --oneline` — commits on this branch
   - `git diff main...HEAD --stat` — files changed vs main

### Step 2: Determine Version Bump

If a `VERSION` file exists in the project root, determine the appropriate version bump. If no `VERSION` file exists, skip this step and Step 3 entirely.

1. **Read the current version**: Read the `VERSION` file and verify it contains a valid semver string (X.Y.Z). If the content is not valid semver, warn and skip versioning.
2. **Read issue labels**: Run `gh issue view #N --json labels --jq '.labels[].name'` to get the issue's labels.
3. **Apply the classification matrix**:

   | Label | Bump Type | Example |
   |-------|-----------|---------|
   | `bug` | Patch | 2.11.0 → 2.11.1 |
   | `enhancement` | Minor | 2.11.0 → 2.12.0 |
   | (no label match) | Minor | 2.11.0 → 2.12.0 |

4. **Check milestone completion**: Read the issue's milestone via `gh issue view #N --json milestone --jq '.milestone.title // empty'`. If the issue has a milestone, query its open issue count: `gh api repos/{owner}/{repo}/milestones --jq '.[] | select(.title=="{milestone_title}") | .open_issues'`. If `open_issues` is 1 (this issue is the last one open), propose a **major** bump instead (e.g., 2.11.0 → 3.0.0).
5. **Calculate the new version string** based on the classification.
6. **Present to user** (via `AskUserQuestion`):
   ```
   question: "Version bump: {current} → {proposed} ({bump_type}). Accept or override?"
   options:
     - "Accept {proposed}"
     - "Patch ({current} → {patch_version})"
     - "Minor ({current} → {minor_version})"
     - "Major ({current} → {major_version})"
   ```

> **Auto-mode**: Apply the classified bump without confirmation. Do not call `AskUserQuestion`.

### Step 3: Update Version Artifacts

If Step 2 determined a version bump, update all version-related files before generating the PR content. If Step 2 was skipped (no VERSION file), skip this step as well.

1. **Update the VERSION file**: Write the new version string to the `VERSION` file.
2. **Update CHANGELOG.md**: If `CHANGELOG.md` exists:
   - Find the `## [Unreleased]` heading.
   - Insert a new version heading `## [{new_version}] - {YYYY-MM-DD}` immediately after it.
   - Move all entries that were under `[Unreleased]` to under the new version heading.
   - Leave the `[Unreleased]` section empty (just the heading with a blank line after it).
3. **Update stack-specific files**: Read `.claude/steering/tech.md` and look for the `## Versioning` section. If it exists, parse the table of stack-specific files and update each one:
   - For **JSON files** (e.g., `package.json`): Use the dot-notation path to locate and update the version field.
   - For **TOML files** (e.g., `Cargo.toml`): Use the dot-notation path to locate and update the version field.
   - For **plain text files**: Replace the version string on the specified line (or the entire file content if no line is specified).
   - If the Versioning section does not exist or the table is empty, only update the VERSION file and CHANGELOG.md.
4. **Commit the version bump**: Stage and commit all version-related file changes:
   ```
   git add VERSION CHANGELOG.md [stack-specific files...]
   git commit -m "chore: bump version to {new_version}"
   ```

### Step 4: Generate PR Content

**Title**: Concise (<70 chars), references the issue
- Format: `feat: [description] (#N)` or `fix: [description] (#N)`
- Use conventional commit prefixes: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

**Body**: Use this structure:

```markdown
## Summary

[2-3 bullet points: what changed and why, referencing the spec]

## Acceptance Criteria

From `.claude/specs/{feature}/requirements.md`:

- [ ] AC1: [criterion]
- [ ] AC2: [criterion]
- [ ] AC3: [criterion]

## Test Plan

From `.claude/specs/{feature}/tasks.md` testing phase:

- [ ] [Test type]: [what was tested]
- [ ] [Test type]: [what was tested]

## Version

<!-- Include this section only if Step 2/3 performed a version bump -->
**{bump_type}** bump: {old_version} → {new_version}

## Specs

- Requirements: `.claude/specs/{feature}/requirements.md`
- Design: `.claude/specs/{feature}/design.md`
- Tasks: `.claude/specs/{feature}/tasks.md`

Closes #N
```

### Step 5: Push and Create PR

1. **Ensure branch is pushed**: Check if remote tracking branch exists
   - If not: `git push -u origin HEAD`
   - If yes but behind: `git push`
2. **Create the PR**:
   ```
   gh pr create --title "[title]" --body "[body]"
   ```
3. **Add labels** if appropriate (same labels as the issue)

### Step 6: Output

```
PR created: [PR URL]

Title: [title]
Base: main ← [branch-name]
Issue: Closes #N

The PR links to specs at .claude/specs/{feature}/ and will close issue #N when merged.

[If `.claude/auto-mode` exists]: Done. Awaiting orchestrator.
```

---

## Guidelines

- **Title**: Under 70 chars, uses conventional commit prefix, references issue
- **Summary**: Focus on *what* and *why*, not implementation details
- **Acceptance criteria**: Copied from requirements.md as a checklist
- **Test plan**: From the testing phase of tasks.md
- **Closes**: Always include `Closes #N` to auto-close the issue on merge

---

## Integration with SDLC Workflow

```
/creating-issues  →  /writing-specs #N  →  /implementing-specs #N  →  /verifying-specs #N  →  /creating-prs #N
                                                                                                    ▲ You are here
```
