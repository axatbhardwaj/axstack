import { planStorage } from './storage-plan.js';
import { hold, term, commands, planContext, privateDirectory, readRecord } from './storage-support.js';

export function checksWithRunner(run) {
  const { checked } = commands(run);
  return async function checkMountedStorage({ owner, plan, policy, containerIds }) {
    const context = planContext(owner, plan);
    const canonical = planStorage({ runId: owner.runId, ownedDir: context.dir, policy });
    if (JSON.stringify(plan.checks) !== JSON.stringify(canonical.checks)) throw Error('Modified storage checks');
    await privateDirectory(context.dir);
    const record = await readRecord(context.record, owner, plan);
    if (!record || record.user !== policy.user || !/^[1-9]\d*:[1-9]\d*$/.test(policy.user) ||
        !Number.isSafeInteger(record.filesystemBytes) || record.filesystemBytes < 1 || record.filesystemBytes > plan.bytes) throw hold('Missing recorded filesystem geometry/user');
    if (!Array.isArray(containerIds) || !containerIds.length || new Set(containerIds).size !== containerIds.length ||
        containerIds.some(id => !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(id))) throw hold('Mounting-container enumeration missing/invalid');
    const mounted = (await checked(['docker', 'ps', '--quiet', '--filter', `volume=${plan.volumeName}`])).split(/\s+/).filter(Boolean);
    if (!mounted.length) throw hold('No running mounting containers observed');
    // Docker ps returns IDs, so callers bind those exact observations rather
    // than guessing names. Recheck at each fetch/test/probe phase.
    if (mounted.some(id => !containerIds.includes(id))) throw hold('A mounting container was omitted from the capped-filesystem checks');
    const terms = [];
    for (const containerId of containerIds) {
      let container;
      try { [container] = JSON.parse(await checked(['docker', 'inspect', containerId])); } catch { throw hold('Mounting container inspection unknown'); }
      if (container?.Config?.User !== policy.user || !container.Mounts?.some(mount => mount.Type === 'volume' &&
          mount.Name === plan.volumeName && mount.Destination === plan.checks[0].path)) throw hold('Container user or dependency-volume binding differs');
      const results = [];
      for (const step of plan.checks) results.push(await checked(['docker', 'exec', '--user', policy.user, containerId, ...step.argv]));
      const [uid, filesystem, total] = results;
      const [type, options] = (filesystem ?? '').split(/\s+/);
      const [blockSize, blocks] = (total ?? '').split(/\s+/).map(Number);
      if (uid !== policy.user.split(':')[0] || type !== 'ext4' || !['nosuid', 'nodev'].every(option => options?.split(',').includes(option)) ||
          blockSize !== 4096 || !Number.isSafeInteger(blocks) || blocks * blockSize !== record.filesystemBytes) throw hold(`Capped-filesystem check failed in ${containerId}`);
      terms.push(term(`capped-filesystem:${containerId}`, `uid=${uid}; ext4 nosuid,nodev`,
        `total=${record.filesystemBytes}; image cap=${plan.bytes}; inodes=${plan.inodes}`));
    }
    return terms;
  };
}
