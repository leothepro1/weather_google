# CLAUDE.md

You are working in a large, modular e-commerce platform. `docs/` is your
own memory across sessions — and the team reads it on a dashboard. Treat
log files as the work product, not the by-product.

Two rules override everything else:

1. **Signal, not activity.** Log what changed in the *system*, not what
   you did with your *tools*.
2. **Future-Claude readable.** A cold Claude session three months from
   now must be able to reconstruct context from `docs/` alone.

## The logging contract

| Artefact | When | How |
|---|---|---|
| **Feature log** | A meaningful chunk of work shipped — new module, integration, breaking change, migration | `/log-milestone` |
| **ADR** | A decision was made between alternatives — library pick, tradeoff settled, pattern adopted, obvious thing deliberately not done | `/adr` |
| **EOD enrichment** | The user signals end of day | `/eod` |

Hooks handle the rest deterministically: `SessionEnd` writes the EOD
skeleton, `PreCompact` snapshots state, `SessionStart` emits a continuity
pointer. Don't replicate them. Don't write `.md` with `Write` outside of
those three slash commands — the dashboard relies on consistent frontmatter
and section shape.

## The filter

Before writing any `.md`, answer once:

> **Would a competent engineer six months from now take a *different
> action* because this entry exists?**

If no, unclear, or "same anyway" — do not write. Silence is the correct
output.

**Hard NO** (never logged): visual/CSS changes, dep bumps within a major,
config tweaks (prettier/eslint/tsconfig/editor), behaviour-preserving
refactors, test-only commits, typo/comment/dead-code cleanup, in-session
reverts, investigations that didn't land.

**Hard YES** (always logged): new modules, external integrations added or
removed, schema migrations, breaking contract changes (API, env var, CLI
flag), decisions between alternatives (even when one was obvious),
reversals of previous decisions, performance work where the *cause* was
non-obvious.

The ambiguous cases (CSS bug vs. behaviour bug, file-level vs. codebase
migration, env-var renames, etc.) live in the slash commands themselves —
read them when you run the command.

## Self-orientation

`docs/` exists so you don't drift between sessions. Two primitives:

- **`/recall <module|topic>`** — runs a mechanical search and returns ADRs,
  feature logs, and roadmap items that mention the topic. Use it when
  you'd benefit from context, not as ceremony before every edit.
- **`/audit`** — runs `audit-docs.sh` and interprets the report. Use it
  when you suspect code and `docs/` have drifted.

The `SessionStart` hook already prints roadmap status + ADR count on every
session — read it. If you're disoriented after context compaction, look in
`docs/session-logs/snapshots/`.

## File layout

```
docs/
├── session-logs/        # SessionEnd writes here; you enrich via /eod
│   ├── YYYY-MM-DD-eod.md
│   ├── .metadata.jsonl  # machine feed for the dashboard
│   └── snapshots/       # PreCompact breadcrumbs
├── features/            # /log-milestone
├── adr/                 # /adr (numbered, with auto-index README.md)
└── roadmap.md           # single living document
```

## Ambiguity

If a user prompt is unclear about whether something deserves a log entry,
ask once. If they say "don't log this" — don't, even if it would normally
qualify.
