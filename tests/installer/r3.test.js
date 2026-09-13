// R3 regressions: exclusive temp creation (symlink/EEXIST safety), permission
// preservation, and the Node >= 22 test-discovery floor. Temp fixtures only.
import { expect, test } from 'bun:test';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli as runBunCli, writeFixtureBundle } from './helpers.js';
const runCli = (args, opts) => runBunCli(CLI, args, opts);

// writeAtomic is imported dynamically per-test so an unexported helper fails
// that test rather than the whole file.
async function loadWriteAtomic() {
  const mod = await import('../../src/installer.js');
  expect(typeof mod.writeAtomic === 'function').toBeTruthy();
  return mod.writeAtomic;
}

const CLI = join(import.meta.dir, '../../bin/axstack.js');
const MANIFEST_TMP = '.axstack-manifest.json.tmp';


const OWNER_PROFILE = {
  id: 'axstack-owner',
  name: 'Owner',
  provider: 'example',
  model: 'original',
};

test('manifest temp symlink to outside is not followed or renamed', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root, { profiles: [{ ...OWNER_PROFILE }] });
  const skillsDir = join(root, 'skills');
  mkdirSync(skillsDir, { recursive: true });
  const outside = join(root, 'sentinel.txt');
  writeFileSync(outside, 'outside data\n');
  symlinkSync(outside, join(skillsDir, MANIFEST_TMP));

  const r = runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir], {
    expectFail: true,
  });
  expect(r.out.toLowerCase()).toMatch(/temporary|tmp|refus|exists|symlink|unsafe/);
  expect(readFileSync(outside, 'utf8')).toBe('outside data\n');
  expect(!existsSync(join(skillsDir, '.axstack-manifest.json'))).toBeTruthy();
});

test('writeAtomic never writes through a temp symlink nor truncates temp entries', async () => {
  const writeAtomic = await loadWriteAtomic();
  const root = makeTempRoot();
  const dest = join(root, 'SKILL.md');
  const tmp = `${dest}.tmp-${process.pid}`;
  const outside = join(root, 'sentinel.txt');
  writeFileSync(outside, 'outside data\n');
  symlinkSync(outside, tmp);

  await expect(writeAtomic(dest, 'payload\n')).rejects.toThrow(/temporary|tmp|exists|symlink|unsafe|refus/i);
  expect(readFileSync(outside, 'utf8')).toBe('outside data\n');
  expect(!existsSync(dest)).toBeTruthy();

  // A pre-existing regular temp entry is refused, never truncated.
  rmSync(tmp, { force: true });
  writeFileSync(tmp, 'someone else\n');
  await expect(writeAtomic(dest, 'payload\n')).rejects.toThrow(/temporary|tmp|exists|refus/i);
  expect(readFileSync(tmp, 'utf8')).toBe('someone else\n');
  expect(!existsSync(dest)).toBeTruthy();
});

test('existing config mode 0600 survives the atomic profile merge', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root, { profiles: [{ ...OWNER_PROFILE }] });
  const skillsDir = join(root, 'skills');
  const profile = join(root, 'paseo.json');
  writeFileSync(profile, '{"version":1,"daemon":{"agentProfiles":[]}}\n');
  chmodSync(profile, 0o600);

  const r = runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile]);
  expect(r.ok).toBeTruthy();
  expect(JSON.parse(readFileSync(profile, 'utf8')).daemon.agentProfiles.some(
      (p) => p.id === 'axstack-owner',
    )).toBeTruthy();
  expect(statSync(profile).mode & 0o777).toBe(0o600);
});

test('new config files are created restrictive (0600)', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root, { profiles: [{ ...OWNER_PROFILE }] });
  const skillsDir = join(root, 'skills');
  const profile = join(root, 'fresh.json');

  const r = runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile]);
  expect(r.ok).toBeTruthy();
  expect(statSync(profile).mode & 0o777).toBe(0o600);
});

test('updated skill files keep their existing permissions', () => {
  const root = makeTempRoot();
  const v1 = writeFixtureBundle(root, { name: 'bundle-v1' });
  const skillsDir = join(root, 'skills');
  runCli(['install', '--bundle', v1, '--skills-dir', skillsDir]);
  const skill = join(skillsDir, 'axstack-demo', 'SKILL.md');
  chmodSync(skill, 0o600);

  const v2 = writeFixtureBundle(root, { name: 'bundle-v2', skillBody: '# v2\n' });
  const r = runCli(['install', '--bundle', v2, '--skills-dir', skillsDir]);
  expect(r.ok).toBeTruthy();
  expect(readFileSync(skill, 'utf8')).toBe('# v2\n');
  expect(statSync(skill).mode & 0o777).toBe(0o600);
});

test('package test script runs the Bun suite without bare directory discovery', () => {
  const pkg = JSON.parse(
    readFileSync(join(import.meta.dir, '../../package.json'), 'utf8'),
  );
  expect(pkg.scripts.test).toMatch(/bun test/);
  expect(/(^|\s)node --test tests\/?(\s|$)/.test(pkg.scripts.test)).toBe(false);
});
