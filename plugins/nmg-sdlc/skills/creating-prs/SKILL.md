---
name: creating-prs
description: "Create a pull request with spec-driven summary, linking GitHub issue and spec documents."
argument-hint: "[#issue-number]"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(gh:*), Bash(git:*)
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

### Step 2: Generate PR Content

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

## Specs

- Requirements: `.claude/specs/{feature}/requirements.md`
- Design: `.claude/specs/{feature}/design.md`
- Tasks: `.claude/specs/{feature}/tasks.md`

Closes #N
```

### Step 3: Push and Create PR

1. **Ensure branch is pushed**: Check if remote tracking branch exists
   - If not: `git push -u origin HEAD`
   - If yes but behind: `git push`
2. **Create the PR**:
   ```
   gh pr create --title "[title]" --body "[body]"
   ```
3. **Add labels** if appropriate (same labels as the issue)

### Step 4: Output

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
