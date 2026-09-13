// HOME trust boundary: a missing, empty, or non-absolute HOME must fail
// closed before any mutation unless --yes supplies explicit confirmation.
// Temp fixtures only; the real HOME is never touched.
import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const CLI = join(import.meta.dir, '../../bin/axstack.js');
const runCli = (args, opts) => runBunCli(CLI, args, opts);

function seed(root) {
  const bundle = writeFixtureBundle(root);
  const skillsDir = join(root, 'skills');
  const profile = join(root, 'paseo.json');
  return { bundle, skillsDir, profile };
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
    const { bundle, skillsDir, profile } = seed(root);
    // Successful baseline with a known HOME first.
    runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile, '--yes'], {
      env: { HOME: join(root, 'home') },
    });
    const before = snapshot([
      join(skillsDir, 'axstack-demo', 'SKILL.md'),
      join(skillsDir, 'axstack-demo', 'helper.md'),
      join(skillsDir, '.axstack-manifest.json'),
      profile,
    ]);
    const r = runCli(
      ['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile],
      { ...home, expectFail: true },
    );
    expect(r.out.toLowerCase()).toMatch(/home|--yes|confirm|explicit/);
    expectUnchanged(before);
  }
});

test('uninstall without HOME refuses pre-mutation and preserves all bytes', () => {
  for (const home of [{ unset: ['HOME'] }, { env: { HOME: '' } }, { env: { HOME: 'relative/path' } }]) {
    const root = makeTempRoot();
    const { bundle, skillsDir, profile } = seed(root);
    runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile, '--yes'], {
      env: { HOME: join(root, 'home') },
    });
    const before = snapshot([
      join(skillsDir, 'axstack-demo', 'SKILL.md'),
      join(skillsDir, '.axstack-manifest.json'),
      profile,
    ]);
    const r = runCli(['uninstall', '--skills-dir', skillsDir, '--profile', profile], {
      ...home,
      expectFail: true,
    });
    expect(r.out.toLowerCase()).toMatch(/home|--yes|confirm|explicit/);
    expectUnchanged(before);
  }
});

test('--yes with missing HOME still completes install and uninstall', () => {
  const root = makeTempRoot();
  const { bundle, skillsDir, profile } = seed(root);
  const installed = runCli(
    ['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile, '--yes'],
    { unset: ['HOME'] },
  );
  expect(installed.ok).toBe(true);
  expect(existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md'))).toBe(true);
  const removed = runCli(['uninstall', '--skills-dir', skillsDir, '--profile', profile, '--yes'], {
    unset: ['HOME'],
  });
  expect(removed.ok).toBe(true);
  expect(existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md'))).toBe(false);
});

test('tilde expansion without HOME errors even with --yes', () => {
  const root = makeTempRoot();
  const { bundle } = seed(root);
  const r = runCli(
    ['install', '--bundle', bundle, '--skills-dir', join('~', 'skills'), '--yes'],
    { unset: ['HOME'], expectFail: true },
  );
  expect(r.out.toLowerCase()).toMatch(/home|unknown|destination|refus/);
});
