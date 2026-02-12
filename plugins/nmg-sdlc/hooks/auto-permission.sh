#!/usr/bin/env bash
# PermissionRequest hook — auto-allow all tool permissions in automation mode.
# Gated by .claude/auto-mode flag file; passes through silently when absent.

set -euo pipefail

INPUT=$(cat)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(echo "$INPUT" | jq -r '.cwd')}"

if [ ! -f "$PROJECT_DIR/.claude/auto-mode" ]; then
  exit 0
fi

cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}
EOF
exit 0
