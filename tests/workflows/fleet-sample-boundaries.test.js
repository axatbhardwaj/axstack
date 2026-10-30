import { expect, test } from 'bun:test';
import { parseProc } from '../../skills/axstack/scripts/fleet-proc.js';
import { telemetry } from '../../skills/axstack/scripts/fleet-facts.js';
import { sampleFleet } from '../../skills/axstack/scripts/fleet-sample.js';
import { PROC_COMMAND, readProc, sshArgv, wait } from '../../skills/axstack/scripts/fleet-sample-io.js';
const raw = (v) => `cpu ${v} 0 0 100 0 0 0 0\n\n---AXSTACK-MEM---\nMemTotal: 100 kB\nMemAvailable: 80 kB\n`;
const hosts = ['a', 'b', 'c'].map((n) => ({ id: `host-${n}`, environmentId: `env-${n}` }));
const manifest = { schemaVersion: 1, hosts: hosts.map((h) => ({ hostId: h.id, environmentId: h.environmentId,
  transport: 'ssh', destination: h.id })) };
const options = { intervalMs: 5000, timeoutMs: 6000 };
const good = { status: 'ok', cpuBp: 2000, ramBp: 3000, ramLatestBp: 4000, source: 'linux-proc-ssh',
  scope: 'whole-host', durationMs: 5000, intervalMs: 5000, receivedAt: 100000,
  windowStartedAt: 95000, windowEndedAt: 100000, windowKind: 'collector-bracket' };

test('C1 validates and retains window provenance even for future/stale data', () => {
  expect(telemetry(good, 100050)).toMatchObject({ status: 'measured', ageMs: 50, windowStartedAt: 95000 });
  for (const [key, value] of [['windowEndedAt', 100001], ['windowEndedAt', 99999],
    ['windowEndedAt', '100000'], ['intervalMs', 4999], ['intervalMs', 5001],
    ['intervalMs', 5000.1], ['intervalMs', 60001]]) {
    expect(telemetry({ ...good, [key]: value }, 100050)).toMatchObject({ status: 'unknown', reason: 'inconsistent-window' });
  }
  for (const [now, reason, ageMs] of [[99999, 'future', -1], [115001, 'stale', 15001]]) {
    expect(telemetry(good, now)).toMatchObject({ status: 'unknown', reason, ageMs,
      source: 'linux-proc-ssh', durationMs: 5000, intervalMs: 5000, windowEndedAt: 100000 });
  }
  expect(telemetry(good, 115000).status).toBe('measured');
});

test('concurrent fleet reads form one batch, without serial per-host windows', async () => {
  const first = []; const last = []; const pending = [];
  let now = 100000;
  const result = sampleFleet(manifest, hosts, options, { clock: () => now, monotonic: () => now,
    read: async (h) => { if (!first.includes(h.hostId)) { first.push(h.hostId); return raw(10); }
      last.push(h.hostId); return raw(20); },
    wait: () => new Promise((resolve) => pending.push(resolve)),
  });
  await Promise.resolve(); await Promise.resolve();
  expect(first).toEqual(hosts.map((h) => h.id));
  expect(last).toEqual([]);
  expect(pending).toHaveLength(3);
  now += 5000; pending.forEach((resolve) => { resolve(); });
  const { telemetry: samples } = await result;
  expect(last).toEqual(first);
  expect(samples.map((s) => [s.status, s.windowStartedAt, s.durationMs])).toEqual([
    ['ok', 100000, 5000], ['ok', 100000, 5000], ['ok', 100000, 5000],
  ]);
});

test('clock skew cannot forge a short or backwards window; forward jumps are rejected', async () => {
  for (const end of [99000, 104999, 160000]) {
    let tick = 0; let epoch = 100000; let reads = 0;
    const r = await sampleFleet({ ...manifest, hosts: [manifest.hosts[0]] }, hosts, options, {
      clock: () => epoch, monotonic: () => tick,
      read: async () => raw(++reads * 10), wait: async () => { tick = 5000; epoch = end; },
    });
    expect(r.telemetry[0].status).toBe('collector-clock');
  }
});

test('cancellation interrupts a waiting batch and removes abort listeners', async () => {
  const abort = new AbortController(); let listeners = 0;
  const add = abort.signal.addEventListener.bind(abort.signal);
  const remove = abort.signal.removeEventListener.bind(abort.signal);
  abort.signal.addEventListener = (...args) => { listeners++; return add(...args); };
  abort.signal.removeEventListener = (...args) => { listeners--; return remove(...args); };
  const result = sampleFleet(manifest, hosts, options, { signal: abort.signal, read: async () => raw(10) });
  await Promise.resolve(); abort.abort();
  expect((await result).telemetry.map((s) => s.status)).toEqual(['cancelled', 'cancelled', 'cancelled']);
  expect(listeners).toBe(0);
  const preCancelled = sampleFleet(manifest, hosts, options, { signal: abort.signal,
    read: async () => { throw Error('must not read'); } });
  expect((await preCancelled).telemetry.every((s) => s.status === 'cancelled')).toBe(true);
});

test('per-host malformed/failure/timeout paths are unknown, with real timeout cleanup', async () => {
  const result = await sampleFleet(manifest, hosts, options, { read: async (h, signal) => {
    if (h.hostId === 'host-a') return 'bad';
    if (h.hostId === 'host-b') throw Error('SSH detail must not escape');
    await wait(20000, signal); return raw(10);
  } });
  expect(result.telemetry.map((s) => s.status)).toEqual(['malformed', 'failed', 'timeout']);
  expect(result.telemetry.map((s) => telemetry(s, s.receivedAt).reason)).toEqual(['malformed', 'failed', 'timeout']);
  expect(result.telemetry[2].durationMs).toBeGreaterThanOrEqual(5900);
}, 8000);

test('SSH uses argv, a constant read-only command, existing identities and bounded output', async () => {
  const h = manifest.hosts[0];
  const argv = sshArgv({ ...h, user: 'fixture_user' });
  expect(argv).toEqual(['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
    '-o', 'IdentitiesOnly=yes', '-o', 'ConnectTimeout=3', '-o', 'ConnectionAttempts=1',
    '-o', 'ServerAliveInterval=2', '-o', 'ServerAliveCountMax=1', '-o', 'ControlMaster=no',
    '-o', 'ControlPath=none', '-o', 'ClearAllForwardings=yes', '-o', 'PermitLocalCommand=no',
    '-l', 'fixture_user', '--', 'host-a', PROC_COMMAND]);
  let spawnArgs;
  const output = await readProc(h, new AbortController().signal, (...args) => {
    spawnArgs = args;
    return { stdout: new Blob([raw(10)]).stream(), exited: Promise.resolve(0), kill() {} };
  });
  expect(output).toBe(raw(10));
  expect(spawnArgs).toEqual([sshArgv(h), { stdin: 'ignore', stdout: 'pipe', stderr: 'ignore' }]);
  let killed = 0; let reaped = false; let resolve;
  const exited = new Promise((r) => { resolve = () => { reaped = true; r(137); }; });
  const controller = new AbortController();
  const child = { stdout: new ReadableStream({ start() {} }), exited,
    kill() { killed++; resolve(); } };
  const result = readProc(h, controller.signal, () => child);
  controller.abort(Error('cancelled'));
  await expect(result).rejects.toThrow('cancelled');
  expect(killed).toBeGreaterThan(0); expect(reaped).toBe(true);
  await expect(readProc(h, new AbortController().signal, () => ({
    stdout: new Blob(['x'.repeat(65537)]).stream(), exited: Promise.resolve(0), kill() {},
  }))).rejects.toThrow('malformed');
});

test('collector preserves collector-clock window and normalized C1 timestamps', async () => {
  let now = 100000; let reads = 0;
  const r = await sampleFleet({ schemaVersion: 1, hosts: [manifest.hosts[0]] }, hosts, { intervalMs: 5000, timeoutMs: 10000 }, {
    clock: () => now, monotonic: () => now,
    wait: async (ms) => { now += ms; },
    read: async () => reads++ ? raw(20) : raw(10),
  });
  expect(r.telemetry).toHaveLength(1);
  const s = r.telemetry[0];
  expect(s).toMatchObject({ environmentId: 'env-a', status: 'ok', source: 'linux-proc-ssh',
    windowStartedAt: 100000, windowEndedAt: 105000, receivedAt: 105000, intervalMs: 5000,
    durationMs: 5000, cpuBp: 10000, ramBp: 2000, ramLatestBp: 2000 });
  expect(telemetry(s, 105050)).toMatchObject({ status: 'measured', ageMs: 50,
    windowStartedAt: 100000, windowEndedAt: 105000, intervalMs: 5000 });
});


test('long samples report actual collector duration; remote wall-clock fields never govern freshness', async () => {
  let now = 100000; let reads = 0;
  const r = await sampleFleet({ ...manifest, hosts: [manifest.hosts[0]] }, hosts,
    { intervalMs: 60000, timeoutMs: 61000 }, { clock: () => now, monotonic: () => now,
      read: async () => raw(++reads * 10), wait: async (ms) => { now += ms; } });
  const sample = r.telemetry[0];
  expect(sample).toMatchObject({ status: 'ok', durationMs: 60000, intervalMs: 60000,
    windowStartedAt: 100000, windowEndedAt: 160000, source: 'linux-proc-ssh', windowKind: 'collector-bracket' });
  expect(telemetry({ ...sample, remoteWallClock: 99999999999999 }, 160001)).toMatchObject({ status: 'measured', ageMs: 1 });
});

test('read cancellation kills and reaps an actual owned subprocess', async () => {
  let child;
  const controller = new AbortController();
  const result = readProc(manifest.hosts[0], controller.signal, () => {
    child = Bun.spawn([process.execPath, '-e', 'setInterval(() => {}, 1000)'],
      { stdin: 'ignore', stdout: 'pipe', stderr: 'ignore' });
    return child;
  });
  const pid = child.pid;
  controller.abort(Error('cancelled'));
  await expect(result).rejects.toThrow(/^cancelled$/);
  expect(await child.exited).not.toBe(0);
  expect(() => process.kill(pid, 0)).toThrow();
});

test('failed telemetry reports collector age and configured timeout', () => {
  expect(telemetry({ ...good, status: 'timeout', timeoutMs: 6000 }, 100050)).toMatchObject({
    status: 'unknown', reason: 'timeout', ageMs: 50, durationMs: 5000, timeoutMs: 6000,
  });
});

test('elapsed deadlines and incomplete waits cannot produce measured pressure', async () => {
  for (const [elapsed, status] of [[4999, 'collector-clock'], [6000, 'timeout']]) {
    let now = 100000; let reads = 0;
    const r = await sampleFleet({ ...manifest, hosts: [manifest.hosts[0]] }, hosts, options, {
      clock: () => now, monotonic: () => now, read: async () => raw(++reads * 10),
      wait: async () => { now += elapsed; },
    });
    expect(r.telemetry[0].status).toBe(status);
    expect(telemetry(r.telemetry[0], now).status).toBe('unknown');
  }
});

test('successful and failed SSH reads both reap the owned process', async () => {
  const output = raw(10);
  for (const code of [0, 255]) {
    let reaped = false; let killed = false;
    const result = readProc(manifest.hosts[0], new AbortController().signal, () => ({
      stdout: new Blob([output]).stream(),
      get exited() { reaped = true; return Promise.resolve(code); },
      kill() { killed = true; },
    }));
    if (code === 0) expect(await result).toBe(output);
    else await expect(result).rejects.toThrow(/^failed$/);
    expect(reaped).toBe(true); expect(killed).toBe(true);
  }
});

test('immediate collection failure clears every owned deadline timer', async () => {
  const originalSet = globalThis.setTimeout; const originalClear = globalThis.clearTimeout;
  const pending = new Set();
  globalThis.setTimeout = (...args) => { const t = originalSet(...args); pending.add(t); return t; };
  globalThis.clearTimeout = (t) => { pending.delete(t); return originalClear(t); };
  try {
    const r = await sampleFleet(manifest, hosts, options, { read: async () => 'bad' });
    expect(r.telemetry.every((s) => s.status === 'malformed')).toBe(true);
    expect(pending.size).toBe(0);
  } finally {
    for (const t of pending) originalClear(t);
    globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear;
  }
});


test('sampling waits a full interval after the first SSH response before the second read', async () => {
  let now = 100000; let finishFirst;
  const events = [];
  const result = sampleFleet({ ...manifest, hosts: [manifest.hosts[0]] }, hosts,
    { intervalMs: 5000, timeoutMs: 10000 }, {
      clock: () => now, monotonic: () => now,
      read: () => {
        events.push(['read', now]);
        if (events.length === 1) return new Promise((resolve) => { finishFirst = resolve; });
        return raw(20);
      },
      wait: async (ms) => { events.push(['wait', now, ms]); now += ms; },
    });
  await Promise.resolve();
  expect(events).toEqual([['read', 100000]]);
  now += 2000; finishFirst(raw(10));
  const output = await result;
  expect(events).toEqual([['read', 100000], ['wait', 102000, 5000], ['read', 107000]]);
  expect(output.telemetry[0]).toMatchObject({ status: 'ok', durationMs: 7000, intervalMs: 5000 });
});


test.each(['sh', ...(Bun.which('fish') ? ['fish'] : [])])('remote proc command runs under %s login-shell syntax', (shell) => {
  const result = Bun.spawnSync([shell, '-c', PROC_COMMAND], { stdout: 'pipe', stderr: 'pipe' });
  expect(result.exitCode).toBe(0);
  expect(result.stderr.toString()).toBe('');
  const parsed = parseProc(result.stdout.toString());
  expect(parsed.counters).toHaveLength(8);
  expect(parsed.total).toBeGreaterThan(0n);
  expect(parsed.used).toBeGreaterThanOrEqual(0n);
});
