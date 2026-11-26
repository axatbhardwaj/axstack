import { expect, test } from 'bun:test';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { makeTempRoot } from '../installer/helpers.js';

const skill = `${import.meta.dir}/../../skills/axstack`;
const identity = 'axstack-pr-triage@1';
const runId = '0'.repeat(32);
const threadId = 'report-thread';
const selection = { instanceId: 'codex', model: 'gpt-6.2-sol', options: [{ id: 'reasoningEffort', value: 'high' }] };

async function evaluate(generator) {
  let next = generator.next();
  while (!next.done) next = generator.next(await next.value());
  return next.value;
}

const effect = (run) => ({ *[Symbol.iterator]() { return yield run; }, run });

async function fixture(repositories, { options = ['high'], effective = selection, age = 0, drift = false, repeat = false } = {}) {
  const root = makeTempRoot('axstack-triage-workflow-');
  const base = `${root}/base`;
  const work = `${base}/workflows`;
  const skills = `${root}/skills`;
  for (const directory of [work, `${base}/userdata`, `${skills}/scripts`]) mkdirSync(directory, { recursive: true });
  copyFileSync(`${skill}/workflows/bundles/${identity.replace('@', '-v')}.mjs`, `${work}/triage.mjs`);
  for (const script of ['pr-triage-binding.js', 'resolve-models.js', 't3-workflow-read.js']) {
    copyFileSync(`${skill}/scripts/${script}`, `${skills}/scripts/${script}`);
  }
  mkdirSync(`${skills}/references`);
  copyFileSync(`${skill}/references/pr-triage-collect.js`, `${skills}/references/pr-triage-collect.js`);
  const roles = JSON.parse(await Bun.file(`${skill}/../../profiles/presets/mixed.json`).text());
  writeFileSync(`${skills}/roles.json`, JSON.stringify({ version: 1, roles: roles.roles }));
  writeFileSync(`${root}/gh`, `#!/bin/sh\nexec '${process.execPath}' --no-env-file '${import.meta.dir}/pr-triage-forge-fixture.js' "$@"\n`, { mode: 0o700 });
  writeFileSync(`${root}/bun`, `#!/bin/sh\nPATH='${root}':"$PATH" TRIAGE_TEST_TRACE='${root}/forge.jsonl' exec '${process.execPath}' "$@"\n`, { mode: 0o700 });
  writeFileSync(`${root}/registry-token`, 'fixture-read-token', { mode: 0o600 });
  const binding = JSON.stringify({ bun: `${root}/bun`, skillsDirectory: skills, project: 'fixture-project',
    registryTokenFile: `${root}/registry-token`, repositories });
  writeFileSync(`${root}/binding.json`, binding, { mode: 0o600 });
  const bindingDigest = new Bun.CryptoHasher('sha256').update(binding).digest('hex');
  writeFileSync(`${base}/.axstack-workflows.json`, JSON.stringify({
    workflows: { [identity]: { binding: `${root}/binding.json`, bindingDigest } },
  }), { mode: 0o600 });
  if (drift) writeFileSync(`${root}/binding.json`, binding + '\n');

  const rpcReads = [];
  const server = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    fetch(request, server) {
      if (request.headers.get('authorization') === 'Bearer fixture-read-token' && server.upgrade(request)) return;
      return new Response(null, { status: 403 });
    },
    websocket: {
      message(socket, raw) {
        const { id, tag, payload } = JSON.parse(raw);
        rpcReads.push(tag);
        const value = tag === 'server.getConfig' ? { providers: [{
          instanceId: 'codex', driver: 'codex', installed: true, enabled: true, status: 'ready', models: [{
            slug: 'gpt-6.2-sol', capabilities: { optionDescriptors: [{ id: 'reasoningEffort', options: options.map((id) => ({ id })) }] },
          }],
        }] } : tag === 'orchestration.getThreadProjection' && payload.threadId === threadId ? {
          thread: { id: threadId, modelSelection: effective, runtimeMode: 'full-access' },
        } : null;
        socket.send(JSON.stringify({ _tag: 'Exit', requestId: id, exit: { _tag: 'Success', value } }));
      },
    },
  });
  writeFileSync(`${base}/userdata/server-runtime.json`, JSON.stringify({ origin: String(server.url) }));

  const calls = [];
  const previous = Object.fromEntries(['Effect', 'Option', 'Schema', 'T3'].map((name) => [name, globalThis[name]]));
  const scheduledAt = new Date(Date.now() - age).toISOString();
  const runs = [{ status: 'running', key: `trigger:axstack-pr-triage/daily:02:00:all:${scheduledAt}`, id: runId }];
  let claim;
  Object.assign(globalThis, {
    Effect: { gen: (body) => effect(() => evaluate(body())), promise: effect },
    Schema: { Json: {}, String: {}, Boolean: {}, Struct: () => ({}) }, Option: { isSome: Boolean },
    T3: {
      workflow: (name, options, body) => ({ name, options, body }), daily: (time) => time,
      step: (_name, _options, operation) => operation, runs: () => effect(() => runs), stop: (detail) => effect(() => ({ detail })),
      store: { entry: () => ({ get: effect(() => claim), set: (value) => effect(() => { claim = { value }; }) }), transaction: (operation) => operation },
      agent: { try: (name, request) => effect(() => {
        calls.push({ name, ...request });
        return { outcome: 'done', value: 'Fixture report.', thread: { threadId } };
      }) },
    },
  });
  try {
    const { default: workflow } = await import(`${work}/triage.mjs`);
    expect(workflow.options.triggers).toEqual(['02:00']);
    const result = await workflow.body({ scheduledAt }).run();
    if (repeat) runs[0].id = '1'.repeat(32);
    const again = repeat ? await workflow.body({ scheduledAt }).run() : null;
    return { result, again, calls, rpcReads, scheduledAt, forge: await Bun.file(`${root}/forge.jsonl`).text().catch(() => '') };
  } finally {
    Object.assign(globalThis, previous);
    await server.stop(true);
  }
}

test.each([
  ['quiet', ['five/project'], [{ repo: 'five/project', coverage: { status: 'pass' }, prs: [] }]],
  ['normal', ['four-normal/project'], [{ repo: 'four-normal/project', coverage: { status: 'pass' }, prs: [{ number: 16 }] }]],
  ['partial', ['four-normal/project', 'two/project'], [
    { repo: 'four-normal/project', coverage: { status: 'pass' }, prs: [{ number: 16 }] },
    { repo: 'two/project', coverage: { status: 'unknown' }, prs: [] },
  ]],
  ['partial', ['field-unknown/project'], [
    { repo: 'field-unknown/project', coverage: { status: 'pass' }, prs: [{ number: 3, mergeable: 'UNKNOWN' }] },
  ]],
])('scheduled %s night sends one report with reconciled forge facts', async (decision, repositories, expected) => {
  const { result, again, calls, rpcReads, scheduledAt } = await fixture(repositories, { repeat: true });
  expect(result).toEqual({ decision, scheduledAt, threadId, binding: 'pass' });
  expect(again.detail).toContain('already claimed');
  expect(rpcReads).toEqual(['server.getConfig', 'orchestration.getThreadProjection']);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ model: selection, runtimeMode: 'full-access', project: 'fixture-project' });
  const { brief } = calls[0];
  expect(brief.startsWith(`AXSTACK-WAKE ${identity} run ${runId}\n`)).toBe(true);
  expect(brief).toContain('Report the top three PRs');
  expect(brief).not.toContain('UNTRUSTED_RAW_FORGE_TEXT');
  expect(JSON.parse(brief.split('Collected JSON data:\n')[1]).repositories).toMatchObject(expected);
});

test('unavailable configured effort holds before starting the report agent', async () => {
  const { result, calls, rpcReads } = await fixture(['five/project'], { options: ['low'] });
  expect(result.detail).toContain('report agent binding unavailable or mismatched');
  expect(rpcReads).toEqual(['server.getConfig']);
  expect(calls).toEqual([]);
});

test('host binding drift and stale slots hold before consulting the forge or provider', async () => {
  for (const options of [{ drift: true }, { age: 601_000 }]) {
    const { result, calls, rpcReads, forge } = await fixture(['five/project'], options);
    expect(result.detail).toMatch(/changed|stale/);
    expect(calls).toEqual([]);
    expect(rpcReads).toEqual([]);
    expect(forge).toBe('');
  }
});

test('an effective binding mismatch holds a started report', async () => {
  const { result, calls, rpcReads } = await fixture(['five/project'], {
    effective: { ...selection, options: [{ id: 'reasoningEffort', value: 'low' }] },
  });
  expect(result.detail).toContain('effective report agent binding unavailable or mismatched');
  expect(calls).toHaveLength(1);
  expect(rpcReads).toEqual(['server.getConfig', 'orchestration.getThreadProjection']);
});
