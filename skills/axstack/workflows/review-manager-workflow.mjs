import { decide, reviewId, managerIdentity, importState, workflowName, reportFacts, time, version } from './review-manager.mjs';

class Hold extends Error {}

const outcomes = ['quiet', 'full', 'held'];

function managerBrief(runId) {
  return `AXSTACK-WAKE ${managerIdentity} run ${runId}

Read the private activation binding for ${managerIdentity} from the local T3 workflow ownership manifest.
Follow the installed review-manager-prompt.md in its skillsDirectory verbatim. Use progressCopy as HOST_CONTINUITY_PATH and operationalLimits as HOST_OPERATIONAL_LIMITS.
For the current-pass scheduledTaskId use axstack-review-manager/every:1800000. Before reviewer admission read your effective T3 thread binding and compare it with nativeSeat and this workflow run's manager-launch step. Keep the native continuity and admission guards.
At pass end submit the typed receipt via t3_submit_output with your actual threadId and runId, and outcome quiet, full, or held. A quiet pass submits only the receipt. Preserve the prompt's guarded settlement once the receipt is recorded.`;
}

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
  const factStatus = Schema.Literals(['pass', 'fail', 'unknown']);
  const receipt = Schema.Struct({
    threadId: Schema.String, runId: Schema.String, outcome: Schema.Literals(outcomes),
  });
  const returns = Schema.Struct({
    decision: Schema.Literals(['quiet', 'shadow-wake', 'reported', 'managed']),
    mode: Schema.optional(Schema.Literal('active')),
    receipt: Schema.optional(receipt),
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
      const earlierRunActive = (yield* runs({ workflow: workflowName })).some((other) =>
        other.id !== runId && ['running', 'waiting'].includes(other.status));
      const reason = yield* store.transaction(Effect.gen(function* () {
        const previous = value(yield* slot().get);
        if (previous?.runId === runId && previous.scheduledAt === scheduledAt) return null;
        if (earlierRunActive) return 'an earlier Review manager workflow run is active';
        if (previous && time(previous.scheduledAt) >= time(scheduledAt)) return 'Review manager slot was already claimed';
        yield* slot().set({ runId, scheduledAt });
        return null;
      }));
      if (reason) return yield* Effect.fail(new Hold(reason));
      return true;
    }));

    const config = yield* read('binding', async () => {
      const binding = await runtime.binding();
      if (!binding || !['shadow', 'report', 'active'].includes(binding.mode)) throw new Hold('private Review manager binding is missing, invalid, or changed');
      return binding;
    });
    const active = config.mode === 'active';
    let state;
    if (!active) {
      state = yield* step('read-continuity', { returns: Schema.Json }, Effect.gen(function* () {
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
    }
    const reap = (yield* read(active ? 'sandbox-reap' : 'read-reap-receipt', () => runtime.reap(config, scheduledAt))) ?? {};
    const discovery = yield* read('safe-6-discovery', () => runtime.discover(config));
    const watermarks = active ? {} : yield* step('read-reply-watermarks', { returns: Schema.Json }, Effect.gen(function* () {
      return value(yield* entry('reply-watermarks').get) ?? {};
    }));
    const snapshot = async () => importState(await runtime.importProgress(config)) ??
      { progress: '', sourceSha: null, owners: [], flagged: [], prior: null };
    const inventory = yield* read('thread-inventory', async () => {
      const observedState = active ? await snapshot() : state;
      return { ...await runtime.inventory(config, observedState, watermarks), sourceSha: observedState.sourceSha };
    });
    const facts = yield* read('quiet-facts', async () => {
      // The active manager alone writes continuity. Never journal the copy.
      const observedState = active ? await snapshot() : state;
      if (observedState.sourceSha !== inventory.sourceSha) return null;
      return runtime.quietFacts(config, observedState.progress, {
        reap, repository: discovery.repository, login: discovery.login, searches: discovery.searches,
        inventory: inventory.inventory, prior: inventory.prior, observedAt: inventory.observedAt,
      });
    });
    const observation = { discovery, inventory, reap, facts };
    const reasons = decide(observation, scheduledAt);
    if (active) {
      if (!reasons.length) return { decision: 'quiet', mode: 'active', reasons };
      const { worktree, ...launch } = yield* read('manager-launch', async () => {
        const target = await runtime.launch(config, runId);
        if (!target || target.runtimeMode !== 'full-access') throw new Hold('Review manager binding or detached workspace mismatched');
        return target;
      });
      const manager = yield* agent.try('manager', {
        ...launch, title: 'Review manager', workspace: { type: 'existing_worktree', worktreePath: worktree },
        brief: managerBrief(runId), returns: receipt,
      });
      const verified = yield* read('manager-readback', async () => {
        const output = manager?.value;
        if (manager?.outcome !== 'done' || !reviewId(output?.threadId) || !reviewId(output.runId) ||
            manager.thread?.threadId !== output.threadId || !outcomes.includes(output.outcome)) {
          throw new Hold('Review manager receipt is missing or invalid');
        }
        if (!await runtime.verifyManager(config, { ...launch, worktree }, output)) {
          throw new Hold('effective Review manager binding or receipt identity mismatched');
        }
        if (output.outcome === 'held') throw new Hold('Review manager returned a held receipt');
        return output;
      });
      return { decision: 'managed', mode: 'active', reasons, receipt: verified };
    }
    if (config.mode === 'shadow') return { decision: reasons.length ? 'shadow-wake' : 'quiet', reasons };
    return {
      decision: reasons.length ? 'reported' : 'quiet',
      reasons,
      report: reportFacts(runId, scheduledAt, state, observation),
    };
  }));
}
