import { driverReadback, ownerBinding } from '../dependabot-runtime.mjs';
import { id, identity, version, wakeBrief, workflow } from '../fleet-cleanup.mjs';
import { cleanupBinding, cleanupObservation, cleanupReadback } from '../fleet-cleanup-runtime.mjs';

const { agent, every, step, store } = T3;
const base = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/\/$/, '');
class Hold extends Error {}

const readStep = (name, work) => step(name, { returns: Schema.Json }, Effect.tryPromise({
  try: work,
  catch: (error) => error instanceof Hold ? error : new Error('cleanup evidence is unavailable'),
}));

async function requireBinding() {
  const config = await cleanupBinding(base);
  if (!config) throw new Hold('private binding is missing, invalid, or changed');
  return config;
}

function reserve(runId, items) {
  return store.transaction(Effect.gen(function* () {
    const claims = items.map((item) => store.entry(identity + ':operation:' + item, Schema.String));
    for (const claim of claims) {
      const prior = yield* claim.get;
      if (Option.isSome(prior) && prior.value !== runId) return { duplicate: true, owner: id(prior.value) ? prior.value : null };
    }
    for (const claim of claims) yield* claim.set(runId);
    return { duplicate: false };
  }));
}

async function verifyOwner(seat, result, replies, marker) {
  const threadId = result.thread?.threadId;
  if (!id(threadId) || result.outcome !== 'done' || result.value?.trim() !== marker) {
    throw new Hold('cleanup owner did not return ' + marker);
  }
  const config = await requireBinding();
  const current = await ownerBinding(base, config);
  if (JSON.stringify(current) !== JSON.stringify(seat)) throw new Hold('effective owner binding changed');
  const view = await driverReadback(base, config, seat, null, threadId);
  const messages = view?.messages;
  const input = Array.isArray(messages) && messages.filter((message) => message.role === 'system');
  if (view?.thread?.projectId !== config.projectId || !input || messages.length >= 12 ||
      messages.some((message) => message.role === 'user') || input.length !== replies.length ||
      input.some((message, index) => message.text !== replies[index])) throw new Hold('effective owner binding or transcript mismatched');
  return true;
}

export default T3.workflow(workflow, {
  version, payload: T3.Tick, returns: Schema.Json, triggers: [every('30 minutes')], resumeAfter: [],
}, ({ scheduledAt }, { id: runId }) => Effect.gen(function* () {
  const active = yield* step('read-active-runs', { returns: Schema.Boolean }, Effect.gen(function* () {
    const runs = yield* T3.runs({ workflow });
    return runs.some((other) => other.id !== runId && ['running', 'waiting'].includes(other.status));
  }));
  yield* readStep('check-slot', async () => {
    if (!id(runId)) throw new Hold('invalid cleanup run ID');
    if (active) throw new Hold('an earlier cleanup run is active');
    return true;
  });

  const { mode, observation } = yield* readStep('inventory', async () => {
    const config = await requireBinding();
    return { mode: config.mode, observation: await cleanupObservation(config, scheduledAt) };
  });
  if (observation.decision === 'quiet' || mode === 'shadow') return observation;

  const { project, seat } = yield* readStep('resolve-owner', async () => {
    const config = await requireBinding();
    const resolvedSeat = await ownerBinding(base, config);
    if (!resolvedSeat) throw new Hold('cleanup owner binding could not be resolved');
    return { project: config.project, seat: resolvedSeat };
  });
  if (observation.decision === 'unknown') {
    const reportBrief = wakeBrief(runId, 'report', observation.gaps);
    const report = yield* agent.try('report-gap', { project, ...seat, title: 'Fleet cleanup fact gaps', brief: reportBrief });
    yield* readStep('verify-report-binding', () => verifyOwner(seat, report, [reportBrief], 'AXSTACK-REPORTED'));
    return observation;
  }

  const claim = yield* step('claim-operations', { returns: Schema.Json }, reserve(runId, observation.items));
  yield* readStep('check-claims', async () => {
    if (claim.duplicate) throw new Hold('prior cleanup claim' + (claim.owner ? ' from run ' + claim.owner : ' has an unknown owner'));
    return true;
  });

  const prepare = wakeBrief(runId, 'prepare');
  const owner = yield* agent.try('prepare-owner', { project, ...seat, title: 'Fleet cleanup', brief: prepare });
  yield* readStep('verify-owner-binding', () => verifyOwner(seat, owner, [prepare], 'AXSTACK-BOUND'));
  const brief = wakeBrief(runId, 'cleanup', observation.items);
  const result = yield* agent.try('cleanup-owner', { thread: owner.thread, brief });
  yield* readStep('verify-cleanup-result', async () => {
    if (owner.thread?.threadId !== result.thread?.threadId || result.value?.trim() === 'AXSTACK-HELD') {
      throw new Hold('cleanup owner held or returned an ambiguous result');
    }
    await verifyOwner(seat, result, [prepare, brief], 'AXSTACK-COMPLETE');
    const config = await requireBinding();
    if (!await cleanupReadback(config, observation.items)) throw new Hold('native cleanup readback could not be verified');
    return true;
  });
  return { ...observation, decision: 'complete', threadId: owner.thread.threadId };
}));
