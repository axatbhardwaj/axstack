// Behavioral contract: install into an explicit temp target, idempotent
// reinstall, unrelated files survive, user edits preserved, uninstall only
// removes unchanged owned assets, escaping bundles rejected pre-write.
import { expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const CLI = join(import.meta.dir, '../../bin/axstack.js');
const runCli = (args, opts) => runBunCli(CLI, args, opts);

function installTargets(root) {
  return {
    skillsDir: join(root, 'target-skills'),
    profile: join(root, 'paseo-config.json'),
  };
}

test('install copies fixture bundle, keeps unrelated sentinel byte-identical', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const { skillsDir, profile } = installTargets(root);
  mkdirSync(skillsDir, { recursive: true });
  const sentinel = join(skillsDir, 'unrelated.txt');
  writeFileSync(sentinel, 'do not touch\n');

  const r = runCli([
    'install',
    '--bundle',
    bundle,
    '--skills-dir',
    skillsDir,
    '--profile',
    profile,
  ]);
  expect(r.ok).toBe(true);

  const installed = readFileSync(
    join(skillsDir, 'axstack-demo', 'SKILL.md'),
    'utf8',
  );
  expect(installed.includes('Axstack Demo')).toBe(true);
  expect(readFileSync(sentinel, 'utf8')).toBe('do not touch\n');
});

test('second install is idempotent (no content changes)', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const { skillsDir, profile } = installTargets(root);

  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile]);
  const before = readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8');
  const second = runCli([
    'install',
    '--bundle',
    bundle,
    '--skills-dir',
    skillsDir,
    '--profile',
    profile,
  ]);
  expect(second.ok).toBe(true);
  expect(readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8')).toBe(before);
  expect(second.out.toLowerCase()).toMatch(/idempotent|no changes|up to date|unchanged/);
});

test('user-edited owned asset survives reinstall and uninstall', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const { skillsDir, profile } = installTargets(root);
  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile]);

  const owned = join(skillsDir, 'axstack-demo', 'SKILL.md');
  writeFileSync(owned, '# User edited\n\nHands off.\n');
  const reinstall = runCli([
    'install',
    '--bundle',
    bundle,
    '--skills-dir',
    skillsDir,
    '--profile',
    profile,
  ]);
  expect(reinstall.ok).toBe(true);
  expect(readFileSync(owned, 'utf8')).toBe('# User edited\n\nHands off.\n');

  const un = runCli(['uninstall', '--skills-dir', skillsDir, '--profile', profile]);
  expect(un.ok).toBe(true);
  expect(readFileSync(owned, 'utf8')).toBe('# User edited\n\nHands off.\n');
});

test('uninstall removes unchanged owned assets but preserves sentinel', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const { skillsDir, profile } = installTargets(root);
  mkdirSync(skillsDir, { recursive: true });
  const sentinel = join(skillsDir, 'keep-me.txt');
  writeFileSync(sentinel, 'sentinel\n');

  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile]);
  expect(existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md'))).toBe(true);
  runCli(['uninstall', '--skills-dir', skillsDir, '--profile', profile]);
  expect(existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md'))).toBe(false);
  expect(readFileSync(sentinel, 'utf8')).toBe('sentinel\n');
});

test('bundle with escaping symlink is rejected before any target write', () => {
  const root = makeTempRoot();
  const bundle = join(root, 'evil-bundle');
  const skillDir = join(bundle, 'skills', 'axstack-evil');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), '# Evil\n');
  symlinkSync('/etc/hostname', join(skillDir, 'escape-link'));

  const { skillsDir } = installTargets(root);
  const r = runCli(
    ['install', '--bundle', bundle, '--skills-dir', skillsDir],
    { expectFail: true },
  );
  expect(r.out.toLowerCase()).toMatch(/symlink|escape|reject|unsafe/);
  expect(existsSync(join(skillsDir, 'axstack-evil', 'SKILL.md'))).toBe(false);
});

test('unknown pre-existing file at bundle path is not silently overwritten', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const { skillsDir } = installTargets(root);
  mkdirSync(join(skillsDir, 'axstack-demo'), { recursive: true });
  writeFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), '# Someone else\n');

  const r = runCli(
    ['install', '--bundle', bundle, '--skills-dir', skillsDir],
    { expectFail: true },
  );
  expect(r.out.toLowerCase()).toMatch(/already exists|unknown|refus|overwrite|force/);
  expect(
    readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8'),
  ).toBe('# Someone else\n');
});

test('install into real home requires explicit confirmation', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const home = Bun.env.HOME ?? '/root';
  const guarded = join(home, '.axstack-installer-probe-nope');
  const r = runCli(
    ['install', '--bundle', bundle, '--skills-dir', guarded],
    { expectFail: true },
  );
  expect(r.out.toLowerCase()).toMatch(/confirm|--yes|explicit|home/);
  expect(existsSync(join(guarded, 'axstack-demo', 'SKILL.md'))).toBe(false);
});

test('--harness grok is rejected without an explicit --skills-dir override', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const r = runCli(['install', '--bundle', bundle, '--harness', 'grok'], {
    expectFail: true,
  });
  expect(r.out.toLowerCase()).toMatch(/--skills-dir|explicit|unverified/);
});

test('partial failure rolls back created files and writes no manifest', () => {
  const root = makeTempRoot();
  // Two skills sort: axstack-aaa installs first, axstack-zzz fails second.
  const bundle = writeFixtureBundle(root, { skillName: 'axstack-aaa' });
  writeFixtureBundle(root, { skillName: 'axstack-zzz' });
  const { skillsDir } = installTargets(root);
  // A directory where a bundle file must go makes that write fail midway.
  mkdirSync(join(skillsDir, 'axstack-zzz'), { recursive: true });
  mkdirSync(join(skillsDir, 'axstack-zzz', 'SKILL.md'));

  const r = runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir], {
    expectFail: true,
  });
  expect(r.out.toLowerCase()).toMatch(/axstack/);
  // axstack-aaa was created in this run: rolled back, manifest never written.
  expect(existsSync(join(skillsDir, 'axstack-aaa', 'SKILL.md'))).toBe(false);
  expect(existsSync(join(skillsDir, '.axstack-manifest.json'))).toBe(false);
});

test('--harness codex honors CODEX_HOME outside the home guard', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const codexHome = join(root, 'codex-home');
  mkdirSync(codexHome, { recursive: true });
  const r = runCli(['install', '--bundle', bundle, '--harness', 'codex'], {
    env: { CODEX_HOME: codexHome },
  });
  expect(r.ok).toBe(true);
  expect(existsSync(join(codexHome, 'skills', 'axstack-demo', 'SKILL.md'))).toBe(true);
});

test('--harness codex without CODEX_HOME needs explicit home confirmation', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const r = runCli(['install', '--bundle', bundle, '--harness', 'codex'], {
    expectFail: true,
  });
  expect(r.out.toLowerCase()).toMatch(/confirm|--yes|explicit|home/);
});

test('uninstall with a home profile requires --yes even when skills are external', () => {
  const root = makeTempRoot();
  const fakeHome = join(root, 'home');
  const bundle = writeFixtureBundle(root);
  const skillsDir = join(root, 'skills'); // outside the fake home
  const profile = join(fakeHome, '.config', 'paseo', 'config.json');
  const env = { HOME: fakeHome };

  const installed = runCli(
    ['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile, '--yes'],
    { env },
  );
  expect(installed.ok).toBe(true);
  expect(
    JSON.parse(readFileSync(profile, 'utf8')).daemon.agentProfiles.some(
      (p) => p.id === 'axstack-driver',
    ),
  ).toBe(true);

  // Without --yes: refuse before any skill/profile/manifest mutation.
  const refused = runCli(['uninstall', '--skills-dir', skillsDir, '--profile', profile], {
    expectFail: true,
    env,
  });
  expect(refused.out.toLowerCase()).toMatch(/confirm|--yes|explicit|home/);
  expect(existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md'))).toBe(true);
  expect(
    JSON.parse(readFileSync(profile, 'utf8')).daemon.agentProfiles.some(
      (p) => p.id === 'axstack-driver',
    ),
  ).toBe(true);
  expect(existsSync(join(skillsDir, '.axstack-manifest.json'))).toBe(true);

  // With --yes: the intended uninstall succeeds.
  const removed = runCli(
    ['uninstall', '--skills-dir', skillsDir, '--profile', profile, '--yes'],
    { env },
  );
  expect(removed.ok).toBe(true);
  expect(existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md'))).toBe(false);
  expect(
    JSON.parse(readFileSync(profile, 'utf8')).daemon.agentProfiles.some(
      (p) => p.id === 'axstack-driver',
    ),
  ).toBe(false);
});
