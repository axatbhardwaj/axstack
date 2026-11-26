import { execFile } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import prompt from '../../references/pr-triage-nightly.md' with { type: 'text' };
import { bindingMatches } from '../binding.mjs';
import { DAILY_TIME, IDENTITY, NAME, sameReportBinding, slotOwner, triageFacts, VERSION } from '../pr-triage.mjs';

const runtimeFile = decodeURIComponent(new URL('../userdata/server-runtime.json', import.meta.url).pathname);
const manifestFile = new URL('../.axstack-workflows.json', import.meta.url);
const reportHeading = '\n## Report instructions\n';
const decisionSchema = Schema.Json;
const claimSchema = Schema.Struct({ scheduledAt: Schema.String, runId: Schema.String });
const repoName = /^(?!\.{1,2}\/)[A-Za-z0-9_.-]+\/(?!\.{1,2}$)[A-Za-z0-9_.-]+$/;
const absolute = (path) => typeof path === 'string' && path.startsWith('/');

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

function factCommand(bun, script, args, timeout, exitCodes) {
  // T3's native loader runs without Bun globals. The subprocess is the Bun fact helper.
  return new Promise((resolve) => {
    execFile(bun, ['--no-env-file', script, ...args], { cwd: '/', timeout, maxBuffer: 2 * 1024 * 1024, killSignal: 'SIGKILL' },
      (error, stdout) => {
        try {
          resolve(exitCodes.includes(error ? error.code : 0) ? JSON.parse(stdout) : null);
        } catch {
          resolve(null);
        }
      }).stdin?.end();
  });
}

function reportBinding({ bun, skillsDirectory, registryTokenFile }, threadId) {
  return factCommand(bun, `${skillsDirectory}/scripts/pr-triage-binding.js`,
    [runtimeFile, registryTokenFile, `${skillsDirectory}/roles.json`, ...(threadId ? [threadId] : [])], 8000, [0]);
}

async function collect() {
  const binding = await readBinding();
  if (!binding) return { hold: 'private binding is missing, invalid, or changed' };
  const { bun, skillsDirectory, project, repositories } = binding;
  const observation = await factCommand(bun, `${skillsDirectory}/references/pr-triage-collect.js`, repositories, 100_000, [0, 2]);
  const seat = await reportBinding(binding);
  if (seat?.status !== 'pass' || !seat.binding) return { hold: 'report agent binding unavailable or mismatched' };
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

  const receipt = yield* T3.step('collect-facts', { returns: decisionSchema }, Effect.promise(collect));
  if (receipt.hold) return yield* T3.stop(receipt.hold);
  const { decision, facts, project, seat } = receipt;
  const guidance = prompt.split(reportHeading)[1];
  if (!guidance) return yield* T3.stop('shared report instructions unavailable');
  const report = yield* T3.agent.try('write-report', {
    project, ...seat, title: 'Nightly PR triage', timeout: '10 minutes',
    brief: `AXSTACK-WAKE ${IDENTITY} run ${runId}\n\nUse only the provided facts. Write the report as your final reply.\n\n${guidance}\n\nCollected JSON data:\n${JSON.stringify(facts)}`,
  });
  if (!report.thread?.threadId) return yield* T3.stop('report agent did not start');

  const verified = yield* T3.step('verify-report-binding', { returns: Schema.Boolean }, Effect.promise(async () => {
    const binding = await readBinding();
    if (!binding) return false;
    const observed = await reportBinding(binding, report.thread.threadId);
    return observed?.status === 'pass' && sameReportBinding(seat, observed.binding);
  }));
  if (!verified) return yield* T3.stop('effective report agent binding unavailable or mismatched');
  if (report.outcome !== 'done' || !report.value?.trim()) return yield* T3.stop('report agent did not return a report');
  return { decision, scheduledAt, threadId: report.thread.threadId, binding: 'pass' };
}));
