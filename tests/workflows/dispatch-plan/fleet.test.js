import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { recommend } from '../../../skills/axstack/scripts/fleet-route.js';
import { fixture, NOW } from '../fleet-route-fixture.js';
import { configuration, invoke, setup } from './fixtures.js';

function fleet() {
  const f = setup();
  const data = fixture();
  data.input.request = { ...data.input.request, providerInstanceId: 'codex', model: 'gpt-6.1-sol',
    options: { reasoningEffort: 'high', serviceTier: 'priority' } };
  // Read-only role, configured independently of the supplied placement request.
  f.roles.roles.push({ ...f.roles.roles[0], id: 'axstack-reader' });
  f.capabilities.providers[0].models[0].options.push({ id: 'serviceTier', values: ['default', 'priority'] });
  for (const d of data.input.destinations) {
    d.execution = { available: true, ...data.input.request };
    for (const key of ['task', 'role', 'requiredCapabilities', 'repositoryId']) delete d.execution[key];
  }
  const input = data.bind();
  const capabilitiesPath = f.save('capabilities', f.capabilities);
  const digest = () => new Bun.CryptoHasher('sha256').update(readFileSync(capabilitiesPath)).digest('hex');
  input.destinations.forEach((d) => { d.capabilitiesDigest = digest(); });
  let saved = recommend(input, NOW);
  const refresh = () => { saved = recommend(input, NOW); };
  const run = (configuration, extra = [], kind = 'task') => {
    const args = ['--role', 'axstack-reader', '--roles', f.save('roles', f.roles), '--kind', kind,
      '--capabilities', capabilitiesPath, '--fleet-input', f.save('fleet-input', input),
      '--recommendation', f.save('recommendation', saved), '--now', String(NOW),
      '--config-digest', input.configDigest, ...extra];
    if (configuration !== undefined) args.push('--verify', f.save('configuration', configuration));
    return invoke(args);
  };
  const readback = () => ({ ...configuration(), environmentId: 'worker-a', projectId: 'project-worker-a',
    fleetBinding: { configDigest: input.configDigest, destinationSnapshotId: 'snapshot-worker-a',
      destinationCapabilitiesDigest: digest() },
    modelSelection: { ...configuration().modelSelection, options: { reasoningEffort: 'high', serviceTier: 'priority' } } });
  return { ...f, input, run, refresh, readback, get saved() { return saved; } };
}

test('fleet plans bind task/launch destinations and preserve every requested option', () => {
  const f = fleet();
  for (const kind of ['task', 'launch']) {
    const result = f.run(undefined, [], kind);
    expect(result.status, result.error).toBe(0);
    const plan = JSON.parse(result.output);
    expect(plan.fleetBinding).toEqual(f.readback().fleetBinding);
    const selection = kind === 'task' ? plan.target : plan.modelSelection;
    expect(selection.model).toBe('gpt-6.1-sol');
    expect(selection.options).toEqual([{ id: 'reasoningEffort', value: 'high' }, { id: 'serviceTier', value: 'priority' }]);
    expect(kind === 'task' ? plan.target : plan).toMatchObject({ environmentId: 'worker-a', projectId: 'project-worker-a' });
    expect(plan.runtimeMode).toBe('full-access');
  }
  expect(f.run(f.readback()).output).toContain('MATCH');
});

test('fleet readback detects destination, snapshot, settings and config mismatches', () => {
  const f = fleet();
  for (const [field, change] of [
    ['environmentId', (v) => { v.environmentId = 'personal-a'; }],
    ['projectId', (v) => { v.projectId = 'other-project'; }],
    ['destinationSnapshotId', (v) => { v.fleetBinding.destinationSnapshotId = 'other-snapshot'; }],
    ['destinationCapabilitiesDigest', (v) => { v.fleetBinding.destinationCapabilitiesDigest = '0'.repeat(64); }],
    ['configDigest', (v) => { v.fleetBinding.configDigest = '0'.repeat(64); }],
    ['options', (v) => { delete v.modelSelection.options.serviceTier; }],
    ['runtimeMode', (v) => { v.runtimeMode = 'auto'; }],
    ['environmentId', (v) => { delete v.environmentId; }],
  ]) {
    const value = f.readback(); change(value);
    const result = f.run(value);
    expect(result.status, field).toBe(2);
    expect(result.output, field).toContain(field);
    expect(result.output, field).not.toContain('MATCH');
  }
});

test('fleet input and exact destination catalog bytes must agree with the recommendation', () => {
  for (const [change, reason] of [
    [(f) => { f.saved.selected.projectId = 'tampered'; }, 'recommendation-mismatch'],
    [(f) => { f.input.destinations[0].snapshotId = 'new'; }, 'recommendation-mismatch'],
    [(f) => { f.save('capabilities', { ...f.capabilities, originCatalog: true }); }, 'capabilities-digest-mismatch'],
    [(f) => { delete f.input.destinations[0].capabilitiesDigest; f.refresh(); }, 'capabilities-digest-missing'],
    [(f) => { f.input.request.model = 'gpt-6-sol'; f.input.destinations.forEach((d) => { d.execution.model = 'gpt-6-sol'; }); f.refresh(); }, 'settings-mismatch'],
    [(f) => { f.input.configDigest = '0'.repeat(64); }, 'config-digest-mismatch'],
  ]) {
    const f = fleet(); change(f);
    const result = f.run();
    expect(result.status, reason).toBe(2);
    expect(result.error, reason).toContain(reason);
    expect(result.output).toBe('');
  }
});

test('fleet binding requires explicit pin, facts and evaluation time together', () => {
  const f = setup();
  const args = ['--role', 'axstack-author', '--roles', f.save('roles', f.roles), '--kind', 'task',
    '--capabilities', f.save('capabilities', f.capabilities)];
  const result = invoke([...args, '--recommendation', f.save('recommendation', {})]);
  expect(result.status).toBe(1);
  expect(result.error).toContain('fleet-input');
});
