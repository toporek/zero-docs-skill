# Rendered-Endpoint Sync + Publishing Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled MDX→Markdown transform with Rocicorp's build-rendered markdown endpoint (`zero.rocicorp.dev/docs/{slug}.md`), rewrite internal links to work locally, and make the repo legally and practically ready to publish on GitHub as a Claude Code plugin.

**Architecture:** The sync still shallow-clones `rocicorp/zero-docs` — but only to enumerate doc paths, read frontmatter (title/description for `INDEX.md`), and pin the upstream SHA. Page *bodies* are fetched from the rendered markdown endpoint, which already resolves `<CodeGroup>` tabs into labeled code blocks, `<ImageLightbox>` into absolute-URL images, and build-injected content. A post-fetch pass rewrites absolute `https://zero.rocicorp.dev/docs/...` links to relative local paths.

**Tech Stack:** Node 22 (built-in `fetch`, `node --test`), no dependencies. GitHub Actions.

**Verified facts (2026-06-10):**
- `https://zero.rocicorp.dev/docs/{relPath}.md` serves rendered markdown for every doc, including `deprecated/*` and `release-notes/index.md` (both `release-notes.md` and `release-notes/index.md` return 200). Unknown slugs return HTTP 404.
- Rendered output starts with `# <Title>`, has **no frontmatter**, uses **absolute** doc links (`https://zero.rocicorp.dev/docs/x#y`) and absolute image URLs.
- Upstream is Apache-2.0 (repo-wide `LICENSE`, no content carve-out).
- Claude Code: single-plugin repo installs via `/plugin marketplace add owner/repo` with only `.claude-plugin/plugin.json`; omitting `version` makes every commit a new version (users get weekly syncs); skills auto-discovered at `skills/<name>/SKILL.md`.

**File structure:**
- `scripts/lib/transform.mjs` — becomes "finalize fetched/rendered content": keeps `parseFrontmatter`, gains `finalizeDoc` + `rewriteDocLinks`; loses `stripEsm`, `transformNotes`, `stripJsxTags`, `transformMdx`.
- `scripts/lib/collect.mjs` — becomes metadata-only: `collectMeta(docsDir)` returns `[{path, title, description}]` from MDX frontmatter. No body transform.
- `scripts/sync.mjs` — orchestrates: clone → collectMeta → fetch bodies (concurrency 8, fail loudly) → finalize + rewrite links → write/check.
- `LICENSE`, README, `.claude-plugin/plugin.json`, `.github/workflows/ci.yml`, `skills/zero-docs/SKILL.md` — publishing readiness.
- `skills/zero-docs/references/**`, `INDEX.md`, `SOURCE.md` — regenerated.

---

### Task 1: `finalizeDoc` — normalize fetched page bodies

**Files:**
- Modify: `scripts/lib/transform.mjs`
- Test: `scripts/lib/transform.test.mjs`

- [ ] **Step 1: Write failing tests**

Append to `scripts/lib/transform.test.mjs`:

```js
describe('finalizeDoc', () => {
  it('normalizes CRLF, trims, ensures trailing newline', () => {
    assert.equal(finalizeDoc('# Hi\r\n\r\nBody\r\n\n\n', 'Hi'), '# Hi\n\nBody\n');
  });

  it('prepends a heading when the fetched body lacks one', () => {
    assert.equal(finalizeDoc('Just prose.', 'My Title'), '# My Title\n\nJust prose.\n');
  });

  it('keeps an existing heading without duplicating', () => {
    assert.equal(finalizeDoc('# Already Here\n\nBody', 'Other'), '# Already Here\n\nBody\n');
  });
});
```

(Use the same `import { describe, it } from 'node:test'` / `assert` style already in the file; add `finalizeDoc` to the import list.)

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — `finalizeDoc` is not exported.

- [ ] **Step 3: Implement `finalizeDoc`**

Add to `scripts/lib/transform.mjs`:

```js
/**
 * Normalize a page body fetched from the rendered-markdown endpoint:
 * CRLF → LF, trimmed, guaranteed to start with an H1 and end with one newline.
 */
export function finalizeDoc(fetched, title) {
  let out = fetched.replace(/\r\n/g, '\n').trim();
  if (!/^#\s/.test(out)) out = '# ' + title + '\n\n' + out;
  return out + '\n';
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test` — expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/transform.mjs scripts/lib/transform.test.mjs
git commit -m "feat: finalizeDoc normalizes rendered-endpoint page bodies"
```

### Task 2: `rewriteDocLinks` — make internal links work locally

**Files:**
- Modify: `scripts/lib/transform.mjs`
- Test: `scripts/lib/transform.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
describe('rewriteDocLinks', () => {
  const files = new Set(['schema.md', 'zql.md', 'debug/slow-queries.md', 'release-notes/index.md']);

  it('rewrites absolute doc links to sibling-relative paths', () => {
    assert.equal(
      rewriteDocLinks('See [schema](https://zero.rocicorp.dev/docs/schema#backfill).', 'zql.md', files),
      'See [schema](schema.md#backfill).',
    );
  });

  it('rewrites root-relative /docs/ links', () => {
    assert.equal(
      rewriteDocLinks('See [ZQL](/docs/zql).', 'schema.md', files),
      'See [ZQL](zql.md).',
    );
  });

  it('computes ../ paths from nested files and into directories', () => {
    assert.equal(
      rewriteDocLinks('[s](/docs/schema) [d](/docs/debug/slow-queries)', 'debug/slow-queries.md', files),
      '[s](../schema.md) [d](slow-queries.md)',
    );
  });

  it('maps directory slugs to index.md', () => {
    assert.equal(
      rewriteDocLinks('[rn](/docs/release-notes)', 'schema.md', files),
      '[rn](release-notes/index.md)',
    );
  });

  it('leaves unknown targets and non-doc links untouched', () => {
    const s = '[x](/docs/nope) [bugs](https://bugs.rocicorp.dev/issue/1) [p](https://zerosync.dev/#pricing)';
    assert.equal(rewriteDocLinks(s, 'schema.md', files), s);
  });

  it('does not touch lines inside code fences', () => {
    const s = 'pre [a](/docs/schema)\n```\nfetch("/docs/schema")\n[b](/docs/schema)\n```\npost';
    assert.equal(
      rewriteDocLinks(s, 'zql.md', files),
      'pre [a](schema.md)\n```\nfetch("/docs/schema")\n[b](/docs/schema)\n```\npost',
    );
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test` — expected: FAIL, `rewriteDocLinks` not exported.

- [ ] **Step 3: Implement**

Add to `scripts/lib/transform.mjs`:

```js
/**
 * Rewrite internal doc links (absolute https://zero.rocicorp.dev/docs/... or
 * root-relative /docs/...) to paths relative to `selfPath`, but only when the
 * target exists in `files` (a Set of POSIX-relative generated paths). Directory
 * slugs map to <slug>/index.md. Lines inside code fences are left untouched.
 */
export function rewriteDocLinks(body, selfPath, files) {
  const fromDir = selfPath.includes('/')
    ? selfPath.slice(0, selfPath.lastIndexOf('/')).split('/')
    : [];
  const relativeTo = (target) => {
    const to = target.split('/');
    let i = 0;
    while (i < fromDir.length && i < to.length - 1 && fromDir[i] === to[i]) i++;
    return [...Array(fromDir.length - i).fill('..'), ...to.slice(i)].join('/');
  };
  const linkRe = /\]\((?:https:\/\/zero\.rocicorp\.dev)?\/docs\/([A-Za-z0-9_/-]+?)(?:\.md)?(#[^)]*)?\)/g;
  let inFence = false;
  return body
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return line.replace(linkRe, (match, slug, anchor) => {
        const target = files.has(slug + '.md')
          ? slug + '.md'
          : files.has(slug + '/index.md')
            ? slug + '/index.md'
            : null;
        if (!target) return match;
        return '](' + relativeTo(target) + (anchor || '') + ')';
      });
    })
    .join('\n');
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test` — expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/transform.mjs scripts/lib/transform.test.mjs
git commit -m "feat: rewrite internal doc links to local relative paths"
```

### Task 3: Slim `collect.mjs` to metadata-only; delete the MDX transform

**Files:**
- Modify: `scripts/lib/collect.mjs`, `scripts/lib/transform.mjs`
- Test: `scripts/lib/collect.test.mjs`, `scripts/lib/transform.test.mjs`

- [ ] **Step 1: Rewrite `collect.test.mjs` for `collectMeta`**

Replace tests of `collectDocs` with (reuse the existing fixture-dir setup helpers in that file):

```js
describe('collectMeta', () => {
  it('returns frontmatter metadata per mdx file with .md paths', () => {
    // fixture: <tmp>/a.mdx with frontmatter title "A" description "da",
    //          <tmp>/sub/b.mdx with title "B" and no description
    const entries = collectMeta(tmpDir);
    assert.deepEqual(entries, [
      { path: 'a.md', title: 'A', description: 'da' },
      { path: 'sub/b.md', title: 'B', description: '' },
    ]);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test` — expected: FAIL, `collectMeta` not exported.

- [ ] **Step 3: Implement `collectMeta`; delete dead transform code**

`scripts/lib/collect.mjs` becomes:

```js
// scripts/lib/collect.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parseFrontmatter } from './transform.mjs';

/** Recursively collect absolute paths of *.mdx files under `dir`, sorted. */
export function findMdx(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...findMdx(full));
    else if (name.endsWith('.mdx')) out.push(full);
  }
  return out.sort();
}

/**
 * Read frontmatter metadata for every .mdx under `docsDir`.
 * Paths are POSIX-style relative to docsDir with `.mdx` rewritten to `.md`.
 * Bodies are NOT transformed here — they are fetched from the rendered
 * markdown endpoint by sync.mjs.
 */
export function collectMeta(docsDir) {
  const entries = [];
  for (const mdxPath of findMdx(docsDir)) {
    const relMd = relative(docsDir, mdxPath)
      .split(sep)
      .join('/')
      .replace(/\.mdx$/, '.md');
    const { data } = parseFrontmatter(readFileSync(mdxPath, 'utf8'));
    entries.push({
      path: relMd,
      title: data.title || 'Untitled',
      description: data.description || '',
    });
  }
  return entries;
}
```

In `scripts/lib/transform.mjs`: delete `stripEsm`, `transformNotes`, `stripJsxTags`, `transformMdx` (keep `parseFrontmatter`, `finalizeDoc`, `rewriteDocLinks`). In `scripts/lib/transform.test.mjs`: delete the test blocks for the removed functions.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test` — expected: PASS (only `parseFrontmatter`, `finalizeDoc`, `rewriteDocLinks`, `collectMeta`, index-gen tests remain).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib
git commit -m "refactor: metadata-only collect; drop MDX body transform"
```

### Task 4: Rewire `sync.mjs` to fetch rendered pages

**Files:**
- Modify: `scripts/sync.mjs`

- [ ] **Step 1: Replace the pipeline**

`scripts/sync.mjs` keeps `cloneUpstream`, `readExistingRefs`, and the check/write halves of `main`, but builds `files` like this (note `main` becomes async):

```js
import { collectMeta } from './lib/collect.mjs';
import { buildIndex } from './lib/index-gen.mjs';
import { finalizeDoc, rewriteDocLinks } from './lib/transform.mjs';

const SITE = 'https://zero.rocicorp.dev/docs/';

/** Fetch every entry's rendered markdown with bounded concurrency. */
async function fetchBodies(entries, concurrency = 8) {
  const bodies = new Map();
  const errors = [];
  const queue = [...entries];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (let e; (e = queue.shift()); ) {
        const url = SITE + e.path;
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          bodies.set(e.path, await res.text());
        } catch (err) {
          errors.push(url + ' — ' + (err.message || err));
        }
      }
    }),
  );
  if (errors.length) {
    throw new Error('Failed to fetch rendered docs:\n  ' + errors.join('\n  '));
  }
  return bodies;
}

async function main() {
  const sha = cloneUpstream();
  const entries = collectMeta(DOCS);
  const fileSet = new Set(entries.map((e) => e.path));
  const bodies = await fetchBodies(entries);
  const files = new Map();
  for (const e of entries) {
    files.set(e.path, rewriteDocLinks(finalizeDoc(bodies.get(e.path), e.title), e.path, fileSet));
  }
  const index = buildIndex(entries);
  // ...check mode and write mode exactly as before (drift diff / rm+write), minus the
  // `unknown` component warning, which no longer exists.
  writeFileSync(
    SOURCE,
    '# Source\n\nDoc list and metadata from ' + REPO + '\nUpstream commit: ' + sha +
      '\nPage bodies fetched from ' + SITE + '{path} (build-rendered markdown)\n',
  );
}

await main();
```

- [ ] **Step 2: Run the full sync against the real upstream**

Run: `npm run sync`
Expected: `Synced 74 docs from <sha>` (count may drift slightly with upstream), no fetch errors.

- [ ] **Step 3: Verify output quality (the bugs this rewrite kills)**

```bash
cd skills/zero-docs/references
# multi-line JSX leaks — expect no hits outside code fences:
grep -rn '<CodeGroup' . ; grep -rn '<ImageLightbox' .
# absolute doc links — expect 0 (all rewritten or genuinely external):
grep -rn '](/docs/' . | wc -l
# stray MDX comments — expect 0:
grep -rn '{/\*' .
# spot-check tab labels survived:
grep -n '\*\*React\*\*' connection.md
```

Then run `npm test` and `npm run sync:check` (expected: "Up to date with upstream <sha>") to confirm idempotence.

- [ ] **Step 4: Commit pipeline + regenerated content together**

```bash
git add scripts/sync.mjs skills/zero-docs SOURCE.md
git commit -m "feat: sync from rendered markdown endpoint; local link rewriting"
```

### Task 5: License & attribution

**Files:**
- Create: `LICENSE`
- Modify: `README.md`

- [ ] **Step 1: Add Apache-2.0 LICENSE**

```bash
curl -s https://raw.githubusercontent.com/rocicorp/zero-docs/main/LICENSE -o LICENSE
```

(Standard Apache-2.0 text; covers both the mirrored content and this repo's code.)

- [ ] **Step 2: Add attribution + disclaimer section to README**

Append:

```markdown
## License & attribution

Documentation content under `skills/zero-docs/references/` is © Rocicorp,
mirrored from [rocicorp/zero-docs](https://github.com/rocicorp/zero-docs) and
[zero.rocicorp.dev](https://zero.rocicorp.dev) under the
[Apache License 2.0](LICENSE), with mechanical modifications (fetched as
rendered markdown; internal links rewritten to local paths). The sync tooling
in this repo is also Apache-2.0.

This is an unofficial community project, not affiliated with or endorsed by
Rocicorp. "Zero" and "Rocicorp" are names of their respective owners.
```

- [ ] **Step 3: Commit**

```bash
git add LICENSE README.md
git commit -m "docs: Apache-2.0 license, Rocicorp attribution, non-affiliation disclaimer"
```

### Task 6: Plugin manifest for distribution

**Files:**
- Modify: `.claude-plugin/plugin.json`

- [ ] **Step 1: Replace manifest** (no `version` field — every commit becomes a new
  version so installed users receive weekly doc syncs; owner URL assumed
  `paweltopor`, confirm before publishing):

```json
{
  "name": "zero-docs",
  "description": "Local, auto-synced mirror of the Rocicorp Zero docs (ZQL, schema, mutators, permissions, zero-cache) so Claude answers from real docs instead of guessing.",
  "author": { "name": "Pawel Topor", "url": "https://github.com/paweltopor" },
  "homepage": "https://github.com/paweltopor/zero-docs-skill",
  "repository": "https://github.com/paweltopor/zero-docs-skill",
  "license": "Apache-2.0",
  "keywords": ["rocicorp-zero", "zero", "zql", "sync-engine", "documentation", "local-first"]
}
```

- [ ] **Step 2: Validate** — run `claude plugin validate .` (if the CLI subcommand is
  unavailable in this environment, note it and verify JSON with `node -e "JSON.parse(...)"`).

- [ ] **Step 3: Commit**

```bash
git add .claude-plugin/plugin.json
git commit -m "feat: distribution-ready plugin manifest (commit-versioned)"
```

### Task 7: README — install instructions & positioning

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite README top half**

Replace the intro, "Installing as a plugin", and the now-obsolete "Transform fidelity" sections with:

```markdown
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

\```
/plugin marketplace add paweltopor/zero-docs-skill
/plugin install zero-docs@zero-docs
\```

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
```

(unescape the fences; keep the existing "Updating" section; fix its `npm run sync:check` description if wording changed.)

- [ ] **Step 2: Add maintainer note about the sync Action**

Append under "Updating":

```markdown
> **Note (maintainers/forks):** the weekly sync workflow opens PRs via
> `peter-evans/create-pull-request`, which requires the repo setting
> **Settings → Actions → General → "Allow GitHub Actions to create and approve
> pull requests"** to be enabled.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: install instructions, positioning, sync-action setup note"
```

### Task 8: CI workflow for tests

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Add workflow** (tests only — `sync:check` is intentionally *not* run
  on PRs because upstream content drift would fail unrelated PRs; drift is handled
  by the weekly sync workflow):

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request: {}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm test
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run unit tests on push and PR"
```

### Task 9: SKILL.md version-awareness note (tested via retrieval scenario)

**Files:**
- Modify: `skills/zero-docs/SKILL.md`

- [ ] **Step 1: Baseline retrieval test (RED)** — dispatch a subagent with the
  current skill content and this scenario: *"Using only this skill's instructions
  and file tree, answer: a user's project uses @rocicorp/zero 0.17. How do you
  decide which mutator docs apply?"* Record whether it checks the installed
  version / release notes / deprecated dir unprompted.

- [ ] **Step 2: Add the section (GREEN)**

After "Common entry points" in `skills/zero-docs/SKILL.md`:

```markdown
## Version awareness

Zero's API evolves quickly. Check the project's installed version
(`@rocicorp/zero` in package.json) before answering:

- If it's older than the latest release notes in `references/release-notes/`,
  scan the notes between the two versions for renames/removals.
- `references/deprecated/` (CRUD mutators, ad-hoc queries, RLS permissions)
  describes APIs removed from current Zero — consult those docs only when the
  project is pinned to a version that still has them, and say so explicitly.
```

- [ ] **Step 3: Re-run the retrieval scenario with the updated skill** — expected:
  the agent now checks package.json version and routes to deprecated/release-notes
  appropriately. If not, tighten wording and re-test.

- [ ] **Step 4: Commit**

```bash
git add skills/zero-docs/SKILL.md
git commit -m "feat: version-awareness guidance in skill router"
```

### Task 10: Final verification

- [ ] Run `npm test` — all pass.
- [ ] Run `npm run sync:check` — "Up to date".
- [ ] `git log --oneline` shows one commit per task; working tree clean.
- [ ] Confirm with user: GitHub owner name for the URLs in plugin.json/README,
      `gh auth login`, then create the public repo and push (blocked on user).
