import { describe, expect, test } from 'bun:test';
import { recommend, parseFleetConfig } from '../../skills/axstack/scripts/fleet-route.js';
import { fixture, NOW } from './fleet-route-fixture.js';
const run = (f) => recommend(f.bind(), NOW);
const selected = (f) => run(f).selected?.hostId;

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
  test.each(['personal-a', 'personal-b'])('author local-only fallback on %s ignores soft pool preference', (local) => {
    const f = fixture([1000, 1000, 1000, 9500, 9500]);
    f.input.origin.environmentId = local;
    f.config.routes.forEach((r) => { r.originEnvironmentId = local; r.kind = r.environmentId === local ? 'local' : 'remote'; });
    f.input.request.role = 'author';
    expect(run(f)).toMatchObject({ stage: 'fallback', selected: { hostId: local }, flags: { localAuthorOnly: true, overloaded: true } });
    expect(run(f).excluded.every((r) => r.reasons.includes('remote-author-unsupported'))).toBe(true);
  });
  test('required actual session overrides preferences, without credential movement', () => {
    const f = fixture();
    f.input.request.requiredCapabilities = ['session:sign-in'];
    f.input.destinations.forEach((d) => { d.capabilities['session:sign-in'].value = d.environmentId === 'personal-b'; });
    expect(selected(f)).toBe('personal-b');
  });
  test('remote author coordinator is disabled without exact pair/version evidence', () => {
    const f = fixture();
    f.input.request.role = 'author';
    const r = f.config.routes[0]; r.kind = 'remote-author-coordinator'; r.enabled = false;
    expect(selected(f)).toBe('personal-a');
    r.enabled = true;
    expect(run(f).excluded[0].reasons).toContain('remote-author-unproven');
    r.authorProof = { originEnvironmentId: 'personal-a', environmentId: 'worker-a',
      originVersions: f.input.origin.versions, destinationVersions: f.input.destinations[0].versions,
      evidence: r.evidence, gatesPassed: true };
    expect(selected(f)).toBe('worker-a');
    f.input.destinations[0].versions = { t3: 'new', axstack: '0.54.0' };
    expect(selected(f)).toBe('personal-a');
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
    ['inventory-schema', (f) => { f.input.inventoryStatus = 'maybe'; f.bind(); }],
    ['assignment-schema', (f) => { f.input.assignments = [{ assignmentId: 'no-origin', environmentId: 'worker-a', state: 'running' }]; f.bind(); }],
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
    expect(run(f).excluded[0]).toMatchObject({ evidence: {
      configuredRoute: { environmentId: 'worker-a', pointer: 'fixture://proof' },
      observedRoute: { environmentId: 'worker-a', pointer: 'fixture://proof' },
      destination: { environmentId: 'worker-a', pointer: 'fixture://proof' },
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
