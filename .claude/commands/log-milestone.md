---
description: "Write a feature log to docs/features/ for a completed milestone"
---

## Pre-flight — apply the filter, refuse silently if the work doesn't qualify

The rule: *would a competent engineer six months from now take a different
action because this entry exists?* If no, unclear, or "same anyway" — say
"this doesn't meet the logging bar — skipping" and stop. Never write an
apologetic empty file.

**Hard refuse** — visual changes, dep bumps within a major, lint/prettier/
tsconfig tweaks, behaviour-preserving refactors, test-only commits, typo/
dead-code/comment cleanup, in-session reverts, investigations that didn't
land.

**Resolve these without asking the user:**

| Situation | Verdict |
|---|---|
| Fixed mobile-invisible checkout button (CSS) | NO — visual, even framed as a bug |
| Fixed checkout total wrong for tax-exempt items | YES — customer-facing behaviour |
| Split `UserService` into two files, same public API | NO — contract unchanged |
| Same split but consumers import a new path | YES — also write the ADR first |
| Added retry-with-backoff to payment webhook | YES — externally observable |
| Switched one file from axios to fetch | NO — local, no contract change |
| Migrated whole codebase to fetch | YES — write ADR first, then this log |
| React 18.2 → 18.3 | NO |
| React 18 → 19 with codemod | YES — breaking |
| DB index via real migration | YES |
| DB index applied manually, no migration | NO — not reproducible |
| Renamed env var `DB_URL` → `DATABASE_URL` | YES — "trivial" lies, this breaks deploys |
| Feature flag with non-trivial semantics | YES |
| Feature flag that just toggles a colour | NO |
| Reverted a feature shipped two weeks ago | YES — reversal is a decision |
| Reverted a 5-line change made earlier this session | NO — neither side happened |
| Performance fix: added missing index | YES if cause was non-obvious; NO if "made it faster" is the whole story |
| 2h investigation, no code, no decision | NO |
| Same 2h, ended with "we'll use Redis not KeyDB" | YES — but as an ADR via `/adr`, not here |

## Steps

1. kebab-case slug (≤ 4 words).
2. Identify primary module (top-level under `apps/` or `packages/`).
3. Status: `shipped` | `in-progress` | `blocked`.
4. Create `docs/features/$(date -u +%Y-%m-%d)-<slug>.md` with this exact
   frontmatter:

   ```yaml
   ---
   date: YYYY-MM-DD
   type: feature
   module: <module>
   status: shipped | in-progress | blocked
   links: []      # ADR paths if relevant
   ---
   ```

5. Body — exactly these three sections, no others:
   - `## What` — one paragraph. What now exists in the system that didn't.
   - `## Why` — one paragraph. The constraint that drove this. Link the
     ADR if a decision was made; if you didn't write one yet, write the
     ADR first via `/adr`.
   - `## How next` — bullets. What this unblocks or what still has to ship.

## Pre-save check

Read your draft. If you deleted this file tomorrow, would the project be
*measurably worse off*? If "no" or "not sure" — discard. It's better to
write nothing than to write something forgettable.

## Constraints

- 150–400 words total. More means you're explaining code instead of
  decisions.
- No diffs, no file lists, no commit hashes. Git shows those.
- Every noun must be a real thing (module, contract, endpoint). No
  "various improvements", no "refactored for clarity".
