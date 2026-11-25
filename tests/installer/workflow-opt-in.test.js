import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
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
  const call = (args, expectFail = false) => runCli(cli, args, {
    cwd: scratch, expectFail, env: { HOME: home, PATH: bin }, unset: ['T3CODE_HOME', 'T3CODE_WORKFLOWS'],
  }).out;
  const optIn = (expectFail = false) => call([
    'workflow', 'opt-in', '--name', workflow, '--binding', binding, '--conformance', receipt, '--yes',
  ], expectFail);
  const remove = (expectFail = false) => call(['workflow', 'remove', '--name', workflow, '--version', '1', '--yes'], expectFail);
  return { home, base, workflows, manifest, binding, receipt, call, optIn, remove, update };
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
});

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
