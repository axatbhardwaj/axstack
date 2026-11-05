import { afterAll, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/ledger-reconcile-`);
afterAll(() => rmSync(root, { recursive: true }));
const script = `${import.meta.dir}/../../skills/axstack/scripts/ledger-reconcile.js`;
const run = (...args) => Bun.spawnSync([process.execPath, script, ...args], { stdout: 'pipe', stderr: 'pipe' });
function fixture(record) {
  const dir = mkdtempSync(`${root}/run-`);
  for (const key of ['review', 'uiv6']) mkdirSync(`${dir}/evidence/${key}`, { recursive: true });
  writeFileSync(`${dir}/run-record.md`, record);
  return dir;
}
const row = '| review-1 | reviewer | codex | request-1 | evidence/review/audit.md | done |\n';

test('missing dispatch row names each unrecorded evidence folder and exits incomplete', () => {
  const dir = fixture(row + 'Prose mentioning evidence/uiv6/ is not a dispatch row.\n');
  const result = run('--run-dir', dir);
  expect(result.exitCode).toBe(2);
  const report = JSON.parse(result.stdout.toString());
  expect(report.folders).toEqual(['review', 'uiv6']);
  expect(report.dispatches).toEqual([{ key: 'review-1', evidenceKey: 'review' }]);
  expect(report.terms).toContainEqual({ key: 'uiv6', status: 'fail', evidence: 'evidence/uiv6/ has no dispatch row' });
  expect(report.summary).toEqual({ pass: 1, fail: 1, unknown: 0, 'n/a': 0 });
});

test('complete ledger accepts table and pipe-delimited list rows without modifying the run', () => {
  const record = row + '- uiv6 | verifier | codex | request-2 | `evidence/uiv6/` | done\n';
  const dir = fixture(record);
  writeFileSync(`${dir}/evidence/notes.txt`, 'not a folder');
  const before = readdirSync(dir, { recursive: true });
  const result = run('--run-dir', dir, '--record', `${dir}/run-record.md`);
  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout.toString());
  expect(report.dispatches.map(({ key }) => key)).toEqual(['review-1', 'uiv6']);
  expect(report.terms.map(({ status }) => status)).toEqual(['pass', 'pass']);
  expect(readdirSync(dir, { recursive: true })).toEqual(before);
  expect(readFileSync(`${dir}/run-record.md`, 'utf8')).toBe(record);
});

test('help discloses flags and read-only behavior; bad inputs and unreadable records error', () => {
  const help = run('--help');
  expect(help.exitCode).toBe(0);
  for (const term of ['--run-dir', '--record', '--help', 'read-only', 'stdout', '0', '1', '2']) {
    expect(help.stdout.toString().toLowerCase()).toContain(term);
  }
  expect(run('--unknown').exitCode).toBe(1);
  expect(run('--run-dir', fixture(row), '--record', `${root}/absent.md`).exitCode).toBe(1);
});
