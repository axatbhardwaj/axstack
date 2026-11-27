import { expect, test } from 'bun:test';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { makeTempRoot } from '../installer/helpers.js';
import { hash, managerIdentity, version, workflowName } from '../../skills/axstack/workflows/review-manager.mjs';

const source = `${import.meta.dir}/../../skills/axstack`;
const { quiet } = await Bun.file(import.meta.dir + '/fixtures/review-manager-predecessor.json').json();
const threadId = 'mcp:2f5f844a-87ee-4f85-a509-782c4845a8e8';
const nativeId = quiet.input.prior.thread.threadId;
const projectId = quiet.input.inventory.args.projectId;
// Sanitized fields from POC-6 owner-after-idle-cli and idle-cli. The CLI
// reports a single current state, while the projection reports queued runs.
const thread = {
  threadId, projectId, status: 'completed', activeRunId: null, runCount: 16,
  pendingRequestCount: 0, pendingBackgroundTasks: [], blockedOnThreadWait: false,
  archived: false, snoozed: false, providerInstanceId: 'claudeAgent', model: 'claude-opus-5-5',
};
const delivery = { threadId, runId: 'run:thread:mcp%3Afixture:ordinal:17',
  messageId: 'message:mcp:client%3Afixture:thread-send:fixture', delivery: 'started', status: 'starting' };
const completedRuns = Array.from({ length: 16 }, (_, index) => ({ id: 'run-' + index, status: 'completed' }));

const action = (run) => ({ run, *[Symbol.iterator]() { return yield run; } });
function gen(body) {
  return action(async () => {
    const operations = body();
    let next = operations.next();
    while (!next.done) next = operations.next(await next.value());
    return next.value;
  });
}

function fakeRuntime() {
  const values = new Map();
  let inTransaction = false;
  Object.assign(globalThis, {
    Schema: new Proxy({}, { get: (_target, name) => ['String', 'Number', 'Boolean', 'Json'].includes(name) ? {} : (shape) => shape }),
    Effect: { gen, fail: (error) => action(() => { throw error; }),
      tryPromise: (effect) => action(async () => {
        try { return await effect.try(); } catch (error) { throw effect.catch(error); }
      }),
    },
    Option: { isSome: ({ value }) => value !== undefined },
    T3: {
      Tick: {}, runs: () => action(() => []), every: (value) => value,
      workflow: (_name, _schema, body) => body,
      step: (name, _schema, effect) => action(async () => {
        try { return await effect.run(); } catch (error) { throw Object.assign(error, { step: name }); }
      }),
      store: {
        transaction: (effect) => action(async () => {
          inTransaction = true;
          try { return await effect.run(); } finally { inTransaction = false; }
        }),
        entry: (key) => ({
          get: action(() => ({ value: values.get(key) })),
          set: (value) => action(() => {
            if (!inTransaction) throw new Error('write escaped the store transaction');
            values.set(key, value);
          }),
        }),
      },
      agent: { try: () => { throw new Error('active entry attempted an agent step'); } },
    },
  });
  return values;
}

test('the shipped workflow wakes one existing thread and reads manager and native-pass occupancy', async () => {
  const root = makeTempRoot('axstack-active-review-');
  const env = { PATH: `${root}/bin:/usr/bin:/bin`, HOME: root + '/home', TMPDIR: root,
    AXSTACK_ACTIVE_TEST_SENTINEL: 'synthetic' };
  const fixedKeys = [...Object.keys(env), 'GH_TOKEN', 'GITHUB_TOKEN', 'GH_CONFIG_DIR', 'XDG_CONFIG_HOME'];
  const original = Object.fromEntries(fixedKeys.map((key) => [key, process.env[key]]));
  let server, scenario;
  try {
    for (const dir of ['workflows', 'bin', 'home', 'project', 'userdata', 'skills', 'skills/sandbox']) {
      mkdirSync(root + '/' + dir, { mode: 0o700 });
    }
    const command = (name, script) => writeFileSync(root + '/bin/' + name,
      '#!/bin/sh\nset -eu\ntest -z "$(printenv AXSTACK_ACTIVE_TEST_SENTINEL || true)"\n' + script + '\n', { mode: 0o700 });
    const token = root + '/token';
    const project = root + '/project';
    const progress = root + '/progress.md';
    const config = {
      mode: 'active', project, projectId, projects: [project], managerThreadId: threadId,
      repository: quiet.input.repository, repositories: [quiet.input.repository], nativePassThreadId: nativeId,
      progressCopy: progress, bun: process.execPath, t3: root + '/bin/t3',
      skillsDirectory: root + '/skills', registryTokenFile: token,
    };
    command('git', `touch "${root}/git-called"; exit 4`);
    command('gh', 'exit 1');
    command('docker', 'test "$*" = "info --format {{.ServerVersion}}"\nprintf "%s\\n" 28.0.0');
    command('t3', `test "$4" = "${root}"
case "$2:$5" in
list:--project) printf '[]\\n';;
show:${threadId}) cat "${root}/manager.json";;
show:${nativeId}) cat "${root}/native.json";;
send:${threadId}) test "$#" = 7; test "$7" = --json
  printf '%s\\n' "$6" >> "${root}/messages"
  cat "${root}/delivery.json";;
*) exit 3;;
esac`);
    symlinkSync(source + '/scripts', config.skillsDirectory + '/scripts');
    writeFileSync(config.skillsDirectory + '/sandbox/launcher.js', `
if (process.env.AXSTACK_ACTIVE_TEST_SENTINEL || Bun.argv[2] !== 'reap') process.exit(8);
await Bun.write(${JSON.stringify(root + '/launcher-called')}, 'reap');
console.log('[]');
process.exit(Number(await Bun.file(${JSON.stringify(root + '/reap-exit')}).text()));
`);
    writeFileSync(token, 'synthetic-reader', { mode: 0o600 });
    writeFileSync(progress, quiet.progress, { mode: 0o600 });
    server = Bun.serve({ hostname: '127.0.0.1', port: 0,
      fetch(request, local) {
        if (request.headers.get('authorization') !== 'Bearer synthetic-reader') return new Response(null, { status: 401 });
        if (!local.upgrade(request)) return new Response(null, { status: 400 });
      },
      websocket: { message(socket, raw) {
        const request = JSON.parse(String(raw));
        expect(request.tag).toBe('orchestration.getThreadProjection');
        const id = request.payload.threadId;
        const value = id === threadId && scenario.missing ? null : {
          thread: { id, projectId, archivedAt: null, deletedAt: null },
          runs: id === threadId ? (scenario.runs === undefined ? completedRuns : scenario.runs) : [],
        };
        socket.send(JSON.stringify({ _tag: 'Chunk', requestId: request.id, values: [value] }));
      } },
    });
    writeFileSync(root + '/userdata/server-runtime.json', JSON.stringify({
      origin: server.url.origin, pid: process.pid, startedAt: new Date().toISOString(),
    }));
    const bind = (changed) => {
      const binding = root + '/binding.json';
      writeFileSync(binding, JSON.stringify({ ...config, ...changed }), { mode: 0o600 });
      writeFileSync(root + '/.axstack-workflows.json', JSON.stringify({ workflows: {
        [managerIdentity]: { binding, bindingDigest: hash(JSON.stringify(config)) },
      } }), { mode: 0o600 });
    };
    for (const key of fixedKeys) delete process.env[key];
    Object.assign(process.env, env);
    const values = fakeRuntime();
    const bundle = `${workflowName}-v${version}.mjs`;
    copyFileSync(source + '/workflows/bundles/' + bundle, root + '/workflows/' + bundle);
    const run = (await import(root + '/workflows/' + bundle)).default;
    const now = Date.now();
    const cases = [
      { decision: 'woke', count: 1 },
      { decision: 'busy', manager: { status: 'running', activeRunId: delivery.runId } },
      { decision: 'busy', manager: { pendingBackgroundTasks: [{ taskId: 'delegate:pr-job' }] } },
      { decision: 'busy', runs: [...completedRuns, { id: 'next-turn', status: 'queued' }] },
      { decision: 'busy', manager: { blockedOnThreadWait: true } },
      { decision: 'woke', count: 1, reapExit: 2 },
      { decision: 'busy', native: { status: 'running', runCount: 16 } },
      { decision: 'busy', native: { status: 'running' }, managerContinuity: true },
      { decision: 'busy', native: { pendingBackgroundTasks: [{ taskId: 'delegate:native-pr-job' }] } },
      { step: 'manager-wake', manager: { archived: true } },
      { step: 'manager-wake', missing: true },
      { step: 'manager-wake', manager: { snoozed: true } },
      { decision: 'woke', count: 1, manager: { status: 'unknown' }, reason: 'manager-activity:unknown' },
      { decision: 'woke', count: 1, runs: null, reason: 'manager-activity:unknown' },
      { decision: 'woke', count: 1, native: { status: 'unknown' }, reason: 'native-pass-activity:unknown' },
      { decision: 'busy', manager: { status: 'unknown', activeRunId: delivery.runId } },
      { decision: 'busy', manager: { status: 'unknown' }, native: { status: 'running' } },
      { step: 'manager-wake', count: 1, delivery: { ...delivery, threadId: 'wrong-thread' } },
      { step: 'binding', edit: { mode: 'report' } },
      { step: 'binding', edit: { managerThreadId: 'wrong-thread' } },
      { step: 'claim-slot', repeat: true },
    ];
    for (const [index, next] of cases.entries()) {
      scenario = next;
      const runId = index.toString(16).padStart(32, '0');
      const scheduledAt = new Date(now + (index - Number(next.repeat ?? false)) * 1_800_000).toISOString();
      bind(next.edit ?? {});
      writeFileSync(progress, next.managerContinuity ? quiet.progress.replace(nativeId, threadId) : quiet.progress);
      writeFileSync(root + '/messages', '');
      writeFileSync(root + '/reap-exit', String(next.reapExit ?? 0));
      writeFileSync(root + '/manager.json', JSON.stringify(next.missing ? { error: 'thread missing' } : { thread: { ...thread, ...next.manager } }));
      writeFileSync(root + '/native.json', JSON.stringify({ thread: { ...thread, threadId: nativeId, ...next.native } }));
      writeFileSync(root + '/delivery.json', JSON.stringify(next.delivery ?? delivery));
      const result = await run({ scheduledAt }, { id: runId }).run()
        .catch((error) => ({ decision: 'paused', step: error.step }));
      expect(result).toMatchObject(next.step ? { decision: 'paused', step: next.step } : { decision: next.decision, mode: 'active' });
      if (next.reason) expect(result.reasons).toContain(next.reason);
      if (next.reapExit) expect(result.reasons).toContain('reap:fail');
      expect(readFileSync(root + '/messages', 'utf8')).toBe(next.count ?
        `AXSTACK-WAKE ${managerIdentity} run ${runId}\nManager ${threadId}\n` : '');
    }
    expect([...values.keys()]).toEqual([managerIdentity + ':latest-slot']);
    expect(readFileSync(progress, 'utf8')).toBe(quiet.progress);
    expect(readFileSync(root + '/launcher-called', 'utf8')).toBe('reap');
    expect(existsSync(root + '/git-called')).toBe(false);
  } finally {
    await server?.stop(true);
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    rmSync(root, { recursive: true });
  }
}, 15_000);
