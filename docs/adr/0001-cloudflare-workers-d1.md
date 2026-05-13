---
number: 0001
date: 2026-05-13
status: accepted
supersedes: null
migrated_from: DECISIONS.md#1
---

## Context

We need to deploy an API and persist state for a single-user
weather-driven budget tool. Constraints: small expected volume, a daily
scheduled job to drive budget adjustments, simple operational story (one
operator, no on-call), and a preference to keep ongoing cost near zero.

## Decision

We run the API as a Cloudflare Worker and persist state in D1.

The free tier covers expected volume. There are no cold starts. Scheduled
triggers (cron) are built in — so the daily budget-adjustment job does not
need a separate scheduler. D1's SQLite dialect is comfortable for the kind
of small relational data we are dealing with and works locally via
Wrangler.

## Alternatives considered

- **Vercel** — Lambda-based, cold starts are visible on free tier, and
  Vercel Cron couples scheduling to deploys. More moving parts than needed
  for single-user volume.
- **Render** — clean container model, but no built-in cron; we would need
  a long-running worker process just to fire the daily job, which fights
  the "near-zero ongoing cost" goal.

## Consequences

- We are locked to the Cloudflare ecosystem (Workers, D1, Wrangler, KV).
  Migrating away requires rewriting the persistence layer.
- SQLite dialect is fine for relational data but limited for analytical
  queries — we will need to lift to another store if that ever becomes a
  real requirement.
- D1 is still maturing; patch releases may surface breaking changes that
  we have to track.
- Local dev via Wrangler adds one more tool to the developer onboarding,
  but it is the only credible way to test Worker behaviour locally.
