import { expect, test } from 'bun:test';
import { planStorage } from '../../skills/axstack/sandbox/storage.js';

const policy = { user: '1000:1000', dependencyBytes: 8 * 1024 ** 3, dependencyInodes: 1048576 };

test('storage plan bounds the filesystem and retains a further loop without autoclear', () => {
  const plan = planStorage({ runId: 'r1', ownedDir: '/var/lib/axstack/sandbox', policy });
  expect(plan).toMatchObject({
    imageFile: '/var/lib/axstack/sandbox/axstack.sandbox-r1.img',
    volumeName: 'axstack-sandbox-r1-deps', filesystem: 'ext4', bytes: policy.dependencyBytes,
    inodes: 1048576, mountOptions: ['nosuid', 'nodev'], keepFreeLoops: 1, autoclear: false,
  });
  expect(plan.steps.find(step => step.id === 'format').argv).toContain('root_owner=1000:1000,lazy_itable_init=0,lazy_journal_init=0');
  expect(plan.steps.find(step => step.id === 'attach').argv).toEqual(['losetup', '--find', '--show', '--nooverlap', plan.imageFile]);
  expect(plan.steps.find(step => step.id === 'volume').argv).toContain('device={loopDevice}');
  expect(plan.checks.map(step => step.argv[0])).toEqual(['id', 'findmnt', 'stat']);
  expect(plan.cleanup.map(step => step.id)).toEqual(['containers', 'volume-inspect', 'volume-remove', 'backing-files', 'detach', 'detach-readback', 'image-remove']);
  expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
});

test('unsafe names, paths, root users and impossible geometry are rejected', () => {
  for (const patch of [{ runId: '../r' }, { ownedDir: '/tmp/../etc' }, { ownedDir: '/' },
    { policy: { ...policy, user: '0:0' } }, { policy: { ...policy, dependencyBytes: 123 } },
    { policy: { ...policy, dependencyInodes: 0 } }]) {
    expect(() => planStorage({ runId: 'r1', ownedDir: '/owned', policy, ...patch })).toThrow();
  }
});

import { afterEach } from 'bun:test';
import { mkdtemp, rm, access, readFile, writeFile, symlink } from 'node:fs/promises';
import { createStorage } from '../../skills/axstack/sandbox/storage.js';
import { LOOP_LIST, storageLabels } from '../../skills/axstack/sandbox/storage-plan.js';
const dirs = [];
afterEach(async () => { for (const path of dirs.splice(0)) await rm(path, { recursive: true, force: true }); });
const owner = { label: 'axstack.sandbox', runId: 'r1', pid: 42, startTimeTicks: '123', bootId: 'boot-1' };
const snap = { name: '/dev/loop0', 'back-file': '/var/lib/snapd/snaps/core.snap', autoclear: true };
async function fixture(options = {}) {
  const dir = await mkdtemp(`${process.env.TMPDIR ?? '/tmp'}/storage-test-`);
  dirs.push(dir);
  const plan = planStorage({ runId: 'r1', ownedDir: dir, policy });
  const state = { calls: [], loops: [snap], volume: null, attached: false, ...options };
  const run = async argv => {
    state.calls.push(argv);
    const ok = stdout => ({ exitCode: 0, stdout: stdout ?? '', stderr: '' });
    const fail = stderr => ({ exitCode: 1, stdout: '', stderr });
    if (argv[0] === 'which') return state.missingBinary === argv[1] ? fail('not installed') : ok(`/usr/bin/${argv[1]}`);
    if (argv[0] === 'test') return state.noControl || state.nodeMissing === argv[2] ? fail('missing loop device') : ok();
    if (argv[0] === 'cat') return ok(argv[1] === '/proc/cmdline' ? (state.cmdline ?? 'quiet') : '8');
    if (argv[0] === 'modprobe' && state.moduleUnknown) return fail('config unreadable');
    if (argv[0] === 'modprobe') return ok(state.moduleOptions ?? 'options loop max_part=0');
    if (JSON.stringify(argv) === JSON.stringify(LOOP_LIST)) return ok(JSON.stringify({ loopdevices: state.loops }));
    if (argv[0] === 'lsblk') {
      if (state.capacityError) return fail('capacity unavailable');
      if (state.capacityUnknown) return ok('{}');
      return ok(JSON.stringify({ blockdevices: [
        { path: snap.name, type: 'loop', size: 4096 },
        { path: '/dev/loop8', type: 'loop', size: 0 },
        ...(state.noSpare ? [] : [{ path: state.duplicateSpare ? '/dev/loop8' : '/dev/loop9', type: 'loop', size: 0 }]),
      ] }));
    }
    if (argv[0] === 'losetup' && argv.includes('--show')) {
      state.attached = true;
      state.loops.push({ name: '/dev/loop8', 'back-file': plan.imageFile, autoclear: state.autoclear ?? false });
      return state.attachError ? fail('attach failed after binding') : ok('/dev/loop8\n');
    }
    if (argv[0] === 'losetup' && argv.includes('--find')) return state.noSpare && state.attached ? fail('no free device') : ok(state.attached ? '/dev/loop9' : '/dev/loop8');
    if (argv[0] === 'losetup' && argv.includes('--detach')) {
      if (!state.busyDetach) state.loops = state.loops.filter(loop => loop.name !== argv[2]);
      return state.detachError ? fail('already gone') : ok();
    }
    if (argv[0] === 'dumpe2fs') return ok(`Block count: ${policy.dependencyBytes / 4096}\nBlock size: 4096\nInode count: ${policy.dependencyInodes}\nOverhead clusters: 70000\nCluster size: 4096\n`);
    if (argv[0] === 'docker' && argv[1] === 'ps') return ok(argv.includes('--all') ? (state.containers ?? '') : (state.currentIds ?? 'test-r1')); 
    if (argv[0] === 'docker' && argv[1] === 'volume') {
      const action = argv[2];
      if (action === 'create') {
        if (state.volumeError) return fail('mount unavailable');
        state.volume = { Name: plan.volumeName, Driver: 'local', Labels: storageLabels(owner),
          Options: { type: 'ext4', o: 'nosuid,nodev', device: '/dev/loop8' } };
        return ok(plan.volumeName);
      }
      if (action === 'inspect') return state.volume ? ok(JSON.stringify([state.volume])) : fail(`Error response from daemon: get ${plan.volumeName}: no such volume`);
      if (action === 'rm') { state.volume = null; return state.concurrentVolume ? fail('already removed') : ok(); }
    }
    if (argv[0] === 'docker' && argv[1] === 'inspect') return ok(JSON.stringify([{ Config: { User: policy.user },
      Mounts: [{ Type: 'volume', Name: plan.volumeName, Destination: '/dependencies' }] }]));
    if (argv[0] === 'docker' && argv[1] === 'exec') {
      if (argv[5] === 'id') return ok(state.rootContainer ? '0' : '1000');
      if (argv[5] === 'findmnt') return ok(state.badType ? 'tmpfs rw,nosuid,nodev' : 'ext4 rw,nosuid,nodev');
      if (argv[5] === 'stat') return ok(`4096 ${state.badSize ? 1 : policy.dependencyBytes / 4096 - 70000}`);
    }
    if (argv[0] === 'fallocate' && state.shortDisk) return fail('No space left on device');
    if (['truncate', 'fallocate', 'mkfs.ext4'].includes(argv[0])) return ok();
    throw Error(`Unmodelled command: ${JSON.stringify(argv)}`);
  };
  return { dir, plan, state, api: createStorage({ run }), input: { owner, plan, policy } };
}

async function exists(path) { try { await access(path); return true; } catch { return false; } }

test('preparation observes a persistent loop, reserves another, labels the local volume and records geometry', async () => {
  const { api, input, state, plan } = await fixture();
  const result = await api.prepareStorage(input);
  expect(result.loopDevice).toBe('/dev/loop8');
  expect(result.terms.find(term => term.id === 'loop-allocatable')).toMatchObject({ status: 'pass' });
  expect(result.terms.find(term => term.id === 'filesystem-total').evidence).toContain(String(policy.dependencyBytes - 70000 * 4096));
  expect(await exists(plan.imageFile)).toBe(true);
  expect(state.volume.Options).toEqual({ type: 'ext4', o: 'nosuid,nodev', device: '/dev/loop8' });
  expect(state.calls.findIndex(argv => argv[0] === 'fallocate')).toBeLessThan(state.calls.findIndex(argv => argv[0] === 'mkfs.ext4'));
  expect(state.calls.find(argv => argv[0] === 'mkfs.ext4')).toContain('root_owner=1000:1000,lazy_itable_init=0,lazy_journal_init=0');
  expect(state.loops[0]).toEqual(snap);
});

for (const [name, options] of Object.entries({ 'missing loop-control': { noControl: true },
  'kernel max_loop': { cmdline: 'quiet loop.max_loop=8' }, 'module max_loop': { moduleOptions: 'options loop max_loop=8' },
  'short disk': { shortDisk: true }, 'no reserve': { noSpare: true },
  'autoclear attachment': { autoclear: true }, 'mount failure': { volumeError: true } })) {
  test(`preparation holds on ${name} without an uncapped fallback`, async () => {
    const { api, input, state } = await fixture(options);
    await expect(api.prepareStorage(input)).rejects.toMatchObject({ sandboxHold: true });
    expect(state.calls.some(argv => argv[0] === 'mount')).toBe(false);
    if (['missing loop-control', 'kernel max_loop', 'module max_loop'].includes(name)) expect(state.attached).toBe(false);
  });
}

test('an existing image or a leftover owned loop holds rather than overwriting storage', async () => {
  const { api, input, state, plan } = await fixture();
  await api.prepareStorage(input);
  await expect(api.prepareStorage(input)).rejects.toMatchObject({ sandboxHold: true });
  expect(state.calls.filter(argv => argv[0] === 'mkfs.ext4')).toHaveLength(1);
  expect(await exists(plan.imageFile)).toBe(true);
});

test('cleanup removes volume before exact-image detach and readback before image deletion', async () => {
  const { api, input, state, plan } = await fixture();
  await api.prepareStorage(input);
  state.calls.length = 0;
  const terms = await api.cleanupStorage(input);
  expect(terms.every(term => term.status === 'pass')).toBe(true);
  expect(state.calls.findIndex(argv => argv[2] === 'rm')).toBeLessThan(state.calls.findIndex(argv => argv.includes('--detach')));
  const detachAt = state.calls.findIndex(argv => argv.includes('--detach'));
  expect(state.calls.slice(detachAt + 1)).toContainEqual(LOOP_LIST);
  expect(state.loops).toEqual([snap]);
  expect(await exists(plan.imageFile)).toBe(false);
});

for (const window of ['attach-before-volume', 'reboot', 'orphan-before-attach', 'concurrent-removal']) {
  test(`cleanup recovers ${window} and is idempotent`, async () => {
    const options = window === 'attach-before-volume' ? { volumeError: true } : window === 'orphan-before-attach' ? { shortDisk: true } : {};
    const { api, input, state, plan } = await fixture(options);
    try { await api.prepareStorage(input); } catch (error) { expect(error.sandboxHold).toBe(true); }
    if (window === 'reboot') state.loops = [snap];
    if (window === 'concurrent-removal') { state.concurrentVolume = true; state.detachError = true; }
    await api.cleanupStorage(input);
    await api.cleanupStorage(input);
    expect(await exists(plan.imageFile)).toBe(false);
    expect(state.loops).toEqual([snap]);
  });
}

test('busy detach returning success holds and retains its backing image', async () => {
  const { api, input, state, plan } = await fixture();
  await api.prepareStorage(input);
  state.busyDetach = true;
  await expect(api.cleanupStorage(input)).rejects.toMatchObject({ sandboxHold: true });
  expect(await exists(plan.imageFile)).toBe(true);
  expect(state.loops).toHaveLength(2);
});

test('cleanup independently blocks while any owned or volume-mounting container remains', async () => {
  const { api, input, state } = await fixture();
  await api.prepareStorage(input);
  state.calls.length = 0;
  state.containers = 'still-running';
  await expect(api.cleanupStorage(input)).rejects.toMatchObject({ sandboxHold: true });
  expect(state.calls.some(argv => argv[2] === 'rm' || argv.includes('--detach'))).toBe(false);
});

test('a foreign volume or owner record is never reaped', async () => {
  const { api, input, state, plan } = await fixture();
  await api.prepareStorage(input);
  state.volume.Labels['axstack.sandbox.boot-id'] = 'another-boot';
  state.calls.length = 0;
  await expect(api.cleanupStorage(input)).rejects.toMatchObject({ sandboxHold: true });
  expect(state.calls.some(argv => argv[2] === 'rm' || argv.includes('--detach'))).toBe(false);
  expect(JSON.parse(await readFile(`${plan.imageFile}.owner.json`, 'utf8')).owner).toEqual(owner);
});

test('attach failure after binding leaves discoverable ownership and can be reaped', async () => {
  const { api, input, state, plan } = await fixture({ attachError: true });
  await expect(api.prepareStorage(input)).rejects.toMatchObject({ sandboxHold: true });
  expect(state.volume).toBeNull();
  expect(state.loops).toHaveLength(2);
  await api.cleanupStorage(input);
  expect(await exists(plan.imageFile)).toBe(false);
  expect(state.loops).toEqual([snap]);
});

test('every mounting container gets non-root type and exact usable-total checks', async () => {
  const { api, input, state } = await fixture();
  await api.prepareStorage(input);
  state.currentIds = 'fetch-r1 test-r1 probe-r1';
  const terms = await api.checkMountedStorage({ ...input, containerIds: ['fetch-r1', 'test-r1', 'probe-r1'] });
  expect(terms).toHaveLength(3);
  for (const id of ['fetch-r1', 'test-r1', 'probe-r1']) {
    expect(state.calls.filter(argv => argv[1] === 'exec' && argv[4] === id)).toHaveLength(3);
    expect(state.calls.filter(argv => argv[1] === 'exec' && argv[4] === id).every(argv => argv[2] === '--user' && argv[3] === policy.user)).toBe(true);
  }
});
for (const [name, options] of Object.entries({ 'root execution': { rootContainer: true },
  'wrong filesystem': { badType: true }, 'wrong total size': { badSize: true } })) {
  test(`per-container check holds on ${name}`, async () => {
    const { api, input } = await fixture(options);
    await api.prepareStorage(input);
    await expect(api.checkMountedStorage({ ...input, containerIds: ['test-r1'] })).rejects.toMatchObject({ sandboxHold: true });
  });
}
test('empty mounting-container enumeration does not pass containment', async () => {
  const { api, input } = await fixture();
  await api.prepareStorage(input);
  await expect(api.checkMountedStorage({ ...input, containerIds: [] })).rejects.toMatchObject({ sandboxHold: true });
});

test('simultaneous reapers both succeed after one removes the assets', async () => {
  const { api, input, plan } = await fixture();
  await api.prepareStorage(input);
  const settled = await Promise.allSettled([api.cleanupStorage(input), api.cleanupStorage(input)]);
  expect(settled.map(result => result.status)).toEqual(['fulfilled', 'fulfilled']);
  expect(await exists(plan.imageFile)).toBe(false);
});

test('capped checks cannot be replaced by caller-supplied commands', async () => {
  const { api, input, state } = await fixture();
  await api.prepareStorage(input);
  const changed = structuredClone(input);
  changed.plan.checks[0].argv = ['not-a-check'];
  await expect(api.checkMountedStorage({ ...changed, containerIds: ['test-r1'] })).rejects.toThrow('Modified storage checks');
  expect(state.calls.some(argv => argv.includes('not-a-check'))).toBe(false);
});

test('a mounting container omitted by the caller holds the check', async () => {
  const { api, input, state } = await fixture();
  await api.prepareStorage(input);
  state.currentIds = 'test-r1 unexpected-r1';
  await expect(api.checkMountedStorage({ ...input, containerIds: ['test-r1'] })).rejects.toMatchObject({ sandboxHold: true });
});

test('production lock worker receives exact input and returns validation errors before commands', async () => {
  const { input } = await fixture();
  const modified = structuredClone(input);
  modified.plan.steps[0].argv = ['caller-command'];
  const { prepareStorage } = await import('../../skills/axstack/sandbox/storage.js');
  await expect(prepareStorage(modified)).rejects.toThrow('Modified storage plan');
});

for (const binary of ['truncate', 'mkfs.ext4', 'losetup', 'fallocate', 'dumpe2fs']) {
  test(`missing ${binary} holds before image creation`, async () => {
    const { api, input, plan, state } = await fixture({ missingBinary: binary });
    await expect(api.prepareStorage(input)).rejects.toMatchObject({ sandboxHold: true });
    expect(await exists(plan.imageFile)).toBe(false);
    expect(state.attached).toBe(false);
  });
}
test('unknown module configuration holds even with loop-control and max_loop=8', async () => {
  const { api, input, plan } = await fixture({ moduleUnknown: true });
  await expect(api.prepareStorage(input)).rejects.toMatchObject({ sandboxHold: true });
  expect(await exists(plan.imageFile)).toBe(false);
});
test('reboot with the old loop number reassigned to a snap never detaches that node', async () => {
  const { api, input, state, plan } = await fixture();
  await api.prepareStorage(input);
  state.loops = [snap, { ...snap, name: '/dev/loop8', 'back-file': '/var/lib/snapd/snaps/new.snap' }];
  state.calls.length = 0;
  await api.cleanupStorage(input);
  expect(state.calls.some(argv => argv.includes('--detach'))).toBe(false);
  expect(state.loops).toHaveLength(2);
  expect(await exists(plan.imageFile)).toBe(false);
});
test('an unrecorded image is preserved, never adopted by cleanup', async () => {
  const { api, input, plan } = await fixture();
  await writeFile(plan.imageFile, 'foreign file', { mode: 0o600 });
  await expect(api.cleanupStorage(input)).rejects.toMatchObject({ sandboxHold: true });
  expect(await readFile(plan.imageFile, 'utf8')).toBe('foreign file');
});
test('a symlink backing image is never formatted or deleted', async () => {
  const { api, input, plan, dir } = await fixture();
  const target = `${dir}/foreign-file`;
  await writeFile(target, 'foreign file');
  await symlink(target, plan.imageFile);
  await expect(api.prepareStorage(input)).rejects.toMatchObject({ sandboxHold: true });
  await expect(api.cleanupStorage(input)).rejects.toMatchObject({ sandboxHold: true });
  expect(await readFile(target, 'utf8')).toBe('foreign file');
});

test('production workers wait for the cross-process lock before entering storage commands', async () => {
  const { dir, input } = await fixture();
  const lock = `${dir}/.axstack-storage.lock`;
  await writeFile(lock, '', { mode: 0o600 });
  const holder = Bun.spawn(['/usr/bin/flock', '--exclusive', lock, process.execPath, '-e',
    "process.stdout.write('locked\\n'); await Bun.stdin.text();"], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' });
  try {
    await holder.stdout.getReader().read();
    const { prepareStorage } = await import('../../skills/axstack/sandbox/storage.js');
    const modified = structuredClone(input);
    modified.plan.steps[0].argv = ['caller-command'];
    let settled = false;
    const result = prepareStorage(modified).then(() => null, error => error).finally(() => { settled = true; });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(settled).toBe(false);
    holder.stdin.end();
    expect(await holder.exited).toBe(0);
    expect((await result).message).toBe('Modified storage plan');
  } finally { holder.kill(); }
});


test('a sole remaining loop holds before attachment when no further loop is allocatable', async () => {
  const { api, input, state, plan } = await fixture({ noSpare: true });
  const error = await api.prepareStorage(input).then(() => null, error => error);
  expect(error).toMatchObject({ sandboxHold: true, terms: [{ id: 'free-loop-reserve', status: 'unknown' }] });
  expect(error.terms[0].evidence.join(' ')).toContain('/dev/loop8');
  expect(state.attached).toBe(false);
  expect(state.loops).toEqual([snap]);
  expect(state.volume).toBeNull();
  expect(await exists(plan.imageFile)).toBe(false);
  expect(await exists(`${plan.imageFile}.owner.json`)).toBe(false);
  expect(state.calls.some(argv => ['truncate', 'fallocate', 'mkfs.ext4'].includes(argv[0]))).toBe(false);
});


for (const [name, options] of Object.entries({ 'unreadable capacity': { capacityError: true },
  'incomplete capacity': { capacityUnknown: true }, 'duplicate candidate': { duplicateSpare: true },
  'missing spare node': { nodeMissing: '/dev/loop9' } })) {
  test(`${name} holds with evidence before creating storage`, async () => {
    const { api, input, state, plan } = await fixture(options);
    const error = await api.prepareStorage(input).then(() => null, error => error);
    expect(error).toMatchObject({ sandboxHold: true, terms: [{ id: 'free-loop-reserve', status: 'unknown' }] });
    expect(error.terms[0].evidence.length).toBeGreaterThan(0);
    expect(state.attached).toBe(false);
    expect(await exists(plan.imageFile)).toBe(false);
    expect(await exists(`${plan.imageFile}.owner.json`)).toBe(false);
    expect(state.volume).toBeNull();
  });
}

test('the reserve observation precedes image allocation in both plan and execution', async () => {
  const { api, input, state, plan } = await fixture();
  const ids = plan.steps.map(step => step.id);
  expect(ids.indexOf('reserve-before-attach')).toBeGreaterThan(ids.indexOf('free-loop'));
  expect(ids.indexOf('reserve-before-attach')).toBeLessThan(ids.indexOf('truncate'));
  await api.prepareStorage(input);
  expect(state.calls.findIndex(argv => argv[0] === 'lsblk')).toBeGreaterThan(-1);
  expect(state.calls.findIndex(argv => argv[0] === 'lsblk')).toBeLessThan(state.calls.findIndex(argv => argv[0] === 'truncate'));
});
