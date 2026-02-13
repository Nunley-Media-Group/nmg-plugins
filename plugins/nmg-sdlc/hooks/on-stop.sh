#!/bin/bash
# Claude Code Stop Hook - Notify OpenClaw when a session ends.
# Only fires in automation mode. Add .claude/.nodiscord to suppress notifications.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lib.sh
source "$SCRIPT_DIR/_lib.sh"

claw_guard
gather_context
build_message "CC finished"
send_claw_message "cc-callback" "$MSG"

exit 0
