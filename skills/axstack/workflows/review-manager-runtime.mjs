import { execFile } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { bindingMatches } from './binding.mjs';
import { github, json, ownerBinding, run, runtimeRpc } from './dependabot-runtime.mjs';
import { sameReportBinding } from './pr-triage.mjs';
import { githubPages } from './dependabot-pages.mjs';
import { busy, hash, reviewId, managerIdentity, interval, projectQuietFacts, repository, time } from './review-manager.mjs';

const path = (value) => typeof value === 'string' && /^\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(value) &&
  !value.split('/').some((part) => part === '..' || part === '.');
const loginName = (value) => typeof value === 'string' && /^[A-Za-z0-9_\[\]-]{1,80}$/.test(value);
const number = (value) => Number.isSafeInteger(value) && value > 0;
const unique = (values, check) => Array.isArray(values) && values.length > 0 && values.length <= 100 &&
  values.every(check) && new Set(values.map((value) => value.toLowerCase())).size === values.length;

async function privateRead(file) {
  const info = await lstat(file).catch(() => null);
  if (!info?.isFile() || info.uid !== process.getuid() || (info.mode & 0o077) ||
      info.size > 2 * 1024 * 1024 || await realpath(file) !== file) return null;
  return readFile(file, 'utf8');
}

async function readPrivateBinding(base) {
  try {
    const record = json(await privateRead(base + '/.axstack-workflows.json'))?.workflows?.[managerIdentity];
    if (!path(record?.binding)) return null;
    const bytes = await privateRead(record.binding);
    if (bytes === null || !bindingMatches(record.bindingDigest, hash(bytes))) return null;
    const config = json(bytes);
    if (!config || !['shadow', 'report', 'active'].includes(config.mode) || !reviewId(config.projectId) ||
        !['project', 'bun', 't3', 'skillsDirectory', 'progressCopy']
          .every((key) => path(config[key])) ||
        !unique(config.projects, path) || !config.projects.includes(config.project) ||
        !unique(config.repositories, repository) || !config.repositories.includes(config.repository) ||
        config.progressCopy === config.reapReceipt) return null;
    if (config.mode === 'active') {
      if (![config.registryTokenFile, config.worktreeRoot].every(path) ||
          config.nativeSeat?.runtimeMode !== 'full-access' ||
          typeof config.operationalLimits !== 'string' || !config.operationalLimits.trim()) return null;
      // The agent reads operational limits directly from the private binding.
      const { operationalLimits: _privateLimits, ...safeConfig } = config;
      return { ...safeConfig, digest: record.bindingDigest };
    }
    return path(config.reapReceipt) ? config : null;
  } catch {
    return null;
  }
}

// On the native predecessor route only the predecessor may reap. Its saved
// fact supplies the shadow observation. Missing results remain unknown.
async function readReapReceipt(config, scheduledAt) {
  const saved = json(await privateRead(config.reapReceipt).catch(() => null));
  const age = time(scheduledAt) - time(saved?.observedAt);
  if (saved?.version !== 2 || !(age >= 0 && age <= interval) || !Array.isArray(saved.terms)) return null;
  const terms = saved.terms.filter((item) => item?.id === 'reap');
  const term = terms.length === 1 ? terms[0] : null;
  const { exitCode, dockerAvailable } = term?.evidence ?? {};
  if (!Number.isInteger(exitCode) || typeof dockerAvailable !== 'boolean' ||
      term.status !== (exitCode === 0 && dockerAvailable ? 'pass' : 'fail')) return null;
  return { exitCode, dockerAvailable };
}

async function discoverReviewPRs(config) {
  const gh = async (args) => json(await run('gh', args, { cwd: '/', forge: true }));
  const search = (flag) => gh(['search', 'prs', flag, '@me', '--state', 'open', '--draft=false',
    '--json', 'number,repository,updatedAt,isDraft,author', '--limit', '1000']);
  const [user, ...searches] = await Promise.all([gh(['api', '--hostname', 'github.com', 'user']),
    search('--review-requested'), search('--involves')]);
  const expected = new Map(config.repositories.map((name) => [name.toLowerCase(), name]));
  const inventories = await Promise.all(config.repositories.map(async (name) => {
    const rows = await githubPages(github, `repos/${name}/pulls`, { state: 'open' }, null, (row) => {
      const target = row?.base?.repo?.full_name;
      return number(row?.number) && row.state === 'open' && typeof row.draft === 'boolean' &&
        loginName(row.user?.login) && Number.isFinite(time(row.updated_at)) &&
        repository(target) && target.toLowerCase() === name.toLowerCase() ? row.number : null;
    });
    return [name.toLowerCase(), rows && new Map(rows.map((row) => [row.number, row]))];
  }));
  const byRepo = new Map(inventories);
  let complete = loginName(user?.login) && inventories.every(([, rows]) => rows !== null);
  const prs = new Set();
  const projected = searches.map((results) => {
    if (!Array.isArray(results) || results.length >= 1000) {
      complete = false;
      return null;
    }
    return results.map((row) => {
      const name = row?.repository?.nameWithOwner;
      if (!repository(name) || !number(row.number) || !loginName(row.author?.login) ||
          typeof row.isDraft !== 'boolean' || !Number.isFinite(time(row.updatedAt))) {
        complete = false;
        return null;
      }
      const repo = name.toLowerCase();
      const captured = byRepo.get(repo)?.get(row.number);
      if (!captured || row.updatedAt !== captured.updated_at || row.isDraft !== captured.draft ||
          row.author.login.toLowerCase() !== captured.user.login.toLowerCase()) complete = false;
      if (expected.has(repo) && !row.isDraft && loginName(user?.login) &&
          row.author.login.toLowerCase() !== user.login.toLowerCase()) {
        prs.add(`${expected.get(repo)}#${row.number}`);
      }
      return {
        number: row?.number, repository: { nameWithOwner: name }, updatedAt: row?.updatedAt, isDraft: row?.isDraft,
        author: { login: row?.author?.login },
      };
    });
  });
  return { status: complete ? 'pass' : 'unknown', repository: config.repository, login: loginName(user?.login) ? user.login : null,
    searches: projected, prs: [...prs].sort() };
}

async function threads(base, config, state, watermarks) {
  const t3 = async (command, ...args) => json(await run(config.t3, ['thread', command,
    '--base-dir', base, ...args, '--json'], { cwd: '/' }));
  const shown = async (threadId) => {
    if (!reviewId(threadId)) return null;
    const view = await t3('show', threadId, '--messages', '20');
    return view?.thread?.threadId === threadId && view.thread.projectId === config.projectId ? view : null;
  };
  const lists = await Promise.all(config.projects.map((project) => t3('list', '--project', project)));
  const reads = await Promise.all([...new Set([...state.owners, ...state.flagged])].map(async (id) => [id, await shown(id)]));
  const byId = new Map(reads);
  const owner = state.owners.map((threadId) => byId.get(threadId)?.thread).find((row) => busy.includes(row?.status));
  const prior = byId.get(state.prior)?.thread;
  const priorFields = prior && Object.fromEntries(['threadId', 'projectId', 'status', 'settled', 'updatedAt'].map((key) => [key, prior[key] ?? null]));
  const flagged = state.flagged.map((id) => {
    const marked = byId.get(id);
    const messages = marked?.messages;
    if (!Array.isArray(messages) || busy.includes(marked.thread.status) || marked.thread.pinned !== true) return { id, status: 'unknown' };
    const replies = messages.filter((message) => message.role === 'user');
    if (!replies.length || replies.some((message) => !message.runId || typeof message.text !== 'string')) return { id, status: 'unknown' };
    const watermark = hash(JSON.stringify(replies.map(({ runId, text }) => [runId, text])));
    // A known reply proves presence. The bounded CLI tail cannot prove absence.
    return watermark === watermarks[id] ? { id, status: 'unknown' } : { id, status: 'reply', watermark };
  });
  return {
    coverage: 'unknown', readableProjects: lists.filter(Array.isArray).length,
    inventory: null, prior: priorFields ? { thread: priorFields } : null, ownerUpdatedAt: owner?.updatedAt ?? null,
    flagged, observedAt: new Date().toISOString(),
  };
}

function bunCommand(config, args, { timeout = 10_000, killSignal = 'SIGTERM' } = {}) {
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR']
    .filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]]));
  return new Promise((resolve) => {
    const child = execFile(config.bun, ['--no-env-file', ...args],
      { cwd: '/', env, timeout, maxBuffer: 4 * 1024 * 1024, killSignal },
      (error, stdout) => resolve({ exitCode: error ? Number.isInteger(error.code) ? error.code : 1 : 0, output: json(stdout) }));
    child.stdin?.on('error', () => {});
    child.stdin?.end();
  });
}

async function activeReap(config) {
  const docker = await run('docker', ['info', '--format', '{{.ServerVersion}}'], { cwd: '/' });
  if (!docker?.trim()) return { exitCode: 1, dockerAvailable: false };
  const { exitCode, output } = await bunCommand(config, [config.skillsDirectory + '/sandbox/launcher.js', 'reap'],
    { timeout: 920_000 });
  return {
    exitCode: exitCode || (Array.isArray(output) && output.every((term) => term?.status === 'pass') ? 0 : 1),
    dockerAvailable: true,
  };
}

async function quietFacts(config, progress, input) {
  const dir = await mkdtemp(tmpdir() + '/axstack-review-manager-');
  try {
    await Promise.all([
      writeFile(dir + '/input.json', JSON.stringify(input), { mode: 0o600 }),
      writeFile(dir + '/progress.md', progress, { mode: 0o600 }),
    ]);
    const { exitCode, output } = await bunCommand(config, [config.skillsDirectory + '/scripts/schedule-drift.js',
      'quiet-facts', '--input', dir + '/input.json', '--continuity', dir + '/progress.md', '--now', input.observedAt],
      { killSignal: 'SIGKILL' });
    return projectQuietFacts(exitCode === 0 || exitCode === 2 ? output : null);
  } finally {
    await rm(dir, { recursive: true });
  }
}

async function prepareWorktree(config, runId) {
  const { project, worktreeRoot } = config;
  const info = await lstat(worktreeRoot);
  if (!/^[A-Za-z0-9_-]+$/.test(runId) || !info.isDirectory() || info.uid !== process.getuid() ||
      (info.mode & 0o077) || worktreeRoot === project || worktreeRoot.startsWith(project + '/') ||
      project.startsWith(worktreeRoot + '/') || await realpath(worktreeRoot) !== worktreeRoot ||
      await realpath(project) !== project) return null;
  const git = (...args) => run('git', args, { cwd: project });
  if ((await git('rev-parse', '--show-toplevel'))?.trim() !== project) return null;
  const sha = (await git('rev-parse', '--verify', 'refs/remotes/origin/main^{commit}'))?.trim();
  if (!/^[a-f0-9]{40}$/.test(sha ?? '')) return null;
  const worktree = worktreeRoot + '/review-manager-' + runId;
  try {
    await mkdir(worktree, { mode: 0o700 });
    if (await git('worktree', 'add', '--detach', '--', worktree, sha) === null) return null;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  if (await realpath(worktree) !== worktree) return null;
  const before = await git('worktree', 'list', '--porcelain', '-z');
  const verified = before?.split('\0\0').some((record) => {
    const fields = record.split('\0');
    return fields[0] === 'worktree ' + worktree && fields.includes('HEAD ' + sha) && fields.includes('detached');
  });
  return verified ? worktree : null;
}

async function stillBound(base, config) {
  return (await readPrivateBinding(base))?.digest === config.digest;
}

async function managerLaunch(base, config, runId) {
  if (!await stillBound(base, config)) return null;
  const seat = await ownerBinding(base, { ...config, roles: config.skillsDirectory + '/roles.json' });
  if (!seat || !sameReportBinding(seat, config.nativeSeat)) return null;
  const worktree = await prepareWorktree(config, runId);
  return worktree ? { ...seat, project: config.projectId, worktree } : null;
}

async function verifyManager(base, config, expected, receipt) {
  if (!await stillBound(base, config)) return false;
  const runtimeFile = base + '/userdata/server-runtime.json';
  const before = await readFile(runtimeFile, 'utf8');
  const state = json(before);
  const [projection, view] = await Promise.all([
    runtimeRpc(config, state?.origin, 'orchestration.getThreadProjection', receipt.threadId),
    run(config.t3, ['thread', 'show', '--base-dir', base, receipt.threadId, '--messages', '1', '--json'], { cwd: '/' }),
  ]);
  const effective = projection?.thread;
  const thread = json(view)?.thread;
  return before === await readFile(runtimeFile, 'utf8') && effective?.id === receipt.threadId &&
    thread?.threadId === receipt.threadId && thread.projectId === expected.project &&
    thread.worktreePath === expected.worktree && thread.latestRunId === receipt.runId &&
    sameReportBinding(expected, { model: effective.modelSelection, runtimeMode: effective.runtimeMode });
}

export function reviewRuntime(base) {
  return {
    binding: () => readPrivateBinding(base),
    importProgress: (config) => privateRead(config.progressCopy),
    reap: async (config, scheduledAt) => {
      if (config.mode !== 'active') return readReapReceipt(config, scheduledAt);
      if (!await stillBound(base, config)) throw new Error('active binding changed before reap');
      return activeReap(config);
    },
    discover: discoverReviewPRs,
    launch: (config, runId) => managerLaunch(base, config, runId),
    verifyManager: (config, expected, receipt) => verifyManager(base, config, expected, receipt),
    inventory: (config, state, watermarks) => threads(base, config, state, watermarks), quietFacts,
  };
}
