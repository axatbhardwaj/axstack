import { execFile } from 'node:child_process';
import { lstat, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { bindingMatches } from './binding.mjs';
import { driverReadback, github, json, ownerBinding, run } from './dependabot-runtime.mjs';
import { githubPages } from './dependabot-pages.mjs';
import { busy, hash, reviewId, managerIdentity, interval, repository, time } from './review-manager.mjs';

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
    if (!config || !['shadow', 'report'].includes(config.mode) || !reviewId(config.projectId) ||
        !['project', 'bun', 't3', 'roles', 'registryTokenFile', 'skillsDirectory', 'progressCopy']
          .every((key) => path(config[key])) || !path(config.reapReceipt) ||
        !unique(config.projects, path) || !config.projects.includes(config.project) ||
        !unique(config.repositories, repository) || !config.repositories.includes(config.repository) ||
        config.progressCopy === config.reapReceipt) return null;
    return config;
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

function executeQuiet(config, input, progress, at) {
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR']
    .filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]]));
  return new Promise((resolve) => {
    const child = execFile(config.bun, ['--no-env-file', config.skillsDirectory + '/scripts/schedule-drift.js',
      'quiet-facts', '--input', input, '--continuity', progress, '--now', at],
    { cwd: '/', env, timeout: 10_000, maxBuffer: 4 * 1024 * 1024, killSignal: 'SIGKILL' },
    (error, stdout) => resolve(!error || error.code === 2 ? json(stdout) : null));
    child.stdin?.on('error', () => {});
    child.stdin?.end();
  });
}

async function quietFacts(config, progress, input) {
  const dir = await mkdtemp(tmpdir() + '/axstack-review-manager-');
  try {
    await Promise.all([
      writeFile(dir + '/input.json', JSON.stringify(input), { mode: 0o600 }),
      writeFile(dir + '/progress.md', progress, { mode: 0o600 }),
    ]);
    const report = await executeQuiet(config, dir + '/input.json', dir + '/progress.md', input.observedAt);
    if (!Array.isArray(report?.terms)) return null;
    return { version: report.version, terms: report.terms.map((term) => ({ id: term?.id ?? null, status: term?.status ?? null })) };
  } finally {
    await rm(dir, { recursive: true });
  }
}

export function reviewRuntime(base) {
  const sameBinding = async (config) => JSON.stringify(await readPrivateBinding(base)) === JSON.stringify(config);
  return {
    binding: () => readPrivateBinding(base), sameBinding,
    importProgress: (config) => privateRead(config.progressCopy), reap: readReapReceipt, discover: discoverReviewPRs,
    inventory: (config, state, watermarks) => threads(base, config, state, watermarks), quietFacts,
    resolveSeat: (config) => ownerBinding(base, config),
    verifySeat: async (config, expected, threadId) =>
      await sameBinding(config) && JSON.stringify((await ownerBinding(base, config))?.model) === JSON.stringify(expected.model) &&
      (await driverReadback(base, config, expected, null, threadId))?.thread?.projectId === config.projectId,
  };
}
