---
name: open-pr
description: "Create a pull request with spec-driven summary, linking GitHub issue and spec documents. Use when user says 'create PR', 'open pull request', 'submit for review', 'push for review', 'ready to merge', 'make a PR for issue #N', 'how do I create a PR', 'how do I open a pull request', or 'ship this'. Do NOT use for implementing code, verifying specs, or creating issues. Handles version bumping, changelog updates, and links specs and acceptance criteria. Final step in the SDLC pipeline — follows /verify-code."
argument-hint: "[#issue-number] [--major]"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(gh:*), Bash(git:*), Bash(sleep:*), AskUserQuestion
model: sonnet
effort: low
---

# Open PR

Create a pull request with a spec-driven summary that links to the GitHub issue and references specification documents.

## When to Use

- After implementation is complete and verified via `/verify-code`
- When ready to submit code for review

## Prerequisites

1. Implementation is complete (all tasks from `tasks.md` done). The `{feature-name}` in spec paths is the issue number + kebab-case slug of the title (e.g., `42-add-precipitation-overlay`), matching the branch name. If unsure, use `Glob` to find `specs/*/requirements.md` and match against the current issue number or branch name.
2. Verification has passed (via `/verify-code`)
3. Changes are committed to a feature branch
4. The project uses the current directory layout — no `.claude/steering/` or `.claude/specs/` content remains. See the **Legacy-Layout Precondition** below.

### Legacy-Layout Precondition

Before Step 1, run `Glob` for `.claude/steering/*.md` and `.claude/specs/*/requirements.md`. If either returns a match, abort and print:

```
ERROR: This project uses the legacy `.claude/steering/` and/or `.claude/specs/` directory layout, which current Claude Code releases refuse to write to. Run `/upgrade-project` first, then re-run `/open-pr`.
```

The gate fires in both interactive and unattended mode — do not silently open a PR against a mixed layout.

---

## Workflow

### Step 0: Parse Arguments

Before anything else, inspect the invocation arguments for a `--major` token (this appears alongside the issue number, e.g., `/open-pr #42 --major`).

- If `--major` is present, set a `major_requested` flag and remember it through Step 2. This is the only supported path to a major version bump — the label-based classification matrix never produces one on its own.
- If `--major` is **not** present, `major_requested` is false and the rest of the workflow behaves exactly as it does for any other PR.

**Unattended-mode escalation**: If `.claude/unattended-mode` exists AND `major_requested` is true, print this line exactly:

```
ESCALATION: --major flag requires human confirmation — unattended mode cannot apply a major version bump
```

Then stop immediately. Do NOT continue to Step 1. Do NOT read/write `VERSION`, `CHANGELOG.md`, or any stack-specific version file. Do NOT commit or push. Do NOT create a PR. The purpose of this gate is to keep major-version bumps a deliberate human decision — an automated runner with no human in the loop cannot confirm that intent, so the correct response is to halt and surface the flag for review.

### Step 1: Read Context

Gather all information needed for the PR:

1. **Read the issue**: `gh issue view #N` for title, description, acceptance criteria
2. **Check for spec files**: Use `Glob` with pattern `specs/*/requirements.md` to check whether spec files exist for this feature. Match results against the current issue number or branch name (same logic as the Prerequisites fallback guidance). If a match is found, set a **specs-found** flag. If no match is found, set a **specs-not-found** flag.
3. **Read spec files (specs-found only)**:
   - `specs/{feature-name}/requirements.md` for acceptance criteria
   - `specs/{feature-name}/tasks.md` for testing phase

   > **Skip this sub-step if specs-not-found.** Acceptance criteria will be extracted from the issue body already fetched in step 1.

4. **Read git state**:
   - `git status` — any uncommitted changes?
   - `git log main..HEAD --oneline` — commits on this branch
   - `git diff main...HEAD --stat` — files changed vs main

### Step 2: Determine Version Bump

If a `VERSION` file exists in the project root, determine the appropriate version bump. If no `VERSION` file exists, skip this step and Step 3 entirely.

1. **Read the current version**: Read the `VERSION` file and verify it contains a valid semver string (X.Y.Z). If the content is not valid semver, warn and skip versioning.
2. **Read issue labels**: Run `gh issue view #N --json labels --jq '.labels[].name'` to get the issue's labels.
3. **Read the classification matrix** from `steering/tech.md`:
   - Find the `## Versioning` section, then the `### Version Bump Classification` subsection.
   - Parse the table rows to extract Label → Bump Type mappings (match the Label column against the issue's labels, case-insensitively, stripping any backtick characters).
   - Use the Bump Type from the first matching row.
   - **Fallback**: If the subsection is missing from `tech.md`, or if no issue label matches any row, default to **minor** (same as today's behavior for unlabeled issues).

4. **Calculate the new version string**. If `major_requested` (Step 0) is true, bump **major** (`X.Y.Z → (X+1).0.0`) regardless of the classified type — this is the manual opt-in path. Otherwise use the classified bump type: patch increments Z, minor increments Y and resets Z.

4a. **Sibling-aware downgrade for epic children.** Before presenting to the user, determine whether the current issue is an epic child and whether the bump should be downgraded to a patch:

   1. Parse the current issue body for `Depends on: #E` lines (regex `/Depends on:\s*#(\d+)\b/gi`). If none found, also run `gh issue view #N --json parent` and use the parent field's `number` if non-null.
   2. If no parent candidate is found, OR the parent is not labeled `epic` (`gh issue view #E --json labels --jq '.labels[].name'`), this is not an epic child — skip to Step 5 with the classification from step 4 and `siblingClass = 'non-epic'`.
   3. Otherwise enumerate siblings: read the parent's Child Issues checklist (regex `^\s*-\s*\[[x ]\]\s*#(\d+)`) and collect all referenced issue numbers. Exclude the current issue number from the sibling list.
   4. For each sibling, query `gh issue view #C --json state,closedByPullRequestsReferences`. Classify each sibling as **complete** when `state === 'CLOSED'` AND at least one entry in `closedByPullRequestsReferences` has `state === 'MERGED'` (or `mergedAt != null`); otherwise **incomplete**.
   5. **Downgrade rule:**
      - Every sibling complete → this is the final child. Keep the classified bump (`siblingClass = 'final'`).
      - At least one sibling incomplete → this is an intermediate child. Force `bump_type = 'patch'`, recompute `{proposed}` accordingly, and set `siblingClass = 'intermediate'`.
   6. **Epic-closure warning (AC7a).** Also query `gh issue view #E --json state`. If the epic itself is `CLOSED` while the current child is `OPEN`, warn:
      - **Interactive mode:** use `AskUserQuestion` to confirm before proceeding (`[1] Proceed anyway / [2] Abort — investigate epic closure`). Abort exits the skill without creating the PR.
      - **Unattended mode** (`.claude/unattended-mode` exists): do NOT call `AskUserQuestion` — escalate via the runner sentinel and exit non-zero with message `Epic #E is closed but child #N is still open — confirm the epic was not closed prematurely`.

   Record `siblingClass` (one of `non-epic`, `intermediate`, `final`) and `epicParentNumber` (the resolved epic issue number, or null) for use in Step 3 and Step 4.

5. **Present to user** (via `AskUserQuestion`):
   ```
   question: "Version bump: {current} → {proposed} ({bump_type}). Accept or override?"
   options:
     - "Accept {proposed}"
     - "Patch ({current} → {patch_version})"
     - "Minor ({current} → {minor_version})"
     - "Major ({current} → {major_version})"
   ```

   When `major_requested` is true, the `{bump_type}` shown in the question is `major`, `{proposed}` is the major-bumped version, and the `"Accept {proposed}"` option is pre-selected as the recommended answer — the developer can still choose Patch or Minor as alternatives. When `major_requested` is false, the classified type (patch or minor) is the recommended answer. Major is always available as an override path for developers who did not pass `--major` but decide a major bump is warranted after seeing the prompt.

> **Unattended-mode**: Apply the classified bump without confirmation. Do not call `AskUserQuestion`. Without `--major`, this path reaches only patch or minor bumps — the `major_requested` + unattended combination is rejected in Step 0, so it cannot reach this step.

### Step 3: Update Version Artifacts

If Step 2 determined a version bump, update all version-related files before generating the PR content. If Step 2 was skipped (no VERSION file), skip this step as well.

1. **Update the VERSION file**: Write the new version string to the `VERSION` file.
2. **Update CHANGELOG.md**: If `CHANGELOG.md` exists:
   - Find the `## [Unreleased]` heading.
   - Insert a new version heading `## [{new_version}] - {YYYY-MM-DD}` immediately after it.
   - Move all entries that were under `[Unreleased]` to under the new version heading.
   - Leave the `[Unreleased]` section empty (just the heading with a blank line after it).
   - **Partial-delivery note.** If `siblingClass === 'intermediate'` (from Step 2 step 4a), append ` (partial delivery — see epic #{epicParentNumber})` to the primary bullet under the new version heading. The primary bullet is the first entry line; if there are multiple bullets, only the first receives the suffix. The note must NOT be added for `siblingClass === 'final'` or `non-epic`.
3. **Update stack-specific files**: Read `steering/tech.md` and look for the `## Versioning` section. If it exists, parse the table of stack-specific files and update each one:
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

**Body**: Choose the template based on the flag set in Step 1.

**If specs-found (Template A — current behavior, unchanged)**:

```markdown
## Summary

[2-3 bullet points: what changed and why, referencing the spec]

## Acceptance Criteria

From `specs/{feature}/requirements.md`:

- [ ] AC1: [criterion]
- [ ] AC2: [criterion]
- [ ] AC3: [criterion]

## Test Plan

From `specs/{feature}/tasks.md` testing phase:

- [ ] [Test type]: [what was tested]
- [ ] [Test type]: [what was tested]

## Version

<!-- Include this section only if Step 2/3 performed a version bump -->
**{bump_type}** bump: {old_version} → {new_version}

<!-- Include this line only when siblingClass is 'intermediate' or 'final' (epic children) -->
**Bump:** {bump_type} (epic child: {intermediate|final})

## Specs

- Requirements: `specs/{feature}/requirements.md`
- Design: `specs/{feature}/design.md`
- Tasks: `specs/{feature}/tasks.md`

Closes #N
```

**If specs-not-found (Template B — fallback to issue body)**:

```markdown
## Summary

[2-3 bullet points: what changed and why]

> **No spec files found — acceptance criteria extracted from issue body**

## Acceptance Criteria

From issue body:

- [ ] AC1: [criterion from issue body]
- [ ] AC2: [criterion from issue body]

## Test Plan

- [ ] [Test type]: [what was tested]

## Version

<!-- Include this section only if Step 2/3 performed a version bump -->
**{bump_type}** bump: {old_version} → {new_version}

<!-- Include this line only when siblingClass is 'intermediate' or 'final' (epic children) -->
**Bump:** {bump_type} (epic child: {intermediate|final})

Closes #N
```

### Step 5: Push and Create PR

0. **Pre-push race detection (AC7d).** If Step 2/3 committed a version bump, detect whether `origin/{base-branch}` advanced during local bump-and-commit (a concurrent epic-child PR merged first). Base branch is `main` unless a different target was specified.

   1. Run `git fetch origin`.
   2. Run `git merge-base --is-ancestor HEAD origin/{base-branch}`. If exit code is 0, the bases are in sync — skip to step 1 below.
   3. If non-zero (local is behind), rebase:
      ```bash
      git pull --rebase origin {base-branch}
      ```
   4. **Re-compute the bump** against the now-current `plugin.json` / `package.json` / `VERSION`:
      - Re-read the current version from `VERSION` (authoritative per `steering/tech.md`).
      - Apply the same `siblingClass`-aware bump logic from Step 2 to the new baseline.
      - If the re-computed version differs from what was committed in Step 3, amend the version-bump commit via:
        ```bash
        git checkout VERSION CHANGELOG.md [stack-specific files]
        # redo Step 3 updates against the new baseline
        git add VERSION CHANGELOG.md [stack-specific files]
        git commit --amend -m "chore: bump version to {re-computed-new-version}" --no-edit
        ```
   5. **Conflict handling.** If the rebase produces conflicts in `VERSION`, `plugin.json`, `marketplace.json`, `package.json`, or `CHANGELOG.md`, abort with:
      ```
      ERROR: rebase conflict in version file(s): {file-list}. Resolve manually and re-run /open-pr. Force-push is NEVER used by this skill.
      ```
      Exit non-zero. Do NOT pass `--force` or `--force-with-lease` to any `git push` invocation.

1. **Ensure branch is pushed**: Check if remote tracking branch exists
   - If not: `git push -u origin HEAD`
   - If yes but behind: `git push` (never `--force`)
2. **Create the PR**:
   ```
   gh pr create --title "[title]" --body "[body]"
   ```
3. **Add labels** if appropriate (same labels as the issue)

### Step 6: Output (Base Case)

Print the PR status block:

```
PR created: [PR URL]

Title: [title]
Base: main ← [branch-name]
Issue: Closes #N

[If specs-found]: The PR links to specs at specs/{feature}/ and will close issue #N when merged.
[If specs-not-found]: The PR extracts acceptance criteria from the issue body and will close issue #N when merged.
```

Then branch on the `.claude/unattended-mode` sentinel:

- **If `.claude/unattended-mode` exists**: print `Done. Awaiting orchestrator.` and **stop**. Do NOT proceed to Step 7 — the runner owns CI monitoring and merging. This gate is an active-suppression requirement (see `steering/retrospective.md` → "Missing Acceptance Criteria" on explicitly excluded automation modes).
- **If `.claude/unattended-mode` does NOT exist**: fall through to Step 7.

### Step 7: Interactive CI Monitor + Auto-Merge (Opt-In)

**Gate**: This entire step runs only when `.claude/unattended-mode` does NOT exist. In unattended mode the skill MUST NOT call `AskUserQuestion` for CI monitoring, MUST NOT poll `gh pr checks`, and MUST NOT invoke `gh pr merge`.

1. **Prompt the user** via `AskUserQuestion`:

   ```
   question: "Monitor CI and auto-merge this PR once all required checks pass?"
   options:
     - "Yes, monitor CI and auto-merge"
     - "No, I'll handle it"
   ```

2. **If the user selects "No, I'll handle it"** (opt-out):

   Print the existing next-step guidance and exit:

   ```
   Next step: Wait for CI to pass, then merge the PR to close issue #N. After merging, you can start the next issue with `/draft-issue` (for new work) or `/start-issue` (to pick up an existing issue).
   ```

3. **If the user selects "Yes, monitor CI and auto-merge"** (opt-in):

   Run the polling loop, then the merge + cleanup path (or the failure path on any non-success terminal state).

   **Polling constants** (documented inline for future maintainers; matches `scripts/sdlc-runner.mjs` line 937 for behavioral parity with the unattended runner):

   | Constant | Value |
   |----------|-------|
   | Poll interval | 30 seconds |
   | Poll timeout | 30 minutes |
   | Max polls | 60 |

   **Polling loop**:

   1. Run `gh pr checks <num> --json name,state,link`. If the JSON response is an empty array `[]`, jump to the **No-CI graceful-skip path** below. If the `--json` flag is not supported by the installed `gh` version, fall back to `gh pr checks <num>` (plain text) and check for the "no checks reported" string; if present, also jump to the **No-CI graceful-skip path**.
   2. Map each check's state per the terminal-state table in `specs/feature-open-pr-skill/design.md` → "Terminal-State Mapping":
      - `SUCCESS`, `SKIPPED`, `NEUTRAL` → treat as success for that check.
      - `PENDING`, `IN_PROGRESS`, `QUEUED` → not terminal; keep polling.
      - `FAILURE`, `CANCELLED`, `TIMED_OUT` → terminal failure; jump to the **Failure path**.
   3. Print a progress line on each poll (e.g., `Polling checks... 3/5 complete`).
   4. Sleep 30 seconds, then re-poll. Stop after 60 polls total (30 minutes); treat timeout as a failure and jump to the **Failure path** with the message `Polling timeout (30 min) reached — not merging.`
   5. When every check is in a success-equivalent state, proceed to the **Merge path**.

   **Pre-merge mergeability check** (before invoking `gh pr merge`):

   Run `gh pr view <num> --json mergeable,mergeStateStatus`. If `mergeStateStatus` is anything other than `CLEAN` (e.g., `CONFLICTING`, `BEHIND`, `BLOCKED`, `UNSTABLE`, `DIRTY`), jump to the **Failure path** with the state name in the message. Do NOT merge.

   **Merge path** (all checks green AND `mergeStateStatus == CLEAN`):

   1. Capture the current branch name: `git rev-parse --abbrev-ref HEAD` — store this value as `<branch-name>` for use in step 4. Do this before `git checkout main` so the name is preserved.
   2. `gh pr merge <num> --squash --delete-branch` — squash-merges and deletes the remote branch atomically.
   3. `git checkout main` — detach from the feature branch before deleting it locally.
   4. `git branch -D <branch-name>` — delete the local feature branch using the name captured in step 1.
   5. Print:
      ```
      Merged and cleaned up — you are back on main.
      ```

   **Failure path** (any terminal-failure state, non-`CLEAN` mergeability, or polling timeout):

   1. Print each failing check's name and details URL (from the `link` field returned by `--json`). For non-mergeable states, print the `mergeStateStatus` value and reason. For timeout, print the timeout message from the polling loop.
   2. Do NOT invoke `gh pr merge`. Do NOT run `git branch -D`. Do NOT check out `main` — leave the user on the feature branch so they can push follow-up fixes.
   3. Exit so the user can investigate.

   **No-CI graceful-skip path** (`gh pr checks` reports no checks):

   Print `No CI configured — skipping auto-merge.` and exit. Do NOT merge. Do NOT delete the feature branch. This mirrors the retrospective learning on absent external integrations — graceful skip rather than silent pass-through merge.

---

## Guidelines

- **Title**: Under 70 chars, uses conventional commit prefix, references issue
- **Summary**: Focus on *what* and *why*, not implementation details
- **Acceptance criteria**: Copied from requirements.md as a checklist (specs-found), or extracted from the issue body (specs-not-found)
- **Test plan**: From the testing phase of tasks.md (specs-found), or manually composed from the issue (specs-not-found)
- **Closes**: Always include `Closes #N` to auto-close the issue on merge

---

## Integration with SDLC Workflow

```
/draft-issue  →  /start-issue #N  →  /write-spec #N  →  /write-code #N  →  /simplify  →  /verify-code #N  →  /open-pr #N
                                                                                                                            ▲ You are here
```
