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

**Phase 0 — Foundations.** Scaffolding only; no business features yet. The
API exposes `/health`; the web app has login + empty dashboard. CI typechecks,
lints, and tests all workspaces.

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

- Node.js **20+**
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
echo 'ADMIN_TOKEN=dev-token' > apps/api/.dev.vars

# Remote:
pnpm exec wrangler secret put ADMIN_TOKEN
```

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

| Name           | Where             | Purpose                               |
| -------------- | ----------------- | ------------------------------------- |
| `ADMIN_TOKEN`  | Worker secret     | Bearer token for all API routes       |
| `WEATHER_LAT`  | Worker var        | Fixed latitude for weather lookup     |
| `WEATHER_LON`  | Worker var        | Fixed longitude for weather lookup    |
| `APP_VERSION`  | Worker var        | Surfaced on `/health`                 |
| `VITE_API_URL` | Web build-time    | Base URL the browser uses for the API |

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
