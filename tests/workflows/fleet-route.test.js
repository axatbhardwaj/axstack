import { describe, expect, test } from 'bun:test';
import { recommend } from '../../skills/axstack/scripts/fleet-route.js';
import { fixture, NOW } from './fleet-route-fixture.js';
const run = (f) => recommend(f.bind(), NOW);
const selected = (f) => run(f).selected?.hostId;

describe('ordered fleet placement', () => {
  test('three assignments at 20/35/40 spread one per worker, without mutating input', () => {
    const f = fixture();
    const picks = [];
    for (let i = 0; i < 3; i++) {
      const input = f.bind();
      const before = JSON.stringify(input);
      const result = recommend(input, NOW);
      expect(JSON.stringify(input)).toBe(before);
      expect(result.stage).toBe('balance');
      picks.push(result.selected.hostId);
      f.input.pendingAssignments.push({ clientRequestId: `batch:${i}`, environmentId: result.selected.environmentId });
    }
    expect(picks).toEqual(['worker-a', 'worker-b', 'worker-c']);
  });
  test('balance threshold returns afresh; CPU and RAM both determine pressure', () => {
    const f = fixture([5000, 5001, 5001, 0, 0]);
    expect(run(f).stage).toBe('balance');
    f.input.telemetry[0].ramBp = 5001;
    expect(run(f).stage).toBe('fallback');
    f.input.telemetry[0].ramBp = 1000;
    expect(run(f).stage).toBe('balance');
    expect(selected(f)).toBe('worker-a');
  });
  test('unknown pool precedes measured personal hosts; partly unknown uses fallback', () => {
    const f = fixture([null, null, null, 2000, 2000]);
    expect(run(f)).toMatchObject({ stage: 'pool-unknown', reason: 'pool-all-unknown', selected: { hostId: 'worker-a' } });
    f.input.telemetry[0].cpuBp = 6000;
    f.input.routeFacts[2].reachable = false;
    expect(run(f)).toMatchObject({ stage: 'fallback', selected: { hostId: 'worker-a' }, flags: { poolPartlyUnknown: true } });
    f.input.routeFacts[0].reachable = false;
    f.input.routeFacts[1].reachable = false;
    expect(run(f)).toMatchObject({ stage: 'fallback', selected: { hostId: 'personal-a' }, flags: { poolEmpty: true } });
    expect(run(f).excluded).toHaveLength(3);
  });
  test('fallback thresholds are inclusive; all overloaded continues by load then order', () => {
    const f = fixture([7500, 8500, 8600, 9000, 9000]);
    expect(selected(f)).toBe('worker-a');
    f.input.telemetry[0].cpuBp = 7501;
    expect(selected(f)).toBe('worker-b');
    f.input.telemetry[1].cpuBp = 8501;
    expect(run(f)).toMatchObject({ selected: { hostId: 'worker-a' }, flags: { overloaded: true } });
    f.input.telemetry.forEach((s) => { s.cpuBp = 9000; });
    expect(selected(f)).toBe('worker-a');
  });
  test('task preference only breaks balance ties, but orders unknown and fallback', () => {
    const f = fixture([2000, 2000, 2000, 1000, 1000]);
    f.input.request.task = 'playwright';
    f.input.request.requiredCapabilities = ['browser:headed'];
    expect(selected(f)).toBe('worker-c');
    f.input.pendingAssignments.push({ clientRequestId: 'batch:one', environmentId: 'worker-c' });
    expect(selected(f)).toBe('worker-a');
    f.input.pendingAssignments = [];
    f.input.telemetry[2].cpuBp = 3000;
    expect(selected(f)).toBe('worker-a');
    f.input.telemetry.forEach((s) => { s.cpuBp = 6000; });
    expect(selected(f)).toBe('worker-c');
  });
  test('policy is generic: configuration supplies pool, order and thresholds', () => {
    const f = fixture();
    f.config.pool = ['personal-b'];
    f.config.balanceLimitBp = 1000;
    f.config.defaultOrder.reverse();
    f.config.hosts[4].fallbackLimitBp = 2000;
    expect(run(f)).toMatchObject({ stage: 'fallback', selected: { hostId: 'personal-b' } });
    f.input.telemetry[4].cpuBp = 1000;
    expect(run(f).stage).toBe('balance');
  });
});

describe('assignment provenance', () => {
  test('origin-qualified IDs and task mappings de-duplicate inventory and pending', () => {
    const f = fixture();
    f.input.assignments = [
      { assignmentId: 'origin:task-1', environmentId: 'worker-a', state: 'running' },
      { assignmentId: 'origin:task-1', environmentId: 'worker-a', state: 'running' },
      { assignmentId: 'origin:done', environmentId: 'worker-b', state: 'completed' },
    ];
    f.input.pendingAssignments = [
      { clientRequestId: 'batch:a', environmentId: 'worker-a', taskId: 'origin:task-1' },
      { clientRequestId: 'batch:a', environmentId: 'worker-a', taskId: 'origin:task-1' },
      { clientRequestId: 'batch:b', environmentId: 'worker-b' },
      { clientRequestId: 'batch:b', environmentId: 'worker-b' },
      { clientRequestId: 'batch:done', environmentId: 'worker-b', taskId: 'origin:done' },
    ];
    expect(selected(f)).toBe('worker-c');
    expect(run(f).counts).toMatchObject({ byEnvironment: { 'worker-a': 1, 'worker-b': 1, 'worker-c': 0 }, inventoryStatus: 'known', inventoryObservedAt: NOW });
  });
  test('unavailable inventory uses pending only with explicit uncertainty', () => {
    const f = fixture();
    f.input.inventoryStatus = 'unknown';
    f.input.assignments = [{ assignmentId: 'origin:stale', environmentId: 'worker-b', state: 'running' }];
    f.input.pendingAssignments = [{ clientRequestId: 'batch:a', environmentId: 'worker-a' }];
    expect(run(f)).toMatchObject({ selected: { hostId: 'worker-b' }, flags: { countsUnknown: true } });
  });
  test('ambiguous identity mapping is rejected rather than undercounted', () => {
    const f = fixture();
    f.input.assignments = ['worker-a', 'worker-b'].map((environmentId) => ({ assignmentId: 'origin:one', environmentId, state: 'running' }));
    expect(() => run(f)).toThrow('assignment-conflict');
  });
});

describe('clock, precision and telemetry', () => {
  test.each([
    ['stale', { receivedAt: NOW - 15001 }], ['future', { receivedAt: NOW + 1 }],
    ['failed', { status: 'failed' }], ['timeout', { status: 'timeout' }],
    ['malformed', { cpuBp: 10001 }], ['fractional-bp', { cpuBp: 5000.1 }],
    ['short', { durationMs: 4999 }], ['process-only', { scope: 't3-processes' }],
    ['missing-source', { source: '' }], ['inconsistent', { cpuFraction: 0.1 }],
  ])('%s telemetry becomes unknown without excluding the route', (_, delta) => {
    const f = fixture([6000, 6000, 6000, 6000, 6000]);
    Object.assign(f.input.telemetry[0], delta);
    expect(run(f)).toMatchObject({ stage: 'fallback', selected: { hostId: 'worker-b' } });
    expect(run(f).eligible[0].telemetry.status).toBe('unknown');
    expect(run(f).excluded).toEqual([]);
  });
  test('collector freshness boundary, raw fractions upward and deterministic JSON', () => {
    const f = fixture([null, 5001, 5001, 1000, 1000]);
    delete f.input.telemetry[0].cpuBp;
    f.input.telemetry[0].cpuFraction = 0.50000001;
    expect(run(f).stage).toBe('fallback');
    f.input.telemetry[0].cpuFraction = 0.5;
    f.input.telemetry[0].receivedAt = NOW - 15000;
    f.input.telemetry[0].remoteObservedAt = NOW + 999999;
    expect(run(f)).toMatchObject({ stage: 'balance', selected: { telemetry: { ageMs: 15000, cpuBp: 5000 } } });
    expect(JSON.stringify(run(f))).toBe(JSON.stringify(run(f)));
    expect(recommend(f.bind(), NOW + 1).stage).toBe('fallback');
  });
  test('no measured eligible host uses task order with unknown flags', () => {
    const f = fixture();
    f.config.pool = [];
    f.input.telemetry = [];
    expect(run(f)).toMatchObject({ stage: 'fallback', selected: { hostId: 'worker-a' }, flags: { telemetryUnknown: true } });
  });
});

describe('telemetry interval consistency', () => {
  test('a collector cannot report a successful interval longer than elapsed collection', () => {
    const f = fixture([6000, 6000, 6000, 6000, 6000]);
    Object.assign(f.input.telemetry[0], { windowStartedAt: NOW - 4000, durationMs: 5000 });
    expect(run(f).eligible[0].telemetry).toMatchObject({ status: 'unknown', reason: 'inconsistent-window' });
    expect(selected(f)).toBe('worker-b');
  });
  test('latest RAM participates in pressure while timed-out collections remain unknown', () => {
    const f = fixture();
    Object.assign(f.input.telemetry[0], { ramLatestBp: 9000, timedOut: true });
    expect(run(f).eligible[0].telemetry).toMatchObject({ status: 'unknown', reason: 'timeout' });
    f.input.telemetry[0].timedOut = false;
    expect(run(f).eligible[0].telemetry.loadBp).toBe(9000);
    expect(selected(f)).toBe('worker-b');
  });
});
