// scripts/lib/transform.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, finalizeDoc, rewriteDocLinks, buildOverview } from './transform.mjs';

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

test('finalizeDoc normalizes CRLF, trims, ensures trailing newline', () => {
  assert.equal(finalizeDoc('# Hi\r\n\r\nBody\r\n\n\n', 'Hi'), '# Hi\n\nBody\n');
});

test('finalizeDoc prepends a heading when the fetched body lacks one', () => {
  assert.equal(finalizeDoc('Just prose.', 'My Title'), '# My Title\n\nJust prose.\n');
});

test('finalizeDoc keeps an existing heading without duplicating', () => {
  assert.equal(finalizeDoc('# Already Here\n\nBody', 'Other'), '# Already Here\n\nBody\n');
});

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

test('finalizeDoc strips whole-line MDX comments like prettier-ignore', () => {
  assert.equal(
    finalizeDoc('# T\n\n{/* prettier-ignore */}\n\n```tsx\ncode\n```', 'T'),
    '# T\n\n```tsx\ncode\n```\n',
  );
});

test('rewriteDocLinks handles slugs containing dots (release notes)', () => {
  const files = new Set(['release-notes/0.21.md']);
  assert.equal(
    rewriteDocLinks('[v](https://zero.rocicorp.dev/docs/release-notes/0.21)', 'schema.md', files),
    '[v](release-notes/0.21.md)',
  );
});

test('rewriteDocLinks drops query strings from doc links', () => {
  const files = new Set(['server-zql.md']);
  assert.equal(
    rewriteDocLinks(
      '[s](https://zero.rocicorp.dev/docs/server-zql?codeGroup=pgclient%3Akysely#creating-a-database)',
      'schema.md',
      files,
    ),
    '[s](server-zql.md#creating-a-database)',
  );
});

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
