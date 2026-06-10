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
 * CRLF → LF, whole-line MDX comments (e.g. prettier-ignore directives in
 * curly-brace JSX comments) removed outside code fences, trimmed, guaranteed
 * to start with an H1 and end with one newline.
 */
export function finalizeDoc(fetched, title) {
  let inFence = false;
  let out = fetched
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return true;
      }
      return inFence || !/^\s*\{\/\*.*\*\/\}\s*$/.test(line);
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
  const linkRe = /\]\((?:https:\/\/zero\.rocicorp\.dev)?\/docs\/([A-Za-z0-9_/.-]+?)(?:\.md)?(?:\?[^)#]*)?(#[^)]*)?\)/g;
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
