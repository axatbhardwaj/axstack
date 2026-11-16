import { afterAll, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { inspectEvidence } from '../../skills/axstack/scripts/evidence-inspector.js';
import history from './fixtures/evidence-inspector/history.json';

const temporary = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/axstack-inspector-`);
afterAll(() => rmSync(temporary, { recursive: true }));
const head = 'a'.repeat(40), base = 'b'.repeat(40), repository = 'https://github.com/example/project.git';
const old = '2026-01-01T00:00:00Z', raised = '2026-01-02T00:00:00Z', fresh = '2026-01-03T00:00:00Z';
const hash = text => new Bun.CryptoHasher('sha256').update(text).digest('hex');
function packet() {
  return { schemaVersion: 1, repository, head, base, items: [{ id: 'one', head, base,
    boundary: 'runtime branch', changedAt: old, raisedAt: raised,
    acceptedProofKinds: ['runtime'], sourceScope: 'tracked+untracked-nonignored', previousEvidence: [] }],
  dispositions: [{ id: 'one', head, base, boundary: 'runtime branch', status: 'proved',
    proof: { id: 'new-run', itemId: 'one', kind: 'runtime', observedAt: fresh, receipt: receipt() } }] };
}
function receipt(h = head, b = base, origin = repository) {
  const log = 'sanitized synthetic runtime observation\n';
  const logPath = `${temporary}/${crypto.randomUUID()}.log`;
  writeFileSync(logPath, log);
  const source = { root: '/sanitized/source', repository: origin, head: h, requestedHead: h,
    base: b, dirty: false, snapshot: 'c'.repeat(64) };
  return { schemaVersion: 1, tool: { name: 'check-run', version: '1.0.0' }, argv: ['fixture-command'],
    cwd: '/sanitized/source', repository: origin, requested: { head: h, base: b },
    sourceBefore: source, sourceAfter: structuredClone(source), declaredSnapshot: null,
    snapshotScope: { files: 'tracked+untracked-nonignored' }, sandboxImageDigest: null,
    logPath, logSha256: hash(log), logBytes: Buffer.byteLength(log), exitCode: 0,
    timedOut: false, interrupted: null, omittedBytes: 0, logIncomplete: false };
}
const result = p => inspectEvidence(p).terms[0];

test('new exact-item evidence passes with counts only and no aggregate verdict', () => {
  const report = inspectEvidence(packet());
  expect(report.terms[0]).toMatchObject({ id: 'one', status: 'pass', disposition: 'proved', acceptedProofKinds: ['runtime'] });
  expect(report.summary).toEqual({ pass: 1, fail: 0, unknown: 0, 'n/a': 0 });
  expect(Object.keys(report).sort()).toEqual(['schemaVersion', 'summary', 'terms']);
});

for (const row of history) test(`frozen PR #${row.pr} per-item outcomes`, () => {
  const p = { schemaVersion: 1, repository, head: row.head, base: row.base, items: [], dispositions: [] };
  for (const item of row.items) {
    const q = packet(), original = q.items[0], disposition = q.dispositions[0];
    Object.assign(original, { id: item.id, head: row.head, base: row.base, boundary: item.boundary,
      acceptedProofKinds: [item.kind], previousEvidence: item.reusedFixture ? [{ id: 'old-fixture' }] : [] });
    Object.assign(disposition, { id: item.id, head: row.head, base: row.base, boundary: item.boundary, status: item.status });
    disposition.proof = { id: item.reusedFixture ? 'old-fixture' : `new-${item.id}`, itemId: item.id,
      kind: item.reusedFixture ? 'fixture' : item.kind, observedAt: item.reusedFixture ? old : fresh,
      receipt: item.missingReceipt ? null : receipt(row.head, row.base) };
    p.items.push(original); p.dispositions.push(disposition);
  }
  expect(inspectEvidence(p).terms.map(t => [t.id, t.status])).toEqual(row.items.map(i => [i.id, i.expected]));
});

for (const [name, change, status, reason] of [
  ['open item', p => { p.dispositions[0].status = 'open'; }, 'fail', /open/],
  ['missing disposition', p => { p.dispositions = []; }, 'unknown', /missing/],
  ['duplicate disposition', p => p.dispositions.push(p.dispositions[0]), 'fail', /multiple/],
  ['sibling proof', p => { p.dispositions[0].proof.itemId = 'sibling'; }, 'fail', /another item/],
  ['stale item head', p => { p.items[0].head = base; }, 'fail', /head\/base/],
  ['stale disposition base', p => { p.dispositions[0].base = head; }, 'fail', /head\/base/],
  ['changed boundary', p => { p.dispositions[0].boundary = 'other branch'; }, 'fail', /boundary/],
  ['unsupported proof kind', p => { p.dispositions[0].proof.kind = 'fixture'; }, 'fail', /kind/],
  ['old evidence', p => { p.dispositions[0].proof.observedAt = old; }, 'fail', /predates/],
  ['evidence predates change', p => { p.items[0].changedAt = '2026-01-04T00:00:00Z'; }, 'fail', /predates/],
  ['missing chronology', p => { delete p.dispositions[0].proof.observedAt; }, 'unknown', /chronology/],
  ['reused evidence ID', p => { p.items[0].previousEvidence = [{ id: 'new-run' }]; }, 'fail', /reused/],
  ['renamed reused log', p => { p.items[0].previousEvidence = [{ logSha256: p.dispositions[0].proof.receipt.logSha256 }]; }, 'fail', /reused/],
  ['missing receipt', p => { delete p.dispositions[0].proof.receipt; }, 'unknown', /receipt/],
  ['malformed receipt', p => { p.dispositions[0].proof.receipt = {}; }, 'fail', /receipt/],
  ['wrong repository', p => { p.dispositions[0].proof.receipt.repository = 'other'; }, 'fail', /capture/],
  ['stale capture', p => { p.dispositions[0].proof.receipt.requested.head = base; }, 'fail', /capture/],
  ['source changed', p => { p.dispositions[0].proof.receipt.sourceAfter.snapshot = 'd'.repeat(64); }, 'fail', /capture/],
  ['altered log', p => { p.dispositions[0].proof.receipt.logSha256 = '0'.repeat(64); }, 'fail', /capture/],
  ['unavailable log', p => { p.dispositions[0].proof.receipt.logPath = `${temporary}/absent`; }, 'unknown', /capture/],
  ['timeout', p => { p.dispositions[0].proof.receipt.timedOut = true; }, 'unknown', /capture/],
  ['truncation', p => { p.dispositions[0].proof.receipt.omittedBytes = 10; }, 'unknown', /capture/],
  ['interruption', p => { p.dispositions[0].proof.receipt.interrupted = 'SIGTERM'; }, 'unknown', /capture/],
  ['failed check', p => { p.dispositions[0].proof.receipt.exitCode = 1; }, 'fail', /exit/],
  ['missing snapshot scope', p => { delete p.dispositions[0].proof.receipt.snapshotScope; }, 'unknown', /scope/],
  ['ignored bytes', p => { p.items[0].sourceScope = 'ignored'; }, 'unknown', /ignored/],
  ['unknown disposition', p => { p.dispositions[0].status = 'approved'; }, 'fail', /disposition/],
]) test(name, () => {
  const p = packet(); change(p);
  expect(result(p).status).toBe(status);
  expect(JSON.stringify(result(p).evidence)).toMatch(reason);
});

for (const [status, role] of [['withdrawn-by-reviewer', 'reviewer'], ['user-accepted-unproven', 'user']]) {
  test(`${status} records a distinct disposition without claiming proof`, () => {
    const p = packet(), d = p.dispositions[0];
    d.status = status;
    d.decision = { itemId: 'one', repository, head, base, boundary: d.boundary, role,
      by: 'named-person', at: fresh, reason: 'explicit disposition', reference: 'saved-decision:one' };
    delete d.proof;
    expect(result(p)).toMatchObject({ status: 'pass', disposition: status });
    d.decision.role = role === 'user' ? 'reviewer' : 'author';
    expect(result(p).status).toBe('fail');
    d.decision.role = role; d.decision.itemId = 'sibling';
    expect(result(p).status).toBe('fail');
    delete d.decision;
    expect(result(p).status).toBe('unknown');
  });
}

test('sibling closure cannot close a separate open item', () => {
  const p = packet(); p.items.push({ ...p.items[0], id: 'sibling' });
  expect(inspectEvidence(p).terms.map(t => t.status)).toEqual(['pass', 'unknown']);
});

test('declared expected nonzero exit can describe a successful negative check', () => {
  const p = packet(); p.items[0].expectedExitCode = 2; p.dispositions[0].proof.receipt.exitCode = 2;
  expect(result(p).status).toBe('pass');
});

test('copying a sibling receipt under a new proof ID cannot close a second item', () => {
  const p = packet();
  p.items.push({ ...p.items[0], id: 'sibling' });
  const sibling = structuredClone(p.dispositions[0]);
  sibling.id = 'sibling'; sibling.proof.itemId = 'sibling'; sibling.proof.id = 'renamed-copy';
  p.dispositions.push(sibling);
  expect(inspectEvidence(p).terms.map(t => t.status)).toEqual(['fail', 'fail']);
});

test('one named proof cannot be assigned to multiple items even with separate captures', () => {
  const p = packet();
  p.items.push({ ...p.items[0], id: 'sibling' });
  const sibling = structuredClone(p.dispositions[0]);
  sibling.id = 'sibling'; sibling.proof.itemId = 'sibling'; sibling.proof.receipt = receipt();
  p.dispositions.push(sibling);
  expect(inspectEvidence(p).terms.map(t => t.status)).toEqual(['fail', 'fail']);
});
