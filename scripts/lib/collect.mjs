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
