import { afterAll, expect, test } from 'bun:test';
import { chmodSync, chownSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
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
  return { repo, evidence, tool: { name: 'fixture-capture', version: '1.0.0' }, repository: 'https://example.invalid/fixture.git', head, base: head };
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
    sandboxImageDigest: null, tool: { name: 'fixture-capture', version: '1.0.0' } });
  expect(step.logBytes).toBe(0);
  expect(step.terms.every(t => t.status === 'pass')).toBe(true);
  expect(step.logSha256).toBe(new Bun.CryptoHasher('sha256').update('').digest('hex'));
  expect(step.sourceBefore).toEqual(step.sourceAfter);
});

test('rejects a different repository before capture', async () => {
  const f = fixture();
  await expect(capture(f, 'console.log("must not run")', { repository: 'other' })).rejects.toThrow(/repository/);
  expect(readdirSync(f.evidence)).toEqual([]);
});
test('rejects a valid different head before starting the command', async () => {
  const f = fixture(), old = f.head;
  git(f.repo, '-c', 'user.name=F', '-c', 'user.email=f@x', 'commit', '--allow-empty', '-qm', 'new head');
  await expect(capture(f, 'console.log("must not run")', { head: old })).rejects.toThrow(/head/);
  expect(readdirSync(f.evidence)).toEqual([]);
});
test.each(['head', 'base'])('missing %s is rejected before Git can resolve it as a branch', async (field) => {
  const f = fixture();
  // Prevent String(undefined) from merely producing an invalid-ref failure.
  git(f.repo, 'branch', 'undefined');
  await expect(capture(f, 'console.log("must not run")', { [field]: undefined })).rejects.toThrow(/missing capture identity/);
  expect(readdirSync(f.evidence)).toEqual([]);
});
test('dirty source is held before execution', async () => {
  const f = fixture();
  writeFileSync(`${f.repo}/source`, 'dirty');
  await expect(capture(f)).rejects.toThrow(/snapshot|dirty/);
  expect(readdirSync(f.evidence)).toEqual([]);
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
test('exact dirty snapshot binds tracked changes while ignored bytes remain outside it', async () => {
  const f = fixture();
  writeFileSync(`${f.repo}/source`, 'dirty');
  writeFileSync(`${f.repo}/.gitignore`, 'ignored\n');
  writeFileSync(`${f.repo}/ignored`, 'ignored bytes');
  const snapshot = sourceIdentity(f).snapshot;
  const step = await capture(f, 'void 0;', { snapshot });
  expect(step.declaredSnapshot).toBe(snapshot);
  expect(step.terms.every(t => t.status === 'pass')).toBe(true);
  writeFileSync(`${f.repo}/ignored`, 'changed ignored bytes');
  expect(sourceIdentity(f).snapshot).toBe(snapshot);
  writeFileSync(`${f.repo}/source`, 'different dirty bytes');
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

test('filesystem-root writable mount excludes every output directory', async () => {
  await expect(capture(fixture(), 'void 0;', { writableRoots: ['/'] })).rejects.toThrow(/outside|writable/);
});

test('symbolic requests are resolved to commits and cannot validate against a ref name', async () => {
  const f = fixture(), step = await capture(f, 'void 0;', { head: 'HEAD', base: 'HEAD' });
  expect(step.requested).toEqual({ head: f.head, base: f.base });
  expect(step.requestedRefs).toEqual({ head: 'HEAD', base: 'HEAD' });
  expect(captureTerms(step, f).find(t => t.id === 'identity').status).toBe('pass');
  expect(captureTerms(step, { ...f, head: 'HEAD' }).find(t => t.id === 'identity').status).not.toBe('pass');
  expect(captureTerms(step, f).find(t => t.id === 'identity').evidence).toMatchObject({ expected: { head: f.head, base: f.base }, requested: { head: f.head, base: f.base } });
});
test.each(['head', 'base'])('editing only requested %s cannot replay a receipt for another commit', async (field) => {
  const f = fixture(), step = await capture(f);
  git(f.repo, '-c', 'user.name=F', '-c', 'user.email=f@x', 'commit', '--allow-empty', '-qm', 'other');
  const other = git(f.repo, 'rev-parse', 'HEAD');
  step.requested[field] = other;
  expect(captureTerms(step, { ...f, [field]: other }).find(t => t.id === 'identity').status).toBe('fail');
});
test.each(['repository', 'head', 'requestedHead', 'base'])('validator checks sourceBefore %s consistency independently', async (field) => {
  const f = fixture(), step = await capture(f);
  step.sourceBefore[field] = field === 'repository' ? 'other-repository' : 'a'.repeat(40);
  expect(captureTerms(step, f).find(t => t.id === 'identity').status).toBe('fail');
});
test('a declared snapshot must match even when the tree is clean', async () => {
  const f = fixture();
  await expect(capture(f, 'void 0;', { snapshot: '0'.repeat(64) })).rejects.toThrow(/snapshot/);
  expect(readdirSync(f.evidence)).toEqual([]);
});
test('evidence must be an owned private directory before the child starts', async () => {
  const f = fixture();
  chmodSync(f.evidence, 0o755);
  await expect(capture(f)).rejects.toThrow(/owned 0700/);
  expect(readdirSync(f.evidence)).toEqual([]);
  chmodSync(f.evidence, 0o700);
  if (process.getuid() === 0) {
    chownSync(f.evidence, 65534, 65534);
    try { await expect(capture(f)).rejects.toThrow(/owned 0700/); }
    finally { chownSync(f.evidence, 0, 0); }
  }
});
test('snapshot hashes the symlink target even when link mode and target contents match', () => {
  const f = fixture();
  writeFileSync(`${f.repo}/same-bytes-a`, 'same');
  writeFileSync(`${f.repo}/same-bytes-b`, 'same');
  symlinkSync('same-bytes-a', `${f.repo}/link`);
  const before = sourceIdentity(f).snapshot;
  unlinkSync(`${f.repo}/link`);
  symlinkSync('same-bytes-b', `${f.repo}/link`);
  expect(sourceIdentity(f).snapshot).not.toBe(before);
});
