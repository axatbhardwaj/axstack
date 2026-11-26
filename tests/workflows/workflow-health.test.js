import { expect, test } from 'bun:test';
import { join } from '../../src/posixpath.js';

const cli = join(import.meta.dir, '../../bin/axstack.js');
const now = '2026-01-01T12:00:00Z';
const duration = 30 * 60 * 1000;
const tick = 'fixture-tick';
const task = 'fixture-task';
const at = (hours, minutes = 0, seconds = 0) => new Date(Date.parse(now) - ((hours * 60 + minutes) * 60 + seconds) * 1000).toISOString();
const record = { digest: 'a'.repeat(64), bindingDigest: 'b'.repeat(64), binding: '/private/fixture.json' };
const run = (workflow, runId, status, startedAt, extra = {}) => ({
  workflow, version: 1, runId, status, startedAt, updatedAt: startedAt, retired: false,
  endedAt: ['completed', 'stopped', 'skipped', 'cancelled'].includes(status) ? startedAt : null,
  ...extra,
});
const host = (extra = {}) => ({
  host: 'fixture-node',
  reachable: true,
  evidence: 'capture-fixture',
  catalog: { [tick]: 1, [task]: 1 },
  manifest: { version: 1, workflows: { [`${tick}@1`]: record, [`${task}@1`]: record } },
  t3: { serverVersion: '0.1.12', cliVersion: '0.1.12', environment: 'fixture-env' },
  conformance: { version: '0.1.12', environment: 'fixture-env', suite: 1, status: 'pass' },
  registry: { workflows: [{ name: tick, version: 1 }, { name: task, version: 1 }], definition: { problem: null } },
  runs: [],
  policies: {
    [`${tick}@1`]: { kind: 'scheduled', intervalMs: duration, firstDueAt: at(3), slots: [], slotsComplete: true },
    [`${task}@1`]: { kind: 'on-demand', progressTimeoutMs: duration },
  },
  ...extra,
});

function invoke(args, stdin) {
  return Bun.spawnSync([process.execPath, cli, 'workflow', 'health', ...args], { stdin, stderr: 'pipe' });
}

function evaluate(...hosts) {
  const child = invoke(['--input', '-'], Buffer.from(JSON.stringify({ at: now, hosts })));
  return { code: child.exitCode, report: JSON.parse(child.stdout.toString()) };
}

const byWorkflow = (report, name, version = 1) => report.hosts[0].workflows.find((row) => row.name === name && row.version === version)?.checks;
const term = (status, evidence = expect.anything()) => ({ status, evidence });

test('health exposes the saved-input interface and rejects malformed envelopes', () => {
  expect(invoke(['--help']).stdout.toString()).toMatch(/health --input <[^>]+>/);
  expect(invoke(['--input', '-'], Buffer.from('not JSON')).exitCode).toBe(1);
});

test('registers only exact opted-in versions and preserves loader problems alongside the last good version', () => {
  const { code, report } = evaluate(host({
    catalog: { [tick]: 2, [task]: 2, dormant: 1 },
    registry: { workflows: [{ name: tick, version: 1 }, { name: task, version: 2 }],
      definition: { problem: 'fixture module did not load' } },
  }));
  expect(code).toBe(0);
  expect(report.hosts[0].checks.loader).toEqual(term('fail', 'fixture module did not load'));
  expect(byWorkflow(report, tick).definitionLoaded).toEqual(term('pass'));
  expect(byWorkflow(report, task).definitionLoaded).toEqual(term('fail'));
  expect(byWorkflow(report, 'dormant')).toBeUndefined();
});

test('list history is insufficient to infer registration, but an active retired run proves a definition is absent', () => {
  const { code, report } = evaluate(host({ registry: null, runs: [
    run(tick, 'done', 'completed', at(3)), run(task, 'retired', 'paused', at(0, 10), { retired: true }),
  ] }));
  expect(code).toBe(2);
  expect(byWorkflow(report, tick).definitionLoaded).toEqual(term('unknown'));
  expect(byWorkflow(report, task).definitionLoaded).toEqual(term('fail'));
});

test('counts a verified due slot at the two-interval boundary, including quiet skipped runs', () => {
  const input = host();
  input.policies[`${tick}@1`].slots = [{ runId: 'slot', scheduledAt: at(1), status: 'skipped' }];
  const { code, report } = evaluate(input);
  expect(code).toBe(0);
  expect(byWorkflow(report, tick).dueSlot).toMatchObject({ status: 'pass', evidence: { runId: 'slot' } });
  expect(byWorkflow(report, task).dueSlot).toEqual(term('n/a'));
  expect(byWorkflow(report, task).invokedProgress).toEqual(term('n/a'));
});

test('detects missed slots without crediting manual runs, delayed replay, or future slots', () => {
  const input = host({ runs: [run(tick, 'manual', 'completed', at(0, 10), { result: { scheduledAt: at(0, 30) } })] });
  input.policies[`${tick}@1`].slots = [{ runId: 'late', scheduledAt: at(1, 0, 1), status: 'completed' }];
  expect(byWorkflow(evaluate(input).report, tick).dueSlot).toEqual(term('fail'));
  input.policies[`${tick}@1`].slots[0].scheduledAt = '2026-01-01T12:10:00Z';
  expect(byWorkflow(evaluate(input).report, tick).dueSlot).toEqual(term('unknown'));
  input.policies[`${tick}@1`].slots = [];
  input.policies[`${tick}@1`].firstDueAt = '2026-01-01T12:10:00Z';
  expect(byWorkflow(evaluate(input).report, tick).dueSlot).toEqual(term('n/a'));
  input.policies[`${tick}@1`].firstDueAt = at(0, 30);
  expect(byWorkflow(evaluate(input).report, tick).dueSlot).toEqual(term('n/a'));
  input.policies[`${tick}@1`].firstDueAt = at(3);
  input.policies[`${tick}@1`].slotsComplete = false;
  expect(byWorkflow(evaluate(input).report, tick).dueSlot).toEqual(term('unknown'));
});

test('reports paused runs and applies the strict four-interval age to active scheduled runs', () => {
  const input = host({ runs: [
    run(tick, 'paused-old', 'paused', at(2, 0, 1)),
    run(tick, 'boundary', 'waiting', at(2)),
    run(tick, 'historical', 'completed', at(3)),
  ] });
  const { report } = evaluate(input);
  expect(byWorkflow(report, tick).pausedRuns).toMatchObject({
    status: 'fail', evidence: [{ runId: 'paused-old' }],
  });
  expect(byWorkflow(report, tick).staleRuns).toMatchObject({
    status: 'fail', evidence: [{ runId: 'paused-old' }],
  });
});

test('uses native show steps for on-demand progress and tied agent evidence for a wedge', () => {
  const running = run(task, 'invoked', 'running', at(1));
  const input = host({
    runs: [running],
    shows: { invoked: { run: running, steps: [
      { name: 'agent', kind: 'agent', status: 'running', startedAt: at(0, 5), endedAt: null, threadId: 'fixture-agent', environmentId: null },
    ] } },
  });
  expect(byWorkflow(evaluate(input).report, task).invokedProgress).toEqual(term('pass'));
  expect(byWorkflow(evaluate(input).report, task).staleRuns).toEqual(term('unknown'));
  input.agents = [{ runId: 'invoked', threadId: 'fixture-agent', environmentId: null,
    startedAt: at(0, 5), status: 'wedged', evidence: 'native thread receipt' }];
  const checks = byWorkflow(evaluate(input).report, task);
  expect(checks.staleRuns).toMatchObject({ status: 'fail', evidence: [{ runId: 'invoked', threadId: 'fixture-agent' }] });
  expect(checks.invokedProgress).toEqual(term('fail'));
  input.agents[0].startedAt = at(0, 10);
  expect(byWorkflow(evaluate(input).report, task).staleRuns).toEqual(term('unknown'));
  delete input.shows;
  expect(byWorkflow(evaluate(input).report, task).invokedProgress).toEqual(term('unknown'));
  input.shows = { invoked: { run: running, steps: [] } };
  expect(byWorkflow(evaluate(input).report, task).invokedProgress).toEqual(term('fail'));
  const waiting = run(task, 'waiting', 'waiting', at(3));
  input.runs = [waiting];
  input.shows.waiting = { run: waiting, steps: [
    { name: 'decision', kind: 'ask', status: 'running', startedAt: at(2), endedAt: null },
  ] };
  expect(byWorkflow(evaluate(input).report, task).invokedProgress).toEqual(term('pass'));
});

test('isolates unreachable, malformed list, and malformed ownership observations', () => {
  const offline = host({ reachable: false, runs: [], host: 'fixture-offline' });
  const malformed = host({ runs: 'invalid JSON', host: 'fixture-invalid' });
  const invalidManifest = host({ manifest: { version: 7 }, host: 'fixture-manifest' });
  const { code, report } = evaluate(offline, malformed, invalidManifest, host());
  expect(code).toBe(2);
  expect(report.hosts[0].checks.inventory).toEqual(term('unknown'));
  expect(byWorkflow(report, task).definitionLoaded).toEqual(term('unknown'));
  expect(report.hosts[1].workflows[0].checks.pausedRuns).toEqual(term('unknown'));
  expect(report.hosts[2].checks.ownership).toEqual(term('unknown'));
  expect(report.hosts[3].checks.inventory).toEqual(term('pass'));
});

test('holds new activations on version, CLI, environment, suite or receipt mismatch and preserves missing evidence', () => {
  const baseline = host();
  const incomplete = evaluate(host({ conformance: null }));
  expect(incomplete.code).toBe(2);
  expect(incomplete.report.hosts[0].checks.conformance).toEqual(term('unknown'));
  expect(incomplete.report.hosts[0].holds).toEqual(['new-activations']);
  const healthy = evaluate(baseline);
  expect(healthy.report.hosts[0].checks.conformance).toEqual(term('pass'));
  expect(healthy.report.hosts[0].holds).toEqual([]);
  for (const change of [{ version: '0.1.11' }, { status: 'fail' }, { environment: 'other' }, { suite: 2 }]) {
    const { code, report } = evaluate(host({ conformance: { ...baseline.conformance, ...change } }));
    expect(code).toBe(2);
    expect(report.hosts[0].checks.conformance).toEqual(term('fail'));
    expect(report.hosts[0].holds).toEqual(['new-activations']);
  }
  const mismatch = evaluate(host({ t3: { ...baseline.t3, cliVersion: '0.2.0' } }));
  expect(mismatch.report.hosts[0].checks.conformance).toEqual(term('fail'));
});

test('uses status-filtered native lists and keeps a capped inventory incomplete', () => {
  const paused = run(task, 'observed-pause', 'paused', at(0, 5));
  const activeRuns = { running: [], waiting: [], paused: [paused] };
  const current = host({ runs: null, activeRuns });
  const complete = evaluate(current);
  expect(complete.report.hosts[0].checks.inventory).toEqual(term('pass'));
  expect(byWorkflow(complete.report, task).pausedRuns).toMatchObject({ status: 'fail', evidence: [{ runId: paused.runId }] });
  activeRuns.running = Array.from({ length: 500 }, (_, index) => run(tick, `active-${index}`, 'running', at(0, 1)));
  const capped = evaluate(current);
  expect(capped.code).toBe(2);
  expect(capped.report.hosts[0].checks.inventory).toEqual(term('unknown'));
  expect(byWorkflow(capped.report, task).pausedRuns).toMatchObject({ status: 'fail', evidence: [{ runId: paused.runId }] });
  expect(byWorkflow(capped.report, tick).staleRuns).toEqual(term('unknown'));
  const history = Array.from({ length: 500 }, (_, index) => run(task, `terminal-${index}`, 'completed', at(0, 2)));
  expect(evaluate(host({ runs: history })).report.hosts[0].checks.inventory).toEqual(term('unknown'));
});
