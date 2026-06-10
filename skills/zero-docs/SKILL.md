---
name: zero-docs
description: Use when writing, configuring, or debugging code that uses Rocicorp Zero (ZQL queries, Zero schema, permissions, mutators, zero-cache config, sync, auth, deployment/self-host). Provides the official Zero documentation locally for fast, accurate lookups instead of guessing APIs.
---

# Zero Docs

Local mirror of the official [Rocicorp Zero](https://zero.rocicorp.dev) documentation,
regenerated from https://github.com/rocicorp/zero-docs. Use it to ground any Zero
answer in the real docs rather than recalling APIs from memory.

## How to use this skill

1. Open `INDEX.md` (in this directory) to find the topic(s) relevant to the task.
   Topics are grouped: Guides, Debugging, Deprecated, Release Notes.
2. Read the matching file(s) under `references/`. Each mirrors one upstream doc
   (e.g. `references/zql.md`, `references/schema.md`, `references/zero-cache-config.md`).
3. When you need something not obviously in the index, grep `references/` for the
   symbol or term, e.g. `grep -ri "relationships(" references/`.

## Common entry points

- **Queries / ZQL:** `references/zql.md`, `references/queries.md`, `references/server-zql.md`
- **Schema & relationships:** `references/schema.md`
- **Writes:** `references/mutators.md`
- **Auth & permissions:** `references/auth.md`
- **Config & hosting:** `references/zero-cache-config.md`, `references/self-host.md`, `references/connecting-to-postgres.md`
- **Framework bindings:** `references/react.md`, `references/solidjs.md`, `references/react-native.md`
- **Getting started:** `references/quickstart.md`, `references/install.md`, `references/tutorial.md`

## Version awareness

Zero's API evolves quickly. Check the project's installed version
(`@rocicorp/zero` in package.json) before answering:

- If it's older than the latest release notes in `references/release-notes/`,
  scan the notes between the two versions for renames/removals.
- `references/deprecated/` (CRUD mutators, ad-hoc queries, RLS permissions)
  describes APIs removed from current Zero — consult those docs only when the
  project is pinned to a version that still has them, and say so explicitly.

## Staleness

`SOURCE.md` (repo root) records the upstream commit this mirror was generated from.
To refresh: run `npm run sync` in the plugin repo. The weekly GitHub Action opens a
PR automatically when upstream changes.
