import { test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const readme = readFileSync(`${root}/README.md`, 'utf8');

test('README leads with the workflow and groups linked skills by layer', () => {
  const intro = readme.slice(0, readme.indexOf('## What you can do'));
  expect(intro).toMatch(/align → spec → tickets → implement → review → watch/);

  const skills = readme.slice(readme.indexOf('## What you can do'), readme.indexOf('## Why Axstack'));
  for (const layer of ['Plan', 'Build', 'Verify', 'Operate', 'Understand']) {
    expect(skills).toContain(`| ${layer} |`);
  }
  const rows = skills.split('\n').filter((line) => line.startsWith('| '));
  expect(rows.find((line) => line.includes('[axstack-improve]'))).toMatch(/^\| Verify \|/);
  expect(rows.filter((line) => line.startsWith('| Understand |')).join('\n'))
    .not.toContain('axstack-improve');

  const linkedSkills = [...skills.matchAll(/\[axstack-[^\]]+\]\((skills\/[^)]+\/SKILL\.md)\)/g)];
  expect(linkedSkills).toHaveLength(13);
  for (const [, path] of linkedSkills) expect(existsSync(`${root}/${path}`), path).toBe(true);
});

test('README explains four failure modes and gives a compact first run', () => {
  const why = readme.slice(readme.indexOf('## Why Axstack'), readme.indexOf('## Quick start'));
  const fixes = new Map([
    ['Wrong thing built', /align[^|]*arena/i],
    ['Nobody really reviewed it', /TDD[^|]*review[^|]*revision/i],
    ['Design rot', /design lens[^|]*Improve/i],
    ['Agents left a mess', /Orca[^|]*one writer[^|]*cleanup[^|]*human merges/i],
  ]);
  for (const [failure, fix] of fixes) {
    const row = why.split('\n').find((line) => line.startsWith(`| ${failure} |`));
    expect(row, `${failure} needs a fix`).toMatch(fix);
  }
  expect(readme).toContain('> [!NOTE]');
  expect(readme).toContain('<details>');
  expect(readme).toContain('axstack check --harness codex');
  expect(readme).toContain('axstack install --harness codex --preset mixed --yes');
});

test('README preserves preset and merge boundaries', () => {
  const presets = readme.slice(readme.indexOf('Choose one explicit preset'), readme.indexOf('## Optional PR automation'));
  expect(presets).toMatch(/single-provider presets[^.]*not automatic fallbacks when a model is unavailable/i);
  const why = readme.slice(readme.indexOf('## Why Axstack'), readme.indexOf('## Quick start'));
  expect(why).toMatch(/mixed[^|]*cross-provider review/i);
  const automation = readme.slice(readme.indexOf('## Optional PR automation'), readme.indexOf('## Some notes'));
  expect(automation).toMatch(/review automation never merges/i);
  expect(readme).toMatch(/The human merges by default\./);
  expect(readme).toContain('[Releases](https://github.com/axatbhardwaj/axstack/releases)');
});
