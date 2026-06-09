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
