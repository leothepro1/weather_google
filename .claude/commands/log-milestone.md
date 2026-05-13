---
description: "Write a feature log to docs/features/ for a completed milestone"
---

You just completed a meaningful chunk of work. Write a feature log file.

## Pre-flight check (refuse silently if any is true)

Run through the Boris filter before doing anything else. Do **not** create a
file if the work was any of:

- Styling, CSS, padding, colors, typography, icon swaps
- Dependency bumps, lint/prettier/tsconfig changes
- Pure refactor (rename, file move, format-only — no behaviour change)
- Test-only change with no new production logic
- Comment/typo/dead-code cleanup
- Half-done exploration that did not land

If any of those, tell the user "this doesn't meet the logging bar — skipping"
and stop. Do not create an empty or apologetic log file.

## Steps

1. Derive a kebab-case slug from the feature name (max ~4 words).
2. Identify the primary module — one of the top-level directories under
   `apps/` or `packages/`. If the work spans multiple, pick the one most
   affected.
3. Determine status: `shipped` (merged/deployable), `in-progress` (work
   continues tomorrow), or `blocked` (waiting on external input).
4. Create `docs/features/$(date -u +%Y-%m-%d)-<slug>.md` with this exact
   frontmatter shape — do not add fields the dashboard doesn't know about:

```yaml
---
date: YYYY-MM-DD
type: feature
module: <module-name>
status: shipped | in-progress | blocked
links: []     # ADR paths, e.g. adr/0003-payment-gateway.md
---
```

5. Body has exactly three sections, in this order, with these headings:

   - `## What` — one paragraph, present tense. What now exists in the system
     that didn't before. Name modules, contracts, endpoints — concrete nouns.
   - `## Why` — one paragraph. The constraint or goal that drove this. If a
     decision was made between alternatives, link the ADR here; if you didn't
     write one yet, write the ADR first via `/adr`.
   - `## How next` — bullet list. What this unblocks, or what still has to
     ship before the feature is complete.

6. Do **not** include: file lists, line counts, commit hashes, diffs,
   step-by-step explanations of how you implemented it. Git already shows
   that. The log is for reasoning, not record-keeping.

## Length

150–400 words. If you find yourself writing more, you are explaining code
instead of explaining decisions — cut it back.

## Quality bar

Would Boris Cherny read this six months from now and immediately understand
what shipped and why? If no, rewrite.
