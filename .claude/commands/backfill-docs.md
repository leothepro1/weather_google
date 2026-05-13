---
description: Backfill per-file and per-directory markdown docs for every source module in the repo
---

# Goal: Backfill module documentation

The repo has grown without per-module markdown docs. This is a one-shot
catch-up pass. Generate documentation that a future engineer can read
*before* touching the code to understand what each module does, what it
exports, and what to be careful about.

Optimize for **usefulness to a future reader**, not word count.
Generic boilerplate is worse than no doc — if a section has nothing
real to say, omit it.

---

## Scope

Enumerate in-scope files with:

```bash
find apps packages scripts migrations -type f \
  \( -name "*.ts" -o -name "*.tsx" -o -name "*.gs" -o -name "*.sql" \) \
  ! -name "*.test.*" ! -name "*.spec.*" ! -name "*.d.ts"
```

Also include top-level configs that act as modules:
`apps/api/wrangler.toml`, `apps/api/vitest.config.ts`,
`apps/web/vite.config.ts`, `apps/web/vitest.config.ts`,
`packages/shared/vitest.config.ts`, `eslint.config.mjs`.

**Out of scope:** `node_modules`, `dist`, `.wrangler`, `*.lock`,
auto-generated files, the `docs/` tree itself.

**Expected count:** roughly 35–40 source files plus ~10–12 directory
overviews → ~45–55 markdown files total. Flag if your enumeration
deviates by more than 20 %.

---

## Output structure

Mirror source layout under a new top-level `docs/` directory:

```
docs/
  apps/
    api/
      README.md            ← module overview (apps/api as a whole)
      src/
        README.md          ← directory overview
        index.md           ← per-file doc for src/index.ts
        env.md
        middleware/
          README.md
          auth.md
        services/
          googleAds/
            README.md
            oauth.md
            real.md
            mock.md
            ...
    web/
      README.md
      src/
        README.md
        ...
  packages/
    shared/
      README.md
      src/
        README.md
        ...
  scripts/
    README.md
    weather-budget.md
  migrations/
    README.md
    0001_initial.md
```

---

## Per-file template

```markdown
# <filename without extension>

**Path:** `<full path from repo root>`

## Purpose

One sentence. Concrete. Not "handles X stuff" — "validates incoming
OAuth callback params and exchanges the code for a refresh token via
Google's token endpoint."

## Exports

| Symbol | Kind | Summary |
|---|---|---|
| `foo` | function | … |
| `Bar` | type | … |

If the file has no exports, write: `_(internal module — no exports)_`.

## Dependencies

- **Internal:** relative imports → which other in-repo modules
- **External:** npm packages used directly
- **Runtime:** D1 bindings, env vars, Apps Script globals, browser APIs, etc.

Omit any bullet that doesn't apply.

## Used by

Grep results: which other files import from this one. If nothing
imports it (and it isn't an entry point), write:
`_(no internal callers found — verify this isn't dead code)_`.

## Behavior

For each public export: inputs, outputs, side effects, error modes.
**Skip this section entirely** when the Exports table already says
everything — don't pad it.

## Gotchas

Things a reader can't infer from the code: hidden invariants, why an
obvious approach was rejected, workarounds for upstream bugs, race
conditions. Skip if there are none.
```

---

## Per-directory README template

```markdown
# <directory name>

**Path:** `<full path from repo root>`

## Overview

2–4 sentences: what this directory is for, what role it plays in the app.

## Files

| File | Purpose |
|---|---|
| `index.ts` | … |
| `auth.ts` | … |

## Public surface

Which exports from this directory are consumed outside it — the "front
door" symbols other modules should use. Omit for directories that are
not consumed externally (e.g. local helpers).

## Internal architecture

Only for non-trivial directories (4+ files with non-obvious
relationships). Describe how the files relate. Skip otherwise.
```

---

## Process

1. **Enumerate.** Run the find command. Print the list and the total
   count. Compare to the expected range; flag any surprises (new file
   types, large auto-generated areas).

2. **Mirror structure.** Create `docs/` and every required subdirectory
   in one pass.

3. **Generate in parallel.** Spawn 6–8 sub-agents at a time using the
   `Agent` tool with `subagent_type=general-purpose`. Each sub-agent:
   - Gets a batch of 4–6 files (mix of per-file + per-directory).
   - Receives the template inline (don't make the sub-agent guess).
   - Must `Read` each source file before writing its doc.
   - Must NOT fabricate exports, dependencies, or callers — if it can't
     verify a fact from the file, the corresponding section must be
     omitted or marked `_(none)_`.
   - Returns a short status: files written, files skipped, anomalies.

4. **Idempotency.** Skip any `docs/...` file that already exists.
   Log skipped files. Never overwrite without explicit instruction.

5. **Verify.** After every batch:
   - `git status --short docs/` — confirm only new files.
   - `find docs -name "*.md" | wc -l` — track running total.

6. **Commit per batch.** One commit per completed batch with a
   message like `Add docs for apps/api/src/services/googleAds/`.
   Keeps the diff reviewable.

7. **Push at end.** When the count matches the target and `git status`
   is clean, push the current branch.

---

## Quality bar

Before writing any line, the sub-agent must be able to point at a
specific line of source code that justifies it. Concretely:

- "Purpose" must reference behavior visible in the source.
- "Exports" must list only symbols that actually appear after `export`.
- "Used by" must be grep-verified — not guessed from filename.
- "Gotchas" must cite the line/pattern that creates the gotcha, not a
  general "be careful with async stuff."

If you write "this module handles X" and couldn't point at code that
proves what X is, rewrite the sentence.

---

## Definition of done

- Every in-scope source file has `docs/<mirrored-path>/<name>.md`.
- Every source directory has `docs/<mirrored-path>/README.md`.
- `git status` is clean apart from the new `docs/` files.
- All commits pushed to the current branch.
- Final summary message:
  `Created N file docs + M directory READMEs. Skipped K pre-existing. Total docs/**.md: T.`

---

## Stop conditions (ask before proceeding)

- If any source file is over 800 lines, ask whether to split its doc by
  section / by export instead of one flat file.
- If the find command returns dramatically more files than expected
  (e.g. auto-generated code under `apps/api/src` from a build step),
  stop and report before generating.
- If `docs/` already exists with content, stop and confirm strategy
  (skip existing? overwrite? merge?).
