# Decisions

Short architectural decision records. Each entry captures a decision we've
already committed to — if we revisit one, append a new entry rather than
editing history.

## 1. Cloudflare Workers + D1 over Vercel / Render

We run the API as a Cloudflare Worker and persist state in D1. The free tier
covers expected volume for a single-user tool, there are no cold starts, and
scheduled triggers (cron) are built in — so the daily budget-adjustment job
doesn't need a separate scheduler. D1's SQLite dialect is comfortable for the
kind of small relational data we're dealing with and works locally via
Wrangler.

## 2. Monorepo with pnpm workspaces

A single repo with `apps/api`, `apps/web`, and `packages/shared`. pnpm
workspaces let us share `zod` schemas and their inferred TypeScript types
between the API (for request validation) and the web app (for typed fetch)
without publishing a package. Changes to a schema fail typecheck on both
sides in one CI run.

## 3. Bucket model: temperature range + conditions array + modifier %

A "bucket" is the unit the user configures: optional `[minTempC, maxTempC]`
range, an array of weather conditions (clear, rain, etc.), and a
`modifier_pct` to apply. This is simple to reason about, easy to render as
form fields, and composes with priority-based selection (decision 5). We
deliberately avoid more expressive DSLs (cron-like rules, compound boolean
logic) until we hit a real use case that demands them.

## 4. Budget formula: `new = base × (1 + modifier)`; base snapshotted on link

When a campaign is assigned to a bucket system, we snapshot its current
Google Ads daily budget as `base_budget_micros`. Every adjustment is computed
from that base, never from the previously-adjusted budget. This prevents
modifier drift (compounding) across cron runs and keeps the math trivial to
audit in `adjustment_log`.

## 5. One bucket wins per cron run per campaign, by priority

If a campaign is linked to multiple buckets and more than one matches the
current weather, we pick the one with the highest `priority`. Priority is
user-controlled via drag-and-drop in the UI. No blending, no averaging —
predictable behaviour beats clever behaviour, and "one rule fired" is easy
to explain in the adjustment log.

## 6. Daily cron frequency

The scheduler fires once every 24 hours. Google Ads budget churn is undesirable
and weather doesn't change materially within a 24-hour window for the kind of
budget decisions being modelled. Tighter frequencies are trivial to add later
by changing one line in `wrangler.toml`.

## 7. Single fixed geographic location for weather

Weather is pulled for one configured lat/lon, not per-campaign or per-audience.
This matches the mental model of a single operator watching one market. Adding
per-bucket locations later only requires a nullable column on `buckets` and a
fallback to the global location.

## 8. Single-user bearer-token auth for Phase 0

One `ADMIN_TOKEN` secret, checked by a Hono middleware on every route except
`/health`. The frontend stores it in `localStorage` after a login form. This
is the minimum correct pattern — we can replace it with Google OAuth when we
add the real Google Ads client in Phase 1, without rewriting call sites.

## 9. `MockGoogleAdsClient` first, real implementation in Phase 1

Every route and service speaks to `GoogleAdsClient` (an interface). Phase 0
ships a mock that returns three fake campaigns and logs budget updates to the
console. This unblocks the entire UI + cron pipeline before we deal with the
real Google Ads OAuth dance, and gives us a ready-made seam for tests.

## 10. ESLint v9 with flat config

We use ESLint v9 and the flat config format (`eslint.config.mjs` at the repo
root) rather than legacy `.eslintrc`. v9 is the current supported line — v8
is EOL. Flat config is the only format v9 accepts without a compat shim, and
every plugin we need (`typescript-eslint`, `eslint-plugin-react`,
`eslint-plugin-react-hooks`, `eslint-config-prettier`) supports it natively at
the versions we pin, so there's no reason to stay on the legacy format. One
file at the root covers the whole monorepo; per-app overrides live in the same
file as targeted entries.
