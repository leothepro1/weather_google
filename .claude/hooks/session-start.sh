#!/usr/bin/env bash
# SessionStart hook — fires when Claude Code starts a session.
# stdout is added to Claude's context, so we keep this terse: a pointer to
# yesterday's EOD log and the roadmap, not the full content. Claude reads
# those files only if relevant to the upcoming work.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

LATEST_EOD="$(ls -1t docs/session-logs/*-eod.md 2>/dev/null | head -n 1 || true)"

echo "## Session continuity"
if [ -n "${LATEST_EOD}" ]; then
  echo "Most recent EOD log: \`${LATEST_EOD}\` — read it if you are starting fresh work, skip if you are clearly continuing the previous session."
else
  echo "No previous EOD log found. This is the first tracked session."
fi

if [ -f "docs/roadmap.md" ]; then
  echo "Active roadmap: \`docs/roadmap.md\` — consult before starting a new module."
fi
