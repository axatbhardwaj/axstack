// Behavioral contract: install into an explicit temp target, idempotent
// reinstall, unrelated files survive, user edits preserved, uninstall only
// removes unchanged owned assets, escaping bundles rejected pre-write.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTempRoot, writeFixtureBundle } from './helpers.js';

const CLI = fileURLToPath(new URL('../../bin/axstack.js', import.meta.url));

function runCli(args, { expectFail = false, env } = {}) {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...(env ? { env: { ...process.env, ...env } } : {}),
    });
    assert.ok(!expectFail, `expected failure but succeeded: ${out}`);
    return { ok: true, out };
  } catch (err) {
    assert.ok(expectFail, `CLI failed unexpectedly: ${err.stderr ?? err.message}`);
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

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
  assert.ok(r.ok);

  const installed = readFileSync(
    join(skillsDir, 'axstack-demo', 'SKILL.md'),
    'utf8',
  );
  assert.ok(installed.includes('Axstack Demo'));
  assert.equal(readFileSync(sentinel, 'utf8'), 'do not touch\n');
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
  assert.ok(second.ok);
  assert.equal(readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8'), before);
  assert.match(second.out.toLowerCase(), /idempotent|no changes|up to date|unchanged/);
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
  assert.ok(reinstall.ok);
  assert.equal(readFileSync(owned, 'utf8'), '# User edited\n\nHands off.\n');

  const un = runCli(['uninstall', '--skills-dir', skillsDir, '--profile', profile]);
  assert.ok(un.ok);
  assert.equal(readFileSync(owned, 'utf8'), '# User edited\n\nHands off.\n');
});

test('uninstall removes unchanged owned assets but preserves sentinel', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const { skillsDir, profile } = installTargets(root);
  mkdirSync(skillsDir, { recursive: true });
  const sentinel = join(skillsDir, 'keep-me.txt');
  writeFileSync(sentinel, 'sentinel\n');

  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile]);
  assert.ok(existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md')));
  runCli(['uninstall', '--skills-dir', skillsDir, '--profile', profile]);
  assert.ok(!existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md')));
  assert.equal(readFileSync(sentinel, 'utf8'), 'sentinel\n');
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
  assert.match(r.out.toLowerCase(), /symlink|escape|reject|unsafe/);
  assert.ok(!existsSync(join(skillsDir, 'axstack-evil', 'SKILL.md')));
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
  assert.match(r.out.toLowerCase(), /already exists|unknown|refus|overwrite|force/);
  assert.equal(
    readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8'),
    '# Someone else\n',
  );
});

test('install into real home requires explicit confirmation', () => {  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const home = process.env.HOME ?? '/root';
  const guarded = join(home, '.axstack-installer-probe-nope');
  const r = runCli(
    ['install', '--bundle', bundle, '--skills-dir', guarded],
    { expectFail: true },
  );
  assert.match(r.out.toLowerCase(), /confirm|--yes|explicit|home/);
  assert.ok(!existsSync(join(guarded, 'axstack-demo', 'SKILL.md')));
});

test('--harness grok is rejected without an explicit --skills-dir override', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const r = runCli(['install', '--bundle', bundle, '--harness', 'grok'], {
    expectFail: true,
  });
  assert.match(r.out.toLowerCase(), /--skills-dir|explicit|unverified/);
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
  assert.match(r.out.toLowerCase(), /axstack/);
  // axstack-aaa was created in this run: rolled back, manifest never written.
  assert.ok(!existsSync(join(skillsDir, 'axstack-aaa', 'SKILL.md')));
  assert.ok(!existsSync(join(skillsDir, '.axstack-manifest.json')));
});

test('--harness codex honors CODEX_HOME outside the home guard', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const codexHome = join(root, 'codex-home');
  mkdirSync(codexHome, { recursive: true });
  const r = runCli(['install', '--bundle', bundle, '--harness', 'codex'], {
    env: { CODEX_HOME: codexHome },
  });
  assert.ok(r.ok);
  assert.ok(existsSync(join(codexHome, 'skills', 'axstack-demo', 'SKILL.md')));
});

test('--harness codex without CODEX_HOME needs explicit home confirmation', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root);
  const r = runCli(['install', '--bundle', bundle, '--harness', 'codex'], {
    expectFail: true,
  });
  assert.match(r.out.toLowerCase(), /confirm|--yes|explicit|home/);
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
  assert.ok(installed.ok);
  assert.ok(
    JSON.parse(readFileSync(profile, 'utf8')).daemon.agentProfiles.some(
      (p) => p.id === 'axstack-driver',
    ),
  );

  // Without --yes: refuse before any skill/profile/manifest mutation.
  const refused = runCli(['uninstall', '--skills-dir', skillsDir, '--profile', profile], {
    expectFail: true,
    env,
  });
  assert.match(refused.out.toLowerCase(), /confirm|--yes|explicit|home/);
  assert.ok(existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md')));
  assert.ok(
    JSON.parse(readFileSync(profile, 'utf8')).daemon.agentProfiles.some(
      (p) => p.id === 'axstack-driver',
    ),
    'home profile must be untouched by a refused uninstall',
  );
  assert.ok(existsSync(join(skillsDir, '.axstack-manifest.json')));

  // With --yes: the intended uninstall succeeds.
  const removed = runCli(
    ['uninstall', '--skills-dir', skillsDir, '--profile', profile, '--yes'],
    { env },
  );
  assert.ok(removed.ok);
  assert.ok(!existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md')));
  assert.ok(
    !JSON.parse(readFileSync(profile, 'utf8')).daemon.agentProfiles.some(
      (p) => p.id === 'axstack-driver',
    ),
  );
});
