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
