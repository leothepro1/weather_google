---
number: 0005
date: 2026-05-13
status: accepted
supersedes: null
migrated_from: DECISIONS.md#5
---

## Context

A campaign can be linked to several buckets. On a given cron run, more
than one bucket may match the current weather (e.g. "0–10°C" and "rain"
both match). We need a deterministic way to pick which modifier applies.

## Decision

One bucket wins per cron run per campaign, chosen by the highest
`priority`. Priority is user-controlled via drag-and-drop in the UI.

No blending, no averaging — predictable behaviour beats clever
behaviour, and "one rule fired" is easy to explain in the
`adjustment_log`.

## Alternatives considered

- **Average the modifiers of all matching buckets** — clever but
  unpredictable to the operator; "why is the budget 7%, not 10% or 5%?"
  becomes a customer-support question.
- **Sum / compose modifiers** — same legibility problem, plus
  compounding risk (see ADR-0004).
- **First-defined-wins** — implicit priority based on creation order,
  invisible to the operator. UI would have to show it anyway, so we may
  as well make it explicit and reorderable.

## Consequences

- The `adjustment_log` always identifies a single `winning_bucket_id`
  per row — auditable in one query.
- The operator has to think about priority order, which is one more
  concept to learn. We judge that worth the cost in exchange for
  legibility.
- If the operator wants "average behaviour", they have to create a
  single bucket that expresses it explicitly. The system will not do
  it for them.
