// Private storage wire construction. Braced values are bound after observations,
// never expanded by a shell. B binds each check's containerId and mount path.
const LOOP = '{loopDevice}';
export const MOUNT_PATH = '/dependencies';
export const LOOP_LIST = ['losetup', '--list', '--json', '--output', 'NAME,BACK-FILE,AUTOCLEAR'];
export const LABEL = 'axstack.sandbox';

export function storageLabels(owner) {
  return { [LABEL]: 'true', ...Object.fromEntries(Object.entries(owner).map(([key, value]) => [`${LABEL}.${key}`, String(value)])) };
}

export function storageNames(runId, ownedDir) {
  if (typeof runId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(runId) ||
      typeof ownedDir !== 'string' || !/^\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+$/.test(ownedDir) ||
      ownedDir.split('/').some(part => part === '.' || part === '..')) throw Error('Invalid storage run/path');
  return { imageFile: `${ownedDir}/axstack.sandbox-${runId}.img`, volumeName: `axstack-sandbox-${runId}-deps` };
}

export function validateOwner(owner) {
  if (owner?.label !== LABEL || !Number.isSafeInteger(owner.pid) || owner.pid < 1 ||
      !/^\d+$/.test(owner.startTimeTicks ?? '') || !/^[a-zA-Z0-9-]+$/.test(owner.bootId ?? '')) throw Error('Invalid storage owner');
}

/** @param {{runId:string, ownedDir:string, policy:Pick<import('./launcher-contracts.js').LaunchPolicy, 'user'|'dependencyBytes'|'dependencyInodes'>}} input
 * @returns {import('./launcher-contracts.js').StoragePlan} */
export function planStorage({ runId, ownedDir, policy }) {
  const names = storageNames(runId, ownedDir);
  if (!/^[1-9]\d*:[1-9]\d*$/.test(policy?.user ?? '') ||
      !Number.isSafeInteger(policy.dependencyBytes) || policy.dependencyBytes % 4096 !== 0 ||
      !Number.isSafeInteger(policy.dependencyInodes) || policy.dependencyInodes < 1 ||
      policy.dependencyBytes < policy.dependencyInodes * 256 + 32 * 1024 ** 2) throw Error('Invalid ext4 geometry/user');
  /** @param {string} id @param {'prepare'|'check'|'cleanup'} phase @param {string[]} argv @returns {import('./launcher-contracts.js').Step} */
  const step = (id, phase, argv, container = false) => ({ id, phase, executor: container ? 'container' : 'host',
    containerId: null, argv, path: container ? MOUNT_PATH : names.imageFile });
  const owner = { runId, pid: '{owner.pid}', startTimeTicks: '{owner.startTimeTicks}', bootId: '{owner.bootId}' };
  return { ...names, filesystem: 'ext4', bytes: policy.dependencyBytes, inodes: policy.dependencyInodes,
    mountOptions: ['nosuid', 'nodev'], keepFreeLoops: 1, autoclear: false,
    steps: [
      step('loop-control', 'prepare', ['test', '-c', '/dev/loop-control']),
      step('loop-cmdline', 'prepare', ['cat', '/proc/cmdline']),
      step('loop-module-options', 'prepare', ['modprobe', '--showconfig']),
      step('loop-module-limit', 'prepare', ['cat', '/sys/module/loop/parameters/max_loop']),
      step('loops-before', 'prepare', LOOP_LIST),
      step('free-loop', 'prepare', ['losetup', '--find']),
      step('reserve-before-attach', 'prepare', ['lsblk', '--all', '--json', '--bytes', '--output', 'PATH,TYPE,SIZE']),
      step('truncate', 'prepare', ['truncate', '--size', String(policy.dependencyBytes), names.imageFile]),
      step('preallocate', 'prepare', ['fallocate', '--length', String(policy.dependencyBytes), names.imageFile]),
      step('format', 'prepare', ['mkfs.ext4', '-F', '-b', '4096', '-I', '256', '-N', String(policy.dependencyInodes), '-m', '0',
        '-E', `root_owner=${policy.user},lazy_itable_init=0,lazy_journal_init=0`, names.imageFile]),
      step('geometry', 'prepare', ['dumpe2fs', '-h', names.imageFile]),
      step('attach', 'prepare', ['losetup', '--find', '--show', '--nooverlap', names.imageFile]),
      step('loops-attached', 'prepare', LOOP_LIST),
      step('reserve-loop', 'prepare', ['losetup', '--find']),
      step('volume', 'prepare', volumeCreate(names.volumeName, LOOP, owner)),
      step('volume-readback', 'prepare', ['docker', 'volume', 'inspect', names.volumeName]),
    ],
    checks: [step('non-root', 'check', ['id', '-u'], true),
      step('filesystem', 'check', ['findmnt', '--noheadings', '--raw', '--output', 'FSTYPE,OPTIONS', '--target', MOUNT_PATH], true),
      step('total-size', 'check', ['stat', '-f', '-c', '%S %b', MOUNT_PATH], true)],
    cleanup: [
      step('containers', 'cleanup', containerList(runId)),
      step('volume-inspect', 'cleanup', ['docker', 'volume', 'inspect', names.volumeName]),
      step('volume-remove', 'cleanup', ['docker', 'volume', 'rm', names.volumeName]),
      step('backing-files', 'cleanup', LOOP_LIST),
      step('detach', 'cleanup', ['losetup', '--detach', LOOP]),
      step('detach-readback', 'cleanup', LOOP_LIST),
      step('image-remove', 'cleanup', ['unlink', names.imageFile]),
    ] };
}

export function volumeCreate(name, device, owner) {
  return ['docker', 'volume', 'create', '--driver', 'local',
    ...Object.entries(storageLabels(owner)).flatMap(([key, value]) => ['--label', `${key}=${value}`]),
    '--opt', 'type=ext4', '--opt', 'o=nosuid,nodev', '--opt', `device=${device}`, name];
}
export function containerList(runId) {
  return ['docker', 'ps', '--all', '--quiet', '--filter', `label=${LABEL}=true`, '--filter', `label=${LABEL}.runId=${runId}`];
}
