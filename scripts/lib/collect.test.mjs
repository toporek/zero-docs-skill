// scripts/lib/collect.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectMeta } from './collect.mjs';

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

test('collectMeta returns frontmatter metadata per mdx file with .md paths', () => {
  assert.deepEqual(collectMeta(fixture()), [
    { path: 'debug/slow.md', title: 'Slow Queries', description: '' },
    { path: 'zql.md', title: 'ZQL', description: 'Query language' },
  ]);
});

test('collectMeta ignores non-mdx files', () => {
  assert.ok(!collectMeta(fixture()).some((e) => e.path.includes('ignore')));
});
