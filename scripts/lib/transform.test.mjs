// scripts/lib/transform.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, stripEsm, finalizeDoc } from './transform.mjs';

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

test('stripEsm preserves import/export lines inside fenced code blocks', () => {
  const body = [
    "import Top from './top';",   // top-level → stripped
    '',
    '```ts',
    "import { z } from 'zero';",  // inside fence → kept
    'export const schema = z;',   // inside fence → kept
    '```',
    '',
    'Prose.',
  ].join('\n');
  const out = stripEsm(body);
  assert.doesNotMatch(out, /import Top/);
  assert.match(out, /import \{ z \} from 'zero';/);
  assert.match(out, /export const schema = z;/);
  assert.match(out, /Prose\./);
});

test('stripEsm toggles fence state so post-fence top-level imports are still stripped', () => {
  const body = [
    '```ts',
    "import { inside } from 'x';",
    '```',
    "import { outside } from 'y';",  // back at top level → stripped
  ].join('\n');
  const out = stripEsm(body);
  assert.match(out, /import \{ inside \}/);
  assert.doesNotMatch(out, /import \{ outside \}/);
});

test('finalizeDoc normalizes CRLF, trims, ensures trailing newline', () => {
  assert.equal(finalizeDoc('# Hi\r\n\r\nBody\r\n\n\n', 'Hi'), '# Hi\n\nBody\n');
});

test('finalizeDoc prepends a heading when the fetched body lacks one', () => {
  assert.equal(finalizeDoc('Just prose.', 'My Title'), '# My Title\n\nJust prose.\n');
});

test('finalizeDoc keeps an existing heading without duplicating', () => {
  assert.equal(finalizeDoc('# Already Here\n\nBody', 'Other'), '# Already Here\n\nBody\n');
});

import { rewriteDocLinks } from './transform.mjs';

const linkFiles = new Set(['schema.md', 'zql.md', 'debug/slow-queries.md', 'release-notes/index.md']);

test('rewriteDocLinks rewrites absolute doc links to sibling-relative paths', () => {
  assert.equal(
    rewriteDocLinks('See [schema](https://zero.rocicorp.dev/docs/schema#backfill).', 'zql.md', linkFiles),
    'See [schema](schema.md#backfill).',
  );
});

test('rewriteDocLinks rewrites root-relative /docs/ links', () => {
  assert.equal(rewriteDocLinks('See [ZQL](/docs/zql).', 'schema.md', linkFiles), 'See [ZQL](zql.md).');
});

test('rewriteDocLinks computes ../ paths from nested files and into directories', () => {
  assert.equal(
    rewriteDocLinks('[s](/docs/schema) [d](/docs/debug/slow-queries)', 'debug/slow-queries.md', linkFiles),
    '[s](../schema.md) [d](slow-queries.md)',
  );
});

test('rewriteDocLinks maps directory slugs to index.md', () => {
  assert.equal(
    rewriteDocLinks('[rn](/docs/release-notes)', 'schema.md', linkFiles),
    '[rn](release-notes/index.md)',
  );
});

test('rewriteDocLinks leaves unknown targets and non-doc links untouched', () => {
  const s = '[x](/docs/nope) [bugs](https://bugs.rocicorp.dev/issue/1) [p](https://zerosync.dev/#pricing)';
  assert.equal(rewriteDocLinks(s, 'schema.md', linkFiles), s);
});

test('rewriteDocLinks does not touch lines inside code fences', () => {
  const s = 'pre [a](/docs/schema)\n```\nfetch("/docs/schema")\n[b](/docs/schema)\n```\npost';
  assert.equal(
    rewriteDocLinks(s, 'zql.md', linkFiles),
    'pre [a](schema.md)\n```\nfetch("/docs/schema")\n[b](/docs/schema)\n```\npost',
  );
});
