# Architecture Decision Records

Each ADR captures a decision we have committed to — what was chosen, what
was rejected, and why. Files are numbered in the order they were written;
the number never changes. Superseded decisions stay in the index with a
pointer to their replacement.

ADRs are written by Claude via the `/adr` slash command. Do not edit this
index by hand for new entries — let the command append.

## Index

<!-- New entries are appended below this line by /adr -->
- [0001 — Cloudflare Workers + D1 over Vercel / Render](./0001-cloudflare-workers-d1.md) — API on Workers, state in D1; free tier covers volume and cron is built in.
- [0002 — Monorepo with pnpm workspaces](./0002-monorepo-pnpm-workspaces.md) — Share `zod` schemas between API and web without publishing a package.
- [0003 — Bucket model: temperature range + conditions array + modifier %](./0003-bucket-model.md) — Simple data model the user can configure; defer DSLs until a real use case demands.
- [0004 — Budget formula `new = base × (1 + modifier)`; base snapshotted on link](./0004-budget-formula-base-snapshot.md) — Prevents modifier drift across cron runs; auditable arithmetic.
- [0005 — One bucket wins per cron run per campaign, by priority](./0005-priority-based-bucket-selection.md) — Predictable behaviour beats clever behaviour; single `winning_bucket_id` per row.
- [0006 — Daily cron frequency](./0006-daily-cron-frequency.md) — 24h cadence; tighter frequencies are a one-line change in `wrangler.toml`.
- [0007 — Single fixed geographic location for weather](./0007-single-fixed-weather-location.md) — Matches single-operator mental model; per-bucket override is a non-breaking future addition.
- [0008 — Single-user bearer-token auth for Phase 0](./0008-single-user-bearer-auth.md) — Minimum correct pattern; replaceable with OAuth/cookie without rewriting call sites.
- [0009 — `MockGoogleAdsClient` first, real implementation in Phase 1](./0009-mock-google-ads-first.md) — Interface seam unblocks UI + cron pipeline; `USE_MOCK_GOOGLE_ADS` is the runtime toggle.
- [0010 — ESLint v9 with flat config](./0010-eslint-v9-flat-config.md) — v8 is EOL; one `eslint.config.mjs` covers the whole monorepo.
- [0011 — Google Ads API v23 via `fetch` (no SDK)](./0011-google-ads-api-v23-via-fetch.md) — SDK breaks under Workers' runtime; v23.2 pinned for bake-time over v24.
- [0012 — OAuth state + refresh token both in D1 `config`](./0012-oauth-state-and-refresh-in-d1.md) — Store-and-delete state avoids an HMAC secret; single refresh token per single-user tool.
- [0013 — `GET /auth/google/start` accepts `?token=<ADMIN_TOKEN>`](./0013-admin-token-query-param-for-oauth.md) — Browser navigations cannot carry `Authorization`; referrer-policy strips the token before it reaches Google.
