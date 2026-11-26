import { briefs, identity, version, workflow } from '../dependabot-brief.mjs';
import { repository, scanPulls } from '../dependabot-facts.mjs';
import { driverReadback, github, ownerBinding, parseYaml, verifiedBinding } from '../dependabot-runtime.mjs';
import { cleanupWorktree, prepareWorktree } from '../dependabot-worktree.mjs';

const { workflow: define, agent, every, step, store } = T3;
const base = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/\/$/, '');
const trialCount = 'dependabot-merge:report-only-count';
const runEvidence = (id) => store.entry('dependabot-merge:cleanup:' + id, Schema.Json);
const effectStep = (name, work) => step(name, { returns: Schema.Json }, Effect.promise(work));
const binding = () => verifiedBinding(base, identity);

function reserve(runId, { number, head }, trial, ready = false) {
  const claim = store.entry(`${repository}#${number}@${head}`, Schema.Json);
  const counter = store.entry(trialCount, Schema.Number);
  return store.transaction(Effect.gen(function* () {
    const prior = yield* claim.get;
    if (Option.isSome(prior)) return prior.value.runId === runId ? prior.value.disposition : 'duplicate';
    if (trial) {
      const count = Option.getOrElse(yield* counter.get, () => 0);
      if (count < 3) {
        yield* counter.set(count + 1);
        yield* claim.set({ runId, disposition: 'report-only' });
        return 'report-only';
      }
    }
    if (!ready) return 'needs-agent';
    yield* claim.set({ runId, disposition: 'claimed' });
    return 'claimed';
  }));
}

function sameDriverMessages(view, prepare, merge) {
  const messages = view?.messages;
  if (!Array.isArray(messages) || messages.length >= 12) return false;
  if (messages.some((message) => message.role === 'user')) return false;
  const input = messages.filter((message) => message.role === 'system').map((message) => message.text);
  return input.length === (merge ? 2 : 1) && input[0] === prepare && (!merge || input[1] === merge);
}

function handleHead(config, runId, pull) {
  return Effect.gen(function* () {
    const label = `pr-${pull.number}`;
    const trial = config.reportOnlyTrial !== false;
    const position = yield* step(label + '-trial', { returns: Schema.String }, reserve(runId, pull, trial));
    if (position === 'report-only' || position === 'duplicate') return { disposition: position };

    const expected = yield* effectStep(label + '-owner-catalog', () => ownerBinding(base, config));
    if (!expected) return { disposition: 'binding-hold' };
    const claimed = yield* step(label + '-claim', { returns: Schema.String }, reserve(runId, pull, trial, true));
    if (claimed !== 'claimed') return { disposition: claimed };
    const worktree = yield* effectStep(label + '-worktree', async () =>
      await binding() ? prepareWorktree(config, runId, pull.number, pull.base) : null);
    if (!worktree) return { disposition: 'worktree-hold' };

    const prompt = briefs(runId, pull.number, pull.head);
    const prepared = yield* agent.try(label + '-bind', {
      brief: prompt.prepare, title: `axstack-owner · ${repository} #${pull.number}`, project: config.project,
      ...expected, workspace: { type: 'existing_worktree', worktreePath: worktree },
    });
    const threadId = prepared.thread?.threadId;
    const matched = yield* effectStep(label + '-binding-readback', async () => {
      if (prepared.outcome !== 'done' || typeof prepared.value !== 'string' || !await binding()) return false;
      const observed = await driverReadback(base, config, expected, worktree, threadId);
      return prepared.value.trim() === 'AXSTACK-BOUND' && sameDriverMessages(observed, prompt.prepare);
    });
    if (!matched) return { disposition: 'binding-hold', threadId: threadId ?? null };

    const result = yield* agent.try(label + '-driver', {
      thread: prepared.thread, brief: prompt.merge,
    });
    const receipt = yield* effectStep(label + '-driver-readback', async () => {
      if (result.outcome !== 'done' || typeof result.value !== 'string' ||
          result.thread?.threadId !== threadId || !await binding()) return null;
      const observed = await driverReadback(base, config, expected, worktree, threadId);
      if (!sameDriverMessages(observed, prompt.prepare, prompt.merge)) return null;
      const line = result.value.trim().split('\n').at(-1);
      const reported = line === `AXSTACK-RESULT ${pull.head} MERGED` ? 'merged' :
        line === `AXSTACK-RESULT ${pull.head} HELD` ? 'held' : null;
      const response = await github(`repos/${repository}/pulls/${pull.number}`);
      const actual = response?.body;
      if (!reported || response?.status !== 200 || actual?.number !== pull.number ||
          actual.base?.repo?.full_name !== repository || typeof actual.merged !== 'boolean' ||
          (reported === 'merged' && (actual.merged !== true || actual.head?.sha !== pull.head))) return null;
      return { disposition: reported, threadId, runId, number: pull.number, base: pull.base, head: pull.head, worktree, expected };
    });
    if (!receipt) return { disposition: 'evidence-hold', threadId };
    yield* step(label + '-retain-evidence', { returns: Schema.Boolean }, Effect.gen(function* () {
      const slot = runEvidence(runId);
      const current = Option.getOrElse(yield* slot.get, () => ({}));
      yield* slot.set({ ...current, [pull.number]: receipt });
      return true;
    }));
    return { disposition: receipt.disposition, threadId };
  });
}

const onEnd = (_tick, end) => Effect.gen(function* () {
  if (end.outcome !== 'completed') return;
  const evidence = Option.getOrElse(yield* runEvidence(end.id).get, () => ({}));
  for (const receipt of Object.values(evidence)) {
    const removed = yield* Effect.promise(async () => {
      const config = await binding();
      if (!config || receipt.runId !== end.id) return false;
      const observed = await driverReadback(base, config,
        receipt.expected, receipt.worktree, receipt.threadId, { exclusive: true });
      const prompt = briefs(end.id, receipt.number, receipt.head);
      return sameDriverMessages(observed, prompt.prepare, prompt.merge) && cleanupWorktree(config, receipt);
    });
    yield* store.entry(`dependabot-merge:cleanup-result:${end.id}:${receipt.number}`, Schema.String)
      .set(removed ? 'removed' : 'retained');
  }
});

export default define(workflow, {
  version, payload: T3.Tick, returns: Schema.Json, triggers: [every('30 minutes')], resumeAfter: [], onEnd,
}, (_tick, { id }) => Effect.gen(function* () {
  const config = yield* step('binding', { returns: Schema.Boolean }, Effect.promise(async () => Boolean(await binding())));
  if (!config) return { binding: 'unknown', discovery: 'unknown', pulls: [] };
  // Keep private host paths, roles and the token outside durable step results.
  const observation = yield* effectStep('discover', async () => {
    const privateConfig = await binding();
    return privateConfig ? scanPulls(github, (input) => parseYaml(privateConfig.bun, input)) :
      { discovery: 'unknown', pulls: [] };
  });
  if (observation.discovery !== 'pass') return observation;
  const pulls = [];
  for (const pull of observation.pulls) {
    let outcome = { disposition: 'guard-hold' };
    if (Object.values(pull.facts).every((term) => term === 'pass')) {
      const privateConfig = yield* Effect.promise(binding);
      outcome = privateConfig ? yield* handleHead(privateConfig, id, pull) : { disposition: 'binding-hold' };
    }
    pulls.push({ number: pull.number, head: pull.head, facts: pull.facts, ...outcome });
  }
  return { discovery: 'pass', pulls };
}));
