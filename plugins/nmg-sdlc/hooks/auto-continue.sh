#!/usr/bin/env bash
# Stop hook — force Claude to continue when it would otherwise wait for
# free-form user input. Uses stop_hook_active to prevent infinite loops.
# Gated by .claude/auto-mode flag file; passes through silently when absent.

set -euo pipefail

INPUT=$(cat)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(echo "$INPUT" | jq -r '.cwd')}"

if [ ! -f "$PROJECT_DIR/.claude/auto-mode" ]; then
  exit 0
fi

STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

# Prevent infinite loops: if we already forced continuation once, let Claude stop.
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

cat <<'EOF'
{"decision":"block","reason":"AUTOMATION MODE — The user is not available for input. All review gates are pre-approved. Continue executing the current workflow through all remaining steps. Do not stop to wait for user input."}
EOF
exit 0
