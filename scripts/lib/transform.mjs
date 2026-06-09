// scripts/lib/transform.mjs

/**
 * Parse a leading YAML-ish frontmatter block (--- ... ---).
 * Only simple `key: value` lines are read. Returns { data, body }.
 */
export function parseFrontmatter(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { data: {}, body: raw };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([\w-]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[m[1]] = value;
  }
  return { data, body: raw.slice(match[0].length) };
}

/** Remove MDX `import ... from ...`, side-effect imports, and `export ...` lines. */
export function stripEsm(body) {
  return body
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/^\s*import\b.*\bfrom\b.*$/.test(line) &&
        !/^\s*import\s+['"].*['"];?\s*$/.test(line) &&
        !/^\s*export\s+(default\b|const\b|function\b|let\b|var\b|\{)/.test(line),
    )
    .join('\n')
    .trim();
}
