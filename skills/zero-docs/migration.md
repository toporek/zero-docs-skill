# Zero Migration & Version Guardrail

Zero's API changed substantially over time. The mirrored docs in `references/`
describe the **latest** version. Before writing code, check the project's
installed version (`@rocicorp/zero` in package.json) and use this file to map
between what the docs say and what the installed version actually supports.

## Contents
- Removed/renamed APIs (the stop-list)
- Version-boundary table
- Silent-correctness traps

## Removed / renamed APIs — STOP if you are about to write these

| You're about to write… | Status | Use instead (current) | Removed/changed in |
|---|---|---|---|
| `definePermissions(schema, …)` / RLS `row.select/insert/update` | **Removed** | Plain TypeScript: filter reads by server `ctx` (deny = return a query matching no rows); check `ctx` in mutators and `throw` to deny writes | 0.25 |
| `z.mutate.table.insert/update/delete(…)` (CRUD mutators) | Legacy (gated) | `defineMutator` / `defineMutators`, invoked via `zero.mutate(mutators.x.y(args))` + a `ZERO_MUTATE_URL` push endpoint | unified 0.25; legacy behind `enableLegacyMutators` |
| Client `z.query.table.where(…)` expected to **sync new data** from the server | Legacy (gated) | `defineQuery` / `defineQueries` + a `ZERO_QUERY_URL` endpoint. Raw `zql.*` in `useQuery` is **local-only** — it never syncs new rows | unified 0.25; legacy behind `enableLegacyQueries` |
| `serverURL` config | Renamed | `cacheURL` | 0.25 |
| `auth: () => token` (function form) | Removed | `auth` is always a `string` | 0.25 |
| `onError` handler | Removed | Connection Status API (`zero.connection`) | 0.25 |
| `userID: 'anon'` for logged-out users | Deprecated | `userID: null` / `undefined` | 1.4 |

If a project sets `enableLegacyMutators`/`enableLegacyQueries: true`, it is
deliberately using the old APIs — match that, and flag that these escape hatches
are slated for removal.

## Version-boundary table

For a project pinned **below** a boundary, the current docs are wrong in that respect.

| Boundary | What changed | If installed version is below it |
|---|---|---|
| 0.18 | Custom mutators introduced | Only CRUD `z.mutate.table.*` mutators exist |
| 0.22 | TTL model: clock ticks only while Zero runs; `forever`/infinite TTLs removed, capped ≤10m | Old wall-clock / `forever` TTLs were valid |
| 0.23 | Synced queries introduced (`ZERO_QUERY_URL`); SolidJS requires `ZeroProvider` | No synced queries — client used ad-hoc `z.query.*`; reads governed by RLS permissions |
| **0.25** | Unification: `definePermissions`/RLS **removed**; mutators & queries APIs merged; `serverURL`→`cacheURL`; `.client`/`.server` promises always resolve | `definePermissions` **is** the permission system — do NOT recommend TS-only permissions; use `serverURL`; `auth` may be a function |
| 1.4 | `userID: 'anon'` deprecated | Use `'anon'` only here; newer code uses `null`/`undefined` |
| 1.5 | Authenticated client groups: `handleQueryRequest`/`handleMutateRequest` take a `userID` param | Endpoints don't pass `userID`; recommend upgrading for the client-group security fix |

When the installed version lags latest, also scan `references/release-notes/`
between the two versions for renames/removals, and consult `references/deprecated/`
only when the pinned version still has that API.

## Silent-correctness traps (not in `references/overview.md`)

- **Null comparisons:** `!=` and `= null` never match null rows; use `IS` / `IS NOT`. Passing `undefined` to `where` makes the query match nothing.
- **Immutable results:** ZQL re-returns the same cached object instances — never mutate a row from `useQuery`; clone first.
- **404 flicker:** only treat "not found" as real when `result.type === 'complete'`; while `unknown`, render loading. `run()` defaults to `{type: 'unknown'}` (local only); pass `{type: 'complete'}` to await the server.
- **Identity from `ctx`, never `args`:** query/mutator `args` are client-supplied and untrusted. Authorize with the server-derived `ctx` (e.g. `ctx.id`), never a `userID` passed in `args`.
- **Never generate IDs inside mutators:** they run multiple times (optimistic client + server), so an inside-generated ID diverges. Generate client-side (`uuidv7`/`nanoid`) and pass as an arg.
- **`defineQueries`/`defineMutators` once, at top level:** they compute the wire name (`posts.create`). Define sub-groups as plain objects and combine in a single top-level call.
- **`cmpLit` for literal-vs-literal:** `where('foo', 'bar')` treats `'foo'` as a column name; use `cmpLit(ctx.role, 'admin')` to compare two literals.
- **Register types once** via `declare module '@rocicorp/zero'` (`DefaultTypes`) so `useZero()` and bare `defineQuery`/`defineMutator` are typed without per-call generics.
