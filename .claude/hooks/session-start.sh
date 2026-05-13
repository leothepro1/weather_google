#!/usr/bin/env bash
# SessionStart hook — fires when Claude Code starts a session.
# stdout is added to Claude's context, so we stay terse: pointers and
# counts, not content. Claude reads the actual files only if relevant.
# The goal is a cold-start orientation under ~20 lines.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

echo "## Session continuity"
echo ""

# 1. Roadmap "Now" section — the only forward signal worth eager loading.
if [ -f docs/roadmap.md ]; then
  NOW_BLOCK="$(awk '/^## Now/{flag=1; next} /^## /{flag=0} flag' docs/roadmap.md \
    | sed '/^$/d' \
    | head -n 5 || true)"
  if [ -n "${NOW_BLOCK}" ] && [ "${NOW_BLOCK}" != "_(nothing in flight yet)_" ]; then
    echo "**Roadmap — Now:**"
    echo "${NOW_BLOCK}"
    echo ""
  fi
fi

# 2. Architectural commitments on file.
ADR_COUNT="$(find docs/adr -maxdepth 1 -name '[0-9]*.md' 2>/dev/null | wc -l | tr -d ' ')"
LATEST_ADR="$(find docs/adr -maxdepth 1 -name '[0-9]*.md' 2>/dev/null | sort | tail -n 1 || true)"
if [ "${ADR_COUNT}" -gt 0 ]; then
  echo "**ADRs on file:** ${ADR_COUNT}. Latest: \`${LATEST_ADR}\`."
else
  echo "**ADRs on file:** 0 (green field)."
fi

# 3. Most recent EOD — narrative pickup point.
LATEST_EOD="$(find docs/session-logs -maxdepth 1 -name '*-eod.md' 2>/dev/null | sort | tail -n 1 || true)"
if [ -n "${LATEST_EOD}" ]; then
  echo "**Last EOD:** \`${LATEST_EOD}\`. Read it if you are starting fresh; skip if you are clearly continuing the previous session."
fi

echo ""
echo "**Self-orientation primitives:**"
echo "- \`/recall <module|topic>\` — run *before* changing a module you have not touched this session."
echo "- \`/audit\` — run when you suspect code and docs/ have drifted."
