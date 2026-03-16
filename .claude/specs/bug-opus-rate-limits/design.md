# Root Cause Analysis: Skills Force Opus Model

**Issues**: #111
**Date**: 2026-03-15

---

## Root Cause

The `model` frontmatter field in SKILL.md controls which model Claude Code uses to execute the skill. Five skills were set to `model: opus` during initial development when Opus rate limits were more permissive. With Opus 4.6 1M context, rate limits are significantly tighter (lower TPM/RPM), and forcing Opus on skills that don't require it unnecessarily consumes the user's Opus quota.

Additionally, `disable-model-invocation: true` was only applied to 3 of 12 skills. The remaining 9 skills' descriptions were always included in the available skills list, adding token overhead to every API call.

### Affected Code

| File | Field | Current | Issue |
|------|-------|---------|-------|
| `skills/implementing-specs/SKILL.md` | `model: opus` | Forces Opus | Should inherit session model |
| `skills/writing-specs/SKILL.md` | `model: opus` | Forces Opus | Should inherit session model |
| `skills/migrating-projects/SKILL.md` | `model: opus` | Forces Opus | Template diffing doesn't need Opus |
| `skills/running-retrospectives/SKILL.md` | `model: opus` | Forces Opus | Analysis can use Sonnet |
| `skills/setting-up-steering/SKILL.md` | `model: opus` | Forces Opus | Template-based setup doesn't need Opus |
| `skills/running-sdlc-loop/SKILL.md` | missing `disable-model-invocation` | In available skills list | Only invoked via slash command |
| `skills/installing-openclaw-skill/SKILL.md` | missing `disable-model-invocation` | In available skills list | Only invoked via slash command |
| `skills/generating-openclaw-config/SKILL.md` | missing `disable-model-invocation` | In available skills list | Only invoked via slash command |
| `skills/running-retrospectives/SKILL.md` | missing `disable-model-invocation` | In available skills list | Only invoked via slash command |

## Fix Strategy

Minimal frontmatter-only changes across 8 SKILL.md files:

1. **Remove `model` field** from `implementing-specs` and `writing-specs` — these benefit from the best model but should inherit the user's session choice rather than forcing Opus
2. **Change `model: opus` to `model: sonnet`** on `migrating-projects`, `running-retrospectives`, `setting-up-steering` — these perform template-based operations that don't require Opus reasoning
3. **Add `disable-model-invocation: true`** to `running-sdlc-loop`, `installing-openclaw-skill`, `generating-openclaw-config`, `running-retrospectives` — these are only used via explicit slash commands

## Blast Radius

- **Low risk**: Changes are frontmatter-only — no skill logic or body content is modified
- **No behavioral change** for users who invoke skills via slash commands (which is the primary usage pattern)
- **Positive change**: Users on Opus 4.6 1M will see fewer rate limit errors
- **Trade-off**: `migrating-projects`, `running-retrospectives`, and `setting-up-steering` will use Sonnet instead of Opus, which may slightly reduce output quality for complex analysis — but these skills perform structured/template-based operations where Sonnet is sufficient

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Skills that needed Opus reasoning quality produce lower quality output on Sonnet | Low | Only template-based skills were downgraded; complex skills inherit session model |
| Users who relied on auto-triggering of now-disabled skills lose functionality | Very Low | All affected skills are only ever invoked via slash commands |
| Removing `model` field causes unexpected behavior | Very Low | Claude Code defaults to session model when no `model` field is present |

---

## Change History

| Issue | Date | Summary |
|-------|------|---------|
| #111 | 2026-03-15 | Initial root cause analysis |
