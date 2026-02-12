#!/usr/bin/env bash
# PreToolUse hook for EnterPlanMode — block plan mode entry and instruct Claude
# to design the implementation approach internally, then proceed directly.
# Gated by .claude/auto-mode flag file; passes through silently when absent.

set -euo pipefail

INPUT=$(cat)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(echo "$INPUT" | jq -r '.cwd')}"

if [ ! -f "$PROJECT_DIR/.claude/auto-mode" ]; then
  exit 0
fi

cat >&2 <<'EOF'
AUTOMATION MODE — Do not enter plan mode. Instead:
1. Design your implementation approach internally based on the specs (requirements.md, design.md, tasks.md).
2. Use Glob, Grep, and Read to explore the codebase and map tasks to files as you normally would in plan mode.
3. Proceed directly to executing implementation tasks sequentially.
Do NOT call EnterPlanMode again. Begin implementation now.
EOF
exit 2
