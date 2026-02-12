#!/bin/bash
# Claude Code Stop Hook - Notify OpenClaw with rich context
# Only fires in automation mode. Add .noclaw file to disable notifications.

# Check for .noclaw file - skip notification if present (global or project)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
if [ -f "$HOME/.noclaw" ] || [ -f "$PROJECT_DIR/.noclaw" ]; then
  exit 0
fi

# Only fire in automation mode
if [ ! -f "$PROJECT_DIR/.claude/auto-mode" ]; then
  exit 0
fi

# Channel ID passed by OpenClaw via environment
DISCORD_CHANNEL="${OPENCLAW_DISCORD_CHANNEL:-}"
if [ -z "$DISCORD_CHANNEL" ]; then
  exit 0
fi

HOST=$(hostname -s)
PROJECT=$(basename "$PROJECT_DIR")
BRANCH=$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null)

# Git status
if [ -n "$BRANCH" ]; then
  GIT_STATUS=$(git -C "$PROJECT_DIR" status --porcelain 2>/dev/null)
  if [ -z "$GIT_STATUS" ]; then
    BRANCH_INFO="${BRANCH} ✓"
  else
    BRANCH_INFO="${BRANCH} ●"
  fi
  AHEAD_BEHIND=$(git -C "$PROJECT_DIR" rev-list --left-right --count @{upstream}...HEAD 2>/dev/null)
  if [ -n "$AHEAD_BEHIND" ]; then
    BEHIND=$(echo "$AHEAD_BEHIND" | cut -f1)
    AHEAD=$(echo "$AHEAD_BEHIND" | cut -f2)
    [ "$AHEAD" -gt 0 ] && BRANCH_INFO="${BRANCH_INFO} ↑${AHEAD}"
    [ "$BEHIND" -gt 0 ] && BRANCH_INFO="${BRANCH_INFO} ↓${BEHIND}"
  fi
fi

# Find session transcript
ENCODED_PROJECT=$(echo "$PROJECT_DIR" | sed 's|/|-|g')
TRANSCRIPT_DIR="$HOME/.claude/projects/$ENCODED_PROJECT"
if [ -d "$TRANSCRIPT_DIR" ]; then
  TRANSCRIPT=$(ls -t "$TRANSCRIPT_DIR"/*.jsonl 2>/dev/null | head -1)
  if [ -f "$TRANSCRIPT" ]; then
    SESSION_NAME=$(grep -m1 '"slug"' "$TRANSCRIPT" | jq -r '.slug // empty' 2>/dev/null)
    COST=$(grep '"type":"summary"' "$TRANSCRIPT" 2>/dev/null | tail -1 | jq -r '.cost_usd // empty' 2>/dev/null)
    MSG_COUNT=$(grep -c '"type":"user"' "$TRANSCRIPT" 2>/dev/null || echo "0")
    LAST_PROMPT=$(grep '"type":"user"' "$TRANSCRIPT" | grep -v 'tool_result' | tail -n 1 | jq -r 'if (.message.content | type) == "string" then .message.content else "" end' 2>/dev/null | head -n 1 | head -c 100)
  fi
fi

# Build message
MSG="CC finished on ${HOST} | ${PROJECT}"
[ -n "$BRANCH_INFO" ] && MSG="${MSG} (${BRANCH_INFO})"
[ -n "$SESSION_NAME" ] && MSG="${MSG} | ${SESSION_NAME}"
[ -n "$MSG_COUNT" ] && [ "$MSG_COUNT" -gt 0 ] && MSG="${MSG} | ${MSG_COUNT} msgs"
[ -n "$COST" ] && MSG="${MSG} | \$${COST}"
[ -n "$LAST_PROMPT" ] && MSG="${MSG} | → ${LAST_PROMPT}"

# Send via one-shot cron job with announce delivery to Discord
# Backgrounded (&) because openclaw CLI takes ~5-10s to load plugins,
# and Claude Code's hook runner may kill the process before it completes.
nohup openclaw cron add \
  --at "1s" \
  --session isolated \
  --message "CC callback: $MSG — Acknowledge briefly." \
  --announce \
  --channel discord \
  --to "channel:${DISCORD_CHANNEL}" \
  --delete-after-run \
  --name "cc-callback-$(date +%s)" \
  >/dev/null 2>&1 &

exit 0
