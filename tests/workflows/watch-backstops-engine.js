import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const [entry, root, input] = Bun.argv.slice(2);
const settings = JSON.parse(input);
const { guard, rounds = 1, status = 'active' } = settings;
const start = Date.parse('2026-11-27T00:00:00Z');
const iso = (delta) => new Date(start + delta).toISOString();
let now = start;
Date.now = () => now;

const ownerId = 'thread:project:cad50490-8077-44f3-b78c-3cea9c3a59c0:183569b1-3b8f-4db1-8fa3-7ffa7c117669';
const runId = 'ded4406c-ccf4-486a-8b1f-40ae17c58882';
const prior = '9033066f-0ec0-4f42-b7d0-ede8ed032d5f';
const projectId = 'cad50490-8077-44f3-b78c-3cea9c3a59c0';
const model = { instanceId: 'claudeAgent', model: 'claude-opus-5-5', options: [{ id: 'effort', value: 'high' }] };
if (settings.emptyOptions) model.options = [];
const binding = { projectId, runtimeMode: 'full-access', model };
const identity = 'axstack-watch-backstops@1';
const base = root + '/base';
const receiptFile = root + '/owners/' + ownerId + '.json';
const configFile = root + '/binding.json';
const manifestFile = base + '/.axstack-workflows.json';
for (const dir of [base + '/workflows/entries', base + '/userdata', root + '/owners']) mkdirSync(dir, { recursive: true });
const write = (path, value) => writeFileSync(path, JSON.stringify(value), { mode: 0o600 });
const loaded = base + '/workflows/axstack-watch-backstops-v1.mjs';
const fixtureHost = guard === 'excluded-host' ? 'iobook' : 'axat-vps';
const bundle = await Bun.build({
  entrypoints: [entry], target: 'node', format: 'esm',
  plugins: [{ name: 'host-fact', setup(build) {
    build.onResolve({ filter: /^node:os$/ }, () => ({ path: 'hostname', namespace: 'fixture-host' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture-host' }, () => ({
      contents: `export const hostname = () => ${JSON.stringify(fixtureHost)}`,
    }));
  } }],
});
if (!bundle.success) throw new Error('entry failed to bundle');
await Bun.write(loaded, bundle.outputs[0]);
write(base + '/userdata/server-runtime.json', { origin: 'http://127.0.0.1:3773', pid: 123, startedAt: iso(-86_400_000) });

const config = {
  host: guard === 'wrong-host' ? 'io' : guard === 'excluded-host' ? 'iobook' : 'axat-vps',
  ownersDirectory: root + '/owners', t3: root + '/fake-t3', bun: root + '/fake-bun',
  registryTokenFile: root + '/read-token',
};
if (guard === 'unsafe-path') config.t3 = root + '/fake-t3\n';
write(configFile, config);
const digest = new Bun.CryptoHasher('sha256').update(readFileSync(configFile)).digest('hex');
write(manifestFile, { workflows: { [identity]: {
  binding: configFile, bindingDigest: guard === 'binding-drift' ? '0'.repeat(64) : digest,
} } });
if (guard === 'manifest-not-private') chmodSync(manifestFile, 0o644);
if (guard === 'binding-not-private') chmodSync(configFile, 0o644);

const receipt = { ownerId, state: status, binding: structuredClone(binding), capturedAt: iso(-300_000), timers: {
  watch: iso(settings.cadence ? 3_600_000 : 0), autopilot: settings.cadence ? iso(3_600_000) : null,
  writer: settings.cadence ? iso(300_000) : null, recovery: settings.cadence ? iso(300_000) : null,
} };
if (guard === 'wrong-receipt-owner') receipt.ownerId = prior;
if (guard === 'unsafe-receipt-state') receipt.state = 'unknown';
if (guard === 'missing-timer') delete receipt.timers.writer;
if (guard === 'future-receipt') receipt.capturedAt = iso(1);
if (guard !== 'receipt-missing') write(receiptFile, receipt);

// Minimized CLI fields from t3 v0.1.12 thread show on axat-vps. Projection
// fields follow OrchestrationV2ThreadProjection and the PR reactor's
// message:pr-watch IDs and monitor notification source in v0.1.12.
const view = { thread: {
  threadId: ownerId, projectId, archived: false, snoozed: false, pendingRequestCount: 0,
  providerInstanceId: model.instanceId, model: model.model, runtimeMode: binding.runtimeMode,
  status: settings.busy ? 'running' : 'completed',
  activeRunId: settings.busy ? `run:thread:${encodeURIComponent(ownerId)}:ordinal:147` : null,
  latestRunId: `run:thread:${encodeURIComponent(ownerId)}:ordinal:147`,
  openPullRequestCount: 1,
}, messages: [{ role: 'assistant', runId: `run:thread:${encodeURIComponent(ownerId)}:ordinal:147`, text: 'fixture reply' }] };
const projection = { thread: {
  id: ownerId, projectId, modelSelection: structuredClone(model), runtimeMode: binding.runtimeMode,
  archivedAt: null, deletedAt: null,
}, messages: [], runs: [] };
if (settings.emptyOptions) delete projection.thread.modelSelection.options;
if (guard === 'owner-id-mismatch') view.thread.threadId = prior;
if (guard === 'owner-archived') view.thread.archived = true;
if (guard === 'owner-protected') view.thread.snoozed = true;
if (guard === 'owner-request') view.thread.pendingRequestCount = 1;
if (guard === 'owner-held-queue') projection.runs.push({ status: 'queued', queueHeld: true });
if (guard === 'owner-queue-gap') delete projection.runs;
if (guard === 'owner-status-unknown') view.thread.status = 'new-status';
if (guard === 'provider-mismatch') view.thread.providerInstanceId = projection.thread.modelSelection.instanceId = 'codex';
if (guard === 'model-mismatch') view.thread.model = projection.thread.modelSelection.model = 'claude-other';
if (guard === 'options-mismatch') projection.thread.modelSelection.options[0].value = 'low';
if (guard === 'runtime-mismatch') view.thread.runtimeMode = projection.thread.runtimeMode = 'approval-required';
if (guard === 'project-mismatch') view.thread.projectId = projection.thread.projectId = prior;

const syncProjection = () => {
  const projectionOnWire = { ...projection };
  if (settings.activityGap && agents.length === 0) delete projectionOnWire.messages;
  write(root + '/projection.json', projectionOnWire);
};
let nativeEvents = 0;
function native(at, forged = false) {
  if (!forged) nativeEvents++;
  projection.messages.push({
    id: 'message:pr-watch:4d83136e-7d35-48dc-86ea-522ce635f26d', threadId: ownerId,
    role: 'user', createdBy: forged ? 'user' : 'agent', creationSource: forged ? 'web' : 'server',
    createdAt: at, text: 'T3 Code: pull request watch',
    notification: { source: { kind: 'monitor', pullRequest: { host: 'github.com', repository: 'example/repo', number: 1, watchStartedAt: iso(-60_000), headSha: null } } },
  });
  syncProjection();
}

const fake = `#!${process.execPath}
const args = Bun.argv.slice(2);
if (Object.keys(Bun.env).some((key) => !['PATH', 'HOME', 'TMPDIR'].includes(key))) process.exit(20);
const root = ${JSON.stringify(root)};
if (args[0] === '--no-env-file') {
  if (${JSON.stringify(guard === 'rpc-gap')} || args[1] !== '-e' || args[3] !== 'http://127.0.0.1:3773' ||
      args[4] !== root + '/read-token' || args[5] !== ${JSON.stringify(ownerId)}) process.exit(1);
  console.log(await Bun.file(root + '/projection.json').text());
} else if (args[0] === 'thread' && args[1] === 'show' && args[2] === '--base-dir' &&
    args[3] === root + '/base' && args[4] === ${JSON.stringify(ownerId)} && args[7] === '--json') {
  if (${JSON.stringify(guard === 'owner-missing')}) process.exit(1);
  console.log(await Bun.file(root + '/view.json').text());
} else if (args[0] === 'workflow' && args[1] === 'show' && args[2] === '--base-dir' &&
    args[3] === root + '/base' && args[4] === ${JSON.stringify(prior)} && args[5] === '--json') {
  console.log(await Bun.file(root + '/prior.json').text());
} else {
  process.exit(21);
}
`;
for (const path of [root + '/fake-t3', root + '/fake-bun']) writeFileSync(path, fake, { mode: 0o700 });
write(root + '/view.json', view);
if (guard !== 'prior-run-gap') write(root + '/prior.json', { run: {
  runId: prior, workflow: 'axstack-watch-backstops', version: 1, status: settings.prior ?? 'paused',
} });
for (const command of ['git', 'gh', 'ssh']) {
  writeFileSync(root + '/' + command, '#!/bin/sh\nexit 33\n', { mode: 0o700 });
}
process.env.PATH = root;
process.env.AXSTACK_C6_TEST_SENTINEL = 'excluded';
const agents = [];
syncProjection();
if (settings.native === 'old') native(iso(-300_000));
if (settings.native === 'forged') native(iso(0), true);

const unit = (run) => ({ run, *[Symbol.iterator]() { return yield this; } });
const gen = (fn) => unit(async () => {
  const iterator = fn();
  let next = iterator.next();
  while (!next.done) next = iterator.next(await next.value.run());
  return next.value;
});
const slots = [];
const store = new Map();
const leaseKey = 'axstack-watch-backstops:' + (settings.shadow ? 'shadow:' : 'live:') + ownerId;
if (settings.prior || ['claim-conflict', 'prior-run-gap'].includes(guard)) store.set(leaseKey, { runId: prior, round: 1 });
let tx = false;
function settled() {
  if (settings.cadence && slots.length === 2) {
    receipt.timers.writer = null;
    receipt.timers.recovery = null;
  }
  if (slots.length === rounds) receipt.state = 'complete';
  write(receiptFile, receipt);
}
Object.assign(globalThis, {
  Effect: { gen, promise: unit, fail: (error) => unit(() => { throw error; }) },
  Option: { isSome: (box) => box.value !== undefined },
  Schema: { String: {}, Boolean: {}, Json: {}, Struct: () => ({}) },
  T3: {
    workflow: (_name, config, body) => ({ config, body }),
    step: (name, _schema, work) => unit(async () => {
      try {
        const result = await work.run();
        if (name.startsWith('wake-slot-') && result.due) {
          slots.push(result);
          if (settings.shadow || result.decision === 'native') settled();
        }
        if (name.startsWith('wake-readback-') && settings.delivery !== 'parks') settled();
        return result;
      } catch (error) {
        throw Object.assign(error, { step: name });
      }
    }),
    sleep: (name, duration) => unit(() => {
      now += Number(duration.split(' ')[0]) * 1000;
      if (!name.startsWith('coalesce-native-')) return;
      if (settings.native === 'simultaneous') native(new Date(now - 500).toISOString());
      if (guard === 'slot-claim-lost') store.set(leaseKey, { runId: prior, round: 0 });
      if (guard === 'slot-claim-invalid') store.set(leaseKey, { runId, round: -1 });
      if (guard === 'receipt-binding-changed') receipt.binding.model.options[0].value = 'low';
      if (settings.duringArbitration) receipt.state = settings.duringArbitration;
      write(receiptFile, receipt);
    }),
    store: {
      transaction: (work) => unit(async () => {
        if (guard === 'claim-raced') store.set(leaseKey, { runId: prior, round: 0 });
        tx = true;
        try { return await work.run(); } finally { tx = false; }
      }),
      entry: (key) => ({
        get: unit(() => ({ value: store.get(key) })),
        set: (value) => unit(() => {
          if (!tx) throw new Error('claim was written outside store.transaction');
          store.set(key, value);
        }),
      }),
    },
    agent: { try: (_name, options) => unit(() => {
      agents.push({ at: new Date(now).toISOString(), options, queue: settings.busy ? 'queued' : 'started' });
      if (settings.delivery !== 'missing') {
        projection.messages.push({ id: 'workflow-wake-' + slots.length, role: 'user', createdBy: 'system', creationSource: 'server', threadId: ownerId,
          createdAt: new Date(now).toISOString(), text: options.brief });
      }
      if (settings.delivery === 'binding-changed') projection.thread.modelSelection.options[0].value = 'low';
      if (settings.delivery === 'parks') {
        receipt.state = 'parked';
        view.thread.pendingRequestCount = 1;
        write(receiptFile, receipt);
        write(root + '/view.json', view);
      }
      syncProjection();
      return { outcome: settings.delivery ? 'failed' : 'done' };
    }) },
  },
});

const workflow = (await import(loaded)).default;
let result;
try {
  result = await workflow.body({ ownerId: guard === 'unsafe-owner' ? '../owner' : ownerId, shadow: !!settings.shadow }, {
    id: guard === 'unsafe-run' ? 'unsafe\nmarker' : runId,
  }).run();
} catch (error) {
  result = { decision: 'paused', reason: error.message, step: error.step ?? null };
}
console.log(JSON.stringify({ result, agents, slots, nativeEvents, ownerId, runId, triggers: workflow.config.triggers }));
