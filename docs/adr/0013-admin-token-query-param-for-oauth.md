---
number: 0013
date: 2026-05-13
status: accepted
supersedes: null
migrated_from: DECISIONS.md#13
---

## Context

The OAuth kickoff route (`GET /auth/google/start`) is invoked via a
browser navigation — the operator clicks a "Connect Google" button and
the browser does a top-level redirect. Browser navigations cannot carry
an `Authorization` header, so the standard bearer-token check (ADR-0008)
does not apply to this single route.

## Decision

`GET /auth/google/start` accepts `?token=<ADMIN_TOKEN>` as a query
parameter.

The referrer to `accounts.google.com` is stripped (via the standard
referrer-policy meta tag on the redirect page), so the token does not
leak downstream. If this project ever grows beyond a single operator,
replace with a cookie session.

## Alternatives considered

- **Cookie session for the whole API** — the correct long-term answer,
  but ADR-0008 deferred that for Phase 0. Re-litigating it just for one
  route is the wrong scope.
- **Form POST on `/auth/google/start`** — the operator's click would
  have to go through a JS-handled submit; the route would still need an
  unauthenticated GET to redirect to Google. The query param is simpler.
- **Short-lived signed token issued from an authenticated endpoint** —
  cleaner, but requires HMAC infra we have deliberately not introduced
  (see ADR-0012's state-token decision).

## Consequences

- The `ADMIN_TOKEN` appears in browser history and server access logs
  for this one route. Acceptable risk because the token is the only
  credential and the operator is the only user.
- If we add a second operator, this route is the first to migrate to a
  cookie session — its query-param form is explicitly documented as a
  Phase 0 exception.
- The referrer-policy meta tag is load-bearing for this decision —
  removing it without replacing the auth model would leak the token to
  Google's domain.
