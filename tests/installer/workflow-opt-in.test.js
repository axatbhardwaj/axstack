import { expect, test } from 'bun:test';
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { BUN_BIN, makeTempRoot, runCli } from './helpers.js';

const root = join(import.meta.dir, '../..');
const workflow = 'axstack-load-probe';
const name = workflow + '-v1.mjs';
const cli = join(root, 'bin/axstack.js');

function setup() {
  const scratch = makeTempRoot('axstack-opt-in-');
  const home = join(scratch, 'home');
  const base = join(home, '.t3');
  const workflows = join(base, 'workflows');
  const manifest = join(base, '.axstack-workflows.json');
  const binding = join(scratch, 'private.json');
  const receipt = join(scratch, 'conformance.json');
  const control = join(scratch, 'control.json');
  const bin = join(scratch, 'bin');
  mkdirSync(join(base, 'userdata'), { recursive: true });
  writeFileSync(join(base, 'userdata/environment-id'), 'fixture-environment');
  writeFileSync(join(base, 'userdata/server-runtime.json'), '{"serverVersion":"0.1.12"}');
  mkdirSync(bin);
  writeFileSync(binding, '{}', { mode: 0o600 });
  const update = (fields = {}) => writeFileSync(control, JSON.stringify({ version: '0.1.12', ...fields }));
  update();
  writeFileSync(join(bin, 't3'), `#!${BUN_BIN}
import { writeFileSync } from 'node:fs';
const config = await Bun.file(${JSON.stringify(control)}).json();
const args = Bun.argv.slice(2);
if (args[0] === '--version') console.log('t3 v' + config.version);
else if (args[0] === 'workflow' && args.includes('--base-dir') &&
  args[args.indexOf('--base-dir') + 1] === ${JSON.stringify(base)}) {
  if (args[1] === 'list') {
    if (config.editDuringInventory) writeFileSync(config.editDuringInventory, '// changed during inventory');
    console.log(JSON.stringify((args.includes('--status') ? config.activeRuns : null) ?? config.runs ?? []));
  }
  else if (args[1] === 'start' || args[1] === 'show') {
    if (config.disabled) process.exit(1);
    console.log(JSON.stringify({ run: {
      workflow: 'axstack-load-probe', runId: 'fixture', version: config.registered ?? 1,
      status: 'completed', result: { workflow: 'axstack-load-probe@1', binding: 'pass' }
    } }));
  } else process.exit(2);
} else process.exit(2);
`, { mode: 0o700 });
  writeFileSync(receipt, JSON.stringify({ version: '0.1.12', suite: 1, environment: 'fixture-environment', status: 'pass' }), { mode: 0o600 });
  const call = (args, expectFail = false, entry = cli) => runCli(entry, args, {
    cwd: scratch, expectFail, env: { HOME: home, PATH: bin }, unset: ['T3CODE_HOME', 'T3CODE_WORKFLOWS'],
  }).out;
  const optIn = (expectFail = false, { bindingPath = binding, entry } = {}) => call([
    'workflow', 'opt-in', '--name', workflow, '--binding', bindingPath, '--conformance', receipt, '--yes',
  ], expectFail, entry);
  const remove = (expectFail = false) => call(['workflow', 'remove', '--name', workflow, '--version', '1', '--yes'], expectFail);
  return { scratch, home, base, workflows, manifest, binding, receipt, call, optIn, remove, update };
}

function fixtureEntry(scratch, { packageRoot = root, prelude = '' } = {}) {
  const entry = join(scratch, 'workflow-cli.mjs');
  writeFileSync(entry, `${prelude}
const { workflowCli } = await import(${JSON.stringify(join(root, 'src/workflow-cli.js'))});
await workflowCli(Bun.argv.slice(3), ${JSON.stringify(packageRoot)});
`);
  return entry;
}

test('ordinary install is idempotent and leaves the temp T3 home untouched', () => {
  const { home, base, call } = setup();
  mkdirSync(join(base, 'userdata'), { recursive: true });
  const settings = join(base, 'userdata/settings.json');
  writeFileSync(settings, '{"workflowsEnabled":false}');
  const install = ['install', '--preset', 'mixed', '--skills-dir', join(home, 'skills'), '--no-claude-settings', '--yes'];
  call(install);
  expect(call(install)).toContain('idempotent');
  expect(readdirSync(base)).toEqual(['userdata']);
  expect(existsSync(join(home, 'skills/axstack/workflows'))).toBe(false);
  expect(readFileSync(settings, 'utf8')).toBe('{"workflowsEnabled":false}');
}, 60_000);

test('opt-in deploys only the selected immutable bundle and records its private binding digest', () => {
  const { optIn, workflows, manifest } = setup();
  expect(optIn()).toContain('axstack-load-probe@1');
  expect(readdirSync(workflows)).toEqual([name]);
  const record = readFileSync(manifest, 'utf8');
  const bundle = readFileSync(join(root, 'skills/axstack/workflows/bundles', name));
  expect(readFileSync(join(workflows, name))).toEqual(bundle);
  expect(record).toContain(new Bun.CryptoHasher('sha256').update(bundle).digest('hex'));
  expect(record).toContain(new Bun.CryptoHasher('sha256').update('{}').digest('hex'));
  expect(optIn()).toContain('unchanged');
  expect(readFileSync(manifest, 'utf8')).toBe(record);
});

test('opt-in holds below the T3 floor, across T3 upgrades, and on failed registration', () => {
  const { optIn, update, receipt, workflows, manifest } = setup();
  update({ version: '0.1.11' });
  expect(optIn(true)).toContain('0.1.12');
  update({ version: '0.1.13' });
  expect(optIn(true)).toContain('conformance');
  update({ version: '0.1.12' });
  writeFileSync(receipt, JSON.stringify({ version: '0.1.12', suite: 1, environment: 'fixture-environment', status: 'fail' }));
  expect(optIn(true)).toContain('conformance');
  writeFileSync(receipt, JSON.stringify({ version: '0.1.12', suite: 1, environment: 'fixture-environment', status: 'pass' }));
  update({ registered: 2 });
  expect(optIn(true)).toContain('registration');
  expect(existsSync(manifest)).toBe(false);
  expect(existsSync(join(workflows, name))).toBe(false);
});

test('removal refuses active runs and only removes owned unmodified bytes after drain', () => {
  const { optIn, remove, workflows, update } = setup();
  optIn();
  for (const status of ['running', 'waiting', 'paused']) {
    update({ runs: [{ workflow, version: 1, status, runId: status }] });
    expect(remove(true)).toContain(status);
    expect(existsSync(join(workflows, name))).toBe(true);
  }
  update({ runs: [{ workflow, version: 1, status: 'cancelled' }] });
  expect(remove()).toContain('removed');
  expect(readdirSync(workflows)).toEqual([]);
});

test('edited, unowned, symlinked and changed-binding inputs are preserved', () => {
  const { optIn, workflows, binding } = setup();
  mkdirSync(workflows, { recursive: true });
  const dest = join(workflows, name);
  symlinkSync(binding, dest);
  expect(optIn(true)).toMatch(/symlink|unowned/);
  expect(readFileSync(binding, 'utf8')).toBe('{}');
  const next = setup();
  next.optIn();
  writeFileSync(next.binding, '{"changed":true}');
  expect(next.optIn(true)).toContain('binding');
  writeFileSync(join(next.workflows, name), '// edited');
  expect(next.remove(true)).toContain('modified');
  expect(next.optIn(true)).toContain('modified');
  expect(readFileSync(join(next.workflows, name), 'utf8')).toBe('// edited');
});

test('missing conformance resources produce a private hold receipt for this T3 environment', () => {
  const { call, binding, receipt, optIn } = setup();
  expect(call(['workflow', 'conformance', '--binding', binding, '--out', receipt], true)).toContain('conformance');
  expect(JSON.parse(readFileSync(receipt, 'utf8'))).toMatchObject({
    status: 'unknown', environment: 'fixture-environment', version: '0.1.12',
  });
  expect(optIn(true)).toContain('conformance');
});

test('a missing forge binding names merge-capable credentials scoped to the disposable repository', () => {
  const { call, binding, receipt } = setup();
  call(['workflow', 'conformance', '--binding', binding, '--out', receipt], true);
  const { details } = JSON.parse(readFileSync(receipt, 'utf8'));
  expect(details.missing.find((resource) => resource.includes('forge'))).toMatch(/merge-capable credentials.*disposable repository/i);
});

test('a mismatched running T3 server version holds opt-in', () => {
  const { optIn, base, workflows } = setup();
  writeFileSync(join(base, 'userdata/server-runtime.json'), '{"serverVersion":"0.1.11"}');
  expect(optIn(true)).toContain('running T3 server version');
  expect(existsSync(join(workflows, name))).toBe(false);
});

test('removal reads active status inventory and preserves concurrent edits', () => {
  const { optIn, remove, workflows, update } = setup();
  optIn();
  update({ activeRuns: [{ workflow, version: 1, status: 'waiting', runId: 'outside-recent-runs' }] });
  expect(remove(true)).toContain('outside-recent-runs');
  const target = join(workflows, name);
  update({ editDuringInventory: target });
  expect(remove(true)).toContain('modified');
  expect(readFileSync(target, 'utf8')).toBe('// changed during inventory');
});

test('opt-in refuses a binding in a Git worktree', () => {
  const { scratch, optIn, manifest } = setup();
  const repository = join(scratch, 'repository');
  mkdirSync(repository);
  writeFileSync(join(repository, '.git'), 'gitdir: fixture-worktree-metadata');
  const bindingPath = join(repository, 'private.json');
  writeFileSync(bindingPath, '{}', { mode: 0o600 });
  expect(optIn(true, { bindingPath })).toContain('binding must be outside the repository');
  expect(existsSync(manifest)).toBe(false);
});

test.each([false, true])('opt-in rejects a binding in its package, including an aliased package root (%s)', (aliased) => {
  const { scratch, optIn, manifest } = setup();
  const packageRoot = join(scratch, 'package');
  const packageAlias = join(scratch, 'package-alias');
  mkdirSync(join(packageRoot, 'skills/axstack'), { recursive: true });
  cpSync(join(root, 'skills/axstack/workflows'), join(packageRoot, 'skills/axstack/workflows'), { recursive: true });
  symlinkSync(packageRoot, packageAlias);
  const bindingPath = join(packageRoot, 'private.json');
  writeFileSync(bindingPath, '{}', { mode: 0o600 });
  const entry = fixtureEntry(scratch, { packageRoot: aliased ? packageAlias : packageRoot });
  expect(optIn(true, { bindingPath, entry })).toContain('binding must be outside the package');
  expect(existsSync(manifest)).toBe(false);
});

test.each(['binding', 'receipt', 'manifest'])('opt-in refuses a non-private %s', (kind) => {
  const fixture = setup();
  if (kind === 'manifest') fixture.optIn();
  chmodSync(fixture[kind], 0o644);
  expect(fixture.optIn(true)).toContain('must be a private regular file owned by the current user');
});

test.each(['binding', 'receipt', 'manifest'])('opt-in refuses a private %s owned by a different user', (kind) => {
  const fixture = setup();
  if (kind === 'manifest') fixture.optIn();
  // Project a foreign owner on just this file so the test also runs without chown authority.
  const entry = fixtureEntry(fixture.scratch, { prelude: `
import fs from 'node:fs';
import { mock } from 'bun:test';
const lstat = fs.lstatSync;
mock.module('node:fs', () => ({ ...fs, lstatSync(path, ...args) {
  const info = lstat(path, ...args);
  if (path === ${JSON.stringify(fixture[kind])}) info.uid = process.getuid() + 1;
  return info;
} }));
` });
  expect(fixture.optIn(true, { entry })).toContain('must be a private regular file owned by the current user');
});

test('opt-in repairs ownership persisted before an interrupted deployment', () => {
  const { scratch, optIn, manifest, workflows, binding } = setup();
  const target = join(workflows, name);
  const entry = fixtureEntry(scratch, { prelude: `
import fs from 'node:fs/promises';
import { mock } from 'bun:test';
const open = fs.open;
mock.module('node:fs/promises', () => ({ ...fs, open(path, ...args) {
  if (path.startsWith(${JSON.stringify(target + '.installing-')})) {
    console.error('interrupted before bundle deployment');
    process.exit(77);
  }
  return open(path, ...args);
} }));
` });
  expect(optIn(true, { entry })).toContain('interrupted before bundle deployment');
  expect(readdirSync(workflows)).toEqual([]);
  const ownership = readFileSync(manifest, 'utf8');
  expect(JSON.parse(ownership).workflows[workflow + '@1'].binding).toBe(binding);
  // The interrupted process exited. Clear its empty lock as documented for operators.
  rmdirSync(manifest + '.lock');
  expect(optIn()).toContain('registered');
  expect(readdirSync(workflows)).toEqual([name]);
  expect(readFileSync(manifest, 'utf8')).toBe(ownership);
});

test('removal drops an absent bundle from the manifest after its runs drain', () => {
  const { optIn, remove, workflows, manifest, update } = setup();
  optIn();
  unlinkSync(join(workflows, name));
  update({ runs: [{ workflow, version: 1, status: 'waiting', runId: 'orphaned-run' }] });
  expect(remove(true)).toContain('orphaned-run');
  expect(JSON.parse(readFileSync(manifest, 'utf8')).workflows).toHaveProperty(workflow + '@1');
  update();
  expect(remove()).toContain('removed');
  expect(JSON.parse(readFileSync(manifest, 'utf8')).workflows).toEqual({});
  expect(readdirSync(workflows)).toEqual([]);
});

test('failed registration preserves a file edited during the rollback inventory', () => {
  const { optIn, workflows, manifest, update } = setup();
  const target = join(workflows, name);
  update({ registered: 2, editDuringInventory: target });
  const result = optIn(true);
  expect(existsSync(target)).toBe(true);
  expect(readFileSync(target, 'utf8')).toBe('// changed during inventory');
  expect(result).toContain('modified');
  expect(JSON.parse(readFileSync(manifest, 'utf8')).workflows).toHaveProperty(workflow + '@1');
});
