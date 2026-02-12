#!/bin/bash
# Claude Code Notification Hook - Notify OpenClaw when CC is waiting for input.
# Only fires in automation mode. Add .noclaw file to disable notifications.
# Debounces: skips if last notification was less than 60 seconds ago.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lib.sh
source "$SCRIPT_DIR/_lib.sh"

claw_guard

# Debounce: one notification per 60 seconds per project
ENCODED_PROJECT=$(echo "$PROJECT_DIR" | sed 's|/|-|g')
STAMP_FILE="/tmp/nmg-claw-notify-${ENCODED_PROJECT}"
NOW=$(date +%s)
if [ -f "$STAMP_FILE" ]; then
  LAST=$(cat "$STAMP_FILE" 2>/dev/null || echo "0")
  ELAPSED=$((NOW - LAST))
  if [ "$ELAPSED" -lt 60 ]; then
    exit 0
  fi
fi
echo "$NOW" > "$STAMP_FILE"

gather_context
build_message "CC waiting"
send_claw_message "cc-waiting" "$MSG"

exit 0
