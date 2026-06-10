# Zero Docs Skill — Intelligence Layer Design

**Date:** 2026-06-10
**Status:** Approved
**Repo:** `~/Projects/zero-docs-skill`

## Goal

Turn the zero-docs skill from a passive doc mirror into an active intelligence
layer. The committed docs remain (for greppable cross-cutting search, offline
use, and version-matched answers), but the *value* becomes the reasoning in
SKILL.md plus two curated reference files.

Motivation: a deep review (three analysis subagents) found that a pure mirror is
dominated by fetching Rocicorp's live `llms.txt` / `llms-full.txt` / per-page
`.md` endpoints — it is staler and discards upstream's curated agent briefing.
The durable, defensible value is **version/churn intelligence**: live docs are
always "latest", which is actively wrong for a project pinning an older
`@rocicorp/zero`. Zero's 0.25 release (Oct 2025) removed/renamed large parts of
the API (`definePermissions` removed; CRUD + custom mutators unified into
`defineMutator`; ad-hoc + synced queries unified into `defineQuery`;
`serverURL`→`cacheURL`). An agent on training memory writes the dead API. No
live endpoint can route a pinned-version project correctly; a version-aware
skill can.

## Non-Goals

- No change to the sync pipeline that fetches the 74 rendered doc pages, the
  link rewriting, or the weekly Action — those work and stay.
- No full version-pinned multi-tag mirroring (considered and rejected as too
  heavy this round).
- No pivot to live-fetch.

## Three Additions (scaled by rot-risk)

### 1. Synced overview briefing — `references/overview.md` (zero-rot)

The upstream repo we already shallow-clone ships `lib/llms-base.md` (2.4KB): a
hand-curated "Key mental models + Warnings/common pitfalls" briefing authored by
Rocicorp specifically for AI agents. It is pure prose (no link list — the link
index is appended by their generator at build time, not present in the source
file), so it can be mirrored verbatim.

- During sync, read `<clone>/lib/llms-base.md` and write it to
  `references/overview.md` with a short generated header noting provenance.
- If the file is absent (upstream restructure), warn and skip — do NOT fail the
  whole sync (the 74 docs are the critical payload).
- Included in `--check` drift detection and `SOURCE.md` provenance.
- Because it is regenerated each sync, it never rots and always reflects
  upstream's current briefing.

### 2. Version & deprecation guardrail — `references/migration.md` (low-rot)

Hand-authored synthesized knowledge that no single upstream file contains and no
live endpoint provides. Append-only historical facts (past version boundaries
are immutable), so it does not rot; new major versions get reviewed when a sync
PR surfaces them.

Contents:
- **Version-boundary table**: for each boundary (0.18 custom mutators; 0.22 TTL
  model; 0.23 synced queries; **0.25 unification + `definePermissions` removed +
  `serverURL`→`cacheURL`**; 1.4 `userID:'anon'` deprecated; 1.5 authenticated
  client groups), what changed and what an agent on a version *below* the
  boundary must do differently.
- **Old→new rename/removal map**: `definePermissions`/RLS → plain-TS permissions
  in query/mutator functions; `z.mutate.table.insert/update/delete` →
  `defineMutator` (legacy gated behind `enableLegacyMutators`); client `z.query`
  sent to server → `defineQuery` + `ZERO_QUERY_URL`; `serverURL` → `cacheURL`;
  `auth: () => ...` → `auth` is always a string; `onError` → Connection Status
  API.
- **Silent-correctness traps not in upstream's briefing**: null needs `IS`/`IS
  NOT` (`!=`/`= null` never match; `undefined` in `where` matches nothing);
  treat `useQuery` results as immutable; 404 only on `result.type ===
  'complete'` (not on `unknown`); identity comes from server `ctx`, never client
  `args`; never generate IDs inside mutators (they run 2–3×); `defineQueries`/
  `defineMutators` called once at top level; `cmpLit` for literal-vs-literal.
- A top-of-file table of contents (file will exceed ~100 lines).

### 3. SKILL.md rewritten as a router (progressive disclosure)

Following Anthropic skill-authoring rules (short body = table of contents;
references one level deep; description = triggering only). Keep the existing
keyword-dense `description` unchanged (it already triggers well). New body
structure:

1. 2–3 line "what Zero is" summary.
2. **Read `references/overview.md` first** — the curated mental-models + gotchas
   briefing (stated as the first directive so it is reliably read).
3. **Version guardrail** — inline stop-list: "About to write `definePermissions`,
   `z.mutate.X.insert/update/delete`, a client `z.query` sent to the server,
   `serverURL`, or `auth: () => …`? STOP — check `@rocicorp/zero` in
   package.json; these may be removed/renamed APIs. See `references/migration.md`."
   Plus the existing "check installed version; gate `deprecated/` on it" rule.
4. **Task → docs routing table** ("adding/changing a write → `mutators.md` +
   `schema.md`"; "reads/sync → `queries.md` + `zql.md`"; "auth/permissions →
   `auth.md`"; etc.).
5. **Grep fallback** + pointer to `INDEX.md`.
6. **Provenance** line (SOURCE.md SHA/date; note that changes newer than the
   sync date may not be reflected).

## Architecture & Data Flow

```
rocicorp/zero-docs (clone)
   ├── contents/docs/**/*.mdx ──(meta)──> INDEX.md, slug list
   ├── lib/llms-base.md ───────(verbatim)─> references/overview.md   [NEW]
   └── (slugs) ──fetch /docs/{slug}.md──> references/**/*.md
SKILL.md (hand-authored router) ──directs──> overview.md, migration.md, references/
references/migration.md (hand-authored, committed, low-rot)          [NEW]
```

File placement (resolves the sync-wipe problem cleanly):
- `references/overview.md` — **generated**, lives in the `references/` tree that
  sync wipes and rewrites. Added to the `files` map so it participates in
  write + `--check` + drift, exactly like the 74 docs.
- `skills/zero-docs/migration.md` — **hand-authored**, placed as a *sibling of
  SKILL.md* (NOT under `references/`). Because sync only ever `rmSync`s the
  `references/` tree, a sibling file is never touched. No allowlist or
  preserve-logic needed. SKILL.md links to it as `migration.md` (one level deep,
  same directory) — consistent with Anthropic's "references one level deep" rule.

`sync.mjs` change is additive: after building `files`, also read `lib/llms-base.md`
from the clone and add `overview.md` to the `files` map.

## Edge Cases

- **`lib/llms-base.md` missing/moved:** warn, skip overview.md; sync still
  succeeds with the 74 docs (the critical payload).
- **`--check` for overview.md:** compares committed `references/overview.md`
  against freshly-read `lib/llms-base.md` (+header). Drift opens a PR like any
  other doc.
- **`migration.md` and sync are fully decoupled:** sync never reads, writes, or
  deletes it (it is outside `references/`).

## Testing Strategy

- **Unit:** `buildOverview(rawLlmsBase)` produces the expected `overview.md`
  body (header + verbatim content, trailing newline). Sync adds `overview.md` to
  `files` and preserves `migration.md` when wiping `references/`.
- **Skill retrieval (subagent RED/GREEN):**
  - Scenario A (version guardrail): "project pins `@rocicorp/zero@0.23`; add
    row-level read permissions." Baseline → writes `definePermissions` (removed
    API). With guardrail → checks version, routes to migration.md + release
    notes, uses the API valid for 0.23.
  - Scenario B (overview-first): "add a createComment write." With new SKILL.md
    → reads overview.md first, surfaces "don't generate IDs in mutators."
- **Idempotence:** `npm run sync` twice → no diff; `sync:check` clean.

## Defaults (confirmed)

- Direction: **mirror + intelligence** (user-selected over thin-live-fetch and
  version-pinning).
- Version guardrail lives inline in SKILL.md with the deep table in
  `migration.md` (user-confirmed).
