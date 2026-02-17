# Root Cause Analysis: migrating-projects Respects auto-mode Despite Spec Excluding It

**Issue**: #46
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude

---

## Root Cause

The bug is a prompt-level priority conflict in the `migrating-projects` SKILL.md. Claude learns the auto-mode pattern from other skills in the same plugin session. Skills like `writing-specs`, `implementing-specs`, and `verifying-specs` all follow a consistent pattern: a prominent **Automation Mode** section near the top of the skill declares that `.claude/auto-mode` pre-approves all review gates and instructs Claude not to call `AskUserQuestion`.

The `migrating-projects` skill lacks this structural pattern. Instead, it communicates the auto-mode exemption in two ways:

1. **Line 222** — A bold note after the `AskUserQuestion` code block: `**This skill does not support auto-mode.** Always present findings and wait for user approval.`
2. **Line 279** — A Key Rules entry: `5. **Always interactive** — Present findings and wait for approval before applying`

Both are buried in the workflow step body and Key Rules list, respectively — neither appears near the top of the skill in the prominent position where Claude has been trained (by the other skills) to look for auto-mode instructions. When Claude loads the plugin and reads the skill, it may apply the auto-mode pattern it learned from other skills before reaching the override text deep in the workflow.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` | 213–222 | Step 9 review gate with auto-mode exemption note |
| `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` | 279 | Key Rules item stating always-interactive |

### Triggering Conditions

- `.claude/auto-mode` file exists in the project directory
- Claude has loaded the nmg-sdlc plugin (which includes other skills with prominent auto-mode sections)
- Claude encounters the `AskUserQuestion` call in Step 9 and skips it based on the auto-mode pattern learned from other skills
- The exemption note at line 222 is either not reached in time or not weighted heavily enough to override the pattern

---

## Fix Strategy

### Approach

Add an explicit **Automation Mode** section near the top of the SKILL.md, in the same structural position and format used by other skills (after the "When to Use" section, before the workflow steps). This section will use the same heading and formatting convention but with the opposite instruction: **always interactive, regardless of auto-mode**.

This works because Claude prioritizes instructions that appear early in the prompt and match established structural patterns. By placing the auto-mode exemption in the exact location where Claude expects auto-mode instructions, the override becomes impossible to miss.

The existing notes at lines 222 and 279 will be preserved as reinforcement, but the primary fix is the new top-level section.

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` | Add `## Automation Mode` section after `## When to Use` (before `## What Gets Analyzed`) | Places the auto-mode exemption in the structurally expected position — same heading, same location as other skills — but with explicit override instructions |

The new section content:

```markdown
## Automation Mode

**This skill is ALWAYS interactive — `.claude/auto-mode` does NOT apply.**

Even if `.claude/auto-mode` exists in the project directory, this skill MUST present proposed changes via `AskUserQuestion` and wait for user approval before modifying any files. Migration is a sensitive operation that requires human review.

Do NOT skip the review gate in Step 9. Do NOT apply changes without explicit user approval.
```

### Blast Radius

- **Direct impact**: Only `plugins/nmg-sdlc/skills/migrating-projects/SKILL.md` is modified
- **Indirect impact**: None — no other skills reference or depend on migrating-projects' auto-mode handling. The change adds a section; it doesn't modify any existing content that other skills consume.
- **Risk level**: Low

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Other skills accidentally become always-interactive | Low | The change is scoped to migrating-projects' SKILL.md only; no shared auto-mode mechanism is modified |
| The new section contradicts existing text in the skill | Low | The existing notes at lines 222 and 279 already say the same thing — the new section reinforces them |
| Claude ignores the new section due to conflicting signals | Low | The section uses the same structural pattern Claude recognizes from other skills, maximizing salience |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
