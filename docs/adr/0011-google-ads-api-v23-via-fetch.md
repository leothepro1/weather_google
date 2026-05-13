---
number: 0011
date: 2026-05-13
status: accepted
supersedes: null
migrated_from: DECISIONS.md#11
---

## Context

Phase 1 needs to call the real Google Ads API from inside a Cloudflare
Worker. The official Node client is the obvious starting point — but
Workers have a constrained runtime (no Node built-ins, limited `Buffer`,
no filesystem) and the Google Ads SDK has repeatedly broken under those
constraints.

## Decision

We call the Google Ads REST endpoint at
`https://googleads.googleapis.com/v23/...` directly via `fetch`. No SDK.

v23 is pinned (specifically v23.2) — not the newer v24 released
2026-04-22 — because v23.2 has two patch releases of bake time behind
it; v24 does not. The path segment is a single constant in `real.ts`, so
bumping is a one-line change when we want it.

## Alternatives considered

- **Official Google Ads Node SDK** — repeatedly broken under Workers'
  runtime constraints (Node built-ins, gRPC reachability,
  `protobuf.js` size). Track record argues against it.
- **gRPC directly via `connect-rpc`** — Workers do not yet support
  HTTP/2 in a way that gRPC clients expect; would need a proxy.
- **Pin v24 immediately** — newer is not always better; we prefer at
  least two patch releases of bake time before adopting a major version
  for a production-billing-affecting integration.

## Consequences

- We hand-roll request and response types for the endpoints we use. The
  Google Ads API surface is large; we only model what we hit.
- API version bumps are a one-line change in `real.ts` — but we must
  re-test request and response shapes when we bump.
- We do not get SDK conveniences like automatic retry, exponential
  backoff, or paging — these have to be added explicitly where needed.
- If v23.2 is deprecated by Google, we have a hard deadline to bump
  before service degrades.
