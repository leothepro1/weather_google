---
description: "Record an Architecture Decision Record in docs/adr/"
---

A decision was made between alternatives. Capture it as an ADR before the
reasoning evaporates.

## When to run this command

### Run it if any of these is true

- A library, framework, or service was chosen over named alternatives
- A tradeoff was settled (latency vs. complexity, consistency vs.
  availability, build-time vs. runtime, monolith vs. split, etc.)
- A data model, schema shape, or wire format was committed to
- A pattern was adopted that other modules are now expected to follow
- An obvious thing was deliberately **not** done, and the reason matters
  later
- An earlier ADR is being superseded — reversals always get a new ADR

### Do not run it for

- Styling preferences, naming conventions enforced by lint
- "We'll do X for now" placeholders that aren't real commitments
- One-line library swaps where no alternative was meaningfully considered
- Decisions about test framework, formatter, or other dev-experience tools
  that don't constrain production behaviour
- Reaffirming a decision already documented in an existing ADR

### Resolve these without asking

| Situation | Verdict |
|---|---|
| Picked Stripe over Adyen after comparing fees and DX | YES |
| Picked Stripe because it was the only option considered | NO — not a decision, just a choice |
| Switched from REST to gRPC for internal service comms | YES — pattern other modules will follow |
| Used `fetch` instead of `axios` in one new file | NO — local taste, no commitment |
| Decided checkout will be eventually consistent with inventory | YES — architectural tradeoff |
| Decided to defer i18n until v2 | YES — explicit non-decision with consequences |
| Decided to use `zod` for runtime validation across the API | YES — cross-cutting pattern |
| Decided to put shared types in `packages/shared` | YES if it's the first such decision; NO if it's the third file you've put there |
| Reverted ADR-0007's "use Redis" in favour of Postgres LISTEN/NOTIFY | YES — new ADR, supersedes 0007 |
| Picked Tailwind over CSS Modules | NO — dev-experience tool, no production constraint |

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

## The pre-save check

Before saving, read the draft and answer:

> **If this ADR didn't exist, would a future engineer be likely to undo this
> decision by accident, or re-litigate it from scratch?**

If "no" to both — the decision wasn't load-bearing. Don't save. An ADR that
no one would ever consult is worse than no ADR, because it dilutes the
signal of the ones that matter.

## Quality bar

Three tests, all must pass:

1. **Alternatives are named.** Not "we considered other options" — name them.
   Even rejected ones future-Claude has never heard of.
2. **Consequences are honest.** What did we now commit to *maintaining*?
   What did we make harder for our future selves? If "Consequences" only
   lists upsides, you haven't thought about it enough.
3. **Reversible by future ADR, not by silent code change.** This entry
   should be the kind of decision someone *would* write a new ADR to
   reverse, not something a refactor could undo without anyone noticing.
