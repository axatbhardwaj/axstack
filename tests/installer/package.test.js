// Permanent package smoke: `bun pm pack` into temp output, packed members
// compared against the full source tree (no exclusions, no silent missing
// files), executable entry, then a real install/update/uninstall cycle from
// the extracted bundle in a neutral cwd with node/npm absent from PATH.
//
// Source inventory is discovered dynamically: on the installer branch the
// source skills/profiles trees are absent, so the extracted bundle is
// augmented with a temporary fixture bundle (labeled as such) to exercise
// the full cycle. After workflow integration the same discovery covers the
// real combined bundle without hardcoding file counts here.
import { expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from '../../src/posixpath.js';
import { BUN_BIN, makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';

const ROOT = join(import.meta.dir, '../..');

function walkFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

function run(cmd, args, { cwd, env } = {}) {
  const result = Bun.spawnSync([cmd, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    ...(cwd ? { cwd } : {}),
    ...(env ? { env } : {}),
    timeout: 120000,
  });
  return {
    exitCode: result.exitCode,
    out: result.stdout.toString() + result.stderr.toString(),
  };
}

function packToTemp() {
  const outDir = join(makeTempRoot('axstack-pack-'), 'out');
  mkdirSync(outDir, { recursive: true });
  const packed = run(BUN_BIN, ['pm', 'pack', '--destination', outDir], { cwd: ROOT });
  expect(packed.exitCode).toBe(0);
  const tgz = walkFiles(outDir).find((f) => f.endsWith('.tgz'));
  expect(tgz).toBeDefined();
  return tgz;
}

function expectedMembers() {
  const expected = new Set();
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  for (const pattern of pkg.files) {
    const base = join(ROOT, pattern.replace(/\/$/, ''));
    if (!existsSync(base)) continue; // absent on installer-only branches
    if (statSync(base).isDirectory()) {
      for (const f of walkFiles(base)) expected.add(`package/${f.slice(ROOT.length + 1)}`);
    } else {
      expected.add(`package/${pattern}`);
    }
  }
  expected.add('package/package.json');
  return expected;
}

test('tarball members match the full source tree with no silent omissions', () => {
  const tgz = packToTemp();
  const listing = run('tar', ['-tzf', tgz]).out.trim().split('\n').sort();
  const expected = expectedMembers();
  expect(listing.length).toBeGreaterThan(0);
  expect([...expected].filter((m) => !listing.includes(m))).toEqual([]);
  expect(listing.filter((m) => !expected.has(m))).toEqual([]);
});

test('packed CLI installs, updates, and uninstalls from a neutral cwd', () => {
  const tgz = packToTemp();
  const neutral = makeTempRoot('axstack-smoke-');
  const extractDir = join(neutral, 'extract');
  mkdirSync(extractDir, { recursive: true });
  expect(run('tar', ['-xzf', tgz, '-C', extractDir]).exitCode).toBe(0);
  const pkgDir = join(extractDir, 'package');

  // Executable entry point survives packing.
  expect(statSync(join(pkgDir, 'bin', 'axstack.js')).mode & 0o111).not.toBe(0);

  // Fixture augmentation (installer branch has no source skills yet): copy a
  // temporary fixture bundle into the extracted package to simulate the
  // combined layout the installer consumes.
  const fixtureRoot = makeTempRoot('axstack-smoke-bundle-');
  const fixture = writeFixtureBundle(fixtureRoot);
  if (!existsSync(join(pkgDir, 'skills'))) {
    mkdirSync(join(pkgDir, 'skills'), { recursive: true });
    for (const f of walkFiles(join(fixture, 'skills'))) {
      const rel = f.slice(fixture.length + 1);
      mkdirSync(join(pkgDir, 'skills', rel.split('/').slice(1, -1).join('/')), { recursive: true });
      writeFileSync(join(pkgDir, rel), readFileSync(f));
    }
    mkdirSync(join(pkgDir, 'profiles'), { recursive: true });
    writeFileSync(
      join(pkgDir, 'profiles', 'paseo.json'),
      readFileSync(join(fixture, 'profiles', 'paseo.json')),
    );
  }

  // PATH with node/npm absent (only bun): proves no hidden Node dependency.
  const binDir = join(neutral, 'bin');
  mkdirSync(binDir, { recursive: true });
  symlinkSync(BUN_BIN, join(binDir, 'bun'));
  const env = { ...Bun.env, PATH: binDir };
  const cli = join(pkgDir, 'bin', 'axstack.js');
  const runPacked = (args, opts) => runBunCli(cli, args, { ...opts, env, cwd: neutral });

  const skillsDir = join(neutral, 'skills');
  const profile = join(neutral, 'paseo.json');
  const sentinel = join(neutral, 'sentinel.txt');
  writeFileSync(sentinel, 'unrelated\n');

  const installed = runPacked(['install', '--bundle', pkgDir, '--skills-dir', skillsDir, '--profile', profile]);
  expect(installed.ok).toBe(true);
  const skillFile = join(skillsDir, 'axstack-demo', 'SKILL.md');
  expect(existsSync(skillFile)).toBe(true);
  expect(
    JSON.parse(readFileSync(profile, 'utf8')).daemon.agentProfiles.some(
      (p) => p.id === 'axstack-driver',
    ),
  ).toBe(true);

  // Update path: reinstall is idempotent, sentinel untouched.
  const again = runPacked(['install', '--bundle', pkgDir, '--skills-dir', skillsDir, '--profile', profile]);
  expect(again.ok).toBe(true);
  expect(again.out.toLowerCase()).toMatch(/no changes|idempotent|unchanged/);
  expect(readFileSync(sentinel, 'utf8')).toBe('unrelated\n');

  // User edits survive reinstall and uninstall.
  writeFileSync(skillFile, '# User edited\n');
  runPacked(['install', '--bundle', pkgDir, '--skills-dir', skillsDir, '--profile', profile]);
  expect(readFileSync(skillFile, 'utf8')).toBe('# User edited\n');
  runPacked(['uninstall', '--skills-dir', skillsDir, '--profile', profile]);
  expect(readFileSync(skillFile, 'utf8')).toBe('# User edited\n');
  expect(readFileSync(sentinel, 'utf8')).toBe('unrelated\n');

  // Clean owned assets uninstall fully.
  writeFileSync(skillFile, readFileSync(join(pkgDir, 'skills', 'axstack-demo', 'SKILL.md')));
  runPacked(['install', '--bundle', pkgDir, '--skills-dir', skillsDir, '--profile', profile]);
  const removed = runPacked(['uninstall', '--skills-dir', skillsDir, '--profile', profile]);
  expect(removed.ok).toBe(true);
  expect(existsSync(skillFile)).toBe(false);
});
