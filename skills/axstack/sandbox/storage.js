import { fs, hold, planContext, privateDirectory, statOrNull } from './storage-support.js';
import { createStorage } from './storage-execution.js';
export { createStorage } from './storage-execution.js';
export { planStorage } from './storage-plan.js';

/**
 * B holds its host admission lock through attachment. Production mutations also
 * share a persistent advisory lock across processes; never unlink that lock file.
 * @param {{owner:import('./launcher-contracts.js').Owner, plan:import('./launcher-contracts.js').StoragePlan, policy:import('./launcher-contracts.js').LaunchPolicy}} input
 * @returns {Promise<{loopDevice:string, terms:import('./launcher-contracts.js').Term[]}>}
 */
export async function prepareStorage(input) { return locked('prepareStorage', input); }
/** @param {{owner:import('./launcher-contracts.js').Owner, plan:import('./launcher-contracts.js').StoragePlan}} input
 * @returns {Promise<import('./launcher-contracts.js').Term[]>} */
export async function cleanupStorage(input) { return locked('cleanupStorage', input); }
/**
 * B supplies fresh Docker IDs for every currently mounting container, before
 * its fetch/test/probe command; static checks alone are never containment proof.
 */
export async function checkMountedStorage(input) { return locked('checkMountedStorage', input); }

async function locked(action, input) {
  const context = planContext(input.owner, input.plan);
  await privateDirectory(context.dir);
  try {
    const file = await fs.open(context.lock, 'wx', 0o600);
    await file.close();
  } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const lock = await statOrNull(context.lock);
  if (!lock?.isFile() || lock.nlink !== 1 || lock.uid !== process.getuid() || lock.mode & 0o077) throw hold('Unsafe storage advisory lock');
  // Fixed worker argv/env; JSON travels on stdin, with no shell interpolation.
  let child;
  try {
    child = Bun.spawn(['/usr/bin/flock', '--exclusive', '--timeout', '30', context.lock,
      process.execPath, import.meta.path, '--internal-worker', action], {
      stdin: 'pipe', stdout: 'pipe', stderr: 'pipe', env: { PATH: '/usr/sbin:/usr/bin:/sbin:/bin', LC_ALL: 'C' },
    });
    child.stdin.write(JSON.stringify(input));
    child.stdin.end();
  } catch (error) { throw hold(`Storage lock worker unavailable: ${error.message}`); }
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  let result;
  try { result = JSON.parse(stdout); } catch { throw hold(`Storage lock/worker failed (${exitCode}): ${stderr}`); }
  if (exitCode || result.error) throw Object.assign(Error(result.error ?? stderr), { sandboxHold: result.sandboxHold === true });
  return result.value;
}

if (import.meta.main) {
  if (process.argv[2] === '--help') {
    console.log(`Usage: storage.js --help | --internal-worker <prepareStorage|cleanupStorage|checkMountedStorage>
Private launcher storage worker; input JSON on stdin, output JSON on stdout.
Side effects: prepare creates a private run-owner record, preallocated ext4 image file,
launcher-attached loop device (no autoclear), labelled Docker local volume nosuid,nodev.
Cleanup independently checks containers, removes volume, detaches only the exact
owned backing file, verifies detach readback, then unlinks image and owner record.
No launcher-side mount or uncapped directory fallback. Checks exec fixed probes as
policy uid:gid in every mounting container. Spawns fixed host commands and one worker
under flock; the 0600 .axstack-storage.lock in the owned directory remains in place.
No network request, prune, timer, agent, retry, merge or scheduling. Caller B owns
host identity/liveness/budget validation and admission serialization through attach.
Exit: 0 facts, 1 invalid input/I/O, 2 containment or cleanup hold.`);
  } else if (process.argv[2] === '--internal-worker' && ['prepareStorage', 'cleanupStorage', 'checkMountedStorage'].includes(process.argv[3])) {
    try {
      const input = JSON.parse(await Bun.stdin.text());
      const value = await createStorage()[process.argv[3]](input);
      console.log(JSON.stringify({ value }));
    } catch (error) {
      console.log(JSON.stringify({ error: error.message, sandboxHold: error.sandboxHold === true }));
      process.exitCode = error.sandboxHold ? 2 : 1;
    }
  } else {
    console.error('Invalid storage worker flags; use --help');
    process.exitCode = 1;
  }
}
