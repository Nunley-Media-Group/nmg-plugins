# draft-issue Exercise Rubric

**Consumed by**: `scripts/skill-exercise-runner.mjs`.
**Triggering condition**: The runner is invoked with `--skill draft-issue` against the fixture at `scripts/__fixtures__/skill-exercise/draft-issue/`.

Two classes of check: **deterministic** (byte- or structure-equivalent — these map 1:1 to issue #146 ACs and must pass byte-exactly against any pre-refactor baseline) and **rubric-graded** (model-authored content judged by shape, not exact bytes).

## Deterministic Checks

| ID | Check | Pass Criteria | Maps To |
|----|-------|---------------|---------|
| D1 | SKILL.md line count | `wc -l plugins/nmg-sdlc/skills/draft-issue/SKILL.md ≤ 300` | AC1 (issue #146) |
| D2 | Frontmatter byte-identity | `diff` of frontmatter pre/post refactor is empty | AC2 (issue #146) / AC5 (epic) |
| D3 | Pointer grammar | `grep -cE '^Read \`(\.\./\.\./)?references/[^\`]+\.md\` when ' plugins/nmg-sdlc/skills/draft-issue/SKILL.md` ≥ 1 and every reference-pointer line in the file matches the grammar | AC3 (issue #146) / AC7 (epic) |
| D4 | Reference file budget | `ls plugins/nmg-sdlc/skills/draft-issue/references/ | wc -l ≤ 5` | AC8 (epic) |
| D5 | Every referenced file exists | Every path named in a pointer line resolves to a real file | Pointer correctness |
| D6 | Audit passes | `node scripts/skill-inventory-audit.mjs --check` exits 0 | AC5 (issue #146) / AC6 (epic) |
| D7 | Slash-command surface | `name:` and `description:` frontmatter fields are byte-identical to the pre-refactor baseline | AC4 (epic) |
| D8 | References > 300 lines have a TOC | Any `draft-issue/references/*.md` over 300 lines includes a Markdown TOC within the first 30 lines | AC8 (epic) |

## Rubric-Graded Checks

These require a real Agent-SDK exercise run that captures the skill's drafted issue body. The runner executes them only when it has captured an artifact; otherwise it emits a `skipped (no model artifact)` status and the overall exit code is still `0` as long as every deterministic check passes.

| ID | Check | Grade |
|----|-------|-------|
| R1 | Title shape | Starts with a verb (first word matches `/^[A-Z][a-z]+\b/` and is an action verb like Add/Fix/Implement/Refactor) |
| R2 | AC count | ≥ 3 acceptance criteria for feature classification; ≥ 2 for bug |
| R3 | AC format | Every AC block contains `**Given**`, `**When**`, and `**Then**` lines (or the equivalent unbolded prefix) |
| R4 | User Story present (feature) | Body contains `**As a**`, `**I want**`, `**So that**` lines under a `## User Story` heading |
| R5 | Root-Cause Analysis present (bug) | Body contains a `## Root Cause Analysis` heading with a non-empty paragraph and a `**User Confirmed**` line |
| R6 | Out of Scope section | Body contains a `## Out of Scope` heading with at least one bullet |

## Pre-Refactor Baseline

The pre-refactor baseline for D1–D8 is derived from `git show main:plugins/nmg-sdlc/skills/draft-issue/SKILL.md` (line count, frontmatter block) at the merge-base of this branch. Baselines for model-authored artifacts (R1–R6) are captured only when the runner executes a full Agent-SDK exercise — the harness stubs this mode out when the SDK or test repo is unavailable and reports `skipped (exercise-mode unavailable)` for each rubric check.

## Invocation

```
node scripts/skill-exercise-runner.mjs --skill draft-issue
```

Exits 0 when every deterministic check passes and every rubric check is either `pass` or `skipped`; exits 1 otherwise.
