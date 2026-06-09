# Zero Docs Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, installable Claude Code plugin that mirrors the Rocicorp Zero docs into committed, grep-friendly Markdown, regenerated from upstream with one command.

**Architecture:** A Node (ESM, zero runtime deps) sync script shallow-clones `rocicorp/zero-docs`, transforms `contents/docs/**/*.mdx` into plain Markdown under `skills/zero-docs/references/`, generates `INDEX.md`, and stamps the upstream SHA into `SOURCE.md`. A hand-authored `SKILL.md` router tells Claude to consult the index then grep the references. A `--check` mode + weekly GitHub Action keep it current.

**Tech Stack:** Node.js ≥18 (built-in `node:test`, `node:fs`, `node:child_process`), git, GitHub Actions. No third-party runtime dependencies.

---

## File Structure

```
zero-docs-skill/
├── .claude-plugin/plugin.json     # Plugin manifest
├── package.json                   # scripts: sync, sync:check, test (ESM, no deps)
├── .gitignore                     # ignores .vendor/
├── README.md                      # what it is + how to update
├── SOURCE.md                      # AUTO-GENERATED: upstream SHA
├── scripts/
│   ├── sync.mjs                   # IO orchestrator: clone → collect → write / --check
│   └── lib/
│       ├── transform.mjs          # pure: MDX string → {title, description, body}
│       ├── transform.test.mjs
│       ├── index-gen.mjs          # pure: entries[] → INDEX.md markdown
│       ├── index-gen.test.mjs
│       ├── collect.mjs            # fs walk of docs dir → {files, entries} (uses transform)
│       └── collect.test.mjs       # runs against a local fixture tree (no network)
├── skills/zero-docs/
│   ├── SKILL.md                   # router (hand-authored)
│   ├── INDEX.md                   # AUTO-GENERATED
│   └── references/                # AUTO-GENERATED *.md mirror of contents/docs
└── .github/workflows/sync.yml     # weekly regenerate + open PR on drift
```

**Module boundaries (each independently testable):**
- `transform.mjs` — pure string→object, no fs. The fidelity-sensitive logic; most tests live here.
- `index-gen.mjs` — pure array→string.
- `collect.mjs` — the only fs-reading pure module; tested against a checked-in fixture dir.
- `sync.mjs` — thin IO/network shell (git clone, write files, `--check` diff). Not unit-tested; covered by a manual e2e smoke in the final task.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "zero-docs-skill",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Searchable Rocicorp Zero documentation as a Claude Code skill.",
  "scripts": {
    "sync": "node scripts/sync.mjs",
    "sync:check": "node scripts/sync.mjs --check",
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```gitignore
.vendor/
node_modules/
.DS_Store
```

- [ ] **Step 3: Verify the test runner is wired (no tests yet → exits 0)**

Run: `npm test`
Expected: exits 0 with "tests 0" (Node prints a TAP summary with 0 tests).

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: scaffold zero-docs-skill project"
```

---

## Task 2: Frontmatter + ESM stripping in transform.mjs

**Files:**
- Create: `scripts/lib/transform.mjs`
- Test: `scripts/lib/transform.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
// scripts/lib/transform.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, stripEsm } from './transform.mjs';

test('parseFrontmatter extracts title and description', () => {
  const raw = '---\ntitle: ZQL\ndescription: Zero Query Language\n---\nBody here\n';
  const { data, body } = parseFrontmatter(raw);
  assert.equal(data.title, 'ZQL');
  assert.equal(data.description, 'Zero Query Language');
  assert.equal(body, 'Body here\n');
});

test('parseFrontmatter strips surrounding quotes from values', () => {
  const raw = '---\ntitle: "Zero Cache Config"\n---\nx';
  assert.equal(parseFrontmatter(raw).data.title, 'Zero Cache Config');
});

test('parseFrontmatter returns empty data when no frontmatter', () => {
  const { data, body } = parseFrontmatter('# Hello\n');
  assert.deepEqual(data, {});
  assert.equal(body, '# Hello\n');
});

test('stripEsm removes import and export statement lines', () => {
  const body = "import Foo from './Foo';\nexport const x = 1;\nReal content\n";
  assert.equal(stripEsm(body), 'Real content');
});

test('stripEsm keeps prose that starts with the word import', () => {
  const body = 'import maps are great\n';
  assert.equal(stripEsm(body), 'import maps are great');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/lib/transform.test.mjs`
Expected: FAIL — "Cannot find module './transform.mjs'" / functions not exported.

- [ ] **Step 3: Create `scripts/lib/transform.mjs` with these two functions**

```js
// scripts/lib/transform.mjs

/**
 * Parse a leading YAML-ish frontmatter block (--- ... ---).
 * Only simple `key: value` lines are read. Returns { data, body }.
 */
export function parseFrontmatter(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { data: {}, body: raw };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([\w-]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[m[1]] = value;
  }
  return { data, body: raw.slice(match[0].length) };
}

/** Remove MDX `import ... from ...`, side-effect imports, and `export ...` lines. */
export function stripEsm(body) {
  return body
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/^\s*import\b.*\bfrom\b.*$/.test(line) &&
        !/^\s*import\s+['"].*['"];?\s*$/.test(line) &&
        !/^\s*export\s+(default\b|const\b|function\b|let\b|var\b|\{)/.test(line),
    )
    .join('\n')
    .trim();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/lib/transform.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/transform.mjs scripts/lib/transform.test.mjs
git commit -m "feat: frontmatter parsing and ESM stripping for MDX transform"
```

---

## Task 3: Note blocks + JSX tag stripping + top-level transform

**Files:**
- Modify: `scripts/lib/transform.mjs`
- Modify: `scripts/lib/transform.test.mjs`

- [ ] **Step 1: Append failing tests**

```js
// add to scripts/lib/transform.test.mjs
import { transformNotes, stripJsxTags, transformMdx } from './transform.mjs';

test('transformNotes converts <Note heading> to a blockquote', () => {
  const body =
    '<Note type="warning" heading="Watch out">\nBe careful here.\n</Note>';
  const out = transformNotes(body);
  assert.equal(out, '> **Watch out**\n>\n> Be careful here.');
});

test('transformNotes falls back to "Note" when no heading attribute', () => {
  const out = transformNotes('<Note type="note">\nHi\n</Note>');
  assert.equal(out, '> **Note**\n>\n> Hi');
});

test('stripJsxTags drops lone capitalized component tags, keeps content', () => {
  const collected = [];
  const out = stripJsxTags('<Tabs>\nkeep me\n</Tabs>', (n) => collected.push(n));
  assert.equal(out, 'keep me');
  assert.deepEqual(collected, ['Tabs', 'Tabs']);
});

test('stripJsxTags leaves lowercase html-ish lines and prose alone', () => {
  const out = stripJsxTags('<div>\nplain text\n');
  assert.equal(out, '<div>\nplain text');
});

test('transformMdx end-to-end produces titled markdown', () => {
  const raw =
    '---\ntitle: ZQL\ndescription: Zero Query Language\n---\n' +
    "import X from './x';\n\n" +
    'Use `where()` to filter.\n\n' +
    '<Note heading="Immutability">\nClone before mutating.\n</Note>\n';
  const { title, description, body } = transformMdx(raw);
  assert.equal(title, 'ZQL');
  assert.equal(description, 'Zero Query Language');
  assert.match(body, /^# ZQL\n/);
  assert.match(body, /Use `where\(\)` to filter\./);
  assert.match(body, /> \*\*Immutability\*\*/);
  assert.doesNotMatch(body, /import X/);
  assert.ok(body.endsWith('\n'));
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test scripts/lib/transform.test.mjs`
Expected: FAIL — `transformNotes` / `stripJsxTags` / `transformMdx` not exported.

- [ ] **Step 3: Append implementations to `scripts/lib/transform.mjs`**

```js
/**
 * Convert <Note ...>...</Note> blocks into markdown blockquotes.
 * The `heading` attribute (if present) becomes a bold first line.
 */
export function transformNotes(body) {
  return body.replace(
    /<Note\b([^>]*)>([\s\S]*?)<\/Note>/g,
    (_, attrs, inner) => {
      const headingMatch = /heading="([^"]*)"/.exec(attrs);
      const heading = headingMatch ? headingMatch[1] : 'Note';
      const contentLines = inner.trim().split(/\r?\n/);
      return ['**' + heading + '**', '', ...contentLines]
        .map((l) => (l ? '> ' + l : '>'))
        .join('\n');
    },
  );
}

/**
 * Drop lines that are nothing but a capitalized JSX component open/close tag,
 * preserving inner content. Calls onUnknown(name) for each stripped tag so the
 * caller can log components that may need richer handling.
 */
export function stripJsxTags(body, onUnknown = () => {}) {
  return body
    .split(/\r?\n/)
    .filter((line) => {
      const m = /^\s*<\/?([A-Z][A-Za-z0-9]*)\b[^>]*>\s*$/.exec(line);
      if (m) {
        onUnknown(m[1]);
        return false;
      }
      return true;
    })
    .join('\n')
    .trim();
}

/**
 * Full MDX → Markdown transform.
 * Returns { title, description, body } where body is a complete markdown
 * document beginning with an `# <title>` heading and ending in a newline.
 */
export function transformMdx(raw, onUnknown = () => {}) {
  const { data, body } = parseFrontmatter(raw);
  let out = stripEsm(body);
  out = transformNotes(out);
  out = stripJsxTags(out, onUnknown);
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  const title = data.title || 'Untitled';
  if (!/^#\s/.test(out)) out = '# ' + title + '\n\n' + out;
  return { title, description: data.description || '', body: out + '\n' };
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `node --test scripts/lib/transform.test.mjs`
Expected: PASS (10 tests total).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/transform.mjs scripts/lib/transform.test.mjs
git commit -m "feat: Note blockquotes, JSX stripping, full MDX transform"
```

---

## Task 4: Index generation

**Files:**
- Create: `scripts/lib/index-gen.mjs`
- Test: `scripts/lib/index-gen.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
// scripts/lib/index-gen.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex } from './index-gen.mjs';

test('buildIndex groups root docs under Guides and links into references/', () => {
  const out = buildIndex([
    { path: 'zql.md', title: 'ZQL', description: 'Zero Query Language' },
    { path: 'schema.md', title: 'Schema', description: '' },
  ]);
  assert.match(out, /## Guides/);
  assert.match(out, /- \[ZQL\]\(references\/zql\.md\) — Zero Query Language/);
  // No em-dash when description is empty:
  assert.match(out, /- \[Schema\]\(references\/schema\.md\)\n/);
});

test('buildIndex sorts subdirectories into labeled groups', () => {
  const out = buildIndex([
    { path: 'release-notes/0-21.md', title: '0.21', description: '' },
    { path: 'debug/slow-queries.md', title: 'Slow Queries', description: 'x' },
    { path: 'intro.md', title: 'Intro', description: '' },
  ]);
  // Guides group appears before Debugging, which appears before Release Notes.
  assert.ok(out.indexOf('## Guides') < out.indexOf('## Debugging'));
  assert.ok(out.indexOf('## Debugging') < out.indexOf('## Release Notes'));
});

test('buildIndex ends with a single trailing newline', () => {
  const out = buildIndex([{ path: 'a.md', title: 'A', description: '' }]);
  assert.ok(out.endsWith('\n'));
  assert.ok(!out.endsWith('\n\n'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/lib/index-gen.test.mjs`
Expected: FAIL — "Cannot find module './index-gen.mjs'".

- [ ] **Step 3: Create `scripts/lib/index-gen.mjs`**

```js
// scripts/lib/index-gen.mjs

const GROUP_LABELS = {
  '': 'Guides',
  debug: 'Debugging',
  deprecated: 'Deprecated',
  'release-notes': 'Release Notes',
};

const GROUP_ORDER = ['', 'debug', 'deprecated', 'release-notes'];

/**
 * Build INDEX.md from doc entries.
 * @param {Array<{path:string,title:string,description:string}>} entries
 *   `path` is relative to references/, e.g. "zql.md" or "debug/queries.md".
 * @returns {string} markdown index ending in a single newline.
 */
export function buildIndex(entries) {
  const groups = new Map();
  for (const e of entries) {
    const slash = e.path.indexOf('/');
    const group = slash === -1 ? '' : e.path.slice(0, slash);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(e);
  }

  const rank = (g) => {
    const i = GROUP_ORDER.indexOf(g);
    return i === -1 ? GROUP_ORDER.length + 1 : i;
  };
  const keys = [...groups.keys()].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b),
  );

  const lines = ['# Zero Docs Index', ''];
  for (const key of keys) {
    lines.push('## ' + (GROUP_LABELS[key] || key), '');
    const items = groups.get(key).sort((a, b) => a.path.localeCompare(b.path));
    for (const e of items) {
      const desc = e.description ? ' — ' + e.description : '';
      lines.push('- [' + e.title + '](references/' + e.path + ')' + desc);
    }
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/lib/index-gen.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/index-gen.mjs scripts/lib/index-gen.test.mjs
git commit -m "feat: INDEX.md generation grouped by section"
```

---

## Task 5: Doc collection over a directory tree

**Files:**
- Create: `scripts/lib/collect.mjs`
- Test: `scripts/lib/collect.test.mjs`

- [ ] **Step 1: Write failing tests (build a fixture tree in a temp dir)**

```js
// scripts/lib/collect.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectDocs } from './collect.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'zds-'));
  writeFileSync(
    join(root, 'zql.mdx'),
    '---\ntitle: ZQL\ndescription: Query language\n---\nUse where().\n',
  );
  mkdirSync(join(root, 'debug'));
  writeFileSync(
    join(root, 'debug', 'slow.mdx'),
    '---\ntitle: Slow Queries\n---\nProfile it.\n',
  );
  writeFileSync(join(root, 'ignore.txt'), 'not mdx');
  return root;
}

test('collectDocs transforms every .mdx and mirrors paths to .md', () => {
  const { files, entries } = collectDocs(fixture());
  assert.deepEqual([...files.keys()].sort(), ['debug/slow.md', 'zql.md']);
  assert.match(files.get('zql.md'), /^# ZQL\n/);
  assert.match(files.get('debug/slow.md'), /Profile it\./);
});

test('collectDocs returns index entries with title and description', () => {
  const { entries } = collectDocs(fixture());
  const zql = entries.find((e) => e.path === 'zql.md');
  assert.equal(zql.title, 'ZQL');
  assert.equal(zql.description, 'Query language');
});

test('collectDocs ignores non-mdx files', () => {
  const { files } = collectDocs(fixture());
  assert.ok(![...files.keys()].some((k) => k.includes('ignore')));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/lib/collect.test.mjs`
Expected: FAIL — "Cannot find module './collect.mjs'".

- [ ] **Step 3: Create `scripts/lib/collect.mjs`**

```js
// scripts/lib/collect.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { transformMdx } from './transform.mjs';

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
 * Transform every .mdx under `docsDir`.
 * @returns {{ files: Map<string,string>, entries: Array<{path,title,description}>, unknown: Set<string> }}
 *   `files` keys and `entries[].path` are POSIX-style paths relative to docsDir
 *   with `.mdx` rewritten to `.md`.
 */
export function collectDocs(docsDir) {
  const files = new Map();
  const entries = [];
  const unknown = new Set();
  for (const mdxPath of findMdx(docsDir)) {
    const relMd = relative(docsDir, mdxPath)
      .split(sep)
      .join('/')
      .replace(/\.mdx$/, '.md');
    const { title, description, body } = transformMdx(
      readFileSync(mdxPath, 'utf8'),
      (name) => unknown.add(name),
    );
    files.set(relMd, body);
    entries.push({ path: relMd, title, description });
  }
  return { files, entries, unknown };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/lib/collect.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — 16 tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/collect.mjs scripts/lib/collect.test.mjs
git commit -m "feat: collect and transform docs from a directory tree"
```

---

## Task 6: Sync orchestrator (clone, write, --check)

**Files:**
- Create: `scripts/sync.mjs`

This module does network/fs IO (git clone, file writes) and is exercised by the
manual e2e smoke in Task 9 rather than unit tests.

- [ ] **Step 1: Create `scripts/sync.mjs`**

```js
// scripts/sync.mjs
import { execFileSync } from 'node:child_process';
import {
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectDocs } from './lib/collect.mjs';
import { buildIndex } from './lib/index-gen.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(ROOT, '.vendor', 'zero-docs');
const DOCS = join(VENDOR, 'contents', 'docs');
const SKILL = join(ROOT, 'skills', 'zero-docs');
const REFS = join(SKILL, 'references');
const INDEX = join(SKILL, 'INDEX.md');
const SOURCE = join(ROOT, 'SOURCE.md');
const REPO = 'https://github.com/rocicorp/zero-docs';

const checkMode = process.argv.includes('--check');

function cloneUpstream() {
  rmSync(VENDOR, { recursive: true, force: true });
  mkdirSync(dirname(VENDOR), { recursive: true });
  execFileSync('git', ['clone', '--depth', '1', REPO, VENDOR], {
    stdio: 'inherit',
  });
  return execFileSync('git', ['-C', VENDOR, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
}

/** Read currently committed references/ into a Map<relPath, content>. */
function readExistingRefs() {
  const out = new Map();
  if (!existsSync(REFS)) return out;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.set(relative(REFS, full).split(sep).join('/'), readFileSync(full, 'utf8'));
    }
  };
  walk(REFS);
  return out;
}

function main() {
  const sha = cloneUpstream();
  const { files, entries, unknown } = collectDocs(DOCS);
  const index = buildIndex(entries);

  if (unknown.size) {
    console.warn('Note: stripped unrecognized components: ' + [...unknown].sort().join(', '));
  }

  if (checkMode) {
    const existing = readExistingRefs();
    const drift = [];
    for (const [p, c] of files) if (existing.get(p) !== c) drift.push(p);
    for (const p of existing.keys()) if (!files.has(p)) drift.push('(removed) ' + p);
    const indexDrift = !existsSync(INDEX) || readFileSync(INDEX, 'utf8') !== index;
    if (indexDrift) drift.push('INDEX.md');
    if (drift.length) {
      console.error('Drift vs upstream ' + sha + ':\n' + drift.map((d) => '  ' + d).join('\n'));
      process.exit(1);
    }
    console.log('Up to date with upstream ' + sha);
    return;
  }

  rmSync(REFS, { recursive: true, force: true });
  for (const [p, content] of files) {
    const dest = join(REFS, p);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content);
  }
  writeFileSync(INDEX, index);
  writeFileSync(
    SOURCE,
    '# Source\n\nGenerated from ' + REPO + '\nUpstream commit: ' + sha + '\n',
  );
  console.log('Synced ' + files.size + ' docs from ' + sha);
}

main();
```

- [ ] **Step 2: Commit (real run happens in Task 9 after the skill files exist)**

```bash
git add scripts/sync.mjs
git commit -m "feat: sync orchestrator with clone, write, and --check modes"
```

---

## Task 7: Plugin manifest and SKILL.md router

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `skills/zero-docs/SKILL.md`

- [ ] **Step 1: Create `.claude-plugin/plugin.json`**

```json
{
  "name": "zero-docs",
  "version": "0.1.0",
  "description": "Searchable Rocicorp Zero documentation as a Claude Code skill."
}
```

- [ ] **Step 2: Create `skills/zero-docs/SKILL.md`**

```markdown
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
   (e.g. `references/zql.md`, `references/schema.md`, `references/permissions` content
   inside `references/auth.md`, `references/zero-cache-config.md`).
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

## Staleness

`SOURCE.md` (repo root) records the upstream commit this mirror was generated from.
To refresh: run `npm run sync` in the plugin repo. The weekly GitHub Action opens a
PR automatically when upstream changes.
```

> Note: the exact `references/` filenames are generated in Task 9; the entry-point list above reflects the current upstream `contents/docs` layout and should be adjusted if Task 9's output differs.

- [ ] **Step 3: Commit**

```bash
git add .claude-plugin/plugin.json skills/zero-docs/SKILL.md
git commit -m "feat: plugin manifest and zero-docs skill router"
```

---

## Task 8: GitHub Action for weekly auto-sync

**Files:**
- Create: `.github/workflows/sync.yml`

- [ ] **Step 1: Create `.github/workflows/sync.yml`**

```yaml
name: Sync Zero docs

on:
  schedule:
    - cron: '0 6 * * 1' # Mondays 06:00 UTC
  workflow_dispatch: {}

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Run tests
        run: npm test
      - name: Regenerate from upstream
        run: npm run sync
      - name: Open PR on changes
        uses: peter-evans/create-pull-request@v6
        with:
          commit-message: 'chore: sync Zero docs from upstream'
          title: 'chore: sync Zero docs from upstream'
          body: |
            Automated regeneration of `references/` and `INDEX.md` from
            https://github.com/rocicorp/zero-docs. See `SOURCE.md` for the new commit.
          branch: auto/sync-zero-docs
          delete-branch: true
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/sync.yml
git commit -m "ci: weekly auto-sync workflow opening PR on upstream drift"
```

---

## Task 9: First real sync, README, and verification

**Files:**
- Create: `README.md`
- Generated: `skills/zero-docs/references/**`, `skills/zero-docs/INDEX.md`, `SOURCE.md`

- [ ] **Step 1: Run the real sync against upstream**

Run: `npm run sync`
Expected: prints `Synced <N> docs from <sha>` (N ≈ 35+). May print a "stripped
unrecognized components" warning — note any component names for possible future handling.

- [ ] **Step 2: Sanity-check the generated output**

Run: `ls skills/zero-docs/references && head -n 20 skills/zero-docs/INDEX.md && cat SOURCE.md`
Expected: `references/` contains `zql.md`, `schema.md`, `mutators.md`, etc. plus
`debug/`, `deprecated/`, `release-notes/` subdirs; `INDEX.md` lists files under grouped
headings; `SOURCE.md` shows a 40-char commit SHA.

- [ ] **Step 3: Spot-check transform fidelity on a known file**

Run: `grep -n "where" skills/zero-docs/references/zql.md | head` and open the file.
Expected: code blocks intact, no `import` lines, any `<Note>` rendered as `> **…**`
blockquotes, no raw `<Note>`/`</Note>` tags remaining.

Run: `grep -rl "</Note>" skills/zero-docs/references || echo "no leftover Note tags"`
Expected: `no leftover Note tags`.

- [ ] **Step 4: Verify `--check` is clean immediately after a sync**

Run: `npm run sync:check`
Expected: exits 0, prints `Up to date with upstream <sha>`.

- [ ] **Step 5: Reconcile SKILL.md entry points with actual filenames**

Open `skills/zero-docs/INDEX.md` and confirm the "Common entry points" list in
`skills/zero-docs/SKILL.md` matches real filenames. Fix any mismatch (e.g. if
permissions live in their own file rather than inside `auth.md`).

- [ ] **Step 6: Create `README.md`**

```markdown
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
```

- [ ] **Step 7: Commit the first generated snapshot and docs**

```bash
git add README.md skills/zero-docs/references skills/zero-docs/INDEX.md SOURCE.md skills/zero-docs/SKILL.md
git commit -m "feat: initial Zero docs snapshot, index, and README"
```

- [ ] **Step 8: Final full verification**

Run: `npm test && npm run sync:check`
Expected: all unit tests pass AND `sync:check` exits 0. Done.

---

## Self-Review Notes

- **Spec coverage:** vendored-and-regenerated plugin (Tasks 6,7,9), committed references
  (Task 9), `sync` + `--check` (Task 6), SHA stamp in `SOURCE.md` (Task 6/9), MDX→MD
  transform with Note handling + JSX passthrough (Tasks 2,3), generated `INDEX.md`
  (Task 4), stable `SKILL.md` router (Task 7), weekly auto-sync Action (Task 8),
  transform unit tests + e2e smoke + `--check` idempotence (Tasks 2–5, 9). All spec
  sections map to tasks.
- **Type consistency:** `transformMdx(raw, onUnknown)`, `collectDocs(docsDir) →
  {files, entries, unknown}`, `buildIndex(entries)` signatures are used identically in
  `sync.mjs`. `entries[].path`/`files` keys are POSIX `.md` paths throughout.
- **Edge cases:** non-mdx ignored (Task 5), leftover Note tags checked (Task 9 Step 3),
  removed-upstream-file drift handled in `--check` (Task 6), SOURCE.md excluded from
  `--check` so its content never causes false drift.
