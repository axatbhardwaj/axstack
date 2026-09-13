// R2 regressions: profile ownership bound to config identity, manifest
// shape/symlink validation, manifest-write failure + rollback reporting,
// real gh-stack probing, --like option values, and no shipped fixtures.
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
import { readManifest } from '../../src/manifest.js';
import { makeTempRoot, writeFixtureBundle } from './helpers.js';

const CLI = fileURLToPath(new URL('../../bin/axstack.js', import.meta.url));

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

function runCli(args, { expectFail = false, cwd } = {}) {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...(cwd ? { cwd } : {}),
    });
    assert.ok(!expectFail, `expected failure but succeeded: ${out}`);
    return { ok: true, out };
  } catch (err) {
    assert.ok(expectFail, `CLI failed unexpectedly: ${err.stderr ?? err.message}`);
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
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
  assert.match(r.out.toLowerCase(), /different|bound|bound|ownership|refus/);
  // Nothing mutated: B intact and S skills still on disk.
  assert.equal(readFileSync(profileB, 'utf8'), beforeB);
  assert.ok(
    JSON.parse(readFileSync(profileB, 'utf8')).daemon.agentProfiles.some(
      (p) => p.id === 'axstack-owner',
    ),
    'B profile must survive a refused uninstall',
  );
  assert.equal(readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8'), beforeSkill);
  assert.ok(existsSync(join(skillsDir, '.axstack-manifest.json')));
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
  assert.match(r.out.toLowerCase(), /different|bound|ownership|refus|uninstall/);
  assert.ok(!existsSync(profileB), 'refused install must not create the other config');
});

test('uninstall with a missing profile file clears ownership and removes skills', () => {
  const root = makeTempRoot();
  const bundle = ownerBundle(root);
  const skillsDir = join(root, 'skills');
  const profileA = join(root, 'A.json');
  runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profileA]);
  execFileSync('rm', [profileA]);

  const r = runCli(['uninstall', '--skills-dir', skillsDir, '--profile', profileA]);
  assert.ok(r.ok);
  assert.ok(!existsSync(join(skillsDir, 'axstack-demo', 'SKILL.md')));

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
  assert.ok(again.ok);
  assert.ok(
    JSON.parse(readFileSync(profileB, 'utf8')).daemon.agentProfiles.some(
      (p) => p.id === 'axstack-owner',
    ),
  );
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
  execFileSync('rm', [manifest]);
  symlinkSync(elsewhere, manifest);

  const installR = runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir], {
    expectFail: true,
  });
  assert.match(installR.out.toLowerCase(), /symlink|unsafe|refus/);
  const uninstallR = runCli(['uninstall', '--skills-dir', skillsDir], { expectFail: true });
  assert.match(uninstallR.out.toLowerCase(), /symlink|unsafe|refus/);
  assert.equal(readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8'), before);

  await assert.rejects(() => readManifest(skillsDir), /symlink|unsafe|refus/i);
});

test('malformed manifests are rejected with shape errors', async () => {
  const root = makeTempRoot();
  const mk = (obj) => {
    const dir = makeTempRoot();
    writeFileSync(join(dir, '.axstack-manifest.json'), JSON.stringify(obj));
    return dir;
  };
  await assert.rejects(() => readManifest(mk({ version: 2, files: {}, profiles: {} })), /version/i);
  await assert.rejects(
    () => readManifest(mk({ version: 1, files: [], profiles: {} })),
    /files/i,
  );
  await assert.rejects(
    () => readManifest(mk({ version: 1, files: { '../evil': 'abc' }, profiles: {} })),
    /unsafe|path|invalid/i,
  );
  await assert.rejects(
    () => readManifest(mk({ version: 1, files: {}, profiles: { path: 42, entries: {} } })),
    /profile/i,
  );
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
  assert.match(r.out.toLowerCase(), /manifest/);
  assert.equal(readFileSync(join(skillsDir, 'axstack-demo', 'SKILL.md'), 'utf8'), beforeSkill);
  assert.equal(readFileSync(join(skillsDir, '.axstack-manifest.json'), 'utf8'), beforeManifest);
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
  assert.match(r.out.toLowerCase(), /rollback|incomplete|restore/i);
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
  const env = { ...process.env, PATH: `${fakeBin}:/usr/bin:/bin` };
  let out = '';
  try {
    execFileSync(process.execPath, [CLI, 'check'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });
  } catch (err) {
    out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  }
  assert.match(out.toLowerCase(), /gh stack extension/);
  assert.match(out, /MISSING.*gh stack extension/);
});

test('option values beginning with -- fail as missing values before mutation', () => {
  const root = makeTempRoot();
  const bundle = ownerBundle(root);
  const skillsDir = join(root, 'skills');
  const r = runCli(['install', '--bundle', '--skills-dir', skillsDir], {
    expectFail: true,
    cwd: root,
  });
  assert.match(r.out.toLowerCase(), /requires a value|missing value/);
  assert.ok(!existsSync(skillsDir), 'no target mutation on bad arguments');
  assert.ok(!existsSync(join(root, '--skills-dir')));
});

test('shipped profiles module exposes no test fixtures', async () => {
  const mod = await import('../../src/profiles.js');
  assert.ok(!('representativeHostConfig' in mod), 'test fixture must not ship in src');
});
