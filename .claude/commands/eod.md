---
description: "Enrich today's end-of-day log with a narrative summary"
---

The `SessionEnd` hook writes a mechanical skeleton to
`docs/session-logs/$(date -u +%Y-%m-%d)-eod.md` every time a session closes.
This command turns that skeleton into something the team and future-Claude
can actually read.

Run this when the user signals end of day ("I'm done", "let's wrap up",
"tomorrow", or just before closing the session). You may also run it at the
start of a fresh session to enrich yesterday's still-skeleton log if the
previous session ended without `/eod`.

## Steps

1. Identify the target file: today's `docs/session-logs/YYYY-MM-DD-eod.md`,
   or the most recent one if today's doesn't exist yet.
2. Gather signal:
   - Read the file's current skeleton entries.
   - Run `git log --since="24 hours ago" --pretty=full` to see what got
     committed.
   - List `docs/features/$(date -u +%Y-%m-%d)-*.md` and
     `docs/adr/` files modified today.
3. For each session block with a `_Narrative pending_` marker, replace the
   marker with three sections — exactly these three, no more:

   - `### Highlights` — 2–4 bullets. Only signal. What shipped, what was
     decided, what got unblocked. Each bullet should link to its feature
     log or ADR if one exists.
   - `### Blockers / open threads` — anything left dangling, anything that
     needs a human decision before work continues. If nothing: omit the
     section entirely, don't write "none".
   - `### Tomorrow` — concrete next step. Not "continue work on X" — name
     the specific file, function, or decision that comes next.

4. Update the top-level frontmatter:
   - `status: shipped` if at least one feature shipped today; otherwise
     `in-progress`; `blocked` if the day ended on a hard blocker.
   - `sessions: [<list of session ids that appeared in the file>]`

5. Apply the Boris filter ruthlessly. If a session produced only styling,
   refactors, or lint fixes, write `### Highlights\n- _(no loggable
   activity)_` and move on. Do not invent significance.

## What this command does NOT do

- It does not commit. The user decides when to commit.
- It does not touch `docs/features/` or `docs/adr/` — those are separate
  artefacts written by `/log-milestone` and `/adr`.
- It does not append code blocks or diffs.

## Length

100–300 words per session block. If today had three sessions, the file may
be up to ~900 words. Beyond that you are explaining instead of summarising.
