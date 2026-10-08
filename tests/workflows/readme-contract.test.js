import { test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';
import { relativeLinks } from './public-docs.js';

const root = `${import.meta.dir}/../..`;
const readme = readFileSync(`${root}/README.md`, 'utf8');
const prose = readme.replace(/\s+/g, ' ');

test('README shows the workflow and groups linked skills by layer', () => {
  expect(readme.split(/^## /m)[0]).toMatch(/align → spec → tickets → implement → review → watch/);
  const skills = readme.split('\n').filter((line) => /^\| (?:Plan|Build|Verify|Operate|Understand) \|/.test(line)).join('\n');
  for (const layer of ['Plan', 'Build', 'Verify', 'Operate', 'Understand']) {
    expect(skills).toContain(`| ${layer} |`);
  }
  const rows = skills.split('\n').filter((line) => line.startsWith('| '));
  expect(rows.find((line) => line.includes('[axstack-improve]'))).toMatch(/^\| Verify \|/);
  expect(rows.filter((line) => line.startsWith('| Understand |')).join('\n'))
    .not.toContain('axstack-improve');

  const linkedSkills = [...skills.matchAll(/\[axstack-[^\]]+\]\((skills\/[^)]+\/SKILL\.md)\)/g)];
  expect(linkedSkills).toHaveLength(18);
  for (const [, path] of linkedSkills) expect(existsSync(`${root}/${path}`), path).toBe(true);
});

test('correct is discoverable in the README table and workflow direct routes', () => {
  const row = readme.split('\n').find((line) => line.includes('[axstack-correct]'));
  expect(row).toMatch(/^\| Verify \| \[axstack-correct\]\(skills\/axstack-correct\/SKILL\.md\)/);
  const workflows = readFileSync(`${root}/docs/workflows.md`, 'utf8');
  const direct = workflows.slice(workflows.indexOf('Direct routes need'), workflows.indexOf('Small, clear'));
  expect(direct).toContain('`axstack-correct`');
});

test('perf is discoverable as a routed skill in README and workflows', () => {
  const row = readme.split('\n').find((line) => line.includes('[axstack-perf]'));
  expect(row).toMatch(/^\| Build \| \[axstack-perf\]\(skills\/axstack-perf\/SKILL\.md\)/);
  const workflows = readFileSync(`${root}/docs/workflows.md`, 'utf8');
  const direct = workflows.slice(workflows.indexOf('Direct routes need'), workflows.indexOf('Small, clear'));
  expect(direct).toContain('[axstack-perf](../skills/axstack-perf/SKILL.md)');
});

test('verify is discoverable in README and workflow routes', () => {
  const row = readme.split('\n').find((line) => line.includes('[axstack-verify]'));
  expect(row).toMatch(/^\| Verify \| \[axstack-verify\]\(skills\/axstack-verify\/SKILL\.md\)/);
  const workflows = readFileSync(`${root}/docs/workflows.md`, 'utf8');
  const direct = workflows.slice(workflows.indexOf('Direct routes need'), workflows.indexOf('Small, clear'));
  expect(direct).toContain('[axstack-verify](../skills/axstack-verify/SKILL.md)');
});

// Public listings must describe both shipped modes. Discovery alone misses a
// linked skill whose description still defers maintain to a later delivery.
for (const path of ['README.md', 'docs/workflows.md']) {
  test(`${path} describes verification creation and maintenance as available`, () => {
    const text = readFileSync(`${root}/${path}`, 'utf8');
    const entry = path === 'README.md'
      ? text.split('\n').find((line) => line.includes('[axstack-verify]')) ?? ''
      : text.match(/(?:^|\n)- \[axstack-verify\][\s\S]*?(?=\n- |\n\n|$)/)?.[0] ?? '';
    const concepts = [/axstack-verify/i, /creat(?:e|ion)/i, /maintain|maintenance/i, /verification[- ]skill/i];
    const accepts = (source) => requires(source, ...concepts)
      && !/\b(?:pending|unavailable|deferred|next delivery)\b/i.test(source);
    checkRule(sentences(entry).join('. '), accepts,
      'axstack-verify handles verification-skill creation and maintenance.',
      [[/maintain|maintenance/gi, 'omit upkeep'], [/creat(?:e|ion)/gi, 'skip setup'],
        [/maintain|maintenance/gi, 'maintain mode pending'],
        [/maintain|maintenance/gi, 'maintain mode follows in the next delivery task'],
        [/^/, 'Do not ']], concepts);
  });
}

test('README explains four failure modes', () => {
  const fixes = new Map([
    ['Wrong thing built', /align[^|]*arena/i],
    ['Nobody really reviewed it', /TDD[^|]*review[^|]*revision/i],
    ['Design rot', /design lens[^|]*Improve/i],
    ['Agents left a mess', /T3[^|]*one writer[^|]*cleanup[^|]*watched own PRs merge/i],
  ]);
  for (const [failure, fix] of fixes) {
    const row = readme.split('\n').find((line) => line.startsWith(`| ${failure} |`));
    expect(row, `${failure} needs a fix`).toMatch(fix);
  }
});

test('README preserves preset and merge boundaries', () => {
  expect(readme).toMatch(/single-provider presets[^.]*not automatic cross-class or cross-provider fallbacks when a model is unavailable/i);
  checkRule(prose, (text) => requires(text,
    /mixed/i, /authored review/i, /cross-provider/i, /peer review/i,
    /isolated sessions/i, /Sol[- ]high/i, /Opus[- ]low/i),
  'In mixed, authored review is cross-provider and peer review pairs Sol-high with Opus-low in isolated sessions to check the exact revision.',
  [[/authored review/i, 'peer review'], [/isolated/i, 'shared'],
    [/Opus[- ]low/i, 'Sol high']]);
  expect(readme).toMatch(/review automation never merges/i);
  expect(readme).toMatch(/automatic\s+merge is the default under the[\s\S]*watch predicate/i);
  expect(readme).toContain('[Releases](https://github.com/axatbhardwaj/axstack/releases)');
});

test('README links every target documentation page', () => {
  for (const page of ['getting-started', 'concepts', 'guides', 'workflows', 'installation', 'host-operations', 'skill-writing']) {
    const path = `docs/${page}.md`;
    const linked = (text) => relativeLinks(text).some((href) => href.split('#')[0] === path);
    expect(existsSync(`${root}/${path}`), path).toBe(true);
    expect(linked(readme), path).toBe(true);
    // Mutate the real README in memory, including repeated links to a page.
    expect(linked(readme.replaceAll(path, 'docs/missing.md')), `${path}: removed target`).toBe(false);
    expect(linked(readme.replaceAll(path, `${path}#section`)), `${path}: anchor variant`).toBe(true);
    expect(linked(readme.replace(/\[[^\]]+\]\(/g, '[Read more](')), `${path}: renamed labels`).toBe(true);
  }
});

test('README installs skills before checking them', () => {
  const commands = readme.match(/```sh\n([\s\S]*?)```/)?.[1].trim().split('\n');
  expect(commands).toEqual([
    'bun add --global axstack',
    'export PATH="$HOME/.bun/bin:$PATH"',
    'axstack install --harness codex --preset mixed --yes',
    'axstack check --harness codex',
  ]);
});

test('README states Linux as the only supported host', () => {
  const concepts = [/supports? only|only supported/i, /Linux/i, /host/i];
  const accepts = (text) => sentences(text).some((unit) => requires(unit, ...concepts)
    && !/\b(?:unless|except|plus|also)\b/i.test(unit));
  checkRule(prose, accepts,
    'Linux is the only supported host OS.',
    [[/supports? only|only supported/i, 'supports'], [/Linux/i, 'macOS'], [/Linux/i, 'Linux plus macOS']], concepts);
});

test('README gives a bounded first task and both harness invocation forms', () => {
  const task = [/\$axstack-implement/i, /one PR/i, /preserve/i, /verify/i];
  checkRule(prose, (text) => requires(text, ...task),
    '$axstack-implement Repair the empty-state message within one PR, preserve list behavior, and verify the displayed result.',
    [[/one PR/i, 'unbounded PRs'], [/verify/i, 'skip checking']], task);
  const invocation = [/Codex/i, /\$skill/i, /Claude/i, /\/skill/i];
  checkRule(prose, (text) => requires(text, ...invocation),
    'Invoke $skill with Codex and /skill with Claude.',
    [[/Codex/i, 'Other'], [/Claude/i, 'Other']], invocation);
});

// User docs are a separate discovery surface from the skills and role notes.
for (const path of ['README.md', 'docs/workflows.md', 'docs/getting-started.md', 'docs/installation.md']) {
  test(`explain docs: ${path}: pages by default`, () => {
    const text = sentences(readFileSync(`${root}/${path}`, 'utf8')).join('. ');
    const page = [/explain|explanations/i, /default/i, /inline T3 pages?/i];
    checkRule(text, (source) => requires(source, ...page),
      'Explanations default to inline T3 pages.',
      [[/default/i, 'sometimes route'], [/inline T3 pages?/i, 'archify viewers']], page);
  });
  test(`explain docs: ${path}: viewers by request`, () => {
    const text = sentences(readFileSync(`${root}/${path}`, 'utf8')).join('. ');
    const viewer = [/use(?:s|d)?/i, /archify/i, /only/i, /explicit viewer request/i];
    checkRule(text, (source) => requires(source, ...viewer),
      'Use archify only on an explicit viewer request.',
      [[/only/i, 'also without a request'], [/explicit viewer request/i, 'complex visuals']], viewer);
  });
}
