#!/usr/bin/env bun

const help = `Usage: bun image-evidence.js --page FILE [--observations FILE]
  --page FILE          Exact final UTF-8 HTML bytes before delivery; SHA-256 precedes parsing.
  --observations FILE  Saved Playwright MCP JSON: {sha256,resources:[{url,status,evidence}]}.
                       status: pass/fail/unknown; evidence: nonempty tool-result reference/detail.
                       url is the decoded authored URL, not the resolved/currentSrc URL.
  --help               Show flags, input schema, limits and effects; takes precedence over other args.
Fact mode: static img/src/srcset, picture/source/srcset, input/image, video/poster,
SVG image/feImage/use, object/embed, image link href/imagesrcset, legacy background,
inline CSS url()/image-set(). CSS imports, font-face URLs and local fragments are excluded.
Locations identify each occurrence; unmatched observations have source "observation-only".
No script execution, CSS cascade, external stylesheet traversal or browser/network access.
Dynamic resources and unsupported named HTML entities require reviewer coverage; unobserved
and unselected candidates, stale digests or conflicting observations stay unknown.
Reviewer uses Playwright MCP on exactly these final bytes before delivery, checks load AND image decode
(complete/naturalWidth or decode()), including CSS images; an HTTP 200 alone is insufficient.
Scroll lazy images; exercise relevant states. Inaccessible/unobservable resources stay unknown.
Output: per-resource facts with evidence, SHA-256 and counts only; never an aggregate verdict.
Side effects: reads only named files; writes JSON to stdout, errors to stderr. No subprocess,
dispatch, scheduling, retries, merge, persistent state or cleanup.
Exit: 0 measured (including fail), 1 invalid input/error, 2 incomplete (unknown resources).
`;

const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', Tab: '\t', NewLine: '\n' };
const scalar = (point) => String.fromCodePoint(point > 0 && point <= 0x10ffff
  && !(point >= 0xd800 && point <= 0xdfff) ? point : 0xfffd);
function htmlValue(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][\da-z]+);/gi, (whole, key) => {
    if (!key.startsWith('#')) return Object.hasOwn(entities, key) ? entities[key] : whole;
    const point = key[1].toLowerCase() === 'x' ? Number.parseInt(key.slice(2), 16) : Number(key.slice(1));
    return scalar(point);
  });
}

function candidates(value) {
  const urls = [];
  let rest = value;
  while (rest) {
    rest = rest.replace(/^[\s,]+/, '');
    const match = /^\S+/.exec(rest);
    if (!match) break;
    const token = match[0];
    urls.push(token.replace(/,+$/, ''));
    rest = rest.slice(token.length);
    if (!token.endsWith(',')) rest = rest.replace(/^[^,]*(?:,|$)/, '');
  }
  return urls;
}

function cssUrls(css) {
  const urls = [];
  const add = (value) => {
    const url = value.trim().replace(
      /\\([\da-f]{1,6}[\t\n\f\r ]?|[\s\S])/gi,
      (_, escaped) => /^[\da-f]/i.test(escaped)
        ? scalar(Number.parseInt(escaped.trim(), 16))
        : escaped.replace(/[\n\r\f]/g, ''),
    );
    if (!url.startsWith('#')) urls.push(url);
  };
  // Tokenize strings/comments atomically; only image-set candidate strings are URLs.
  const tokens = /\/\*[\s\S]*?\*\/|(?<![\w-])url\(\s*(?:"((?:\\[\s\S]|[^"\\])*)"|'((?:\\[\s\S]|[^'\\])*)'|((?:\\[\s\S]|[^)\\])*))\s*\)|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|(?<![\w-])(?:-webkit-)?image-set\(|@import\b|@font-face\b|[{}();,]/gi;
  const functions = [];
  let depth = 0, fontDepth = null, fontPending = false, importing = false;
  for (const token of css.matchAll(tokens)) {
    const text = token[0], lower = text.toLowerCase();
    if (text.startsWith('/*')) continue;
    if (lower === '@import') { importing = true; continue; }
    if (lower === '@font-face') { fontPending = true; continue; }
    if (text === '{') { depth++; if (fontPending) fontDepth = depth; fontPending = false; continue; }
    if (text === '}') { if (fontDepth === depth) fontDepth = null; depth--; continue; }
    if (text === ';') { importing = false; functions.length = 0; continue; }
    if (importing || fontDepth !== null) continue;
    if (lower.endsWith('image-set(')) { functions.push({ imageSet: true, candidate: true }); continue; }
    if (text === '(') { functions.push({ imageSet: false, candidate: false }); continue; }
    if (text === ')') { functions.pop(); continue; }
    const current = functions.at(-1);
    if (text === ',') { if (current) current.candidate = true; continue; }
    const url = token[1] ?? token[2] ?? token[3];
    if (url !== undefined) add(url);
    else if (current?.imageSet && current.candidate && /^["']/.test(text)) add(text.slice(1, -1));
    if (current) current.candidate = false;
  }
  return urls;
}

async function expectedResources(bytes) {
  const expected = new Map();
  const add = (url, location) => {
    url = url.trim();
    if (!expected.has(url)) expected.set(url, { url, locations: [] });
    expected.get(url).locations.push(location);
  };
  const styles = [];
  let index = 0;
  await new HTMLRewriter().on('*', { element(element) {
    const tag = element.tagName.toLowerCase(), location = `${tag}[${++index}]`;
    const attr = (name) => {
      const value = element.getAttribute(name);
      return value === null ? null : htmlValue(value);
    };
    const single = (name) => { const value = attr(name); if (value !== null) add(value, `${location}@${name}`); };
    const set = (name) => { for (const url of candidates(attr(name) ?? '')) add(url, `${location}@${name}`); };
    if (tag === 'img' && attr('src') === null && !attr('srcset')?.trim()) add('', `${location}@src (absent)`);
    if (['img', 'image', 'embed'].includes(tag) || tag === 'input' && attr('type')?.toLowerCase() === 'image') single('src');
    if (['img', 'source'].includes(tag)) set('srcset');
    if (tag === 'video') single('poster');
    if (tag === 'object') single('data');
    if (['body', 'table', 'td', 'th'].includes(tag)) single('background');
    if (['image', 'feimage', 'use'].includes(tag)) {
      const name = attr('href') !== null ? 'href' : 'xlink:href';
      if (tag !== 'use' || !attr(name)?.trim().startsWith('#')) single(name);
    }
    if (tag === 'link' && (/\bicon\b/i.test(attr('rel') ?? '') || attr('as')?.toLowerCase() === 'image')) {
      single('href'); set('imagesrcset');
    }
    for (const url of cssUrls(attr('style') ?? '')) add(url, `${location}@style`);
  } }).on('style', {
    element() { styles.push(''); },
    text(chunk) { styles[styles.length - 1] += chunk.text; },
  }).transform(new Response(bytes)).text();
  for (const [i, style] of styles.entries()) for (const url of cssUrls(style)) add(url, `style[${i + 1}]`);
  return [...expected.values()];
}

export async function imageEvidence(bytes, observations) {
  const sha256 = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
  if (observations !== undefined) {
    if (!/^[a-f\d]{64}$/.test(observations?.sha256 ?? '') || !Array.isArray(observations.resources)) {
      throw new Error('observations require sha256 and resources array');
    }
    for (const row of observations.resources) {
      if (typeof row?.url !== 'string' || !['pass', 'fail', 'unknown'].includes(row.status)) {
        throw new Error('observation url/status invalid');
      }
      if (typeof row.evidence !== 'string' || !row.evidence.trim()) throw new Error('observation evidence required');
    }
  }
  const resources = (await expectedResources(bytes)).map((resource) => {
    const matches = observations?.resources.filter((row) => row.url === resource.url) ?? [];
    let status = 'unknown', evidence = 'No observation: absent or unobservable resource';
    if (observations && observations.sha256 !== sha256) evidence = 'SHA-256 differs from observed page bytes';
    else if (/&[a-z][\da-z]+;/i.test(resource.url)) evidence = 'Unsupported named HTML entity; browser URL needs review';
    else if (new Set(matches.map((row) => row.status)).size > 1) evidence = 'Conflicting observations; needs review';
    else if (matches.length) { status = matches[0].status; evidence = matches.map((row) => row.evidence).join('; '); }
    return { ...resource, status, evidence };
  });
  const extracted = new Set(resources.map((resource) => resource.url));
  for (const row of observations?.resources ?? []) {
    if (extracted.has(row.url)) continue;
    resources.push({ ...row, source: 'observation-only', locations: ['observation-only'],
      ...(observations.sha256 !== sha256
        ? { status: 'unknown', evidence: 'SHA-256 differs from observed page bytes' } : {}) });
  }
  const summary = { pass: 0, fail: 0, unknown: 0, 'n/a': 0 };
  for (const resource of resources) summary[resource.status]++;
  return { sha256, resources, summary };
}

if (import.meta.main) {
  try {
    const argv = process.argv.slice(2), args = {};
    if (argv.includes('--help')) console.log(help);
    else {
      for (let i = 0; i < argv.length; i += 2) {
        if (!['--page', '--observations'].includes(argv[i]) || !argv[i + 1] || args[argv[i]]) {
          throw new Error(`invalid argument: ${argv[i]}`);
        }
        args[argv[i]] = argv[i + 1];
      }
      if (!args['--page']) throw new Error('--page is required (see --help)');
      const bytes = new Uint8Array(await Bun.file(args['--page']).arrayBuffer());
      const observations = args['--observations'] ? await Bun.file(args['--observations']).json() : undefined;
      const report = await imageEvidence(bytes, observations);
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = report.summary.unknown ? 2 : 0;
    }
  } catch (error) {
    console.error(`Image evidence: ${error.message}`);
    process.exitCode = 1;
  }
}
