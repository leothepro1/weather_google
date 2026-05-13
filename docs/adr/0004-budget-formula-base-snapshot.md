---
number: 0004
date: 2026-05-13
status: accepted
supersedes: null
migrated_from: DECISIONS.md#4
---

## Context

When a campaign is linked to a bucket system, the daily cron computes a
new budget based on the matched bucket's modifier. The question is what
"base" the modifier is applied to: the campaign's *current* Google Ads
budget, or a *snapshotted* value taken at link time.

If we apply the modifier to the previous day's adjusted budget, the math
compounds — a +10% bucket firing for 30 days raises the budget by 17x,
not 10%. That is a footgun.

## Decision

`new = base × (1 + modifier)`, where `base` is the campaign's daily
budget snapshotted at the moment it was linked to the bucket system, and
stored as `base_budget_micros`.

Every adjustment is computed from that base, never from the
previously-adjusted budget. This prevents modifier drift (compounding)
across cron runs and keeps the math trivial to audit in
`adjustment_log`.

## Alternatives considered

- **Apply modifier to current Google Ads budget** — compounding drift,
  diverges from operator's mental model of "the bucket sets the budget
  for this weather".
- **Periodic re-snapshot on a schedule** — adds a "when does base reset?"
  question with no obvious answer.
- **Operator-defined base per bucket** — more flexible, but moves a
  conceptual cost onto the operator for no measurable benefit.

## Consequences

- The operator must explicitly re-link a campaign to refresh `base` —
  e.g. after a seasonal baseline change. This is documented behaviour,
  not a hidden quirk.
- `adjustment_log` shows `base × (1 + modifier) = new` per row, so any
  audit reduces to arithmetic, not state archaeology.
- If a campaign's *real* baseline drifts over time (e.g. seasonal
  promotions adjust the campaign budget directly), our `base` becomes
  stale. Re-link is the documented recovery — we do not silently re-base.
