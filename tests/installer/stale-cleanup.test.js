// Stale owned cleanup: pristine stale files are removed on reinstall,
// edited or already-missing stale files stay reported as stale.
// Uninstall behavior is unchanged.
import { expect, test } from 'bun:test';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
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

test('retired then edited stale file survives reinstall and uninstall as preserved', () => {
  const root = makeTempRoot('axstack-stale-uninstall-');
  const bundle = bundleWithStaleFile(root);
  const skillsDir = join(root, 'skills');
  install(bundle, skillsDir);

  // Retire old.md, then user-edit the stale copy: reinstall must preserve it.
  retireFromBundle(bundle);
  writeFileSync(staleDest(skillsDir), '# User edit\n\nHands off.\n');
  const second = install(bundle, skillsDir);
  expect(second.ok).toBe(true);
  expect(readFileSync(staleDest(skillsDir), 'utf8')).toBe('# User edit\n\nHands off.\n');
  expect(STALE_REL in manifestFiles(skillsDir)).toBe(true);

  // Uninstall must preserve the edited stale entry and report it.
  const un = runCli(['uninstall', '--skills-dir', skillsDir]);
  expect(un.ok).toBe(true);
  expect(readFileSync(staleDest(skillsDir), 'utf8')).toBe('# User edit\n\nHands off.\n');
  expect(un.out).toMatch(/preserved/i);
  expect(un.out).toContain('old.md');
});

test('unsafe stale path refuses before any target mutation (zero-mutation guard)', () => {
  const root = makeTempRoot('axstack-stale-unsafe-');
  const bundle = writeFixtureBundle(root, {
    skillName: 'axstack-demo',
    supportFiles: { 'helper.md': '# Helper\n' },
  });
  // Second skill supplies the stale entry; its install dir is later swapped
  // for an outside symlink so the stale ancestry check must refuse.
  const retiredDir = join(bundle, 'skills', 'axstack-retired');
  mkdirSync(retiredDir, { recursive: true });
  writeFileSync(join(retiredDir, 'SKILL.md'), '# Retired\n');
  writeFileSync(join(retiredDir, 'old.md'), '# Old\n');
  const skillsDir = join(root, 'skills');
  install(bundle, skillsDir);

  const activeFile = join(skillsDir, 'axstack-demo', 'SKILL.md');
  const beforeBytes = readFileSync(activeFile, 'utf8');
  const beforeIno = statSync(activeFile).ino;

  // Retire the whole retired skill (so no desired file lives under the
  // symlinked dir) and update the active skill so phase 2 would mutate.
  rmSync(retiredDir, { recursive: true, force: true });
  writeFileSync(join(bundle, 'skills', 'axstack-demo', 'SKILL.md'), '# Axstack Demo v2\n');
  // Swap the retired install dir for a symlink escaping the skills root.
  const outsideDir = join(root, 'outside');
  mkdirSync(outsideDir, { recursive: true });
  writeFileSync(join(outsideDir, 'sentinel.txt'), 'outside\n');
  rmSync(join(skillsDir, 'axstack-retired'), { recursive: true, force: true });
  symlinkSync(outsideDir, join(skillsDir, 'axstack-retired'));

  const second = install(bundle, skillsDir, { expectFail: true });
  expect(second.ok).toBe(false);
  expect(second.out).toMatch(/unsafe target|symlink/i);
  // Zero target mutations: active file bytes and inode are untouched.
  expect(readFileSync(activeFile, 'utf8')).toBe(beforeBytes);
  expect(statSync(activeFile).ino).toBe(beforeIno);
});

test('stale-removal rollback restores bytes and mode when a later step fails', () => {
  const root = makeTempRoot('axstack-stale-rollback-');
  const bundle = bundleWithStaleFile(root);
  const skillsDir = join(root, 'skills');
  install(bundle, skillsDir);
  const stale = staleDest(skillsDir);
  const beforeBytes = readFileSync(stale, 'utf8');
  chmodSync(stale, 0o640);

  retireFromBundle(bundle);
  // Force the manifest write to fail through the guarded temp path.
  writeFileSync(join(skillsDir, '.axstack-manifest.json.tmp'), 'leftover\n');

  const second = install(bundle, skillsDir, { expectFail: true });
  expect(second.ok).toBe(false);
  expect(existsSync(stale)).toBe(true);
  expect(readFileSync(stale, 'utf8')).toBe(beforeBytes);
  expect(statSync(stale).mode & 0o777).toBe(0o640);
  expect(STALE_REL in manifestFiles(skillsDir)).toBe(true);
});
