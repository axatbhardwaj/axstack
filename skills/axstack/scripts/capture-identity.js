import { lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { gitArgv } from './git-argv.js';

export const captureVersion = '1.0.0';
export const sha256 = (bytes) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
function git(repo, ...args) {
  const r = Bun.spawnSync(gitArgv('-C', repo, ...args), { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  if (r.exitCode !== 0) throw Error(r.stderr.toString().trim() || 'git identity unavailable');
  return args.includes('-z') ? r.stdout.toString() : r.stdout.toString().trim();
}
function snapshotTree(root) {
  const hash = new Bun.CryptoHasher('sha256');
  const included = new Set(git(root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean));
  const directories = new Set();
  for (const path of included) {
    const parts = path.split('/');
    while (parts.length > 1) { parts.pop(); directories.add(parts.join('/')); }
  }
  function walk(relative) {
    for (const name of readdirSync(`${root}/${relative}`).sort()) {
      if (!relative && name === '.git') continue;
      const path = relative ? `${relative}/${name}` : name;
      if (!included.has(path) && !directories.has(path)) continue;
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
// Binds tracked and non-ignored untracked entries; ignored bytes and Git metadata are excluded.
export function sourceIdentity(binding) {
  const repo = realpathSync(binding.repo);
  if (realpathSync(git(repo, 'rev-parse', '--show-toplevel')) !== repo) throw Error('repo must be the source root');
  return {
    root: repo, repository: git(repo, 'remote', 'get-url', 'origin'),
    head: git(repo, 'rev-parse', '--verify', 'HEAD^{commit}'),
    requestedHead: git(repo, 'rev-parse', '--verify', `${binding.head}^{commit}`),
    base: git(repo, 'rev-parse', '--verify', `${binding.base}^{commit}`),
    dirty: Boolean(git(repo, 'status', '--porcelain', '--untracked-files=all')),
    snapshot: snapshotTree(repo),
  };
}
function hold(message) {
  throw Object.assign(new Error(message), { captureHold: true });
}
const within = (path, root) => path === root || path.startsWith(root === '/' ? '/' : `${root}/`);
export function admitCapture(binding, evidence, cwd) {
  if (!binding.repo || !binding.repository || !binding.head || !binding.base) throw Error('missing capture identity: repo, repository, head and base required');
  if (!binding.tool?.name || !binding.tool?.version) throw Error('capture tool name and version required');
  const output = realpathSync(evidence);
  const stat = lstatSync(evidence);
  if (stat.isSymbolicLink() || !stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o700) throw Error('evidence must be an owned 0700 directory');
  for (const root of [binding.repo, cwd, ...(binding.writableRoots ?? [])]) {
    if (within(output, realpathSync(root))) hold('receipt output must be outside every untrusted writable root (source and cwd included)');
  }
  if (binding.sandboxImageDigest != null && !/^sha256:[a-f0-9]{64}$/.test(binding.sandboxImageDigest)) throw Error('sandbox image digest must be sha256:<64 hex>');
  const before = sourceIdentity(binding);
  if (before.repository !== binding.repository || before.head !== before.requestedHead) hold('repository or requested head does not match source');
  if (before.dirty && binding.snapshot !== before.snapshot) hold(`dirty source requires exact --snapshot ${before.snapshot}`);
  if (binding.snapshot && binding.snapshot !== before.snapshot) hold(`declared snapshot does not match source; computed --snapshot ${before.snapshot}`);
  return before;
}

// These are capture facts, never a proof-sufficiency or authority verdict.
export function finishCapture(step, binding, before, cwd, signal) {
  Object.assign(step, {
    schemaVersion: 1, tool: { name: binding.tool.name, version: binding.tool.version, bun: Bun.version },
    repository: binding.repository, pr: binding.pr ?? null,
    requested: { head: before.requestedHead, base: before.base },
    requestedRefs: { head: binding.head, base: binding.base },
    cwd, sandboxImageDigest: binding.sandboxImageDigest ?? null,
    declaredSnapshot: binding.snapshot ?? null, sourceBefore: before, sourceAfter: null,
    interrupted: signal, logSha256: sha256(readFileSync(step.logPath)),
  });
  try { step.sourceAfter = sourceIdentity(binding); } catch (error) { step.sourceError = error.message; }
  step.terms = captureTerms(step, { repository: binding.repository, head: before.requestedHead, base: before.base });
}

// Revalidation requires caller-supplied expectations; a receipt cannot attest itself.
export function captureTerms(step, expected = null) {
  const unchanged = JSON.stringify(step.sourceBefore) === JSON.stringify(step.sourceAfter);
  const identities = [step.sourceBefore, step.sourceAfter];
  const identityPresent = identities.every(s => s && ['root', 'repository', 'head', 'requestedHead', 'base', 'snapshot'].every(k => typeof s[k] === 'string' && s[k]) && typeof s.dirty === 'boolean');
  const fullSha = value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
  const schema = step.schemaVersion === 1 && typeof step.tool?.name === 'string' && step.tool.name.length > 0 && typeof step.tool.version === 'string' && step.tool.version.length > 0
    && Array.isArray(step.argv) && step.argv.length > 0 && step.argv.every(a => typeof a === 'string')
    && typeof step.cwd === 'string' && step.cwd.startsWith('/') && identityPresent
    && fullSha(step.requested?.head) && fullSha(step.requested?.base)
    && typeof step.repository === 'string' && typeof step.logSha256 === 'string'
    && (step.sandboxImageDigest === null || /^sha256:[a-f0-9]{64}$/.test(step.sandboxImageDigest));
  const bound = schema && expected?.repository && fullSha(expected?.head) && fullSha(expected?.base)
    && step.repository === expected.repository && step.requested.head === expected.head && step.requested.base === expected.base
    && step.sourceBefore.repository === step.repository && step.sourceBefore.head === step.requested.head
    && step.sourceBefore.requestedHead === step.requested.head && step.sourceBefore.base === step.requested.base
    && (!step.sourceBefore.dirty || step.declaredSnapshot === step.sourceBefore.snapshot);
  let logStatus = 'unknown', logEvidence;
  try {
    const bytes = readFileSync(step.logPath);
    logStatus = typeof step.logSha256 !== 'string' ? 'unknown' : sha256(bytes) === step.logSha256 && bytes.length === step.logBytes ? 'pass' : 'fail';
    logEvidence = step.logPath;
  } catch (error) { logEvidence = error.message; }
  const observed = source => source ? { repository: source.repository, head: source.head, requestedHead: source.requestedHead, base: source.base } : null;
  return [
    { id: 'identity', status: !schema || !expected?.repository || !expected?.head || !expected?.base ? 'unknown' : bound ? 'pass' : 'fail', evidence: { expected: expected ? { repository: expected.repository, head: expected.head, base: expected.base } : null, requested: step.requested, sourceBefore: observed(step.sourceBefore), sourceAfter: observed(step.sourceAfter) } },
    { id: 'log', status: logStatus, evidence: logEvidence },
    { id: 'source', status: !step.sourceAfter ? 'unknown' : unchanged ? 'pass' : 'fail', evidence: !step.sourceAfter ? step.sourceError ?? 'source unavailable' : unchanged ? 'before/after identity equal' : 'source identity changed' },
    { id: 'capture', status: step.error || step.timedOut !== false || step.interrupted !== null || step.omittedBytes !== 0 || step.logIncomplete !== false || !Number.isInteger(step.exitCode) ? 'unknown' : 'pass',
      evidence: { exitCode: step.exitCode, error: step.error ?? null, timedOut: step.timedOut, interrupted: step.interrupted, omittedBytes: step.omittedBytes, logIncomplete: step.logIncomplete } },
  ];
}
