---
description: "Run docs/ drift audit and interpret the report"
---

Run the deterministic auditor and interpret its findings.

```bash
.claude/scripts/audit-docs.sh
```

The script does the mechanical checks (orphaned ADRs, broken supersede
chains, ADRs without follow-through, roadmap drift, EOD coverage). Your job
is to **interpret**, not to repeat.

For each finding in the report, answer:

1. **What does it mean for the codebase?** Not what the audit said — what
   the underlying drift implies. ("ADR-0007 references a Stripe client
   that no longer exists in the code" → either the integration was ripped
   out without an ADR superseding 0007, or the ADR is stale.)
2. **What is the smallest fix?** Usually one of: write a new ADR
   superseding the old one; update frontmatter; backfill a missing feature
   log; mark a roadmap item as `deferred` if it stalled.

Do **not** auto-fix. Surface the findings and the proposed fixes; let the
user decide.

If the report says "No drift detected" — say so in one line and stop. Do
not invent issues to justify having run the command.
