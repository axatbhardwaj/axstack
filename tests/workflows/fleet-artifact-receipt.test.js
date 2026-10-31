import { expect, test } from 'bun:test';
import { recommend } from '../../skills/axstack/scripts/fleet-route.js';
import { inspectFleetReceipt } from '../../skills/axstack/scripts/fleet-receipt.js';
import { NOW } from './fleet-route-fixture.js';
import { configuration } from './dispatch-plan/fixtures.js';
import { article } from './fleet-artifact-fixture.js';
import { configuredBrainstorm, seats } from './fleet-brainstorm-fixture.js';

function artifactReceipt(f) {
  const { providerInstanceId, model, options } = f.input.request;
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
    providerInstanceId, model, options: Object.entries(options).map(([id, value]) => ({ id, value })) };
  const recommendation = recommend(f.input, NOW);
  const recommendationJSON = JSON.stringify(recommendation);
  const receipt = { schemaVersion: 1, attempt, recommendationJSON, configDigest: f.input.configDigest,
    requested: { target: { environmentId: f.scope.environmentId, projectId: f.scope.projectId,
      providerInstanceId, model, options: task.options },
    runtimeMode: 'full-access', isolation: 'shared' }, submission: task,
    status: read('task_status', { taskId: 'task' }, task),
    thread: read('t3_thread_read', { threadId: 'child' }, { thread: { threadId: 'child', title: attempt.title,
      projectId: f.scope.projectId, latestRunId: 'run', activeRunId: null, status: 'completed',
      providerInstanceId, model, runtimeMode: 'full-access', pendingRequestCount: 0,
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


test('article report ownership holds even when both terminal markers match its path', () => {
  const { receipt, expected } = artifactReceipt(article());
  expect(inspectFleetReceipt(receipt, expected).every((t) => t.state === 'pass')).toBe(true);
  const old = receipt.evidence.path;
  receipt.evidence.path = '/other/report.md';
  receipt.status.value.latestTerminalSummary = receipt.status.value.latestTerminalSummary.replace(old, receipt.evidence.path);
  receipt.thread.value.items[0].text = receipt.thread.value.items[0].text.replace(old, receipt.evidence.path);
  const terms = inspectFleetReceipt(receipt, expected);
  expect(terms.filter((t) => t.state !== 'pass').map((t) => t.code)).toEqual(['receipt-artifact-scope']);
});

test('article receipt rejects checkout metadata independently of shared worktreePath', () => {
  const { receipt, expected } = artifactReceipt(article());
  expect(inspectFleetReceipt(receipt, expected).every((t) => t.state === 'pass')).toBe(true);
  receipt.checkout = { path: '/repo' };
  expect(inspectFleetReceipt(receipt, expected).filter((t) => t.state !== 'pass').map((t) => t.code))
    .toEqual(['receipt-isolation']);
});

function inheritedArtifactReceipt() {
  const pair = artifactReceipt(article());
  const { receipt: r, expected: e } = pair;
  e.recommendation.selected.versions = { t3: '0.1.5' };
  const parent = { threadId: e.attempt.origin.threadId, projectId: r.thread.value.thread.projectId,
    worktreePath: r.artifactScope.workspaceRoot + '/parent-scratch' };
  r.parent = { tool: 't3_thread_read', environmentId: e.attempt.origin.environmentId,
    args: { threadId: parent.threadId }, observedAt: NOW, evidence: 'saved://parent', value: { thread: parent } };
  Object.assign(r.thread.value.thread, { parentThreadId: parent.threadId,
    relationshipToParent: 'subagent', worktreePath: parent.worktreePath });
  r.status.value.summary = r.status.value.latestTerminalSummary;
  r.status.value.latestTerminalSummary = null;
  return pair;
}

test('native local shared artifact inherits parent scratch and deduplicated terminal summary', () => {
  const { receipt, expected } = inheritedArtifactReceipt();
  expect(inspectFleetReceipt(receipt, expected).filter((t) => t.state !== 'pass')).toEqual([]);
});

test.each([
  ['missing parent', (r) => { delete r.parent; }],
  ['wrong parent tool', (r) => { r.parent.tool = 't3_project_read'; }],
  ['wrong parent arguments', (r) => { r.parent.args.threadId = 'other'; }],
  ['wrong parent environment', (r) => { r.parent.environmentId = 'other'; }],
  ['wrong parent identity', (r) => { r.parent.value.thread.threadId = 'other'; }],
  ['wrong parent project', (r) => { r.parent.value.thread.projectId = 'other'; }],
  ['wrong child parent', (r) => { r.thread.value.thread.parentThreadId = 'other'; }],
  ['wrong child relationship', (r) => { r.thread.value.thread.relationshipToParent = 'fork'; }],
  ['wrong shared path', (r) => { r.thread.value.thread.worktreePath += '/other'; }],
  ['path outside workspace', (r) => { r.thread.value.thread.worktreePath = r.parent.value.thread.worktreePath = '/other'; }],
  ['future parent read', (r) => { r.parent.observedAt = NOW + 1; }],
  ['missing parent evidence', (r) => { delete r.parent.evidence; }],
  ['stale summary run', (r) => { r.status.value.childRunId = 'older'; }],
  ['stale terminal run', (r) => { r.status.value.latestTerminalRunId = 'older'; }],
  ['conflicting terminal summary', (r) => { r.status.value.latestTerminalSummary = 'conflict'; }],
  ['different summary bytes', (r) => { r.status.value.summary = 'different\n' + r.status.value.summary; }],
  ['missing summary', (r) => { delete r.status.value.summary; }],
  ['unverified T3 version', (_r, e) => { e.recommendation.selected.versions.t3 = '0.1.6'; }],
])('native artifact receipt holds on %s', (name, change) => {
  const { receipt, expected } = inheritedArtifactReceipt();
  expect(inspectFleetReceipt(receipt, expected).every((t) => t.state === 'pass')).toBe(true);
  change(receipt, expected);
  const failed = inspectFleetReceipt(receipt, expected).filter((t) => t.state !== 'pass').map((t) => t.code);
  const summary = ['receipt-marker', 'receipt-host-path'];
  const codes = name === 'unverified T3 version' ? [...summary, 'receipt-isolation']
    : name === 'stale terminal run' ? ['receipt-run', ...summary]
    : ['stale summary run', 'conflicting terminal summary', 'different summary bytes', 'missing summary'].includes(name)
      ? summary : ['receipt-isolation'];
  expect(failed).toEqual(codes);
});

const failedCodes = (r, e) => inspectFleetReceipt(r, e).filter((t) => t.state !== 'pass').map((t) => t.code);

test('engineering receipts cannot borrow the artifact summary fallback', () => {
  const { receipt: r, expected: e } = inheritedArtifactReceipt();
  delete e.recommendation.request.scope;
  e.recommendation.request.repositoryId = 'github.com/example/repo';
  r.thread.value.thread.worktreePath = null;
  r.attempt.title = r.thread.value.thread.title = 'Worker: engineering';
  const old = r.attempt.candidate;
  r.attempt.candidate = 'c'.repeat(40);
  r.status.value.summary = r.status.value.summary.replace(old, r.attempt.candidate);
  r.thread.value.items[0].text = r.status.value.summary;
  r.status.value.latestTerminalSummary = r.status.value.summary;
  expect(failedCodes(r, e)).toEqual([]);
  r.status.value.latestTerminalSummary = null;
  expect(failedCodes(r, e)).toEqual(['receipt-marker', 'receipt-host-path']);
});

test.each(['version', 'remote'])('artifact summary independently rejects %s', (boundary) => {
  const { receipt: r, expected: e } = inheritedArtifactReceipt();
  r.thread.value.thread.worktreePath = null;
  expect(failedCodes(r, e)).toEqual([]);
  if (boundary === 'version') e.recommendation.selected.versions.t3 = '0.1.6';
  else e.recommendation.originEnvironmentId = 'other-origin';
  // Remote receipt identity also holds; check this guard's own terms independently.
  expect(inspectFleetReceipt(r, e).filter((t) => ['receipt-marker', 'receipt-host-path'].includes(t.code))
    .map((t) => t.state)).toEqual(['fail', 'fail']);
});

test.each(['version', 'remote', 'forged parent pair'])('inherited artifact path independently rejects %s', (boundary) => {
  const { receipt: r, expected: e } = inheritedArtifactReceipt();
  r.status.value.latestTerminalSummary = r.status.value.summary;
  expect(failedCodes(r, e)).toEqual([]);
  if (boundary === 'version') e.recommendation.selected.versions.t3 = '0.1.6';
  else if (boundary === 'remote') e.recommendation.originEnvironmentId = 'other-origin';
  else r.parent.value.thread.threadId = r.thread.value.thread.parentThreadId = 'other';
  expect(inspectFleetReceipt(r, e).find((t) => t.code === 'receipt-isolation').state).toBe('fail');
});

// Candidate and applicable judge outputs are report bytes, never Git candidates.
test.each(seats)(
  'No-project brainstorm selector/plan/receipt round trip: %s', (...seat) => {
    const f = configuredBrainstorm(seat);
    const role = seat[0];
    const result = f.run();
    expect(result.status, result.error).toBe(0);
    const plan = JSON.parse(result.output);
    const { receipt, expected } = artifactReceipt(f);
    const readback = { modelSelection: { instanceId: seat[1], model: seat[2], options: plan.target.options },
      runtimeMode: 'full-access', environmentId: f.scope.environmentId, projectId: f.scope.projectId,
      fleetBinding: plan.fleetBinding, artifactScope: f.scope, isolation: 'shared',
      fleetAttempt: expected.attempt, fleetReceipt: receipt };
    expect(f.run(role, 'task', readback).output).toContain('MATCH');
    receipt.artifact.sha256 = 'd'.repeat(64);
    const held = f.run(role, 'task', readback);
    expect(held.status).toBe(2);
    expect(held.output).toContain('receipt-artifact-bytes: fail');
  });
