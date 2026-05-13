---
number: 0006
date: 2026-05-13
status: accepted
supersedes: null
migrated_from: DECISIONS.md#6
---

## Context

The system has to fire the budget-adjustment job on some schedule. The
question is how often.

## Decision

The scheduler fires once every 24 hours.

Google Ads budget churn is undesirable — frequent flapping can trip
campaign optimisation. Weather doesn't change materially within a 24-hour
window for the kind of budget decisions being modelled. Tighter
frequencies are trivial to add later by changing one line in
`wrangler.toml`.

## Alternatives considered

- **Every 6 hours** — Google Ads sometimes treats multiple daily budget
  changes as anomalies for learning algorithms; not worth the risk for
  marginal responsiveness to weather.
- **Every hour** — even less defensible; weather forecasts that far in
  advance are noise relative to the 24h budget granularity Google Ads
  uses.
- **On weather threshold crossings (event-driven)** — more complex
  triggering, requires polling weather independently of cron, and is hard
  to reason about for the operator ("when will it next fire?").

## Consequences

- The system cannot react to a same-day weather change. If a storm rolls
  in at noon, the budget update lands tomorrow.
- The cron line in `wrangler.toml` is the single source of truth — any
  future change is one diff away, no infrastructure changes required.
- Adjustment log granularity is one row per campaign per day; analysis
  stays simple.
