# CLAUDE.md

You are Claude Code working inside a large, modular e-commerce platform. The team operates an internal dashboard that reads markdown files from `docs/` to follow your development in near-real-time. Your logging discipline is the contract that keeps that dashboard useful — not noise to be ignored, not a chore, the actual work product alongside the code.

Two principles override everything else in this file:

1. **Signal, not activity.** Log what changed in the *system*, never what you did with your *tools*.
2. **Future-Claude readable.** A new Claude session three months from now must be able to reconstruct the project's reasoning from `docs/` alone.

---

## The logging contract

You produce exactly three artefact types. Nothing else.

| Artefact | When you write it | How |
|---|---|---|
| **Feature log** | A meaningful chunk of work is complete (new module, integration, breaking change, migration, new external surface) | Run `/log-milestone` |
| **ADR** | An architectural decision was made — you chose between alternatives, settled a tradeoff, picked a library, decided a data model | Run `/adr` |
| **EOD enrichment** | The user signals end of day ("I'm done", "let's wrap up", "tomorrow", or about to close the session) | Run `/eod` |

Deterministic hooks already handle:
- Skeleton end-of-day file creation (`SessionEnd` hook)
- Pre-compaction snapshots (`PreCompact` hook)
- Session-start continuity pointer (`SessionStart` hook)

Do **not** try to replicate those. Do **not** write `.md` files directly with the `Write` tool unless one of the three slash commands above is being executed. Routing all writes through the slash commands is what keeps frontmatter and structure consistent for the dashboard parser.

---

## The Boris filter — what NOT to log

The benchmark for every potential log entry is: *would Boris Cherny be impressed that this entry exists?* If the answer is anything other than yes, the entry must not exist.

Do **not** create or update any `.md` for:

- Styling — padding, colors, typography, spacing, icon swaps, layout tweaks
- Dependency bumps, lockfile churn, lint config, prettier config, tsconfig tweaks
- Refactors that preserve behaviour — renames, file moves, extractions, format-only
- Test-only commits with no new production logic
- Comment edits, typo fixes, dead-code removal
- WIP or speculative work that didn't land
- "Started looking at X" — half-done exploration

When in doubt: don't write. The dashboard tolerates silence. It does not tolerate noise.

---

## What MUST be logged

- New modules or large slices of a module shipped into production
- External integrations (payment gateways, mail providers, fulfilment, analytics)
- Breaking API changes (public or internal contract that other modules depend on)
- Schema migrations, data model changes, anything irreversible without a migration
- Decisions between alternatives — even when "obvious" in the moment, future-Claude won't see what wasn't chosen unless you write it down
- Anything you would want a teammate to know if they came back from two weeks of vacation

---

## Quality bar per artefact

Every `.md` follows three rules without exception:

1. **Frontmatter is mandatory.** Each slash command emits the right shape — don't improvise.
2. **Sections are fixed.** Three for feature logs, four for ADRs, three for EOD entries. Don't add headings the dashboard doesn't know about.
3. **WHY beats WHAT.** Git already shows what. Your job is the reasoning, the tradeoff, the constraint that forced the choice.

Length target: a feature log is 150–400 words. An ADR is 200–500 words. EOD entries are 100–300 words per session. If you find yourself writing more, you're explaining code instead of explaining decisions.

---

## File layout (don't deviate)

```
docs/
├── session-logs/                    # Hooks own this — you only enrich via /eod
│   ├── YYYY-MM-DD-eod.md            # One per day, appended per session
│   ├── .metadata.jsonl              # Machine-readable feed for the dashboard
│   └── snapshots/                   # Pre-compaction snapshots
├── features/                        # You write here via /log-milestone
│   └── YYYY-MM-DD-<slug>.md
├── adr/                             # You write here via /adr
│   ├── README.md                    # Auto-maintained index
│   └── NNNN-<slug>.md
└── roadmap.md                       # Single living document, status-tagged
```

---

## When the user is ambiguous

If a user prompt is ambiguous about whether something deserves a log entry, ask once. Don't guess. The cost of asking is one sentence. The cost of polluting `docs/` is permanent.

If the user explicitly says "don't log this" — don't log it, even if it would normally qualify. Their judgement overrides this file.
