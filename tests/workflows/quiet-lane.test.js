import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const fixture = JSON.parse(readFileSync(`${import.meta.dir}/fixtures/quiet-facts/raw.json`, 'utf8'));
const active = ['preparing', 'queued', 'starting', 'running', 'waiting'];
// Fill the shipped writer template, rather than maintaining a private reader grammar.
function filledTemplate() {
  const source = readFileSync(`${root}/skills/axstack/references/run-record.md`, 'utf8');
  return source.split('## Review-manager continuity template')[1].split('```markdown\n')[1].split('```')[0]
    .replace('<IDs>', 'schedule-review, prior/prior-run, t3-pass, completed settled')
    .replace('<PR, taskId/childThreadId/runId, owner, revision, state>', 'none')
    .replace(/^- <.*(?:or none>|or write - none\))$/gm, '- none')
    .replace(/^- Quiet gate:.*$/m, '- Quiet gate: [["org/repo#1","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","2026-11-17T11:00:00Z"]]')
    .replace(/^- Last full pass:.*$/m, '- Last full pass: 2026-11-17T11:00:00Z')
    .replace('<UTC time, admitted/settled counts, changed state, evidence pointer>', '2026-11-17T11:30:00Z, 0/0, unchanged, evidence/pass');
}
function run(change = () => {}, edit = s => s) {
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/quiet-lane-`);
  try {
    const input = structuredClone(fixture);
    input.inventory.args.statuses = active;
    input.inventory.value.threads.shift(); input.inventory.value.total--;
    change(input);
    writeFileSync(`${dir}/input.json`, JSON.stringify(input));
    writeFileSync(`${dir}/progress.md`, edit(filledTemplate()));
    const r = Bun.spawnSync([process.execPath, '--no-env-file', `${root}/skills/axstack/scripts/schedule-drift.js`,
      'quiet-facts', '--input', `${dir}/input.json`, '--continuity', `${dir}/progress.md`, '--now', fixture.observedAt], { cwd: '/', stdout: 'pipe', stderr: 'pipe' });
    expect(r.stderr.toString()).toBe('');
    return JSON.parse(r.stdout.toString());
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const status = (r, id) => r.terms.find(t => t.id === id)?.status;
function add(input, row) {
  input.inventory.value.threads.push({ projectId: 'review', parentThreadId: null, status: 'running', ...row });
  input.inventory.value.total++;
}
test('filled continuity template and one fully paged active query can be all pass', () => {
  expect(run().terms.every(t => t.status === 'pass')).toBe(true);
});
test('live-style progress with exact native IDs and a terminal user-only hold can stay quiet', () => {
  const prior = 'thread:project:review:4e13cb64-75f3-4b2c-acbc-baa3c639323f';
  const r = run(d => { d.prior.thread.threadId = prior; d.prior.thread.settled = false; },
    () => readFileSync(`${import.meta.dir}/fixtures/quiet-facts/progress.md`, 'utf8'));
  expect(r.terms.every(t => t.status === 'pass')).toBe(true);
});
test('malformed continuity identities and holds remain unknown', () => {
  for (const edit of [
    s => s.replace('prior/prior-run', 'missing-run'),
    s => s.replace('schedule-review, prior', ', prior'),
    s => s.replace('## Open holds\n- none', '## Open holds\n- malformed'),
  ]) expect(run(() => {}, edit).terms.some(t => t.status === 'unknown')).toBe(true);
});
test('the writer template declares the reader watermark and hold grammar', () => {
  const source = readFileSync(`${root}/skills/axstack/references/run-record.md`, 'utf8').split('## Review-manager continuity template')[1].split('## Compact template')[0];
  expect(source).toMatch(/Quiet gate:[^\n]*JSON[^\n]*headRefOid[^\n]*updatedAt/);
  expect(source).toMatch(/resume: user decision only/);
  expect(source).toMatch(/Last full pass:[^\n]*UTC[^\n]*ISO/);
});
test('prior settlement comes from its read, even when absent from active inventory', () => {
  expect(status(run(), 'prior-pass')).toBe('pass');
  expect(status(run(d => { d.prior.thread.settled = false; }), 'prior-pass')).toBe('fail');
});
test('unrelated native root in the shared project is outside the recorded lane', () => {
  const r = run(d => {
    add(d, { threadId: 'unrelated', createdBy: 'user', creationSource: 'web' });
    add(d, { threadId: 'unrelated-worker', parentThreadId: 'unrelated' });
  });
  expect(status(r, 'lane-idle')).toBe('pass');
  expect(status(r, 'ownership')).toBe('pass');
});
test('an unidentifiable active root in the shared project stays unknown', () => {
  expect(status(run(d => add(d, { threadId: 'maybe-pass' })), 'lane-idle')).toBe('unknown');
  // Live scheduled passes also use createdBy:agent, creationSource:mcp.
  expect(status(run(d => add(d, { threadId: 'maybe-scheduled', createdBy: 'agent', creationSource: 'mcp' })), 'lane-idle')).toBe('unknown');
});
test('recorded scheduled pass and recorded PR-job descendants are lane activity', () => {
  expect(status(run(d => add(d, { threadId: 'prior' })), 'lane-idle')).toBe('fail');
  expect(status(run(d => add(d, { threadId: 'duplicate' }), s => s.replace('## Lane state',
    '## Lane state\n- scheduledTaskId, threadId/runId, workspace and exact terminal receipt: schedule-review, prior/prior-run, t3-pass, completed settled\n- scheduledTaskId, threadId/runId, workspace and exact terminal receipt: schedule-review, duplicate/duplicate-run, t3-other, running')), 'lane-idle')).toBe('fail');
  const r = run(d => { add(d, { threadId: 'child', parentThreadId: 'job-root' }); }, s => s.replace('descendants: none', 'descendants: org/repo#1, task/job-root/job-run, prior, aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, running'));
  expect(status(r, 'lane-idle')).toBe('fail');
});
test('partial active filters, paging and unresolved lineage cannot prove idle', () => {
  for (const change of [
    d => { d.inventory.args.statuses = ['running']; },
    d => { d.inventory.value.nextCursor = 100; },
    d => { d.inventory.value.total++; },
    d => add(d, { threadId: 'orphan', parentThreadId: 'unknown-parent' }),
  ]) expect(status(run(change), 'ownership')).toBe('unknown');
});
test('template user-only hold with punctuation stays quiet; unresolved hold does not', () => {
  const hold = '- prior: held; reason: security; evidence: ev/hold; owner: prior; resume: user decision only.';
  const r = run(d => { d.prior.thread.settled = false; }, s => s.replace('## Open holds\n- none', `## Open holds\n${hold}`));
  expect(status(r, 'prior-pass')).toBe('pass'); expect(status(r, 'pending-work')).toBe('pass');
  expect(status(run(() => {}, s => s.replace('## Open holds\n- none', `## Open holds\n${hold.replace('user decision only.', 'capacity available')}`)), 'pending-work')).toBe('fail');
});
