---
number: 0008
date: 2026-05-13
status: accepted
supersedes: null
migrated_from: DECISIONS.md#8
---

## Context

Phase 0 is a single-operator tool. We need auth for the API and UI, but
do not yet have a real Google Ads OAuth flow (that lands in Phase 1, see
ADR-0009). We need the minimum correct pattern that does not require
rewriting call sites when real auth arrives.

## Decision

One `ADMIN_TOKEN` secret, checked by a Hono middleware on every route
except `/health`. The frontend stores it in `localStorage` after a login
form.

This is the minimum correct pattern — we can replace it with Google
OAuth when we add the real Google Ads client in Phase 1, without
rewriting call sites.

## Alternatives considered

- **No auth in Phase 0** — the API is reachable from the public
  internet; "internal tool, no auth" is not an acceptable posture even
  in a phase-0 prototype.
- **Cookie-based session from day one** — more correct, but adds
  CSRF protection, session storage, expiry logic — all dead weight in a
  single-operator tool. Defer to when there is a second operator.
- **Cloudflare Access in front of the Worker** — would work, but
  couples the auth story to Cloudflare-specific infra and complicates
  local dev.

## Consequences

- Bearer in `localStorage` is vulnerable to XSS — acceptable risk for a
  tool with one operator and no UGC, but cannot scale to multiple users.
- Replacing this with cookie/OAuth means changing the middleware and the
  frontend's auth header injection — call sites do not change.
- `/health` is the documented exception; any future "unauthenticated"
  endpoints must justify themselves against this baseline.
