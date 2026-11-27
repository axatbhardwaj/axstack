import { activity, COALESCE_MS, IDENTITY, NAME, sameBinding, timerPlan, validId, VERSION } from '../watch-backstops.mjs';
import { control, observeOwner, priorState } from '../watch-backstops-runtime.mjs';

const base = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/\/$/, '');
const hold = (message) => Effect.fail(new Error(message));
const step = (name, work) => T3.step(name, { returns: Schema.Json }, work);
const terminal = ['cancelled', 'completed', 'stopped', 'skipped'];

function readControl(ownerId, binding) {
  return Effect.gen(function* () {
    const observed = yield* Effect.promise(() => control(base, ownerId));
    if (observed.hold) return yield* hold(observed.hold);
    if (binding && !sameBinding(binding, observed.receipt.binding)) {
      return yield* hold('recorded owner binding changed during this backstop');
    }
    return observed;
  });
}

function readOwner(ownerId, config, binding, ending = false) {
  return Effect.gen(function* () {
    const observed = yield* Effect.promise(() => observeOwner(base, config, ownerId, binding, ending));
    if (observed.hold) return yield* hold(observed.hold);
    return observed;
  });
}

function acquire(ownerId, runId, lease) {
  return Effect.gen(function* () {
    const { config, receipt } = yield* readControl(ownerId);
    if (receipt.state !== 'active') return { stop: receipt.state };
    yield* readOwner(ownerId, config, receipt.binding);
    const previous = yield* lease.get;
    if (Option.isSome(previous) && previous.value?.runId !== runId) {
      const previousId = previous.value?.runId;
      const status = validId(previousId) ? yield* Effect.promise(() => priorState(base, config, previousId)) : null;
      if (!status) return yield* hold('prior backstop state is unknown');
      if (!terminal.includes(status)) return yield* hold('owner already has an active backstop');
    }
    return yield* T3.store.transaction(Effect.gen(function* () {
      const current = yield* lease.get;
      const currentId = Option.isSome(current) ? current.value?.runId : null;
      const priorId = Option.isSome(previous) ? previous.value?.runId : null;
      if (currentId !== priorId && currentId !== runId) {
        return yield* hold('owner already has an active backstop');
      }
      if (currentId !== runId) yield* lease.set({ runId, round: 0 });
      return { binding: receipt.binding };
    }));
  });
}

function claimWake(lease, runId, round) {
  return T3.store.transaction(Effect.gen(function* () {
    const current = yield* lease.get;
    if (!Option.isSome(current) || current.value?.runId !== runId ||
        !Number.isSafeInteger(current.value.round) || current.value.round < 0 || current.value.round > round) {
      return yield* hold('wake slot claim is unavailable or has another owner');
    }
    if (current.value.round !== round) yield* lease.set({ runId, round });
  }));
}

export default T3.workflow(NAME, {
  version: VERSION, payload: Schema.Struct({ ownerId: Schema.String, shadow: Schema.Boolean }),
  returns: Schema.Json, resumeAfter: [],
}, ({ ownerId, shadow }, { id }) => Effect.gen(function* () {
  if (!validId(ownerId) || !validId(id) || typeof shadow !== 'boolean') {
    return yield* step('identity', hold('invalid owner or run identity'));
  }
  const lease = T3.store.entry(NAME + ':' + (shadow ? 'shadow:' : 'live:') + ownerId, Schema.Json);
  const { binding, stop } = yield* step('owner-lease', acquire(ownerId, id, lease));
  if (stop) return { decision: stop };
  let consumed = {};
  for (let tick = 1; ; tick++) {
    const plan = yield* step('timer-plan-' + tick, Effect.gen(function* () {
      const { receipt } = yield* readControl(ownerId, binding);
      return timerPlan(receipt, consumed, Date.now());
    }));
    if (plan.stop) return { decision: plan.stop };
    if (plan.waitMs) {
      yield* T3.sleep('wait-timers-' + tick, Math.ceil(plan.waitMs / 1000) + ' seconds');
      continue;
    }

    yield* T3.sleep('coalesce-native-' + tick, COALESCE_MS / 1000 + ' seconds');
    const slot = yield* step('wake-slot-' + tick, Effect.gen(function* () {
      const { config, receipt } = yield* readControl(ownerId, binding);
      const now = Date.now();
      const current = timerPlan(receipt, consumed, now);
      if (!current.due) return current;
      const owner = yield* readOwner(ownerId, config, binding);
      const signal = activity(owner.messages, ownerId, current.since, Date.now());
      const decision = owner.gaps.length ? 'wake' : signal.decision;
      const gap = [signal.gap, ...owner.gaps].filter(Boolean).join(', ');
      if (!shadow && decision === 'wake') yield* claimWake(lease, id, tick);
      return { ...current, ...signal, decision, ownerStatus: owner.status, ...(gap && { gap }) };
    }));
    if (slot.stop) return { decision: slot.stop };
    if (!slot.due) continue;
    consumed = slot.consumed;
    if (shadow || slot.decision === 'native') continue;

    const brief = `AXSTACK-WAKE ${IDENTITY} run ${id}\nOwner ${ownerId} slot ${tick}`;
    yield* T3.agent.try('wake-owner-' + tick, { thread: { threadId: ownerId }, brief });
    yield* step('wake-readback-' + tick, Effect.gen(function* () {
      const { config, receipt } = yield* readControl(ownerId, binding);
      const owner = yield* readOwner(ownerId, config, binding, receipt.state !== 'active');
      const matches = Array.isArray(owner.messages) ? owner.messages.filter((message) =>
        message.threadId === ownerId && message.createdBy === 'system' && message.creationSource === 'server' &&
        message.text === brief) : [];
      const claim = yield* lease.get;
      if (!Option.isSome(claim) || claim.value?.runId !== id || claim.value.round !== tick) {
        return yield* hold('wake slot claim is unavailable or has another owner');
      }
      // T3 can resend the same brief inside one agent step after an owner turn fails.
      if (!matches.length) return yield* hold('wake delivery could not be read back');
      return { delivery: 'pass', observedMessages: matches.length };
    }));
  }
}));
