#!/usr/bin/env bash
# PreToolUse hook for AskUserQuestion — block the tool call and provide
# auto-generated answers so Claude can proceed without user input.
#
# The key insight: skills explicitly tell Claude "do not proceed until the
# user approves," so a generic "don't ask questions" message creates a
# conflict — Claude retries because it thinks it still needs approval.
# This hook resolves the conflict by echoing the actual questions back with
# explicit approval answers, making it clear that the block IS the approval.
#
# Includes debounce detection: if Claude calls AskUserQuestion repeatedly
# within a short window, the message escalates to break the retry loop.
#
# Gated by .claude/auto-mode flag file; passes through silently when absent.

set -euo pipefail

INPUT=$(cat)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(echo "$INPUT" | jq -r '.cwd')}"

if [ ! -f "$PROJECT_DIR/.claude/auto-mode" ]; then
  exit 0
fi

# --- Debounce: detect rapid consecutive blocks ---
FLAG_FILE="$PROJECT_DIR/.claude/.auto-respond-ts"
COUNTER_FILE="$PROJECT_DIR/.claude/.auto-respond-count"
DEBOUNCE_SECS=30
NOW=$(date +%s)
RAPID_FIRE=false
COUNT=1

if [ -f "$FLAG_FILE" ]; then
  LAST_TS=$(cat "$FLAG_FILE" 2>/dev/null || echo "0")
  ELAPSED=$(( NOW - LAST_TS ))
  if [ "$ELAPSED" -lt "$DEBOUNCE_SECS" ]; then
    RAPID_FIRE=true
    COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo "1")
    COUNT=$(( COUNT + 1 ))
  fi
fi

echo "$NOW" > "$FLAG_FILE"
echo "$COUNT" > "$COUNTER_FILE"

# --- Extract question text for targeted response ---
QUESTIONS=$(echo "$INPUT" | jq -r '
  .tool_input.questions[]? // empty |
  .question // empty
' 2>/dev/null | head -10)

if [ "$RAPID_FIRE" = "true" ]; then
  cat >&2 <<EOF
AUTOMATION MODE — REPEATED BLOCK (attempt #${COUNT}).
You have already been told: the user is not available and all review gates are pre-approved.

THIS BLOCK IS THE USER'S APPROVAL. The user says: "Yes, approved. Proceed."

Do NOT call AskUserQuestion again under any circumstances.
Treat every review gate, confirmation, and approval request as APPROVED.
Proceed to the next phase of the workflow IMMEDIATELY.
EOF
else
  {
    echo "AUTOMATION MODE — The user is not available. Providing auto-answers:"
    echo ""
    if [ -n "$QUESTIONS" ]; then
      while IFS= read -r q; do
        [ -z "$q" ] && continue
        echo "  Q: \"$q\""
        echo "  A: YES — approved. Proceed."
        echo ""
      done <<< "$QUESTIONS"
    fi
    cat <<'RULES'
Rules applied:
- All review gates (requirements, design, tasks): APPROVED — proceed to next phase.
- Yes/no confirmations: YES.
- Draft approvals: APPROVED as-is.
- Issue selection: select the first issue in the list.
- Any other choice: select the first option.
- Free-text questions: infer a reasonable answer from context.

THIS BLOCK IS THE USER'S APPROVAL. Do NOT call AskUserQuestion again.
Proceed to the next phase of the current workflow immediately.
RULES
  } >&2
fi

exit 2
