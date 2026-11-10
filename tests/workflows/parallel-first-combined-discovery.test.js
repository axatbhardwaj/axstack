import { expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { publicDocPaths, relativeLinks } from './public-docs.js';
import { isVendored } from './vendored-paths.js';
import { sentences } from './prose-contract.js';

const root = realpathSync(`${import.meta.dir}/../..`);
const reference = 'skills/axstack/references/parallel-first.md';
const read = (path) => existsSync(`${root}/${path}`) ? readFileSync(`${root}/${path}`, 'utf8') : '';
const skillFiles = readdirSync(`${root}/skills`, { recursive: true })
  .map((path) => `skills/${path}`)
  .filter((path) => path.endsWith('.md') && !isVendored(path));
const entrypoints = readdirSync(`${root}/skills`, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && (entry.name.startsWith('axstack') || entry.name === 'voa'))
  .map((entry) => `skills/${entry.name}/SKILL.md`).filter((path) => existsSync(`${root}/${path}`));
const presets = readdirSync(`${root}/profiles/presets`)
  .filter((path) => path.endsWith('.json')).map((path) => `profiles/presets/${path}`);
const guidance = [...new Set([...skillFiles, ...publicDocPaths(root), 'AGENTS.md', ...presets])];

// C1: scan actual shipped guidance, not historical plans or a model scheduler.
// These are the superseded blanket instructions; qualified candidate ownership
// and phase-specific corroboration floors remain valid.
function contradictions(source) {
  return sentences(source.replaceAll('`', '')).filter((sentence) => {
    const pr = /\bPR\b|pull request|deliverable/i.test(sentence);
    const soleAuthor = /(?:exactly|only|sole|single|one) (?:active )?author|author[^.]*\b(?:single|sole)\b/i.test(sentence);
    const scoped = /package|integrat|per candidate|each candidate|replac|supersed|obsolete/i.test(sentence);
    const negated = /\b(?:not|never)\b[^.]*\b(?:require|limit|restrict|one author|single author)\b/i.test(sentence);
    return (pr && soleAuthor && !scoped && !negated)
      || (/exactly one author writes it/i.test(sentence) && !scoped && !negated)
      || (/one writer and one PR/i.test(sentence) && !scoped && !negated)
      || (/two issues|multiple (?:issues|repairs)/i.test(sentence) && pr && soleAuthor && !scoped)
      || (/parallel|concurrent/i.test(sentence) && /source wave/i.test(sentence) && /never|forbid|prohibit|must not/i.test(sentence))
      || (/facet/i.test(sentence) && /1[–-]3|one to three|at most three/i.test(sentence));
  });
}

test('C1: active shared and phase instructions contain no superseded blanket restriction', () => {
  const failures = guidance.flatMap((path) => contradictions(read(path)).map((rule) => `${path}: ${rule}`));
  expect(failures, 'package ownership must work through every active instruction surface').toEqual([]);
});

test('C1: contradiction scan catches reintroduced restrictions in actual source', () => {
  const path = 'skills/axstack-implement/SKILL.md';
  const source = read(path);
  expect(contradictions(source), path).toEqual([]);
  for (const regression of [
    'Exactly one author writes each PR.',
    'Each pull request requires a single author.',
    'Two issues on the same PR use one author and candidate.',
    'Never launch a parallel source wave.',
    'Concurrent source waves are forbidden.',
  ]) {
    expect(contradictions(`${source}\n${regression}`).length, regression).toBeGreaterThan(0);
  }
  expect(contradictions(`${source}\nEach isolated package candidate has one exclusive writer.`)).toEqual([]);
  expect(contradictions(`${source}\nA PR may combine independent package authors and one integration author.`)).toEqual([]);
});

function reachesReference(path, visited = new Set()) {
  if (path === reference) return read(path).length > 0;
  if (visited.has(path)) return false;
  visited.add(path);
  return relativeLinks(read(path)).some((href) => {
    const target = new URL(href, `file://${root}/${path}`);
    const relative = decodeURIComponent(target.pathname).slice(`${root}/`.length);
    return target.pathname.startsWith(`${root}/skills/`) && relative.endsWith('.md')
      && reachesReference(relative, visited);
  });
}

test('C3: every installer-selected entrypoint reaches the shared scheduling contract', () => {
  expect(entrypoints.length).toBeGreaterThan(0);
  expect(entrypoints.filter((path) => !reachesReference(path)), 'unwired installer entrypoints').toEqual([]);
});

test('C3: accepted M0 interface has every stable section and valid inbound anchor', () => {
  const source = read(reference);
  // Headings/anchors are the approved public interface, an exact-text exception.
  const headings = ['Ready work', 'Ownership', 'Dependencies and repairs', 'Evidence', 'Authority'];
  for (const heading of headings) {
    expect(source, `missing required contract section: ${heading}`).toMatch(new RegExp(`^## ${heading}$`, 'm'));
  }
  const anchors = new Set(headings.map((heading) => heading.toLowerCase().replaceAll(' ', '-')));
  for (const path of guidance) {
    for (const href of relativeLinks(read(path))) {
      const target = new URL(href, `file://${root}/${path}`);
      if (decodeURIComponent(target.pathname) !== `${root}/${reference}` || !target.hash) continue;
      expect(anchors.has(decodeURIComponent(target.hash.slice(1))), `${path}: ${href}`).toBe(true);
    }
  }
});

test('C3: real package selection includes the shared reference and every selected entrypoint', () => {
  const result = Bun.spawnSync([process.execPath, 'pm', 'pack', '--dry-run'], {
    cwd: root, stdout: 'pipe', stderr: 'pipe', timeout: 30000,
  });
  const output = result.stdout.toString() + result.stderr.toString();
  expect(result.exitCode, output).toBe(0);
  const members = new Set([...output.matchAll(/^packed\s+\S+\s+(.+)$/gm)].map((match) => match[1]));
  expect(members.has(reference), 'published bundle must carry the required scheduling contract').toBe(true);
  for (const path of entrypoints) expect(members.has(path), path).toBe(true);
  expect([...members].some((path) => path.startsWith('.agents/') || path.startsWith('.claude/'))).toBe(false);
});
