import { expect, test } from 'bun:test';
import { recommend } from '../../skills/axstack/scripts/fleet-route.js';
import { inspectFleetReceipt } from '../../skills/axstack/scripts/fleet-receipt.js';
import { NOW } from './fleet-route-fixture.js';
import { configuration } from './dispatch-plan/fixtures.js';
import { article } from './fleet-artifact-fixture.js';

function artifactReceipt(f) {
  const candidate = 'c'.repeat(64);
  const artifactPath = f.scope.artifactRoot + '/article.html';
  const report = f.scope.evidenceRoot + '/report.md';
  const marker = `AXSTACK-DONE key=article:review:a1 head=${candidate} report=${report}`;
  const attempt = { key: 'article:review:a1', title: 'Reviewer: article:review:a1',
    clientRequestId: 'article-review', candidate, base: null,
    origin: { environmentId: f.scope.environmentId, threadId: 'driver', taskId: 'task' } };
  const read = (tool, args, value) => ({ tool, args, value, environmentId: f.scope.environmentId,
    observedAt: NOW, evidence: 'saved://native' });
  const task = { taskId: 'task', childThreadId: 'child', childRunId: 'run', status: 'completed',
    latestTerminalStatus: 'completed', latestTerminalRunId: 'run', latestTerminalSummary: marker,
    workState: 'result_available', hasPendingChildRuns: false, hasPendingQuestion: false, pendingApproval: null,
    providerInstanceId: 'codex', model: 'gpt-6.1-sol', options: [{ id: 'reasoningEffort', value: 'high' }] };
  const recommendation = recommend(f.input, NOW);
  const recommendationJSON = JSON.stringify(recommendation);
  const receipt = { schemaVersion: 1, attempt, recommendationJSON, configDigest: f.input.configDigest,
    requested: { target: { environmentId: f.scope.environmentId, projectId: f.scope.projectId,
      providerInstanceId: 'codex', model: 'gpt-6.1-sol', options: task.options },
    runtimeMode: 'full-access', isolation: 'shared' }, submission: task,
    status: read('task_status', { taskId: 'task' }, task),
    thread: read('t3_thread_read', { threadId: 'child' }, { thread: { threadId: 'child', title: attempt.title,
      projectId: f.scope.projectId, latestRunId: 'run', activeRunId: null, status: 'completed',
      providerInstanceId: 'codex', model: 'gpt-6.1-sol', runtimeMode: 'full-access', pendingRequestCount: 0,
      worktreePath: null }, recentRuns: [{ runId: 'run', ordinal: 1, status: 'completed' }],
    items: [{ runId: 'run', createdBy: 'agent', text: marker }] }),
    terminal: read('t3_thread_wait', { threadId: 'child', runId: 'run' },
      { threadId: 'child', runId: 'run', status: 'completed', timedOut: false }),
    questions: read('t3_pending_request', { action: 'list', threadId: 'child' }, { requests: [] }),
    artifactScope: structuredClone(f.scope),
    artifact: { path: artifactPath, sha256: candidate,
      readback: { path: artifactPath, sha256: candidate, evidence: 'saved://artifact-hash-readback' } },
    evidence: { hostId: 'personal-a', environmentId: f.scope.environmentId, path: report } };
  return { receipt, expected: { attempt, recommendation, recommendationJSON, now: NOW } };
}

test('article review receipt binds SHA-256 bytes and owned paths without a fake Git candidate', () => {
  const f = article();
  f.scope.roleId = 'axstack-explainer-review';
  const { receipt, expected } = artifactReceipt(f);
  const terms = inspectFleetReceipt(receipt, expected);
  expect(terms.filter((t) => t.state !== 'pass')).toEqual([]);
});

test.each([
  ['fake Git base', (r) => { r.attempt.base = 'a'.repeat(40); }],
  ['changed bytes', (r) => { r.artifact.sha256 = 'd'.repeat(64); }],
  ['consistent but unreviewed bytes', (r) => { r.artifact.sha256 = 'd'.repeat(64); r.artifact.readback.sha256 = r.artifact.sha256; }],
  ['missing byte readback', (r) => { delete r.artifact.readback; }],
  ['different readback', (r) => { r.artifact.readback.sha256 = 'd'.repeat(64); }],
  ['unowned artifact', (r) => { r.artifact.path = '/root/.t3/scratch/other/article.html'; }],
  ['unowned report', (r) => { r.evidence.path = '/root/.t3/scratch/other/report.md'; }],
  ['changed ownership', (r) => { r.artifactScope.artifactRoot += '/different'; }],
  ['worktree request', (r) => { r.requested.isolation = 'worktree'; }],
  ['unrelated checkout', (r) => { r.thread.value.thread.worktreePath = '/repo'; }],
])('article review receipt holds on %s after a valid control', (_, change) => {
  const f = article();
  const { receipt, expected } = artifactReceipt(f);
  expect(inspectFleetReceipt(receipt, expected).every((t) => t.state === 'pass')).toBe(true);
  change(receipt);
  expect(inspectFleetReceipt(receipt, expected).some((t) => t.state !== 'pass')).toBe(true);
});

test('dispatch-plan verifies an article native receipt and holds changed bytes', () => {
  const f = article();
  const planResult = f.run();
  expect(planResult.status, planResult.error).toBe(0);
  const plan = JSON.parse(planResult.output);
  const { receipt, expected } = artifactReceipt(f);
  const readback = { ...configuration(), environmentId: f.scope.environmentId, projectId: f.scope.projectId,
    fleetBinding: plan.fleetBinding, artifactScope: f.scope, isolation: 'shared',
    fleetAttempt: expected.attempt, fleetReceipt: receipt };
  expect(f.run(f.scope.roleId, 'task', readback).output).toContain('MATCH');
  receipt.artifact.sha256 = 'd'.repeat(64);
  const held = f.run(f.scope.roleId, 'task', readback);
  expect(held.status).toBe(2);
  expect(held.output).toContain('receipt-artifact-bytes: fail');
});
