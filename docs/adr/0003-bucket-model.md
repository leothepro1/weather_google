---
number: 0003
date: 2026-05-13
status: accepted
supersedes: null
migrated_from: DECISIONS.md#3
---

## Context

We need a data model the user can configure to express "when the weather
matches X, modify the budget by Y%". The model has to be easy to render
as a form, easy to reason about, and composable with the rule-selection
logic (see ADR-0005).

## Decision

A "bucket" is the unit the user configures: an optional `[minTempC,
maxTempC]` range, an array of weather conditions (clear, rain, etc.), and
a `modifier_pct` to apply.

This is simple to reason about, easy to render as form fields, and
composes with priority-based selection (ADR-0005). We deliberately avoid
more expressive DSLs until we hit a real use case that demands them.

## Alternatives considered

- **Cron-like rules** (`*/15 * * * * temp>20 AND cond IN (clear)`) —
  power-user expressive, but UI becomes a text editor or a wizard with
  many edge cases. No demonstrated need.
- **Compound boolean logic** (AND/OR/NOT trees) — same complexity story
  on the UI side, and the model itself becomes harder to validate.
- **One-modifier-per-condition with separate temperature thresholds** —
  fewer fields per row, but multiplies row count for the user.

## Consequences

- The model cannot express "if rain AND wind > 10 m/s" or other
  conjunctions across non-temperature dimensions. Acceptable until proven
  otherwise.
- Adding new condition types (e.g. humidity bands) means extending the
  enum and the matcher, not redesigning the schema.
- Validation lives in a single `zod` schema shared between API and UI per
  ADR-0002 — schema changes propagate to both in one CI run.
