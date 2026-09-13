// Regression tests for independent-review findings (temp fixtures only,
// never live home): ownership adoption, symlink escapes, mutation ordering,
// and partial-failure recovery.
import { expect, test } from 'bun:test';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const CLI = join(import.meta.dir, '../../bin/axstack.js');
const runCli = (args, opts) => runBunCli(CLI, args, opts);

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
  expect(readProfile(profile).daemon.agentProfiles.find((p) => p.id === 'axstack-owner').model).toBe('original');

  setProfileModel(profile, 'USER_EDIT');
  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile]);
  expect(readProfile(profile).daemon.agentProfiles.find((p) => p.id === 'axstack-owner').model).toBe('USER_EDIT');

  runCli(['uninstall', '--skills-dir', skillsDir, '--profile', profile]);
  const after = readProfile(profile);
  const owner = after.daemon.agentProfiles.find((p) => p.id === 'axstack-owner');
  expect(owner).toBeTruthy();
  expect(owner.model).toBe('USER_EDIT');
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
  expect(readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8')).toBe('# Axstack Demo\n\nFixture skill for installer tests.\n');
});

test('switched profile path: rebind only after uninstalling the bound config', () => {
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
  const beforeB = readFileSync(profileB, 'utf8');

  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profileA]);
  // Switching files mid-ownership is refused before any mutation.
  const refused = runCli(
    ['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profileB],
    { expectFail: true },
  );
  expect(refused.out.toLowerCase()).toMatch(/different|bound|ownership|refus|uninstall/);
  expect(readFileSync(profileB, 'utf8')).toBe(beforeB);

  // Proper path: uninstall the bound config, then bind the new one. The
  // pre-existing entry in B is preserved through the whole cycle.
  runCli(['uninstall', '--skills-dir', skillsDir, '--profile', profileA]);
  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profileB]);
  expect(readProfile(profileB).daemon.agentProfiles.find((p) => p.id === 'axstack-owner').model).toBe('user-in-B');
  runCli(['uninstall', '--skills-dir', skillsDir, '--profile', profileB]);
  const after = readProfile(profileB).daemon.agentProfiles.find(
    (p) => p.id === 'axstack-owner',
  );
  expect(after).toBeTruthy();
  expect(after.model).toBe('user-in-B');
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
  expect(r.out.toLowerCase()).toMatch(/symlink|unsafe|refus/);
  expect(readFileSync(join(outside, 'sentinel.txt'), 'utf8')).toBe('outside data\n');
  expect(!existsSync(join(outside, 'SKILL.md'))).toBe(true);
  expect(!existsSync(join(skillsDir, '.axstack-manifest.json'))).toBe(true);
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
  rmSync(join(skillsDir, 'axstack-demo'), { recursive: true, force: true });
  symlinkSync(outside, join(skillsDir, 'axstack-demo'));

  const r = runCli(['uninstall', '--skills-dir', skillsDir], { expectFail: true });
  expect(r.out.toLowerCase()).toMatch(/symlink|unsafe|refus/);
  expect(readFileSync(join(outside, 'SKILL.md'), 'utf8')).toBe('outside decoy\n');
});

test('symlinked target root is canonicalized and stays contained', () => {
  const root = makeTempRoot();
  const bundle = ownerBundle(root);
  const real = join(root, 'real-skills');
  mkdirSync(real, { recursive: true });
  const linked = join(root, 'linked-skills');
  symlinkSync(real, linked);

  const r = runCli(['install', '--bundle', bundle, '--skills-dir', linked]);
  expect(r.ok).toBe(true);
  expect(existsSync(join(real, 'axstack-demo', 'SKILL.md'))).toBe(true);
  expect(existsSync(join(real, '.axstack-manifest.json'))).toBe(true);
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
  expect(r.out.toLowerCase()).toMatch(/symlink|unsafe|refus/);
  expect(!existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md'))).toBe(true);
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
  expect(r.out.toLowerCase()).toMatch(/symlink|unsafe|reject/);
  expect(!existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md'))).toBe(true);
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
  expect(r.out.toLowerCase()).toMatch(/malformed|valid json|parse/i);
  expect(existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md'))).toBe(true);
  expect(existsSync(join(skillsDir, '.axstack-manifest.json'))).toBe(true);
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
  expect(r.out.toLowerCase()).toMatch(/denied|permission|eperm|eacces|failed/i);
  expect(readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8')).toBe('# Axstack Demo\n\nFixture skill for installer tests.\n');
  expect(readProfile(profile).daemon.agentProfiles.find((p) => p.id === 'axstack-owner').model).toBe('original');
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
  expect(again.ok).toBe(true);
  expect(again.out.toLowerCase()).toMatch(/no changes|idempotent|unchanged/);
});

test('uninstall without --profile names the bound path, keeps bytes and ownership', () => {
  const root = makeTempRoot();
  const bundle = ownerBundle(root);
  const skillsDir = join(root, 'skills');
  const profile = join(root, 'paseo.json');
  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile]);
  const beforeProfile = readFileSync(profile, 'utf8');

  // No --profile: skills go, but the bound profile must be reported, not
  // silently left behind.
  const r = runCli(['uninstall', '--skills-dir', skillsDir]);
  expect(r.ok).toBe(true);
  expect(r.out.includes(profile)).toBe(true);
  expect(readFileSync(profile, 'utf8')).toBe(beforeProfile);
  expect(readProfile(profile).daemon.agentProfiles.some((p) => p.id === 'axstack-owner')).toBe(true);
  const manifest = JSON.parse(
    readFileSync(join(skillsDir, '.axstack-manifest.json'), 'utf8'),
  );
  expect(manifest.profiles.path).toBe(profile);
  expect('axstack-owner' in manifest.profiles.entries).toBe(true);

  // Completing removal with the named path works and clears ownership.
  const done = runCli(['uninstall', '--skills-dir', skillsDir, '--profile', profile]);
  expect(done.ok).toBe(true);
  expect(!readProfile(profile).daemon.agentProfiles.some((p) => p.id === 'axstack-owner')).toBe(true);
});

test('mixed real and symlinked top-level skill entries are rejected pre-write', () => {
  const root = makeTempRoot();
  const bundle = join(root, 'bundle');
  const realSkill = join(bundle, 'skills', 'axstack-real');
  mkdirSync(realSkill, { recursive: true });
  writeFileSync(join(realSkill, 'SKILL.md'), '# Real\n');
  const outside = join(root, 'outside');
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(outside, 'sentinel.txt'), 'outside data\n');
  symlinkSync(outside, join(bundle, 'skills', 'axstack-evil'));
  mkdirSync(join(bundle, 'profiles'), { recursive: true });
  writeFileSync(
    join(bundle, 'profiles', 'paseo.json'),
    JSON.stringify({ version: 1, agentProfiles: [{ ...OWNER_PROFILE }] }),
  );

  const skillsDir = join(root, 'skills');
  const r = runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir], {
    expectFail: true,
  });
  expect(r.out.toLowerCase()).toMatch(/symlink|malformed|reject|unsafe/);
  expect(!existsSync(join(skillsDir, 'axstack-real', 'SKILL.md'))).toBe(true);
  expect(!existsSync(join(skillsDir, '.axstack-manifest.json'))).toBe(true);
  expect(readFileSync(join(outside, 'sentinel.txt'), 'utf8')).toBe('outside data\n');
});
