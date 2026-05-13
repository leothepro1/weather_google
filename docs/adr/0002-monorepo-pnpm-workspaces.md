---
number: 0002
date: 2026-05-13
status: accepted
supersedes: null
migrated_from: DECISIONS.md#2
---

## Context

The project has an API (Cloudflare Worker) and a web app (separate
deploy), and they share request/response shapes. We need a way to keep
the two in lockstep without the friction of publishing a shared types
package.

## Decision

A single repo with `apps/api`, `apps/web`, and `packages/shared`, managed
with pnpm workspaces.

pnpm workspaces let us share `zod` schemas and their inferred TypeScript
types between the API (for request validation) and the web app (for typed
fetch) without publishing a package. Changes to a schema fail typecheck on
both sides in one CI run.

## Alternatives considered

- **Two separate repos with a published `@bf/shared` package** —
  introduces a versioning step on every schema change. Slower iteration,
  and risks drift when one side pins an older version.
- **Two separate repos with duplicated types** — drift is guaranteed,
  caught only at runtime.
- **Yarn / npm workspaces** — workable, but pnpm's content-addressable
  store and stricter peer-dep resolution are valuable for catching
  packaging mistakes early.

## Consequences

- All contributors need pnpm installed; cannot use `npm install` at the
  root without breaking the lockfile guarantees.
- One CI run typechecks both sides — slower than a single app would be,
  but the trade is intentional.
- We need to be disciplined about what lands in `packages/shared`: only
  things genuinely shared, otherwise the package becomes a junk drawer.
