// Stale owned cleanup: pristine stale files are removed on reinstall,
// edited or already-missing stale files stay reported as stale.
// Uninstall behavior is unchanged.
import { expect, test } from 'bun:test';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const CLI = join(import.meta.dir, '../../bin/axstack.js');
const runCli = (args, opts) => runBunCli(CLI, args, opts);
const install = (bundle, skillsDir, opts) => runCli(
  ['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir],
  opts,
);

const STALE_REL = 'axstack-demo/old.md';
const staleDest = (skillsDir) => join(skillsDir, ...STALE_REL.split('/'));
const manifestFiles = (skillsDir) => JSON.parse(
  readFileSync(join(skillsDir, '.axstack-manifest.json'), 'utf8'),
).files;

function bundleWithStaleFile(root) {
  const bundle = writeFixtureBundle(root, {
    supportFiles: {
      'helper.md': '# Helper\n\nSupporting fixture.\n',
      'old.md': '# Old\n\nRetired fixture.\n',
    },
  });
  return bundle;
}

function retireFromBundle(bundle) {
  rmSync(join(bundle, 'skills', 'axstack-demo', 'old.md'));
}

test('pristine stale owned file is removed, dropped from manifest, reported as removed', () => {
  const root = makeTempRoot('axstack-stale-pristine-');
  const bundle = bundleWithStaleFile(root);
  const skillsDir = join(root, 'skills');
  install(bundle, skillsDir);
  expect(existsSync(staleDest(skillsDir))).toBe(true);

  retireFromBundle(bundle);
  const second = install(bundle, skillsDir);
  expect(second.ok).toBe(true);
  expect(existsSync(staleDest(skillsDir))).toBe(false);
  expect(STALE_REL in manifestFiles(skillsDir)).toBe(false);
  expect(second.out).toMatch(/removed:/i);
  expect(second.out).toContain('old.md');
});

test('edited stale owned file is preserved, kept in manifest, reported as stale', () => {
  const root = makeTempRoot('axstack-stale-edited-');
  const bundle = bundleWithStaleFile(root);
  const skillsDir = join(root, 'skills');
  install(bundle, skillsDir);
  writeFileSync(staleDest(skillsDir), '# User edit\n\nHands off.\n');

  retireFromBundle(bundle);
  const second = install(bundle, skillsDir);
  expect(second.ok).toBe(true);
  expect(readFileSync(staleDest(skillsDir), 'utf8')).toBe('# User edit\n\nHands off.\n');
  expect(STALE_REL in manifestFiles(skillsDir)).toBe(true);
  expect(second.out).toMatch(/stale/i);
  expect(second.out).toContain('old.md');
  expect(second.out).not.toMatch(/removed:.*old\.md/i);
});

test('already-missing stale file stays reported as stale with manifest hash kept', () => {
  const root = makeTempRoot('axstack-stale-missing-');
  const bundle = bundleWithStaleFile(root);
  const skillsDir = join(root, 'skills');
  install(bundle, skillsDir);
  rmSync(staleDest(skillsDir));

  retireFromBundle(bundle);
  const second = install(bundle, skillsDir);
  expect(second.ok).toBe(true);
  expect(existsSync(staleDest(skillsDir))).toBe(false);
  expect(STALE_REL in manifestFiles(skillsDir)).toBe(true);
  expect(second.out).toMatch(/stale/i);
  expect(second.out).toContain('old.md');
});

test('uninstall still removes pristine owned files and preserves user edits', () => {
  const root = makeTempRoot('axstack-stale-uninstall-');
  const bundle = bundleWithStaleFile(root);
  const skillsDir = join(root, 'skills');
  install(bundle, skillsDir);
  const ownedSkill = join(skillsDir, 'axstack-demo', 'SKILL.md');
  writeFileSync(ownedSkill, '# User edited\n\nHands off.\n');

  const un = runCli(['uninstall', '--skills-dir', skillsDir]);
  expect(un.ok).toBe(true);
  expect(existsSync(staleDest(skillsDir))).toBe(false);
  expect(readFileSync(ownedSkill, 'utf8')).toBe('# User edited\n\nHands off.\n');
  expect(un.out).toMatch(/removed:.*old\.md/i);
  expect(un.out).toMatch(/preserved/i);
});
