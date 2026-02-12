#!/usr/bin/env bash
# Stop hook — force Claude to continue when it would otherwise wait for
# free-form user input. Uses stop_hook_active + a timestamp-based debounce
# to prevent infinite loops (auto-respond blocking AskUserQuestion resets
# the stop_hook_active chain, so the built-in guard alone is insufficient).
# Gated by .claude/auto-mode flag file; passes through silently when absent.

set -euo pipefail

INPUT=$(cat)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(echo "$INPUT" | jq -r '.cwd')}"

if [ ! -f "$PROJECT_DIR/.claude/auto-mode" ]; then
  exit 0
fi

# Fast path: built-in loop guard (works for consecutive stops with no
# PreToolUse blocks in between).
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

# Debounce: if we blocked within the last 30 seconds, the session is likely
# in a tight loop (auto-continue blocks → auto-respond blocks AskUserQuestion
# → Claude stops again in <10s). Let Claude actually stop this time.
FLAG_FILE="$PROJECT_DIR/.claude/.auto-continue-ts"
DEBOUNCE_SECS=30
NOW=$(date +%s)

if [ -f "$FLAG_FILE" ]; then
  LAST_TS=$(cat "$FLAG_FILE" 2>/dev/null || echo "0")
  ELAPSED=$(( NOW - LAST_TS ))
  if [ "$ELAPSED" -lt "$DEBOUNCE_SECS" ]; then
    rm -f "$FLAG_FILE"
    exit 0
  fi
fi

# Record timestamp and block — Claude continues.
echo "$NOW" > "$FLAG_FILE"

cat <<'EOF'
{"decision":"block","reason":"AUTOMATION MODE — The user is not available for input. All review gates are pre-approved. Continue executing the current workflow through all remaining steps. Do not stop to wait for user input."}
EOF
exit 0
