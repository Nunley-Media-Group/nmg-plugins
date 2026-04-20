---
name: canary
description: Fixture skill used by the skill-inventory audit self-test. Not installed at runtime.
---

# Canary Skill

This fixture exercises the audit script's extraction rules. Its content is
intentionally stable — changing it requires regenerating the canary fixtures.

## Prerequisites

1. The audit script exists at `scripts/skill-inventory-audit.mjs`.
2. A canary-only baseline can be generated against this fixture.

## Workflow

### Step 1: Read the Input

#### Input

- A canary SKILL.md file
- A canary references file loaded on demand

#### Process

1. The audit walks the tracked file tree.
2. Each tracked clause is normalized and hashed.
3. The extracted inventory is compared to the baseline.

When `.claude/unattended-mode` exists, the skill proceeds deterministically.

#### Output

- A clean audit report when nothing has been dropped

### Step 2: Emit the Result

#### Input

- Inventory items from Step 1

#### Process

Render the result line to stdout.

#### Output

- Human-readable stdout line

## Human Review Gate

Not applicable for the canary skill — it runs end-to-end without pause.

## Integration with SDLC Workflow

The canary skill is never invoked by users. It exists so the audit's extraction
logic has a fixture it must consistently accept.
