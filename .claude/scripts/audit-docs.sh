#!/usr/bin/env bash
# audit-docs.sh — deterministic drift detector for docs/.
# Reports orphaned ADRs, broken supersede chains, ADRs without follow-through,
# roadmap drift, and EOD coverage gaps. Read-only. Never auto-fixes.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

CRITICAL=()
WARNING=()
CLEAN=()

today_iso() { date -u +%Y-%m-%d; }
days_ago() {
  # POSIX-portable: $1 = number of days
  if date -u -d "$1 days ago" +%Y-%m-%d 2>/dev/null; then return; fi
  date -u -v "-${1}d" +%Y-%m-%d 2>/dev/null || echo ""
}

# -------- Check 1: orphaned ADRs (decision documented, no code evidence) ----
orphan_count=0
adr_total=0
for adr in $(find docs/adr -maxdepth 1 -name '[0-9]*.md' 2>/dev/null | sort); do
  adr_total=$((adr_total + 1))
  # Pull distinctive nouns from the Decision section: backticked tokens.
  nouns="$(awk '/^## Decision/{flag=1;next} /^## /{flag=0} flag' "$adr" \
    | grep -oE '`[^`]+`' | tr -d '`' | sort -u || true)"
  found_evidence=0
  if [ -n "$nouns" ]; then
    while IFS= read -r noun; do
      [ -z "$noun" ] && continue
      # Skip nouns that look like ADR-internal refs.
      case "$noun" in adr/*|docs/*) continue ;; esac
      if grep -rqI --include='*.ts' --include='*.tsx' --include='*.js' \
           --include='*.json' --include='*.sql' --include='*.toml' \
           --include='*.yaml' --include='*.yml' \
           --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git \
           -F "$noun" . 2>/dev/null; then
        found_evidence=1
        break
      fi
    done <<< "$nouns"
  fi
  if [ "$found_evidence" -eq 0 ] && [ -n "$nouns" ]; then
    CRITICAL+=("Orphaned ADR: \`$adr\` — Decision references symbols not present in code.")
    orphan_count=$((orphan_count + 1))
  fi
done
if [ "$adr_total" -gt 0 ] && [ "$orphan_count" -eq 0 ]; then
  CLEAN+=("orphaned ADRs: 0 of $adr_total")
fi

# -------- Check 2: broken supersede chain ----------------------------------
chain_break=0
for adr in $(find docs/adr -maxdepth 1 -name '[0-9]*.md' 2>/dev/null); do
  supersedes="$(awk -F': ' '/^supersedes:/ {print $2; exit}' "$adr" | tr -d '"' | tr -d ' ' || true)"
  if [ -n "$supersedes" ] && [ "$supersedes" != "null" ]; then
    target="$(find docs/adr -maxdepth 1 -name "${supersedes}-*.md" 2>/dev/null | head -n 1 || true)"
    if [ -z "$target" ]; then
      CRITICAL+=("Supersede chain broken: \`$adr\` claims to supersede ADR ${supersedes}, which does not exist.")
      chain_break=$((chain_break + 1))
    else
      status="$(awk -F': ' '/^status:/ {print $2; exit}' "$target" | tr -d ' ' || true)"
      if [ "$status" != "superseded" ]; then
        CRITICAL+=("Supersede chain broken: \`$target\` should have status: superseded but has status: $status.")
        chain_break=$((chain_break + 1))
      fi
    fi
  fi
done
if [ "$adr_total" -gt 0 ] && [ "$chain_break" -eq 0 ]; then
  CLEAN+=("supersede chains: intact")
fi

# -------- Check 3: ADRs >30d old without a feature linking back ------------
stale_adr=0
cutoff="$(days_ago 30)"
if [ -n "$cutoff" ]; then
  for adr in $(find docs/adr -maxdepth 1 -name '[0-9]*.md' 2>/dev/null); do
    status="$(awk -F': ' '/^status:/ {print $2; exit}' "$adr" | tr -d ' ' || true)"
    [ "$status" = "superseded" ] && continue
    adr_date="$(awk -F': ' '/^date:/ {print $2; exit}' "$adr" | tr -d ' ' || true)"
    if [ -n "$adr_date" ] && [ "$adr_date" \< "$cutoff" ]; then
      adr_basename="$(basename "$adr")"
      if ! grep -rlqF "$adr_basename" docs/features/ 2>/dev/null; then
        WARNING+=("ADR without follow-through: \`$adr\` accepted before $cutoff, no feature log references it.")
        stale_adr=$((stale_adr + 1))
      fi
    fi
  done
  if [ "$stale_adr" -eq 0 ] && [ "$adr_total" -gt 0 ]; then
    CLEAN+=("ADRs with follow-through: all current ADRs >30d have linked features")
  fi
fi

# -------- Check 4: roadmap Shipped without feature log ---------------------
if [ -f docs/roadmap.md ]; then
  shipped_block="$(awk '/^## Shipped/{flag=1;next} /^## /{flag=0} flag' docs/roadmap.md | grep -E '^- ' || true)"
  if [ -n "$shipped_block" ]; then
    missing=0
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      # Extract first meaningful token from the bullet.
      key="$(echo "$line" | sed -E 's/^- //; s/[][().,].*//' | awk '{print $1}' | tr '[:upper:]' '[:lower:]')"
      [ -z "$key" ] && continue
      if ! grep -rliqF "$key" docs/features/ 2>/dev/null; then
        WARNING+=("Roadmap drift: \`Shipped\` item '$line' has no matching feature log.")
        missing=$((missing + 1))
      fi
    done <<< "$shipped_block"
    if [ "$missing" -eq 0 ]; then
      CLEAN+=("roadmap Shipped: all items have matching feature logs")
    fi
  fi
fi

# -------- Check 5: EOD coverage for weekdays with commits ------------------
missing_eod=0
for d in $(seq 1 14); do
  day="$(days_ago "$d")"
  [ -z "$day" ] && continue
  dow="$(date -u -d "$day" +%u 2>/dev/null || date -u -j -f %Y-%m-%d "$day" +%u 2>/dev/null || echo 0)"
  [ "$dow" -ge 6 ] && continue   # skip weekends
  commits_that_day="$(git log --since="$day 00:00" --until="$day 23:59" --oneline 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$commits_that_day" -gt 0 ]; then
    if [ ! -f "docs/session-logs/${day}-eod.md" ]; then
      WARNING+=("EOD missing for $day (${commits_that_day} commit(s) that day, no EOD log).")
      missing_eod=$((missing_eod + 1))
    fi
  fi
done
[ "$missing_eod" -eq 0 ] && CLEAN+=("EOD coverage: complete for last 14 weekdays with commits")

# -------- Report ----------------------------------------------------------
echo "# docs/ audit — $(today_iso)"
echo ""
if [ "${#CRITICAL[@]}" -gt 0 ]; then
  echo "## Critical (active drift)"
  for item in "${CRITICAL[@]}"; do echo "- $item"; done
  echo ""
fi
if [ "${#WARNING[@]}" -gt 0 ]; then
  echo "## Warning (worth investigating)"
  for item in "${WARNING[@]}"; do echo "- $item"; done
  echo ""
fi
if [ "${#CRITICAL[@]}" -eq 0 ] && [ "${#WARNING[@]}" -eq 0 ]; then
  echo "**No drift detected across $adr_total ADR(s) and $(find docs/features -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ') feature log(s).**"
  echo ""
fi
if [ "${#CLEAN[@]}" -gt 0 ]; then
  echo "## Clean"
  for item in "${CLEAN[@]}"; do echo "- $item"; done
fi

# Exit non-zero if critical findings, so CI can gate on it.
[ "${#CRITICAL[@]}" -gt 0 ] && exit 1
exit 0
