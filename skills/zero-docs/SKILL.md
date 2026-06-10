---
name: zero-docs
description: Use when writing, configuring, or debugging code that uses Rocicorp Zero (ZQL queries, Zero schema, permissions, mutators, zero-cache config, sync, auth, deployment/self-host). Provides the official Zero documentation locally for fast, accurate lookups instead of guessing APIs.
---

# Zero Docs

Local, version-pinned mirror of the official [Rocicorp Zero](https://zero.rocicorp.dev)
docs (TypeScript query-driven sync engine), plus a reasoning layer. Ground every
Zero answer in these files instead of recalling APIs from memory.

## Always start here

1. **Read `references/overview.md`** — upstream's curated mental-models + gotchas
   briefing. It applies to every Zero task.
2. **Check the installed version** — `@rocicorp/zero` in package.json. The docs
   in `references/` describe the latest version; older projects need different
   APIs. See `migration.md`.

## Version guardrail — STOP before writing a removed API

Zero's 0.25 release removed/renamed large parts of the API. If you are about to
write any of these, you are likely using training-memory APIs that no longer
exist — open `migration.md` and check the installed version first:

- `definePermissions(...)` / RLS `row.select/insert/update` rules
- `z.mutate.table.insert/update/delete(...)` (old CRUD mutators)
- a client `z.query.*` expected to **sync new data** from the server
- `serverURL` (now `cacheURL`), `auth: () => ...` (now a string), `onError` (now Connection Status API)

## Task → which docs to read

| Task | Read |
|---|---|
| Adding/changing a **write** | `references/mutators.md` + `references/schema.md` |
| Adding/changing a **read / sync** | `references/queries.md` + `references/zql.md` + `references/schema.md` |
| Writing **ZQL** filters/joins/ordering | `references/zql.md` (+ `references/schema.md`) |
| **Schema / relationships / migrations** | `references/schema.md` (+ `references/postgres-support.md`) |
| **Auth / permissions / login / `ctx`** | `references/auth.md` |
| **Server endpoints / db adapters** | `references/queries.md` + `references/mutators.md` + `references/server-zql.md` |
| **Config / env vars / cookies** | `references/zero-cache-config.md` + `references/connecting-to-postgres.md` |
| **Self-hosting / deploy** | `references/self-host.md` + `references/connecting-to-postgres.md` |
| **Framework wiring** (`ZeroProvider`, `useQuery`) | `references/react.md` / `references/solidjs.md` / `references/react-native.md` |
| **Connection / error / `needs-auth`** | `references/connection.md` |
| **Slow queries / debugging** | `references/debug/slow-queries.md`, `references/debug/inspector.md` |
| **Old project / version mismatch** | `migration.md` → `references/release-notes/` + `references/deprecated/` |

## Anything else

Open `INDEX.md` for the full topic list, or grep for a symbol:
`grep -ri "defineMutator" references/`.

## Provenance

`SOURCE.md` records the upstream commit and that page bodies come from
`zero.rocicorp.dev/docs/{slug}.md`. Changes newer than that sync may not be
reflected; for bleeding-edge questions, confirm against the live docs.
