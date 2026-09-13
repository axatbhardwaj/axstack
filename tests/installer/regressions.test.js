// Regression tests for independent-review findings (temp fixtures only,
// never live home): ownership adoption, symlink escapes, mutation ordering,
// and partial-failure recovery.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
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

function runCli(args, { expectFail = false } = {}) {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.ok(!expectFail, `expected failure but succeeded: ${out}`);
    return { ok: true, out };
  } catch (err) {
    assert.ok(expectFail, `CLI failed unexpectedly: ${err.stderr ?? err.message}`);
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

const OWNER_PROFILE = {
  id: 'axstack-owner',
  provider: 'example',
  model: 'original',
  modeId: 'default',
  thinkingOptionId: 'medium',
  notes: 'Ownership fixture.',
};

function ownerBundle(root, model = 'original', name = 'bundle') {
  return writeFixtureBundle(root, {
    name,
    profiles: [{ ...OWNER_PROFILE, model }],
  });
}

function readProfile(profile) {
  return JSON.parse(readFileSync(profile, 'utf8'));
}

function setProfileModel(profile, model) {
  const config = readProfile(profile);
  config.daemon.agentProfiles.find((p) => p.id === 'axstack-owner').model = model;
  writeFileSync(profile, JSON.stringify(config, null, 2) + '\n');
}

test('USER_EDIT profile survives install, reinstall and uninstall cycle', () => {
  const root = makeTempRoot();
  const bundle = ownerBundle(root);
  const skillsDir = join(root, 'skills');
  const profile = join(root, 'paseo.json');

  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile]);
  assert.equal(
    readProfile(profile).daemon.agentProfiles.find((p) => p.id === 'axstack-owner').model,
    'original',
  );

  setProfileModel(profile, 'USER_EDIT');
  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile]);
  assert.equal(
    readProfile(profile).daemon.agentProfiles.find((p) => p.id === 'axstack-owner').model,
    'USER_EDIT',
  );

  runCli(['uninstall', '--skills-dir', skillsDir, '--profile', profile]);
  const after = readProfile(profile);
  const owner = after.daemon.agentProfiles.find((p) => p.id === 'axstack-owner');
  assert.ok(owner, 'USER_EDIT profile must survive uninstall');
  assert.equal(owner.model, 'USER_EDIT');
});

test('unknown identical pre-existing skill file is neither adopted nor removed', () => {
  const root = makeTempRoot();
  const bundle = ownerBundle(root);
  const skillsDir = join(root, 'skills');
  mkdirSync(join(skillsDir, 'axstack-demo'), { recursive: true });
  // Byte-identical to the bundle payload, but never installed: not owned.
  writeFileSync(
    join(skillsDir, 'axstack-demo', 'SKILL.md'),
    '# Axstack Demo\n\nFixture skill for installer tests.\n',
  );

  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir]);
  runCli(['uninstall', '--skills-dir', skillsDir]);
  assert.equal(
    readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8'),
    '# Axstack Demo\n\nFixture skill for installer tests.\n',
  );
});

test('switched profile path: pre-existing axstack-* entry in second file survives', () => {
  const root = makeTempRoot();
  const bundle = ownerBundle(root);
  const skillsDir = join(root, 'skills');
  const profileA = join(root, 'a.json');
  const profileB = join(root, 'b.json');
  writeFileSync(
    profileB,
    JSON.stringify({
      version: 1,
      daemon: {
        agentProfiles: [{ ...OWNER_PROFILE, model: 'user-in-B' }],
      },
    }),
  );

  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profileA]);
  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profileB]);
  assert.equal(
    readProfile(profileB).daemon.agentProfiles.find((p) => p.id === 'axstack-owner').model,
    'user-in-B',
  );
  runCli(['uninstall', '--skills-dir', skillsDir, '--profile', profileB]);
  const after = readProfile(profileB).daemon.agentProfiles.find(
    (p) => p.id === 'axstack-owner',
  );
  assert.ok(after, 'pre-existing entry in switched profile file must survive');
  assert.equal(after.model, 'user-in-B');
});

test('symlinked skill subdir is refused before any outside write', () => {
  const root = makeTempRoot();
  const bundle = ownerBundle(root);
  const skillsDir = join(root, 'skills');
  const outside = join(root, 'outside');
  mkdirSync(skillsDir, { recursive: true });
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(outside, 'sentinel.txt'), 'outside data\n');
  symlinkSync(outside, join(skillsDir, 'axstack-demo'));

  const r = runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir], {
    expectFail: true,
  });
  assert.match(r.out.toLowerCase(), /symlink|unsafe|refus/);
  assert.equal(readFileSync(join(outside, 'sentinel.txt'), 'utf8'), 'outside data\n');
  assert.ok(!existsSync(join(outside, 'SKILL.md')));
  assert.ok(!existsSync(join(skillsDir, '.axstack-manifest.json')));
});

test('uninstall refuses to delete through a symlinked subdir', () => {
  const root = makeTempRoot();
  const bundle = ownerBundle(root);
  const skillsDir = join(root, 'skills');
  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir]);

  // Swap the installed dir for a link to outside holding a same-named file.
  const outside = join(root, 'outside');
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(outside, 'SKILL.md'), 'outside decoy\n');
  execFileSync('rm', ['-rf', join(skillsDir, 'axstack-demo')]);
  symlinkSync(outside, join(skillsDir, 'axstack-demo'));

  const r = runCli(['uninstall', '--skills-dir', skillsDir], { expectFail: true });
  assert.match(r.out.toLowerCase(), /symlink|unsafe|refus/);
  assert.equal(readFileSync(join(outside, 'SKILL.md'), 'utf8'), 'outside decoy\n');
});

test('symlinked target root is canonicalized and stays contained', () => {
  const root = makeTempRoot();
  const bundle = ownerBundle(root);
  const real = join(root, 'real-skills');
  mkdirSync(real, { recursive: true });
  const linked = join(root, 'linked-skills');
  symlinkSync(real, linked);

  const r = runCli(['install', '--bundle', bundle, '--skills-dir', linked]);
  assert.ok(r.ok);
  assert.ok(existsSync(join(real, 'axstack-demo', 'SKILL.md')));
  assert.ok(existsSync(join(real, '.axstack-manifest.json')));
});

test('symlinked profile file is refused before any skill write', () => {
  const root = makeTempRoot();
  const bundle = ownerBundle(root);
  const skillsDir = join(root, 'skills');
  const elsewhere = join(root, 'elsewhere.json');
  writeFileSync(elsewhere, '{"version":1,"daemon":{"agentProfiles":[]}}\n');
  const profile = join(root, 'paseo.json');
  symlinkSync(elsewhere, profile);

  const r = runCli(
    ['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile],
    { expectFail: true },
  );
  assert.match(r.out.toLowerCase(), /symlink|unsafe|refus/);
  assert.ok(!existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md')));
});

test('bundle with symlinked skills root is rejected before any write', () => {
  const root = makeTempRoot();
  const outsideSkills = join(root, 'outside-skills', 'axstack-demo');
  mkdirSync(outsideSkills, { recursive: true });
  writeFileSync(join(outsideSkills, 'SKILL.md'), '# Elsewhere\n');
  const bundle = join(root, 'bundle');
  mkdirSync(join(bundle, 'profiles'), { recursive: true });
  writeFileSync(
    join(bundle, 'profiles', 'paseo.json'),
    JSON.stringify({ version: 1, agentProfiles: [OWNER_PROFILE] }),
  );
  symlinkSync(join(root, 'outside-skills'), join(bundle, 'skills'));

  const skillsDir = join(root, 'skills');
  const r = runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir], {
    expectFail: true,
  });
  assert.match(r.out.toLowerCase(), /symlink|unsafe|reject/);
  assert.ok(!existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md')));
});

test('uninstall with malformed profile JSON fails before deleting skills', () => {
  const root = makeTempRoot();
  const bundle = ownerBundle(root);
  const skillsDir = join(root, 'skills');
  const profile = join(root, 'paseo.json');
  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile]);
  writeFileSync(profile, 'not json at all\n');

  const r = runCli(['uninstall', '--skills-dir', skillsDir, '--profile', profile], {
    expectFail: true,
  });
  assert.match(r.out.toLowerCase(), /malformed|valid json|parse/i);
  assert.ok(existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md')));
  assert.ok(existsSync(join(skillsDir, '.axstack-manifest.json')));
});

test('mid-run profile failure restores updated skills and keeps manifest', () => {
  const root = makeTempRoot();
  const v1 = ownerBundle(root, 'original', 'bundle-v1');
  const skillsDir = join(root, 'skills');
  const profileDir = join(root, 'confdir');
  mkdirSync(profileDir, { recursive: true });
  const profile = join(profileDir, 'paseo.json');
  runCli(['install', '--bundle', v1, '--skills-dir', skillsDir, '--profile', profile]);

  // v2 changes both skill bytes and the owned profile.
  const v2 = writeFixtureBundle(root, {
    name: 'bundle-v2',
    skillBody: '# Axstack Demo v2\n',
    profiles: [{ ...OWNER_PROFILE, model: 'v2' }],
  });
  // Sabotage the profile write (read-only parent): skill updates must roll back.
  chmodSync(profileDir, 0o555);
  let r;
  try {
    r = runCli(
      ['install', '--bundle', v2, '--skills-dir', skillsDir, '--profile', profile],
      { expectFail: true },
    );
  } finally {
    chmodSync(profileDir, 0o755);
  }
  assert.match(r.out.toLowerCase(), /denied|permission|eperm|eacces|failed/i);
  assert.equal(
    readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8'),
    '# Axstack Demo\n\nFixture skill for installer tests.\n',
  );
  assert.equal(
    readProfile(profile).daemon.agentProfiles.find((p) => p.id === 'axstack-owner').model,
    'original',
  );
  // Manifest still describes v1: reinstalling v1 is a clean no-op.
  const again = runCli([
    'install',
    '--bundle',
    v1,
    '--skills-dir',
    skillsDir,
    '--profile',
    profile,
  ]);
  assert.ok(again.ok);
  assert.match(again.out.toLowerCase(), /no changes|idempotent|unchanged/);
});
