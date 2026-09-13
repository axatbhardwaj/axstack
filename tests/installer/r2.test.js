// R2 regressions: profile ownership bound to config identity, manifest
// shape/symlink validation, manifest-write failure + rollback reporting,
// real gh-stack probing, --like option values, and no shipped fixtures.
import { expect, test } from 'bun:test';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from '../../src/posixpath.js';
import { readManifest } from '../../src/manifest.js';
import { makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';
const runCli = (args, opts) => runBunCli(CLI, args, opts);

const CLI = join(import.meta.dir, '../../bin/axstack.js');

const OWNER_PROFILE = {
  id: 'axstack-owner',
  name: 'Owner',
  provider: 'example',
  model: 'original',
};

function ownerBundle(root, name = 'bundle') {
  return writeFixtureBundle(root, {
    name,
    profiles: [{ ...OWNER_PROFILE }],
  });
}


test('uninstall with a different profile path is refused before any mutation', () => {
  const root = makeTempRoot();
  const bundle = ownerBundle(root);
  const skillsDir = join(root, 'skills');
  const profileA = join(root, 'A.json');
  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profileA]);

  // Unrelated config B with byte-identical profile content.
  const profileB = join(root, 'B.json');
  writeFileSync(profileB, readFileSync(profileA, 'utf8'));
  const beforeB = readFileSync(profileB, 'utf8');
  const beforeSkill = readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8');

  const r = runCli(['uninstall', '--skills-dir', skillsDir, '--profile', profileB], {
    expectFail: true,
  });
  expect(r.out.toLowerCase()).toMatch(/different|bound|bound|ownership|refus/);
  // Nothing mutated: B intact and S skills still on disk.
  expect(readFileSync(profileB, 'utf8')).toBe(beforeB);
  expect(JSON.parse(readFileSync(profileB, 'utf8')).daemon.agentProfiles.some(
      (p) => p.id === 'axstack-owner',
    )).toBeTruthy();
  expect(readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8')).toBe(beforeSkill);
  expect(existsSync(join(skillsDir, '.axstack-manifest.json'))).toBeTruthy();
});

test('install with a different profile path than the bound manifest is refused', () => {
  const root = makeTempRoot();
  const bundle = ownerBundle(root);
  const skillsDir = join(root, 'skills');
  const profileA = join(root, 'A.json');
  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profileA]);

  const profileB = join(root, 'B.json');
  const r = runCli(
    ['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profileB],
    { expectFail: true },
  );
  expect(r.out.toLowerCase()).toMatch(/different|bound|ownership|refus|uninstall/);
  expect(!existsSync(profileB)).toBeTruthy();
});

test('uninstall with a missing profile file clears ownership and removes skills', () => {
  const root = makeTempRoot();
  const bundle = ownerBundle(root);
  const skillsDir = join(root, 'skills');
  const profileA = join(root, 'A.json');
  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profileA]);
  rmSync(profileA, { force: true });

  const r = runCli(['uninstall', '--skills-dir', skillsDir, '--profile', profileA]);
  expect(r.ok).toBeTruthy();
  expect(!existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md'))).toBeTruthy();

  // Ownership released: a later install may bind a new config path.
  const profileB = join(root, 'B.json');
  const again = runCli([
    'install',
    '--bundle',
    bundle,
    '--skills-dir',
    skillsDir,
    '--profile',
    profileB,
  ]);
  expect(again.ok).toBeTruthy();
  expect(JSON.parse(readFileSync(profileB, 'utf8')).daemon.agentProfiles.some(
      (p) => p.id === 'axstack-owner',
    )).toBeTruthy();
});

test('manifest symlink is rejected before mutations', async () => {
  const root = makeTempRoot();
  const bundle = ownerBundle(root);
  const skillsDir = join(root, 'skills');
  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir]);
  const manifest = join(skillsDir, '.axstack-manifest.json');
  const before = readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8');
  const elsewhere = join(root, 'elsewhere.json');
  writeFileSync(elsewhere, '{}\n');
  rmSync(manifest, { force: true });
  symlinkSync(elsewhere, manifest);

  const installR = runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir], {
    expectFail: true,
  });
  expect(installR.out.toLowerCase()).toMatch(/symlink|unsafe|refus/);
  const uninstallR = runCli(['uninstall', '--skills-dir', skillsDir], { expectFail: true });
  expect(uninstallR.out.toLowerCase()).toMatch(/symlink|unsafe|refus/);
  expect(readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8')).toBe(before);

  await expect(readManifest(skillsDir)).rejects.toThrow(/symlink|unsafe|refus/i);
});

test('malformed manifests are rejected with shape errors', async () => {
  const root = makeTempRoot();
  const mk = (obj) => {
    const dir = makeTempRoot();
    writeFileSync(join(dir, '.axstack-manifest.json'), JSON.stringify(obj));
    return dir;
  };
  await expect(readManifest(mk({ version: 2, files: {}, profiles: {} }))).rejects.toThrow(/version/i);
  await expect(readManifest(mk({ version: 1, files: [], profiles: {} }))).rejects.toThrow(/files/i);
  await expect(
    readManifest(mk({ version: 1, files: { '../evil': 'abc' }, profiles: {} })),
  ).rejects.toThrow(/unsafe|path|invalid/i);
  await expect(
    readManifest(mk({ version: 1, files: {}, profiles: { path: 42, entries: {} } })),
  ).rejects.toThrow(/profile/i);
});

test('manifest-write failure keeps pre-run state and reports the failure', () => {
  const root = makeTempRoot();
  const bundle = ownerBundle(root);
  const skillsDir = join(root, 'skills');
  const profile = join(root, 'paseo.json');
  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile]);
  const beforeSkill = readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8');
  const beforeManifest = readFileSync(join(skillsDir, '.axstack-manifest.json'), 'utf8');

  // Block the manifest write without permission assumptions.
  mkdirSync(join(skillsDir, '.axstack-manifest.json.tmp'));
  const r = runCli(
    ['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile],
    { expectFail: true },
  );
  expect(r.out.toLowerCase()).toMatch(/manifest/);
  expect(readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8')).toBe(beforeSkill);
  expect(readFileSync(join(skillsDir, '.axstack-manifest.json'), 'utf8')).toBe(beforeManifest);
});

test('failed restores are reported instead of swallowed', () => {
  const root = makeTempRoot();
  const v1 = ownerBundle(root, 'bundle-v1');
  const skillsDir = join(root, 'skills');
  runCli(['install', '--bundle', v1, '--skills-dir', skillsDir]);
  const v2 = writeFixtureBundle(root, { name: 'bundle-v2', skillBody: '# v2\n' });

  // Make the update write (and its restore) fail: read-only skill dir.
  const skillDir = join(skillsDir, 'axstack-demo');
  chmodSync(skillDir, 0o555);
  let r;
  try {
    r = runCli(['install', '--bundle', v2, '--skills-dir', skillsDir], {
      expectFail: true,
    });
  } finally {
    chmodSync(skillDir, 0o755);
  }
  expect(r.out.toLowerCase()).toMatch(/rollback|incomplete|restore/i);
});

test('gh-stack probe requires the real gh stack command', () => {
  const root = makeTempRoot();
  const fakeBin = join(root, 'bin');
  mkdirSync(fakeBin, { recursive: true });
  // gh claims a "stack" extension but has no working `gh stack` command.
  const gh = join(fakeBin, 'gh');
  writeFileSync(
    gh,
    '#!/bin/sh\n' +
      'if [ "$1" = "--version" ]; then echo "gh version 9.9.9"; exit 0; fi\n' +
      'if [ "$1" = "extension" ]; then echo "stack"; exit 0; fi\n' +
      'echo "unknown command: $*" >&2; exit 1\n',
  );
  chmodSync(gh, 0o755);
  const r = runCli(['check'], {
    expectFail: true,
    env: { PATH: `${fakeBin}:/usr/bin:/bin` },
  });
  expect(r.out.toLowerCase()).toMatch(/gh stack extension/);
  expect(r.out).toMatch(/MISSING.*gh stack extension/);
});

test('option values beginning with -- fail as missing values before mutation', () => {
  const root = makeTempRoot();
  const bundle = ownerBundle(root);
  const skillsDir = join(root, 'skills');
  const r = runCli(['install', '--bundle', '--skills-dir', skillsDir], {
    expectFail: true,
    cwd: root,
  });
  expect(r.out.toLowerCase()).toMatch(/requires a value|missing value/);
  expect(!existsSync(skillsDir)).toBeTruthy();
  expect(!existsSync(join(root, '--skills-dir'))).toBeTruthy();
});

test('shipped profiles module exposes no test fixtures', async () => {
  const mod = await import('../../src/profiles.js');
  expect(!('representativeHostConfig' in mod)).toBeTruthy();
});
