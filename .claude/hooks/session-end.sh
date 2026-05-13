#!/usr/bin/env bash
# SessionEnd hook — fires when the session terminates.
# This is the deterministic backstop: regardless of whether Claude remembered
# to run /eod, an EOD skeleton always exists for the dashboard to parse.
# The richer narrative is added by Claude via /eod when the user signals
# end-of-day.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

TODAY="$(date -u +%Y-%m-%d)"
NOW_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
LOG_DIR="docs/session-logs"
EOD_FILE="${LOG_DIR}/${TODAY}-eod.md"
META_FILE="${LOG_DIR}/.metadata.jsonl"

mkdir -p "$LOG_DIR"

# The harness pipes a JSON payload to stdin describing the session.
# We extract what we can without depending on jq being installed.
HOOK_INPUT="$(cat 2>/dev/null || true)"
SESSION_ID="$(printf '%s' "$HOOK_INPUT" | grep -oE '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n 1 | sed -E 's/.*"([^"]*)"$/\1/' || true)"
TRANSCRIPT_PATH="$(printf '%s' "$HOOK_INPUT" | grep -oE '"transcript_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n 1 | sed -E 's/.*"([^"]*)"$/\1/' || true)"
SESSION_ID="${SESSION_ID:-unknown}"

FILES_CHANGED="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
COMMITS_8H="$(git log --since='8 hours ago' --pretty=format:'- %h %s' 2>/dev/null || true)"

# Initialise the day's EOD file on the first session of the day.
if [ ! -f "$EOD_FILE" ]; then
  cat > "$EOD_FILE" <<HEADER
---
date: ${TODAY}
type: eod
status: in-progress
sessions: []
---

# End of Day — ${TODAY}

HEADER
fi

# Append a skeleton entry for this session. Claude enriches it via /eod.
cat >> "$EOD_FILE" <<ENTRY

## Session \`${SESSION_ID:0:8}\` — ${NOW_ISO}

- **Files dirty in working tree at close:** ${FILES_CHANGED}
- **Transcript:** \`${TRANSCRIPT_PATH:-<unavailable>}\`

**Commits in last 8h:**
${COMMITS_8H:-_(none)_}

> _Narrative pending — run \`/eod\` in the next session to enrich._

ENTRY

# Machine-readable feed for the dashboard.
printf '{"session_id":"%s","ended_at":"%s","files_changed":%s,"transcript":"%s","branch":"%s"}\n' \
  "$SESSION_ID" \
  "$NOW_ISO" \
  "$FILES_CHANGED" \
  "${TRANSCRIPT_PATH:-}" \
  "$(git branch --show-current 2>/dev/null || echo unknown)" \
  >> "$META_FILE"

exit 0
