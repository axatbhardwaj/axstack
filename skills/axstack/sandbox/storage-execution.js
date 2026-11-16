import { checksWithRunner } from './storage-checks.js';
import { cleanupWithRunner } from './storage-cleanup.js';
import { planStorage, volumeCreate } from './storage-plan.js';
import { fs, hold, term, commands, runCommand, planContext, privateDirectory, statOrNull,
  loops, ownLoops, writeRecord, inspectVolume, validateVolume, unrelatedLoops } from './storage-support.js';

export function createStorage({ run = runCommand } = {}) {
  const { raw, checked } = commands(run);
  let pending = Promise.resolve();
  const serial = fn => input => {
    const next = pending.then(() => fn(input));
    pending = next.catch(() => {});
    return next;
  };
  return { prepareStorage: serial(prepareStorage), cleanupStorage: serial(cleanupWithRunner(run)), checkMountedStorage: serial(checksWithRunner(run)) };

  async function prepareStorage({ owner, plan, policy }) {
    const context = planContext(owner, plan);
    const canonical = planStorage({ runId: owner.runId, ownedDir: context.dir, policy });
    if (JSON.stringify(canonical) !== JSON.stringify(plan)) throw Error('Modified storage plan');
    await privateDirectory(context.dir);
    const terms = [];
    for (const binary of ['truncate', 'fallocate', 'mkfs.ext4', 'dumpe2fs', 'losetup', 'lsblk', 'docker', 'modprobe', 'test', 'cat']) {
      await checked(['which', binary]);
    }
    await checked(['test', '-c', '/dev/loop-control']);
    const cmdline = await checked(['cat', '/proc/cmdline']);
    const moduleOptions = await checked(['modprobe', '--showconfig']);
    const maxLoop = await checked(['cat', '/sys/module/loop/parameters/max_loop']);
    if (!/^\d+$/.test(maxLoop) || /(?:^|\s)(?:loop\.)?max_loop=/.test(cmdline) ||
        moduleOptions.split('\n').some(line => /^\s*options\s+loop\s/.test(line) && /\bmax_loop\s*=/.test(line))) {
      throw hold('On-demand loop allocation unknown/limited by max_loop configuration');
    }
    // The sysfs value (e.g. 8) is not itself a module-option declaration.
    terms.push(term('loop-allocatable', '/dev/loop-control present; no max_loop in cmdline or effective modprobe options',
      `sysfs max_loop=${maxLoop}; free-loop observations still required`));
    const before = await loops(checked);
    if (ownLoops(before, plan).length || await statOrNull(plan.imageFile) || await statOrNull(context.record) || await inspectVolume(raw, plan)) {
      throw hold('Leftover owned loop, image, record or volume requires cleanup before admission');
    }
    const candidate = await checked(['losetup', '--find']);
    terms.push(await reserveBeforeAttach(before, candidate, plan));
    const record = { owner, imageFile: plan.imageFile, volumeName: plan.volumeName, bytes: plan.bytes, inodes: plan.inodes };
    // Reserve ownership before creating the image: a SIGKILL cannot leave an
    // unlabelled image between creation and loop/volume registration.
    try { await writeRecord(context.record, record, true); } catch (error) { throw hold(`Cannot reserve image ownership: ${error.message}`); }
    const image = await fs.open(plan.imageFile, 'wx', 0o600);
    await image.close();
    for (const id of ['truncate', 'preallocate', 'format']) await checked(plan.steps.find(step => step.id === id).argv);
    const geometry = await checked(plan.steps.find(step => step.id === 'geometry').argv);
    const fields = Object.fromEntries(geometry.split('\n').map(line => {
      const match = /^([^:]+):\s*(\d+)\s*$/.exec(line);
      return match ? [match[1], Number(match[2])] : [];
    }).filter(entry => entry.length));
    const blockSize = fields['Block size'];
    const overhead = fields['Overhead clusters'];
    const clusterSize = fields['Cluster size'] ?? blockSize;
    const total = fields['Block count'] * blockSize - overhead * clusterSize;
    if (blockSize !== 4096 || clusterSize !== blockSize || fields['Block count'] * blockSize !== plan.bytes ||
        fields['Inode count'] !== plan.inodes || !Number.isSafeInteger(total) || total <= 0 || total > plan.bytes) throw hold('Formatted ext4 geometry is unknown or differs from recorded caps');
    record.filesystemBytes = total;
    record.user = policy.user;
    await writeRecord(context.record, record);
    terms.push(term('filesystem-total', total, `ext4 image cap=${plan.bytes}; inodes=${plan.inodes}; metadata overhead=${overhead * clusterSize}`));
    const loopDevice = await checked(plan.steps.find(step => step.id === 'attach').argv);
    if (!/^\/dev\/loop\d+$/.test(loopDevice)) throw hold('Attach did not return an exact loop device');
    const after = await loops(checked);
    const own = ownLoops(after, plan);
    if (own.length !== 1 || own[0].name !== loopDevice || own[0].autoclear) throw hold('Attached backing file/device/autoclear readback differs');
    if (unrelatedLoops(after, plan) !== unrelatedLoops(before, plan)) throw hold('Unrelated loop-device state changed during attachment');
    const spare = await checked(['losetup', '--find']);
    if (!/^\/dev\/loop\d+$/.test(spare) || after.some(loop => loop.name === spare)) throw hold('One further free/allocatable loop device is required');
    terms.push(term('free-loop-reserve', `${loopDevice} attached; ${spare} free/allocatable; admission lock is caller-held`));
    await checked(volumeCreate(plan.volumeName, loopDevice, owner));
    const volume = await inspectVolume(raw, plan);
    if (!volume) throw hold('Created volume missing on readback');
    validateVolume(volume, owner, loopDevice);
    terms.push(term('storage-prepared', plan.imageFile, loopDevice, plan.volumeName, 'autoclear=false; nosuid,nodev; no host mount'));
    return { loopDevice, terms };
  }

  async function reserveBeforeAttach(before, candidate, plan) {
    const evidence = [`attachment candidate=${candidate}`, 'No image created or loop attached by this preparation'];
    const uncertain = reason => Object.assign(hold('One further free/allocatable loop device is unproven before attachment'), {
      terms: [{ id: 'free-loop-reserve', status: 'unknown', evidence: [...evidence, reason] }],
    });
    let result;
    try { result = await raw(plan.steps.find(step => step.id === 'reserve-before-attach').argv); }
    catch (error) { throw uncertain(`Loop capacity observation unavailable: ${error.message}`); }
    if (result.exitCode !== 0) throw uncertain(`Loop capacity observation failed: ${result.stderr}`);
    let devices;
    try { devices = JSON.parse(result.stdout).blockdevices; } catch { throw uncertain('Invalid loop capacity JSON'); }
    if (!Array.isArray(devices) || devices.some(device => !device || typeof device.type !== 'string')) throw uncertain('Loop capacity enumeration is incomplete');
    const loopDevices = devices.filter(device => device.type === 'loop');
    if (loopDevices.some(device => !/^\/dev\/loop\d+$/.test(device.path ?? '') ||
        !/^\d+$/.test(String(device.size)) || !Number.isSafeInteger(Number(device.size)))) throw uncertain('Loop capacity fields are incomplete');
    const available = [...new Set(loopDevices.filter(device => Number(device.size) === 0 &&
      !before.some(loop => loop.name === device.path)).map(device => device.path))];
    evidence.push(`observed unbound loop devices=${JSON.stringify(available)}`);
    const spare = available.find(device => device !== candidate);
    if (!available.includes(candidate) || !spare) throw uncertain('Two distinct unbound devices required; configuration alone does not prove an allocatable spare');
    for (const device of [candidate, spare]) {
      let node;
      try { node = await raw(['test', '-b', device]); }
      catch (error) { throw uncertain(`Loop device node observation unavailable: ${device}: ${error.message}`); }
      if (node.exitCode !== 0) throw uncertain(`Observed loop device node unavailable: ${device}: ${node.stderr}`);
    }
    return term('free-loop-reserve-before-attach', ...evidence, `spare=${spare}; admission lock is caller-held`);
  }
}
