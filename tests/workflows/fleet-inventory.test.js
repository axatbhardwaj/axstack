import { expect, test } from 'bun:test';
import { lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { assignmentCounts } from '../../skills/axstack/scripts/fleet-facts.js';
import { recommend } from '../../skills/axstack/scripts/fleet-route.js';
import { fixture, NOW } from './fleet-route-fixture.js';

function snapshot() {
  const f = fixture();
  const origin = { environmentId: 'env-personal-a', threadId: 'driver' };
  const item = (taskId, environmentId, threadId = 'same-thread') => ({ origin, clientRequestId: taskId,
    task: { taskId, childThreadId: null, childRunId: 'run-1', status: 'running',
      remoteChild: { environmentId, threadId } } });
  f.input.nativeInventory = { complete: true, observedAt: NOW, evidence: 'origin://inventory',
    tasks: [item('task-1', 'env-worker-a'), item('task-2', 'env-worker-b')], pending: [] };
  return { ...f, origin, item, counts: () => assignmentCounts(f.input, f.config.hosts, NOW) };
}

test('native tasks count actual destinations with null local children and host-distinct thread IDs', () => {
  const f = snapshot();
  const before = JSON.stringify(f.input);
  expect(f.counts().byEnvironment).toEqual({ 'env-worker-a': 1, 'env-worker-b': 1,
    'env-worker-c': 0, 'env-personal-a': 0, 'env-personal-b': 0 });
  expect(JSON.stringify(f.input)).toBe(before);
});

test('origin-qualified tasks, nested identity and reflected pending records count once', () => {
  const f = snapshot();
  const n = f.input.nativeInventory;
  n.tasks.push({ ...f.item('nested', 'env-worker-a'),
    assignmentRoot: { environmentId: f.origin.environmentId, taskId: 'task-1' } });
  n.tasks.push({ ...f.item('task-1', 'env-worker-b'),
    origin: { environmentId: 'env-worker-c', threadId: 'driver' } });
  n.pending.push({ origin: f.origin, clientRequestId: 'task-1', taskId: 'task-1', environmentId: 'env-worker-a' });
  expect(f.counts().byEnvironment['env-worker-a']).toBe(1);
  expect(f.counts().byEnvironment['env-worker-b']).toBe(2);
  expect(f.counts().inventoryStatus).toBe('known');
});

test.each([
  ['inventory-incomplete', (n) => { n.complete = false; }],
  ['destination-unknown', (n) => { delete n.tasks[0].task.remoteChild; }],
  ['host-unmapped', (n) => { n.tasks[0].task.remoteChild.environmentId = 'worker-a'; }],
  ['task-state-unknown', (n) => { n.tasks[0].task.status = 'idle'; }],
  ['origin-unknown', (n) => { delete n.tasks[0].origin; }],
  ['assignment-root-unknown', (n) => { n.tasks[0].assignmentRoot = { environmentId: 'missing', taskId: 'x' }; }],
])('native unknown inventory is never invented zero: %s', (code, alter) => {
  const f = snapshot();
  expect(f.counts().inventoryStatus).toBe('known');
  alter(f.input.nativeInventory);
  expect(f.counts()).toMatchObject({ inventoryStatus: 'unknown',
    byEnvironment: { 'env-worker-a': null }, inventoryReasons: [code] });
});

test('terminal tasks suppress their reflected pending record; accepted pending and duplicates do not double count', () => {
  const f = snapshot();
  const n = f.input.nativeInventory;
  n.tasks[0].task.status = 'completed';
  n.pending.push({ origin: f.origin, clientRequestId: 'task-1', taskId: 'task-1', environmentId: 'env-worker-a' });
  n.pending.push({ origin: f.origin, clientRequestId: 'pending', environmentId: 'env-worker-c' });
  n.pending.push(structuredClone(n.pending[1]));
  expect(f.counts().byEnvironment).toMatchObject({ 'env-worker-a': 0, 'env-worker-b': 1, 'env-worker-c': 1 });
});


test('native unknown inventory reaches selector flags and cannot claim a zero total', () => {
  const f = snapshot();
  f.input.nativeInventory.complete = false;
  const result = recommend(f.bind(), NOW);
  expect(result.flags.countsUnknown).toBe(true);
  expect(result.selected.assignmentCount).toBeNull();
});

test.each([
  ['inventory-incomplete', (n) => { n.tasks = {}; }],
  ['inventory-incomplete', (n) => { n.pending = null; }],
  ['inventory-incomplete', (n) => { n.observedAt = NOW + 1; }],
])('incomplete native collection remains unknown without throwing: %s', (code, alter) => {
  const f = snapshot();
  expect(f.counts().inventoryStatus).toBe('known');
  alter(f.input.nativeInventory);
  expect(f.counts()).toMatchObject({ inventoryStatus: 'unknown', inventoryReasons: [code] });
});

test('pending client identities include the actual origin driver, not just its host', () => {
  const f = snapshot();
  const n = f.input.nativeInventory;
  n.pending.push({ origin: f.origin, clientRequestId: 'same-client', environmentId: 'env-worker-c' });
  n.pending.push({ origin: { ...f.origin, threadId: 'other-driver' }, clientRequestId: 'same-client', environmentId: 'env-worker-c' });
  expect(f.counts().byEnvironment['env-worker-c']).toBe(2);
});

test('a completed turn with live children is still an active assignment', () => {
  const f = snapshot();
  f.input.nativeInventory.tasks[0].task.status = 'completed';
  f.input.nativeInventory.tasks[0].task.hasPendingChildRuns = true;
  f.input.nativeInventory.tasks[0].task.workState = 'waiting_for_children';
  expect(f.counts().byEnvironment['env-worker-a']).toBe(1);
});


test('real selector CLI spreads native pending batch once per 20/35/40 host without input writes', () => {
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/fleet-native-cli-`);
  const validate = () => {
    const stat = lstatSync(dir);
    expect(stat.isSymbolicLink()).toBe(false);
    expect(stat.uid).toBe(process.getuid());
    expect(stat.mode & 0o777).toBe(0o700);
    expect(realpathSync(dir)).toBe(dir);
  };
  validate();
  try {
    const f = snapshot();
    f.input.nativeInventory.tasks = [];
    const input = f.bind();
    writeFileSync(`${dir}/config.json`, input.configText);
    for (const [index, host] of ['worker-a', 'worker-b', 'worker-c'].entries()) {
      const bytes = JSON.stringify(input);
      writeFileSync(`${dir}/input.json`, bytes);
      const result = Bun.spawnSync([process.execPath, `${import.meta.dir}/../../skills/axstack/scripts/fleet-route.js`,
        'recommend', '--input', `${dir}/input.json`, '--config', `${dir}/config.json`, '--now', '100000', '--json'],
      { env: { ...process.env, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0' }, stdout: 'pipe', stderr: 'pipe' });
      expect(result.exitCode, result.stderr.toString()).toBe(0);
      const output = JSON.parse(result.stdout.toString());
      expect(output.selected).toMatchObject({ hostId: host, environmentId: `env-${host}`,
        projectId: `project-${host}`, execution: { model: 'fixture-model', options: { effort: 'high' } } });
      expect(output.flags.countsUnknown).toBe(false);
      expect(readFileSync(`${dir}/input.json`, 'utf8')).toBe(bytes);
      expect(readFileSync(`${dir}/config.json`, 'utf8')).toBe(input.configText);
      input.nativeInventory.pending.push({ origin: f.origin, clientRequestId: `batch-${index}`, environmentId: `env-${host}` });
    }
  } finally {
    validate();
    rmSync(dir, { recursive: true });
  }
});
