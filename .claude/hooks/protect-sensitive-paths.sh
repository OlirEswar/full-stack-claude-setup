#!/usr/bin/env bash
# PreToolUse hook for Edit/Write/MultiEdit: blocks edits to files no subagent
# should ever touch, regardless of which one is running or what the
# permission allow-list says. This is the hard control — the allow-list in
# settings.json only reduces prompts, it doesn't scope *where* edits land.
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  # jq isn't guaranteed outside the devcontainer (it is guaranteed inside).
  # Fail open rather than break every edit on a machine without it.
  exit 0
fi

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null || true)

PROTECTED_PATTERNS=(
  '\.env$'
  '\.env\.'
  '/\.git/'
  '(^|/)\.devcontainer/'
  '\.claude/settings'
)

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ -n "$file_path" && "$file_path" =~ $pattern ]]; then
    echo "Blocked: '$file_path' matches protected pattern '$pattern' — this path is off-limits to agent edits." >&2
    exit 2
  fi
done

exit 0
