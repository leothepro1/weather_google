---
number: 0012
date: 2026-05-13
status: accepted
supersedes: null
migrated_from: DECISIONS.md#12
---

## Context

Phase 1's real Google Ads client (ADR-0009, ADR-0011) requires OAuth.
Two storage questions: (1) where to keep the OAuth `state` token between
`/start` and `/callback`, and (2) where to keep the refresh token that
the operator obtains after one-time login.

## Decision

Both live in the D1 `config` table.

**State.** Rather than HMAC-sign state (which would add an
`OAUTH_STATE_SECRET` env var), we write a random 32-byte token to
`config` under `oauth_state:<token>` with the issue timestamp.
`/callback` deletes the row on read and rejects it if older than 10
minutes. Trivial volume — one INSERT/DELETE per OAuth start.

**Refresh token.** Single-user tool, one advertiser, so one refresh
token lives under `config.google_refresh_token`. The operator goes
through OAuth once via `/auth/google/start`; subsequent calls exchange
the stored refresh token for an access token as needed, cached per
Worker isolate with a 60-second skew (cold isolates refresh, acceptable).

## Alternatives considered

- **HMAC-signed state** — standard pattern, but requires a new env var
  (`OAUTH_STATE_SECRET`) and an HMAC implementation in the Worker
  runtime. The "store the token, delete on read" approach is operationally
  simpler at this volume.
- **Refresh token in Workers KV** — extra binding to maintain; D1 is
  already wired and the read pattern (one read per token refresh) fits
  D1 fine.
- **Refresh token in an env var** — cannot be rotated without redeploy,
  and would mean the operator's OAuth flow has to write to the
  deployment env, not the runtime data store.

## Consequences

- We accept a per-isolate access-token cache that may refresh slightly
  more often than strictly necessary (cold isolates). At single-user
  volume this is negligible.
- If we ever need multi-user OAuth, `config.google_refresh_token`
  becomes a per-user table — the schema has to grow.
- State rows accumulate if `/callback` is never reached; the 10-minute
  expiry check on read prevents replay but does not purge rows. A
  periodic cleanup is a tidy-to-do, not load-bearing.
