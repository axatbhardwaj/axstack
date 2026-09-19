// Permanent package smoke: `bun pm pack` into temp output, packed members
// compared against the full source tree (no exclusions, no silent missing
// files, Bun auto-included docs accounted), executable entry, then a real
// install/update/uninstall cycle from the extracted bundle in a neutral cwd
// with node/npm absent from PATH.
//
// Source inventory is discovered dynamically: expectations derive from the
// extracted package (every skill asset byte-checked, every role id checked),
// never from hardcoded fixture names. The real packed-package cycle consumes
// its shipped assets without mutation. A separately labeled combined-like
// fixture package proves dynamic discovery independent of production assets.
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

// Docs Bun packs automatically even when absent from `files` (verified:
// README.md + LICENSE land in the tarball unlisted).
const AUTO_INCLUDED_DOCS = ['README', 'README.md', 'LICENSE', 'LICENCE', 'LICENSE.md', 'CHANGELOG.md', 'NOTICE'];

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

function packDir(pkgDir, outDir) {
  const packed = run(BUN_BIN, ['pm', 'pack', '--destination', outDir], { cwd: pkgDir });
  expect(packed.exitCode).toBe(0);
  const tgz = walkFiles(outDir).find((f) => f.endsWith('.tgz'));
  expect(tgz).toBeDefined();
  return tgz;
}

function expectedMembers(pkgDir) {
  const expected = new Set();
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  for (const pattern of pkg.files) {
    const base = join(pkgDir, pattern.replace(/\/$/, ''));
    if (!existsSync(base)) continue; // absent on installer-only branches
    if (statSync(base).isDirectory()) {
      for (const f of walkFiles(base)) expected.add(`package/${f.slice(pkgDir.length + 1)}`);
    } else {
      expected.add(`package/${pattern}`);
    }
  }
  expected.add('package/package.json');
  for (const doc of AUTO_INCLUDED_DOCS) {
    if (existsSync(join(pkgDir, doc))) expected.add(`package/${doc}`);
  }
  return expected;
}

function tarMembers(tgz) {
  const listing = run('tar', ['-tzf', tgz]);
  expect(listing.exitCode).toBe(0);
  return listing.out.trim().split('\n').sort();
}

// PATH with node/npm absent (only bun): proves no hidden Node dependency.
function bunOnlyEnv(neutral) {
  const binDir = join(neutral, 'bin');
  mkdirSync(binDir, { recursive: true });
  if (!existsSync(join(binDir, 'bun'))) symlinkSync(BUN_BIN, join(binDir, 'bun'));
  return { ...Bun.env, PATH: binDir };
}

function skillAssets(pkgDir) {
  const skillsRoot = join(pkgDir, 'skills');
  const rels = [];
  for (const f of walkFiles(skillsRoot)) rels.push(f.slice(skillsRoot.length + 1));
  return rels;
}

function roleRecords(pkgDir, preset) {
  const payload = JSON.parse(
    readFileSync(join(pkgDir, 'profiles', 'presets', `${preset}.json`), 'utf8'),
  );
  return payload.roles;
}

// Augment an installer-branch extract with a labeled fixture bundle. Both
// asset trees must be absent; a partially missing tree is malformed and
// fails loudly instead of silently falling back.
function ensureBundleAssets(pkgDir, label) {
  const hasSkills = existsSync(join(pkgDir, 'skills'));
  const hasProfiles = existsSync(join(pkgDir, 'profiles'));
  if (hasSkills && hasProfiles) return { augmented: false };
  if (hasSkills !== hasProfiles) {
    throw new Error(
      `incomplete bundle in package (${label}): skills present=${hasSkills}, profiles present=${hasProfiles}; refusing silent fallback`,
    );
  }
  const fixtureRoot = makeTempRoot('axstack-smoke-bundle-');
  const fixture = writeFixtureBundle(fixtureRoot);
  mkdirSync(join(pkgDir, 'skills'), { recursive: true });
  for (const f of walkFiles(join(fixture, 'skills'))) {
    const rel = f.slice(fixture.length + 1);
    const dest = join(pkgDir, rel);
    mkdirSync(join(dest.split('/').slice(0, -1).join('/')), { recursive: true });
    writeFileSync(dest, readFileSync(f));
  }
  for (const f of walkFiles(join(fixture, 'profiles'))) {
    const rel = f.slice(fixture.length + 1);
    const dest = join(pkgDir, rel);
    mkdirSync(join(dest.split('/').slice(0, -1).join('/')), { recursive: true });
    writeFileSync(dest, readFileSync(f));
  }
  return { augmented: true };
}

function fullCycle(pkgDir, neutral, label, preset) {
  const env = bunOnlyEnv(neutral);
  const cli = join(pkgDir, 'bin', 'axstack.js');
  const runPacked = (args, opts) => runBunCli(cli, args, { ...opts, env, cwd: neutral });
  const skillsDir = join(neutral, `${label}-skills`);
  const sentinel = join(neutral, `${label}-sentinel.txt`);
  writeFileSync(sentinel, 'unrelated\n');

  const rels = skillAssets(pkgDir);
  expect(rels.length).toBeGreaterThan(0);
  expect(rels.filter((r) => r.endsWith('SKILL.md')).length).toBeGreaterThan(0);

  const installed = runPacked(['install', '--preset', preset, '--bundle', pkgDir, '--skills-dir', skillsDir]);
  expect(installed.ok).toBe(true);
  const bundledRoles = roleRecords(pkgDir, preset);
  expect(bundledRoles.length).toBeGreaterThan(0);
  for (const rel of rels) {
    expect(readFileSync(join(skillsDir, rel), 'utf8')).toBe(readFileSync(join(pkgDir, 'skills', rel), 'utf8'));
  }
  expect(JSON.parse(readFileSync(join(skillsDir, 'axstack', 'roles.json'), 'utf8'))).toEqual({
    version: 1, preset, roles: bundledRoles,
  });
  const ownedFiles = JSON.parse(
    readFileSync(join(skillsDir, '.axstack-manifest.json'), 'utf8'),
  ).files;
  expect(ownedFiles['axstack/roles.json']).toBeString();

  const again = runPacked(['install', '--preset', preset, '--bundle', pkgDir, '--skills-dir', skillsDir]);
  expect(again.ok).toBe(true);
  expect(again.out.toLowerCase()).toMatch(/no changes|idempotent|unchanged/);
  expect(readFileSync(sentinel, 'utf8')).toBe('unrelated\n');

  // User edits to every skill file survive reinstall and uninstall.
  for (const rel of rels) writeFileSync(join(skillsDir, rel), `# User edited ${rel}\n`);
  const reinstalled = runPacked(['install', '--preset', preset, '--bundle', pkgDir, '--skills-dir', skillsDir]);
  expect(reinstalled.ok).toBe(true);
  for (const rel of rels) {
    expect(readFileSync(join(skillsDir, rel), 'utf8')).toBe(`# User edited ${rel}\n`);
  }
  const uninstalled = runPacked(['uninstall', '--skills-dir', skillsDir]);
  expect(uninstalled.ok).toBe(true);
  for (const rel of rels) {
    expect(readFileSync(join(skillsDir, rel), 'utf8')).toBe(`# User edited ${rel}\n`);
  }
  expect(readFileSync(sentinel, 'utf8')).toBe('unrelated\n');

  // Pristine reinstall then full removal of every owned asset and role snapshot.
  for (const rel of rels) {
    writeFileSync(join(skillsDir, rel), readFileSync(join(pkgDir, 'skills', rel)));
  }
  const refreshed = runPacked(['install', '--preset', preset, '--bundle', pkgDir, '--skills-dir', skillsDir]);
  expect(refreshed.ok).toBe(true);
  const removed = runPacked(['uninstall', '--skills-dir', skillsDir]);
  expect(removed.ok).toBe(true);
  for (const rel of rels) expect(existsSync(join(skillsDir, rel))).toBe(false);
  expect(existsSync(join(skillsDir, 'axstack', 'roles.json'))).toBe(false);
}

test('tarball members match the full source tree with no silent omissions', () => {
  const outDir = join(makeTempRoot('axstack-pack-'), 'out');
  mkdirSync(outDir, { recursive: true });
  const tgz = packDir(ROOT, outDir);
  const listing = tarMembers(tgz);
  expect(listing.length).toBeGreaterThan(0);
  const expected = expectedMembers(ROOT);
  expect([...expected].filter((m) => !listing.includes(m))).toEqual([]);
  expect(listing.filter((m) => !expected.has(m))).toEqual([]);
});

test('published manifest carries the metadata an npm page needs', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  // Publishing is permanent, so pin the exact public identity rather than its
  // shape: a plausible-looking but wrong URL is the failure worth catching.
  const SLUG = 'axatbhardwaj/axstack';

  expect(manifest.repository).toEqual({
    type: 'git',
    url: `git+https://github.com/${SLUG}.git`,
  });
  expect(manifest.homepage).toBe(`https://github.com/${SLUG}#readme`);
  expect(manifest.bugs).toBe(`https://github.com/${SLUG}/issues`);
  expect(manifest.author).toBe('Axat Bhardwaj');
  expect(manifest.license).toBe('MIT');
  // Only `private: true` blocks publication; absent and false are publishable.
  expect(manifest.private, 'private must not be true').not.toBe(true);

  // Keywords carry discovery, so require the ones this package is actually
  // for rather than merely a non-empty list.
  expect(manifest.keywords).toContain('claude-code');
  expect(manifest.keywords).toContain('codex');
  expect(manifest.keywords).toContain('orca');
});

test('published manifest identity matches the repository it is published from', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const remote = Bun.spawnSync([ 'git', 'remote', 'get-url', 'origin' ], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (remote.exitCode !== 0) return; // no origin (archive export); the pinned check above still applies

  const slug = remote.stdout.toString().trim()
    .replace(/^git\+/, '')
    .replace(/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)/, '')
    .replace(/\.git$/, '');

  // Catches a repository rename or transfer that leaves the manifest stale.
  expect(manifest.repository.url, `origin is ${slug}`).toBe(`git+https://github.com/${slug}.git`);
  expect(manifest.homepage).toContain(slug);
  expect(manifest.bugs).toContain(slug);
});

test('CLI reports the subscription-routing setup version', () => {
  const result = runBunCli(join(ROOT, 'bin', 'axstack.js'), ['--version']);
  expect(result.out.trim()).toBe('axstack 0.17.0');
});

test('packed CLI installs, updates, and uninstalls from a neutral cwd', () => {
  const outDir = join(makeTempRoot('axstack-pack-'), 'out');
  mkdirSync(outDir, { recursive: true });
  const tgz = packDir(ROOT, outDir);
  const neutral = makeTempRoot('axstack-smoke-');
  const extractDir = join(neutral, 'extract');
  mkdirSync(extractDir, { recursive: true });
  expect(run('tar', ['-xzf', tgz, '-C', extractDir]).exitCode).toBe(0);
  const pkgDir = join(extractDir, 'package');

  expect(statSync(join(pkgDir, 'bin', 'axstack.js')).mode & 0o111).not.toBe(0);
  ensureBundleAssets(pkgDir, 'root-package');
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    fullCycle(pkgDir, neutral, `root-${preset}`, preset);
  }
});

test('partial asset tree fails loudly instead of augmenting', () => {
  // Deliberately partial fixture independent of the package branch: a fresh
  // temp dir holding skills-only must trip the guard. (Building it from the
  // real extract would silently pass on branches whose extract already ships
  // profiles, which is exactly the combined failure this guards against.)
  const pkgDir = makeTempRoot('axstack-partial-');
  mkdirSync(join(pkgDir, 'skills', 'axstack-demo'), { recursive: true });
  writeFileSync(join(pkgDir, 'skills', 'axstack-demo', 'SKILL.md'), '# Partial\n');
  expect(() => ensureBundleAssets(pkgDir, 'partial-package')).toThrow(/incomplete bundle/);
});

test('combined-like fixture package packs and cycles end to end', () => {
  // Mimics the integrated layout on this branch: several named skills with
  // nested assets, several profiles, plus README/LICENSE for the
  // auto-include check.
  const pkgDir = makeTempRoot('axstack-combined-');
  const pkg = {
    name: 'axstack-combined-fixture',
    version: '0.0.1',
    type: 'module',
    bin: { axstack: 'bin/axstack.js' },
    files: ['bin/', 'src/', 'skills/', 'profiles/'],
  };
  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkg, null, 2));
  for (const f of walkFiles(join(ROOT, 'bin'))) {
    mkdirSync(join(pkgDir, 'bin'), { recursive: true });
    writeFileSync(join(pkgDir, 'bin', f.slice(join(ROOT, 'bin').length + 1)), readFileSync(f));
  }
  for (const f of walkFiles(join(ROOT, 'src'))) {
    mkdirSync(join(pkgDir, 'src'), { recursive: true });
    writeFileSync(join(pkgDir, 'src', f.slice(join(ROOT, 'src').length + 1)), readFileSync(f));
  }
  const skillNames = ['axstack-align', 'axstack-review', 'axstack-watch'];
  for (const name of skillNames) {
    mkdirSync(join(pkgDir, 'skills', name, 'references'), { recursive: true });
    writeFileSync(join(pkgDir, 'skills', name, 'SKILL.md'), `# ${name}\n`);
    writeFileSync(join(pkgDir, 'skills', name, 'references', 'notes.md'), `# ${name} refs\n`);
  }
  const profileIds = ['axstack-driver', 'axstack-reviewer'];
  mkdirSync(join(pkgDir, 'profiles', 'presets'), { recursive: true });
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const provider = preset === 'claude-only' ? 'claude' : 'codex';
    writeFileSync(
      join(pkgDir, 'profiles', 'presets', `${preset}.json`),
      JSON.stringify({
        version: 1,
        roles: profileIds.map((id) => ({ id, name: id, provider, model: 'm' })),
      }),
    );
  }
  writeFileSync(join(pkgDir, 'README.md'), '# Combined fixture\n');
  writeFileSync(join(pkgDir, 'LICENSE'), 'MIT fixture\n');

  const outDir = join(makeTempRoot('axstack-pack-'), 'out');
  mkdirSync(outDir, { recursive: true });
  const tgz = packDir(pkgDir, outDir);
  const listing = tarMembers(tgz);
  const expected = expectedMembers(pkgDir);
  expect([...expected].filter((m) => !listing.includes(m))).toEqual([]);
  expect(listing.filter((m) => !expected.has(m))).toEqual([]);
  // README/LICENSE ride along even though `files` omits them.
  expect(listing.includes('package/README.md')).toBe(true);
  expect(listing.includes('package/LICENSE')).toBe(true);
  // Every skill asset and the profile payload ship.
  for (const name of skillNames) {
    expect(listing.includes(`package/skills/${name}/SKILL.md`)).toBe(true);
    expect(listing.includes(`package/skills/${name}/references/notes.md`)).toBe(true);
  }
  expect(listing.includes('package/profiles/paseo.json')).toBe(false);
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    expect(listing.includes(`package/profiles/presets/${preset}.json`)).toBe(true);
  }

  const neutral = makeTempRoot('axstack-combined-smoke-');
  const extractDir = join(neutral, 'extract');
  mkdirSync(extractDir, { recursive: true });
  expect(run('tar', ['-xzf', tgz, '-C', extractDir]).exitCode).toBe(0);
  const extracted = join(extractDir, 'package');
  expect(statSync(join(extracted, 'bin', 'axstack.js')).mode & 0o111).not.toBe(0);
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    fullCycle(extracted, neutral, `combined-${preset}`, preset);
  }
});
