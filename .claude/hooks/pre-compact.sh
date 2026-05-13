#!/usr/bin/env bash
# PreCompact hook — fires immediately before the context window is compacted.
# After compaction, history is summarised lossily and detail is lost. We
# snapshot just enough state that a future session (or Claude post-compact)
# can reconstruct where work was.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

NOW_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
SAFE_TS="${NOW_ISO//:/-}"
SNAP_DIR="docs/session-logs/snapshots"
mkdir -p "$SNAP_DIR"
SNAP_FILE="${SNAP_DIR}/${SAFE_TS}.md"

DIRTY="$(git status --porcelain 2>/dev/null || true)"
RECENT="$(git log --since='6 hours ago' --pretty=format:'%h %s' 2>/dev/null || true)"
BRANCH="$(git branch --show-current 2>/dev/null || echo unknown)"

cat > "$SNAP_FILE" <<SNAP
---
type: snapshot
captured_at: ${NOW_ISO}
reason: pre-compact
branch: ${BRANCH}
---

# Pre-compact snapshot

Context window approaching limit. State captured before lossy summarisation.

## Working tree
\`\`\`
${DIRTY:-(clean)}
\`\`\`

## Recent commits (last 6h)
\`\`\`
${RECENT:-(none)}
\`\`\`
SNAP

exit 0
