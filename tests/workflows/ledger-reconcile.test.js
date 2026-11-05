import { afterAll, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';

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

test('same-key rows without an evidence path are listed as incomplete rows, not missing rows', () => {
  for (const incomplete of [
    '| uiv6 | verifier | codex | done |',
    '| uiv6 | explainer | artifacts/uiv6/ | done |',
  ]) {
    const dir = fixture(row + incomplete + '\n');
    const result = run('--run-dir', dir);
    const report = JSON.parse(result.stdout.toString());
    expect(result.exitCode).toBe(2);
    expect(report.dispatches).toContainEqual({ key: 'uiv6', evidenceKey: null });
    expect(report.terms).toContainEqual({ key: 'uiv6', status: 'fail',
      evidence: 'dispatch row uiv6 has no evidence path' });
  }
});

test('verification recipe limits its preservation proof to the listing and record', () => {
  const source = sentences(readFileSync(`${import.meta.dir}/../../.agents/skills/verify-axstack/features/reports.md`, 'utf8')).join('. ');
  checkRule(source, (text) => requires(text, /fixtures prove/i, /unchanged directory listing and record bytes/i),
    'The fixtures prove unchanged directory listing and record bytes, plus exit codes.',
    [[/directory listing and record bytes/i, 'all run bytes']]);
});

test('a same-key row pointing to another folder names the mismatched path', () => {
  const dir = fixture(row + '| uiv6 | verifier | evidence/review/ | done |\n');
  const report = JSON.parse(run('--run-dir', dir).stdout.toString());
  expect(report.terms).toContainEqual({ key: 'uiv6', status: 'fail',
    evidence: 'dispatch row uiv6 points to evidence/review/ instead of evidence/uiv6/' });
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
