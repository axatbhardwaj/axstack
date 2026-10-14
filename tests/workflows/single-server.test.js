import { afterEach, expect, test } from 'bun:test';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { run } from '../../skills/axstack/scripts/single-server.js';

const scratch = [];
afterEach(() => { for (const path of scratch.splice(0)) rmSync(path, { recursive: true }); });

function fixture() {
  const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/single-server-`);
  chmodSync(root, 0o700);
  scratch.push(root);
  const base = `${root}/home/.t3`;
  const proc = `${root}/proc`;
  mkdirSync(`${base}/userdata`, { recursive: true });
  mkdirSync(proc);
  const uptime = (seconds) => writeFileSync(`${proc}/uptime`, `${seconds} 0.00\n`);
  uptime(1000);
  const environ = (pid, values) => writeFileSync(`${proc}/${pid}/environ`,
    Object.entries(values).map(([key, value]) => `${key}=${value}\0`).join(''));
  const startTime = (pid, ticks) => writeFileSync(`${proc}/${pid}/stat`,
    `${pid} (t3 (worker) server) S 1 ${'0 '.repeat(17)}${ticks}\n`);
  const processEntry = (pid, argv, ppid = 1, uid = process.getuid()) => {
    mkdirSync(`${proc}/${pid}`);
    writeFileSync(`${proc}/${pid}/cmdline`, `${argv.join('\0')}\0`);
    writeFileSync(`${proc}/${pid}/status`, `Name:\tt3\nPPid:\t${ppid}\nUid:\t${uid}\t${uid}\t${uid}\t${uid}\n`);
    environ(pid, { HOME: `${root}/home` });
    startTime(pid, 10);
  };
  const server = (pid, extra = [], ppid = 1) => processEntry(pid, ['/runtime/v1/t3', 'serve', ...extra], ppid);
  const cwd = (pid, path) => {
    mkdirSync(`${proc}/${pid}`, { recursive: true });
    symlinkSync(path, `${proc}/${pid}/cwd`);
  };
  const keeper = (pid) => {
    writeFileSync(`${base}/userdata/server-runtime.json`, JSON.stringify({ version: 1, pid }));
    startTime(pid, 20);
  };
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
  return { root, base, proc, uptime, environ, cwd, startTime, server, keeper, processEntry, killed, spawned, seams, execute };
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

test('server base dirs use argv, then T3CODE_HOME, then that process HOME', async () => {
  const f = fixture(); f.server(100); f.server(200); f.server(300); f.server(400, ['--base-dir', f.base]);
  f.environ(100, { T3CODE_HOME: f.base, HOME: `${f.root}/other-home` });
  f.environ(200, { T3CODE_HOME: `${f.root}/other`, HOME: `${f.root}/home` });
  f.environ(300, { HOME: `${f.root}/other-home` });
  f.environ(400, { T3CODE_HOME: `${f.root}/other`, HOME: `${f.root}/other-home` });
  f.keeper(100);
  const { code, decision } = await f.execute();
  expect(code).toBe(0);
  expect(decision).toMatchObject({ action: 'killed', servers: [100, 400], killed: [400] });
  expect(f.killed).toEqual([[400, 'SIGKILL']]);
});

for (const form of ['tilde', 'trailing-slash', 'relative']) {
  test(`normalizes ${form} base dirs for the guard and each server`, async () => {
    const f = fixture();
    const base = form === 'tilde' ? '~/.t3' : form === 'relative' ? './.t3/../.t3/' : `${f.base}///`;
    f.server(100, ['--base-dir', f.base]); f.server(200, [`--base-dir=${base}`]);
    f.keeper(100);
    f.cwd(process.pid, `${f.root}/home`); f.cwd(200, `${f.root}/home`);
    const { code, decision } = await f.execute(['--base-dir', base]);
    expect(code).toBe(0);
    expect(decision).toMatchObject({ action: 'killed', keeper: 100, servers: [100, 200], killed: [200] });
    expect(f.killed).toEqual([[200, 'SIGKILL']]);
  });
}

test('server tilde expansion uses its own HOME, not the guard HOME', async () => {
  const f = fixture(); f.server(100); f.server(200, ['--base-dir', '~/.t3/']); f.keeper(100);
  const { code, decision } = await f.execute(['--base-dir', f.base], {
    env: { HOME: `${f.root}/different-home` },
  });
  expect(code).toBe(0);
  expect(decision).toMatchObject({ action: 'killed', servers: [100, 200], killed: [200] });
});

test('relative environment base dirs use each server cwd and ignore other directories', async () => {
  const f = fixture(); f.server(100); f.server(200); f.server(300); f.keeper(100);
  f.environ(200, { T3CODE_HOME: '.t3/' }); f.cwd(200, `${f.root}/home`);
  f.environ(300, { T3CODE_HOME: '.t3/' }); f.cwd(300, `${f.root}/different-home`);
  const { code, decision } = await f.execute();
  expect(code).toBe(0);
  expect(decision).toMatchObject({ action: 'killed', servers: [100, 200], killed: [200] });
});

test('relative or tilde server bases hold when cwd or HOME cannot be resolved', async () => {
  for (const base of ['.t3', '~/.t3']) {
    const f = fixture(); f.server(100); f.server(200); f.server(300, ['--base-dir', base]); f.keeper(100);
    if (base.startsWith('~')) f.environ(300, {});
    const { code, decision } = await f.execute();
    expect(code).toBe(0);
    expect(decision).toMatchObject({ action: 'hold', reason: 'unknown-base-dir', servers: [100, 200], killed: [] });
    expect(f.killed).toEqual([]);
  }
});

for (const state of ['missing', 'unreadable', 'no-home']) {
  test(`unknown candidate base dir holds when environ is ${state}`, async () => {
    const f = fixture(); f.server(100); f.server(200); f.server(300); f.keeper(100);
    if (state === 'missing') rmSync(`${f.proc}/300/environ`);
    else if (state === 'unreadable') chmodSync(`${f.proc}/300/environ`, 0);
    else f.environ(300, { UNRELATED: 'secret-value' });
    const { code, decision } = await f.execute();
    expect(code).toBe(0);
    expect(decision).toMatchObject({ action: 'hold', reason: 'unknown-base-dir', killed: [] });
    expect(f.killed).toEqual([]); expect(f.spawned).toEqual([]);
    expect(JSON.stringify(decision)).not.toContain('secret-value');
  });
}

test('equals base-dir form matches a non-default target and ignores other bases', async () => {
  const f = fixture(); const target = `${f.root}/target`;
  mkdirSync(`${target}/userdata`, { recursive: true });
  writeFileSync(`${target}/userdata/server-runtime.json`, JSON.stringify({ pid: 100 }));
  f.server(100, [`--base-dir=${target}`]); f.server(200, [`--base-dir=${target}`]);
  f.startTime(100, 20);
  f.server(300, [`--base-dir=${f.base}`]);
  f.environ(300, { T3CODE_HOME: target });
  // A valid argv base remains sufficient when environ is unreadable.
  chmodSync(`${f.proc}/200/environ`, 0);
  const { code, decision } = await f.execute(['--base-dir', target]);
  expect(code).toBe(0);
  expect(decision).toMatchObject({ action: 'killed', servers: [100, 200], killed: [200] });
  expect(f.killed).toEqual([[200, 'SIGKILL']]);
});

test('older duplicates are killed; stat comm may contain parentheses and spaces', async () => {
  const f = fixture(); f.server(100); f.server(200); f.keeper(100);
  f.startTime(100, '9007199254740993'); f.startTime(200, '9007199254740992');
  f.uptime(90071992547410);
  const { code, decision } = await f.execute();
  expect(code).toBe(0);
  expect(decision).toMatchObject({ action: 'killed', killed: [200] });
  expect(f.killed).toEqual([[200, 'SIGKILL']]);
});

for (const started of [20, 30]) {
  test(`a duplicate started at ${started} versus keeper 20 holds the whole run`, async () => {
    const f = fixture(); f.server(100); f.server(200); f.server(300); f.keeper(100);
    f.startTime(300, started);
    f.uptime(100);
    const { code, decision } = await f.execute();
    expect(code).toBe(0);
    expect(decision).toMatchObject({ action: 'hold', reason: 'possible-replacement', killed: [] });
    expect(f.killed).toEqual([]); expect(f.spawned).toEqual([]);
  });
}

for (const age of [119.99, 120, 121]) {
  test(`newer duplicate age ${age}s uses the default 120s grace`, async () => {
    const f = fixture(); f.server(100); f.server(200); f.keeper(100);
    f.startTime(200, 10000); f.uptime(100 + age);
    f.processEntry(210, ['codex'], 200);
    const { code, decision } = await f.execute([], {
      env: { ...f.seams.env, AXSTACK_SINGLE_SERVER_NOTIFY: 'notify' },
    });
    expect(code).toBe(0);
    expect(decision).toMatchObject(age < 120
      ? { action: 'hold', reason: 'possible-replacement', killed: [] }
      : { action: 'killed', reason: 'duplicate-servers', killed: [200, 210] });
    expect(f.killed).toEqual(age < 120 ? [] : [[200, 'SIGKILL'], [210, 'SIGKILL']]);
    expect(f.spawned).toHaveLength(age < 120 ? 0 : 1);
  });
}

test('custom grace holds all duplicates until every possible replacement expires', async () => {
  for (const age of [29, 30]) {
    const f = fixture(); f.server(100); f.server(200); f.server(300); f.keeper(100);
    f.startTime(200, 10000); f.startTime(300, 20000); f.uptime(200 + age);
    const { code, decision } = await f.execute(['--grace-seconds', '30']);
    expect(code).toBe(0);
    expect(decision).toMatchObject(age < 30
      ? { action: 'hold', reason: 'possible-replacement', killed: [] }
      : { action: 'killed', reason: 'duplicate-servers', killed: [200, 300] });
  }
});

for (const value of [null, 'bad', '-1', 'Infinity']) {
  test(`unknown uptime ${value} holds even with a valid keeper`, async () => {
    const f = fixture(); f.server(100); f.server(200); f.keeper(100);
    if (value === null) rmSync(`${f.proc}/uptime`);
    else f.uptime(value);
    const { code, decision } = await f.execute();
    expect(code).toBe(0);
    expect(decision).toMatchObject({ action: 'hold', reason: 'unknown-uptime', killed: [] });
    expect(f.killed).toEqual([]);
  });
}

test('invalid grace values reject input before scanning or killing', async () => {
  for (const value of ['-1', 'NaN', 'Infinity', '1.5', '']) {
    const f = fixture(); f.server(100); f.server(200); f.keeper(100);
    const { code, decision } = await f.execute(['--grace-seconds', value]);
    expect(code).toBe(1);
    expect(decision).toMatchObject({ action: 'hold', reason: 'invalid-input', killed: [] });
    expect(f.killed).toEqual([]);
  }
});

for (const age of [599.99, 600, 779.99, 780]) {
  test(`persistent hold age ${age}s alerts only in the ten-to-thirteen-minute window`, async () => {
    const f = fixture(); f.server(100); f.server(200);
    f.startTime(200, 10000); f.uptime(100 + age);
    const { code, decision } = await f.execute([], {
      env: { ...f.seams.env, AXSTACK_SINGLE_SERVER_NOTIFY: 'notify' },
    });
    expect(code).toBe(0);
    expect(decision).toMatchObject({ action: 'hold', reason: 'no-valid-keeper', keeper: null, killed: [] });
    expect(f.killed).toEqual([]);
    expect(f.spawned).toHaveLength(age >= 600 && age < 780 ? 1 : 0);
    if (f.spawned.length) {
      expect(f.spawned[0].argv).toEqual(['sh', '-c', 'notify']);
      expect(f.spawned[0].options).toMatchObject({ stdout: 'ignore', stderr: 'ignore' });
      const message = await new Response(f.spawned[0].options.stdin).text();
      expect(message).toMatch(/fixture-host.*no-valid-keeper.*keeper.*none.*servers.*100, 200.*duplicates.*still running/is);
    }
  });
}

for (const reason of ['possible-replacement', 'unknown-base-dir', 'own-process-tree']) {
  test(`persistent ${reason} hold alerts with the live keeper`, async () => {
    const f = fixture(); f.server(100); f.server(200); f.keeper(100);
    f.startTime(200, 10000); f.uptime(700);
    if (reason === 'unknown-base-dir') { f.server(300); f.environ(300, {}); }
    if (reason === 'own-process-tree') f.processEntry(process.pid, ['bun'], 200);
    const { code, decision } = await f.execute(reason === 'possible-replacement' ? ['--grace-seconds', '1000'] : [], {
      env: { ...f.seams.env, AXSTACK_SINGLE_SERVER_NOTIFY: 'notify' },
    });
    expect(code).toBe(0);
    expect(decision).toMatchObject({ action: 'hold', reason, keeper: 100, killed: [] });
    expect(f.killed).toEqual([]);
    expect(f.spawned).toHaveLength(1);
    const message = await new Response(f.spawned[0].options.stdin).text();
    expect(message).toContain(reason);
    expect(message).toMatch(/keeper.*100.*servers.*100, 200.*duplicates.*still running/is);
  });
}

test('persistent hold never alerts in dry-run, without a notifier, or with unknown ages', async () => {
  for (const mode of ['dry-run', 'no-notifier', 'unknown-start', 'unknown-uptime']) {
    const f = fixture(); f.server(100); f.server(200); f.uptime(700);
    if (mode === 'unknown-start') rmSync(`${f.proc}/200/stat`);
    if (mode === 'unknown-uptime') rmSync(`${f.proc}/uptime`);
    const { code, decision } = await f.execute(mode === 'dry-run' ? ['--dry-run'] : [], {
      env: { ...f.seams.env, ...(mode === 'no-notifier' ? {} : { AXSTACK_SINGLE_SERVER_NOTIFY: 'notify' }) },
    });
    expect(code).toBe(0);
    expect(decision).toMatchObject({ action: 'hold', reason: 'no-valid-keeper', killed: [] });
    expect(f.killed).toEqual([]); expect(f.spawned).toEqual([]);
  }
});

test('persistent hold notification failures exit 1 with a secret-free decision', async () => {
  for (const mode of ['exit', 'throw']) {
    const f = fixture(); f.server(100); f.server(200); f.uptime(700);
    const { code, decision } = await f.execute([], {
      env: { ...f.seams.env, AXSTACK_SINGLE_SERVER_NOTIFY: 'notify secret-value' },
      spawn: () => {
        if (mode === 'throw') throw new Error('secret-value');
        return { exited: Promise.resolve(5) };
      },
    });
    expect(code).toBe(1);
    expect(decision).toMatchObject({ action: 'hold', reason: 'notify-failed', killed: [] });
    expect(f.killed).toEqual([]);
    expect(JSON.stringify(decision)).not.toContain('secret-value');
  }
});

for (const state of ['missing', 'unreadable', 'malformed']) {
  test(`unknown server start time holds when stat is ${state}`, async () => {
    const f = fixture(); f.server(100); f.server(200); f.keeper(100);
    if (state === 'missing') rmSync(`${f.proc}/200/stat`);
    else if (state === 'unreadable') chmodSync(`${f.proc}/100/stat`, 0);
    else writeFileSync(`${f.proc}/200/stat`, '200 (t3 serve) S 1\n');
    const { code, decision } = await f.execute(['--dry-run']);
    expect(code).toBe(0);
    expect(decision).toMatchObject({ action: 'hold', reason: 'unknown-start-time', killed: [] });
    expect(f.killed).toEqual([]); expect(f.spawned).toEqual([]);
  });
}

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

test('a non-ESRCH kill failure is recorded, remaining victims are attempted and successful kills still notify', async () => {
  const f = fixture(); f.server(100); f.server(200); f.server(300); f.keeper(100);
  f.processEntry(210, ['privileged-child'], 200); f.processEntry(211, ['helper'], 210);
  const attempts = [];
  const { code, decision } = await f.execute([], {
    env: { ...f.seams.env, AXSTACK_SINGLE_SERVER_NOTIFY: 'notify secret-value' },
    kill: (pid, signal) => {
      attempts.push([pid, signal]);
      if (pid === 210) throw Object.assign(new Error('secret-value'), { code: 'EPERM' });
      f.killed.push([pid, signal]);
    },
  });
  expect(code).toBe(1);
  expect(decision).toMatchObject({ action: 'killed', reason: 'kill-failed', killed: [200, 211, 300], failed: [210] });
  expect(attempts).toEqual([200, 210, 211, 300].map((pid) => [pid, 'SIGKILL']));
  expect(f.spawned).toHaveLength(1);
  const message = await new Response(f.spawned[0].options.stdin).text();
  expect(message).toContain('killed pids 200, 211, 300');
  expect(message).toMatch(/failed.*210.*still running/is);
  expect(JSON.stringify(decision)).not.toContain('secret-value');
});

test('kill notification lists survivors even when every kill fails', async () => {
  const f = fixture(); f.server(100); f.server(200); f.keeper(100);
  const { code, decision } = await f.execute([], {
    env: { ...f.seams.env, AXSTACK_SINGLE_SERVER_NOTIFY: 'notify' },
    kill: () => { throw Object.assign(new Error('denied'), { code: 'EPERM' }); },
  });
  expect(code).toBe(1);
  expect(decision).toMatchObject({ action: 'hold', reason: 'kill-failed', killed: [], failed: [200] });
  expect(f.spawned).toHaveLength(1);
  const message = await new Response(f.spawned[0].options.stdin).text();
  expect(message).toMatch(/fixture-host.*kept.*100.*failed.*200.*still running/is);
});

for (const member of ['self', 'ancestor']) {
  test(`a victim tree containing the script ${member} holds without killing or notifying`, async () => {
    const f = fixture(); f.server(100); f.server(200); f.keeper(100);
    // Ancestor coverage omits self from the snapshot, so a self-only guard cannot pass.
    f.processEntry(member === 'self' ? process.pid : process.ppid, ['bun'], 200);
    const { code, decision } = await f.execute([], {
      env: { ...f.seams.env, AXSTACK_SINGLE_SERVER_NOTIFY: 'notify' },
    });
    expect(code).toBe(0);
    expect(decision).toMatchObject({ action: 'hold', reason: 'own-process-tree', killed: [] });
    expect(f.killed).toEqual([]); expect(f.spawned).toEqual([]);
  });
}

test('invalid flags exit 1 without killing or exposing input', async () => {
  for (const args of [['--unknown-secret'], ['--base-dir'], ['--proc-root', '/absent-secret']]) {
    const f = fixture();
    const { code, decision } = await f.execute(args);
    expect(code).toBe(1); expect(decision.action).toBe('hold');
    expect(f.killed).toEqual([]); expect(JSON.stringify(decision)).not.toContain('secret');
  }
});
