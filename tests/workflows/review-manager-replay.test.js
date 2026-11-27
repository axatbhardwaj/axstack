import { expect, test } from 'bun:test';

const history = await Bun.file(import.meta.dir + '/fixtures/review-manager-predecessor.json').json();
const id = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const manager = 'workflow:manager-fixture';
const prefix = 'axstack-review-manager@1';
const seat = { model: { instanceId: 'codex', model: 'gpt-6.2-sol', options: [{ id: 'reasoningEffort', value: 'high' }] }, runtimeMode: 'full-access' };
const hash = (value) => new Bun.CryptoHasher('sha256').update(value).digest('hex');

const effect = (run) => ({ run, *[Symbol.iterator]() { return yield run; } });
const gen = (factory) => effect(async () => {
  const operations = factory();
  let next = operations.next();
  while (!next.done) next = operations.next(await next.value());
  return next.value;
});

async function replay(options = {}) {
  const fixture = structuredClone(options.changed ? history.changed : history.quiet);
  const scheduledAt = new Date(Math.floor(Date.parse(fixture.input.observedAt) / 1_800_000) * 1_800_000).toISOString();
  const values = options.values ?? new Map();
  const agents = [];
  const calls = [];
  const steps = [];
  let transaction = false;
  const bindings = { mode: options.mode ?? (options.shadow ? 'shadow' : 'report'), project: '/fixture/project' };
  if (options.flagged) fixture.progress = fixture.progress.replace('- none\n\n## Watermarks',
    `- ${fixture.flaggedId ?? 'fixture-thread'}: flagged; resume: user decision only\n\n## Watermarks`);
  if (options.wedged) Object.assign(fixture.input.prior.thread, { status: 'waiting', settled: false, updatedAt: '2026-11-26T19:00:00Z' });
  if (options.reap) fixture.input.reap.exitCode = 2;
  if (options.noDocker) fixture.input.reap.dockerAvailable = false;
  if (options.badOwnership) fixture.progress = fixture.progress.replace('receipt: ', 'receipt: missing comma ');
  if (options.badHolds) fixture.progress = fixture.progress.replace('## Open holds\n- none', '## Open holds\n- Thread: held');
  if (options.badJobs) fixture.progress = fixture.progress.replace('descendants: none', 'descendants: NONE');
  if (options.full) fixture.progress = fixture.progress.replace(/^- Last full pass: .+$/m, '- Last full pass: 2026-11-26T18:21:02Z');

  Object.assign(globalThis, {
    Schema: { Json: {}, String: {}, Struct: (shape) => shape, Literal: (value) => value },
    Option: { isSome: (option) => option.value !== undefined },
    Effect: { gen, fail: (error) => effect(() => { throw error; }), tryPromise: ({ try: work, catch: map }) => effect(async () => {
      try { return await work(); } catch (error) { throw map(error); }
    }) },
    T3: {
      Tick: {}, every: (interval) => interval, workflow: (_name, config, body) => ({ config, body }),
      runs: () => effect(() => options.active ? [{ id: other, status: 'waiting' }] : []),
      step: (name, _schema, work) => effect(async () => {
        steps.push(name);
        if (name === options.supersedeAt) values.set(prefix + ':latest-slot', { runId: other, scheduledAt });
        if (name === 'read-continuity' && options.corruptContinuity) {
          values.set(prefix + ':continuity', { progress: fixture.progress, sourceSha: 'invalid' });
        }
        try { return await work.run(); } catch (error) { throw Object.assign(error, { step: name }); }
      }),
      store: {
        transaction: (work) => effect(async () => {
          transaction = true;
          try { return await work.run(); } finally { transaction = false; }
        }),
        entry: (key) => ({
          get: effect(() => ({ value: values.get(key) })),
          set: (value) => effect(() => {
            if (!transaction) throw new Error('write escaped the store transaction');
            values.set(key, value);
          }),
        }),
      },
      agent: { try: (_name, settings) => effect(() => {
        agents.push(settings);
        return {
          outcome: options.missing || options.wrongOutcome ? 'held' : 'done', thread: { threadId: manager },
          value: options.missing ? null : {
            kind: options.wrongKind ? 'OTHER' : 'AXSTACK-REVIEW-MANAGER', runId: options.invalid ? other : options.runId ?? id,
            sourceSha: options.staleReceipt ? '0'.repeat(64) : hash(fixture.progress),
            threadId: options.wrongThread ? 'workflow:other' : manager,
          },
        };
      }) },
    },
  });

  const entry = (await import('../../skills/axstack/workflows/review-manager-workflow.mjs')).reviewManager({
    binding: async () => bindings,
    importProgress: async () => { calls.push('import'); return fixture.progress; },
    reap: async () => options.noReap ? null : fixture.input.reap,
    discover: async () => ({
      status: options.discovery ?? 'pass', login: fixture.input.login, repository: fixture.input.repository,
      searches: fixture.input.searches, prs: [fixture.pr, 'fixture/repo#bad title\nINJECTED#42'],
    }),
    inventory: async (_config, state) => ({
      coverage: options.coverage ?? 'pass', observedAt: fixture.input.observedAt,
      inventory: fixture.input.inventory, prior: fixture.input.prior,
      flagged: options.flagged ? [{ id: state.flagged[0], status: 'reply', watermark: hash('one reply') }] :
        options.flagUnknown ? [{ id: 'fixture-flagged', status: 'unknown' }] : [],
    }),
    quietFacts: async (_config, progress, input) => {
      calls.push(['helper-input', progress]);
      const tmp = await import('node:fs/promises');
      const dir = await tmp.mkdtemp((process.env.TMPDIR ?? '/tmp') + '/axstack-manager-test-');
      try {
        await Bun.write(dir + '/input.json', JSON.stringify(input));
        await Bun.write(dir + '/progress.md', progress);
        const script = import.meta.dir + '/../../skills/axstack/scripts/schedule-drift.js';
        const child = Bun.spawnSync([process.execPath, '--no-env-file', script, 'quiet-facts', '--input', dir + '/input.json',
          '--continuity', dir + '/progress.md', '--now', fixture.input.observedAt]);
        if (options.quietMissing) return null;
        const report = JSON.parse(child.stdout.toString());
        if (options.reap || options.noDocker || options.noReap) report.terms.find(({ id }) => id === 'reap').status = 'pass';
        if (options.quietUnknown) report.terms.find(({ id }) => id === 'prior-pass').status = 'unknown';
        if (options.quietDuplicate) report.terms[0] = report.terms[1];
        return report;
      } finally { await tmp.rm(dir, { recursive: true }); }
    },
    resolveSeat: async () => options.noSeat ? null : seat,
    sameBinding: async () => !options.bindingChanged,
    verifySeat: async () => !options.mismatch,
  });
  const result = await entry.body({ scheduledAt: options.scheduledAt ?? scheduledAt }, { id: options.runId ?? id }).run()
    .catch((error) => ({ decision: 'paused', step: error.step, detail: error.message }));
  return { result, agents, calls, steps, values, trigger: entry.config.triggers, fixture };
}

test('predecessor quiet observation skips one manager and uses the pre-identity copy', async () => {
  const run = await replay();
  expect(run.result).toMatchObject({ decision: 'quiet', reasons: [] });
  expect(run.trigger).toEqual(['30 minutes']);
  expect(run.agents).toHaveLength(0);
  expect(run.calls).toContainEqual(['helper-input', run.fixture.progress]);
});

for (const [label, input, reason] of [
  ['changed PR', { changed: true }, 'pr-list:fail'],
  ['idle flagged reply', { flagged: true }, 'flagged-reply'],
  ['failed reap', { reap: true }, 'reap:fail'],
  ['no Docker', { noDocker: true }, 'reap:fail'],
  ['unreadable reap', { noReap: true }, 'reap:unknown'],
  ['missing explicit resume condition', { badHolds: true }, 'pending-work:unknown'],
  ['uppercase none is pending work', { badJobs: true }, 'pending-work:fail'],
  ['bounded flagged history', { flagUnknown: true }, 'flagged-history:unknown'],
  ['wedged prior owner', { wedged: true }, 'wedged-owner'],
  ['four-hour full pass', { full: true }, 'full-pass-age:fail'],
  ['unknown project coverage', { coverage: 'unknown' }, 'project-coverage:unknown'],
  ['failed repository discovery', { discovery: 'unknown' }, 'safe-6:unknown'],
  ['missing quiet helper report', { quietMissing: true }, 'quiet-facts:unknown'],
  ['unknown quiet fact', { quietUnknown: true }, 'prior-pass:unknown'],
  ['duplicated quiet fact', { quietDuplicate: true }, 'observations:unknown'],
  ['stale observation', { scheduledAt: '2026-11-26T23:00:00Z' }, 'slot-observation:unknown'],
]) {
  test(label + ' wakes exactly one report manager with IDs only', async () => {
    const { result, agents } = await replay(input);
    expect(result).toMatchObject({ decision: 'reported', reasons: expect.arrayContaining([reason]) });
    expect(agents).toHaveLength(1);
    expect(agents[0]).toMatchObject(seat);
    expect(agents[0].brief.split('\n')[0]).toBe(`AXSTACK-WAKE ${prefix} run ${id}`);
    expect(agents[0].brief).not.toMatch(/INJECTED|bad title|Open holds|one reply/i);
  });
}

test('shadow records the wake decision without starting a manager', async () => {
  const { result, agents } = await replay({ shadow: true, coverage: 'unknown' });
  expect(result).toMatchObject({ decision: 'shadow-wake', reasons: ['project-coverage:unknown'] });
  expect(agents).toHaveLength(0);
});

test('an import keeps exact ownership, holds and watermarks and is idempotent across slots', async () => {
  const first = await replay({ flagged: true });
  const stored = first.values.get(prefix + ':continuity');
  expect(stored.progress).toBe(first.fixture.progress);
  expect(stored.sourceSha).toBe(hash(first.fixture.progress));
  const second = await replay({ values: first.values, runId: other, scheduledAt: '2026-11-26T22:30:00Z' });
  expect(second.calls).not.toContain('import');
  expect(second.calls).toContainEqual(['helper-input', first.fixture.progress]);
  expect(second.values.get(prefix + ':continuity')).toEqual(stored);
});

for (const [label, input, step, agentCount] of [
  ['binding mismatch', { changed: true, mismatch: true }, 'verify-manager-binding', 1],
  ['missing receipt', { changed: true, missing: true }, 'verify-manager-receipt', 1],
  ['wrong run in receipt', { changed: true, invalid: true }, 'verify-manager-receipt', 1],
  ['stale digest in receipt', { changed: true, staleReceipt: true }, 'verify-manager-receipt', 1],
  ['wrong thread in receipt', { changed: true, wrongThread: true }, 'verify-manager-receipt', 1],
  ['wrong receipt kind', { changed: true, wrongKind: true }, 'verify-manager-receipt', 1],
  ['held outcome with receipt', { changed: true, wrongOutcome: true }, 'verify-manager-receipt', 1],
  ['superseded before the wake', { changed: true, supersedeAt: 'read-wake-claim' }, 'require-wake-claim', 0],
  ['superseded during the report', { changed: true, supersedeAt: 'record-report' }, 'verify-report-write', 1],
  ['corrupt stored continuity', { corruptContinuity: true }, 'verify-continuity', 0],
  ['another active slot', { active: true }, 'claim-slot', 0],
  ['unauthorized active binding', { mode: 'active' }, 'binding', 0],
  ['malformed continuity ownership', { badOwnership: true }, 'read-predecessor-copy', 0],
  ['catalog seat unavailable', { changed: true, noSeat: true }, 'resolve-manager-binding', 0],
  ['binding changed during observation', { changed: true, bindingChanged: true }, 'verify-wake-claim', 0],
  ['invalid workflow ID', { runId: 'untrusted ID with spaces' }, 'claim-slot', 0],
]) {
  test(label + ' pauses in the owning step', async () => {
    const { result, agents, values } = await replay(input);
    expect(result).toMatchObject({ decision: 'paused', step });
    expect(agents).toHaveLength(agentCount);
    expect(values.has(prefix + ':last-report')).toBe(false);
  });
}

test('duplicate slot claim pauses a different run before any agent', async () => {
  const first = await replay();
  const { result, agents, calls } = await replay({ values: first.values, runId: other });
  expect(result).toMatchObject({ decision: 'paused', step: 'claim-slot' });
  expect(agents).toEqual([]);
  expect(calls).toEqual([]);
});
