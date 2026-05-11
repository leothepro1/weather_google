# Weather Budget Modifier

A Google Ads Script that adjusts campaign daily budgets based on current
weather, with bucket rules (temperature range + conditions + modifier %)
defined in a linked Google Sheet.

## What's in this repo

- [`ads-script/budget-modifier.gs`](./ads-script/budget-modifier.gs) — the
  script itself. Setup, configuration, and the Sheet layout are documented
  in the header comment at the top of that file.
- [`DECISIONS.md`](./DECISIONS.md) — architectural decision log, including
  entry 14 which records the pivot from a Worker/web/D1 stack to a single
  Ads Script.
- [`docs/WBM-Design-Documentation.rtf`](./docs/WBM-Design-Documentation.rtf)
  — design document, kept as a record.
