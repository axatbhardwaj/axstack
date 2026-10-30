import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { inspectDestination } from '../../../skills/axstack/scripts/fleet-destination.js';
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
  const readback = () => ({ ...configuration(), environmentId: 'env-worker-a', projectId: 'project-worker-a',
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

function planned(f, overrides = {}, destination = { environmentId: 'env-worker-a', projectId: 'project-worker-a' }) {
  const result = f.run(undefined, [], 'task', overrides);
  expect(result.status, result.error).toBe(0);
  expect(result.error).toBe('');
  expect(JSON.parse(result.output).target).toMatchObject({ providerInstanceId: 'codex',
    model: 'gpt-6.1-sol', ...destination });
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
    expect(kind === 'task' ? plan.target : plan).toMatchObject({ environmentId: 'env-worker-a', projectId: 'project-worker-a' });
    expect(plan.runtimeMode).toBe('full-access');
  }
  expect(f.run(f.readback()).output).toContain('MATCH');
});

test('fleet readback detects destination, snapshot, settings and config mismatches', () => {
  const f = fleet();
  for (const [field, change] of [
    ['environmentId', (v) => { v.environmentId = 'worker-a'; }],
    ['environmentId', (v) => { v.environmentId = 'env-personal-a'; }],
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
  expect(f.saved.selected?.environmentId).toBe('env-worker-a');
  held(f.run(), 'settings-mismatch');
});

test.each(['reader', 'author'])('a valid %s request cannot acquire the opposite role binding', (role) => {
  const f = fleet();
  f.setRequest({ role });
  const configured = role === 'author' ? 'axstack-author' : 'axstack-reader';
  planned(f, { role: configured }, role === 'author' ? { environmentId: 'env-personal-a', projectId: 'project-personal-a' }
    : { environmentId: 'env-worker-a', projectId: 'project-worker-a' });
  held(f.run(undefined, [], 'task', { role: role === 'author' ? 'axstack-reader' : 'axstack-author' }), 'settings-mismatch');
});

test('fully proven coordinator selection stays held after a valid local author plan', () => {
  const f = fleet();
  f.setRequest({ role: 'author' });
  planned(f, { role: 'axstack-author' }, { environmentId: 'env-personal-a', projectId: 'project-personal-a' });
  const route = f.config.routes[0];
  route.kind = 'remote-author-coordinator';
  route.authorProof = { originEnvironmentId: 'env-personal-a', environmentId: 'env-worker-a',
    originVersions: structuredClone(f.input.origin.versions),
    destinationVersions: structuredClone(f.input.destinations[0].versions),
    evidence: structuredClone(route.evidence), gatesPassed: true };
  f.bindConfig();
  expect(f.saved.selected).toMatchObject({ environmentId: 'env-worker-a', routeKind: 'remote-author-coordinator' });
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
  expect(f.saved.selected?.environmentId).toBe('env-worker-a');
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
  expect(f.saved.selected?.environmentId).toBe('env-worker-a');
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

// Native saved envelopes; host, environment and project deliberately differ.
function receipt(f) {
  const marker = `AXSTACK-DONE key=run:reader:inspect:a1 head=${'a'.repeat(40)} report=/evidence/result.md`;
  const task = { taskId: 'origin-task', childThreadId: null, childRunId: 'initial-run',
    remoteChild: { environmentId: 'env-worker-a', threadId: 'same-thread' },
    providerInstanceId: 'codex', model: 'gpt-6.1-sol',
    options: [{ id: 'reasoningEffort', value: 'high' }, { id: 'serviceTier', value: 'priority' }],
    status: 'completed', workState: 'result_available', hasPendingChildRuns: false,
    hasPendingQuestion: false, pendingApproval: null, latestTerminalRunId: 'continued-run',
    latestTerminalStatus: 'completed', latestTerminalSummary: marker, summary: 'older summary' };
  const attempt = { key: 'run:reader:inspect:a1', title: 'Subagent: run:reader:inspect:a1', clientRequestId: 'exact-request',
    origin: { environmentId: 'env-personal-a', threadId: 'driver', taskId: 'origin-task' },
    candidate: 'a'.repeat(40), base: 'b'.repeat(40) };
  const read = (tool, environmentId, args, value) => ({ tool, environmentId, args, value,
    observedAt: NOW, evidence: 'saved://native-read' });
  const result = { schemaVersion: 1, attempt, remoteChild: { environmentId: 'env-worker-a', threadId: 'same-thread', runId: 'continued-run' }, recommendationJSON: JSON.stringify(f.saved), configDigest: f.input.configDigest,
    requested: { target: { environmentId: 'env-worker-a', projectId: 'project-worker-a',
      providerInstanceId: 'codex', model: 'gpt-6.1-sol', options: task.options }, runtimeMode: 'full-access' },
    submission: structuredClone(task),
    status: read('task_status', 'env-personal-a', { taskId: 'origin-task' }, task),
    thread: read('t3_thread_read', 'env-worker-a', { threadId: 'same-thread' }, {
      thread: { title: 'Subagent: run:reader:inspect:a1', threadId: 'same-thread', projectId: 'project-worker-a', latestRunId: 'continued-run',
        activeRunId: null, status: 'completed', providerInstanceId: 'codex', model: 'gpt-6.1-sol',
        runtimeMode: 'full-access', pendingRequestCount: 0, worktreePath: null },
      recentRuns: [{ runId: 'initial-run', ordinal: 1, status: 'completed' },
        { runId: 'continued-run', ordinal: 2, status: 'completed' }],
      items: [{ runId: 'continued-run', createdBy: 'agent', text: marker }] }),
    questions: read('t3_pending_request', 'env-worker-a', { action: 'list', threadId: 'same-thread' }, { requests: [] }),
    terminal: read('t3_thread_wait', 'env-worker-a', { threadId: 'same-thread', runId: 'continued-run' },
      { threadId: 'same-thread', runId: 'continued-run', status: 'completed', timedOut: false }),
    evidence: { hostId: 'worker-a', environmentId: 'env-worker-a', path: '/evidence/result.md' } };
  return { ...f.readback(), fleetAttempt: attempt, fleetReceipt: result };
}

test('native receipt validates remote null-child completion and newer provider continuation', () => {
  const f = fleet();
  const value = receipt(f);
  const before = JSON.stringify(value);
  expect(f.run(value).output).toContain('MATCH');
  expect(JSON.stringify(value)).toBe(before);
});

test.each([
  ['receipt-observation', (r) => { r.status.tool = 'worker-self-report'; }],
  ['receipt-version', (r) => { r.schemaVersion = 2; }],
  ...Object.entries({ environmentId: 'env-worker-b', projectId: 'project-worker-b', providerInstanceId: 'other-provider', model: 'other-model', options: { reasoningEffort: 'low' } })
    .map(([key, value]) => ['receipt-requested', (r) => { r.requested.target[key] = value; }]),
  ...['status', 'thread'].flatMap((where) => ['providerInstanceId', 'model'].map((key) =>
    ['receipt-effective', (r) => { (where === 'status' ? r.status.value : r.thread.value.thread)[key] = 'other'; }])),
  ['receipt-origin', (r) => { r.status.value.taskId = 'other-task'; }],
  ['receipt-origin', (r) => { r.submission.taskId = 'other-task'; }],
  ['receipt-destination', (r) => { r.submission.remoteChild.environmentId = 'env-worker-b'; }],
  ['receipt-destination', (r) => { r.submission.remoteChild.threadId = 'other-thread'; }],
  ['receipt-run', (r) => { r.remoteChild.environmentId = 'env-worker-b'; }],
  ['receipt-run', (r) => { r.remoteChild.threadId = 'other-thread'; }],
  ['receipt-terminal', (r) => { r.status.value.latestTerminalStatus = 'failed'; }],
  ['receipt-terminal', (r) => { r.thread.value.thread.status = 'running'; }],
  ['receipt-terminal', (r) => { r.thread.value.thread.activeRunId = 'new-run'; }],
  ['receipt-terminal', (r) => { r.terminal.value.timedOut = true; }],
  ['receipt-question', (r) => { r.status.value.hasPendingQuestion = true; }],
  ['receipt-question', (r) => { r.status.value.pendingApproval = { requestId: 'approval' }; }],
  ['receipt-question', (r) => { r.questions.tool = 'other-tool'; }],
  ['receipt-question', (r) => { r.questions.environmentId = 'env-worker-b'; }],
  ['receipt-question', (r) => { r.questions.args.threadId = 'other-thread'; }],
  ['receipt-question', (r) => { r.questions.observedAt = -1; }],
  ['receipt-question', (r) => { r.questions.observedAt = NOW + 1; }],
  ['receipt-question', (r) => { r.questions.evidence = ''; }],
  ['receipt-question', (r) => { r.questions.value.requests = { length: 0 }; }],
  ['receipt-destination', (r) => { r.thread.value.thread.threadId = 'other-thread'; }],
  ['receipt-run', (r) => { r.terminal.value.threadId = 'other-thread'; }],
  ['receipt-run', (r) => { r.thread.value.recentRuns.push({ runId: 'newer-run', ordinal: 3, status: 'completed' }); }],
  ['receipt-run', (r) => { r.thread.value.recentRuns[1].status = 'failed'; }],
  ['receipt-run', (r) => { r.terminal.value.resultRun = { runId: 'initial-run', status: 'completed' }; }],
  ['receipt-run', (r) => { r.terminal.value.resultRun = { runId: 'continued-run', status: 'failed' }; }],
  ['receipt-marker', (r) => { r.thread.value.items[0].createdBy = 'user'; }],
  ['receipt-effective', (r) => { r.thread.value.thread.runtimeMode = 'auto'; }],
  ...['status', 'thread', 'terminal'].flatMap((name) => [
    ['receipt-observation', (r) => { r[name].environmentId = 'env-worker-c'; }],
    ['receipt-observation', (r) => { r[name].args = { unrelated: 'other-attempt' }; }],
    ['receipt-observation', (r) => { r[name].observedAt = NOW + 1; }],
  ]),
  ['receipt-title', (r) => { r.thread.value.thread.title = 'another attempt'; }],
  ['receipt-run', (r) => { r.remoteChild.runId = 'initial-run'; }],
  ['receipt-question', (r) => { r.questions.value.requests.push({ requestId: 'unanswered' }); }],
  ['receipt-origin', (r) => { r.attempt.origin.environmentId = 'env-worker-c'; }],
  ['receipt-attempt', (r) => { r.attempt.clientRequestId = 'another-request'; }],
  ['receipt-recommendation', (r) => { r.recommendationJSON += ' '; }],
  ['receipt-config', (r) => { r.configDigest = '0'.repeat(64); }],
  ['receipt-destination', (r) => { r.status.value.remoteChild.environmentId = 'env-worker-b'; }],
  ['receipt-destination', (r) => { r.thread.environmentId = 'env-worker-b'; }],
  ['receipt-project', (r) => { r.thread.value.thread.projectId = 'project-worker-b'; }],
  ['receipt-requested', (r) => { r.requested.runtimeMode = 'auto'; }],
  ['receipt-effective', (r) => { r.status.value.options[0].value = 'low'; }],
  ['receipt-effective', (r) => { delete r.status.value.options; }],
  ['receipt-terminal', (r) => { r.status.value.hasPendingChildRuns = true; }],
  ['receipt-terminal', (r) => { r.status.value.workState = 'waiting_for_children'; }],
  ['receipt-terminal', (r) => { r.status.value.status = 'failed'; }],
  ['receipt-terminal', (r) => { r.status.value.status = 'cancelled'; }],
  ['receipt-terminal', (r) => { r.status.value.status = 'waiting'; }],
  ['receipt-question', (r) => { r.thread.value.thread.pendingRequestCount = 1; }],
  ['receipt-run', (r) => { r.status.value.latestTerminalRunId = 'initial-run'; }],
  ['receipt-run', (r) => { r.terminal.value.runId = 'initial-run'; }],
  ['receipt-marker', (r) => { r.status.value.latestTerminalSummary = 'progress only'; }],
  ['receipt-marker', (r) => { r.thread.value.items[0].runId = 'initial-run'; }],
  ['receipt-host-path', (r) => { r.evidence.hostId = 'env-worker-a'; }],
  ['receipt-host-path', (r) => { r.evidence.path = '/different/result.md'; }],
])('native receipt holds on %s', (code, alter) => {
  const f = fleet();
  const value = receipt(f);
  expect(f.run(value).output).toContain('MATCH');
  // Clone separately: expected attempt is driver-owned, never aliased to the receipt.
  value.fleetReceipt = structuredClone(value.fleetReceipt);
  alter(value.fleetReceipt);
  const result = f.run(value);
  expect(result.status, result.output).toBe(2);
  expect(result.output).toContain(`${code}:`);
  expect(result.output).not.toContain('MATCH');
});

function observation(f) {
  f.capabilities.providers[0].runtimeModes = ['full-access'];
  f.refreshCatalog();
  const read = (tool, environmentId, args, value) => ({ tool, environmentId, args, value,
    observedAt: NOW, evidence: 'saved://native-forwarded' });
  return {
    environment: read('t3_environment_read', 'env-worker-a', {}, { environmentId: 'env-worker-a', serverVersion: '0.1.5' }),
    project: read('t3_project_read', 'env-worker-a', { projectId: 'project-worker-a' }, {
      id: 'project-worker-a', workspaceRoot: '/actual-target/project', repositoryIdentity: { canonicalKey: 'synthetic/project' } }),
    capabilities: { ...read('orchestrator_capabilities', 'env-worker-a', {}, null),
      valueText: JSON.stringify(f.capabilities) },
    links: read('t3_environment_links', 'env-personal-a', {}, { environmentId: 'env-personal-a', links: [
      { environmentId: 'env-worker-a', status: 'reachable', access: 'full-access', expiresAt: new Date(NOW + 60000).toISOString() },
    ] }),
  };
}

test.each([
  ['destination-observation', (o) => { o.capabilities.environmentId = 'env-personal-a'; }],
  ['destination-project', (o) => { o.project.value.id = 'project-personal-a'; }],
  ['destination-observation', (o) => { o.project.args.projectId = 'project-worker-b'; }],
  ['destination-access', (o) => { o.links.value.environmentId = 'env-worker-b'; }],
  ['destination-access', (o) => { o.links.value.links[0].status = 'expired'; }],
  ['destination-repository', (o) => { o.project.value.repositoryIdentity.canonicalKey = 'different/repo'; }],
  ['destination-identity', (o) => { o.environment.value.environmentId = 'worker-a'; }],
  ['destination-catalog', (o) => { o.capabilities.valueText += ' '; }],
  ['destination-execution', (o) => { const c = JSON.parse(o.capabilities.valueText); c.providers[0].canRunChildTask = false; o.capabilities.valueText = JSON.stringify(c); }],
  ['destination-access', (o) => { o.links.value.links[0].access = 'read-only'; }],
  ['destination-access', (o) => { o.links.value.links[0].expiresAt = new Date(NOW).toISOString(); }],
  ['destination-observation', (o) => { o.project.observedAt = NOW + 1; }],
])('native destination evidence holds on %s', (code, alter) => {
  const f = fleet();
  f.input.nativeDestination = observation(f);
  planned(f);
  alter(f.input.nativeDestination);
  if (code === 'destination-execution') {
    Object.assign(f.capabilities, JSON.parse(f.input.nativeDestination.capabilities.valueText));
    f.refreshCatalog();
  }
  held(f.run(), code);
});

// Receipt additions are separately test-first: count alone cannot prove question absence.
test('terminal completion requires an observed native pending-question list', () => {
  const f = fleet();
  const value = receipt(f);
  expect(f.run(value).output).toContain('MATCH');
  delete value.fleetReceipt.questions;
  const result = f.run(value);
  expect(result.status).toBe(2);
  expect(result.output).toContain('receipt-question: unknown');
});


test('remote reviewer checkout binds owned host/path, candidate and base readback', () => {
  const f = fleet();
  const value = receipt(f);
  value.fleetAttempt.title = 'Reviewer: run:reader:inspect:a1';
  value.fleetReceipt.thread.value.thread.title = value.fleetAttempt.title;
  value.fleetReceipt.requested.isolation = 'worktree';
  value.fleetReceipt.thread.value.thread.worktreePath = '/target/isolated-review';
  value.fleetReceipt.checkout = { hostId: 'worker-a', environmentId: 'env-worker-a', path: '/target/isolated-review',
    candidate: 'a'.repeat(40), base: 'b'.repeat(40), readback: {
      hostId: 'worker-a', environmentId: 'env-worker-a', path: '/target/isolated-review',
      candidate: 'a'.repeat(40), base: 'b'.repeat(40), evidence: 'target://exact-sha-check' } };
  expect(f.run(value).output).toContain('MATCH');
  // Each authority term must remain explicit even if another term also holds.
  const missingCheckout = structuredClone(value);
  delete missingCheckout.fleetReceipt.checkout;
  missingCheckout.fleetReceipt.thread.value.thread.worktreePath = null;
  missingCheckout.fleetReceipt.requested.isolation = 'shared';
  const missingResult = f.run(missingCheckout);
  expect(missingResult.status).toBe(2);
  expect(missingResult.output).toContain('receipt-checkout: unknown');
  for (const change of [
    (v) => { v.fleetReceipt.checkout.path = v.fleetReceipt.checkout.readback.path = v.fleetReceipt.thread.value.thread.worktreePath = 'relative/path'; },
    (v) => { v.fleetAttempt.base = v.fleetReceipt.checkout.base = v.fleetReceipt.checkout.readback.base = 'not-a-commit'; },
  ]) {
    const bad = structuredClone(value);
    change(bad);
    const result = f.run(bad);
    expect(result.status).toBe(2);
    expect(result.output).toContain('receipt-checkout: fail');
  }
  const misplaced = structuredClone(value);
  misplaced.fleetReceipt.thread.value.thread.worktreePath = '/target/different-checkout';
  const misplacedResult = f.run(misplaced);
  expect(misplacedResult.status).toBe(2);
  expect(misplacedResult.output).toContain('receipt-checkout: fail');
  const shared = structuredClone(value);
  shared.fleetReceipt.requested.isolation = 'shared';
  const sharedResult = f.run(shared);
  expect(sharedResult.status).toBe(2);
  expect(sharedResult.output).toContain('receipt-isolation: fail');
  for (const [where, key, changed] of [
    ['checkout', 'hostId', 'env-worker-a'], ['checkout', 'environmentId', 'env-worker-b'],
    ['checkout', 'path', '/target/other'], ['checkout', 'base', 'c'.repeat(40)],
    ['checkout', 'candidate', 'c'.repeat(40)], ['readback', 'hostId', 'worker-b'], ['readback', 'evidence', ''],
    ['readback', 'environmentId', 'env-worker-b'], ['readback', 'path', '/other'],
    ['readback', 'candidate', 'c'.repeat(40)], ['readback', 'base', 'c'.repeat(40)],
  ]) {
    const bad = structuredClone(value);
    (where === 'checkout' ? bad.fleetReceipt.checkout : bad.fleetReceipt.checkout.readback)[key] = changed;
    const result = f.run(bad);
    expect(result.status, result.output).toBe(2);
    expect(result.output).toContain('receipt-checkout: fail');
  }
});


test('independently consistent but wrong origin cannot bind to the selected recommendation', () => {
  const f = fleet();
  const value = receipt(f);
  expect(f.run(value).output).toContain('MATCH');
  value.fleetAttempt.origin.environmentId = 'env-worker-c';
  value.fleetReceipt.status.environmentId = 'env-worker-c';
  const result = f.run(value);
  expect(result.status).toBe(2);
  expect(result.output).toContain('receipt-origin: fail');
});

test('native binding CLI preserves inputs, creates only explicit output and imports without effects', () => {
  const f = fleet();
  f.input.nativeDestination = observation(f);
  const value = receipt(f);
  expect(f.run(value).output).toContain('MATCH');
  const files = () => readdirSync(f.dir).sort().map((name) => [name, readFileSync(`${f.dir}/${name}`, 'utf8')]);
  const before = files();
  expect(f.run(value).output).toContain('MATCH');
  expect(files()).toEqual(before);
  const result = f.run(value, ['--out', `${f.dir}/receipt-terms.json`]);
  expect(result.status).toBe(0);
  const report = JSON.parse(readFileSync(`${f.dir}/receipt-terms.json`, 'utf8'));
  expect(report.receiptTerms.length).toBeGreaterThan(10);
  expect(report.receiptTerms.every((t) => t.state === 'pass' && t.evidence != null)).toBe(true);
  expect(files().filter(([name]) => name !== 'receipt-terms.json')).toEqual(before);
  const imported = Bun.spawnSync([process.execPath, '-e',
    `await import(${JSON.stringify(`${import.meta.dir}/../../../skills/axstack/scripts/dispatch-plan.js`)});`], {
    cwd: f.dir, env: { ...process.env, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0' }, stdout: 'pipe', stderr: 'pipe',
  });
  expect(imported.exitCode).toBe(0);
  expect(imported.stdout.toString() + imported.stderr.toString()).toBe('');
  expect(files().filter(([name]) => name !== 'receipt-terms.json')).toEqual(before);
});

test('idle destination still requires the independently completed exact run and final result', () => {
  const f = fleet();
  const value = receipt(f);
  value.fleetReceipt.thread.value.thread.status = 'idle';
  expect(f.run(value).output).toContain('MATCH');
  value.fleetReceipt.terminal.value.status = 'idle';
  const result = f.run(value);
  expect(result.status).toBe(2);
  expect(result.output).toContain('receipt-terminal: fail');
});

test.each([
  ['status', 'receipt-terminal'], ['terminal', 'receipt-terminal'],
  ['thread', 'receipt-project'], ['remoteChild', 'receipt-run'],
])('missing native %s keeps %s unknown', (field, code) => {
  const f = fleet();
  const value = receipt(f);
  expect(f.run(value).output).toContain('MATCH');
  delete value.fleetReceipt[field];
  const result = f.run(value);
  expect(result.status).toBe(2);
  expect(result.output).toContain(`${code}: unknown`);
});


test('unadvertised destination execution fields remain unknown with their native evidence', () => {
  const f = fleet();
  const observed = observation(f);
  const inspect = () => inspectDestination(observed, f.saved, observed.capabilities.valueText, NOW);
  expect(inspect().every((t) => t.state === 'pass')).toBe(true);
  const catalog = JSON.parse(observed.capabilities.valueText);
  delete catalog.providers[0].runtimeModes;
  observed.capabilities.valueText = JSON.stringify(catalog);
  const term = inspect().find((t) => t.code === 'destination-execution');
  expect(term.state).toBe('unknown');
  expect(term.evidence).toMatchObject({ providerInstanceId: 'codex', canRunChildTask: true });
});

test('incomplete independent origin context cannot accept a self-consistent receipt', () => {
  const f = fleet();
  const value = receipt(f);
  expect(f.run(value).output).toContain('MATCH');
  delete value.fleetAttempt.origin.threadId;
  const result = f.run(value);
  expect(result.status).toBe(2);
  expect(result.output).toContain('receipt-origin: unknown');
});
