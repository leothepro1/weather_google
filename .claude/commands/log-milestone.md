---
description: "Write a feature log to docs/features/ for a completed milestone"
---

You just completed a meaningful chunk of work. Write a feature log file.

## Pre-flight — apply the Boris filter before opening any editor

Answer one question first:

> Would a competent engineer six months from now take a different action
> because this entry exists?

If no, unclear, or "they'd do the same anyway" — say "this doesn't meet the
logging bar — skipping" and stop. Do not write an apologetic empty file.

### Hard refuse — never write a feature log for these

- Visual / styling changes, even when framed as a bug fix
- Dependency bumps within a major version, lockfile churn
- Lint / prettier / tsconfig / editor / CI-formatting tweaks
- Refactors that preserve the module's public API
- Test-only commits adding coverage to shipped behaviour
- Typo, comment, dead-code, import-order cleanup
- In-session reverts (you wrote and undid X in this session — neither
  happened)
- Investigations that did not land in code or in an ADR

### Resolve these ambiguous cases without asking the user

| Situation | Verdict | Why |
|---|---|---|
| Fixed checkout button invisible on mobile (CSS) | NO | Visual change, even though framed as a bug |
| Fixed checkout total wrong for tax-exempt items | YES | Customer-facing behaviour change |
| Split `UserService` into two files, same public API | NO | Behaviour preserved, contract unchanged |
| Same split, but consumers now import a different path | YES | Public contract changed — also worth an ADR |
| Added retry-with-backoff to payment webhook handler | YES | Externally observable behaviour |
| Switched one file from axios to fetch | NO | Local, no contract change |
| Switched the whole codebase from axios to fetch | YES | Cross-cutting — write the ADR first, then this log |
| Upgraded React 18.2 → 18.3 | NO | Patch/minor, no behaviour change |
| Upgraded React 18 → 19 with codemod | YES | Breaking, requires migration awareness |
| Added DB index via a real migration file | YES | Schema migration |
| Same index applied manually to dev DB, no migration | NO | Not reproducible, not real work |
| Renamed env var `DB_URL` → `DATABASE_URL` | YES | Deployment-breaking — "trivial" lies here |
| Added a feature flag with non-trivial semantics | YES | Future-Claude needs to know the flag exists |
| Added a feature flag that just toggles a colour | NO | Visual, even with a flag wrapper |
| Reverted a feature that shipped two weeks ago | YES | Reversal is itself a decision |
| Reverted a 5-line change made earlier this session | NO | Neither side happened, from the log's view |
| Performance fix: added missing index | YES if cause was non-obvious (migration omission); NO if "made it faster" is the whole story | |
| Spent 2h investigating, no code, no decision | NO | Nothing landed |
| Same 2h, ended with "we'll use Redis not KeyDB" | YES — but write it as an ADR via `/adr`, not as a feature log | |

## Steps

1. Derive a kebab-case slug from the feature name (max ~4 words).
2. Identify the primary module — one of the top-level directories under
   `apps/` or `packages/`. If the work spans multiple, pick the one most
   affected.
3. Determine status: `shipped` (merged/deployable), `in-progress` (work
   continues tomorrow), or `blocked` (waiting on external input).
4. Create `docs/features/$(date -u +%Y-%m-%d)-<slug>.md` with this exact
   frontmatter shape — do not add fields the dashboard doesn't know about:

```yaml
---
date: YYYY-MM-DD
type: feature
module: <module-name>
status: shipped | in-progress | blocked
links: []     # ADR paths, e.g. adr/0003-payment-gateway.md
---
```

5. Body has exactly three sections, in this order, with these headings:

   - `## What` — one paragraph, present tense. What now exists in the system
     that didn't before. Name modules, contracts, endpoints — concrete nouns.
   - `## Why` — one paragraph. The constraint or goal that drove this. If a
     decision was made between alternatives, link the ADR here; if you didn't
     write one yet, write the ADR first via `/adr`.
   - `## How next` — bullet list. What this unblocks, or what still has to
     ship before the feature is complete.

6. Do **not** include: file lists, line counts, commit hashes, diffs,
   step-by-step explanations of how you implemented it. Git already shows
   that. The log is for reasoning, not record-keeping.

## Length

150–400 words. If you find yourself writing more, you are explaining code
instead of explaining decisions — cut it back.

## The pre-save check

Before writing the file to disk, read your draft and answer:

> **If I deleted this file tomorrow, would the project be measurably worse
> off?**

If "no" or "not sure" — discard the draft and tell the user the work didn't
meet the bar after all. It is better to have written nothing than to have
written something forgettable.

## Quality bar

Two tests, both must pass:

1. **Counterfactual** — a competent engineer reading this six months from
   now would take a different action because the entry exists.
2. **Concrete** — every noun is a real thing (module, contract, endpoint,
   constraint). No "various improvements", no "general cleanup", no
   "refactored for clarity".

If either fails, rewrite or skip.
