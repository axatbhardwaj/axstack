import { expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const script = `${import.meta.dir}/../../skills/axstack/scripts/schedule-drift.js`;
const now = '2026-11-17T12:00:00Z';
const lane = { environmentId: 'vps', projectId: 'review', laneId: 'peer' };
const pr = (number = 1) => ({ number, repository: { nameWithOwner: 'org/repo' },
  author: { login: 'peer' }, state: 'open', isDraft: false, updatedAt: '2026-11-17T11:00:00Z' });
const guards = () => ({ held: false, flagged: false, ownedWatch: false, pendingReceipt: false,
  wedged: false, stalledOwner: false, protected: false });
const thread = (threadId, settled = true) => ({ ...lane, threadId, settled,
  latestRun: { status: settled ? 'completed' : 'running' }, guards: guards(), descendantIds: [] });
function fixture() {
  const threads = [thread('prior'), thread('self', false)];
  return { version: 1, observedAt: now, repository: 'org/repo', project: { projectId: 'review', repository: 'org/repo' }, lane, selfThreadId: 'self', login: 'me',
    reap: { exitCode: 0, dockerAvailable: true },
    searches: ['review-requested:@me', 'involves:@me'].map(query => ({ query,
      pages: [{ page: 1, total_count: 1, incomplete_results: false, items: [pr()] }] })),
    heads: [{ repository: 'org/repo', number: 1, headRefOid: 'a'.repeat(40) }],
    inventory: { complete: true, pages: [{ threads, nextCursor: null }] }, readbacks: structuredClone(threads),
  };
}
const progress = () => `# Review-manager continuity
## Lane state
- threadId: prior
- Active PR jobs and descendants: none
## Open holds
- none
## Watermarks
- Quiet gate: ${JSON.stringify([['org/repo#1', 'a'.repeat(40), '2026-11-17T11:00:00Z']])}
- Last full pass: 2026-11-17T11:00:00Z
## Last pass
- No pending work.
`;
function run(change = () => {}, edit = text => text) {
  const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/quiet-facts-`);
  try {
    const input = fixture(); change(input);
    writeFileSync(`${root}/input.json`, JSON.stringify(input));
    writeFileSync(`${root}/progress.md`, edit(progress()));
    const result = Bun.spawnSync([process.execPath, '--no-env-file', script, 'quiet-facts',
      '--input', `${root}/input.json`, '--continuity', `${root}/progress.md`, '--now', now],
    { cwd: '/', stdout: 'pipe', stderr: 'pipe' });
    expect(result.stderr.toString()).toBe('');
    return { code: result.exitCode, report: JSON.parse(result.stdout.toString()) };
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const status = (result, id) => result.report.terms.find(t => t.id === id)?.status;

test('discovers a new PR outside the old watermark from the full search union', () => {
  const result = run(d => {
    d.searches[1].pages[0].items.push(pr(2)); d.searches[1].pages[0].total_count = 2;
    d.heads.push({ repository: 'org/repo', number: 2, headRefOid: 'b'.repeat(40) });
  });
  expect(status(result, 'pr-list')).toBe('fail');
  expect(result.code).toBe(0);
});

test('complete unchanged facts grant no authority or aggregate decision', () => {
  const result = run();
  expect(result.code).toBe(0);
  expect(result.report.terms.length).toBeGreaterThan(8);
  expect(result.report.terms.every(t => t.status === 'pass' && t.evidence)).toBe(true);
  for (const key of ['verdict', 'decision', 'admit', 'quiet', 'full', 'authority']) expect(result.report).not.toHaveProperty(key);
});
for (const [name, change, edit, id, expected = 'unknown'] of [
  ['stale full pass', () => {}, t => t.replace('Last full pass: 2026-11-17T11', 'Last full pass: 2026-11-17T08'), 'full-pass-age', 'fail'],
  ['future full pass', () => {}, t => t.replace('Last full pass: 2026-11-17T11', 'Last full pass: 2026-11-17T13'), 'full-pass-age', 'fail'],
  ['missing watermark', () => {}, t => t.replace(/- Quiet gate:.*\n/, ''), 'pr-list'],
  ['missing full-pass watermark', () => {}, t => t.replace(/- Last full pass:.*\n/, ''), 'full-pass-age'],
  ['malformed watermark', () => {}, t => t.replace(/Quiet gate:.*/, 'Quiet gate: broken'), 'pr-list'],
  ['missing continuity section', () => {}, t => t.replace('## Last pass', '## Missing'), 'continuity'],
  ['pagination failure', d => { d.searches[1].pages[0].incomplete_results = true; }, t => t, 'discovery'],
  ['omitted search page', d => { d.searches[0].pages[0].total_count = 2; }, t => t, 'discovery'],
  ['omitted query', d => { d.searches.pop(); }, t => t, 'discovery'],
  ['search cap', d => { d.searches[0].pages[0].total_count = 1000; }, t => t, 'discovery'],
  ['failed call', d => { d.searches[0].error = 'offline'; }, t => t, 'discovery'],
  ['missing head', d => { d.heads = []; }, t => t, 'discovery'],
  ['future observation', d => { d.observedAt = '2026-11-17T13:00:00Z'; }, t => t, 'observations'],
  ['stale observation', d => { d.observedAt = '2026-11-17T11:54:59Z'; }, t => t, 'observations'],
  ['unknown ownership', d => { delete d.readbacks[0].laneId; }, t => t, 'ownership'],
  ['missing readback', d => { d.readbacks.pop(); }, t => t, 'ownership'],
  ['unknown prior identity', () => {}, t => t.replace('threadId: prior', 'threadId: missing'), 'prior-pass'],
  ['truncated native inventory', d => { d.inventory.complete = false; }, t => t, 'ownership'],
  ['unknown run state', d => { d.readbacks[0].latestRun.status = 'mystery'; }, t => t, 'thread-readbacks'],
  ['unknown guard', d => { delete d.readbacks[0].guards.held; }, t => t, 'prior-pass'],
  ['reap failure', d => { d.reap.exitCode = 2; }, t => t, 'reap', 'fail'],
  ['missing Docker', d => { d.reap.dockerAvailable = false; }, t => t, 'reap', 'fail'],
  ['unresolved hold', () => {}, t => t.replace('## Open holds\n- none', '## Open holds\n- PR: capacity; resume: capacity available'), 'pending-work', 'fail'],
  ['unserved event', () => {}, t => t.replace('No pending work.', 'unserved org/repo#7'), 'pending-work', 'fail'],
  ['deferred event', () => {}, t => t.replace('No pending work.', 'capacity-deferred org/repo#7'), 'pending-work', 'fail'],
  ['incomplete event', () => {}, t => t.replace('No pending work.', 'INCOMPLETE org/repo#7'), 'pending-work', 'fail'],
  ['re-eligible event', () => {}, t => t.replace('No pending work.', 're-eligible org/repo#7'), 'pending-work', 'fail'],
]) {
  test(name, () => {
    const result = run(change, edit);
    expect(status(result, id)).toBe(expected);
    expect(result.code).toBe(expected === 'unknown' ? 2 : 0);
  });
}
test('nonterminal descendants cannot disappear behind a guarded prior pass', () => {
  const result = run(d => {
    const child = thread('child', false); child.parentThreadId = 'prior';
    for (const rows of [d.inventory.pages[0].threads, d.readbacks]) {
      rows[0].settled = false; rows[0].guards.held = true; rows[0].descendantIds = ['child']; rows.push(child);
    }
  });
  expect(status(result, 'lane-idle')).toBe('fail');
});
test('a recorded descendant absent from native inventory is unknown', () => {
  expect(status(run(d => { d.readbacks[0].descendantIds = ['missing']; }), 'thread-readbacks')).toBe('unknown');
});
test('unguarded unsettled predecessor is measured separately from known ownership', () => {
  const result = run(d => { d.readbacks[0].settled = false; });
  expect(status(result, 'prior-pass')).toBe('fail');
  expect(status(result, 'ownership')).toBe('pass');
});
test('guarded held/flagged predecessor and user-only hold stay observable without busy facts', () => {
  for (const flag of ['held', 'flagged', 'ownedWatch', 'pendingReceipt', 'wedged', 'stalledOwner', 'protected']) {
    const result = run(d => { d.readbacks[0].settled = false; d.readbacks[0].guards[flag] = true; },
      t => t.replace('## Open holds\n- none', '## Open holds\n- PR: waiting; resume: user decision only'));
    expect(status(result, 'prior-pass')).toBe('pass');
    expect(status(result, 'pending-work')).toBe('pass');
    expect(status(result, 'lane-idle')).toBe('pass');
  }
});
test('filters self-authored, draft and closed PRs while retaining new repositories', () => {
  const result = run(d => {
    d.searches[0].pages[0].items = [pr(), { ...pr(2), author: { login: 'me' } },
      { ...pr(3), isDraft: true }, { ...pr(4), state: 'closed' }];
    d.searches[0].pages[0].total_count = 4;
  });
  expect(status(result, 'discovery')).toBe('pass');
  expect(status(result, 'pr-list')).toBe('pass');
  const other = run(d => {
    d.searches[1].pages[0].items = [{ ...pr(1), repository: { nameWithOwner: 'other/repo' } }];
    d.heads.push({ repository: 'other/repo', number: 1, headRefOid: 'b'.repeat(40) });
  });
  expect(status(other, 'pr-list')).toBe('fail');
});
test('command help describes saved input schema, effects and exits', () => {
  const result = Bun.spawnSync([process.execPath, '--no-env-file', script, 'quiet-facts', '--help'], { cwd: '/', stdout: 'pipe' });
  expect(result.exitCode).toBe(0);
  for (const text of ['--input', '--continuity', '--now', 'descendantIds', 'total_count', 'No writes', 'Exit:']) expect(result.stdout.toString()).toContain(text);
});
test('reap remains before the fact gate (host policy bytes have their own keeper)', () => {
  const prompt = readFileSync(`${import.meta.dir}/../../skills/axstack/references/review-manager-prompt.md`, 'utf8');
  expect(prompt.indexOf('[Sandbox reap]')).toBeLessThan(prompt.indexOf('schedule-drift.js quiet-facts'));
  expect(prompt).toContain('schedule-drift.js quiet-facts');
});

test('unknown recorded prior identity also keeps competing ownership unknown', () => {
  const result = run(() => {}, t => t.replace('threadId: prior', 'threadId: missing'));
  expect(status(result, 'ownership')).toBe('unknown');
});
test('repository identity must agree with the saved native project binding', () => {
  const result = run(d => { d.project = { projectId: 'review', repository: 'different/repo' }; });
  expect(status(result, 'identity')).toBe('fail');
  expect(status(result, 'ownership')).toBe('unknown');
});
test('malformed or duplicate tuple identities remain unknown', () => {
  for (const tuple of [JSON.stringify([['bogus', 'head', 'time']]),
    JSON.stringify([['org/repo#1', 'a'.repeat(40), '2026-11-17T11:00:00Z'], ['org/repo#1', 'a'.repeat(40), '2026-11-17T11:00:00Z']])]) {
    expect(status(run(() => {}, t => t.replace(/Quiet gate:.*/, `Quiet gate: ${tuple}`)), 'pr-list')).toBe('unknown');
  }
});
test('cursor gaps and duplicate native identities keep ownership incomplete', () => {
  for (const change of [
    d => { d.inventory.pages[0].nextCursor = 'more'; },
    d => { d.inventory.pages.push({ cursor: 'skipped', threads: [], nextCursor: null }); },
    d => { d.readbacks.push(d.readbacks[0]); },
  ]) expect(status(run(change), 'ownership')).toBe('unknown');
});

test('unknown liveness also preserves the competing-admission ownership hold', () => {
  const result = run(d => { delete d.readbacks[0].latestRun; });
  expect(status(result, 'ownership')).toBe('unknown');
});

test('same PR with a changed head or updatedAt is measured as changed', () => {
  expect(status(run(d => { d.heads[0].headRefOid = 'b'.repeat(40); }), 'pr-list')).toBe('fail');
  expect(status(run(d => { for (const s of d.searches) s.pages[0].items[0].updatedAt = '2026-11-17T11:01:00Z'; }), 'pr-list')).toBe('fail');
});
test('saved-input mode never changes its inputs or creates state', () => {
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/quiet-facts-readonly-`);
  try {
    writeFileSync(`${dir}/input.json`, 'broken json'); writeFileSync(`${dir}/progress.md`, progress());
    const result = Bun.spawnSync([process.execPath, '--no-env-file', script, 'quiet-facts', '--input', `${dir}/input.json`,
      '--continuity', `${dir}/progress.md`, '--now', now], { cwd: '/', stdout: 'pipe' });
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout.toString()).terms.find(t => t.id === 'discovery').status).toBe('unknown');
    expect(readFileSync(`${dir}/input.json`, 'utf8')).toBe('broken json');
    expect(readFileSync(`${dir}/progress.md`, 'utf8')).toBe(progress());
    expect(readdirSync(dir).sort()).toEqual(['input.json', 'progress.md']);
    const bad = Bun.spawnSync([process.execPath, '--no-env-file', script, 'quiet-facts', '--repo', 'wrong'], { cwd: '/', stdout: 'pipe', stderr: 'pipe' });
    expect(bad.exitCode).toBe(1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
