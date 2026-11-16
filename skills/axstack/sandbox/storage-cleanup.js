import { containerList } from './storage-plan.js';
import { hold, term, commands, planContext, privateDirectory, statOrNull, loops, ownLoops,
  readRecord, inspectVolume, validateVolume, unlinkOwned, unrelatedLoops } from './storage-support.js';

export function cleanupWithRunner(run) {
  const { raw, checked } = commands(run);
  return async function cleanupStorage({ owner, plan }) {
    const context = planContext(owner, plan);
    await privateDirectory(context.dir);
    const noContainers = async () => {
      if (await checked(containerList(owner.runId)) ||
          await checked(['docker', 'ps', '--all', '--quiet', '--filter', `volume=${plan.volumeName}`])) {
        throw hold('Storage cleanup waits for every owned/mounting container to be removed');
      }
    };
    await noContainers();
    const record = await readRecord(context.record, owner, plan);
    const image = await statOrNull(plan.imageFile);
    const volume = await inspectVolume(raw, plan);
    const before = await loops(checked);
    if ((image || volume || ownLoops(before, plan).length) && !record) throw hold('Storage ownership record absent; preserve assets');
    if (image && (!image.isFile() || image.uid !== process.getuid() || image.nlink !== 1 || image.mode & 0o077)) throw hold('Unsafe backing image; preserve it');
    if (volume) {
      validateVolume(volume, owner);
      await noContainers();
      // Non-zero removal can mean another reaper won; only readback decides.
      await raw(['docker', 'volume', 'rm', plan.volumeName]);
      if (await inspectVolume(raw, plan)) throw hold('Owned volume remains after removal');
    }
    await noContainers();
    // Re-enumerate after volume removal, never detach the stale device recorded
    // in Docker options: after a reboot it could belong to a snap.
    const attached = await loops(checked);
    for (const loop of ownLoops(attached, plan)) {
      const fresh = ownLoops(await loops(checked), plan);
      if (!fresh.some(candidate => candidate.name === loop.name)) continue;
      await raw(['losetup', '--detach', loop.name]);
    }
    const readback = await loops(checked);
    if (ownLoops(readback, plan).length) throw hold('Owned loop device still attached after detach; backing image retained');
    if (unrelatedLoops(before, plan) !== unrelatedLoops(readback, plan)) throw hold('Unrelated loop-device state changed during cleanup; preserve image');
    // Last observation precedes deletion, including when no device survived reboot.
    await unlinkOwned(plan.imageFile);
    await unlinkOwned(context.record);
    return [term('storage-containers-gone', 'Independent run-label and volume-user checks: no containers'),
      term('storage-volume-gone', plan.volumeName), term('storage-loop-detached', plan.imageFile, 'No loop remains attached to this exact backing file; unbound nodes may remain'),
      term('storage-image-gone', plan.imageFile)];
  };
}
