import { describe, expect, test } from 'bun:test';
import { recommend, parseFleetConfig } from '../../skills/axstack/scripts/fleet-route.js';
import { fixture, NOW } from './fleet-route-fixture.js';
const run = (f) => recommend(f.bind(), NOW);
const selected = (f) => run(f).selected?.hostId;

function authorFixture() {
  const f = fixture(); f.input.request.role = 'author';
  const route = f.config.routes[0]; route.kind = 'remote-author-coordinator';
  route.authorProof = { originEnvironmentId: 'env-personal-a', environmentId: 'env-worker-a',
    originVersions: structuredClone(f.input.origin.versions),
    destinationVersions: structuredClone(f.input.destinations[0].versions),
    evidence: structuredClone(route.evidence), gatesPassed: true };
  return f;
}

describe('eligibility before load', () => {
  test.each([
    ['offline', (f) => { f.input.routeFacts[0].reachable = false; }],
    ['unauthorized', (f) => { f.input.routeFacts[0].authorized = false; }],
    ['link-expired', (f) => { f.input.routeFacts[0].expiresAt = NOW; }],
    ['destination-unproven', (f) => { f.input.destinations[0].status = 'unknown'; }],
    ['target-snapshot-mismatch', (f) => { f.input.routeFacts[0].destinationSnapshotId = 'other'; }],
    ['project-missing', (f) => { f.input.destinations[0].project = null; }],
    ['project-mismatch', (f) => { f.input.destinations[0].project.repositoryId = 'other'; }],
    ['execution-mismatch', (f) => { f.input.destinations[0].execution.model = 'other'; }],
    ['execution-unproven', (f) => { f.input.destinations[0].execution.available = false; }],
    ['execution-unproven', (f) => { delete f.input.destinations[0].execution.available; }],
    ['execution-mismatch', (f) => { f.input.destinations[0].execution.providerInstanceId = 'other-provider'; }],
    ['execution-mismatch', (f) => { f.input.destinations[0].execution.runtimeMode = 'plan'; }],
    ['execution-mismatch', (f) => { f.input.destinations[0].execution.options = { effort: 'low' }; }],
    ['execution-mismatch', (f) => { f.input.destinations[0].execution.options = {}; }],
    ['capability-unproven', (f) => { f.input.request.requiredCapabilities = ['browser:headed']; f.input.destinations[0].capabilities['browser:headed'].value = null; }],
    ['capability-unproven', (f) => { f.input.request.requiredCapabilities = ['browser:headed']; delete f.config.hosts[0].capabilities['browser:headed']; }],
    ['evidence-unproven', (f) => { f.input.destinations[0].evidence.environmentId = 'other'; }],
  ])('%s excludes a cool route with its reason', (reason, mutate) => {
    const f = fixture(); mutate(f);
    expect(selected(f)).toBe('worker-b');
    expect(run(f).excluded[0]).toMatchObject({ hostId: 'worker-a', reasons: [reason] });
  });
  test('explicit route/host exclusions permit a retry without granting permission', () => {
    const f = fixture();
    f.input.exclusions.routes['route-worker-a'] = 'unambiguous launch failure';
    f.input.exclusions.hosts['worker-b'] = 'maintenance';
    expect(run(f)).toMatchObject({ selected: { hostId: 'worker-c', projectId: 'project-worker-c', routeId: 'route-worker-c', destinationSnapshotId: 'snapshot-worker-c' } });
    expect(run(f).excluded.map((e) => e.reasons[0])).toEqual(['excluded-route', 'excluded-host']);
  });
  test.each([['personal-a', 'env-personal-a'], ['personal-b', 'env-personal-b']])('author local-only fallback on %s ignores soft pool preference', (local, environmentId) => {
    const f = fixture([1000, 1000, 1000, 9500, 9500]);
    f.input.origin.environmentId = environmentId;
    f.config.routes.forEach((r) => { r.originEnvironmentId = environmentId; r.kind = r.environmentId === environmentId ? 'local' : 'remote'; });
    f.input.request.role = 'author';
    expect(run(f)).toMatchObject({ stage: 'fallback', selected: { hostId: local, environmentId }, flags: { localAuthorOnly: true, overloaded: true } });
    expect(run(f).excluded.every((r) => r.reasons.includes('remote-author-unsupported'))).toBe(true);
  });
  test('required actual session overrides preferences, without credential movement', () => {
    const f = fixture();
    f.input.request.requiredCapabilities = ['session:sign-in'];
    f.input.destinations.forEach((d) => { d.capabilities['session:sign-in'].value = d.environmentId === 'env-personal-b'; });
    expect(selected(f)).toBe('personal-b');
  });
  test('a disabled coordinator with complete valid proof stays disabled', () => {
    const f = authorFixture();
    expect(selected(f)).toBe('worker-a');
    f.config.routes[0].enabled = false;
    expect(selected(f)).toBe('personal-a');
    expect(run(f).excluded[0].reasons).toEqual(['route-disabled']);
  });
  test.each([
    ['missing proof', (f) => { delete f.config.routes[0].authorProof; }],
    ['gates not passed', (f) => { f.config.routes[0].authorProof.gatesPassed = false; }],
    ['missing gate result', (f) => { delete f.config.routes[0].authorProof.gatesPassed; }],
    ['wrong proof origin', (f) => { f.config.routes[0].authorProof.originEnvironmentId = 'other-origin'; }],
    ['wrong proof destination', (f) => { f.config.routes[0].authorProof.environmentId = 'env-worker-b'; }],
    ...['t3', 'axstack'].flatMap((version) => [
      [`changed origin ${version}`, (f) => { f.input.origin.versions = { ...f.input.origin.versions, [version]: 'changed' }; }],
      [`changed destination ${version}`, (f) => { f.input.destinations[0].versions = { ...f.input.destinations[0].versions, [version]: 'changed' }; }],
      [`missing proof origin ${version}`, (f) => { delete f.config.routes[0].authorProof.originVersions[version]; }],
      [`missing proof destination ${version}`, (f) => { delete f.config.routes[0].authorProof.destinationVersions[version]; }],
    ]),
    ['missing origin versions', (f) => { delete f.config.routes[0].authorProof.originVersions; }],
    ['missing destination versions', (f) => { delete f.config.routes[0].authorProof.destinationVersions; }],
    ['missing proof evidence', (f) => { delete f.config.routes[0].authorProof.evidence; }],
    ['wrong proof evidence host', (f) => { f.config.routes[0].authorProof.evidence.environmentId = 'env-worker-b'; }],
    ['empty proof evidence pointer', (f) => { f.config.routes[0].authorProof.evidence.pointer = ''; }],
    ['missing proof evidence time', (f) => { delete f.config.routes[0].authorProof.evidence.observedAt; }],
    ['future proof evidence', (f) => { f.config.routes[0].authorProof.evidence.observedAt = NOW + 1; }],
  ])('%s invalidates an otherwise usable coordinator', (_, mutate) => {
    const f = authorFixture();
    expect(selected(f)).toBe('worker-a');
    mutate(f);
    expect(selected(f)).toBe('personal-a');
    expect(run(f).excluded[0].reasons).toEqual(['remote-author-unproven']);
  });
  test('a route configured for another origin cannot be borrowed', () => {
    const f = authorFixture();
    expect(selected(f)).toBe('worker-a');
    f.config.routes[0].originEnvironmentId = 'other-origin';
    expect(selected(f)).toBe('personal-a');
    expect(run(f).excluded[0]).toMatchObject({ hostId: 'worker-a', environmentId: 'env-worker-a', routeId: null, reasons: ['route-missing'] });
  });
  test.each(['configured', 'observed'])('authors require automatic %s local isolation', (source) => {
    const f = fixture(); f.input.request.role = 'author';
    expect(f.input.request.requiredCapabilities).toEqual([]);
    expect(selected(f)).toBe('personal-a');
    const host = source === 'configured' ? f.config.hosts[3] : f.input.destinations[3];
    host.capabilities['worktree-isolation'].value = false;
    const result = run(f);
    expect(result).toMatchObject({ stage: 'no-route', selected: null });
    expect(result.excluded.find((r) => r.hostId === 'personal-a').reasons).toEqual(['capability-unproven']);
  });
  test('no executable route produces no-route and reasons, never a successful dispatch', () => {
    const f = fixture(); f.input.routeFacts = [];
    expect(run(f)).toMatchObject({ stage: 'no-route', reason: 'no-executable-route', selected: null });
    expect(run(f).excluded).toHaveLength(5);
  });
});

describe('schema and configuration binding', () => {
  test('digest binds exact bytes and is returned with destination settings', () => {
    const f = fixture(); const input = f.bind();
    expect(parseFleetConfig(input.configText, input.configDigest).schemaVersion).toBe(1);
    expect(recommend(input, NOW)).toMatchObject({ configDigest: input.configDigest, selected: { execution: f.input.destinations[0].execution } });
    input.configText += '\n';
    expect(() => recommend(input, NOW)).toThrow('config-digest-mismatch');
  });
  test.each([
    ['missing-config', (f) => { f.bind(); f.input.configText = ''; }],
    ['config-digest', (f) => { f.bind(); f.input.configDigest = ''; }],
    ['config-json', (f) => { f.input.configText = '{'; f.input.configDigest = new Bun.CryptoHasher('sha256').update('{').digest('hex'); }],
    ['schema-version', (f) => { f.input.schemaVersion = 99; f.bind(); }],
    ['schema-version', (f) => { f.config.schemaVersion = 99; f.bind(); }],
    ['config-order', (f) => { f.config.defaultOrder = ['worker-a']; f.bind(); }],
    ['config-host', (f) => { f.config.hosts.push(f.config.hosts[0]); f.bind(); }],
    ['config-threshold', (f) => { f.config.balanceLimitBp = 50.1; f.bind(); }],
    ...[-1, 10001, 5000.5, null].map((limit) => ['config-threshold', (f) => { f.config.hosts[0].fallbackLimitBp = limit; f.bind(); }]),
    ['config-order', (f) => { f.config.pool = ['unconfigured-host']; f.bind(); }],
    ['config-order', (f) => { f.config.pool = ['worker-a', 'worker-a']; f.bind(); }],
    ['config-order', (f) => { f.config.taskOrders.playwright = ['worker-a']; f.bind(); }],
    ['config-order', (f) => { f.config.taskOrders.playwright = [...f.config.defaultOrder.slice(0, 4), 'worker-a']; f.bind(); }],
    ['config-route', (f) => { f.config.routes[0].kind = 'local'; f.bind(); }],
    ['config-route', (f) => { f.config.routes[3].kind = 'remote'; f.bind(); }],
    ['config-route', (f) => { f.config.routes.push(structuredClone(f.config.routes[0])); f.bind(); }],
    ['config-host', (f) => { f.config.hosts[1].environmentId = 'env-worker-a'; f.bind(); }],
    ...[undefined, -1, NOW - 0.5, NOW + 1].map((observedAt) => ['inventory-schema', (f) => { f.input.inventoryObservedAt = observedAt; f.bind(); }]),
    ...[['destinations', 'environmentId'], ['routeFacts', 'routeId'], ['telemetry', 'environmentId']].flatMap(([key, id]) => [
      [`${key}-schema`, (f) => { f.input[key].push(structuredClone(f.input[key][0])); f.bind(); }],
      [`${key}-schema`, (f) => { delete f.input[key][0][id]; f.bind(); }],
    ]),
    ['inventory-schema', (f) => { f.input.inventoryStatus = 'maybe'; f.bind(); }],
    ['assignment-schema', (f) => { f.input.assignments = [{ assignmentId: 'no-origin', environmentId: 'env-worker-a', state: 'running' }]; f.bind(); }],
  ])('%s fails explicitly', (reason, mutate) => {
    const f = fixture(); mutate(f);
    expect(() => recommend(f.input, NOW)).toThrow(reason);
  });
  test('injected time is required', () => { expect(() => recommend(fixture().bind())).toThrow('evaluation-time'); });
});

describe('explanations and hostile JSON keys', () => {
  test('local author limitation is a reason, with the underlying load decision retained', () => {
    const f = fixture(); f.input.request.role = 'author';
    expect(run(f)).toMatchObject({ reason: 'author-local-only', decisionReason: 'first-within-limit' });
  });
  test('exclusions preserve host-qualified evidence and caller explanation', () => {
    const f = fixture(); f.input.routeFacts[0].authorized = false;
    expect(run(f).excluded[0]).toMatchObject({ hostId: 'worker-a', environmentId: 'env-worker-a', evidence: {
      configuredRoute: { environmentId: 'env-worker-a', pointer: 'fixture://proof' },
      observedRoute: { environmentId: 'env-worker-a', pointer: 'fixture://proof' },
      destination: { environmentId: 'env-worker-a', pointer: 'fixture://proof' },
      destinationSnapshotId: 'snapshot-worker-a',
    } });
  });
  test('unconfigured task names use default order even for inherited object keys', () => {
    const f = fixture(); f.input.request.task = 'toString';
    expect(selected(f)).toBe('worker-a');
  });
  test('decimal fractions retain exact basis point boundaries', () => {
    const f = fixture(); delete f.input.telemetry[0].cpuBp;
    f.input.telemetry[0].cpuFraction = 0.07;
    expect(run(f).selected.telemetry.cpuBp).toBe(700);
  });
});

test('author coordinator routes cannot be used for read-only roles', () => {
  const f = fixture(); f.config.routes[0].kind = 'remote-author-coordinator';
  expect(selected(f)).toBe('worker-b');
  expect(run(f).excluded[0].reasons).toContain('route-role-mismatch');
});

describe('destination evidence and execution settings', () => {
  test('option maps and nested settings compare by value regardless of key order', () => {
    const f = fixture();
    f.input.request.options = { effort: 'high', limits: { tokens: 100, requests: 2 } };
    f.input.destinations[0].execution.options = { limits: { requests: 2, tokens: 100 }, effort: 'high' };
    const result = run(f);
    expect(result.selected.hostId).toBe('worker-a');
    expect(result.selected.execution.options).toEqual({ effort: 'high', limits: { tokens: 100, requests: 2 } });
    expect(result.excluded.some((r) => r.hostId === 'worker-a')).toBe(false);
  });
  const invalidEvidence = [
    ['missing', () => undefined],
    ['wrong host', (e) => ({ ...e, environmentId: 'other-host' })],
    ['empty pointer', (e) => ({ ...e, pointer: '' })],
    ['missing time', (e) => ({ ...e, observedAt: undefined })],
    ['negative time', (e) => ({ ...e, observedAt: -1 })],
    ['fractional time', (e) => ({ ...e, observedAt: NOW - 0.5 })],
    ['future time', (e) => ({ ...e, observedAt: NOW + 1 })],
  ];
  test.each([
    ['configured route', (f) => f.config.routes[0]],
    ['observed route', (f) => f.input.routeFacts[0]],
    ['destination', (f) => f.input.destinations[0]],
  ].flatMap(([surface, owner]) => invalidEvidence.map(([label, invalid]) => [`${surface}: ${label}`, owner, invalid])))
  ('%s excludes only the route with unproven evidence', (_, owner, invalid) => {
    const f = fixture(); expect(selected(f)).toBe('worker-a');
    const fact = owner(f); fact.evidence = invalid(fact.evidence);
    const result = run(f);
    expect(result.selected.hostId).toBe('worker-b');
    expect(result.excluded[0].reasons).toEqual(['evidence-unproven']);
  });
  test.each([
    ['configured', (f) => f.config.hosts[0]], ['observed', (f) => f.input.destinations[0]],
  ].flatMap(([surface, owner]) => invalidEvidence.map(([label, invalid]) => [`${surface}: ${label}`, owner, invalid])))
  ('%s capability evidence cannot satisfy a required capability', (_, owner, invalid) => {
    const f = fixture(); f.input.request.requiredCapabilities = ['browser:headed'];
    expect(selected(f)).toBe('worker-a');
    const capability = owner(f).capabilities['browser:headed'];
    capability.evidence = invalid(capability.evidence);
    expect(selected(f)).toBe('worker-b');
    expect(run(f).excluded[0].reasons).toEqual(['capability-unproven']);
  });
  test.each([undefined, -1, NOW - 0.5, NOW + 1])('invalid destination observation %s is unproven', (observedAt) => {
    const f = fixture(); f.input.destinations[0].observedAt = observedAt;
    expect(selected(f)).toBe('worker-b');
    expect(run(f).excluded[0].reasons).toEqual(['evidence-unproven']);
  });
});
