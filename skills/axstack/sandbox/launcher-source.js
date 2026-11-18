import { chmodSync, mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { gitArgv } from '../scripts/git-argv.js';
import { hold, safePath, validate } from './launcher-policy.js';

const githubSlug = /^[a-z0-9-]+\/(?!\.{1,2}$)[a-z0-9_.-]+$/i;
function githubRepository(origin) {
  const match = /^(?:https:\/\/github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)(.+)$/i.exec(origin);
  const slug = match?.[1].replace(/\.git$/i, '');
  return slug && githubSlug.test(slug) ? slug.toLowerCase() : null;
}

export async function bindCheckoutOrigin(request, execute) {
  validate('request', request);
  const repo = realpathSync(safePath(request.repo));
  if (![request.head, request.base].every(commit => /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit))) throw Error('head/base must be exact commits');
  const git = async (reason, ...args) => {
    const result = await execute(gitArgv('--no-lazy-fetch', '--no-replace-objects', '-C', repo, ...args));
    if (result.exitCode !== 0) hold(reason);
    return result.stdout.trim();
  };
  const root = await git('checkout root unavailable', 'rev-parse', '--show-toplevel');
  if (realpathSync(root) !== repo) hold('repo must be the checkout root');
  const origin = await git('checkout origin unavailable', 'remote', 'get-url', 'origin');
  const expected = githubSlug.test(request.repository) ? request.repository.toLowerCase() : githubRepository(request.repository);
  if (!expected || githubRepository(origin) !== expected) hold('checkout origin does not match expected repository');
  const head = await git('checkout HEAD unavailable', 'rev-parse', '--verify', 'HEAD^{commit}');
  if (head !== request.head) hold('checkout HEAD does not match expected head');
  const base = await git('expected base commit unavailable', 'rev-parse', '--verify', `${request.base}^{commit}`);
  if (base !== request.base) hold('expected base is not a commit');
  return { ...request, repository: origin };
}

const excluded = new Set(['.git', 'node_modules', '.venv', 'venv', '__pycache__', '.gradle', '.pnpm-store']);
export async function exportSource(p, execute) {
  const root = safePath(p.sourceExport.path);
  const git = async (...args) => {
    const r = await execute(gitArgv('-C', p.request.repo, ...args), { maxBytes: p.policy.sourceMaxBytes });
    if (r.exitCode !== 0) hold(`source export Git failure: ${args[0]}`);
    return r.stdout;
  };
  const listing = await git('ls-tree', '-rz', '--full-tree', p.request.head);
  const base = await git('ls-tree', '-rz', '--full-tree', p.request.base);
  const parse = text => String(text).split('\0').filter(Boolean).map(line => {
    const match = /^(\d{6}) (blob|commit) ([a-f0-9]{40,64})\t([\s\S]+)$/.exec(line);
    if (!match) hold('unsupported Git source entry');
    const [, mode, type, sha, path] = match;
    if (path.startsWith('/') || path.split('/').some(x => !x || x === '.' || x === '..') || /[\0\r\n]/.test(path)) hold('unsafe tracked path');
    return { mode, type, sha, path };
  });
  const entries = parse(listing), baseLinks = new Map(parse(base).filter(e => e.mode === '160000').map(e => [e.path, e.sha]));
  for (const e of entries.filter(e => e.mode === '160000')) if (baseLinks.get(e.path) !== e.sha) hold(`changed/private submodule limitation: ${e.path}`);
  for (const e of entries) if (e.mode === '160000') baseLinks.delete(e.path);
  if (baseLinks.size) hold('removed/changed submodule limitation');
  const selected = entries.filter(e => e.mode !== '160000' && !e.path.split('/').some(x => excluded.has(x)));
  const links = new Map(), blobs = [], directories = new Set();
  let bytes = 4096;
  for (const e of selected) {
    if (!['100644', '100755', '120000'].includes(e.mode) || e.type !== 'blob') hold(`special tracked entry: ${e.path}`);
    const r = await execute(gitArgv('-C', p.request.repo, 'cat-file', 'blob', e.sha), { maxBytes: p.policy.sourceMaxBytes, binary: true });
    if (r.exitCode !== 0) hold(`source blob unavailable: ${e.path}`);
    const data = typeof r.stdout === 'string' ? new TextEncoder().encode(r.stdout) : r.stdout;
    if (new TextDecoder().decode(data.subarray(0, 100)).startsWith('version https://git-lfs.github.com/spec/v1')) hold(`LFS object not fetched on host: ${e.path}`);
    const parts = e.path.split('/'); parts.pop();
    while (parts.length) { directories.add(parts.join('/')); parts.pop(); }
    bytes += Math.max(4096, Math.ceil(data.length / 4096) * 4096);
    if (bytes + directories.size * 4096 > p.sourceExport.maxBytes) hold('host source export cap exceeded');
    if (e.mode === '120000') {
      const target = new TextDecoder('utf-8', { fatal: true }).decode(data);
      if (!target || target.startsWith('/') || target.includes('\0')) hold(`unsafe symlink: ${e.path}`);
      links.set(e.path, target);
    }
    blobs.push({ ...e, data });
  }
  // Resolve symlink chains lexically; never follow any host filesystem link.
  for (const [path, target] of links) {
    const pending = [...path.split('/').slice(0, -1), ...target.split('/')], resolved = [];
    let hops = 0;
    while (pending.length) {
      const part = pending.shift();
      if (!part || part === '.') continue;
      if (part === '..') {
        if (!resolved.length) hold('source symlink escapes export');
        resolved.pop(); continue;
      }
      resolved.push(part);
      const link = resolved.join('/');
      if (links.has(link)) {
        if (++hops > 40) hold('source symlink cycle');
        resolved.pop(); pending.unshift(...links.get(link).split('/'));
      }
    }
  }
  // Git trees cannot contain a symlink as the parent of another tracked path.
  mkdirSync(root, { mode: 0o755 });
  for (const dir of [...directories].sort((a, b) => a.split('/').length - b.split('/').length)) mkdirSync(`${root}/${dir}`, { mode: 0o755 });
  for (const e of blobs) {
    if (e.mode === '120000') symlinkSync(links.get(e.path), `${root}/${e.path}`);
    else { writeFileSync(`${root}/${e.path}`, e.data, { flag: 'wx', mode: e.mode === '100755' ? 0o555 : 0o444 }); chmodSync(`${root}/${e.path}`, e.mode === '100755' ? 0o555 : 0o444); }
  }
}
