# zero-docs-skill

A Claude Code plugin that mirrors the [Rocicorp Zero](https://zero.rocicorp.dev)
documentation into local, grep-friendly Markdown so Claude Code answers Zero
questions (ZQL, schema, mutators, permissions, zero-cache) from the real docs
instead of guessing.

Compared to fetching `zero.rocicorp.dev/llms.txt` at question time: this is
offline, grep-able, version-pinned (`SOURCE.md`), auto-synced weekly, and the
skill triggers automatically whenever you work on Zero code — no network
round-trips mid-task.

## Install

In Claude Code:

```
/plugin marketplace add toporek/zero-docs-skill
/plugin install zero-docs@zero-docs
```

The skill activates automatically when you work on Zero-related code. New
commits (including the weekly docs sync) reach installed users as plugin
updates.

## How it works

- `skills/zero-docs/` — the installable skill: `SKILL.md` router, generated
  `INDEX.md`, and `references/` (one Markdown file per upstream doc).
- `scripts/sync.mjs` — enumerates docs from a shallow clone of
  [rocicorp/zero-docs](https://github.com/rocicorp/zero-docs) (for titles,
  descriptions, and the pinned commit), fetches each page's **build-rendered
  markdown** from `zero.rocicorp.dev/docs/{slug}.md`, and rewrites internal
  links to local relative paths.

## Updating

```bash
npm run sync        # re-pull upstream and regenerate (commit the result)
npm run sync:check  # non-zero exit if committed output drifts from upstream
npm test            # unit tests for the transform/index/collect modules
```

`SOURCE.md` records the upstream commit the current mirror was generated from.
A weekly GitHub Action opens a PR automatically when upstream changes.

> **Note (maintainers/forks):** the weekly sync workflow opens PRs via
> `peter-evans/create-pull-request`, which requires the repo setting
> **Settings → Actions → General → "Allow GitHub Actions to create and approve
> pull requests"** to be enabled.

## License & attribution

Documentation content under `skills/zero-docs/references/` is © Rocicorp,
mirrored from [rocicorp/zero-docs](https://github.com/rocicorp/zero-docs) and
[zero.rocicorp.dev](https://zero.rocicorp.dev) under the
[Apache License 2.0](LICENSE), with mechanical modifications (fetched as
rendered markdown; internal links rewritten to local paths). The sync tooling
in this repo is also Apache-2.0.

This is an unofficial community project, not affiliated with or endorsed by
Rocicorp. "Zero" and "Rocicorp" are names of their respective owners.
