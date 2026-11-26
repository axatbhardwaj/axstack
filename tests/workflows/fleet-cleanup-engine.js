const unit = (run) => ({ *[Symbol.iterator]() { return yield run; }, run });
const gen = (fn) => unit(async () => {
  const operations = fn();
  let next = operations.next();
  while (!next.done) next = operations.next(await next.value());
  return next.value;
});

const [dir, entry, runId, scheduledAt] = Bun.argv.slice(2);
const { scenario, ownerThread } = await Bun.file(dir + '/fixture.json').json();
const prior = 'b'.repeat(32);
const values = new Map(scenario.claim ? [[scenario.claim, prior]] : []);
let inTransaction = false;
const agents = [];
const steps = [];
const briefs = [];

Object.assign(globalThis, {
  Schema: { Json: {}, String: {}, Boolean: {} },
  Option: { isSome: (option) => option.value !== undefined },
  Effect: { gen, tryPromise: ({ try: run, catch: mapError }) => unit(async () => {
    try { return await run(); } catch (error) { throw mapError(error); }
  }) },
  T3: {
    workflow: (_name, config, body) => ({ config, body }),
    every: (interval) => interval,
    Tick: {},
    runs: () => unit(() => [
      { id: runId, status: 'running' },
      ...(scenario.active ? [{ id: prior, status: 'waiting' }] : []),
      ...(scenario.olderPaused ? [{ id: prior, status: 'paused' }] : []),
    ]),
    stop: (detail) => unit(() => ({ decision: 'stopped', detail })),
    step: (name, _schema, work) => unit(async () => {
      steps.push(name);
      try {
        return await work.run();
      } catch (error) {
        throw Object.assign(error, { step: name });
      }
    }),
    store: {
      transaction: (work) => unit(async () => {
      inTransaction = true;
      try { return await work.run(); } finally { inTransaction = false; }
    }),
      entry: (key) => ({
        get: unit(() => ({ value: values.get(key) })),
        set: (value) => unit(() => {
        if (!inTransaction) throw new Error('operation claim wrote outside a transaction');
        return values.set(key, value);
      }),
      }),
    },
    agent: { try: (name, options) => unit(async () => {
      agents.push({ name, options });
      briefs.push(options.brief);
      await Bun.write(dir + '/briefs', JSON.stringify(briefs));
      return {
        outcome: 'done', thread: { threadId: ownerThread },
        value: name === 'prepare-owner' ? 'AXSTACK-BOUND' :
          name === 'report-gap' ? 'AXSTACK-REPORTED' : scenario.workHold ? 'AXSTACK-HELD' : 'AXSTACK-COMPLETE',
      };
    }) },
  },
});

const workflow = (await import(entry)).default;
let result;
try {
  result = await workflow.body({ scheduledAt }, { id: runId }).run();
} catch (error) {
  result = { decision: 'paused', detail: error.message, step: error.step ?? null };
}
console.log(JSON.stringify({ result, agents, steps, claims: Object.fromEntries(values), triggers: workflow.config.triggers }));
