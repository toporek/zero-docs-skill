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
