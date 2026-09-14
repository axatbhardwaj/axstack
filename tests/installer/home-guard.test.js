// HOME trust boundary: a missing, empty, or non-absolute HOME must fail
// closed before any mutation unless --yes supplies explicit confirmation.
// Temp fixtures only; the real HOME is never touched.
import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const CLI = join(import.meta.dir, '../../bin/axstack.js');
const runCli = (args, opts) => runBunCli(CLI, args, opts);

function seed(root) {
  const bundle = writeFixtureBundle(root);
  const skillsDir = join(root, 'skills');
  return { bundle, skillsDir };
}

function snapshot(paths) {
  return new Map(paths.map((p) => [p, existsSync(p) ? readFileSync(p) : null]));
}

function expectUnchanged(before) {
  for (const [p, bytes] of before) {
    if (bytes === null) expect(existsSync(p)).toBe(false);
    else expect(readFileSync(p).equals(bytes)).toBe(true);
  }
}

test('install without HOME refuses pre-mutation and preserves all bytes', () => {
  for (const home of [{ unset: ['HOME'] }, { env: { HOME: '' } }, { env: { HOME: 'relative/path' } }]) {
    const root = makeTempRoot();
    const { bundle, skillsDir } = seed(root);
    // Successful baseline with a known HOME first.
    runCli(['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir, '--yes'], {
      env: { HOME: join(root, 'home') },
    });
    const before = snapshot([
      join(skillsDir, 'axstack-demo', 'SKILL.md'),
      join(skillsDir, 'axstack-demo', 'helper.md'),
      join(skillsDir, '.axstack-manifest.json'),
      join(skillsDir, 'axstack', 'roles.json'),
    ]);
    const r = runCli(
      ['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir],
      { ...home, expectFail: true },
    );
    expect(r.out.toLowerCase()).toMatch(/home|--yes|confirm|explicit/);
    expectUnchanged(before);
  }
});

test('uninstall without HOME refuses pre-mutation and preserves all bytes', () => {
  for (const home of [{ unset: ['HOME'] }, { env: { HOME: '' } }, { env: { HOME: 'relative/path' } }]) {
    const root = makeTempRoot();
    const { bundle, skillsDir } = seed(root);
    runCli(['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir, '--yes'], {
      env: { HOME: join(root, 'home') },
    });
    const before = snapshot([
      join(skillsDir, 'axstack-demo', 'SKILL.md'),
      join(skillsDir, '.axstack-manifest.json'),
      join(skillsDir, 'axstack', 'roles.json'),
    ]);
    const r = runCli(['uninstall', '--skills-dir', skillsDir], {
      ...home,
      expectFail: true,
    });
    expect(r.out.toLowerCase()).toMatch(/home|--yes|confirm|explicit/);
    expectUnchanged(before);
  }
});

test('--yes with missing HOME still completes install and uninstall', () => {
  const root = makeTempRoot();
  const { bundle, skillsDir } = seed(root);
  const installed = runCli(
    ['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir, '--yes'],
    { unset: ['HOME'] },
  );
  expect(installed.ok).toBe(true);
  expect(existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md'))).toBe(true);
  const removed = runCli(['uninstall', '--skills-dir', skillsDir, '--yes'], {
    unset: ['HOME'],
  });
  expect(removed.ok).toBe(true);
  expect(existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md'))).toBe(false);
});

test('tilde expansion without HOME errors even with --yes', () => {
  const root = makeTempRoot();
  const { bundle } = seed(root);
  const r = runCli(
    ['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', join('~', 'skills'), '--yes'],
    { unset: ['HOME'], expectFail: true },
  );
  expect(r.out.toLowerCase()).toMatch(/home|unknown|destination|refus/);
});

test('symlink-aliased HOME still guards install without --yes', () => {
  const root = makeTempRoot();
  const realHome = join(root, 'real-home');
  mkdirSync(realHome, { recursive: true });
  const aliasHome = join(root, 'alias-home');
  symlinkSync(realHome, aliasHome);
  const { bundle } = seed(root);
  const skillsDir = join(aliasHome, '.codex', 'skills');
  const env = { HOME: aliasHome };

  const installed = runCli(
    ['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir, '--yes'],
    { env },
  );
  expect(installed.ok).toBe(true);
  const before = snapshot([
    join(skillsDir, 'axstack-demo', 'SKILL.md'),
    join(skillsDir, '.axstack-manifest.json'),
    join(skillsDir, 'axstack', 'roles.json'),
  ]);
  // The profile canonicalizes through the alias while raw HOME does not:
  // the guard must still refuse before any mutation.
  const r = runCli(
    ['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir],
    { env, expectFail: true },
  );
  expect(r.out.toLowerCase()).toMatch(/home|--yes|confirm|explicit/);
  expectUnchanged(before);
});

test('symlink-aliased HOME still guards uninstall without --yes', () => {
  const root = makeTempRoot();
  const realHome = join(root, 'real-home');
  mkdirSync(realHome, { recursive: true });
  const aliasHome = join(root, 'alias-home');
  symlinkSync(realHome, aliasHome);
  const { bundle } = seed(root);
  const skillsDir = join(aliasHome, '.codex', 'skills');
  const env = { HOME: aliasHome };

  const installed = runCli(
    ['install', '--preset', 'mixed', '--bundle', bundle, '--skills-dir', skillsDir, '--yes'],
    { env },
  );
  expect(installed.ok).toBe(true);
  const before = snapshot([
    join(skillsDir, 'axstack-demo', 'SKILL.md'),
    join(skillsDir, '.axstack-manifest.json'),
    join(skillsDir, 'axstack', 'roles.json'),
  ]);
  const r = runCli(['uninstall', '--skills-dir', skillsDir], {
    env,
    expectFail: true,
  });
  expect(r.out.toLowerCase()).toMatch(/home|--yes|confirm|explicit/);
  expectUnchanged(before);

  const removed = runCli(
    ['uninstall', '--skills-dir', skillsDir, '--yes'],
    { env },
  );
  expect(removed.ok).toBe(true);
  expect(existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md'))).toBe(false);
});
