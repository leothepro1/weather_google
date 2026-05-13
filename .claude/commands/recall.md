---
description: "Surface what docs/ already knows about a module or topic, before you change it"
---

You are about to touch something. Before you do, find out what you (or a
past Claude session) already decided about it. Drift between sessions is
the #1 failure mode of long-running agentic work in this codebase. This
command is how you prevent it.

## Argument

A single word or short phrase. Examples:

- A module name: `checkout`, `inventory`, `pricing`
- A concept: `idempotency`, `auth`, `webhooks`
- An integration: `stripe`, `sendgrid`, `cloudflare`
- An env var, file path, or symbol name: `DATABASE_URL`, `apps/api/src/oauth`

If the user did not pass an argument, infer one from the most recent
context (the file they asked you to change, the module they named) and
state your inference at the top of your response.

## Steps

1. Search the docs tree for the term, case-insensitive, whole-word where
   sensible:
   - `docs/adr/*.md`
   - `docs/features/*.md`
   - `docs/roadmap.md`
   - `docs/session-logs/*-eod.md` (limit to last 14 days)
2. **Read the matches, not just filenames.** A filename match without
   substance is not a hit.
3. Synthesise the findings into the output format below. Aim for ~150
   words total — this is a brief, not a transcript.
4. If nothing matches: say so plainly. "No prior context — you are working
   in green field for this topic." That is itself a finding worth
   surfacing; do not assume there was hidden context.

## Output format

```
## Recall: <topic>

### Decided
- ADR-NNNN — <one-line conclusion>. (link)
- (etc., most relevant first; cap at 5)

### Shipped
- features/<date>-<slug> — <one-line>. (link)
- (cap at 5; older entries are noise)

### In flight
- roadmap: <one-line item> — status

### Open / undecided
- <thing> — surfaced in <where>, no decision recorded
```

Omit sections with no entries. Do not pad with "_(none)_".

## When to run unprompted

Run this *without being asked* before:

- Modifying any file in a module you have not touched in this session
- Adding a new integration (external service, library, runtime)
- Touching any contract: env vars, public API, migrations, CLI flags
- Whenever the user asks "what do we know about X?"

## What this command will NOT do

- Will not write any file. Pure read + summarise.
- Will not make a decision on your behalf — it surfaces what was decided,
  not what to do next.
- Will not pull from sources outside `docs/`. README, code comments, and
  git history are not authoritative here. If `docs/` does not say it, it
  is not decided.
