# Root Cause Analysis: Exercise Template Dry-Run Prefix Prevents Skill Recognition

**Issue**: #49
**Date**: 2026-02-25
**Status**: Draft
**Author**: Claude

---

## Root Cause

The exercise testing reference document (`exercise-testing.md`) instructs the verifying agent to **prepend** dry-run instructions before the skill invocation in the exercise prompt. For skills with `disable-model-invocation: true` in their frontmatter, Claude Code relies on seeing `/{skill-name}` at the very start of the prompt to recognize it as a direct skill invocation. When arbitrary text precedes the `/`, the model treats the entire prompt as a conversational request and improvises rather than loading the skill.

Skills without `disable-model-invocation: true` are unaffected because the model proactively recognizes skill names anywhere in the prompt and calls the Skill tool. But when model invocation is disabled, only the leading `/{skill-name}` pattern triggers skill loading — the `disable-model-invocation` setting explicitly prevents the model from proactively calling the Skill tool based on context alone.

The bug is in the prompt construction instructions, not in any executable code. The document tells the agent to "prepend the dry-run instructions below to the exercise prompt" (line 36), which produces: `"{dry-run-prefix}\n\n/{skill-name} {args}"`. The fix is to reverse the order: skill invocation first, dry-run instructions appended after.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `plugins/nmg-sdlc/skills/verifying-specs/references/exercise-testing.md` | 36 | Instruction to "prepend" dry-run prefix before the skill invocation |
| `plugins/nmg-sdlc/skills/verifying-specs/references/exercise-testing.md` | 38–39 | The dry-run prefix text block (labeled "Dry-run prefix") |
| `plugins/nmg-sdlc/skills/verifying-specs/references/exercise-testing.md` | 96 | The `{exercise-prompt}` definition that doesn't account for dry-run text ordering |

### Triggering Conditions

- The changed skill has `disable-model-invocation: true` in its SKILL.md frontmatter
- The skill is also GitHub-integrated (creating-prs, creating-issues, starting-issues), requiring dry-run mode
- The intersection of these two conditions: currently only `creating-prs` (which has both `disable-model-invocation: true` AND is GitHub-integrated)
- The verifying agent follows the "prepend" instruction, placing dry-run text before `/{skill-name}`

---

## Fix Strategy

### Approach

Restructure the exercise prompt instructions in `exercise-testing.md` so that:

1. The skill invocation (`/{skill-name} {args}`) always appears **first** in the prompt
2. Dry-run instructions are **appended after** the skill invocation, prefixed with `IMPORTANT:` to ensure they are treated as constraints
3. The "Dry-run prefix" label is changed to "Dry-run suffix" (or similar) to reflect the new position
4. The `{exercise-prompt}` definition on line 96 is updated to be a composite: `"/{skill-name} {args}\n\nIMPORTANT: {dry-run-instructions}"`

This is a Markdown instruction change — no executable code is modified. The fix ensures Claude Code sees the `/{skill-name}` pattern at the prompt start, triggering skill loading regardless of `disable-model-invocation` settings.

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `plugins/nmg-sdlc/skills/verifying-specs/references/exercise-testing.md` | Line 36: Change "prepend" to "append" and restructure the instruction to place dry-run text after the skill invocation | Ensures `/{skill-name}` is at prompt start for skill recognition |
| `plugins/nmg-sdlc/skills/verifying-specs/references/exercise-testing.md` | Lines 38–39: Rename "Dry-run prefix" to "Dry-run instructions" and prefix the text with "IMPORTANT:" | Clarifies the new position and ensures model treats it as a constraint |
| `plugins/nmg-sdlc/skills/verifying-specs/references/exercise-testing.md` | Line 96: Update `{exercise-prompt}` definition to show the composite format with skill invocation first | Makes the prompt structure explicit for the verifying agent |

### Blast Radius

- **Direct impact**: `plugins/nmg-sdlc/skills/verifying-specs/references/exercise-testing.md` — the single file being modified
- **Indirect impact**: Any verification run that exercises a GitHub-integrated skill will use the new prompt structure. This affects the behavior of step 5c in `/verifying-specs` for `creating-prs`, `creating-issues`, and `starting-issues`.
- **Risk level**: Low — the change only reorders text within the exercise prompt. Skills without `disable-model-invocation` will continue to work because they recognize skill invocations anywhere in the prompt. Skills with `disable-model-invocation` will now also work because the invocation is at the start.

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Non-disable-model-invocation skills stop recognizing skill invocation after reorder | Very Low | These skills recognize `/{skill-name}` anywhere in the prompt — position doesn't matter. AC3 explicitly covers this. |
| Dry-run instructions are ignored when appended after the skill invocation | Low | Prefixing with "IMPORTANT:" and placing on a separate paragraph ensures the model processes them as constraints. AC2 explicitly covers this. |
| The `IMPORTANT:` prefix causes the model to prioritize dry-run over skill execution | Very Low | The skill invocation is processed first by Claude Code's skill loading mechanism (before the model sees the rest). The model only sees the dry-run text after the skill is already loaded. |

---

## Alternatives Considered

| Option | Description | Why Not Selected |
|--------|-------------|------------------|
| Use `--append-system-prompt` for dry-run instructions | Put dry-run text in a system prompt instead of the user prompt | Would require different handling for Agent SDK vs `claude -p` paths; more complex with no additional benefit |
| Remove dry-run mode entirely for disable-model-invocation skills | Skip dry-run and exercise without GitHub safety | Unacceptable — would create real GitHub resources during exercise testing |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
