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
  const run = (configuration, extra = [], kind = 'task', overrides = {}) => {
    const args = ['--role', overrides.role ?? 'axstack-reader', '--roles', f.save('roles', f.roles), '--kind', kind,
      '--capabilities', capabilitiesPath, '--fleet-input', f.save('fleet-input', input),
      '--recommendation', f.save('recommendation', saved), '--now', overrides.now ?? String(NOW),
      '--config-digest', overrides.pin ?? input.configDigest, ...extra];
    if (overrides.omit) args.splice(args.indexOf(overrides.omit), 2);
    if (configuration !== undefined) args.push('--verify', f.save('configuration', configuration));
    return invoke(args);
  };
  const readback = () => ({ ...configuration(), environmentId: 'worker-a', projectId: 'project-worker-a',
    fleetBinding: { configDigest: input.configDigest, destinationSnapshotId: 'snapshot-worker-a',
      destinationCapabilitiesDigest: digest() },
    modelSelection: { ...configuration().modelSelection, options: { reasoningEffort: 'high', serviceTier: 'priority' } } });
  const refreshCatalog = () => {
    f.save('capabilities', f.capabilities);
    input.destinations.forEach((d) => { d.capabilitiesDigest = digest(); });
    refresh();
  };
  const setRequest = (patch) => {
    Object.assign(input.request, patch);
    for (const d of input.destinations) for (const key of ['providerInstanceId', 'model', 'options', 'runtimeMode']) {
      d.execution[key] = input.request[key];
    }
    refresh();
  };
  return { ...f, input, config: data.config, run, refresh, refreshCatalog, setRequest, readback,
    bindConfig() { data.bind(); refresh(); }, get saved() { return saved; } };
}

function planned(f, overrides = {}, environmentId = 'worker-a') {
  const result = f.run(undefined, [], 'task', overrides);
  expect(result.status, result.error).toBe(0);
  expect(result.error).toBe('');
  expect(JSON.parse(result.output).target).toMatchObject({ providerInstanceId: 'codex',
    model: 'gpt-6.1-sol', environmentId, projectId: `project-${environmentId}` });
}

function held(result, code) {
  expect(result.status, result.error).toBe(2);
  expect(result.error).toBe(`dispatch-plan hold: ${code}\n`);
  expect(result.output).toBe('');
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
    [(f) => { f.input.configDigest = '0'.repeat(64); }, 'config-digest-mismatch'],
  ]) {
    const f = fleet(); planned(f); change(f);
    const result = f.run();
    held(result, reason);
  }
});

test.each(['--recommendation', '--fleet-input', '--now', '--config-digest'])('fleet binding requires %s with the other three flags', (omit) => {
  const f = fleet();
  planned(f);
  const result = f.run(undefined, [], 'task', { omit });
  expect(result.status).toBe(1);
  expect(result.error).toBe(`dispatch-plan error: expected ${omit} for fleet binding\n`);
  expect(result.output).toBe('');
});

test('binding evaluation time requires integer spelling even when numeric coercion would match', () => {
  const f = fleet();
  planned(f);
  const result = f.run(undefined, [], 'task', { now: '1e5' });
  expect(result.status).toBe(1);
  expect(result.error).toBe('dispatch-plan error: evaluation-time\n');
  expect(result.output).toBe('');
});

test('run pin rejects a different valid reviewed config, even when its recommendation agrees', () => {
  const f = fleet();
  planned(f);
  const runPin = f.input.configDigest;
  f.config.balanceLimitBp = 4500;
  f.bindConfig();
  planned(f); // The alternate config and its own pin are independently executable.
  expect(f.saved.configDigest).toBe(f.input.configDigest);
  held(f.run(undefined, [], 'task', { pin: runPin }), 'config-digest-mismatch');
});

test.each([
  ['provider', { providerInstanceId: 'codexAlt' }],
  ['model', { model: 'gpt-6-sol' }],
  ['runtime', { runtimeMode: 'plan' }],
  ['effort', { options: { reasoningEffort: 'low', serviceTier: 'priority' } }],
  ['missing effort', { options: { serviceTier: 'priority' } }],
])('destination-proven %s must still match the configured role', (_, patch) => {
  const f = fleet();
  planned(f);
  f.setRequest(patch); // Keep destination execution consistent so the selector cannot mask this check.
  expect(f.saved.selected?.environmentId).toBe('worker-a');
  held(f.run(), 'settings-mismatch');
});

test.each(['reader', 'author'])('a valid %s request cannot acquire the opposite role binding', (role) => {
  const f = fleet();
  f.setRequest({ role });
  const configured = role === 'author' ? 'axstack-author' : 'axstack-reader';
  planned(f, { role: configured }, role === 'author' ? 'personal-a' : 'worker-a');
  held(f.run(undefined, [], 'task', { role: role === 'author' ? 'axstack-reader' : 'axstack-author' }), 'settings-mismatch');
});

test('fully proven coordinator selection stays held after a valid local author plan', () => {
  const f = fleet();
  f.setRequest({ role: 'author' });
  planned(f, { role: 'axstack-author' }, 'personal-a');
  const route = f.config.routes[0];
  route.kind = 'remote-author-coordinator';
  route.authorProof = { originEnvironmentId: 'personal-a', environmentId: 'worker-a',
    originVersions: structuredClone(f.input.origin.versions),
    destinationVersions: structuredClone(f.input.destinations[0].versions),
    evidence: structuredClone(route.evidence), gatesPassed: true };
  f.bindConfig();
  expect(f.saved.selected).toMatchObject({ environmentId: 'worker-a', routeKind: 'remote-author-coordinator' });
  held(f.run(undefined, [], 'task', { role: 'axstack-author' }), 'remote-author-not-enabled');
});

test.each([
  ['ambiguous model', (f) => { f.capabilities.providers[0].models.push(structuredClone(f.capabilities.providers[0].models[0])); }, 'capabilities-model-ambiguous'],
  ['ambiguous option', (f) => { f.capabilities.providers[0].models[0].options.push({ id: 'serviceTier', values: ['priority'] }); }, 'unsupported-option'],
  ['missing option', (f) => { f.capabilities.providers[0].models[0].options.pop(); }, 'unsupported-option'],
  ['unadvertised value', (f) => { f.capabilities.providers[0].models[0].options.at(-1).values = ['default']; }, 'unsupported-option: serviceTier'],
  ['missing values', (f) => { delete f.capabilities.providers[0].models[0].options.at(-1).values; }, 'unsupported-option: serviceTier'],
])('a digest-bound catalog with %s cannot emit a plan', (_, change, code) => {
  const f = fleet();
  planned(f);
  change(f);
  f.refreshCatalog(); // Bind the changed bytes, not a stale digest that would hide option validation.
  expect(f.saved.selected?.environmentId).toBe('worker-a');
  held(f.run(), code);
});

test.each([
  ['unknown option', { reasoningEffort: 'high', unknown: 'priority' }, 'unsupported-option'],
  ['empty option id', { reasoningEffort: 'high', '': 'priority' }, 'unsupported-option'],
  ['invalid value type', { reasoningEffort: 'high', serviceTier: 1 }, 'unsupported-option'],
  ['unadvertised value', { reasoningEffort: 'high', serviceTier: 'turbo' }, 'unsupported-option: serviceTier'],
])('destination-proven %s still requires catalog support', (_, options, code) => {
  const f = fleet();
  planned(f);
  f.setRequest({ options });
  expect(f.saved.selected?.environmentId).toBe('worker-a');
  held(f.run(), code);
});

test('no-route is a deliberate hold, not an internal error or a plan', () => {
  const f = fleet();
  planned(f);
  f.input.destinations = [];
  f.refresh();
  expect(f.saved).toMatchObject({ stage: 'no-route', selected: null });
  held(f.run(), 'no-executable-route');
});

test.each([
  ['unknown recommendation schema', (f) => { f.saved.schemaVersion = 2; }, 'schema-version: recommendation'],
  ['unknown input schema', (f) => { f.input.schemaVersion = 2; }, 'schema-version: input'],
  ['invalid config bytes', (f) => { f.input.configText += '\n'; }, 'config-digest-mismatch'],
  ['malformed catalog digest', (f) => { f.input.destinations[0].capabilitiesDigest = 'not-sha256'; f.refresh(); }, 'capabilities-digest-missing'],
])('%s has its own binding hold without emitting a plan', (_, change, code) => {
  const f = fleet();
  planned(f);
  change(f);
  held(f.run(), code);
});
