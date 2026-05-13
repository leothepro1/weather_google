---
number: 0010
date: 2026-05-13
status: accepted
supersedes: null
migrated_from: DECISIONS.md#10
---

## Context

We need a linter that catches typescript-eslint, react, and react-hooks
rules across the monorepo, with one configuration covering both
`apps/api` and `apps/web` plus shared packages.

## Decision

ESLint v9 with the flat config format (`eslint.config.mjs` at the repo
root), not legacy `.eslintrc`.

v9 is the current supported line — v8 is EOL. Flat config is the only
format v9 accepts without a compat shim, and every plugin we need
(`typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`,
`eslint-config-prettier`) supports it natively at the versions we pin. One
file at the root covers the whole monorepo; per-app overrides live in the
same file as targeted entries.

## Alternatives considered

- **ESLint v8 with `.eslintrc`** — v8 is EOL, so we would be writing new
  code against a deprecated config format from day one. Migration cost
  is non-zero; do it once.
- **Biome** — single-binary, fast, but its rule coverage is narrower
  than `typescript-eslint` (especially for React Hooks rules) and we
  would have to back-fill the gaps with another tool anyway.
- **Per-package `.eslintrc` files** — splits the lint contract across
  the monorepo; rule drift between apps becomes likely.

## Consequences

- New contributors who know legacy `.eslintrc` must learn the flat
  config shape. Cost is low; the format is well-documented.
- One file is the lint contract for the entire repo. Any per-app rules
  must be added to that file as targeted overrides, not as separate
  configs.
- If a plugin we depend on lags on flat-config support in the future,
  we have to either upgrade the plugin, fork it, or accept a compat
  shim — a real but tolerable risk.
