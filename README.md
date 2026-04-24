# Weather Budget Modifier

Internal tool that adjusts Google Ads campaign daily budgets based on current
weather. The operator defines **buckets** (temperature range + weather
conditions + modifier %), assigns campaigns to them, and a daily cron applies
the highest-priority matching bucket:

```
new_budget = base_budget × (1 + modifier_pct / 100)
```

See [`DECISIONS.md`](./DECISIONS.md) for the architectural decisions behind
this repo.

## Status

**Phase 1 — Google Ads OAuth + read-only campaign listing.** The dashboard
can connect a Google Ads account via a one-time OAuth flow, list campaigns
read-only, and disconnect (revoking the refresh token). Budget mutations
are not implemented yet — the real client throws on any `update…` call.

## Stack

- **Monorepo:** pnpm workspaces
- **API:** Cloudflare Workers + Hono + TypeScript (Wrangler)
- **DB:** Cloudflare D1, SQL migrations
- **Web:** React + Vite + TypeScript + Tailwind, deployed to Cloudflare Pages
- **Shared:** zod schemas in `packages/shared`
- **Tests:** Vitest (+ `@cloudflare/vitest-pool-workers` for the Worker)

## Repo layout

```
apps/
  api/        Cloudflare Worker (Hono)
  web/        React + Vite
packages/
  shared/     zod schemas + inferred types
migrations/   D1 SQL migrations
.github/workflows/ci.yml
```

## Prerequisites

- Node.js **22 LTS** (pinned in `.nvmrc`; run `nvm use` to match)
- pnpm **10.x** (`corepack enable` will pick up the version from `package.json`)
- A Cloudflare account if you want to run the Worker locally against real D1
  — otherwise `wrangler dev` works with a local SQLite shim

## First-time setup

```bash
pnpm install
cp .env.example .env            # optional — see "Environment" below
```

### Create the D1 database

```bash
cd apps/api
pnpm exec wrangler d1 create wbm
```

Wrangler prints a `database_id`. Paste it into `apps/api/wrangler.toml`
under `[[d1_databases]]`.

### Apply migrations

```bash
# Local dev DB (used by `wrangler dev`):
pnpm exec wrangler d1 migrations apply wbm --local

# Remote (production) DB:
pnpm exec wrangler d1 migrations apply wbm --remote
```

### Set the admin token

```bash
# Local:
cp apps/api/.dev.vars.example apps/api/.dev.vars
#   ... then fill in real values; at minimum set ADMIN_TOKEN.

# Remote:
pnpm exec wrangler secret put ADMIN_TOKEN
```

### One-time Google Ads OAuth setup

Phase 1 runs against the real Google Ads API. To connect:

1. **GCP console** → pick a project (or create one) → **APIs & Services →
   Credentials** → **Create OAuth client ID** → type *Web application*.
   Add redirect URIs for every environment you run in, e.g.
   `http://localhost:8787/auth/google/callback` for local dev.
2. **Enable the Google Ads API** on the same project.
3. **Apply for a Google Ads developer token** (MCC → Tools → API Center).
   Basic Access tier is enough for this tool.
4. Fill in `apps/api/.dev.vars` (gitignored) with:
   - `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` from step 1
   - `GOOGLE_OAUTH_REDIRECT_URI` matching one of the URIs you registered
   - `GOOGLE_ADS_DEVELOPER_TOKEN` from step 3
   - `GOOGLE_ADS_LOGIN_CUSTOMER_ID` — your MCC customer ID, digits only
   - `GOOGLE_ADS_CUSTOMER_ID` — the advertiser account this tool manages
   - `USE_MOCK_GOOGLE_ADS=true` to keep using fake data; unset for real
5. Start both dev servers (see next section), open the dashboard, click
   **Connect Google Ads**. The callback stores a refresh token in D1
   under `config.google_refresh_token`. From then on the tool uses it.

In production, push each secret with `wrangler secret put <NAME>`, and
the non-secret ones (client ID, customer IDs, redirect URI) can go in
`wrangler.toml` `[vars]` or also as secrets — your call.

## Running locally

In two terminals:

```bash
pnpm dev:api   # wrangler dev — http://127.0.0.1:8787
pnpm dev:web   # vite          — http://127.0.0.1:5173
```

Open <http://127.0.0.1:5173>, sign in with the admin token you set above. The
dashboard calls `/health` on mount and bounces to login on 401.

## Scripts

All from the repo root:

| Script              | What it does                            |
| ------------------- | --------------------------------------- |
| `pnpm typecheck`    | `tsc --noEmit` in every workspace       |
| `pnpm lint`         | ESLint across the repo                  |
| `pnpm test`         | Vitest in every workspace               |
| `pnpm build`        | Build every workspace                   |
| `pnpm dev:api`      | `wrangler dev` for the API              |
| `pnpm dev:web`      | `vite` for the web app                  |
| `pnpm format`       | Prettier write                          |
| `pnpm format:check` | Prettier check (no writes)              |

## Environment variables

See [`.env.example`](./.env.example) for the authoritative list. Summary:

| Name                           | Where          | Purpose                                          |
| ------------------------------ | -------------- | ------------------------------------------------ |
| `ADMIN_TOKEN`                  | Worker secret  | Bearer token for all API routes                  |
| `WEATHER_LAT` / `WEATHER_LON`  | Worker var     | Fixed location for weather lookup                |
| `APP_VERSION`                  | Worker var     | Surfaced on `/health`                            |
| `WEB_ORIGIN`                   | Worker var     | Web origin allowed by CORS (e.g. `:3000`)        |
| `USE_MOCK_GOOGLE_ADS`          | Worker var     | `"true"` → MockGoogleAdsClient; else real client |
| `GOOGLE_ADS_DEVELOPER_TOKEN`   | Worker secret  | Google Ads API developer token                   |
| `GOOGLE_OAUTH_CLIENT_ID`       | Worker var     | OAuth 2.0 client ID                              |
| `GOOGLE_OAUTH_CLIENT_SECRET`   | Worker secret  | OAuth 2.0 client secret                          |
| `GOOGLE_OAUTH_REDIRECT_URI`    | Worker var     | Must match a URI registered in GCP               |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Worker var     | MCC customer ID (login-customer-id header)       |
| `GOOGLE_ADS_CUSTOMER_ID`       | Worker var     | Advertiser account this tool manages             |
| `VITE_API_URL`                 | Web build-time | Base URL the browser uses for the API            |

## Tests

Vitest runs everywhere. The API uses `@cloudflare/vitest-pool-workers` so
tests execute inside a Miniflare-emulated Worker (real `c.env`, real
bindings). The web app uses jsdom + Testing Library.

```bash
pnpm test                 # everything
pnpm --filter @wbm/api test
pnpm --filter @wbm/web test
pnpm --filter @wbm/shared test
```

## CI

`.github/workflows/ci.yml` runs on push and PR to `main`: install →
typecheck → lint → test. No deploy step yet.
