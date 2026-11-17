import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const script = `${import.meta.dir}/../../skills/axstack/scripts/lane-owner.js`;
const owner = (changes = {}) => ({ threadId: 'pass', latestRunId: 'run-1', projectId: 'lane',
  parentThreadId: null, status: 'completed', settled: true, ...changes });
const job = (changes = {}) => owner({ threadId: 'job', latestRunId: 'review-1', parentThreadId: 'pass', ...changes });
const saved = (threads) => ({ preSettle: true, args: { projectId: 'lane', includeSubagents: true },
  value: { threads, nextCursor: null, total: threads.length } });
function drive(input, extra = []) {
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/lane-owner-`);
  try {
    const path = `${dir}/snapshot.json`, bytes = JSON.stringify(input);
    writeFileSync(path, bytes);
    const result = Bun.spawnSync([process.execPath, '--no-env-file', script, '--input', path,
      '--owner-thread', 'pass', '--owner-run', 'run-1', ...extra], { cwd: '/', env: process.env });
    expect(readFileSync(path, 'utf8')).toBe(bytes);
    expect(readdirSync(dir)).toEqual(['snapshot.json']);
    return { exit: result.exitCode, report: JSON.parse(result.stdout.toString()) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const status = (result, id) => result.report.terms.find(t => t.id === id)?.status;

test('live earlier pass blocks inactivity while a settled tree is measured inactive', () => {
  const live = drive(saved([job(), owner({ status: 'running', settled: false })]));
  expect(live.exit).toBe(0);
  expect(status(live, 'owner.inactive')).toBe('fail');
  expect(status(live, 'owner.run')).toBe('pass');
  const settled = drive(saved([job(), owner()]));
  expect(settled.exit).toBe(0);
  expect(settled.report.terms.every(t => t.status === 'pass')).toBe(true);
  expect(settled.report.input.sha256).toMatch(/^[a-f0-9]{64}$/);
});

test('a terminal owner cannot hide live review jobs or grandchildren', () => {
  const result = drive(saved([job({ threadId: 'reviewer', parentThreadId: 'job', status: 'waiting', settled: false }), job(), owner()]));
  expect(status(result, 'owner.inactive')).toBe('pass');
  expect(status(result, 'jobs.inactive')).toBe('fail');
  expect(JSON.stringify(result.report.terms)).toContain('reviewer');
});

test('resumed usage-limited pass uses current run, not historical failure or settled bit', () => {
  const result = drive(saved([owner({ latestRunId: 'resumed-run', status: 'running', settled: true,
    recentRuns: [{ runId: 'run-1', status: 'failed', error: 'usage_limit' }] })]));
  expect(result.exit).toBe(0);
  expect(status(result, 'owner.run')).toBe('fail');
  expect(status(result, 'owner.inactive')).toBe('fail');
  expect(JSON.stringify(result.report.terms)).toContain('resumed-run');
});

for (const statusName of ['preparing', 'queued', 'starting', 'running', 'waiting']) {
  test(`native ${statusName} remains active`, () => {
    const result = drive(saved([owner({ status: statusName, settled: false })]));
    expect(status(result, 'owner.inactive')).toBe('fail');
  });
}
for (const statusName of ['completed', 'interrupted', 'failed', 'cancelled', 'rolled_back']) {
  test(`settled native ${statusName} is inactive; unsettled run is uncertain`, () => {
    expect(status(drive(saved([owner({ status: statusName })])), 'owner.inactive')).toBe('pass');
    expect(status(drive(saved([owner({ status: statusName, settled: false })])), 'owner.inactive')).toBe('unknown');
  });
}

test('idle usage-limited owner and unknown status preserve uncertainty', () => {
  for (const state of ['idle', 'usage_limited', 'future-state']) {
    const result = drive(saved([owner({ status: state, settled: false })]));
    expect(result.exit).toBe(2);
    expect(status(result, 'owner.inactive')).toBe('unknown');
  }
});

for (const change of [
  s => { s.value.nextCursor = 20; }, s => { s.value.total = 99; },
  s => { s.value.truncated = true; }, s => { s.value.hasMore = true; },
  s => { delete s.value.nextCursor; }, s => { s.args.includeSubagents = false; },
  s => { s.args.statuses = ['completed']; }, s => { s.args.settled = true; },
  s => { s.args.snoozed = false; }, s => { s.args.titleContains = 'manager'; },
  s => { s.args.cursor = 10; }, s => { s.args.projectId = 'other'; },
  s => { s.value.threads.push(owner()); s.value.total++; },
  s => { delete s.value.threads[0].parentThreadId; }, s => { s.isError = true; },
]) {
  test('truncated, filtered or malformed inventory never proves release', () => {
    const input = saved([job(), owner()]); change(input);
    const result = drive(input);
    expect(result.exit).toBe(2);
    expect(result.report.terms.every(t => t.status === 'unknown')).toBe(true);
  });
}

test('missing owner or explicitly recorded detached job remains unknown', () => {
  expect(status(drive(saved([job()])), 'owner.inactive')).toBe('unknown');
  expect(status(drive(saved([owner()]), ['--job-thread', 'missing']), 'jobs.inactive')).toBe('unknown');
  const result = drive(saved([owner(), job({ parentThreadId: null, status: 'running', settled: false })]), ['--job-thread', 'job']);
  expect(status(result, 'jobs.inactive')).toBe('fail');
});

test('complete all-project inventory accepts a childless settled owner', () => {
  const input = saved([owner()]); input.args = { allProjects: true, includeSubagents: true };
  const result = drive(input);
  expect(result.exit).toBe(0);
  expect(status(result, 'jobs.inactive')).toBe('n/a');
});

test('CLI help, invalid invocation, malformed JSON and missing file have distinct exits', () => {
  const call = (...args) => Bun.spawnSync([process.execPath, '--no-env-file', script, ...args], { cwd: '/' });
  expect(call('--help').exitCode).toBe(0);
  expect(call('--bad').exitCode).toBe(1);
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/lane-owner-cli-`);
  try {
    const path = `${dir}/invalid.json`;
    writeFileSync(path, '{');
    expect(call('--input', path, '--owner-thread', 'pass', '--owner-run', 'run-1').exitCode).toBe(1);
    expect(call('--input', `${dir}/missing`, '--owner-thread', 'pass', '--owner-run', 'run-1').exitCode).toBe(2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});


test('cyclic ancestry preserves unknown rather than accepting settled metadata', () => {
  const result = drive(saved([job({ parentThreadId: 'other' }), job({ threadId: 'other', parentThreadId: 'job' }), owner()]));
  expect(result.exit).toBe(2);
  expect(result.report.terms.every(t => t.status === 'unknown')).toBe(true);
});

test('a settled review job without latestRunId cannot prove inactivity', () => {
  const result = drive(saved([job({ latestRunId: null }), owner()]));
  expect(result.exit).toBe(2);
  expect(status(result, 'owner.run')).toBe('pass');
  expect(status(result, 'jobs.inactive')).toBe('unknown');
});

test('a foreign-project child in a project-filtered snapshot makes coverage unknown', () => {
  const result = drive(saved([job({ projectId: 'other' }), owner()]));
  expect(result.exit).toBe(2);
  expect(result.report.terms.every(t => t.status === 'unknown')).toBe(true);
});

for (const state of ['completed', 'failed']) {
  test(`a ${state} snapshot marked post-settle remains unknown`, () => {
    const input = saved([owner({ status: state })]);
    input.preSettle = false; // This timing assertion carries no settlement-writer identity.
    const result = drive(input);
    expect(result.exit).toBe(2);
    expect(result.report.terms.every(t => t.status === 'unknown')).toBe(true);
  });
}

test('an unasserted snapshot cannot prove pre-settle ownership facts', () => {
  const input = saved([owner()]); delete input.preSettle;
  const result = drive(input);
  expect(result.exit).toBe(2);
  expect(result.report.terms.every(t => t.status === 'unknown')).toBe(true);
});


test('a terminal owner without settled metadata cannot read inactive', () => {
  const row = owner(); delete row.settled;
  const result = drive(saved([row]));
  expect(result.exit).toBe(2);
  expect(status(result, 'owner.inactive')).toBe('unknown');
});

test('truthy non-true preSettle assertions remain unknown', () => {
  for (const value of ['true', 1, {}]) {
    const input = saved([owner()]); input.preSettle = value;
    const result = drive(input);
    expect(result.exit).toBe(2);
    expect(result.report.terms.every(t => t.status === 'unknown')).toBe(true);
  }
});
