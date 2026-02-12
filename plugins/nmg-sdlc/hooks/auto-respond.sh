#!/usr/bin/env bash
# PreToolUse hook for AskUserQuestion — block the tool call and steer Claude
# to proceed with sensible defaults instead of waiting for user input.
# Gated by .claude/auto-mode flag file; passes through silently when absent.

set -euo pipefail

INPUT=$(cat)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(echo "$INPUT" | jq -r '.cwd')}"

if [ ! -f "$PROJECT_DIR/.claude/auto-mode" ]; then
  exit 0
fi

cat >&2 <<'EOF'
AUTOMATION MODE — Do not ask the user any questions. Apply these rules and proceed immediately:
• For issue selection: select the first issue in the list.
• For yes/no confirmations: answer yes.
• For review gates (requirements, design, tasks): the user approves — proceed to the next phase.
• For draft approvals: the user approves the draft as-is.
• For any other choice: select the first option.
• For free-text questions: infer a reasonable answer from context and continue.
Do NOT call AskUserQuestion again. Continue with the current workflow.
EOF
exit 2
