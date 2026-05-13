---
description: "Record an Architecture Decision Record in docs/adr/"
---

## Run this when

A library, framework, or service was chosen over **named** alternatives; a
tradeoff was settled; a data model or wire format was committed to; a
pattern was adopted that other modules will follow; an obvious thing was
deliberately not done.

**Do not run it for:** lint/formatter/test-framework choices that don't
constrain production behaviour; "we'll do X for now" placeholders;
one-line library swaps where no alternative was meaningfully considered;
reaffirming an existing ADR.

**Resolve these without asking:**

| Situation | Verdict |
|---|---|
| Picked Stripe over Adyen after comparing fees and DX | YES |
| Picked Stripe because nothing else was considered | NO — not a decision |
| Switched internal RPC from REST to gRPC | YES — pattern others follow |
| Used `fetch` over `axios` in one new file | NO — local taste |
| Checkout becomes eventually consistent with inventory | YES |
| Deferred i18n until v2 | YES — explicit non-decision with consequences |
| Adopted `zod` for runtime validation across the API | YES — cross-cutting |
| Putting first shared types in `packages/shared` | YES (the first time) |
| Adding the third file to `packages/shared` | NO — pattern already exists |
| Reversed ADR-0007 in favour of Postgres LISTEN/NOTIFY | YES — supersedes 0007 |
| Picked Tailwind over CSS Modules | NO — dev-experience tool |

## Steps

1. Next ADR number = (count of `docs/adr/[0-9]*.md`) + 1, zero-padded to 4.
2. Slug describes the **decision area**, not the conclusion:
   `payment-gateway`, not `we-picked-stripe`.
3. Create `docs/adr/<NNNN>-<slug>.md` with this exact frontmatter:

   ```yaml
   ---
   number: NNNN
   date: YYYY-MM-DD
   status: accepted
   supersedes: null   # or "NNNN" if this replaces an earlier ADR
   ---
   ```

4. Body — exactly these four sections, no others:
   - `## Context` — what forced the decision. Constraints, what's at stake.
   - `## Decision` — the choice in one sentence at the top, then
     justification. Active voice, present tense.
   - `## Alternatives considered` — bullets. Each names an alternative and
     gives a one-line rejection reason. Even "obvious" rejections.
   - `## Consequences` — what becomes easier, what becomes harder, what we
     now have to maintain. If this section only lists upsides you haven't
     thought hard enough.

5. Append to `docs/adr/README.md`:
   `- [NNNN — <Title>](./NNNN-<slug>.md) — <one-line summary>`

6. If superseding: edit the older ADR's frontmatter to `status: superseded`
   and `superseded_by: NNNN`. Do not delete the old file.

## Pre-save check

If this ADR didn't exist, would a future engineer be likely to undo this
decision by accident, or re-litigate it from scratch? If neither — the
decision wasn't load-bearing. Don't save. An ADR no one would consult is
worse than no ADR; it dilutes the signal of the ones that matter.

## Constraints

- 200–500 words. Longer usually means two decisions got merged — split them.
- Alternatives must be **named**, not "we considered other options".
- The decision should be reversible only by a new ADR, not by silent code
  change.
