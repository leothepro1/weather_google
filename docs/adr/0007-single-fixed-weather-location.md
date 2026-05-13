---
number: 0007
date: 2026-05-13
status: accepted
supersedes: null
migrated_from: DECISIONS.md#7
---

## Context

Weather has to be pulled from somewhere to drive bucket matching. The
question is whether to model it per-campaign, per-audience, or globally.

## Decision

Weather is pulled for one configured lat/lon, not per-campaign or
per-audience.

This matches the mental model of a single operator watching one market.
Adding per-bucket locations later only requires a nullable column on
`buckets` and a fallback to the global location.

## Alternatives considered

- **Per-campaign location** — multiplies weather API calls by campaign
  count, and most operators run all campaigns for the same physical
  market. Premature.
- **Per-audience-geo lookup** — would mean parsing Google Ads location
  targets and reverse-geocoding them. Significant complexity for a
  hypothetical use case.
- **Per-bucket location override** — fine extension, but no real user
  has asked for it yet. We design the schema to allow this without
  blocking on it.

## Consequences

- The system is single-market by default. Operators with multi-market
  setups need to either run multiple instances or wait for the per-bucket
  override to land.
- Weather API quota usage stays flat at one call per cron run, which
  fits any provider's free tier.
- If we add per-bucket location later, existing buckets work unchanged
  via the global fallback — no migration required.
