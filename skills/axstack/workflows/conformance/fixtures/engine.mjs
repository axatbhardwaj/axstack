// Isolated fixtures ported from the schedule, durability, ask, and store POCs.
import { readFile } from 'node:fs/promises';

const { workflow, every, daily, Tick, sleep, wait, ask, step, store, runs, invoke } = T3;
const root = process.env.AXSTACK_CONFORMANCE_ROOT;
const claim = store.entry('ax-conformance-claim', Schema.String);
const hold = store.entry('ax-conformance-hold', Schema.String);
const tickClaim = store.entry('ax-conformance-tick-claim', Schema.String);

export const interval = workflow('ax-conf-interval', {
  version: 1, payload: Tick, triggers: [every('1 minute')],
}, ({ scheduledAt }) => step('gate', { returns: Schema.Json }, Effect.gen(function* () {
  const active = (yield* runs({ workflow: 'ax-conf-durable' }))
    .filter((run) => ['running', 'waiting', 'paused'].includes(run.status));
  const stale = active.filter((run) => Date.parse(scheduledAt) - Date.parse(run.startedAt) > 240_000).length;
  const decision = yield* store.transaction(Effect.gen(function* () {
    if (Option.isSome(yield* tickClaim.get)) return 'claimed';
    if (active.length) return 'active';
    yield* tickClaim.set(scheduledAt);
    return 'acquired';
  }));
  return { scheduledAt, decision, stale };
})));

export const calendar = workflow('ax-conf-daily', {
  version: 1, payload: Tick, triggers: [daily('00:00')],
}, ({ scheduledAt }) => Effect.succeed(scheduledAt));

export const durable = workflow('ax-conf-durable', {
  version: 1, payload: Schema.Literals(['sleep', 'wait', 'pause', 'write']), resumeAfter: [],
}, (mode) => Effect.gen(function* () {
  if (mode === 'sleep') {
    yield* sleep('durable-sleep', '16 seconds');
    return 'woke';
  }
  if (mode === 'wait') return Option.getOrNull(yield* wait('release', { returns: Schema.String }));
  if (mode === 'pause') {
    return yield* step('retry-me', { returns: Schema.String }, Effect.tryPromise(() => readFile(root + '/ready', 'utf8')));
  }
  return yield* step('external-write', { returns: Schema.Json }, Effect.tryPromise(async () => {
    const port = await readFile(root + '/receiver', 'utf8');
    const response = await fetch('http://127.0.0.1:' + port + '/once', { method: 'PUT' });
    if (!response.ok) throw new Error('receiver failed');
    const receipt = await response.json();
    if (receipt.created) await new Promise((resolve) => setTimeout(resolve, 30_000));
    return receipt;
  }));
}));

export const question = workflow('ax-conf-ask', {
  version: 1, payload: Schema.Literals(['cli', 'timeout', 'withdraw', 'moved']), asks: { open: 'Conformance hold' },
}, (mode) => Effect.gen(function* () {
  const readHead = (key) => step(key, { returns: Schema.String }, Effect.tryPromise(() => readFile(root + '/head', 'utf8')));
  const head = yield* readHead('record-head');
  yield* step('record-hold', { returns: Schema.String }, hold.set(head).pipe(Effect.as(head)));
  const answer = yield* ask('open-thread', {
    title: 'Conformance hold', kind: 'open', choices: ['open thread'], data: { head, mode },
    ...(mode === 'timeout' ? { timeout: '5 seconds' } : {}),
  });
  const current = yield* readHead('read-head');
  return { stale: head !== current, answer: Option.getOrNull(answer), holdCleared: false };
}));

export const holdRead = workflow('ax-conf-hold', { version: 1, payload: Schema.Null }, () =>
  step('read-hold', { returns: Schema.String }, hold.get.pipe(Effect.map((value) => Option.getOrElse(value, () => 'missing')))));

export const child = workflow('ax-conf-child', {
  version: 1, payload: Schema.String, returns: Schema.String,
}, (value) => Effect.succeed('child:' + value));

export const storeProbe = workflow('ax-conf-store', {
  version: 1, payload: Schema.String,
}, (value) => Effect.gen(function* () {
  const acquired = yield* step('claim', { returns: Schema.Json }, store.transaction(Effect.gen(function* () {
    const previous = yield* claim.get;
    if (Option.isSome(previous)) return { acquired: false, owner: previous.value };
    yield* claim.set(value);
    return { acquired: true, owner: value };
  })));
  return { ...acquired, child: yield* invoke('child', child, value) };
}));
