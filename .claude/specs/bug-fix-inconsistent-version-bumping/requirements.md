# Defect Report: Inconsistent version bumping in automated SDLC runs

**Issue**: #60
**Date**: 2026-02-19
**Status**: Draft
**Author**: Claude (nmg-sdlc)
**Severity**: High
**Related Spec**: `.claude/specs/feature-integrated-versioning-system/`

---

## Reproduction

### Steps to Reproduce

1. Configure OpenClaw SDLC runner against a project with a `VERSION` file and `.claude/steering/tech.md` versioning section
2. Queue multiple issues with identical labels (`bug`) and milestone (`v0`)
3. Let the runner process them sequentially through the full SDLC cycle (steps 1–9)
4. Check the resulting PRs for `chore: bump version` commits

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | macOS (Darwin 25.3.0) |
| **Version / Commit** | nmg-sdlc 2.12.5 |
| **Browser / Runtime** | Node.js v24+ (sdlc-runner.mjs) |
| **Configuration** | OpenClaw SDLC runner in auto-mode; chrome-cli project (Rust/Cargo) |

### Frequency

Intermittent (~50% of the time). In a batch of 6 consecutive issues (#114–#119 on chrome-cli), 3 out of 6 PRs were missing version bumps. All 3 missing bumps correlated with "save work before retry" commits, meaning neither the original attempt nor the retry performed the bump.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | Every PR created by the SDLC runner includes a version bump commit that updates the `VERSION` file, `CHANGELOG.md`, and stack-specific version files (e.g., `Cargo.toml`) |
| **Actual** | Approximately 50% of PRs are missing the version bump. The version bump is skipped non-deterministically depending on whether the `claude -p` subprocess follows the full `/creating-prs` skill workflow |

### Error Output

No error output — the version bump is silently skipped. The `/creating-prs` skill instructions (Steps 2–3) are delivered as appended system prompt text, but the runner's Step 7 prompt is generic:

```
"Create a pull request for branch ${branch} targeting main for issue #${issue}."
```

Under turn/time pressure, the LLM sometimes skips the version bumping steps and jumps directly to PR creation.

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Deterministic Version Bump Step

**Given** the SDLC runner is processing an issue for a project with a `VERSION` file
**When** the runner reaches the PR creation phase (Step 7)
**Then** a deterministic step (before the `/creating-prs` skill) bumps the `VERSION` file, updates `CHANGELOG.md`, and updates stack-specific version files defined in `.claude/steering/tech.md`

**Example**:
- Given: Project has `VERSION` containing `0.1.5`, `tech.md` lists `Cargo.toml:package.version`, issue has `bug` label
- When: Runner reaches Step 7
- Then: A dedicated version bump step runs first, producing a `chore: bump version to 0.1.6` commit before the PR creation subprocess starts

### AC2: Reinforced Skill Instructions (Defense-in-Depth)

**Given** the `/creating-prs` skill is running in auto-mode
**When** the LLM processes the skill instructions and the runner's Step 7 prompt
**Then** both the skill text and the runner's Step 7 prompt explicitly state that version bumping is mandatory

**Example**:
- Given: Runner constructs the Step 7 prompt for `claude -p`
- When: The prompt is assembled
- Then: It includes explicit text like "You MUST bump the version before creating the PR" in addition to the skill's own Steps 2–3

### AC3: Postcondition Verification

**Given** the PR creation step (Step 7) has completed
**When** the runner evaluates step success
**Then** the runner verifies that `VERSION` has changed relative to `main`, and retries the step if the version was not bumped

**Example**:
- Given: Step 7 completed successfully (exit code 0)
- When: Runner checks postconditions
- Then: Runner runs `git diff main -- VERSION` and if the output is empty, marks the step as failed and triggers a retry with an explicit version bump instruction

### AC4: No Regression for Manual Workflow

**Given** a developer runs `/creating-prs` interactively (no auto-mode)
**When** the skill reaches Step 2 (version bump)
**Then** the existing interactive confirmation flow (`AskUserQuestion`) still works as before — the developer is prompted to confirm the version bump type and can override

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Add a deterministic version bump step to `sdlc-runner.mjs` that runs before the PR skill step (Step 7). This step reads `VERSION`, issue labels, milestone, and `.claude/steering/tech.md` to compute the bump type and update all version artifacts. | Must |
| FR2 | The deterministic step commits version changes with `chore: bump version to {new_version}` message format | Must |
| FR3 | Add a postcondition check after PR creation (Step 7) that verifies `VERSION` changed vs `main`; retry the step if version was not bumped | Must |
| FR4 | Strengthen the runner's Step 7 prompt to explicitly mention version bumping as mandatory (defense-in-depth alongside the deterministic step) | Should |
| FR5 | Preserve the existing interactive version bump flow in `/creating-prs` for manual (non-auto-mode) use | Must |

---

## Out of Scope

- Changing the version classification matrix (patch/minor/major logic) — that's defined in spec #41
- Modifying how milestones trigger major bumps
- Adding version bumping to non-PR steps (implementation, verification)
- Refactoring the `/creating-prs` skill's version bump steps beyond adding "mandatory" language

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included (AC4)
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
