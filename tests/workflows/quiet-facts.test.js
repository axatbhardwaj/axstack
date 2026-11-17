import { expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
const script = `${import.meta.dir}/../../skills/axstack/scripts/schedule-drift.js`;
const fixture = JSON.parse(readFileSync(`${import.meta.dir}/fixtures/quiet-facts/raw.json`, 'utf8'));
const now = '2026-11-17T12:00:00Z';
const progress = `# Review-manager continuity
## Lane state
- threadId: prior
- Active PR jobs and descendants: none
## Open holds
- none
## Watermarks
- Quiet gate: [["org/repo#1","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","2026-11-17T11:00:00Z"]]
- Last full pass: 2026-11-17T11:00:00Z
## Last pass
- No pending work.
`;
function run(change = () => {}, edit = t => t) {
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/quiet-raw-`);
  try {
    const d = structuredClone(fixture); change(d);
    writeFileSync(`${dir}/input.json`, JSON.stringify(d)); writeFileSync(`${dir}/progress.md`, edit(progress));
    const r = Bun.spawnSync([process.execPath, '--no-env-file', script, 'quiet-facts', '--input', `${dir}/input.json`,
      '--continuity', `${dir}/progress.md`, '--now', now], { cwd: '/', stdout: 'pipe', stderr: 'pipe' });
    expect(r.stderr.toString()).toBe('');
    return { code: r.exitCode, ...JSON.parse(r.stdout.toString()) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const status = (r, id) => r.terms.find(t => t.id === id)?.status;
test('raw gh arrays and a T29 inventory plus ONE native prior read can stay quiet', () => {
  const r = run();
  expect(r.code).toBe(0);
  expect(r.terms.every(t => t.status === 'pass')).toBe(true);
  expect(status(r, 'pr-list')).toBe('pass');
  for (const key of ['verdict', 'decision', 'admit', 'quiet', 'full', 'authority']) expect(r).not.toHaveProperty(key);
});
test('running guarded prior is busy, while older held terminal passes are inactive', () => {
  const r = run(d => { d.inventory.value.threads[0].status = 'running'; d.prior.thread.status = 'running';
    d.prior.thread.settled = false; d.inventory.value.threads[0].settled = false; },
    t => t.replace('## Open holds\n- none', '## Open holds\n- prior: held; resume: user decision only'));
  expect(status(r, 'lane-idle')).toBe('fail');
  expect(status(r, 'prior-pass')).toBe('fail');
  const old = run(d => { d.inventory.value.threads.push({ ...d.inventory.value.threads[0], threadId: 'old', settled: false }); d.inventory.value.total++; },
    t => t.replace('## Open holds\n- none', '## Open holds\n- old: held; resume: user decision only'));
  expect(status(old, 'lane-idle')).toBe('pass');
});
test('exactly 1000 consistent raw search results reaches the completeness cap', () => {
  const r = run(d => { d.searches[0] = Array.from({ length: 1000 }, (_, i) => ({ ...d.searches[0][0], number: i + 1 })); });
  expect(status(r, 'discovery')).toBe('unknown');
});
test('ordinary historical incomplete prose is not pending work', () => {
  const r = run(() => {}, t => t.replace('No pending work.', 'The earlier log was incomplete; it was reconciled.'));
  expect(status(r, 'pending-work')).toBe('pass');
});
for (const [name, change, edit, id, expected = 'unknown'] of [
  ['four-hour boundary', () => {}, t => t.replace('Last full pass: 2026-11-17T11', 'Last full pass: 2026-11-17T08'), 'full-pass-age', 'fail'],
  ['future full pass', () => {}, t => t.replace('Last full pass: 2026-11-17T11', 'Last full pass: 2026-11-17T13'), 'full-pass-age', 'fail'],
  ['missing watermark', () => {}, t => t.replace(/- Quiet gate:.*\n/, ''), 'pr-list'],
  ['malformed watermark', () => {}, t => t.replace(/Quiet gate:.*/, 'Quiet gate: broken'), 'pr-list'],
  ['missing full-pass watermark', () => {}, t => t.replace(/- Last full pass:.*\n/, ''), 'full-pass-age'],
  ['missing continuity section', () => {}, t => t.replace('## Last pass', '## Missing'), 'continuity'],
  ['stale observation', d => { d.observedAt = '2026-11-17T11:54:59Z'; }, t => t, 'observations'],
  ['future observation', d => { d.observedAt = '2026-11-17T13:00:00Z'; }, t => t, 'observations'],
  ['future PR timestamp', d => { d.searches[0][0].updatedAt = '2026-11-17T13:00:00Z'; }, t => t, 'discovery'],
  ['missing login', d => { delete d.login; }, t => t, 'discovery'],
  ['failed search', d => { d.searches[1] = { isError: true }; }, t => t, 'discovery'],
  ['missing query', d => { d.searches.pop(); }, t => t, 'discovery'],
  ['duplicate query item', d => { d.searches[0].push(d.searches[0][0]); }, t => t, 'discovery'],
  ['conflicting query observations', d => { d.searches[1][0].updatedAt = '2026-11-17T11:01:00Z'; }, t => t, 'discovery'],
  ['malformed optional head', d => { d.searches[0][0].headRefOid = 'bad'; }, t => t, 'discovery'],
  ['pagination cursor', d => { d.inventory.value.nextCursor = 100; }, t => t, 'ownership'],
  ['native explicit partial result', d => { d.inventory.value.complete = false; }, t => t, 'ownership'],
  ['truncated total', d => { d.inventory.value.total++; }, t => t, 'ownership'],
  ['caller complete cannot replace raw count', d => { d.inventory.complete = true; delete d.inventory.value.total; }, t => t, 'ownership'],
  ['status filter', d => { d.inventory.args.statuses = ['running']; }, t => t, 'ownership'],
  ['settled filter', d => { d.inventory.args.settled = false; }, t => t, 'ownership'],
  ['partial page', d => { d.inventory.args.cursor = 100; }, t => t, 'ownership'],
  ['missing descendants', d => { d.inventory.args.includeSubagents = false; }, t => t, 'ownership'],
  ['self absent from list', d => { d.inventory.value.threads.pop(); d.inventory.value.total--; }, t => t, 'ownership'],
  ['unknown current identity', d => { d.inventory.value.currentThreadId = null; }, t => t, 'identity'],
  ['native project mismatch', d => { d.inventory.args.projectId = 'other'; }, t => t, 'ownership'],
  ['duplicate native thread', d => { d.inventory.value.threads.push(d.inventory.value.threads[0]); d.inventory.value.total++; }, t => t, 'ownership'],
  ['cyclic ancestry', d => { d.inventory.value.threads[0].parentThreadId = 'self'; d.inventory.value.threads[1].parentThreadId = 'prior'; }, t => t, 'ownership'],
  ['missing prior read', d => { delete d.prior; }, t => t, 'prior-pass'],
  ['unknown prior identity', () => {}, t => t.replace('threadId: prior', 'threadId: missing'), 'ownership'],
  ['missing prior settlement', d => { delete d.prior.thread.settled; }, t => t, 'prior-pass'],
  ['unknown status', d => { d.inventory.value.threads[0].status = 'mystery'; }, t => t, 'thread-readbacks'],
  ['non-native usage status', d => { d.inventory.value.threads[0].status = 'usage-limited'; }, t => t, 'thread-readbacks'],
  ['active jobs', () => {}, t => t.replace('descendants: none', 'descendants: org/repo#8 child'), 'pending-work', 'fail'],
  ['capacity hold', () => {}, t => t.replace('## Open holds\n- none', '## Open holds\n- prior: capacity; resume: capacity available'), 'pending-work', 'fail'],
]) test(name, () => { const r = run(change, edit); expect(status(r, id)).toBe(expected); });
for (const event of ['unserved', 'capacity-deferred', 'INCOMPLETE', 're-eligible']) {
  test(`recorded pending event ${event}`, () => {
    const r = run(() => {}, t => t.replace('## Watermarks', `- org/repo#7; status: ${event}\n## Watermarks`));
    expect(status(r, 'pending-work')).toBe('fail');
  });
}
for (const state of ['preparing', 'queued', 'starting', 'running', 'waiting']) {
  test(`native ${state} overrides stale settled/guard metadata`, () => {
    const r = run(d => { d.inventory.value.threads[0].status = state; },
      t => t.replace('## Open holds\n- none', '## Open holds\n- prior: held; resume: user decision only'));
    expect(status(r, 'lane-idle')).toBe('fail');
  });
}
test('prior settlement is independent of lane liveness and recorded terminal guards', () => {
  expect(status(run(d => { d.prior.thread.settled = false; }), 'prior-pass')).toBe('fail');
  for (const guard of ['held', 'flagged']) {
    const r = run(d => { d.prior.thread.settled = false; }, t => t.replace('## Lane state', `## Lane state\n- prior: ${guard}`));
    expect(status(r, 'prior-pass')).toBe('pass');
  }
  const negative = run(d => { d.prior.thread.settled = false; }, t => t.replace('## Lane state', '## Lane state\n- prior: not held'));
  expect(status(negative, 'prior-pass')).toBe('fail');
});
test('settled prior absent from inventory needs only the existing readback', () => {
  const r = run(d => { d.inventory.value.threads.shift(); d.inventory.value.total--; });
  expect(r.code).toBe(0);
  expect(status(r, 'ownership')).toBe('pass');
});
test('descendant liveness is read from the full native list, not more thread reads', () => {
  const r = run(d => { d.inventory.value.threads.push({ ...d.inventory.value.threads[0], threadId: 'child', parentThreadId: 'prior', status: 'waiting' }); d.inventory.value.total++; });
  expect(status(r, 'lane-idle')).toBe('fail');
  expect(status(r, 'thread-readbacks')).toBe('pass');
});
test('raw MCP packaging is accepted without caller projection', () => {
  const r = run(d => { d.inventory.value = { structuredContent: d.inventory.value }; d.prior = { content: [{ type: 'text', text: JSON.stringify(d.prior) }] }; });
  expect(r.code).toBe(0);
});
test('new PR outside old fingerprint and changed or removed PRs force reconciliation', () => {
  for (const change of [
    d => { d.searches[1].push({ ...d.searches[1][0], number: 2 }); },
    d => { d.searches = d.searches.map(rows => rows.map(pr => ({ ...pr, updatedAt: '2026-11-17T11:01:00Z' }))); },
    d => { d.searches = [[], []]; },
    d => { for (const rows of d.searches) rows[0].headRefOid = 'b'.repeat(40); },
  ]) expect(status(run(change), 'pr-list')).toBe('fail');
});
test('raw search filters self-authored, draft and closed entries', () => {
  const r = run(d => { d.searches[0].push({ ...d.searches[0][0], number: 2, author: { login: 'me' } },
    { ...d.searches[0][0], number: 3, isDraft: true }, { ...d.searches[0][0], number: 4, state: 'closed' }); });
  expect(status(r, 'discovery')).toBe('pass'); expect(status(r, 'pr-list')).toBe('pass');
});
test('native allProjects scope excludes unrelated lanes and includes cross-project descendants', () => {
  const r = run(d => { d.inventory.args = { allProjects: true, includeSubagents: true };
    d.inventory.value.threads.push({ ...d.inventory.value.threads[0], threadId: 'other', projectId: 'other', status: 'running' }); d.inventory.value.total++; });
  expect(status(r, 'lane-idle')).toBe('pass');
  const child = run(d => { d.inventory.args = { allProjects: true, includeSubagents: true };
    d.inventory.value.threads.push({ ...d.inventory.value.threads[0], threadId: 'child', projectId: 'other', parentThreadId: 'prior', status: 'waiting' }); d.inventory.value.total++; });
  expect(status(child, 'lane-idle')).toBe('fail');
});
test('native terminal and idle statuses are observed without invented translations', () => {
  for (const state of ['idle', 'completed', 'failed', 'cancelled', 'interrupted', 'rolled_back']) {
    const r = run(d => { d.inventory.value.threads[0].status = state; });
    expect(status(r, 'lane-idle')).toBe('pass');
  }
});
test('help describes raw outputs, effects, CLI errors, and immutable inputs', () => {
  const help = Bun.spawnSync([process.execPath, '--no-env-file', script, 'quiet-facts', '--help'], { cwd: '/', stdout: 'pipe' });
  expect(help.exitCode).toBe(0);
  for (const text of ['--input', '--continuity', '--now', 'ONE raw t3_thread_read', 'total matching', 'No writes', 'Exit:']) expect(help.stdout.toString()).toContain(text);
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/quiet-raw-readonly-`);
  try {
    writeFileSync(`${dir}/input.json`, 'broken'); writeFileSync(`${dir}/progress.md`, progress);
    const r = Bun.spawnSync([process.execPath, '--no-env-file', script, 'quiet-facts', '--input', `${dir}/input.json`,
      '--continuity', `${dir}/progress.md`, '--now', now], { cwd: '/', stdout: 'pipe' });
    expect(r.exitCode).toBe(2);
    expect(readFileSync(`${dir}/input.json`, 'utf8')).toBe('broken'); expect(readFileSync(`${dir}/progress.md`, 'utf8')).toBe(progress);
    expect(readdirSync(dir).sort()).toEqual(['input.json', 'progress.md']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const bad = Bun.spawnSync([process.execPath, '--no-env-file', script, 'quiet-facts', '--repo', 'wrong'], { cwd: '/', stdout: 'pipe', stderr: 'pipe' });
  expect(bad.exitCode).toBe(1);
});
test('reap executes before collecting or deciding quiet facts', () => {
  const prompt = readFileSync(`${import.meta.dir}/../../skills/axstack/references/review-manager-prompt.md`, 'utf8');
  expect(prompt.indexOf('[Sandbox reap]')).toBeLessThan(prompt.indexOf('schedule-drift.js quiet-facts'));
  expect(prompt).toContain('schedule-drift.js quiet-facts');
});

test('known busy native lane is measured even when prior read is missing', () => {
  const r = run(d => { d.inventory.value.threads[0].status = 'running'; delete d.prior; });
  expect(status(r, 'lane-idle')).toBe('fail');
  expect(status(r, 'prior-pass')).toBe('unknown');
});
test('a known running thread stays busy alongside another unknown status', () => {
  const r = run(d => { d.inventory.value.threads[0].status = 'running';
    d.inventory.value.threads.push({ ...d.inventory.value.threads[0], threadId: 'unknown-child', parentThreadId: 'prior', status: 'mystery' });
    d.inventory.value.total++; });
  expect(status(r, 'lane-idle')).toBe('fail');
  expect(status(r, 'ownership')).toBe('unknown');
});
