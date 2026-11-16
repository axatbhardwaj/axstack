import { lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { gitArgv } from './git-argv.js';

export const captureVersion = '1.0.0';
export const sha256 = (bytes) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
function git(repo, ...args) {
  const r = Bun.spawnSync(gitArgv('-C', repo, ...args), { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  if (r.exitCode !== 0) throw Error(r.stderr.toString().trim() || 'git identity unavailable');
  return r.stdout.toString().trim();
}
function snapshotTree(root) {
  const hash = new Bun.CryptoHasher('sha256');
  function walk(relative) {
    for (const name of readdirSync(`${root}/${relative}`).sort()) {
      if (!relative && name === '.git') continue;
      const path = relative ? `${relative}/${name}` : name;
      const stat = lstatSync(`${root}/${path}`);
      hash.update(`${JSON.stringify([path, stat.mode & 0o177777])}\n`);
      if (stat.isSymbolicLink()) hash.update(JSON.stringify(readlinkSync(`${root}/${path}`)));
      else if (stat.isDirectory()) walk(path);
      else if (stat.isFile()) hash.update(sha256(readFileSync(`${root}/${path}`)));
      else throw Error(`unsupported source entry: ${path}`);
      hash.update('\n');
    }
  }
  walk('');
  return hash.digest('hex');
}
// Includes ignored and untracked bytes, modes and symlink targets; excludes Git metadata.
export function sourceIdentity(binding) {
  const repo = realpathSync(binding.repo);
  if (realpathSync(git(repo, 'rev-parse', '--show-toplevel')) !== repo) throw Error('repo must be the source root');
  return {
    root: repo, repository: git(repo, 'remote', 'get-url', 'origin'),
    head: git(repo, 'rev-parse', '--verify', 'HEAD^{commit}'),
    requestedHead: git(repo, 'rev-parse', '--verify', `${binding.head}^{commit}`),
    base: git(repo, 'rev-parse', '--verify', `${binding.base}^{commit}`),
    dirty: Boolean(git(repo, 'status', '--porcelain', '--untracked-files=all', '--ignored')),
    snapshot: snapshotTree(repo),
  };
}
const within = (path, root) => path === root || path.startsWith(root === '/' ? '/' : `${root}/`);
export function admitCapture(binding, evidence, cwd) {
  if (!binding.repo || !binding.repository || !binding.head || !binding.base) throw Error('missing capture identity: repo, repository, head and base required');
  const output = realpathSync(evidence);
  const stat = lstatSync(evidence);
  if (stat.isSymbolicLink() || !stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o700) throw Error('evidence must be an owned 0700 directory');
  for (const root of [binding.repo, cwd, ...(binding.writableRoots ?? [])]) {
    if (within(output, realpathSync(root))) throw Error('receipt output must be outside every untrusted writable root (source and cwd included)');
  }
  if (binding.sandboxImageDigest != null && !/^sha256:[a-f0-9]{64}$/.test(binding.sandboxImageDigest)) throw Error('sandbox image digest must be sha256:<64 hex>');
  const before = sourceIdentity(binding);
  if (before.repository !== binding.repository || before.head !== before.requestedHead) throw Error('repository or requested head does not match source');
  if (before.dirty && binding.snapshot !== before.snapshot) throw Error('dirty source requires its exact --snapshot digest');
  if (binding.snapshot && binding.snapshot !== before.snapshot) throw Error('declared snapshot does not match source');
  return before;
}

// These are capture facts, never a proof-sufficiency or authority verdict.
export function finishCapture(step, binding, before, cwd, signal) {
  Object.assign(step, {
    schemaVersion: 1, tool: { name: 'check-run', version: captureVersion, bun: Bun.version },
    repository: binding.repository, pr: binding.pr ?? null,
    requested: { head: binding.head, base: binding.base },
    cwd, sandboxImageDigest: binding.sandboxImageDigest ?? null,
    declaredSnapshot: binding.snapshot ?? null, sourceBefore: before, sourceAfter: null,
    interrupted: signal, logSha256: sha256(readFileSync(step.logPath)),
  });
  try { step.sourceAfter = sourceIdentity(binding); } catch (error) { step.sourceError = error.message; }
  step.terms = captureTerms(step, { repository: binding.repository, head: binding.head, base: binding.base });
}

// Revalidation requires caller-supplied expectations; a receipt cannot attest itself.
export function captureTerms(step, expected = null) {
  const unchanged = JSON.stringify(step.sourceBefore) === JSON.stringify(step.sourceAfter);
  const identities = [step.sourceBefore, step.sourceAfter];
  const identityPresent = identities.every(s => s && ['root', 'repository', 'head', 'requestedHead', 'base', 'snapshot'].every(k => typeof s[k] === 'string' && s[k]) && typeof s.dirty === 'boolean');
  const schema = step.schemaVersion === 1 && step.tool?.name === 'check-run' && typeof step.tool.version === 'string'
    && Array.isArray(step.argv) && step.argv.length > 0 && step.argv.every(a => typeof a === 'string')
    && typeof step.cwd === 'string' && step.cwd.startsWith('/') && identityPresent
    && typeof step.requested?.head === 'string' && typeof step.requested?.base === 'string'
    && typeof step.repository === 'string' && typeof step.logSha256 === 'string'
    && (step.sandboxImageDigest === null || /^sha256:[a-f0-9]{64}$/.test(step.sandboxImageDigest));
  const bound = schema && expected?.repository && expected?.head && expected?.base
    && step.repository === expected.repository && step.requested.head === expected.head && step.requested.base === expected.base
    && step.sourceBefore.repository === step.repository && step.sourceBefore.head === step.sourceBefore.requestedHead
    && (!step.sourceBefore.dirty || step.declaredSnapshot === step.sourceBefore.snapshot);
  let logStatus = 'unknown', logEvidence;
  try {
    const bytes = readFileSync(step.logPath);
    logStatus = typeof step.logSha256 !== 'string' ? 'unknown' : sha256(bytes) === step.logSha256 && bytes.length === step.logBytes ? 'pass' : 'fail';
    logEvidence = step.logPath;
  } catch (error) { logEvidence = error.message; }
  return [
    { id: 'identity', status: !schema || !expected?.repository || !expected?.head || !expected?.base ? 'unknown' : bound ? 'pass' : 'fail', evidence: 'schema v1; repository, requested head/base and source identity' },
    { id: 'log', status: logStatus, evidence: logEvidence },
    { id: 'source', status: !step.sourceAfter ? 'unknown' : unchanged ? 'pass' : 'fail', evidence: !step.sourceAfter ? step.sourceError ?? 'source unavailable' : unchanged ? 'before/after identity equal' : 'source identity changed' },
    { id: 'capture', status: step.error || step.timedOut !== false || step.interrupted !== null || step.omittedBytes !== 0 || step.logIncomplete !== false || !Number.isInteger(step.exitCode) ? 'unknown' : 'pass',
      evidence: { exitCode: step.exitCode, error: step.error ?? null, timedOut: step.timedOut, interrupted: step.interrupted, omittedBytes: step.omittedBytes, logIncomplete: step.logIncomplete } },
  ];
}
