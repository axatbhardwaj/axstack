import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const script = `${import.meta.dir}/../../skills/axstack/scripts/lane-owner.js`;
const statuses = ['idle', 'preparing', 'queued', 'starting', 'running', 'waiting'];
const owner = (changes = {}) => ({ threadId: 'pass', latestRunId: 'run-1', projectId: 'lane',
  parentThreadId: null, status: 'completed', settled: true, ...changes });
const job = (changes = {}) => owner({ threadId: 'job', latestRunId: 'review-1', parentThreadId: 'pass', ...changes });
const list = (threads, filter) => ({ args: { projectId: 'lane', includeSubagents: true, ...filter },
  value: { threads, nextCursor: null, total: threads.length } });
const read = thread => ({ args: { threadId: thread.threadId }, value: { thread,
  recentRuns: [{ runId: thread.latestRunId, status: thread.status }], hasMore: true } });
const saved = (threads = [], readbacks = [read(owner())]) => ({ preSettle: true,
  ...list(threads.filter(t => statuses.includes(t.status)), { statuses }),
  unsettled: list(threads.filter(t => t.settled === false), { settled: false }), readbacks });
function drive(input, jobs = []) {
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/lane-owner-scoped-`);
  try {
    const path = `${dir}/snapshot.json`, bytes = JSON.stringify(input);
    writeFileSync(path, bytes);
    const result = Bun.spawnSync([process.execPath, '--no-env-file', script, '--input', path,
      '--owner-thread', 'pass', '--owner-run', 'run-1', ...jobs.flatMap(id => ['--job-thread', id])], { cwd: '/' });
    expect(readFileSync(path, 'utf8')).toBe(bytes);
    expect(readdirSync(dir)).toEqual(['snapshot.json']);
    return { exit: result.exitCode, terms: JSON.parse(result.stdout.toString()).terms };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const status = (result, id) => result.terms.find(t => t.id === id)?.status;
const unknown = (input, jobs = []) => {
  const result = drive(input, jobs);
  expect(result.exit).toBe(2);
  expect(result.terms.every(t => t.status === 'unknown')).toBe(true);
};

test('scoped views plus owner and recorded-job readbacks prove a settled lane without history', () => {
  const result = drive(saved([], [read(owner()), read(job({ parentThreadId: null }))]), ['job']);
  expect(result.exit).toBe(0);
  expect(result.terms.every(t => t.status === 'pass')).toBe(true);
});

test('owner readback cannot hide a live or resumed owner absent from filtered lists', () => {
  const result = drive(saved([], [read(owner({ latestRunId: 'resumed', status: 'running', settled: true }))]));
  expect(result.exit).toBe(0);
  expect(status(result, 'owner.run')).toBe('fail');
  expect(status(result, 'owner.inactive')).toBe('fail');
});

test('nonterminal view catches live settled descendants through terminal ancestors newest first', () => {
  const leaf = job({ threadId: 'leaf', parentThreadId: 'job', status: 'waiting', settled: true });
  const result = drive(saved([leaf], [read(job()), read(owner())]));
  expect(result.exit).toBe(0);
  expect(status(result, 'jobs.inactive')).toBe('fail');
  expect(JSON.stringify(result.terms)).toContain('leaf');
});

test('unsettled view retains terminal descendants whose release is uncertain', () => {
  const result = drive(saved([job({ settled: false })]));
  expect(result.exit).toBe(2);
  expect(status(result, 'owner.inactive')).toBe('pass');
  expect(status(result, 'jobs.inactive')).toBe('unknown');
});

test('unrelated rooted activity permits facts, but missing ancestry holds until read back', () => {
  const unrelated = job({ threadId: 'other', parentThreadId: 'root', status: 'idle', settled: false });
  unknown(saved([unrelated]));
  const result = drive(saved([unrelated], [read(owner()), read(job({ threadId: 'root', parentThreadId: null }))]));
  expect(result.exit).toBe(0);
  expect(status(result, 'jobs.inactive')).toBe('n/a');
});

test('idle owner, incomplete settled metadata and missing latest run remain unknown', () => {
  for (const change of [r => { r.value.thread.settled = undefined; },
    r => { r.value.thread.latestRunId = null; }, r => { r.value.recentRuns = []; },
    r => { r.value.recentRuns[0].status = 'running'; }]) {
    const input = saved(); change(input.readbacks[0]);
    expect(drive(input).exit).toBe(2);
  }
  const result = drive(saved([], [read(owner({ status: 'idle', settled: false }))]));
  expect(status(result, 'owner.inactive')).toBe('unknown');
});

for (const [name, change] of [
  ['nonterminal page gap', s => { s.value.nextCursor = 1; }],
  ['unsettled page gap', s => { s.unsettled.value.nextCursor = 1; }],
  ['nonterminal count', s => { s.value.total++; }],
  ['unsettled count', s => { s.unsettled.value.total++; }],
  ['truncated', s => { s.value.truncated = true; }],
  ['unsettled error', s => { s.unsettled.isError = true; }],
  ['missing unsettled view', s => { delete s.unsettled; }],
  ['missing idle status', s => { s.args.statuses = statuses.slice(1); }],
  ['extra terminal status', s => { s.args.statuses = [...statuses, 'completed']; }],
  ['duplicate status', s => { s.args.statuses = [...statuses, 'idle']; }],
  ['extra filter', s => { s.args.settled = false; }],
  ['unsettled status filter', s => { s.unsettled.args.statuses = statuses; }],
  ['unsettled settled filter', s => { s.unsettled.args.settled = true; }],
  ['unsettled cursor', s => { s.unsettled.args.cursor = 10; }],
  ['unsettled scope', s => { s.unsettled.args.projectId = 'other'; }],
  ['missing owner readback', s => { s.readbacks = []; }],
  ['readback identity', s => { s.readbacks[0].args.threadId = 'other'; }],
  ['readback error', s => { s.readbacks[0].isError = true; }],
  ['readback truncated', s => { s.readbacks[0].value.truncated = true; }],
  ['duplicate readback', s => { s.readbacks.push(s.readbacks[0]); }],
  ['foreign project', s => { s.readbacks[0].value.thread.projectId = 'other'; }],
  ['missing pre-settle', s => { delete s.preSettle; }],
]) {
  test(`scoped ${name} preserves unknown`, () => { const input = saved(); change(input); unknown(input); });
}

test('every recorded job needs a readback even when it appears in a scoped list', () => {
  unknown(saved([job({ status: 'running', settled: false })]), ['job']);
});

test('conflicting list/readback facts and cross-view duplicates never prove release', () => {
  const row = owner({ status: 'running', settled: false });
  unknown(saved([row]));
  const input = saved([row], [read(row)]); input.unsettled.value.threads[0] = { ...row, latestRunId: 'changed' };
  unknown(input);
});

test('cycles through readback ancestors and malformed filter rows stay unknown', () => {
  unknown(saved([job({ parentThreadId: 'other', status: 'running', settled: false })],
    [read(owner()), read(job({ threadId: 'other', parentThreadId: 'job' }))]));
  const input = saved(); input.value.threads = [owner()]; input.value.total = 1;
  unknown(input);
});
