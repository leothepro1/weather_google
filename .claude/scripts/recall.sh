#!/usr/bin/env bash
# recall.sh — mechanical search across docs/ for a topic.
# Reads-only. Returns a structured list of matches that Claude synthesises
# into a brief. The grep + sort is deterministic; the synthesis is the LLM's
# only job.
set -euo pipefail

TOPIC="${1:-}"
if [ -z "$TOPIC" ]; then
  echo "usage: recall.sh <topic>" >&2
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

# Search universe — by category, so we can label output.
ADR_HITS="$(grep -rli --include='*.md' -F "$TOPIC" docs/adr 2>/dev/null | sort || true)"
FEATURE_HITS="$(grep -rli --include='*.md' -F "$TOPIC" docs/features 2>/dev/null | sort -r || true)"
ROADMAP_HIT=""
if [ -f docs/roadmap.md ] && grep -qiF "$TOPIC" docs/roadmap.md; then
  ROADMAP_HIT="docs/roadmap.md"
fi

# Recent EODs only — last 14 days, by filename sort.
EOD_HITS=""
for f in $(find docs/session-logs -maxdepth 1 -name '*-eod.md' 2>/dev/null | sort -r | head -n 14); do
  if grep -qiF "$TOPIC" "$f"; then
    EOD_HITS="${EOD_HITS}${f}"$'\n'
  fi
done

# Output — labelled blocks, with a 2-line excerpt per hit.
emit_block() {
  local label="$1"
  shift
  local files="$*"
  [ -z "$files" ] && return
  echo "### $label"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    echo ""
    echo "**$f**"
    grep -niF "$TOPIC" "$f" | head -n 2 | sed 's/^/  /'
  done <<< "$files"
  echo ""
}

echo "## recall: $TOPIC"
echo ""

if [ -z "$ADR_HITS" ] && [ -z "$FEATURE_HITS" ] && [ -z "$ROADMAP_HIT" ] && [ -z "$EOD_HITS" ]; then
  echo "_No matches in docs/. This topic is green field — no prior decisions or feature work recorded._"
  exit 0
fi

emit_block "ADRs" "$ADR_HITS"
emit_block "Feature logs" "$FEATURE_HITS"
[ -n "$ROADMAP_HIT" ] && emit_block "Roadmap" "$ROADMAP_HIT"
emit_block "Recent EOD mentions (last 14 days)" "$(printf '%s' "$EOD_HITS")"
