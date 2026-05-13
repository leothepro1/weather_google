---
number: 0009
date: 2026-05-13
status: accepted
supersedes: null
migrated_from: DECISIONS.md#9
---

## Context

The full Google Ads integration requires an OAuth dance, a working
developer token, and live campaigns we don't want to mutate during
development. We need to ship the UI, cron pipeline, and bucket logic
without that being a hard dependency on day one.

## Decision

Every route and service speaks to a `GoogleAdsClient` interface. Phase 0
ships `MockGoogleAdsClient` that returns three fake campaigns and logs
budget updates to the console. Phase 1 adds the real implementation
behind the same interface, gated by `USE_MOCK_GOOGLE_ADS` (`"true"` keeps
the mock; anything else routes to the real client).

## Alternatives considered

- **Implement real client from the start** — blocks the whole UI and
  cron work on OAuth + developer-token approval. Days of latency for
  zero learning value.
- **Stub at the HTTP layer** (intercept `fetch` to `googleads.googleapis.com`)
  — pretends the real client exists when it doesn't. Brittle, gives
  worse error messages, and makes "swap to real" a riskier flip.
- **Feature flag in the API routes** (`if (mock) ...`) — leaks the
  mock-vs-real concern into every caller. Defeats the seam.

## Consequences

- We get a clean seam for tests forever, not just for Phase 0 — the
  interface is the contract.
- The `USE_MOCK_GOOGLE_ADS` env var is a deploy-time toggle; we have to
  remember it exists when configuring environments.
- Phase 1's real implementation must match the mock's surface exactly,
  or every call site needs to be revisited. Worth the upfront discipline.
