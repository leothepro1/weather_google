---
description: "Audit docs/ for drift, orphans, and incoherence between artefacts"
---

You are auditing the project's own documentation for self-consistency.
Goal: find places where code and `docs/` have drifted, or where the
artefacts contradict each other. This is read-only diagnostics — you do
not fix anything in this command.

## Checks (run in order, report in order of severity)

### 1. Orphaned ADRs

For each `docs/adr/NNNN-*.md`:
- Extract distinctive nouns from the `## Decision` section — filenames,
  env vars, module names, library names, symbols.
- Grep the codebase (excluding `docs/`, `node_modules`, build output) for
  at least one of those nouns.
- **Flag if zero matches.** Either the code drifted away from the ADR or
  the ADR is stale and should be superseded.

### 2. Decisions made without ADRs

For each `docs/features/*.md` whose body indicates a non-trivial choice
(words like "chose", "instead of", "preferred", "switched from"):
- Confirm `links:` in frontmatter references at least one ADR.
- **Flag if missing.** A feature shipped a decision without recording it.

### 3. ADRs without follow-through

For each ADR with `status: accepted` and a `date` more than 30 days old:
- Confirm at least one `docs/features/*.md` links to it.
- **Flag if none.** Either the ADR never got built, or the feature log
  was skipped.

### 4. Superseded chain integrity

For each ADR with `supersedes: NNNN` in frontmatter:
- Confirm the superseded ADR's frontmatter has `status: superseded` and
  `superseded_by: <this ADR's number>`.
- **Flag mismatches.** Fix them in a follow-up, do not auto-fix here.

### 5. Roadmap drift

In `docs/roadmap.md`:
- For each `## Shipped` item: confirm a feature log exists with
  `status: shipped` whose name or body references the item.
- For each `## Now` item: check the last 7 days of EOD logs for at least
  one mention. **Flag stagnant `## Now` items** — they may have silently
  stalled.

### 6. EOD coverage

For each weekday in the last 14 days where commits exist in `git log`:
- Confirm `docs/session-logs/YYYY-MM-DD-eod.md` exists.
- **Flag missing days.** Either the SessionEnd hook failed or commits
  happened outside a Claude Code session (which is fine, but worth
  knowing).

## Output

Single markdown report, printed to chat (do not write to disk). Format:

```
# docs/ audit — <today's date>

## Critical (active drift)
- <finding> — `<path>` — <one-line implication>

## Warning (worth investigating)
- <finding> — `<path>`

## Clean
- check 1: <count> items, all coherent
- check 2: ...

## Recommended follow-up
- <concrete next action, if any>
```

If everything is clean, say so plainly: "No drift detected across N
artefacts." Do not invent findings to justify running the command.

## What this command will NOT do

- Will not auto-fix anything. Audit identifies; a human or a follow-up
  Claude session decides what to fix.
- Will not delete superseded ADRs. Superseded ≠ deleted. History is the
  artefact.
- Will not create new ADRs or features just because old ones are missing
  — that would be writing fiction to make the audit pass.
- Will not run on a partial checkout or detached HEAD without warning.
