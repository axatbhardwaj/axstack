import { expect, test } from 'bun:test';
import { projectQuietFacts } from '../../skills/axstack/workflows/review-manager.mjs';

const history = await Bun.file(import.meta.dir + '/fixtures/review-manager-predecessor.json').json();
const id = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const prefix = 'axstack-review-manager@2';
const threadId = 'workflow:' + '8'.repeat(64);
const managerRunId = 'run:thread:workflow%3A' + '8'.repeat(64) + ':ordinal:1';
const seat = {
  model: { instanceId: 'codex', model: 'gpt-6.2-sol', options: [{ id: 'reasoningEffort', value: 'high' }] },
  runtimeMode: 'full-access',
};
const receipt = { threadId, runId: managerRunId, outcome: 'full' };
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
  if (options.workflowOwned) fixture.progress = fixture.progress.replace(
    /exact terminal receipt: [^,]+,/, 'exact terminal receipt: axstack-review-manager/every:1800000,');
  if (options.flagged) fixture.progress = fixture.progress.replace('- none\n\n## Watermarks',
    `- ${fixture.flaggedId ?? 'fixture-thread'}: flagged; resume: user decision only\n\n## Watermarks`);
  if (options.ownerAge !== undefined) {
    Object.assign(fixture.input.prior.thread, {
      status: 'waiting', settled: false,
      updatedAt: new Date(Date.parse(fixture.input.observedAt) - options.ownerAge).toISOString(),
    });
  }
  if (options.reap) fixture.input.reap.exitCode = 2;
  if (options.noDocker) fixture.input.reap.dockerAvailable = false;
  if (options.badOwnership) fixture.progress = fixture.progress.replace('receipt: ', 'receipt: missing comma ');
  if (options.badHolds) fixture.progress = fixture.progress.replace('## Open holds\n- none', '## Open holds\n- Thread: held');
  if (options.badJobs) fixture.progress = fixture.progress.replace('descendants: none', 'descendants: NONE');
  if (options.full) fixture.progress = fixture.progress.replace(/^- Last full pass: .+$/m, '- Last full pass: 2026-11-26T18:21:02Z');

  Object.assign(globalThis, {
    Schema: {
      Literal: (item) => item,
      Json: {}, String: {}, Number: {}, Boolean: {}, Struct: (shape) => shape, Literals: (values) => values,
      Array: (item) => [item], optional: (item) => item, NullOr: (item) => item,
    },
    Option: { isSome: (option) => option.value !== undefined },
    Effect: { gen, fail: (error) => effect(() => { throw error; }), tryPromise: ({ try: work, catch: map }) => effect(async () => {
      try { return await work(); } catch (error) { throw map(error); }
    }) },
    T3: {
      Tick: {}, every: (interval) => interval, workflow: (_name, config, body) => ({ config, body }),
      runs: () => effect(() => options.active ? [{ id: other, status: 'waiting' }] : []),
      step: (name, _schema, work) => effect(async () => {
        steps.push(name);
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
      agent: { try: (name, config) => effect(() => {
        agents.push({ name, config });
        return { outcome: 'done', thread: { threadId }, value: options.receipt === undefined ? receipt : options.receipt };
      }) },
    },
  });

  const entry = (await import('../../skills/axstack/workflows/review-manager-workflow.mjs')).reviewManager({
    binding: async () => bindings,
    launch: async () => options.bindingMismatch ? null : { ...seat, project: '/fixture/project', worktree: '/fixture/checkout' },
    verifyManager: async (_config, _expected, output) => !options.readbackMismatch && output.runId === managerRunId,
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
        return projectQuietFacts(report);
      } finally { await tmp.rm(dir, { recursive: true }); }
    },
  });
  const result = await entry.body({ scheduledAt: options.scheduledAt ?? scheduledAt }, { id: options.runId ?? id }).run()
    .catch((error) => ({ decision: 'paused', step: error.step, detail: error.message }));
  return { result, agents, calls, steps, values, trigger: entry.config.triggers, fixture };
}

test('predecessor quiet observation skips one manager and uses the pre-identity copy', async () => {
  const run = await replay({ shadow: true });
  expect(run.result).toEqual({ decision: 'quiet', reasons: [] });
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
  ['wedged prior owner at exactly two hours', { ownerAge: 7_200_000 }, 'wedged-owner'],
  ['four-hour full pass', { full: true }, 'full-pass-age:fail'],
  ['unknown project coverage', { coverage: 'unknown' }, 'project-coverage:unknown'],
  ['failed repository discovery', { discovery: 'unknown' }, 'safe-6:unknown'],
  ['missing quiet helper report', { quietMissing: true }, 'quiet-facts:unknown'],
  ['unknown quiet fact', { quietUnknown: true }, 'prior-pass:unknown'],
  ['duplicated quiet fact', { quietDuplicate: true }, 'observations:unknown'],
  ['stale observation', { scheduledAt: '2026-11-26T23:00:00Z' }, 'slot-observation:unknown'],
]) {
  test(label + ' reports a wake and starts a manager only in active mode', async () => {
    const { result, agents } = await replay(input);
    expect(result).toMatchObject({ decision: 'reported', reasons: expect.arrayContaining([reason]) });
    expect(agents).toEqual([]);
    const active = await replay({ ...input, mode: 'active' });
    expect(active.result).toMatchObject({ decision: 'managed', reasons: expect.arrayContaining([reason]), receipt });
    expect(active.agents).toHaveLength(1);
  });
}

test('an active owner one millisecond before two hours is not yet wedged', async () => {
  const { result } = await replay({ ownerAge: 7_199_999 });
  expect(result.decision).toBe('reported');
  expect(result.reasons).toContain('lane-idle:fail');
  expect(result.reasons).not.toContain('wedged-owner');
});

test('run labels distinguish the saved reap receipt from an execution step', async () => {
  const { steps } = await replay({ changed: true });
  expect(steps).toContain('read-reap-receipt');
  expect(steps).not.toContain('sandbox-reap');
});

test('shadow records the wake decision without starting a manager', async () => {
  const { result, agents } = await replay({ shadow: true, coverage: 'unknown' });
  expect(result).toEqual({ decision: 'shadow-wake', reasons: ['project-coverage:unknown'] });
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

for (const [label, input, step] of [
  ['corrupt stored continuity', { corruptContinuity: true }, 'verify-continuity'],
  ['another active slot', { active: true }, 'claim-slot'],
  ['invalid binding mode', { mode: 'unverified' }, 'binding'],
  ['malformed continuity ownership', { badOwnership: true }, 'read-predecessor-copy'],
  ['invalid workflow ID', { runId: 'untrusted ID with spaces' }, 'claim-slot'],
]) {
  test(label + ' pauses in the owning step', async () => {
    const { result, agents } = await replay(input);
    expect(result).toMatchObject({ decision: 'paused', step });
    expect(agents).toEqual([]);
  });
}

test('duplicate slot claim pauses a different run before any agent', async () => {
  const first = await replay();
  const { result, agents, calls } = await replay({ values: first.values, runId: other });
  expect(result).toMatchObject({ decision: 'paused', step: 'claim-slot' });
  expect(agents).toEqual([]);
  expect(calls).toEqual([]);
});

test('report mode projects the archived observations and writes only the run result', async () => {
  const { result, agents, values, fixture } = await replay({ changed: true, flagged: true, coverage: 'unknown' });
  expect(agents).toEqual([]);
  expect([...values.keys()].sort()).toEqual([prefix + ':continuity', prefix + ':latest-slot']);
  expect(result).toMatchObject({
    decision: 'reported',
    reasons: expect.arrayContaining(['pr-list:fail', 'project-coverage:unknown', 'flagged-reply']),
    report: {
      runId: id,
      observedAt: fixture.input.observedAt,
      coverage: { projects: 'unknown', discovery: 'pass' },
      continuity: { sourceSha: hash(fixture.progress), prior: fixture.input.prior.thread.threadId },
      holds: { count: 1, flagged: [{ threadId: fixture.flaggedId, status: 'reply' }] },
      reap: { status: 'pass', exitCode: 0, dockerAvailable: true },
      prs: [fixture.pr],
    },
  });
  expect(result.report.terms).toHaveLength(12);
  expect(result.report.terms).toContainEqual({ id: 'pr-list', status: 'fail' });
  expect(result.report.terms).toContainEqual({ id: 'continuity', status: 'pass' });
  expect(JSON.stringify(result.report)).not.toMatch(/INJECTED|Open holds|one reply/i);
});

test('a quiet report includes archived facts without starting an agent', async () => {
  const { result, agents } = await replay();
  expect(agents).toEqual([]);
  expect(result).toMatchObject({ decision: 'quiet', reasons: [], report: { holds: { count: 0 } } });
  expect(result.report.terms.every((term) => term.status === 'pass')).toBe(true);
});

test('a report retains unknown facts and the absence of a reap receipt', async () => {
  const { result } = await replay({ noReap: true, quietMissing: true, coverage: 'unknown' });
  expect(result).toMatchObject({ decision: 'reported', report: {
    terms: [], holds: { count: null }, reap: { status: 'unknown', exitCode: null, dockerAvailable: null },
  } });
});


test('active all-pass tick skips the agent and keeps continuity out of the store', async () => {
  const { result, agents, values, calls, fixture } = await replay({ mode: 'active' });
  expect(result).toMatchObject({ decision: 'quiet', mode: 'active', reasons: [] });
  expect(agents).toEqual([]);
  expect([...values.keys()]).toEqual([prefix + ':latest-slot']);
  expect(calls).toContainEqual(['helper-input', fixture.progress]);
});

test('the next active tick reads continuity written by a workflow manager', async () => {
  const run = await replay({ mode: 'active', workflowOwned: true });
  expect(run.result).toEqual({ decision: 'quiet', mode: 'active', reasons: [] });
  expect(run.calls).toContainEqual(['helper-input', run.fixture.progress]);
  expect(run.agents).toEqual([]);
});

for (const [facts, reason] of [[{ coverage: 'unknown' }, 'project-coverage:unknown'], [{ reap: true }, 'reap:fail']]) {
  test('active ' + reason + ' starts one full-access manager with a typed receipt', async () => {
    const { result, agents, steps } = await replay({ mode: 'active', ...facts });
    expect(result).toMatchObject({ decision: 'managed', mode: 'active', reasons: [reason], receipt });
    expect(steps).toContain('sandbox-reap');
    expect(agents).toHaveLength(1);
    const { config } = agents[0];
    expect(config).toMatchObject({ ...seat, workspace: { type: 'existing_worktree', worktreePath: '/fixture/checkout' } });
    expect(config.brief.split('\n')[0]).toBe(`AXSTACK-WAKE ${prefix} run ${id}`);
    expect(config.brief).not.toMatch(/INJECTED|PRIVATE|fixture\/repo|fixture\/checkout/);
    expect(config.returns).toMatchObject({ threadId: {}, runId: {}, outcome: ['quiet', 'full', 'held'] });
  });
}

for (const [label, options, step, count] of [
  ['pre-launch binding mismatch', { bindingMismatch: true }, 'manager-launch', 0],
  ['effective binding mismatch', { readbackMismatch: true }, 'manager-readback', 1],
  ['missing receipt', { receipt: null }, 'manager-readback', 1],
  ['malformed receipt', { receipt: { ...receipt, threadId: 'another-thread' } }, 'manager-readback', 1],
  ['held receipt', { receipt: { ...receipt, outcome: 'held' } }, 'manager-readback', 1],
]) {
  test('active ' + label + ' pauses', async () => {
    const { result, agents } = await replay({ mode: 'active', coverage: 'unknown', ...options });
    expect(result).toMatchObject({ decision: 'paused', step });
    expect(agents).toHaveLength(count);
  });
}

test('active duplicate slot pauses before starting a second manager', async () => {
  const first = await replay({ mode: 'active', coverage: 'unknown' });
  expect(first.agents).toHaveLength(1);
  const { result, agents, calls } = await replay({ mode: 'active', values: first.values, runId: other });
  expect(result).toMatchObject({ decision: 'paused', step: 'claim-slot' });
  expect(agents).toEqual([]);
  expect(calls).toEqual([]);
});
