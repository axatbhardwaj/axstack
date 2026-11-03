import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { planIntake } from '../../../skills/axstack/scripts/fleet-route-plan.js';
import { intakeFixture, NOW } from '../fleet-route-intake-fixture.js';
import { setup, invoke } from './fixtures.js';

function driver() {
  const s = setup(), f = intakeFixture();
  s.roles.roles.push({ ...s.roles.roles[0], id: 'axstack-driver' });
  const input = f.bind();
  const catalog = input.nativeDestinations['env-worker-a'].capabilities.valueText;
  const capabilities = `${s.dir}/catalog.json`;
  // Preserve the exact native catalog bytes used in the placement plan.
  s.save('catalog', JSON.parse(catalog));
  const saved = planIntake(input, NOW);
  const args = () => ['--role', 'axstack-driver', '--roles', s.save('roles', s.roles),
    '--capabilities', capabilities, '--kind', 'launch', '--fleet-input', s.save('input', input),
    '--recommendation', s.save('recommendation', saved), '--now', String(NOW), '--config-digest', input.configDigest];
  const readback = () => ({ environmentId: 'env-worker-a', projectId: 'project-worker-a',
    fleetBinding: { configDigest: input.configDigest, destinationSnapshotId: 'snapshot-worker-a',
      destinationCapabilitiesDigest: input.destinations[0].capabilitiesDigest },
    thread: { threadId: 'destination-driver', projectId: 'project-worker-a', title: saved.launch.title,
      providerInstanceId: 'codex', model: 'gpt-6.1-sol', runtimeMode: 'full-access',
      options: [{ id: 'reasoningEffort', value: 'high' }], latestRunId: 'acceptance-run' },
    recentRuns: [{ runId: 'acceptance-run', startedAt: '2026-11-03T00:00:00Z', status: 'running' }] });
  return { ...s, input, saved, args, readback };
}

test('driver launch emits destination, provenance, unique key and acceptance-only brief', () => {
  const f = driver();
  const out = `${f.dir}/launch.json`;
  const r = invoke([...f.args(), '--out', out]);
  expect(r.status, r.error).toBe(0);
  const p = JSON.parse(readFileSync(out));
  expect(p).toMatchObject({ environmentId: 'env-worker-a', projectId: 'project-worker-a',
    modelSelection: { instanceId: 'codex', model: 'gpt-6.1-sol', options: [{ id: 'reasoningEffort', value: 'high' }] },
    runtimeMode: 'full-access', clientRequestId: 'run:driver:task:a1',
    delegatedFrom: { environmentId: 'env-personal-a', threadId: 'origin-thread', title: 'Implement task' } });
  expect(p.title).toContain(p.clientRequestId);
  expect(JSON.parse(p.message)).toMatchObject({ routed: true, taskText: f.input.intake.taskText,
    scope: f.input.intake.scope, authority: f.input.intake.authority, grantCitation: f.input.intake.grantCitation });
  expect(JSON.parse(p.message).acceptanceOnly).toContain('AXSTACK-ACCEPT');
  expect(JSON.parse(p.message).acceptanceOnly).toContain('AXSTACK-HANDBACK <reason>');
});

test('launch verification consumes T1 native thread shape and proves the run started', () => {
  const f = driver();
  const r = invoke([...f.args(), '--verify', f.save('readback', f.readback())]);
  expect(r.status, r.error).toBe(0);
  expect(r.output).toContain('MATCH');
});

test.each([
  ['missing run', (r) => { delete r.recentRuns; }, 'run-started: unknown'],
  ['queued run', (r) => { r.recentRuns[0].startedAt = null; }, 'run-started: fail'],
  ['wrong run', (r) => { r.thread.latestRunId = 'other'; }, 'run-started: fail'],
  ['missing latestRunId', (r) => { delete r.thread.latestRunId; }, 'run-started: unknown'],
  ['missing startedAt', (r) => { delete r.recentRuns[0].startedAt; }, 'run-started: unknown'],
  ['wrong title', (r) => { r.thread.title = 'another task'; }, 'launch-title: fail'],
  ['wrong project', (r) => { r.thread.projectId = 'other'; }, 'launch-project: fail'],
  ['missing options', (r) => { delete r.thread.options; }, 'options: unknown'],
  ['wrong mode', (r) => { r.thread.runtimeMode = 'auto'; }, 'runtimeMode: fail'],
])('native %s holds the launch rather than inferring success', (_, change, evidence) => {
  const f = driver(), r = f.readback(); change(r);
  const result = invoke([...f.args(), '--verify', f.save('readback', r)]);
  expect(result.status, result.error).toBe(2);
  expect(result.output).toContain(evidence);
  expect(result.output).not.toContain('MATCH');
});

test('driver plans cannot bind a delegated task or tampered plan', () => {
  const f = driver();
  const args = f.args(); args[args.indexOf('launch')] = 'task';
  expect(invoke(args).status).toBe(2);
  f.saved.launch.clientRequestId = 'different';
  expect(invoke(f.args()).status).toBe(2);
});

test('launch binding rejects an actually changed catalog after a valid plan', () => {
  const f = driver();
  expect(invoke([...f.args(), '--out', `${f.dir}/valid-launch.json`]).status).toBe(0);
  const changed = JSON.parse(readFileSync(`${f.dir}/catalog.json`, 'utf8'));
  changed.fixtureObservation = 'different saved catalog bytes';
  f.save('catalog', changed);
  const r = invoke(f.args());
  expect(r.status).toBe(2);
  expect(r.error).toBe('dispatch-plan hold: capabilities-digest-mismatch\n');
  expect(r.output).toBe('');
});

test('a resolvable role model must still match the planned driver model', () => {
  const f = driver();
  for (const d of f.input.destinations) {
    const o = f.input.nativeDestinations[d.environmentId];
    const catalog = JSON.parse(o.capabilities.valueText);
    catalog.providers[0].models.push({ ...catalog.providers[0].models[0], id: 'gpt-6-sol' });
    o.capabilities.valueText = JSON.stringify(catalog);
    d.capabilitiesDigest = new Bun.CryptoHasher('sha256').update(o.capabilities.valueText).digest('hex');
  }
  f.save('catalog', JSON.parse(f.input.nativeDestinations['env-worker-a'].capabilities.valueText));
  Object.assign(f.saved, planIntake(f.input, NOW));
  expect(invoke([...f.args(), '--out', `${f.dir}/valid-launch.json`]).status).toBe(0);
  f.roles.roles.find((r) => r.id === 'axstack-driver').model = 'gpt-6-sol';
  const r = invoke(f.args());
  expect(r.status).toBe(2);
  expect(r.error).toBe('dispatch-plan hold: settings-mismatch\n');
  expect(r.output).toBe('');
});
