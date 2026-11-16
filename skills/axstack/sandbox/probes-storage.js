import { execute } from './probes-exec.js';
import { checkMountedStorage } from './storage.js';
import { planStorage, storageLabels } from './storage-plan.js';

/** Host-owned record + fresh Docker IDs bind D's semantic checks to E's probe. */
export async function checkFilesystem({ storage, containerId }, { runner = execute, check = checkMountedStorage, read = path => Bun.file(path).text() } = {}) {
  const record = JSON.parse(await read(`${storage.imageFile}.owner.json`));
  const policy = { user: record.user, dependencyBytes: storage.bytes, dependencyInodes: storage.inodes };
  const ownedDir = storage.imageFile.slice(0, storage.imageFile.lastIndexOf('/'));
  const canonical = planStorage({ runId: record.owner.runId, ownedDir, policy });
  if (JSON.stringify(storage) !== JSON.stringify(canonical)) throw Error('filesystem probe differs from D plan');
  const observed = await runner(['docker', 'ps', '--quiet', '--filter', `volume=${storage.volumeName}`]);
  if (observed.exitCode !== 0 || observed.timedOut || observed.truncated) throw Error('mounting containers unknown');
  const ids = observed.stdout.trim().split(/\s+/).filter(Boolean);
  if (!ids.length || ids.some(id => !/^[a-f0-9]{12,64}$/.test(id))) throw Error('mounting container IDs missing');
  const inspected = await runner(['docker', 'inspect', '--type', 'container', ...ids]);
  if (inspected.exitCode !== 0 || inspected.timedOut || inspected.truncated) throw Error('mount ownership unknown');
  const containers = JSON.parse(inspected.stdout);
  const labels = storageLabels(record.owner);
  if (containers.length !== ids.length || !containers.some(c => c.Name === `/${containerId}` || c.Id === containerId) ||
      containers.some(c => !ids.some(id => c.Id?.startsWith(id)) || !c.State?.Running || Object.entries(labels).some(([key, value]) => c.Config?.Labels?.[key] !== value))) throw Error('foreign/missing dependency-volume container');
  const terms = await check({ owner: record.owner, plan: storage, policy, containerIds: ids });
  if (terms.length !== ids.length || terms.some(t => t.status !== 'pass')) throw Error('incomplete capped-filesystem proof');
  return { status: 'pass', evidence: terms.map(t => JSON.stringify(t)) };
}

if (import.meta.main) {
  if (Bun.argv[2] === '--help') console.log('Usage: bun probes-storage.js STORAGE_JSON CONTAINER\nReads host-owned storage record and Docker metadata, invokes D checks under its persistent owned-directory flock (may create that lock), execs fixed non-root id/findmnt/stat in every owned mounting container. No host mount, network, prune or foreign container execution. Exit 0 facts, 2 unknown/hold, 1 invalid input.');
  else {
    try { console.log(JSON.stringify(await checkFilesystem({ storage: JSON.parse(Bun.argv[2]), containerId: Bun.argv[3] }))); }
    catch (error) { console.log(JSON.stringify({ status: 'unknown', evidence: [String(error)] })); process.exitCode = 2; }
  }
}
