import { execFile } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import prompt from '../../references/pr-triage-nightly.md' with { type: 'text' };
import { bindingMatches } from '../binding.mjs';
import { DAILY_TIME, IDENTITY, NAME, sameReportBinding, slotOwner, triageFacts, VERSION } from '../pr-triage.mjs';

const runtimeFile = decodeURIComponent(new URL('../userdata/server-runtime.json', import.meta.url).pathname);
const manifestFile = new URL('../.axstack-workflows.json', import.meta.url);
const reportHeading = '\n## Report instructions\n';
const guidance = prompt.split(reportHeading)[1];
const decisionSchema = Schema.Json;
const claimSchema = Schema.Struct({ scheduledAt: Schema.String, runId: Schema.String });
const repoName = /^(?!\.{1,2}\/)[A-Za-z0-9_.-]+\/(?!\.{1,2}$)[A-Za-z0-9_.-]+$/;
const absolute = (path) => typeof path === 'string' && path.startsWith('/');
const forgeEnvironment = ['XDG_CONFIG_HOME', 'GH_CONFIG_DIR', 'GH_TOKEN', 'GITHUB_TOKEN'];

class Hold extends Error {}

const holdOnFailure = (tryRead) => Effect.tryPromise({
  try: tryRead, catch: (error) => error instanceof Hold ? error : new Error('nightly triage evidence is unavailable'),
});

async function privateBytes(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.uid !== process.getuid() || (info.mode & 0o077)) throw new Error();
  return readFile(path);
}

async function readBinding() {
  try {
    const record = JSON.parse(await privateBytes(manifestFile)).workflows[IDENTITY];
    if (!absolute(record.binding)) return null;
    const bytes = await privateBytes(record.binding);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const digest = Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
    if (!bindingMatches(record.bindingDigest, digest)) return null;
    const binding = JSON.parse(bytes);
    const { bun, skillsDirectory, project, registryTokenFile, repositories } = binding;
    if (![bun, skillsDirectory, registryTokenFile].every(absolute) || typeof project !== 'string' ||
        !/^[A-Za-z0-9_-]+$/.test(project) || !Array.isArray(repositories) || repositories.length === 0 ||
        !repositories.every((repo) => typeof repo === 'string' && repoName.test(repo)) ||
        new Set(repositories.map((repo) => repo.toLowerCase())).size !== repositories.length) return null;
    return binding;
  } catch {
    return null;
  }
}

function factCommand(bun, script, args, timeout, extraEnvironment = []) {
  // T3's native loader runs without Bun globals. The subprocess is the Bun fact helper.
  const names = ['PATH', 'HOME', 'TMPDIR', ...extraEnvironment];
  const env = Object.fromEntries(names.filter((name) => process.env[name] !== undefined)
    .map((name) => [name, process.env[name]]));
  return new Promise((resolve) => {
    execFile(bun, ['--no-env-file', script, ...args], { cwd: '/', env, timeout, maxBuffer: 2 * 1024 * 1024, killSignal: 'SIGKILL' },
      (error, stdout) => {
        try {
          resolve(!error || error.code === 2 ? JSON.parse(stdout) : null);
        } catch {
          resolve(null);
        }
      }).stdin?.end();
  });
}

function reportBinding({ bun, skillsDirectory, registryTokenFile }, threadId) {
  return factCommand(bun, `${skillsDirectory}/scripts/pr-triage-binding.js`,
    [runtimeFile, registryTokenFile, `${skillsDirectory}/roles.json`, ...(threadId ? [threadId] : [])], 8000);
}

async function collect() {
  const binding = await readBinding();
  if (!binding) throw new Hold('private binding is missing, invalid, or changed');
  if (!guidance) throw new Hold('shared report instructions unavailable');
  const { bun, skillsDirectory, project, repositories } = binding;
  const observation = await factCommand(bun, `${skillsDirectory}/references/pr-triage-collect.js`, repositories, 100_000, forgeEnvironment);
  const seat = await reportBinding(binding);
  if (seat?.status !== 'pass' || !seat.binding) throw new Hold(seat?.reason ?? 'report agent binding helper is unavailable');
  return { ...triageFacts(repositories, observation), project, seat: seat.binding };
}

export default T3.workflow(NAME, {
  version: VERSION, payload: T3.Tick, returns: decisionSchema, triggers: [T3.daily(DAILY_TIME)], resumeAfter: [],
}, ({ scheduledAt }) => Effect.gen(function* () {
  const runId = yield* T3.step('claim-slot', { returns: decisionSchema }, Effect.gen(function* () {
    const id = slotOwner(scheduledAt, yield* T3.runs({ workflow: NAME }), Date.now());
    if (!id) return null;
    const claim = T3.store.entry(`${IDENTITY}:latest-slot`, claimSchema);
    return yield* T3.store.transaction(Effect.gen(function* () {
      const previous = yield* claim.get;
      if (Option.isSome(previous) && previous.value.scheduledAt >= scheduledAt) {
        return previous.value.scheduledAt === scheduledAt && previous.value.runId === id ? id : null;
      }
      yield* claim.set({ scheduledAt, runId: id });
      return id;
    }));
  }));
  if (!runId) return yield* T3.stop('nightly slot unavailable, stale, or already claimed');

  const { decision, facts, project, seat } = yield* T3.step('collect-facts', { returns: decisionSchema }, holdOnFailure(collect));
  const report = yield* T3.agent.try('write-report', {
    project, ...seat, title: 'Nightly PR triage', timeout: '10 minutes',
    brief: `AXSTACK-WAKE ${IDENTITY} run ${runId}\n\nUse only the provided facts and write the report as your final reply. Use no tools.\n\n${guidance}\n\nCollected JSON data:\n${JSON.stringify(facts)}`,
  });

  return yield* T3.step('verify-report-binding', { returns: decisionSchema }, holdOnFailure(async () => {
    const threadId = report.thread?.threadId;
    if (!threadId) throw new Hold('report agent did not start');
    const binding = await readBinding();
    if (!binding) throw new Hold('private binding changed before report verification');
    const observed = await reportBinding(binding, threadId);
    if (observed?.status !== 'pass') throw new Hold(observed?.reason ?? 'report agent binding helper is unavailable');
    if (!sameReportBinding(seat, observed.binding)) throw new Hold('effective report agent binding mismatched');
    if (report.outcome !== 'done' || !report.value?.trim()) throw new Hold('report agent did not return a report');
    return { decision, scheduledAt, threadId, binding: 'pass' };
  }));
}));
