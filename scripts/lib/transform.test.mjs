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
