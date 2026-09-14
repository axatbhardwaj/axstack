import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const CLI = join(import.meta.dir, '../../bin/axstack.js');
const runCli = (args, opts) => runBunCli(CLI, args, opts);
const install = (bundle, skillsDir, opts) => runCli([
  'install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir,
], opts);

test('unknown identical pre-existing skill file is neither adopted nor removed', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const skillsDir = join(root, 'skills');
  const skill = join(skillsDir, 'axstack-demo', 'SKILL.md');
  mkdirSync(join(skillsDir, 'axstack-demo'), { recursive: true });
  writeFileSync(skill, '# Axstack Demo\n\nFixture skill for installer tests.\n');
  install(bundle, skillsDir);
  runCli(['uninstall', '--skills-dir', skillsDir]);
  expect(existsSync(skill)).toBe(true);
});

test('symlinked skill subdir is refused before any outside write', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const skillsDir = join(root, 'skills');
  const outside = join(root, 'outside');
  mkdirSync(skillsDir, { recursive: true });
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(outside, 'sentinel.txt'), 'outside data\n');
  symlinkSync(outside, join(skillsDir, 'axstack-demo'));
  expect(install(bundle, skillsDir, { expectFail: true }).out).toMatch(/symlink|unsafe|refus/i);
  expect(existsSync(join(outside, 'SKILL.md'))).toBe(false);
});

test('uninstall refuses to delete through a symlinked subdir', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const skillsDir = join(root, 'skills');
  install(bundle, skillsDir);
  const outside = join(root, 'outside');
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(outside, 'SKILL.md'), 'outside decoy\n');
  rmSync(join(skillsDir, 'axstack-demo'), { recursive: true });
  symlinkSync(outside, join(skillsDir, 'axstack-demo'));
  expect(runCli(['uninstall', '--skills-dir', skillsDir], { expectFail: true }).out)
    .toMatch(/symlink|unsafe|refus/i);
  expect(readFileSync(join(outside, 'SKILL.md'), 'utf8')).toBe('outside decoy\n');
});

test('symlinked target root is canonicalized and stays contained', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const real = join(root, 'real-skills');
  const linked = join(root, 'linked-skills');
  mkdirSync(real, { recursive: true });
  symlinkSync(real, linked);
  install(bundle, linked);
  expect(existsSync(join(real, 'axstack-demo', 'SKILL.md'))).toBe(true);
  expect(existsSync(join(real, 'axstack', 'roles.json'))).toBe(true);
});

test('bundle with symlinked skills root is rejected before any write', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const outside = join(root, 'outside-skills');
  const skillsDir = join(root, 'installed');
  renameSync(join(bundle, 'skills'), outside);
  symlinkSync(outside, join(bundle, 'skills'));
  expect(install(bundle, skillsDir, { expectFail: true }).out).toMatch(/symlink|unsafe|reject/i);
  expect(existsSync(skillsDir)).toBe(false);
});

test('mixed real and symlinked top-level skill entries are rejected pre-write', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const outside = join(root, 'outside');
  mkdirSync(outside, { recursive: true });
  symlinkSync(outside, join(bundle, 'skills', 'axstack-evil'));
  const skillsDir = join(root, 'installed');
  expect(install(bundle, skillsDir, { expectFail: true }).out).toMatch(/symlink|unsafe|reject/i);
  expect(existsSync(skillsDir)).toBe(false);
});
