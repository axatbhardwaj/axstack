// R3 regressions: exclusive temp creation (symlink/EEXIST safety), permission
// preservation, and the Node >= 22 test-discovery floor. Temp fixtures only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTempRoot, writeFixtureBundle } from './helpers.js';

// writeAtomic is imported dynamically per-test so an unexported helper fails
// that test rather than the whole file.
async function loadWriteAtomic() {
  const mod = await import('../../src/installer.js');
  assert.ok(typeof mod.writeAtomic === 'function', 'writeAtomic must be exported for testing');
  return mod.writeAtomic;
}

const CLI = fileURLToPath(new URL('../../bin/axstack.js', import.meta.url));
const MANIFEST_TMP = '.axstack-manifest.json.tmp';

function runCli(args, { expectFail = false, cwd, env } = {}) {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...(cwd ? { cwd } : {}),
      ...(env ? { env: { ...process.env, ...env } } : {}),
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
  assert.match(r.out.toLowerCase(), /temporary|tmp|refus|exists|symlink|unsafe/);
  assert.equal(readFileSync(outside, 'utf8'), 'outside data\n');
  assert.ok(!existsSync(join(skillsDir, '.axstack-manifest.json')));
});

test('writeAtomic never writes through a temp symlink nor truncates temp entries', async () => {
  const writeAtomic = await loadWriteAtomic();
  const root = makeTempRoot();
  const dest = join(root, 'SKILL.md');
  const tmp = `${dest}.tmp-${process.pid}`;
  const outside = join(root, 'sentinel.txt');
  writeFileSync(outside, 'outside data\n');
  symlinkSync(outside, tmp);

  await assert.rejects(() => writeAtomic(dest, 'payload\n'), /temporary|tmp|exists|symlink|unsafe|refus/i);
  assert.equal(readFileSync(outside, 'utf8'), 'outside data\n');
  assert.ok(!existsSync(dest));

  // A pre-existing regular temp entry is refused, never truncated.
  execFileSync('rm', [tmp]);
  writeFileSync(tmp, 'someone else\n');
  await assert.rejects(() => writeAtomic(dest, 'payload\n'), /temporary|tmp|exists|refus/i);
  assert.equal(readFileSync(tmp, 'utf8'), 'someone else\n');
  assert.ok(!existsSync(dest));
});

test('existing config mode 0600 survives the atomic profile merge', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root, { profiles: [{ ...OWNER_PROFILE }] });
  const skillsDir = join(root, 'skills');
  const profile = join(root, 'paseo.json');
  writeFileSync(profile, '{"version":1,"daemon":{"agentProfiles":[]}}\n');
  chmodSync(profile, 0o600);

  const r = runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile]);
  assert.ok(r.ok);
  assert.ok(
    JSON.parse(readFileSync(profile, 'utf8')).daemon.agentProfiles.some(
      (p) => p.id === 'axstack-owner',
    ),
  );
  assert.equal(statSync(profile).mode & 0o777, 0o600);
});

test('new config files are created restrictive (0600)', () => {
  const root = makeTempRoot();
  const bundle = writeFixtureBundle(root, { profiles: [{ ...OWNER_PROFILE }] });
  const skillsDir = join(root, 'skills');
  const profile = join(root, 'fresh.json');

  const r = runCli(['install', '--bundle', bundle, '--skills-dir', skillsDir, '--profile', profile]);
  assert.ok(r.ok);
  assert.equal(statSync(profile).mode & 0o777, 0o600);
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
  assert.ok(r.ok);
  assert.equal(readFileSync(skill, 'utf8'), '# v2\n');
  assert.equal(statSync(skill).mode & 0o777, 0o600);
});

test('npm test does not rely on bare directory discovery', () => {
  const pkg = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
  );
  assert.ok(
    !/(^|\s)node --test tests\/?(\s|$)/.test(pkg.scripts.test),
    'test script must not pass a bare tests/ directory (breaks Node 22)',
  );
});
