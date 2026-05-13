---
description: "Record an Architecture Decision Record in docs/adr/"
---

A decision was made between alternatives. Capture it as an ADR before the
reasoning evaporates.

## When to run this command

Run `/adr` when any of these happened in the session:

- You chose between alternative libraries, frameworks, or services
- You settled a tradeoff (latency vs. complexity, consistency vs. availability,
  build-time vs. runtime, etc.)
- You picked a data model, schema shape, or wire format
- You committed to a pattern that other modules will be expected to follow
- You decided **not** to do something obvious, and the reason matters

Do **not** run it for: styling preferences, naming conventions handled by
lint, "we'll do X for now" placeholders that aren't real commitments.

## Steps

1. Find the next ADR number. Count files matching `docs/adr/[0-9]*.md`, add 1,
   zero-pad to 4 digits (`0001`, `0002`, …).
2. Derive a kebab-case slug describing the decision (not the conclusion):
   `payment-gateway`, not `we-picked-stripe`.
3. Create `docs/adr/<NNNN>-<slug>.md` with this exact frontmatter:

```yaml
---
number: NNNN
date: YYYY-MM-DD
status: accepted
supersedes: null     # or "NNNN" if this replaces an earlier ADR
---
```

4. Body has exactly four sections, in this order:

   - `## Context` — what forced the decision. The constraint, the requirement,
     what's at stake if we get it wrong. Set the scene.
   - `## Decision` — what we chose. One sentence at the top stating the choice
     plainly, then justification. Active voice. Present tense.
   - `## Alternatives considered` — bullet list. Each item names an alternative
     and gives a one-line rejection reason. Even "obvious" rejections must be
     written down — future-Claude won't see what wasn't picked otherwise.
   - `## Consequences` — what becomes easier, what becomes harder, what we've
     now committed to maintaining. Be honest about the downsides.

5. Append a line to `docs/adr/README.md` (the index):
   `- [NNNN — <Title>](./NNNN-<slug>.md) — <one-line summary>`

6. If this ADR supersedes an earlier one, edit the older file's frontmatter
   to `status: superseded` and add `superseded_by: NNNN`. Do not delete the
   old ADR — superseded reasoning is still valuable history.

## Length

200–500 words. ADRs that go longer usually mean two decisions got merged into
one — split them.

## Quality bar

A developer joining the team in 18 months should be able to reconstruct the
reasoning from this file alone, without asking anyone.
