import { afterAll, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { gitArgv } from '../../skills/axstack/scripts/git-argv.js';

const temporary = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/axstack-inspector-cli-`);
afterAll(() => rmSync(temporary, { recursive: true }));
const helper = `${import.meta.dir}/../../skills/axstack/scripts/evidence-inspector.js`;
const capture = `${import.meta.dir}/../../skills/axstack/scripts/check-run.js`;
const cli = (...args) => Bun.spawnSync([process.execPath, helper, ...args], { stdout: 'pipe', stderr: 'pipe' });
const write = (name, value) => { const path = `${temporary}/${name}`; writeFileSync(path, JSON.stringify(value)); return path; };
const repository = 'https://github.com/example/project.git';
const head = 'a'.repeat(40), base = 'b'.repeat(40);
const item = { id: 'one', head, base, boundary: 'a branch', changedAt: '2026-01-01T00:00:00Z',
  raisedAt: '2026-01-02T00:00:00Z', acceptedProofKinds: ['runtime'], sourceScope: 'tracked+untracked-nonignored' };
const packet = () => ({ schemaVersion: 1, repository, head, base, items: [structuredClone(item)],
  dispositions: [{ id: 'one', head, base, boundary: item.boundary, status: 'open' }] });

test('help lists the only flags, reads no input and grants no authority', () => {
  const r = cli('--input', `${temporary}/absent`, '--help');
  expect(r.exitCode).toBe(0);
  expect(r.stdout.toString()).toContain('--input');
  expect(r.stdout.toString()).toContain('--help');
  expect(r.stdout.toString()).toContain('cannot grant review/merge authority');
});

test('CLI distinguishes measured fail, unknown and invalid invocation', () => {
  const p = packet(), path = write('packet.json', p);
  expect(cli('--input', path).exitCode).toBe(0);
  expect(JSON.parse(cli('--input', path).stdout).terms[0].status).toBe('fail');
  p.dispositions = []; write('packet.json', p);
  const missing = cli('--input', path);
  expect(missing.exitCode).toBe(2);
  expect(JSON.parse(missing.stdout).terms[0].status).toBe('unknown');
  for (const args of [[], ['--input'], ['--bad', path], ['--input', path, '--input', path], ['--input', `${temporary}/absent`]]) {
    const r = cli(...args); expect(r.exitCode).toBe(1); expect(r.stderr.toString()).toContain('Evidence inspector:');
  }
  writeFileSync(path, '{'); expect(cli('--input', path).exitCode).toBe(1);
  for (const change of [p => { p.head = 'HEAD'; }, p => { p.schemaVersion = 2; },
    p => { p.items.push(p.items[0]); }, p => { p.dispositions.push({ id: 'sibling' }); }]) {
    const invalid = packet(); change(invalid); write('packet.json', invalid);
    expect(cli('--input', path).exitCode).toBe(1);
  }
});

test('real capture v1 consumed by relative receipt path, cached terms ignored, bytes unchanged', () => {
  const source = `${temporary}/source`, evidence = `${temporary}/capture`;
  mkdirSync(source, { mode: 0o700 }); mkdirSync(evidence, { mode: 0o700 });
  const git = (...args) => {
    const r = Bun.spawnSync(gitArgv('-C', source, ...args), { stdout: 'pipe', stderr: 'pipe' });
    if (r.exitCode !== 0) throw Error(r.stderr.toString());
    return r.stdout.toString().trim();
  };
  git('init', '-q'); git('remote', 'add', 'origin', repository);
  writeFileSync(`${source}/file.txt`, 'source\n'); git('add', 'file.txt');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture');
  const revision = git('rev-parse', 'HEAD');
  const r = Bun.spawnSync([process.execPath, capture, '--repo', source, '--repository', repository,
    '--head', revision, '--base', revision, '--out', evidence, '--', process.execPath, '-e', 'console.log("observed")'],
  { cwd: temporary, stdout: 'pipe', stderr: 'pipe' });
  expect(r.exitCode).toBe(0);
  const receipt = JSON.parse(r.stdout), p = packet();
  p.head = revision; p.base = revision;
  Object.assign(p.items[0], { head: revision, base: revision });
  Object.assign(p.dispositions[0], { head: revision, base: revision, status: 'proved',
    proof: { id: 'real-capture', itemId: 'one', kind: 'runtime', observedAt: '2026-01-03T00:00:00Z', receipt: 'receipt.json' } });
  const receiptPath = write('receipt.json', receipt), packetPath = write('real.json', p);
  const before = [readFileSync(receiptPath, 'utf8'), readFileSync(packetPath, 'utf8'), readFileSync(receipt.logPath, 'utf8')];
  const inventory = readdirSync(temporary).sort();
  const measured = cli('--input', packetPath);
  expect(measured.exitCode).toBe(0);
  expect(JSON.parse(measured.stdout).terms[0]).toMatchObject({ id: 'one', status: 'pass' });
  expect([readFileSync(receiptPath, 'utf8'), readFileSync(packetPath, 'utf8'), readFileSync(receipt.logPath, 'utf8')]).toEqual(before);
  expect(readdirSync(temporary).sort()).toEqual(inventory);
  receipt.logSha256 = '0'.repeat(64); receipt.terms = [{ id: 'identity', status: 'pass' }]; write('receipt.json', receipt);
  const forged = cli('--input', packetPath);
  expect(forged.exitCode).toBe(0);
  expect(JSON.parse(forged.stdout).terms[0].status).toBe('fail');
  writeFileSync(receiptPath, '{');
  expect(JSON.parse(cli('--input', packetPath).stdout).terms[0].status).toBe('fail');
  rmSync(receiptPath);
  expect(cli('--input', packetPath).exitCode).toBe(2);
});
