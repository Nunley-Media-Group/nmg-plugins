# Root Cause Analysis: Retrospectives Severity grep pattern misses bold-formatted fields

**Issue**: #48
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude

---

## Root Cause

The `/running-retrospectives` skill's Step 1 instructs Claude to use Grep to identify defect specs by scanning for the `Severity:` field. The instruction text on line 34 of the SKILL.md reads:

> Then use Grep to identify defect specs by scanning for the `Severity:` field

When Claude executes this instruction, it uses a grep pattern like `Severity:` (literal colon immediately after the word). However, the defect requirements template (`writing-specs/templates/requirements.md`, line 213) formats this field with bold markdown:

```
**Severity**: Critical | High | Medium | Low
```

In the raw markdown, the characters are `**Severity**:` — the `**` bold markers appear between the word "Severity" and the colon. The literal pattern `Severity:` requires the colon to immediately follow the `y`, so it fails to match `**Severity**:` where `**` intervenes.

The skill recovers via broader fallback searches (Claude adapts by trying alternative patterns), but the initial detection is fragile and relies on Claude's improvisation rather than a correct instruction.

### Affected Code

| File | Lines | Role |
|------|-------|------|
| `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md` | 34 | Instructs the grep pattern for identifying defect specs |

### Triggering Conditions

- A defect spec exists with the bold-formatted `**Severity**:` field (which is ALL defect specs, since this is the template format)
- The running-retrospectives skill executes Step 1
- Claude follows the instruction literally and greps for `Severity:`

---

## Fix Strategy

### Approach

Update the instruction text in Step 1 to specify a grep pattern that matches both the bold-formatted `**Severity**:` and a hypothetical plain `Severity:` variant. The pattern `Severity` (the word alone, without requiring an adjacent colon) is sufficient — the Severity field is unique to defect specs and does not appear in feature specs. However, to reduce false-positive risk, a more targeted pattern like `\*{0,2}Severity\*{0,2}:` (allowing optional `**` markers around the word) is more precise.

The simplest and most robust approach: change the instruction to tell Claude to grep for `Severity` (without the colon), since this word only appears in defect spec headers and validation checklists. Even the checklist line (`Severity is assessed`) would correctly identify the file as a defect spec.

### Changes

| File | Change | Rationale |
|------|--------|-----------|
| `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md` | Update line 34 to use a pattern that handles optional bold markdown formatting around `Severity` | Ensures the grep matches the actual template output (`**Severity**: High`) on the first attempt |

### Blast Radius

- **Direct impact**: `plugins/nmg-sdlc/skills/running-retrospectives/SKILL.md` — one line of instructional text
- **Indirect impact**: Any automation running `/running-retrospectives` will now detect defect specs on the first grep instead of relying on fallback behavior
- **Risk level**: Low — the change makes detection more reliable without altering the skill's downstream behavior (Steps 2–9 are unchanged)

---

## Regression Risk

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Updated pattern matches feature specs as false positives | Low | The word "Severity" does not appear in the feature requirements template; AC3 verifies this |
| Pattern change breaks plain-format detection | Low | AC2 verifies that plain `Severity:` format (if it ever exists) is still matched |

---

## Validation Checklist

Before moving to TASKS phase:

- [x] Root cause is identified with specific code references
- [x] Fix is minimal — no unrelated refactoring
- [x] Blast radius is assessed
- [x] Regression risks are documented with mitigations
- [x] Fix follows existing project patterns (per `structure.md`)
