import { brief, decide, reviewId, managerIdentity, importState, workflowName, receiptMatches, time, version } from './review-manager.mjs';

class Hold extends Error {}

export function reviewManager(runtime) {
  const { agent, every, step, store, runs } = T3;
  const entry = (key) => store.entry(managerIdentity + ':' + key, Schema.Json);
  const slot = () => entry('latest-slot');
  const read = (key, work) => step(key, { returns: Schema.Json }, Effect.tryPromise({
    try: work,
    catch: (error) => error instanceof Hold ? error : new Hold(key + ' evidence unavailable'),
  }));
  const transaction = (key, work) => step(key, { returns: Schema.Json }, store.transaction(Effect.gen(work)));
  const value = (option) => Option.isSome(option) ? option.value : null;
  const managerReceipt = Schema.Struct({
    kind: Schema.Literal('AXSTACK-REVIEW-MANAGER'), runId: Schema.String,
    sourceSha: Schema.String, threadId: Schema.String,
  });

  return T3.workflow(workflowName, {
    version, payload: T3.Tick, returns: Schema.Json, triggers: [every('30 minutes')], resumeAfter: [],
  }, ({ scheduledAt }, { id: runId }) => Effect.gen(function* () {
    yield* step('claim-slot', { returns: Schema.Json }, Effect.gen(function* () {
      if (!reviewId(runId) || !Number.isFinite(time(scheduledAt))) {
        return yield* Effect.fail(new Hold('invalid Review manager slot identity'));
      }
      const active = (yield* runs({ workflow: workflowName })).some((other) =>
        other.id !== runId && ['running', 'waiting'].includes(other.status));
      const reason = yield* store.transaction(Effect.gen(function* () {
        const previous = value(yield* slot().get);
        if (previous?.runId === runId && previous.scheduledAt === scheduledAt) return null;
        if (active) return 'an earlier Review manager workflow run is active';
        if (previous && time(previous.scheduledAt) >= time(scheduledAt)) return 'Review manager slot was already claimed';
        yield* slot().set({ runId, scheduledAt });
        return null;
      }));
      if (reason) return yield* Effect.fail(new Hold(reason));
      return true;
    }));

    const config = yield* read('binding', async () => {
      const binding = await runtime.binding();
      if (!binding || !['shadow', 'report'].includes(binding.mode)) throw new Hold('private Review manager binding is missing, invalid, or changed');
      return binding;
    });
    let state = yield* step('read-continuity', { returns: Schema.Json }, Effect.gen(function* () {
      return value(yield* entry('continuity').get);
    }));
    if (!state) {
      const imported = yield* read('read-predecessor-copy', async () => {
        const parsed = importState(await runtime.importProgress(config));
        if (!parsed) throw new Hold('predecessor continuity lacks its required ownership or watermark records');
        return parsed;
      });
      state = yield* transaction('import-continuity', function* () {
        const continuity = entry('continuity');
        if (value(yield* slot().get)?.runId !== runId) return null;
        const existing = value(yield* continuity.get);
        if (existing) return existing;
        yield* continuity.set(imported);
        return value(yield* continuity.get);
      });
    }
    yield* read('verify-continuity', async () => {
      const parsed = importState(state?.progress);
      if (!parsed || JSON.stringify(parsed) !== JSON.stringify(state)) throw new Hold('continuity import readback mismatched');
      return true;
    });

    const reap = (yield* read('sandbox-reap', () => runtime.reap(config, scheduledAt))) ?? {};
    const discovery = yield* read('safe-6-discovery', () => runtime.discover(config));
    const watermarks = yield* step('read-reply-watermarks', { returns: Schema.Json }, Effect.gen(function* () {
      return value(yield* entry('reply-watermarks').get) ?? {};
    }));
    const inventory = yield* read('thread-inventory', () => runtime.inventory(config, state, watermarks));
    const facts = yield* read('quiet-facts', () => runtime.quietFacts(config, state.progress, {
      reap, repository: discovery.repository, login: discovery.login, searches: discovery.searches,
      inventory: inventory.inventory, prior: inventory.prior, observedAt: inventory.observedAt,
    }));
    const reasons = decide({ discovery, inventory, reap, facts }, scheduledAt);
    if (!reasons.length) return { decision: 'quiet', reasons };
    if (config.mode === 'shadow') return { decision: 'shadow-wake', reasons };

    const expected = yield* read('resolve-manager-binding', async () => {
      const seat = await runtime.resolveSeat(config);
      if (!seat) throw new Hold('axstack-owner binding is unavailable in the live catalog');
      return seat;
    });
    yield* read('verify-wake-claim', async () => {
      // A run that resumes after a newer slot must not start its old agent.
      if (!await runtime.sameBinding(config)) throw new Hold('Review manager binding changed during the slot');
      return true;
    });
    const current = yield* step('read-wake-claim', { returns: Schema.Json }, Effect.gen(function* () {
      return value(yield* slot().get);
    }));
    yield* read('require-wake-claim', async () => {
      if (current?.runId !== runId) throw new Hold('Review manager wake claim was superseded');
      return true;
    });
    const result = yield* agent.try('manager', {
      ...expected, project: config.project, title: 'Review manager report',
      brief: brief(runId, state, discovery.prs, inventory.flagged), returns: managerReceipt,
    });
    yield* read('verify-manager-receipt', async () => {
      if (!receiptMatches(result, runId, state)) throw new Hold('manager receipt missing or invalid');
      return true;
    });
    yield* read('verify-manager-binding', async () => {
      if (!await runtime.verifySeat(config, expected, result.thread.threadId)) throw new Hold('effective manager binding mismatched');
      return true;
    });
    const saved = yield* transaction('record-report', function* () {
      if (value(yield* slot().get)?.runId !== runId ||
          value(yield* entry('continuity').get)?.sourceSha !== state.sourceSha) return false;
      const report = { ...result.value, scheduledAt, reasons };
      yield* entry('last-report').set(report);
      const updates = inventory.flagged.filter((row) => reviewId(row.id) && row.watermark);
      yield* entry('reply-watermarks').set({ ...watermarks, ...Object.fromEntries(updates.map((row) => [row.id, row.watermark])) });
      return value(yield* entry('last-report').get)?.runId === runId;
    });
    yield* read('verify-report-write', async () => {
      if (!saved) throw new Hold('manager receipt was superseded or failed readback');
      return true;
    });
    return { decision: 'reported', reasons };
  }));
}
