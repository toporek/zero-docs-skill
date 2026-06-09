# Zero Docs Skill — Design Spec

**Date:** 2026-06-09
**Status:** Draft — awaiting review
**Repo:** `~/Projects/zero-docs-skill` (standalone, installable as a Claude Code plugin)

## Goal

Give Claude Code fast, accurate lookups against the [Rocicorp Zero](https://zero.rocicorp.dev)
documentation so it stops guessing at Zero APIs (ZQL, schema, permissions, zero-cache
config, deployment) and instead answers from the real docs.

Primary optimization target: **fast, accurate Zero lookups.**
Secondary hard requirement: **easy to keep updated** — refreshing to the latest upstream
docs must be a single command, not a manual rewrite.

## Non-Goals

- No hand-maintained "distilled cheat-sheets" — they rot the moment upstream changes.
  Curation is limited to one small, stable router file (`SKILL.md`).
- No runtime server / MCP. Query-time path is local file grep/read only.
- No semantic/embedding search. The corpus is small enough that grep + a generated
  index is fast and accurate.

## Source of Truth

- Upstream: `https://github.com/rocicorp/zero-docs` (public).
- Built with Next.js; documentation content lives in `contents/docs/**/*.mdx` (MDX, ~58% of repo).
- We pin to a specific upstream commit SHA per sync and record it (see `SOURCE.md`).

## Approach: Vendored-and-Regenerated Plugin

A standalone git repo, installable as a Claude Code plugin. Generated reference files are
**committed** so the skill works offline the instant it is installed. An `update` command
re-pulls upstream and regenerates those files.

### Repository Layout

```
zero-docs-skill/
├── .claude-plugin/plugin.json     # plugin manifest (name, version, description)
├── skills/zero-docs/
│   ├── SKILL.md                   # router — hand-authored, stable, rarely changes
│   ├── INDEX.md                   # AUTO-GENERATED topic index (title + 1-line desc + path)
│   └── references/                # AUTO-GENERATED from upstream MDX, mirrors contents/docs/
│       └── …                      # e.g. zql.md, schema.md, permissions.md, deploying.md
├── scripts/sync.mjs               # the updater (Node, no deps or minimal deps)
├── SOURCE.md                      # records upstream commit SHA + sync date (staleness signal)
├── package.json                   # npm run sync  /  npm run sync:check
├── .github/workflows/sync.yml     # weekly: regenerate, open PR if upstream drifted
├── .gitignore                     # ignores the temp clone dir
└── README.md
```

### Components & Responsibilities

1. **`scripts/sync.mjs` (the updater)** — the only moving part.
   - Shallow-clones `rocicorp/zero-docs` (`git clone --depth 1`) into a gitignored temp dir
     (e.g. `.vendor/zero-docs`). Re-runnable: removes/refreshes the temp dir each run.
   - Walks `contents/docs/**/*.mdx`.
   - Transforms each MDX file to plain Markdown:
     - Drop `import`/`export` lines and JSX-only wrapper noise.
     - Preserve frontmatter `title` / `description`.
     - Preserve all fenced code blocks verbatim (the highest-value content).
     - Map common custom components to markdown equivalents (callouts → blockquotes,
       tabbed code groups → sequential code blocks with headings). **Fidelity over
       cleverness:** anything exotic is passed through as-is rather than dropped.
   - Writes results to `skills/zero-docs/references/<mirrored path>.md`.
   - Regenerates `skills/zero-docs/INDEX.md` from collected frontmatter:
     `- [Title](references/<path>.md) — <description>` per doc, grouped by top-level section.
   - Stamps the resolved upstream commit SHA + ISO date into `SOURCE.md`.

2. **`scripts/sync.mjs --check` (CI mode)** — regenerates into a temp location and diffs
   against committed output. Non-zero exit if they differ. Used by the GitHub Action.

3. **`SKILL.md` (router, hand-authored)** — short and stable. Explains what Zero is, tells
   Claude to consult `INDEX.md` to locate the right topic, then grep/read `references/`.
   Notes the pinned SHA / how to refresh. This is the only file requiring human judgment,
   and it should rarely change.

4. **`.claude-plugin/plugin.json`** — plugin manifest so the repo installs as a Claude Code
   plugin exposing the `zero-docs` skill.

5. **`.github/workflows/sync.yml`** — weekly cron: run `npm run sync`, and if the working
   tree changed, open a PR titled with the new upstream SHA. Makes staying current free.

### Data Flow

```
rocicorp/zero-docs (MDX)
        │  git clone --depth 1   (sync.mjs)
        ▼
   .vendor/zero-docs/contents/docs/**/*.mdx   (gitignored, transient)
        │  transform (MDX → MD)
        ▼
   skills/zero-docs/references/**/*.md   ─┐
   skills/zero-docs/INDEX.md             ─┤ committed
   SOURCE.md (upstream SHA + date)       ─┘
        │  at query time
        ▼
   Claude reads INDEX.md → greps/reads references/ → grounded answer
```

### Error Handling & Edge Cases

- **Network/clone failure:** `sync.mjs` exits non-zero with a clear message; committed
  references remain untouched (skill still works on the last good snapshot).
- **Upstream restructures `contents/docs/`:** sync mirrors whatever exists; stale files from
  a previous layout are removed by clearing `references/` before regenerating.
- **MDX with unparseable custom components:** pass through raw rather than fail the whole file.
- **`--check` drift in CI:** surfaces as a failed job / opened PR, never silently ignored.

### Testing Strategy

- **Transform unit tests:** a handful of representative MDX fixtures (frontmatter, code
  blocks, a callout, a tab group, an exotic component) → assert expected markdown output.
- **End-to-end smoke:** run `sync.mjs` against the real upstream once; assert `references/`
  is non-empty, `INDEX.md` lists every generated file, and `SOURCE.md` has a SHA.
- **`--check` idempotence:** running sync twice with no upstream change produces no diff.

## Defaults (confirmed during brainstorming)

- Generated `references/` are **committed** (works offline on install).
- The **weekly auto-sync GitHub Action is included**.

## Open Questions

- None blocking. Component-mapping fidelity will be refined against real fixtures during
  implementation.
