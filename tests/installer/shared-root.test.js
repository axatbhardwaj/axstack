import { afterEach, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const CLI = join(import.meta.dir, '../../bin/axstack.js');
const FIRST_LINE = 'Use Axstack for engineering work: invoke the matching `axstack-*` skill directly.';
const PHASE_SKILLS = [
  'axstack-align',
  'axstack-audit',
  'axstack-cleanup',
  'axstack-debug',
  'axstack-explain',
  'axstack-implement',
  'axstack-improve',
  'axstack-relay',
  'axstack-research',
  'axstack-review',
  'axstack-spec',
  'axstack-tickets',
  'axstack-watch',
];
const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixtureRoot(prefix) {
  const root = makeTempRoot(prefix);
  roots.push(root);
  return root;
}

function writeSharedRootBundle(root, { allPhases = false } = {}) {
  const skillNames = allPhases ? PHASE_SKILLS : [PHASE_SKILLS[0]];
  const bundle = writeFixtureBundle(root, { skillName: skillNames[0] });
  for (const skillName of skillNames.slice(1)) {
    const skillDir = join(bundle, 'skills', skillName);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), `# ${skillName}\n`);
  }
  const references = join(bundle, 'skills', 'axstack', 'references');
  mkdirSync(references, { recursive: true });
  writeFileSync(join(references, 'contracts.md'), '# Contracts\n');
  return bundle;
}

test('shared axstack root without SKILL.md installs', () => {
  const root = fixtureRoot('axstack-shared-root-');
  const bundle = writeSharedRootBundle(root);
  const skillsDir = join(root, 'installed');

  const result = runBunCli(CLI, [
    'install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir,
  ]);

  expect(result.ok).toBe(true);
  expect(existsSync(join(skillsDir, 'axstack', 'references', 'contracts.md'))).toBe(true);
});

test('axstack-* directory without SKILL.md keeps the existing validation error', () => {
  const root = fixtureRoot('axstack-missing-skill-');
  const bundle = writeSharedRootBundle(root);
  mkdirSync(join(bundle, 'skills', 'axstack-x'));

  const result = runBunCli(CLI, [
    'install', '--preset', 'mixed', '--bundle', bundle,
    '--skills-dir', join(root, 'installed'),
  ], { expectFail: true });

  expect(result.out).toContain('skill axstack-x is missing SKILL.md');
});

test('full phase fixture installs the shared-root directory set into a temporary home', () => {
  const root = fixtureRoot('axstack-shared-home-');
  const bundle = writeSharedRootBundle(root, { allPhases: true });

  runBunCli(CLI, [
    'install', '--preset', 'mixed', '--bundle', bundle,
    '--harness', 'claude', '--no-claude-settings', '--yes',
  ], { env: { HOME: root } });

  const skillsDir = join(root, '.claude', 'skills');
  expect(readdirSync(skillsDir).filter((name) => !name.startsWith('.')).sort()).toEqual([
    'axstack',
    ...PHASE_SKILLS,
  ]);
  for (const skillName of PHASE_SKILLS) {
    expect(existsSync(join(skillsDir, skillName, 'SKILL.md'))).toBe(true);
  }
  expect(existsSync(join(skillsDir, 'axstack', 'references'))).toBe(true);
  expect(existsSync(join(skillsDir, 'axstack', 'roles.json'))).toBe(true);
  expect(existsSync(join(skillsDir, 'axstack', 'SKILL.md'))).toBe(false);
  expect(readFileSync(join(root, '.claude', 'CLAUDE.md'), 'utf8').split('\n')[1]).toBe(FIRST_LINE);
});
