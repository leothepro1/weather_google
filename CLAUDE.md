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

## The Boris filter

"Would Boris be impressed?" is vibes. Replace it with a counterfactual test
that produces the same answer twice in a row.

### The rule (apply to every potential entry)

> **Would a competent engineer, reading this entry alone six months from
> now, take a *different action* because the entry exists?**

If the answer is no, unclear, or "they'd do the same thing anyway" — do not
write. Silence is the correct output. The dashboard tolerates silence. It
does not tolerate noise.

### Hard NO — never logged, no exceptions

- **Visual changes.** Colors, padding, typography, spacing, icons, layout,
  dark-mode tweaks. *Even if framed as a "bug fix".*
- **Dependency hygiene.** Bumps inside a major version, lockfile refreshes,
  audit patches that don't change behaviour.
- **Config tweaks.** `.prettierrc`, `eslint.config.*`, `tsconfig.json`,
  `.editorconfig`, VS Code settings, CI YAML formatting.
- **Behaviour-preserving refactors.** Renames, file moves, function
  extractions, file splits. If the module's public API is unchanged → no log.
- **Test-only changes.** Coverage added for behaviour that already shipped.
  (Tests for *new* behaviour are part of that feature's log, not a separate
  entry.)
- **Code hygiene.** Typos, dead-code removal, comment fixes, import order,
  unused-variable cleanup.
- **In-session reverts.** If you wrote and reverted X in the same session,
  neither happened from the log's view.
- **Investigations without a landing.** "Looked at Redis vs. KeyDB but
  didn't decide" produces no artefact. If a decision was reached, it's an
  ADR. If not, nothing.

### Hard YES — always logged

- New module shipped to production, or the first meaningful slice of one
- External integration added or removed (payments, mail, storage,
  analytics, auth, telemetry, queue, search, CDN)
- Schema migration, data model change, anything irreversible without
  another migration
- Breaking change to any contract — public API, internal module interface,
  env var name, CLI flag, file path consumed by another service
- Decision between alternatives, *even when one was obvious in the moment*
  — future-Claude won't see what wasn't picked otherwise
- Reversal of a previous decision — log it and supersede the prior ADR
- Performance work where the *cause* matters (N+1, lock contention,
  cold-start, bundle split). "Added an index, queries got faster" is not
  loggable; "discovered `orders.customer_id` had no index because migration
  0042 omitted it" is.

### The pre-publish check

Before saving any `.md`, ask one more question:

> **If I deleted this file tomorrow, would the project be measurably worse
> off?**

If the answer is "no" or "not sure" — delete it. Do not ship logs you
wouldn't miss.

The tougher ambiguous cases (CSS bug vs. behaviour bug, partial-vs.-total
migration, env var renames, etc.) live in the `/log-milestone` and `/adr`
slash commands, where the rule is actually applied. Read those when you run
the command.

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
