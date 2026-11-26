import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { makeTempRoot } from '../installer/helpers.js';

export const workflow = 'axstack-fleet-cleanup';
export const runId = 'a'.repeat(32);
export const projectId = '71710000-0000-4000-8000-000000000001';
export const threadId = 'mcp:f15e0000-0000-4000-8000-000000000001';
export const latestRunId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const secondThreadId = threadId.replace(/1$/, '2');
export const operation = `axat-vps/${projectId}/${threadId}/${latestRunId}/settle`;
export const secondOperation = operation.replace(threadId, secondThreadId);
export const tree = '/fixture/topic';
export const head = 'f'.repeat(40);
export const scheduledAt = '2026-11-27T00:00:00.000Z';
const hosts = ['io', 'iobook', 'iobox', 'iosatellite', 'axat-vps'];
const ownerThread = 'workflow:c5-replay';

const catalog = [{
  instanceId: 'codex', driver: 'codex', enabled: true, installed: true,
  status: 'available', availability: 'available', supportedRuntimeModes: ['full-access'],
  models: [{ slug: 'gpt-6.2-sol', capabilities: {
    optionDescriptors: [{ id: 'reasoningEffort', options: [{ id: 'high' }] }],
  } }],
}];
const model = { instanceId: 'codex', model: 'gpt-6.2-sol', options: [{ id: 'reasoningEffort', value: 'high' }] };

export async function replay(scenario = {}) {
  const dir = makeTempRoot('axstack-fleet-cleanup-');
  mkdirSync(dir + '/userdata');
  mkdirSync(dir + '/workflows');
  const source = `${import.meta.dir}/../../skills/axstack/workflows`;
  const entryPath = dir + '/workflows/entry.mjs';
  const variant = process.env.AXSTACK_FLEET_REPLAY_BUNDLE;
  if (variant) writeFileSync(entryPath, readFileSync(variant));
  else {
    const build = Bun.spawnSync([process.execPath, 'build', 'entries/' + workflow + '.mjs', '--target=node', '--format=esm'],
      { cwd: source });
    if (build.exitCode) throw new Error(build.stderr.toString());
    writeFileSync(entryPath, build.stdout);
  }
  const row = {
    threadId, projectId, latestRunId, createdBy: 'agent', status: 'completed',
    updatedAt: scheduledAt, activeRunId: null, pinned: false, snoozed: false,
    blockedOnThreadWait: false, pendingRequestCount: 0, archived: false,
    settled: false, worktreePath: scenario.worktree || null, title: 'UNTRUSTED THREAD TITLE',
    pendingBackgroundTasks: [], ...scenario.thread,
  };
  const coverage = Object.fromEntries(hosts.map((host) => [host, { projectsComplete: true, projectIds: [projectId] }]));
  if (scenario.projectGap) delete coverage.iobook;
  const decision = {
    host: 'axat-vps', projectId, threadId, runId: latestRunId, updatedAt: scheduledAt,
    action: 'settle', ...(scenario.worktree ? { publishedHead: head } : {}), ...scenario.decision,
    guards: { accepted: true, descendantsClear: true, ownership: true, preserved: true, protectionClear: true,
      ...scenario.decision?.guards },
  };
  const receipt = scenario.legacy ? JSON.parse(readFileSync(import.meta.dir + '/fixtures/fleet-cleanup-predecessor.json')) : {
    version: 1, capturedAt: scenario.receiptTime ?? scheduledAt, coverage,
    outstandingCleanupOwnedSnoozes: scenario.snoozes ?? [],
    decisions: scenario.eligible ? [decision, ...(scenario.second ? [{ ...decision, threadId: secondThreadId }] : [])] : [],
  };
  let catalogReads = 0;
  const updatedCatalog = catalog.map((provider) => ({
    ...provider, models: provider.models.map((entry) => ({ ...entry, slug: 'gpt-6.3-sol' })),
  }));
  const socket = Bun.serve({
    hostname: '127.0.0.1', port: 0, fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 400 });
    },
    websocket: {
      message(ws, message) {
        const { tag, requestId, id } = JSON.parse(message);
        if (scenario.rpcGap && tag === 'server.getConfig') {
          ws.send(JSON.stringify({ _tag: 'Exit', requestId: requestId ?? id, exit: { _tag: 'Failure' } }));
          return;
        }
        let result;
        if (tag === 'server.getConfig') {
          catalogReads++;
          const observedCatalog = catalogReads >= (scenario.catalogChangeAt ?? Infinity) ? updatedCatalog : catalog;
          result = { providers: scenario.catalogGap ? [] : observedCatalog };
        } else {
          result = { thread: { id: ownerThread, runtimeMode: 'full-access', modelSelection: scenario.readbackMismatch
            ? { ...model, options: [] } : model } };
        }
        ws.send(JSON.stringify({ _tag: 'Chunk', requestId: requestId ?? id, values: [result] }));
      },
    },
  });
  try {
    const config = {
      mode: scenario.shadow ? 'shadow' : 'active', project: '/fixture/project', projectId, roles: dir + '/roles.json', registryTokenFile: dir + '/token',
      bun: process.execPath, t3: dir + '/t3', git: dir + '/git', ssh: dir + '/ssh', receipt: dir + '/receipt',
      hosts: Object.fromEntries(hosts.map((host) => [host, {
        t3: '/fixture/bin/t3', base: host === 'axat-vps' ? dir : '/fixture/base',
        projects: [{ id: projectId, path: '/fixture/project', repository: '/fixture/project' }],
      }])),
    };
    const binding = JSON.stringify(config);
    const record = { binding: dir + '/binding.json', bindingDigest: new Bun.CryptoHasher('sha256').update(binding).digest('hex') };
    writeFileSync(dir + '/binding.json', scenario.bindingGap ? binding + ' ' : binding, { mode: 0o600 });
    writeFileSync(dir + '/.axstack-workflows.json', JSON.stringify({ workflows: { [workflow + '@1']: record } }), { mode: 0o600 });
    writeFileSync(dir + '/receipt', JSON.stringify(receipt), { mode: 0o600 });
    writeFileSync(dir + '/token', 'fixture-only', { mode: 0o600 });
    writeFileSync(dir + '/calls', '');
    writeFileSync(dir + '/briefs', '[]');
    writeFileSync(dir + '/roles.json', JSON.stringify({
      version: 1, roles: [{ id: 'axstack-owner', provider: 'codex', modelClass: 'sol', modeId: 'full-access', thinkingOptionId: 'high' }],
    }));
    writeFileSync(dir + '/userdata/server-runtime.json', JSON.stringify({
      origin: `http://127.0.0.1:${socket.port}`, pid: 99, startedAt: scheduledAt,
    }));
    const observed = JSON.parse(readFileSync(import.meta.dir + '/fixtures/fleet-cleanup-t3-0.1.12.json'));
    const fixture = {
      scenario, observed, dir, model, ownerThread, projectId, eligible: scenario.eligible ?? false,
      row: scenario.eligible || scenario.unrecorded ? [row, ...(scenario.second ? [{ ...row, threadId: secondThreadId }] : [])] : [],
      worktrees: `worktree /fixture/project\0HEAD ${head}\0branch refs/heads/main\0\0` +
        (scenario.worktree === tree ? `worktree ${tree}\0HEAD ${head}\0branch refs/heads/topic\0${scenario.worktreeLock ? 'locked\0' : ''}\0` : ''),
    };
    writeFileSync(dir + '/fixture.json', JSON.stringify(fixture));
    for (const binary of ['ssh', 't3', 'git']) {
      writeFileSync(dir + '/' + binary, `#!${process.execPath}
import { fake } from ${JSON.stringify(import.meta.dir + '/fleet-cleanup-fake.js')};
await fake(${JSON.stringify(binary)}, ${JSON.stringify(dir)});
`);
      chmodSync(dir + '/' + binary, 0o700);
    }
    const harness = import.meta.dir + '/fleet-cleanup-engine.js';
    const child = Bun.spawn([process.execPath, harness, dir, entryPath, scenario.runKey ?? runId, scheduledAt], {
      env: { ...Bun.env, AXSTACK_PRIVATE_TEST: 'must not reach subprocesses' }, stdout: 'pipe', stderr: 'pipe',
    });
    const [out, err, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    if (exit) throw new Error(err);
    const commands = readFileSync(dir + '/calls', 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    return { ...JSON.parse(out), commands };
  } finally {
    await socket.stop(true);
  }
}
