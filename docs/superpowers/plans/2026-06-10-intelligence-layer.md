# Zero Docs Intelligence Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the zero-docs skill into an intelligence layer: sync upstream's curated agent briefing into `references/overview.md`, add a hand-authored version/deprecation guardrail (`migration.md`), and rewrite SKILL.md as a task-routing router.

**Architecture:** Additive to the existing rendered-endpoint sync. A new transform `buildOverview` wraps the verbatim `lib/llms-base.md` from the clone; `sync.mjs` adds it to the generated `files` map. `migration.md` is hand-authored as a sibling of SKILL.md (outside the `references/` tree sync wipes), so sync never touches it. SKILL.md is rewritten by hand.

**Tech Stack:** Node 22 (`node --test`), no dependencies.

**Reference:** spec at `docs/superpowers/specs/2026-06-10-intelligence-layer-design.md`.

---

### Task 1: `buildOverview` transform

**Files:**
- Modify: `scripts/lib/transform.mjs`
- Test: `scripts/lib/transform.test.mjs`

- [ ] **Step 1: Write failing tests**

Append to `scripts/lib/transform.test.mjs` (add `buildOverview` to the import on line 4):

```js
test('buildOverview prepends a provenance header and keeps content verbatim', () => {
  const raw = 'Zero is a sync engine.\n\n## Key mental models\n\n- foo\n';
  const out = buildOverview(raw);
  assert.match(out, /^# Zero — Mental Models & Gotchas\n/);
  assert.match(out, /upstream `lib\/llms-base\.md`/);
  assert.match(out, /Zero is a sync engine\./);
  assert.match(out, /## Key mental models/);
  assert.ok(out.endsWith('\n'));
});

test('buildOverview normalizes CRLF and trailing whitespace', () => {
  assert.ok(buildOverview('a\r\nb\r\n\n\n').endsWith('a\nb\n'));
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — `buildOverview` is not exported.

- [ ] **Step 3: Implement**

Add to `scripts/lib/transform.mjs`:

```js
/**
 * Wrap upstream's curated agent briefing (lib/llms-base.md) as a reference doc.
 * Content is kept verbatim; only a provenance header is prepended.
 */
export function buildOverview(rawLlmsBase) {
  const body = rawLlmsBase.replace(/\r\n/g, '\n').trimEnd();
  return (
    '# Zero — Mental Models & Gotchas\n\n' +
    '> Curated agent briefing, mirrored verbatim from upstream `lib/llms-base.md`.\n' +
    '> Read this before answering any Zero question.\n\n' +
    body +
    '\n'
  );
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test` — expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/transform.mjs scripts/lib/transform.test.mjs
git commit -m "feat: buildOverview wraps upstream curated agent briefing"
```

### Task 2: Wire `overview.md` into sync

**Files:**
- Modify: `scripts/sync.mjs`

- [ ] **Step 1: Import and read the briefing**

In `scripts/sync.mjs`, add `buildOverview` to the transform import:

```js
import { finalizeDoc, rewriteDocLinks, buildOverview } from './lib/transform.mjs';
```

Add a constant near the other path constants (after `const DOCS = ...`):

```js
const LLMS_BASE = join(VENDOR, 'lib', 'llms-base.md');
```

- [ ] **Step 2: Add overview.md to the generated files map**

In `main()`, immediately after the `for (const e of entries) { files.set(...) }` loop that builds `files`, insert:

```js
  if (existsSync(LLMS_BASE)) {
    files.set('overview.md', buildOverview(readFileSync(LLMS_BASE, 'utf8')));
  } else {
    console.warn('Note: lib/llms-base.md not found upstream; skipping overview.md');
  }
```

(`overview.md` now flows through the existing write loop, `--check` drift diff, and gets written under `references/overview.md`. No other sync changes needed — `migration.md` is a sibling of SKILL.md, outside `REFS`, so the `rmSync(REFS)` never touches it.)

- [ ] **Step 3: Run the sync**

Run: `npm run sync`
Expected: `Synced 75 docs from <sha>` (74 + overview.md), no warning about llms-base.

- [ ] **Step 4: Verify the file landed**

```bash
head -6 skills/zero-docs/references/overview.md
```
Expected: the `# Zero — Mental Models & Gotchas` header + provenance blockquote, then the briefing.

Then `npm run sync:check` — expected: "Up to date with upstream <sha>".

- [ ] **Step 5: Commit**

```bash
git add scripts/sync.mjs skills/zero-docs/references/overview.md SOURCE.md
git commit -m "feat: sync upstream agent briefing into references/overview.md"
```

### Task 3: Hand-author `migration.md`

**Files:**
- Create: `skills/zero-docs/migration.md`

- [ ] **Step 1: Baseline retrieval scenario (RED)**

Dispatch a subagent with ONLY the current SKILL.md content (no migration.md) and this prompt: *"A project's package.json shows `@rocicorp/zero: 0.23.0`. The user asks: add row-level read permissions so users only see their own rows. Following only the skill, what API do you use?"* Record whether it reaches for `definePermissions` (the API removed in 0.25) or correctly identifies that 0.23 predates the removal. Save the verbatim answer as the baseline.

- [ ] **Step 2: Create `skills/zero-docs/migration.md`**

```markdown
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
```

- [ ] **Step 3: Verify retrieval (GREEN)**

Dispatch a subagent with the NEW SKILL.md (from Task 4) + this migration.md and the same prompt as Step 1. Expected: it checks the 0.23 version, recognizes 0.25 removed `definePermissions`, concludes 0.23 still has it, and uses it (or routes to release notes). If it still gets it wrong, tighten the stop-list wording and re-test.

> Note: Step 3 depends on Task 4's SKILL.md. When running subagent-driven, do Task 4 before this verification step, or verify with both files together.

- [ ] **Step 4: Commit**

```bash
git add skills/zero-docs/migration.md
git commit -m "feat: version/deprecation guardrail (migration.md)"
```

### Task 4: Rewrite SKILL.md as a router

**Files:**
- Modify: `skills/zero-docs/SKILL.md`

- [ ] **Step 1: Baseline scenario (RED)**

Dispatch a subagent with the CURRENT SKILL.md and: *"Add a createComment write to this Zero app."* Record whether it reads any overview/gotchas before coding (baseline: it routes only to mutators.md, never sees "don't generate IDs in mutators").

- [ ] **Step 2: Replace SKILL.md body** (keep the existing frontmatter `name`/`description` unchanged; replace everything below it)

````markdown
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
````

- [ ] **Step 3: Verify (GREEN)**

Dispatch a subagent with the new SKILL.md (+ note that overview.md exists and contains "don't generate IDs inside mutators") and the same createComment prompt. Expected: it reads overview.md first and surfaces the ID-generation and immutability gotchas before writing. Also run Task 3 Step 3's version scenario against this SKILL.md + migration.md.

- [ ] **Step 4: Commit**

```bash
git add skills/zero-docs/SKILL.md
git commit -m "feat: rewrite SKILL.md as overview-first task router"
```

### Task 5: Final verification

- [ ] **Step 1: Full regen + idempotence**

```bash
npm test                 # all pass
npm run sync             # "Synced 75 docs from <sha>"
npm run sync:check       # "Up to date with upstream <sha>"
```

- [ ] **Step 2: Confirm structure**

```bash
ls skills/zero-docs/migration.md skills/zero-docs/references/overview.md   # both exist
grep -c 'references/' skills/zero-docs/SKILL.md                            # routing table present
git status --porcelain                                                     # clean after commits
```

- [ ] **Step 3: Plugin still validates**

Run: `claude plugin validate .`
Expected: "Validation passed with warnings" (the no-version warning is intentional).

- [ ] **Step 4: Commit the plan**

```bash
git add docs/superpowers/plans/2026-06-10-intelligence-layer.md
git commit -m "docs: plan for zero-docs intelligence layer"
```
