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
