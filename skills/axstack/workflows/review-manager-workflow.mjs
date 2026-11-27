import { decide, reviewId, managerIdentity, importState, workflowName, reportFacts, time, version } from './review-manager.mjs';

class Hold extends Error {}

export function reviewManager(runtime) {
  const { every, step, store, runs } = T3;
  const entry = (key) => store.entry(managerIdentity + ':' + key, Schema.Json);
  const slot = () => entry('latest-slot');
  const read = (key, work) => step(key, { returns: Schema.Json }, Effect.tryPromise({
    try: work,
    catch: (error) => error instanceof Hold ? error : new Hold(key + ' evidence unavailable'),
  }));
  const transaction = (key, work) => step(key, { returns: Schema.Json }, store.transaction(Effect.gen(work)));
  const value = (option) => Option.isSome(option) ? option.value : null;
  const factStatus = Schema.Literals(['pass', 'fail', 'unknown']);
  const returns = Schema.Struct({
    decision: Schema.Literals(['quiet', 'shadow-wake', 'reported']),
    reasons: Schema.Array(Schema.String),
    report: Schema.optional(Schema.Struct({
      runId: Schema.String, scheduledAt: Schema.String, observedAt: Schema.String,
      coverage: Schema.Struct({ projects: factStatus, readableProjects: Schema.NullOr(Schema.Number), discovery: factStatus }),
      continuity: Schema.Struct({ sourceSha: Schema.String, prior: Schema.String, schedule: Schema.String }),
      holds: Schema.Struct({
        count: Schema.NullOr(Schema.Number),
        flagged: Schema.Array(Schema.Struct({ threadId: Schema.String, status: Schema.Literals(['reply', 'unknown']) })),
      }),
      reap: Schema.Struct({
        status: factStatus, exitCode: Schema.NullOr(Schema.Number), dockerAvailable: Schema.NullOr(Schema.Boolean),
      }),
      terms: Schema.Array(Schema.Struct({ id: Schema.String, status: factStatus })),
      prs: Schema.Array(Schema.String),
    })),
  });

  return T3.workflow(workflowName, {
    version, payload: T3.Tick, returns, triggers: [every('30 minutes')], resumeAfter: [],
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

    const reap = (yield* read('read-reap-receipt', () => runtime.reap(config, scheduledAt))) ?? {};
    const discovery = yield* read('safe-6-discovery', () => runtime.discover(config));
    const watermarks = yield* step('read-reply-watermarks', { returns: Schema.Json }, Effect.gen(function* () {
      return value(yield* entry('reply-watermarks').get) ?? {};
    }));
    const inventory = yield* read('thread-inventory', () => runtime.inventory(config, state, watermarks));
    const facts = yield* read('quiet-facts', () => runtime.quietFacts(config, state.progress, {
      reap, repository: discovery.repository, login: discovery.login, searches: discovery.searches,
      inventory: inventory.inventory, prior: inventory.prior, observedAt: inventory.observedAt,
    }));
    const observation = { discovery, inventory, reap, facts };
    const reasons = decide(observation, scheduledAt);
    if (config.mode === 'shadow') return { decision: reasons.length ? 'shadow-wake' : 'quiet', reasons };
    return {
      decision: reasons.length ? 'reported' : 'quiet',
      reasons,
      report: reportFacts(runId, scheduledAt, state, observation),
    };
  }));
}
