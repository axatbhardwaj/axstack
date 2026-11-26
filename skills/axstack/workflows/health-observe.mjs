import { Database } from 'bun:sqlite';
import catalog from './catalog.json';
import { workflowRegistry } from './health-registry.mjs';

const STATUSES = ['running', 'waiting', 'paused'];
const JOURNAL_LIMIT = 1000;
const SHOW_LIMIT = 12;
const readJson = (path) => Bun.file(path).json().catch(() => null);

function readT3(t3, args) {
  try {
    const receipt = Bun.spawnSync([t3, ...args], { timeout: 10_000, stderr: 'ignore' });
    return receipt.exitCode === 0 ? receipt.stdout.toString() : null;
  } catch {
    return null;
  }
}

function workflowRead(t3, base, command, ...args) {
  const output = readT3(t3, ['workflow', command, '--base-dir', base, '--json', ...args]);
  try {
    return output === null ? null : JSON.parse(output);
  } catch {
    return null;
  }
}

function canonicalScheduleTime(time) {
  const date = new Date(time);
  return Number.isFinite(date.getTime()) && date.toISOString() === time ? time : null;
}

function latestScheduleTimes(db, triggers) {
  const columns = db.query("PRAGMA index_xinfo('workflow_runs_key')").all().filter(({ key }) => key === 1);
  if (columns.map(({ name }) => name).join(',') !== 'workflow,idempotency_key') return {};
  if (columns.some(({ coll }) => coll !== 'BINARY')) return {};
  const latest = db.query(`
    SELECT idempotency_key AS key FROM workflow_runs INDEXED BY workflow_runs_key
    WHERE workflow COLLATE BINARY = ?
      AND idempotency_key COLLATE BINARY >= ? AND idempotency_key COLLATE BINARY < ?
    ORDER BY idempotency_key COLLATE BINARY DESC LIMIT 1
  `);
  const times = new Map();
  for (const { triggerId } of triggers) {
    const slash = triggerId.indexOf('/');
    if (slash <= 0) continue;
    const prefix = `trigger:${triggerId}`;
    const row = latest.get(triggerId.slice(0, slash), `${prefix}:`, `${prefix};`);
    if (!row) times.set(triggerId, null);
    else {
      // T3's zero-padded UTC keys sort in scheduled-time order.
      const time = canonicalScheduleTime(row.key.slice(prefix.length + 1));
      if (time !== null) times.set(triggerId, time);
    }
  }
  return Object.fromEntries(times);
}

function readJournal(path) {
  let db;
  try {
    db = new Database(path, { readonly: true });
    db.exec('BEGIN');
    const triggers = db.query(`
      SELECT trigger_id AS triggerId, next_at AS nextAt FROM workflow_triggers
      ORDER BY trigger_id LIMIT ?
    `).all(JOURNAL_LIMIT + 1);
    // Bound the source reads before filtering. A limit after WHERE and ORDER BY
    // can still scan or sort the entire journal when matching runs are sparse.
    const rows = db.query(`
      SELECT run_id AS runId, workflow, version, idempotency_key AS idempotencyKey,
        parent_run_id AS parentRunId, status, started_at AS startedAt, ended_at AS endedAt,
        CASE WHEN idempotency_key GLOB 'trigger:*' AND json_valid(input_json)
          THEN json_extract(input_json, '$.scheduledAt') END AS scheduledAt,
        (idempotency_key GLOB 'trigger:*' AND status = 'skipped' AND input_json IS NULL
          AND parent_run_id IS NULL) AS clearedSkippedInput,
        CASE WHEN workflow = 'axstack-load-probe' AND json_valid(result_json)
          THEN json_extract(result_json, '$.workflow') END AS probeWorkflow,
        CASE WHEN workflow = 'axstack-load-probe' AND json_valid(result_json)
          THEN json_extract(result_json, '$.binding') END AS binding
      FROM workflow_runs
      ORDER BY rowid DESC LIMIT ?
    `).all(JOURNAL_LIMIT + 1);
    const runs = rows.slice(0, JOURNAL_LIMIT)
      .filter(({ workflow, idempotencyKey }) => idempotencyKey?.startsWith('trigger:') ||
        (workflow === 'axstack-load-probe' && idempotencyKey?.startsWith('axstack-watchdog-')))
      .map(({ clearedSkippedInput, ...run }) => {
        // T3 clears skipped top-level input but retains the canonical UTC timestamp at the end of the key.
        if (clearedSkippedInput) run.scheduledAt = canonicalScheduleTime(run.idempotencyKey.slice(-24));
        return run;
      });
    const complete = triggers.length <= JOURNAL_LIMIT && rows.length <= JOURNAL_LIMIT;
    const capturedTriggers = triggers.slice(0, JOURNAL_LIMIT);
    return { triggers: capturedTriggers, runs, complete,
      ...!complete && { latestScheduledAt: latestScheduleTimes(db, capturedTriggers) } };
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

function redactRun(run) {
  if (!run || typeof run !== 'object') return null;
  const { runId, workflow, version, status, startedAt, updatedAt, endedAt, retired } = run;
  return { runId, workflow, version, status, startedAt, updatedAt, endedAt, retired };
}

function redactShow(show) {
  if (!show || !Array.isArray(show.steps)) return null;
  return {
    run: redactRun(show.run),
    steps: show.steps.map(({ kind, status, threadId, environmentId, startedAt, endedAt }) =>
      ({ kind, status, threadId, environmentId, startedAt, endedAt })),
  };
}

function readActive(t3, base) {
  return Object.fromEntries(STATUSES.map((status) => {
    const rows = workflowRead(t3, base, 'list', '--status', status);
    return [status, Array.isArray(rows) ? rows.map(redactRun) : null];
  }));
}

async function observeRuntime(base, tokenPath, manifest) {
  const t3 = Bun.which('t3');
  if (!t3) return {};
  const root = base + '/userdata';
  const runtimePath = root + '/server-runtime.json';
  const runtime = await readJson(runtimePath);
  if (!Number.isSafeInteger(runtime?.pid) || typeof runtime.startedAt !== 'string') return {};

  const activeRuns = readActive(t3, base);
  const registry = await workflowRegistry(runtime.origin, tokenPath);
  if (!registry && !Object.values(activeRuns).some(Array.isArray)) return {};
  const owned = manifest?.workflows ?? {};
  const seen = Object.values(activeRuns).flatMap((rows) => rows ?? []).filter((run) =>
    typeof run?.runId === 'string' && /^[A-Za-z0-9_-]+$/.test(run.runId) && Object.hasOwn(owned, run.workflow + '@' + run.version));
  const shows = Object.fromEntries(seen.slice(0, SHOW_LIMIT).map(({ runId }) =>
    [runId, redactShow(workflowRead(t3, base, 'show', runId))]));
  const journal = readJournal(root + '/statev2.sqlite');
  const environment = await Bun.file(root + '/environment-id').text().catch(() => '');
  const cliVersion = /^t3 v(\S+)$/.exec(readT3(t3, ['--version'])?.trim() ?? '')?.[1];
  const after = await readJson(runtimePath);
  if (after?.pid !== runtime.pid || after.startedAt !== runtime.startedAt || after.serverVersion !== runtime.serverVersion) return {};
  return {
    t3: { serverVersion: runtime.serverVersion, startedAt: runtime.startedAt, cliVersion, environment: environment.trim() },
    registry, journal, activeRuns, shows,
  };
}

export async function runWorkflowObservation(flags) {
  const base = flags['base-dir'];
  const tokenPath = flags['registry-token-file'];
  if (!base?.startsWith('/') || !flags.conformance?.startsWith('/') || (tokenPath && !tokenPath.startsWith('/'))) {
    throw new Error('observe requires absolute --base-dir and --conformance paths and an absolute token file path if supplied');
  }
  const manifest = await readJson(base + '/.axstack-workflows.json');
  const receipt = await readJson(flags.conformance);
  const { version, environment, suite, status } = receipt ?? {};
  const runtime = await observeRuntime(base, tokenPath, manifest);
  console.log(JSON.stringify({
    reachable: true, evidence: 'local T3 CLI and statev2.sqlite', manifest, catalog,
    conformance: receipt ? { version, environment, suite, status } : null,
    ...runtime,
  }));
}
