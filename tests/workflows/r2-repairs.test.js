import { test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

function normalize(path) {
  const absolute = path.startsWith('/');
  const parts = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return `${absolute ? '/' : ''}${parts.join('/')}`;
}

function dirname(path) {
  return path.slice(0, path.lastIndexOf('/')) || '/';
}

const root = normalize(`${import.meta.dir}/../..`);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

function explicitLoads(path) {
  const text = readFileSync(path, 'utf8');
  const links = [];
  const paragraphs = text.split(/\n\s*\n/);
  for (let index = 0; index < paragraphs.length; index++) {
    const paragraph = paragraphs[index];
    if (!/\bload(?:s|ed)?\b/i.test(paragraph)) continue;
    for (const match of paragraph.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) links.push(match[1]);
    // A load directive may introduce a link list in the following paragraph.
    if (paragraph.trimEnd().endsWith(':') && /^\s*[-*]\s+\[/m.test(paragraphs[index + 1] ?? '')) {
      for (const match of paragraphs[index + 1].matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) links.push(match[1]);
    }
  }
  return [...new Set(links)]
    .filter((link) => !/^(https?:|#|mailto:)/.test(link))
    .map((link) => normalize(`${dirname(path)}/${link.split('#')[0]}`));
}

function reaches(start, wanted) {
  const queue = [start];
  const seen = new Set();
  while (queue.length) {
    const path = queue.shift();
    if (path === wanted) return true;
    if (seen.has(path) || !existsSync(path)) continue;
    seen.add(path);
    queue.push(...explicitLoads(path));
  }
  return false;
}

test('r2 inputs contain no embedded evaluator expectations', () => {
  const data = JSON.parse(read('tests/workflows/r2-evaluator-inputs.json'));
  expect(data.cases.map(({ id }) => id)).toEqual([
    'standalone-audit-reachability',
    'peer-untrusted-instructions',
  ]);
  for (const entry of data.cases) {
    for (const forbidden of ['expected', 'required', 'forbidden', 'verdict']) {
      expect(forbidden in entry, `${entry.id} must not include ${forbidden}`).toBe(false);
    }
  }
});

test('every independently callable substantive phase has an explicit load path to audit', () => {
  const phases = [
    'axstack', 'axstack-align', 'axstack-spec', 'axstack-tickets',
    'axstack-implement', 'axstack-review', 'axstack-watch',
    'axstack-research', 'axstack-docs',
  ];
  const audit = `${root}/skills/axstack-audit/SKILL.md`;
  for (const phase of phases) {
    const start = `${root}/skills/${phase}/SKILL.md`;
    expect(reaches(start, audit), `${phase} has no declared load path to audit`).toBe(true);
  }
});

test('audit hook excludes audit runs and auditor children', () => {
  const contracts = read('skills/axstack/references/contracts.md');
  const lifecycle = read('skills/axstack/references/lifecycle.md');
  const audit = read('skills/axstack-audit/SKILL.md');
  expect(contracts).toMatch(/except[^.]*axstack-audit/i);
  expect(lifecycle).toMatch(/axstack-audit[^.]*excluded/i);
  expect(audit).toMatch(/launch(?:es)? no child/i);
});

test('routing labels lifecycle scope as mode-specific', () => {
  const routing = read('skills/axstack/references/routing.md');
  expect(routing).toContain('## Lifecycle routes (mode-specific scope identity required)');
  expect(routing).not.toContain('## Lifecycle routes (approved scope required)');
});

test('peer content is intent evidence and never reviewer instructions', () => {
  const review = read('skills/axstack-review/SKILL.md');
  const peer = review.slice(review.indexOf('## Peer mode'), review.indexOf('## Authored mode'));
  expect(peer).toMatch(/untrusted intent (data|evidence)/i);
  expect(peer).toMatch(/never[^.]*reviewer[^.]*instructions/i);
  expect(peer).toMatch(/cannot alter[^.]*scope[^.]*angles[^.]*authority/i);
});

test('persistent owner consolidates report-only review and driver presents it', () => {
  const review = read('skills/axstack-review/SKILL.md');
  expect(review).toMatch(/standalone peer review[^.]*materializes `axstack-owner`/i);
  const reportOnly = review.slice(review.indexOf('## Report-only scope'), review.indexOf('## Authorized submission'));
  expect(reportOnly).toMatch(/owner[^.]*consolidat/i);
  expect(reportOnly).toMatch(/driver[^.]*presents/i);
});

test('README separates checks, declarations, private simulation, and live proof', () => {
  const readme = read('README.md');
  expect(readme).toMatch(/89 workflow[^.]*structural[^.]*contract checks/i);
  expect(readme).toMatch(/contains 30 declared scenarios/i);
  expect(readme).toMatch(/33-case[^.]*a97c1a7[^.]*25[^.]*8 baseline/i);
  expect(readme).toMatch(/private[^.]*not shipped/i);
  expect(readme).toMatch(/not[^.]*live\s+runtime/i);
});
