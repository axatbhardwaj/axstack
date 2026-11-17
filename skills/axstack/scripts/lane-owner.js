#!/usr/bin/env bun
import { readFileSync } from 'node:fs';

const HELP = `lane-owner — saved T3 lane liveness facts (R2 fact)
  bun --no-env-file /absolute/lane-owner.js --input FILE --owner-thread ID --owner-run ID [--job-thread ID ...]
  --input FILE       Saved {preSettle:true,args,value} from t3_thread_list before this pass
                     settles anything; preSettle is a caller assertion, not authenticated.
                     Missing/false preSettle keeps all facts unknown. value contains threads,
                     nextCursor:null and total matching the full merged inventory.
                     args must include includeSubagents:true and allProjects:true or
                     projectId matching the owner; no status/settled/snoozed/title filters.
                     Merge all pages first; preserve the first page args (cursor absent/0).
  --owner-thread ID  Exact earlier pass thread from durable continuity, never a title.
  --owner-run ID     Exact earlier run from continuity; a resumed run is reported separately.
  --job-thread ID    Repeat for recorded PR jobs outside the owner's parentThreadId tree.
                     All descendants of owner/jobs are included automatically.
  --help             Show flags, input contract, effects and limitations.
Terms test complete inventory, matching owner run, inactive owner and inactive jobs.
Pass inactive requires terminal status AND settled:true; idle/unsettled is unknown.
Running/preparing/queued/starting/waiting fails inactive even with stale settled metadata.
Unknown/truncated inventory keeps liveness unknown. Failed terms remain measured facts.
No takeover, admission, retirement or cleanup authority; existing holds remain with driver.
Evidence is caller-supplied, not authenticated, freshened or an atomic lock. Snapshot facts
cannot prove process exit, user takeover, inactivity duration or continuity reconciliation.
Effects: reads only FILE, prints JSON to stdout; no writes, subprocess, network,
live T3 access, dispatch, schedule, retry, notify, merge or persistent state.
Exit: 0 measured (including fail), 1 invalid invocation/JSON, 2 incomplete/unknown.
`;
const ids = ['inventory.complete', 'owner.run', 'owner.inactive', 'jobs.inactive'];
const term = (id, status, evidence) => ({ id, status, evidence });

const text = value => typeof value === 'string' && value.length > 0;
const active = new Set(['preparing', 'queued', 'starting', 'running', 'waiting']);
const terminal = new Set(['completed', 'interrupted', 'failed', 'cancelled', 'rolled_back']);
const observation = row => ({ threadId: row.threadId, runId: row.latestRunId ?? null,
  status: row.status ?? null, settled: row.settled ?? null });
function inactive(row) {
  if (!row || !text(row.latestRunId)) return 'unknown';
  if (active.has(row.status)) return 'fail';
  return terminal.has(row.status) && row.settled === true ? 'pass' : 'unknown';
}

function facts(snapshot, ownerId, runId, jobs) {
  const unknown = reason => ids.map(id => term(id, 'unknown', { reason }));
  if (snapshot?.preSettle !== true) return unknown('pre-settle snapshot assertion missing or false');
  const input = snapshot?.args, value = snapshot?.value, rows = value?.threads;
  if (!input || !Array.isArray(rows) || snapshot.isError || value.isError
    || value.truncated || value.hasMore || value.complete === false
    || !Object.hasOwn(value, 'nextCursor') || value.nextCursor !== null || value.total !== rows.length
    || input.includeSubagents !== true || (input.cursor !== undefined && input.cursor !== 0)
    || ['statuses', 'settled', 'snoozed', 'titleContains'].some(key => Object.hasOwn(input, key))) {
    return unknown('missing, truncated or filtered thread inventory');
  }
  const byId = new Map();
  for (const row of rows) {
    if (!row || !text(row.threadId) || !text(row.projectId) || byId.has(row.threadId)
      || !(row.parentThreadId === null || text(row.parentThreadId)) || row.parentThreadId === row.threadId) {
      return unknown('malformed or duplicate thread identity/lineage');
    }
    byId.set(row.threadId, row);
  }
  const owner = byId.get(ownerId);
  if (input.allProjects !== true && (!text(input.projectId) || owner?.projectId !== input.projectId
    || rows.some(row => row.projectId !== input.projectId))) return unknown('owner project scope unavailable or mismatched');
  // A cycle cannot be a complete native ancestry tree.
  for (const row of rows) {
    const seen = new Set([row.threadId]);
    let parent = row.parentThreadId;
    while (byId.has(parent)) {
      if (seen.has(parent)) return unknown('cyclic thread lineage');
      seen.add(parent); parent = byId.get(parent).parentThreadId;
    }
  }
  const tree = new Set([ownerId, ...jobs]);
  let added;
  do {
    added = false;
    for (const row of rows) {
      if (tree.has(row.parentThreadId) && !tree.has(row.threadId)) { tree.add(row.threadId); added = true; }
    }
  } while (added);
  tree.delete(ownerId);
  const jobRows = [...tree].map(id => byId.get(id));
  const jobStates = jobRows.map(inactive);
  const jobStatus = jobStates.includes('unknown') ? 'unknown' : jobStates.includes('fail') ? 'fail' : tree.size ? 'pass' : 'n/a';
  return [
    term('inventory.complete', 'pass', { count: rows.length, projectId: input.projectId ?? null, allProjects: input.allProjects === true }),
    term('owner.run', !text(owner?.latestRunId) ? 'unknown' : owner.latestRunId === runId ? 'pass' : 'fail',
      { threadId: ownerId, expectedRunId: runId, current: owner ? observation(owner) : null }),
    term('owner.inactive', inactive(owner), owner ? observation(owner) : { missingThreadId: ownerId }),
    term('jobs.inactive', jobStatus, { threads: jobRows.filter(Boolean).map(observation),
      missingThreadIds: [...tree].filter(id => !byId.has(id)) }),
  ];
}

try {
  const argv = process.argv.slice(2), args = {}, jobs = [];
  if (argv.length === 1 && argv[0] === '--help') { console.log(HELP); process.exit(0); }
  for (let i = 0; i < argv.length; i += 2) {
    const [key, value] = argv.slice(i, i + 2);
    if (!['--input', '--owner-thread', '--owner-run', '--job-thread'].includes(key)
      || !value || value.startsWith('--') || (key !== '--job-thread' && args[key])) throw Error(`invalid argument: ${key}`);
    if (key === '--job-thread') jobs.push(value); else args[key] = value;
  }
  if (!args['--input'] || !args['--owner-thread'] || !args['--owner-run']) throw Error('expected --input, --owner-thread and --owner-run');
  let bytes;
  try { bytes = readFileSync(args['--input']); } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'EACCES') throw error;
  }
  const snapshot = bytes ? JSON.parse(bytes.toString()) : null;
  const terms = facts(snapshot, args['--owner-thread'], args['--owner-run'], jobs);
  const summary = Object.fromEntries(['pass', 'fail', 'unknown', 'n/a'].map(s => [s, terms.filter(t => t.status === s).length]));
  console.log(JSON.stringify({ schemaVersion: 1, input: { path: args['--input'],
    sha256: bytes ? new Bun.CryptoHasher('sha256').update(bytes).digest('hex') : null }, terms, summary }));
  process.exitCode = summary.unknown ? 2 : 0;
} catch (error) { console.error(`lane-owner: ${error.message}`); process.exitCode = 1; }
