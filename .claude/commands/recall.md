---
description: "Surface what docs/ already knows about a module or topic"
---

Run the mechanical search, then synthesise. Do not skim the file paths —
read the matched lines.

```bash
.claude/scripts/recall.sh "$ARGUMENTS"
```

If `$ARGUMENTS` is empty, infer the topic from the most recent context
(the file the user asked you to change, the module they named) and state
your inference on the first line.

If the script prints "green field" — repeat that and stop. There is
nothing to synthesise.

Otherwise, synthesise the matches into ~150 words using this format:

```
## Recall: <topic>

### Decided
- ADR-NNNN — <one-line conclusion>. (path)

### Shipped
- <date> <slug> — <one-line>. (path)

### In flight
- roadmap: <one-line>

### Open
- <thing> — surfaced in <where>, no decision recorded
```

Omit empty sections. Cap each section at 5 most-relevant entries.

This is read-only synthesis. Do not write to disk.
