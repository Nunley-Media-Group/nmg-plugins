# Defect Report: Retrospectives Severity grep pattern misses bold-formatted fields

**Issue**: #48
**Date**: 2026-02-16
**Status**: Draft
**Author**: Claude
**Severity**: Medium
**Related Spec**: `.claude/specs/1-spec-retrospective-skill/`

---

## Reproduction

### Steps to Reproduce

1. Create a defect spec with the standard bold-formatted Severity field: `**Severity**: High`
2. Run `/running-retrospectives`
3. The skill executes Step 1 and uses Grep to scan for the `Severity:` pattern
4. The initial grep returns no matches because `**Severity**:` contains `**` between the word and colon

### Environment

| Factor | Value |
|--------|-------|
| **OS / Platform** | Any (cross-platform) |
| **Version / Commit** | nmg-sdlc v2.12.6 |
| **Browser / Runtime** | Claude Code CLI |
| **Configuration** | Default |

### Frequency

Always — every defect spec uses the bold `**Severity**:` format from the template.

---

## Expected vs Actual

| | Description |
|---|-------------|
| **Expected** | The skill detects all defect specs on the first grep for the Severity field |
| **Actual** | The first grep for `Severity:` fails to match `**Severity**: High` because `**` characters separate the word from the colon; the skill must fall back to broader search patterns |

### Error Output

```
Exercise output:
> Let me check with a broader pattern — the Severity: field might be formatted differently.
> I found the defect spec. The Severity field was formatted with ** bold markers
```

---

## Acceptance Criteria

**IMPORTANT: Each criterion becomes a Gherkin BDD test scenario.**

### AC1: Severity Detection Handles Bold Markdown

**Given** a defect spec with bold-formatted Severity field (`**Severity**: High`)
**When** the running-retrospectives skill scans for defect specs in Step 1
**Then** the spec is detected on the first search attempt without requiring fallback patterns

### AC2: Plain Severity Format Still Matches

**Given** a defect spec with plain-formatted Severity field (`Severity: High`)
**When** the running-retrospectives skill scans for defect specs in Step 1
**Then** the spec is detected on the first search attempt

### AC3: No False Positives on Feature Specs

**Given** a feature spec that does not contain any Severity field
**When** the running-retrospectives skill scans for defect specs in Step 1
**Then** the feature spec is not identified as a defect spec

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Update the grep pattern in SKILL.md Step 1 to match both `**Severity**:` and `Severity:` formats | Must |
| FR2 | The updated pattern must not introduce false positives on feature specs | Should |

---

## Out of Scope

- Changing the defect requirements template format (the bold formatting is intentional)
- Modifying how the Severity field is consumed after detection (Step 2+ of the workflow)
- Adding support for other markdown formatting variants (e.g., `_Severity_:`, `### Severity:`)

---

## Validation Checklist

Before moving to PLAN phase:

- [x] Reproduction steps are repeatable and specific
- [x] Expected vs actual behavior is clearly stated
- [x] Severity is assessed
- [x] Acceptance criteria use Given/When/Then format
- [x] At least one regression scenario is included
- [x] Fix scope is minimal — no feature work mixed in
- [x] Out of scope is defined
