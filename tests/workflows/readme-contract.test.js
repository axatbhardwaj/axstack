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
  for (const failure of ['Wrong thing built', 'Nobody really reviewed it', 'Design rot', 'Agents left a mess']) {
    expect(why).toContain(failure);
  }
  expect(readme).toContain('> [!NOTE]');
  expect(readme).toContain('<details>');
  expect(readme).toContain('axstack check --harness codex');
  expect(readme).toContain('axstack install --harness codex --preset mixed --yes');
});
