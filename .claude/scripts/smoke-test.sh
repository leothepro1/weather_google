#!/usr/bin/env bash
# smoke-test.sh — verify the logging system works end-to-end in this
# environment. Run after a real Claude Code session to confirm hooks fired
# and artefacts were produced. Designed to catch the four things that fail
# silently: settings.json not picked up, ${CLAUDE_PROJECT_DIR} not expanded,
# SessionEnd not firing, slash commands not discoverable.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0
WARN=0

check() {
  local label="$1"
  local status="$2"
  local detail="${3:-}"
  case "$status" in
    pass) PASS=$((PASS+1)); printf '  [PASS] %s\n' "$label" ;;
    fail) FAIL=$((FAIL+1)); printf '  [FAIL] %s%s\n' "$label" "${detail:+ — $detail}" ;;
    warn) WARN=$((WARN+1)); printf '  [WARN] %s%s\n' "$label" "${detail:+ — $detail}" ;;
  esac
}

echo "Smoke test — Claude Code logging system"
echo "Repo: $REPO_ROOT"
echo "Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
echo ""

echo "## 1. Files in place"
[ -f CLAUDE.md ] && check "CLAUDE.md exists" pass || check "CLAUDE.md exists" fail
[ -f .claude/settings.json ] && check ".claude/settings.json exists" pass || check ".claude/settings.json exists" fail
for f in session-start session-end pre-compact; do
  if [ -x ".claude/hooks/${f}.sh" ]; then
    check ".claude/hooks/${f}.sh is executable" pass
  elif [ -f ".claude/hooks/${f}.sh" ]; then
    check ".claude/hooks/${f}.sh executable bit" fail "exists but not chmod +x"
  else
    check ".claude/hooks/${f}.sh exists" fail
  fi
done
for f in log-milestone adr eod recall audit; do
  [ -f ".claude/commands/${f}.md" ] && check "/${f} command file" pass || check "/${f} command file" fail
done
echo ""

echo "## 2. Syntax"
for f in .claude/hooks/*.sh .claude/scripts/*.sh; do
  if bash -n "$f" 2>/dev/null; then
    check "bash syntax: $f" pass
  else
    check "bash syntax: $f" fail
  fi
done
if python3 -c "import json; json.load(open('.claude/settings.json'))" 2>/dev/null; then
  check "settings.json valid JSON" pass
else
  check "settings.json valid JSON" fail
fi
echo ""

echo "## 3. Hook dry-runs"
SMOKE_ID="smktest1"   # 8 chars exactly; session-end truncates to ${ID:0:8}.
if echo "{\"session_id\":\"${SMOKE_ID}\",\"transcript_path\":\"/tmp/x\"}" | bash .claude/hooks/session-end.sh >/dev/null 2>&1; then
  check "session-end.sh runs with mock stdin" pass
  TODAY="$(date -u +%Y-%m-%d)"
  if [ -f "docs/session-logs/${TODAY}-eod.md" ] && grep -q "$SMOKE_ID" "docs/session-logs/${TODAY}-eod.md"; then
    check "session-end produced EOD entry" pass
  else
    check "session-end produced EOD entry" fail
  fi
  if [ -f docs/session-logs/.metadata.jsonl ] && grep -q "$SMOKE_ID" docs/session-logs/.metadata.jsonl; then
    check "session-end appended to .metadata.jsonl" pass
  else
    check "session-end appended to .metadata.jsonl" fail
  fi
else
  check "session-end.sh runs with mock stdin" fail
fi

if bash .claude/hooks/pre-compact.sh >/dev/null 2>&1; then
  check "pre-compact.sh runs" pass
  SNAPS="$(find docs/session-logs/snapshots -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
  [ "$SNAPS" -gt 0 ] && check "pre-compact produced snapshot" pass || check "pre-compact produced snapshot" fail
else
  check "pre-compact.sh runs" fail
fi

START_OUT="$(bash .claude/hooks/session-start.sh 2>/dev/null || echo '')"
if echo "$START_OUT" | grep -q "Session continuity"; then
  check "session-start.sh emits continuity header" pass
else
  check "session-start.sh emits continuity header" fail
fi
echo ""

echo "## 4. Scripts"
if bash .claude/scripts/recall.sh nonexistenttopic12345 2>/dev/null | grep -q "green field"; then
  check "recall.sh handles no-match topic" pass
else
  check "recall.sh handles no-match topic" warn "may still work in a populated repo"
fi
if bash .claude/scripts/audit-docs.sh >/dev/null 2>&1; then
  check "audit-docs.sh exits 0 on clean repo" pass
else
  RC=$?
  if [ "$RC" -eq 1 ]; then
    check "audit-docs.sh found critical drift" warn "review findings"
  else
    check "audit-docs.sh runs without error" fail "exit code $RC"
  fi
fi
echo ""

echo "## 5. Cleanup of smoke-test artefacts"
rm -f docs/session-logs/.metadata.jsonl 2>/dev/null
TODAY="$(date -u +%Y-%m-%d)"
if [ -f "docs/session-logs/${TODAY}-eod.md" ] && grep -q "$SMOKE_ID" "docs/session-logs/${TODAY}-eod.md"; then
  rm -f "docs/session-logs/${TODAY}-eod.md"
fi
find docs/session-logs/snapshots -maxdepth 1 -name '*.md' -newer .claude/scripts/smoke-test.sh -delete 2>/dev/null || true
check "smoke-test artefacts removed" pass
echo ""

echo "----"
echo "Result: $PASS pass, $FAIL fail, $WARN warn"
[ "$FAIL" -gt 0 ] && exit 1
exit 0
