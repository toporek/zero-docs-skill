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

/**
 * Normalize a page body fetched from the rendered-markdown endpoint:
 * CRLF → LF, trimmed, guaranteed to start with an H1 and end with one newline.
 */
export function finalizeDoc(fetched, title) {
  let out = fetched.replace(/\r\n/g, '\n').trim();
  if (!/^#\s/.test(out)) out = '# ' + title + '\n\n' + out;
  return out + '\n';
}

/**
 * Rewrite internal doc links (absolute https://zero.rocicorp.dev/docs/... or
 * root-relative /docs/...) to paths relative to `selfPath`, but only when the
 * target exists in `files` (a Set of POSIX-relative generated paths). Directory
 * slugs map to <slug>/index.md. Lines inside code fences are left untouched.
 */
export function rewriteDocLinks(body, selfPath, files) {
  const fromDir = selfPath.includes('/')
    ? selfPath.slice(0, selfPath.lastIndexOf('/')).split('/')
    : [];
  const relativeTo = (target) => {
    const to = target.split('/');
    let i = 0;
    while (i < fromDir.length && i < to.length - 1 && fromDir[i] === to[i]) i++;
    return [...Array(fromDir.length - i).fill('..'), ...to.slice(i)].join('/');
  };
  const linkRe = /\]\((?:https:\/\/zero\.rocicorp\.dev)?\/docs\/([A-Za-z0-9_/-]+?)(?:\.md)?(#[^)]*)?\)/g;
  let inFence = false;
  return body
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return line.replace(linkRe, (match, slug, anchor) => {
        const target = files.has(slug + '.md')
          ? slug + '.md'
          : files.has(slug + '/index.md')
            ? slug + '/index.md'
            : null;
        if (!target) return match;
        return '](' + relativeTo(target) + (anchor || '') + ')';
      });
    })
    .join('\n');
}

/**
 * Remove MDX `import ... from ...`, side-effect imports, and `export ...` lines
 * that appear at the MDX top level. Lines inside fenced code blocks are preserved
 * verbatim so code examples stay intact.
 */
export function stripEsm(body) {
  let inFence = false;
  return body
    .split(/\r?\n/)
    .filter((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return true;
      }
      if (inFence) return true;
      return (
        !/^\s*import\b.*\bfrom\b.*$/.test(line) &&
        !/^\s*import\s+['"].*['"];?\s*$/.test(line) &&
        !/^\s*export\s+(default\b|const\b|function\b|let\b|var\b|\{)/.test(line)
      );
    })
    .join('\n')
    .trim();
}

/**
 * Convert <Note ...>...</Note> blocks into markdown blockquotes.
 * The `heading` attribute (if present) becomes a bold first line.
 */
export function transformNotes(body) {
  return body.replace(
    /<Note\b([^>]*)>([\s\S]*?)<\/Note>/g,
    (_, attrs, inner) => {
      const headingMatch = /heading="([^"]*)"/.exec(attrs);
      const heading = headingMatch ? headingMatch[1] : 'Note';
      const contentLines = inner.trim().split(/\r?\n/);
      return ['**' + heading + '**', '', ...contentLines]
        .map((l) => (l ? '> ' + l : '>'))
        .join('\n');
    },
  );
}

/**
 * Drop lines that are nothing but a capitalized JSX component open/close tag,
 * preserving inner content. Calls onUnknown(name) for each stripped tag so the
 * caller can log components that may need richer handling.
 */
export function stripJsxTags(body, onUnknown = () => {}) {
  return body
    .split(/\r?\n/)
    .filter((line) => {
      const m = /^\s*<\/?([A-Z][A-Za-z0-9]*)\b[^>]*>\s*$/.exec(line);
      if (m) {
        onUnknown(m[1]);
        return false;
      }
      return true;
    })
    .join('\n')
    .trim();
}

/**
 * Full MDX → Markdown transform.
 * Returns { title, description, body } where body is a complete markdown
 * document beginning with an `# <title>` heading and ending in a newline.
 */
export function transformMdx(raw, onUnknown = () => {}) {
  const { data, body } = parseFrontmatter(raw);
  let out = stripEsm(body);
  out = transformNotes(out);
  out = stripJsxTags(out, onUnknown);
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  const title = data.title || 'Untitled';
  if (!/^#\s/.test(out)) out = '# ' + title + '\n\n' + out;
  return { title, description: data.description || '', body: out + '\n' };
}
