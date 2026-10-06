import { existsSync, readdirSync, readFileSync } from 'node:fs';

// Public policy excludes historical baselines under docs/specs and docs/plans.
export function publicDocPaths(root) {
  return ['README.md', ...(existsSync(`${root}/docs`)
    ? readdirSync(`${root}/docs`, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => `docs/${entry.name}`).sort()
    : [])];
}

// Fenced examples are neither links nor heading targets.
function withoutFences(text) {
  let fence;
  return text.split('\n').filter((line) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (!fence && marker) { fence = marker[1]; return false; }
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = undefined;
      return false;
    }
    return true;
  }).join('\n');
}

export function relativeLinks(text) {
  const source = withoutFences(text).replace(/(`+)[\s\S]*?\1/g, '');
  const hrefs = [];
  const references = new Map();
  const label = (value) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  const body = source.replace(/^ {0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?[^\n]*$/gm, (_, key, href) => {
    references.set(label(key), href);
    return '';
  });
  for (const [, angle, plain] of body.matchAll(/!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s()]+(?:\([^()]*\)[^\s()]*)*))(?:\s+"[^"\n]*")?\s*\)/g)) {
    hrefs.push(angle ?? plain);
  }
  for (const [, title, key] of body.matchAll(/\[([^\]]+)\](?:\[([^\]]*)\])?(?!\()/g)) {
    const href = references.get(label(key || title));
    if (href) hrefs.push(href);
  }
  for (const [, href] of body.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) hrefs.push(href);
  return hrefs.filter((href) => !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href));
}

function headingAnchors(text) {
  const source = withoutFences(text);
  const anchors = new Set();
  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const atx = lines[index].match(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    const heading = atx?.[1] ?? (lines[index].trim() && /^ {0,3}(?:=+|-+)\s*$/.test(lines[index + 1] ?? '') ? lines[index] : null);
    if (!heading) continue;
    const slug = heading.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/<[^>]+>/g, '').toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/\s/g, '-');
    let anchor = slug;
    for (let suffix = 1; anchors.has(anchor); suffix++) anchor = `${slug}-${suffix}`;
    anchors.add(anchor);
  }
  for (const [, id] of source.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) anchors.add(id);
  return anchors;
}

export function docLinkIssues(root, paths = publicDocPaths(root)) {
  const base = new URL(`file://${root}/`);
  const issues = [];
  for (const path of paths) {
    for (const href of relativeLinks(readFileSync(`${root}/${path}`, 'utf8'))) {
      const url = new URL(href, new URL(path, base));
      const target = decodeURIComponent(url.pathname);
      if (!url.pathname.startsWith(base.pathname) || !existsSync(target)
        || (url.hash && !headingAnchors(readFileSync(target, 'utf8')).has(decodeURIComponent(url.hash.slice(1))))) {
        issues.push(`${path}: missing ${href}`);
      }
    }
  }
  return issues;
}
