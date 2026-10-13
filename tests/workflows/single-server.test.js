import { afterEach, expect, test } from 'bun:test';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { run } from '../../skills/axstack/scripts/single-server.js';

const scratch = [];
afterEach(() => { for (const path of scratch.splice(0)) rmSync(path, { recursive: true }); });

function fixture() {
  const root = mkdtempSync(`${process.env.TMPDIR}/single-server-`);
  chmodSync(root, 0o700);
  scratch.push(root);
  const base = `${root}/home/.t3`;
  const proc = `${root}/proc`;
  mkdirSync(`${base}/userdata`, { recursive: true });
  mkdirSync(proc);
  const processEntry = (pid, argv, ppid = 1, uid = process.getuid()) => {
    mkdirSync(`${proc}/${pid}`);
    writeFileSync(`${proc}/${pid}/cmdline`, `${argv.join('\0')}\0`);
    writeFileSync(`${proc}/${pid}/status`, `Name:\tt3\nPPid:\t${ppid}\nUid:\t${uid}\t${uid}\t${uid}\t${uid}\n`);
  };
  const server = (pid, extra = [], ppid = 1) => processEntry(pid, ['/runtime/v1/t3', 'serve', ...extra], ppid);
  const keeper = (pid) => writeFileSync(`${base}/userdata/server-runtime.json`, JSON.stringify({ version: 1, pid }));
  const killed = [];
  const spawned = [];
  const lines = [];
  const seams = {
    env: { HOME: `${root}/home` }, output: (line) => lines.push(line), hostname: () => 'fixture-host',
    kill: (pid, signal) => killed.push([pid, signal]),
    spawn: (argv, options) => { spawned.push({ argv, options }); return { exited: Promise.resolve(0) }; },
  };
  const execute = async (args = [], overrides = {}) => {
    const code = await run(['--proc-root', proc, ...args], { ...seams, ...overrides });
    expect(lines).toHaveLength(1);
    return { code, decision: JSON.parse(lines[0]) };
  };
  return { root, base, proc, server, keeper, processEntry, killed, spawned, seams, execute };
}

test('zero or one matching server is unchanged and never notifies', async () => {
  for (const count of [0, 1]) {
    const f = fixture();
    if (count) f.server(100);
    const { code, decision } = await f.execute([], { env: { ...f.seams.env, AXSTACK_SINGLE_SERVER_NOTIFY: 'notify' } });
    expect(code).toBe(0);
    expect(decision).toMatchObject({ action: 'unchanged', servers: count ? [100] : [], killed: [] });
    expect(f.killed).toEqual([]);
    expect(f.spawned).toEqual([]);
  }
});

test('runtime pid wins; capture descendants before killing each server first', async () => {
  const f = fixture();
  f.server(100); f.server(200); f.server(300);
  f.processEntry(210, ['codex'], 200); f.processEntry(211, ['helper'], 210);
  f.processEntry(310, ['claude'], 300); f.processEntry(110, ['codex'], 100);
  f.keeper(100);
  const { code, decision } = await f.execute([], { kill: (pid, signal) => {
    f.killed.push([pid, signal]);
    // Simulate immediate reparenting after SIGKILL: ancestry must already be saved.
    if (pid === 200 || pid === 300) for (const child of [210, 211, 310]) {
      writeFileSync(`${f.proc}/${child}/status`, `PPid:\t1\nUid:\t${process.getuid()}\n`);
    }
  } });
  expect(code).toBe(0);
  expect(decision).toMatchObject({ action: 'killed', keeper: 100, servers: [100, 200, 300], killed: [200, 210, 211, 300, 310] });
  expect(f.killed).toEqual([200, 210, 211, 300, 310].map((pid) => [pid, 'SIGKILL']));
});

test('discovery filters user, argv identity and base dir; supports both base-dir forms', async () => {
  const f = fixture();
  f.server(100, ['--base-dir', f.base]); f.server(200, [`--base-dir=${f.base}`]);
  f.server(300, ['--base-dir', `${f.root}/other`]);
  f.processEntry(400, ['node', 'serve']); f.processEntry(500, ['t3', 'pair']);
  f.processEntry(600, ['t3', 'serve'], 1, process.getuid() + 1);
  f.keeper(100);
  const { decision } = await f.execute(['--base-dir', f.base]);
  expect(decision).toMatchObject({ action: 'killed', servers: [100, 200], killed: [200] });
  expect(f.killed).toEqual([[200, 'SIGKILL']]);
});

test('duplicate servers hold without a valid readable runtime keeper', async () => {
  for (const runtime of [null, 'broken json', JSON.stringify({ pid: 999 }), JSON.stringify({ pid: '100' })]) {
    const f = fixture(); f.server(100); f.server(200);
    if (runtime !== null) writeFileSync(`${f.base}/userdata/server-runtime.json`, runtime);
    const { code, decision } = await f.execute();
    expect(code).toBe(0);
    expect(decision).toMatchObject({ action: 'hold', keeper: null, servers: [100, 200], killed: [] });
    expect(f.killed).toEqual([]);
  }
});

test('dry-run reports victims but never kills or notifies', async () => {
  const f = fixture(); f.server(100); f.server(200); f.processEntry(210, ['codex'], 200); f.keeper(100);
  const { code, decision } = await f.execute(['--dry-run'], { env: { ...f.seams.env, AXSTACK_SINGLE_SERVER_NOTIFY: 'notify' } });
  expect(code).toBe(0);
  expect(decision).toMatchObject({ action: 'would-kill', keeper: 100, killed: [200, 210] });
  expect(f.killed).toEqual([]); expect(f.spawned).toEqual([]);
});

test('keeper and its descendants are protected even beneath a duplicate server', async () => {
  const f = fixture(); f.server(200); f.server(100, [], 200); f.processEntry(110, ['codex'], 100); f.keeper(100);
  const { decision } = await f.execute();
  expect(decision.killed).toEqual([200]);
  expect(f.killed).toEqual([[200, 'SIGKILL']]);
});

test('nested duplicates are killed parent-first even when the child server has the lower pid', async () => {
  const f = fixture(); f.server(300); f.server(200); f.server(100, [], 200);
  f.processEntry(110, ['codex'], 100); f.keeper(300);
  const { code, decision } = await f.execute();
  expect(code).toBe(0);
  expect(decision.killed).toEqual([200, 100, 110]);
  expect(f.killed).toEqual([200, 100, 110].map((pid) => [pid, 'SIGKILL']));
});

test('kill notification uses sh -c with host, keeper, victims and recovery note on stdin', async () => {
  const f = fixture(); f.server(100); f.server(200); f.keeper(100);
  const { code, decision } = await f.execute([], { env: { ...f.seams.env, AXSTACK_SINGLE_SERVER_NOTIFY: 'notify secret-value' } });
  expect(code).toBe(0); expect(decision.action).toBe('killed'); expect(f.spawned).toHaveLength(1);
  expect(f.spawned[0].argv).toEqual(['sh', '-c', 'notify secret-value']);
  const message = await new Response(f.spawned[0].options.stdin).text();
  expect(message).toMatch(/fixture-host.*kept.*100.*killed.*200/s);
  expect(message).toMatch(/runs.*running.*t3_thread_interrupt/is);
  expect(f.spawned[0].options).toMatchObject({ stdout: 'ignore', stderr: 'ignore' });
  expect(JSON.stringify(decision)).not.toContain('secret-value');
});

test('notification failure exits 1 after killing and keeps a single secret-free decision', async () => {
  const f = fixture(); f.server(100); f.server(200); f.keeper(100);
  const { code, decision } = await f.execute([], {
    env: { ...f.seams.env, AXSTACK_SINGLE_SERVER_NOTIFY: 'notify secret-value' },
    spawn: () => ({ exited: Promise.resolve(5) }),
  });
  expect(code).toBe(1);
  expect(decision).toMatchObject({ action: 'killed', reason: 'notify-failed', killed: [200] });
  expect(f.killed).toEqual([[200, 'SIGKILL']]);
});

test('invalid flags exit 1 without killing or exposing input', async () => {
  for (const args of [['--unknown-secret'], ['--base-dir'], ['--proc-root', '/absent-secret']]) {
    const f = fixture();
    const { code, decision } = await f.execute(args);
    expect(code).toBe(1); expect(decision.action).toBe('hold');
    expect(f.killed).toEqual([]); expect(JSON.stringify(decision)).not.toContain('secret');
  }
});
