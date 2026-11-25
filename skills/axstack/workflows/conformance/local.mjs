import { Database } from 'bun:sqlite';
import { unlinkSync, writeFileSync } from 'node:fs';

const waitName = 'ax-conf-upgrade';
const durable = 'ax-conf-durable';
const fixtures = new URL('./fixtures/', import.meta.url);

function check(expected, message) {
  if (!expected) throw new Error(message);
}

async function sample(read, predicate, message, ms = 12_000) {
  const deadline = Date.now() + ms;
  do {
    const value = read();
    if (predicate(value)) return value;
    await Bun.sleep(150);
  } while (Date.now() < deadline);
  throw new Error(message);
}

function rev(server, version) {
  const file = server.workflows + '/' + waitName + '-v' + version + '.mjs';
  const body = version === 1
    ? "T3.wait('release', { returns: Schema.String }).pipe(Effect.map(answer => Option.getOrNull(answer)))"
    : 'Effect.succeed(2)';
  writeFileSync(file, `export default T3.workflow('${waitName}', { version: ${version}, payload: Schema.Null }, () => ${body});\n`);
  return file;
}

function signal(server, runId, name, key, answer) {
  return server.command('workflow', 'signal', '--run', runId, '--wait', name, '--id', key, JSON.stringify(answer));
}

async function schedules(server) {
  const all = () => server.command('workflow', 'list', '--json');
  const dbPath = server.base + '/userdata/statev2.sqlite';
  await server.stop();
  const db = new Database(dbPath, { readwrite: true });
  let original;
  let missed;
  try {
    const daily = db.query("SELECT trigger_id, next_at FROM workflow_triggers WHERE trigger_id LIKE 'ax-conf-daily/%'").get();
    check(daily, 'daily trigger missing');
    original = daily.next_at;
    missed = new Date(Date.parse(original) - 172_800_000).toISOString();
    check(db.query('UPDATE workflow_triggers SET next_at = ? WHERE trigger_id = ?').run(missed, daily.trigger_id).changes === 1,
      'missed daily slot was not seeded');
  } finally {
    db.close();
  }
  await server.restart();
  const runs = await sample(all, (entries) => entries.some((run) => run.workflow === 'ax-conf-interval' && run.status === 'completed') &&
    entries.some((run) => run.workflow === 'ax-conf-daily' && run.status === 'completed'),
    'interval and daily slots did not both complete', 100_000);
  const daily = runs.filter((run) => run.workflow === 'ax-conf-daily');
  check(daily.filter((run) => run.result === original).length === 1 && !daily.some((run) => run.result === missed),
    'daily slot was duplicated or the missed slot replayed');
  const interval = runs.filter((run) => run.workflow === 'ax-conf-interval');
  const seen = interval.map((run) => run.result?.scheduledAt);
  check(seen.length === new Set(seen).size && seen.every(Boolean), 'an interval slot was duplicated or missing');
  server.command('workflow', 'store', 'delete', 'ax-conformance-tick-claim');
  const owner = server.start(durable, 'stale-owner', 'wait');
  await server.waitFor(owner.runId, 'waiting');
  const tick = { scheduledAt: new Date(Date.now() + 300_000).toISOString() };
  const gated = server.start('ax-conf-interval', 'gated', tick);
  const { result: held } = await server.waitFor(gated.runId, 'completed');
  check(held?.decision === 'active' && held.stale === 1, 'active owner or stale gate was missed');
  server.command('workflow', 'cancel', owner.runId, '--json');
  const acquired = server.start('ax-conf-interval', 'acquired', tick);
  check((await server.waitFor(acquired.runId, 'completed')).result?.decision === 'acquired', 'drained owner did not release gate');
  const duplicate = server.start('ax-conf-interval', 'already-claimed', tick);
  check((await server.waitFor(duplicate.runId, 'completed')).result?.decision === 'claimed', 'duplicate gate took another claim');
  return 'interval, daily, missed daily, and active/stale owner gating';
}

async function durability(server) {
  for (const kind of ['SIGTERM', 'SIGKILL']) {
    const waiting = server.start(durable, kind + '-wait', 'wait');
    const sleeping = server.start(durable, kind + '-sleep', 'sleep');
    await server.waitFor(waiting.runId, 'waiting');
    await server.waitFor(sleeping.runId, 'waiting');
    await server.restart(kind);
    signal(server, waiting.runId, 'release', kind, 'released');
    check((await server.waitFor(waiting.runId, 'completed')).result === 'released', 'wait result changed');
    check((await server.waitFor(sleeping.runId, 'completed', 20_000)).result === 'woke', 'sleep did not recover');
  }
  const paused = server.start(durable, 'retry', 'pause');
  await server.waitFor(paused.runId, 'paused');
  writeFileSync(server.root + '/ready', 'resumed');
  server.command('workflow', 'resume', paused.runId, '--json');
  check((await server.waitFor(paused.runId, 'completed')).result === 'resumed', 'failed step did not resume');

  let requests = 0;
  let accepted = 0;
  const receiver = Bun.serve({
    hostname: '127.0.0.1', port: 0, fetch: (request) => {
      if (request.method !== 'PUT' || new URL(request.url).pathname !== '/once') return new Response(null, { status: 404 });
      requests++;
      const created = accepted === 0;
      if (created) accepted++;
      return Response.json({ created });
    },
  });
  try {
    writeFileSync(server.root + '/receiver', String(receiver.port));
    const write = server.start(durable, 'remote-write', 'write');
    await sample(() => requests, (count) => count === 1, 'fixture receiver was never reached');
    await server.restart('SIGKILL');
    await server.waitFor(write.runId, 'completed');
    check(accepted === 1 && requests === 2, 'interrupted request did not replay under the same idempotency key');
  } finally {
    await receiver.stop(true);
  }
  return 'sleep and wait across TERM and KILL, resume, and idempotent replay';
}

async function questions(server) {
  writeFileSync(server.root + '/head', 'first');
  for (const mode of ['cli', 'withdraw', 'timeout', 'moved']) {
    const run = server.start('ax-conf-ask', mode, mode);
    await server.waitFor(run.runId, 'waiting');
    if (mode === 'moved') writeFileSync(server.root + '/head', 'second');
    if (mode === 'withdraw') {
      server.command('workflow', 'withdraw', '--run', run.runId, '--wait', 'open-thread', '--reason', 'fixture', '--json');
    }
    if (mode === 'cli' || mode === 'moved') {
      for (let index = 0; index < 2; index++) signal(server, run.runId, 'open-thread', mode, { choice: 'open thread' });
    }
    const result = (await server.waitFor(run.runId, 'completed')).result;
    const answered = mode === 'cli' || mode === 'moved';
    check(result.holdCleared === false && result.stale === (mode === 'moved'), 'hold record was cleared or failed to mark a moved head');
    check(answered ? result.answer?.answeredBy === 't3 workflow signal' : result.answer === null, 'unexpected CLI answer attribution');
  }
  check(server.command('workflow', 'questions', '--json').length === 0, 'question remained listed after settlement');
  const hold = server.start('ax-conf-hold', 'read-sweep-hold');
  check((await server.waitFor(hold.runId, 'completed')).result === 'first', 'withdrawal removed the durable hold');
  return 'CLI attribution, duplicate signal, timeout, withdrawal, and stale hold';
}

async function persistence(server) {
  const start = (value) => Bun.spawn([
    server.t3, 'workflow', 'start', '--base-dir', server.base, '--key', value, '--input', JSON.stringify(value),
    '--json', 'ax-conf-store',
  ], { env: server.env, stderr: 'pipe' });
  const pair = ['alpha', 'beta'].map(start);
  const runs = await Promise.all(pair.map(async (process) => {
    const report = await new Response(process.stdout).json();
    check(await process.exited === 0, 'concurrent start failed');
    return report.run;
  }));
  const results = await Promise.all(runs.map(({ runId }) => server.waitFor(runId, 'completed')));
  const owner = results.find(({ result }) => result.acquired)?.result.owner;
  check(owner && results.filter(({ result }) => result.acquired).length === 1 &&
    results.every(({ result }) => result.owner === owner), 'transactional claim was not exclusive');
  check(results[0].result.child?.value === 'child:alpha' && results[1].result.child?.value === 'child:beta', 'invoke result was lost');
  const later = server.start('ax-conf-store', 'third', 'third');
  check((await server.waitFor(later.runId, 'completed')).result.owner === owner, 'claim was lost between runs');
  check(server.start('ax-conf-store', 'alpha', 'different').runId === runs[0].runId, 'duplicate key allocated a new run');
  return 'exclusive claims, durable store, invoke, and duplicate start';
}

async function upgrade(server) {
  rev(server, 1);
  const first = server.start(waitName, 'first');
  await server.waitFor(first.runId, 'waiting');
  const secondFile = rev(server, 2);
  await server.restart();
  const second = server.start(waitName, 'second');
  check(second.version === 2 && (await server.waitFor(second.runId, 'completed')).result === 2, 'v2 was not loaded');
  signal(server, first.runId, 'release', 'version-one', 'original');
  check((await server.waitFor(first.runId, 'completed')).result === 'original', 'v1 failed to drain');
  unlinkSync(secondFile);
  await server.restart();
  const rolledBack = server.start(waitName, 'rollback');
  check(rolledBack.version === 1, 'v1 did not load after rollback');
  server.command('workflow', 'cancel', rolledBack.runId, '--json');
  return 'both definitions, v1 replay, and rollback in T3CODE_WORKFLOWS';
}

export async function runLocalCases(server) {
  const engine = await Bun.file(new URL('engine.mjs', fixtures)).text();
  // Schedule the calendar case at the next minute with at least 15 seconds of setup time.
  const slot = new Date(Date.now() + 75_000).toISOString().slice(11, 16);
  writeFileSync(server.workflows + '/engine.mjs', engine.replace("daily('00:00')", `daily('${slot}')`));
  await server.restart();
  const cases = { 'POC-2': schedules, 'POC-3': durability, 'POC-5': questions, 'POC-7': persistence, 'POC-9': upgrade };
  const verdicts = {};
  for (const [name, probe] of Object.entries(cases)) {
    try {
      verdicts[name] = { status: 'pass', detail: await probe(server) };
    } catch (error) {
      verdicts[name] = { status: 'fail', detail: error.message };
    }
  }
  return verdicts;
}
