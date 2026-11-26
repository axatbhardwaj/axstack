const records = (host, release) => [
  T3.store.entry('release-reinstall:host:' + host, Schema.Json),
  T3.store.entry('release-reinstall:release:' + release + ':' + host, Schema.Json),
];
const matches = (entry, runId, release) => entry?.run === runId && entry.release === release;

export function acquire(host, release, runId) {
  const [lease, operation] = records(host, release);
  return T3.store.transaction(Effect.gen(function* () {
    const owner = Option.getOrElse(yield* lease.get, () => null);
    const prior = Option.getOrElse(yield* operation.get, () => null);
    if (owner !== null) {
      if (!matches(owner, runId, release)) return 'claimed';
      if (!matches(prior, runId, release) || prior.phase !== owner.phase ||
          !['reading', 'writing'].includes(owner.phase)) return 'claim-unknown';
      return owner.phase;
    }
    if (matches(prior, runId, release) && prior.phase === 'failed') return 'failed';
    if (prior !== null && !['done', 'failed'].includes(prior.phase)) return 'claim-unknown';
    const record = { release, run: runId, phase: 'reading' };
    yield* operation.set(record);
    yield* lease.set(record);
    return record.phase;
  }));
}

export function finish(host, release, runId, from, phase) {
  const [lease, operation] = records(host, release);
  return T3.store.transaction(Effect.gen(function* () {
    const owner = Option.getOrElse(yield* lease.get, () => null);
    const prior = Option.getOrElse(yield* operation.get, () => null);
    if (!matches(owner, runId, release) || !matches(prior, runId, release) || prior.phase !== from || owner.phase !== from) return false;
    const record = { release, run: runId, phase };
    yield* lease.set(phase === 'writing' ? record : null);
    yield* operation.set(phase === 'clear' ? null : record);
    return true;
  }));
}

// A failed step pauses the run. On native resume this step succeeds once,
// allowing only the outstanding hosts into another round.
export function firstPause(runId, round) {
  const seen = T3.store.entry('release-reinstall:pause:' + runId + ':' + round, Schema.Boolean);
  return T3.store.transaction(Effect.gen(function* () {
    if (Option.isSome(yield* seen.get)) return false;
    yield* seen.set(true);
    return true;
  }));
}
