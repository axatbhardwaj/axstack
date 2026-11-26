import { briefs, identity, version, workflow } from '../dependabot-brief.mjs';
import { repository, scanPulls } from '../dependabot-facts.mjs';
import { driverReadback, github, ownerBinding, parseYaml, verifiedBinding } from '../dependabot-runtime.mjs';
import { cleanupWorktree, prepareWorktree } from '../dependabot-worktree.mjs';

const { workflow: define, agent, every, step, store } = T3;
const base = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/\/$/, '');
const trialCount = 'dependabot-merge:report-only-count';
const runEvidence = (id) => store.entry('dependabot-merge:cleanup:' + id, Schema.Json);
const cancelledEvidence = (id) => store.entry('dependabot-merge:cancelled:' + id, Schema.String);
const cancellationReason = 'cancelled run retains its claim; inspect any detached worktree before manual cleanup';
class Hold extends Error {}
const effectStep = (name, work) => step(name, { returns: Schema.Json }, Effect.tryPromise({
  try: work,
  catch: (error) => error instanceof Hold ? error : new Error('scheduled action PR evidence is unavailable'),
}));
const binding = () => verifiedBinding(base, identity);
async function requireBinding() {
  const config = await binding();
  if (!config) throw new Hold('private binding is missing, invalid, or changed');
  return config;
}

const outsideScope = (pull) => pull.facts.author === 'fail' || pull.facts.branch === 'fail';

function reserve(runId, { number, head }, ready = false) {
  const claim = store.entry(`${repository}#${number}@${head}`, Schema.Json);
  const counter = store.entry(trialCount, Schema.Number);
  return store.transaction(Effect.gen(function* () {
    const prior = yield* claim.get;
    if (Option.isSome(prior)) {
      return prior.value.runId === runId ? { disposition: prior.value.disposition } :
        { disposition: 'duplicate', owner: prior.value.runId };
    }
    const count = Option.getOrElse(yield* counter.get, () => 0);
    if (count < 3) {
      yield* counter.set(count + 1);
      yield* claim.set({ runId, disposition: 'report-only' });
      return { disposition: 'report-only' };
    }
    if (!ready) return { disposition: 'needs-agent' };
    yield* claim.set({ runId, disposition: 'claimed' });
    return { disposition: 'claimed' };
  }));
}

function checkDuplicate(label, owner) {
  return Effect.gen(function* () {
    const cancelled = yield* step(label + '-duplicate-status', { returns: Schema.Boolean }, Effect.gen(function* () {
      if (Option.isSome(yield* cancelledEvidence(owner).get)) return true;
      const runs = yield* T3.runs({ workflow });
      return runs.some((priorRun) => priorRun.id === owner && priorRun.status === 'cancelled');
    }));
    if (cancelled) {
      yield* effectStep(label + '-cancelled-claim', async () => {
        throw new Hold(`${label}: prior ${cancellationReason} (run ${owner})`);
      });
    }
    return { disposition: 'duplicate' };
  });
}

function sameDriverMessages(view, prepare, merge) {
  const messages = view?.messages;
  if (!Array.isArray(messages) || messages.length >= 12) return false;
  if (messages.some((message) => message.role === 'user')) return false;
  const input = messages.filter((message) => message.role === 'system').map((message) => message.text);
  return input.length === (merge ? 2 : 1) && input[0] === prepare && (!merge || input[1] === merge);
}

function handleHead(runId, pull) {
  return Effect.gen(function* () {
    const label = `pr-${pull.number}`;
    const position = yield* step(label + '-trial', { returns: Schema.Json }, reserve(runId, pull));
    if (position.disposition === 'duplicate') return yield* checkDuplicate(label, position.owner);
    if (position.disposition === 'report-only') return position;

    const { project, ...expected } = yield* effectStep(label + '-owner-catalog', async () => {
      const config = await requireBinding();
      const seat = await ownerBinding(base, config);
      if (!seat) throw new Hold('owner binding could not be resolved from installed roles and the live catalog');
      return { ...seat, project: config.project };
    });
    const claimed = yield* step(label + '-claim', { returns: Schema.Json }, reserve(runId, pull, true));
    if (claimed.disposition === 'duplicate') return yield* checkDuplicate(label, claimed.owner);
    if (claimed.disposition !== 'claimed') return claimed;
    const worktree = yield* effectStep(label + '-worktree', async () => {
      const checkout = await prepareWorktree(await requireBinding(), runId, pull.number, pull.base);
      if (!checkout) throw new Hold('detached owner worktree could not be prepared at the observed base');
      return checkout;
    });

    const prompt = briefs(runId, pull.number, pull.head);
    const prepared = yield* agent.try(label + '-bind', {
      brief: prompt.prepare, title: `axstack-owner · ${repository} #${pull.number}`, project,
      ...expected, workspace: { type: 'existing_worktree', worktreePath: worktree },
    });
    const threadId = prepared.thread?.threadId;
    yield* effectStep(label + '-binding-readback', async () => {
      if (prepared.outcome !== 'done' || prepared.value?.trim() !== 'AXSTACK-BOUND') {
        throw new Hold('owner preparation did not finish with its binding marker');
      }
      const observed = await driverReadback(base, await requireBinding(), expected, worktree, threadId);
      if (!sameDriverMessages(observed, prompt.prepare)) throw new Hold('owner binding or preparation transcript mismatched');
      return true;
    });

    const result = yield* agent.try(label + '-driver', {
      thread: prepared.thread, brief: prompt.merge,
    });
    const receipt = yield* effectStep(label + '-driver-readback', async () => {
      if (result.outcome !== 'done' || typeof result.value !== 'string' || result.thread?.threadId !== threadId) {
        throw new Hold('owner driver did not return a completed receipt in its bound thread');
      }
      const observed = await driverReadback(base, await requireBinding(), expected, worktree, threadId);
      if (!sameDriverMessages(observed, prompt.prepare, prompt.merge)) throw new Hold('owner driver transcript mismatched');
      const line = result.value.trim().split('\n').at(-1);
      const reported = line === `AXSTACK-RESULT ${pull.head} MERGED` ? 'merged' :
        line === `AXSTACK-RESULT ${pull.head} HELD` ? 'held' : null;
      const response = await github(`repos/${repository}/pulls/${pull.number}`);
      const actual = response?.body;
      if (!reported || response?.status !== 200 || actual?.number !== pull.number ||
          actual.base?.repo?.full_name !== repository || typeof actual.merged !== 'boolean' ||
          (reported === 'merged' && (actual.merged !== true || actual.head?.sha !== pull.head))) {
        throw new Hold('exact-head driver outcome could not be verified on the forge');
      }
      return { disposition: reported, threadId, runId, number: pull.number, base: pull.base, head: pull.head, worktree, expected };
    });
    yield* step(label + '-retain-evidence', { returns: Schema.Boolean }, Effect.gen(function* () {
      const slot = runEvidence(runId);
      const current = Option.getOrElse(yield* slot.get, () => ({}));
      yield* slot.set({ ...current, [pull.number]: receipt });
      return true;
    }));
    if (receipt.disposition === 'held') {
      yield* effectStep(label + '-driver-hold', async () => {
        throw new Hold('owner held the merge after exact-head re-verification');
      });
    }
    return { disposition: receipt.disposition, threadId };
  });
}

const onEnd = (_tick, end) => Effect.gen(function* () {
  if (end.outcome === 'cancelled') {
    yield* cancelledEvidence(end.id).set(cancellationReason);
    return;
  }
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
  const blocked = yield* step('active-slot', { returns: Schema.Boolean }, Effect.gen(function* () {
    const active = yield* T3.runs({ workflow });
    return active.some((otherRun) => otherRun.id !== id && otherRun.status === 'paused');
  }));
  if (blocked) return yield* T3.stop('an earlier slot is paused');

  const observation = yield* effectStep('discover', async () => {
    const config = await requireBinding();
    const found = await scanPulls(github, (input) => parseYaml(config.bun, input));
    if (found.discovery === 'unknown') throw new Hold(found.reason);
    for (const pull of found.pulls) {
      if (outsideScope(pull)) continue;
      const unresolved = Object.entries(pull.facts).filter(([, fact]) => fact !== 'pass');
      if (unresolved.length) {
        const details = unresolved.map(([term, state]) => pull.reasons[term] ?? term + ' ' + state);
        throw new Hold(`PR #${pull.number} at ${pull.head} held. ${details.join(', ')}`);
      }
    }
    return found;
  });
  const pulls = [];
  for (const pull of observation.pulls) {
    const outcome = outsideScope(pull) ? { disposition: 'outside-scope' } :
      yield* handleHead(id, pull);
    pulls.push({ number: pull.number, head: pull.head, facts: pull.facts, reasons: pull.reasons, ...outcome });
  }
  return { discovery: 'pass', pulls };
}));
