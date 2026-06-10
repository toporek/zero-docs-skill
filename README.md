# zero-docs-skill

A Claude Code plugin that mirrors the [Rocicorp Zero](https://zero.rocicorp.dev)
documentation into local, grep-friendly Markdown so Claude Code answers Zero
questions from the real docs instead of guessing.

## What's inside

- `skills/zero-docs/` — the installable skill: `SKILL.md` router, generated
  `INDEX.md`, and `references/` (one Markdown file per upstream doc).
- `scripts/sync.mjs` — regenerates `references/` + `INDEX.md` from upstream.

## Updating

```bash
npm run sync        # re-pull upstream and regenerate (commit the result)
npm run sync:check  # CI: non-zero exit if committed output drifts from upstream
npm test            # unit tests for the transform/index/collect modules
```

`SOURCE.md` records the upstream commit the current mirror was generated from.
A weekly GitHub Action opens a PR automatically when upstream changes.

## Installing as a plugin

Point your Claude Code plugin configuration at this repository. The `zero-docs`
skill activates when you work on Zero-related code.

## Transform fidelity

The sync transforms MDX to Markdown mechanically: frontmatter and fenced code
blocks are preserved verbatim, `<Note>` callouts become blockquotes, and other
JSX wrapper tags (e.g. `<CodeGroup>`, `<ZeroProvider>`) are stripped while their
inner content is kept. A small number of upstream components inject content at
build time (e.g. `SyncedCode`); where the source MDX has no inline body, that
content is not captured. The sync logs every stripped component name so coverage
gaps are visible.

## License & attribution

Documentation content under `skills/zero-docs/references/` is © Rocicorp,
mirrored from [rocicorp/zero-docs](https://github.com/rocicorp/zero-docs) and
[zero.rocicorp.dev](https://zero.rocicorp.dev) under the
[Apache License 2.0](LICENSE), with mechanical modifications (fetched as
rendered markdown; internal links rewritten to local paths). The sync tooling
in this repo is also Apache-2.0.

This is an unofficial community project, not affiliated with or endorsed by
Rocicorp. "Zero" and "Rocicorp" are names of their respective owners.
