import { expect, test } from 'bun:test';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statfsSync, symlinkSync, writeFileSync } from 'node:fs';
import { currentOwner, observeHost, processState, savePlan, withAdmission } from '../../skills/axstack/sandbox/launcher-host.js';
import { createLauncher } from '../../skills/axstack/sandbox/launcher.js';
import { fixture, planners } from './sandbox-launcher-fixture.js';

test('liveness binds PID to Linux stat field 22 and boot ID; unreadable never means dead', () => {
  const owner = fixture().owner;
  const stat = (ticks = '123') => `42 (name with ) parens) S ${Array(18).fill('0').join(' ')} ${ticks} 0`;
  const read = (ticks, boot = 'boot-1') => path => path.endsWith('boot_id') ? boot : stat(ticks);
  expect(processState(owner, read('123'))).toBe('live');
  expect(processState(owner, read('124'))).toBe('dead'); // PID reused.
  expect(processState(owner, read('123', 'new-boot'))).toBe('dead');
  expect(processState(owner, () => { throw Object.assign(Error('denied'), { code: 'EACCES' }); })).toBe('unknown');
  expect(processState(owner, path => { if (path.endsWith('boot_id')) return 'boot-1'; throw Object.assign(Error('gone'), { code: 'ENOENT' }); })).toBe('dead');
  expect(processState(owner, read('not-a-tick'))).toBe('unknown');
});

test('packaged host budgets fit two fully populated runs including all declared tmpfs', () => {
  const input = fixture(), dir = `${import.meta.dir}/../../skills/axstack/sandbox`;
  for (const [key, name] of [['hostBinding', 'launcher-host.json'], ['hostBudget', 'launcher-host-budget.json'], ['policy', 'launcher-policy.json']]) input.assets[key] = JSON.parse(readFileSync(`${dir}/${name}`, 'utf8'));
  input.host = { ...input.host, ...input.assets.hostBinding, freeMemoryBytes: 32 * 1073741824, freeDiskBytes: 200 * 1073741824 };
  input.assets.sidecars.images = Array.from({ length: 9 }, (_, n) => ({ ...input.assets.sidecars.images[0], id: `db${n}` }));
  input.request.sidecarIds = input.assets.sidecars.images.map(s => s.id);
  const p = createLauncher(planners()).plan(input);
  expect(p.terms.find(t => t.id === 'host-budget').status).toBe('pass');
  expect(p.caps.wallTimeSeconds + p.caps.graceSeconds).toBe(910);
});
test('SIGKILL to a launcher process alone changes real PID/start-time liveness to dead', async () => {
  const proc = Bun.spawn([process.execPath, '-e', 'setInterval(() => {}, 1000)'], { stdout: 'ignore', stderr: 'ignore' });
  try {
    const stat = readFileSync(`/proc/${proc.pid}/stat`, 'utf8');
    const owner = { ...fixture().owner, pid: proc.pid, startTimeTicks: stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)[19], bootId: readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim() };
    expect(processState(owner)).toBe('live');
    proc.kill('SIGKILL'); await proc.exited;
    expect(processState(owner)).toBe('dead');
  } finally { proc.kill('SIGKILL'); await proc.exited; }
});
test('real kernel admission lock excludes a second admission and releases normally', async () => {
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/launcher-lock-`); chmodSync(dir, 0o700);
  try {
    await withAdmission(async () => {
      await expect(withAdmission(async () => { throw Error('entered second admission'); }, dir)).rejects.toMatchObject({ sandboxHold: true });
    }, dir);
    let entered = false;
    await withAdmission(async () => { entered = true; }, dir);
    expect(entered).toBe(true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('evidence inside a symlinked source root holds before writing into the host clone', async () => {
  const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/launcher-evidence-`); chmodSync(root, 0o700);
  try {
    mkdirSync(`${root}/repo`, { mode: 0o700 }); mkdirSync(`${root}/repo/evidence`, { mode: 0o700 });
    mkdirSync(`${root}/owned`, { mode: 0o700 }); symlinkSync(`${root}/repo`, `${root}/alias`);
    const p = createLauncher(planners()).plan(fixture()); p.request.repo = `${root}/alias`;
    await expect(savePlan(p, `${root}/repo/evidence`, `${root}/owned`)).rejects.toMatchObject({ sandboxHold: true });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('a new run cannot reuse an evidence directory containing retained bytes from another run', async () => {
  const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/launcher-fresh-`); chmodSync(root, 0o700);
  try {
    for (const n of ['repo', 'evidence', 'owned']) mkdirSync(`${root}/${n}`, { mode: 0o700 });
    writeFileSync(`${root}/evidence/old.log`, 'prior output');
    const p = createLauncher(planners()).plan(fixture()); p.request.repo = `${root}/repo`;
    await expect(savePlan(p, `${root}/evidence`, `${root}/owned`)).rejects.toMatchObject({ sandboxHold: true });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

async function withHostObservation(check) {
  const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/launcher-observation-`); chmodSync(root, 0o700);
  try {
    const assets = fixture().assets; assets.ownedDir = root;
    assets.hostBinding.hostname = 'not-the-observed-host';
    await check(await observeHost(assets), root);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
test('host observation reads the real hostname independently of configured identity', async () => {
  await withHostObservation(host => expect(host.hostname).toBe(readFileSync('/proc/sys/kernel/hostname', 'utf8').trim()));
});

test('host observation hashes trimmed machine-id bytes independently of configured hash', async () => {
  const expected = new Bun.CryptoHasher('sha256').update(readFileSync('/etc/machine-id', 'utf8').trim()).digest('hex');
  await withHostObservation(host => expect(host.machineIdSha256).toBe(expected));
});

test('host memory observation uses bytes rather than the proc kB count', async () => {
  await withHostObservation(host => {
    const now = Number(/^MemAvailable:\s+(\d+) kB$/m.exec(readFileSync('/proc/meminfo', 'utf8'))[1]) * 1024;
    expect(host.freeMemoryBytes / now).toBeGreaterThan(0.5);
    expect(host.freeMemoryBytes / now).toBeLessThan(1.5);
  });
});

test('host disk observation multiplies available blocks by filesystem block size', async () => {
  await withHostObservation((host, root) => {
    const current = statfsSync(root), bytes = Number(current.bavail) * Number(current.bsize);
    expect(host.freeDiskBytes / bytes).toBeGreaterThan(0.5);
    expect(host.freeDiskBytes / bytes).toBeLessThan(1.5);
  });
});

test('current launcher owner records a live PID start time and the real boot identity', async () => {
  const owner = await currentOwner('adapter-owner-test');
  expect(owner.pid).toBe(process.pid);
  expect(owner.bootId).toBe(readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim());
  expect(processState(owner)).toBe('live');
});
