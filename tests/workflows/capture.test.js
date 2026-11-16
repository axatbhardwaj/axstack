import { afterAll, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { captureTerms, sourceIdentity } from '../../skills/axstack/scripts/capture-identity.js';
import { runCommand } from '../../skills/axstack/scripts/command-capture.js';

const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/capture-`);
afterAll(() => rmSync(root, { recursive: true }));
function git(repo, ...args) {
  const r = Bun.spawnSync(['git', '-C', repo, ...args], { stdout: 'pipe', stderr: 'pipe' });
  if (r.exitCode) throw Error(r.stderr.toString());
  return r.stdout.toString().trim();
}
function fixture() {
  const repo = mkdtempSync(`${root}/repo-`);
  git(repo, 'init', '-q');
  git(repo, 'remote', 'add', 'origin', 'https://example.invalid/fixture.git');
  writeFileSync(`${repo}/source`, 'original');
  git(repo, 'add', '.');
  git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture');
  const head = git(repo, 'rev-parse', 'HEAD');
  const evidence = mkdtempSync(`${root}/evidence-`);
  return { repo, evidence, repository: 'https://example.invalid/fixture.git', head, base: head };
}
async function capture(f, code = 'void 0;', overrides = {}) {
  const { argv = [process.execPath, '-e', code], limits = {}, state = { active: null, signal: null }, ...binding } = overrides;
  return runCommand([], { evidence: f.evidence }, 'check', argv, f.repo, process.env,
    { timeoutMs: 1000, logBytes: 4096, ...limits }, state, argv, { ...f, ...binding });
}
const receipt = (step) => JSON.parse(readFileSync(step.receiptPath, 'utf8'));

test('silent success binds versioned identity and log integrity without claiming proof', async () => {
  const f = fixture();
  const step = await capture(f);
  expect(receipt(step)).toMatchObject({ schemaVersion: 1, repository: f.repository,
    requested: { head: f.head, base: f.base }, cwd: f.repo, exitCode: 0,
    sandboxImageDigest: null, tool: { name: 'check-run', version: '1.0.0' } });
  expect(step.logBytes).toBe(0);
  expect(step.terms.every(t => t.status === 'pass')).toBe(true);
  expect(step.logSha256).toBe(new Bun.CryptoHasher('sha256').update('').digest('hex'));
  expect(step.sourceBefore).toEqual(step.sourceAfter);
});

test.each(['repository', 'head', 'base'])('rejects wrong %s before starting the command', async (key) => {
  const f = fixture();
  await expect(capture(f, 'throw Error("must not run")', { [key]: 'wrong' })).rejects.toThrow();
});
test('rejects missing identity and dirty source before execution', async () => {
  const f = fixture();
  await expect(capture(f, 'void 0;', { repository: undefined })).rejects.toThrow();
  writeFileSync(`${f.repo}/source`, 'dirty');
  await expect(capture(f)).rejects.toThrow(/snapshot|dirty/);
});
test('rejects receipts inside the source, cwd or declared writable root', async () => {
  const f = fixture();
  const evidence = `${f.repo}/evidence`;
  mkdirSync(evidence, { mode: 0o700 });
  await expect(capture({ ...f, evidence })).rejects.toThrow(/outside|writable/);
  await expect(capture(f, 'void 0;', { writableRoots: [root] })).rejects.toThrow(/outside|writable/);
});
test.each([
  ['source', 'await Bun.write("source", "changed")'],
  ['head', 'Bun.spawnSync(["git", "-c", "user.name=F", "-c", "user.email=f@x", "commit", "--allow-empty", "-qm", "changed"])'],
  ['base', 'Bun.spawnSync(["git", "branch", "-f", "baseline", "HEAD~1"])'],
])('records changed %s as failed identity', async (name, code) => {
  const f = fixture();
  if (name === 'base') {
    git(f.repo, '-c', 'user.name=F', '-c', 'user.email=f@x', 'commit', '--allow-empty', '-qm', 'second');
    f.head = git(f.repo, 'rev-parse', 'HEAD');
    git(f.repo, 'branch', 'baseline');
    f.base = 'baseline';
  }
  const step = await capture(f, code);
  expect(step.exitCode).toBe(0);
  expect(step.terms.find(t => t.id === 'source').status).toBe('fail');
});
test.each([
  ['timeout', 'setTimeout(() => {}, 5000)', { timeoutMs: 30 }],
  ['truncation', 'console.log("x".repeat(5000))', { logBytes: 8 }],
  ['spawn failure', '', {}, ['/does-not-exist-capture-fixture']],
])('%s cannot establish complete evidence', async (_name, code, limits, argv) => {
  const step = await capture(fixture(), code, { limits, ...(argv && { argv }) });
  expect(step.terms.find(t => t.id === 'capture').status).toBe('unknown');
});
test('interruption remains incomplete even when the killed child reports an exit', async () => {
  const f = fixture();
  const state = { active: null, signal: null };
  const pending = capture(f, 'console.log("ready"); setTimeout(() => {}, 5000)', { state });
  while (!state.active) await Bun.sleep(5);
  state.signal = 'SIGTERM';
  state.active.kill('SIGTERM');
  const step = await pending;
  expect(step.interrupted).toBe('SIGTERM');
  expect(step.terms.find(t => t.id === 'capture').status).toBe('unknown');
});

test.each(['head', 'base', 'repository', 'missing', 'log'])('receipt validation rejects altered %s', async (field) => {
  const f = fixture();
  const step = await capture(f, 'console.log("evidence")');
  if (field === 'log') writeFileSync(step.logPath, 'altered');
  else if (field === 'missing') delete step.sourceBefore;
  else if (field === 'repository') step.repository = 'other';
  else step.requested[field] = 'other';
  const terms = captureTerms(step, { repository: f.repository, head: f.head, base: f.base });
  expect(terms.some(t => t.status !== 'pass')).toBe(true);
});
test('exact dirty snapshot is accepted and binds otherwise ignored bytes', async () => {
  const f = fixture();
  writeFileSync(`${f.repo}/source`, 'dirty');
  writeFileSync(`${f.repo}/.gitignore`, 'ignored\n');
  writeFileSync(`${f.repo}/ignored`, 'ignored bytes');
  const snapshot = sourceIdentity(f).snapshot;
  const step = await capture(f, 'void 0;', { snapshot });
  expect(step.declaredSnapshot).toBe(snapshot);
  expect(step.terms.every(t => t.status === 'pass')).toBe(true);
  writeFileSync(`${f.repo}/ignored`, 'changed ignored bytes');
  await expect(capture(f, 'void 0;', { snapshot })).rejects.toThrow(/snapshot/);
});

test('deleted command cwd still leaves a receipt with unavailable after-identity', async () => {
  const step = await capture(fixture(), 'const { rmSync } = await import("node:fs"); rmSync(process.cwd(), { recursive: true });');
  expect(step.exitCode).toBe(0);
  expect(receipt(step).terms.find(t => t.id === 'source').status).toBe('unknown');
});
test.each(['timedOut', 'logIncomplete', 'omittedBytes', 'exitCode'])('missing %s cannot establish complete capture', async (field) => {
  const f = fixture(), step = await capture(f);
  delete step[field];
  expect(captureTerms(step).find(t => t.id === 'capture').status).toBe('unknown');
});

test('receipt cannot supply its own expected repository and revisions', async () => {
  const step = await capture(fixture());
  expect(captureTerms(step).find(t => t.id === 'identity').status).toBe('unknown');
});
