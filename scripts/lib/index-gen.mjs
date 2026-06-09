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
