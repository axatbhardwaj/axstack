import * as network from './network.js';
import * as storage from './storage.js';
import * as probes from './probes.js';
import { buildPlan } from './launcher-policy.js';
import { reapRuns, runPlan } from './launcher-runtime.js';
import * as hostIO from './launcher-host.js';
import { dockerObservers } from './launcher-docker.js';
import { bindCheckoutOrigin, exportSource } from './launcher-source.js';
import { recordCapture, saveReceipt } from './launcher-capture.js';

const dependencies = { ...network, ...storage, ...probes, ...hostIO,
  ...dockerObservers(hostIO.execute), liveness: hostIO.processState,
  exportSource: p => exportSource(p, hostIO.execute), recordCapture, saveReceipt };

/**
 * B owns launcher*. Planning is stateless and allowed on any host; run/reap are
 * axat-vps-only. Assets/facts are trusted launcher observations, never PR inputs.
 * @param {import('./launcher-contracts.js').PlanInput} input
 * @returns {import('./launcher-contracts.js').Plan} Exact argv, rules, storage, probes and caps; terms may hold execution.
 * @throws {Error} Invalid input; sandboxHold:true for incomplete/unsafe prerequisites.
 */
export function plan(input) { return buildPlan(input, { ...network, ...storage, ...probes }); }

/**
 * Revalidate identity/policy/caps and perform fresh enumeration + probes before PR code.
 * Host W3-1 capture owns receipt/log writes outside all untrusted writable roots.
 * @param {{plan:import('./launcher-contracts.js').Plan, evidenceDir:string}} input
 * @returns {Promise<import('./launcher-contracts.js').Receipt>}
 * @throws {Error} sandboxHold:true on any failed/unknown gate or cleanup uncertainty.
 */
export async function run(input) { return runPlan(input, dependencies); }

/**
 * Reap only labelled non-live runs. Unreadable PID/start/boot identity holds;
 * already-removed objects succeed. Never remove a rule before its containers.
 * @param {{assets:import('./launcher-contracts.js').Assets, host:import('./launcher-contracts.js').HostFacts}} input
 * @returns {Promise<import('./launcher-contracts.js').Term[]>} Per-resource cleanup facts, no aggregate verdict.
 * @throws {Error} sandboxHold:true on wrong host, unreadable liveness or leftover owned state.
 */
export async function reap(input) { return reapRuns(input, dependencies); }

// Private injection seam: package tests supply the frozen C/D/E interfaces.
export function createLauncher(dependencies) {
  return { plan: input => buildPlan(input, dependencies), run: input => runPlan(input, dependencies), reap: input => reapRuns(input, dependencies) };
}

export const help = `Usage: bun launcher.js plan --input FILE [--bind-origin]
       bun launcher.js run --input FILE --evidence-dir DIR
       bun launcher.js reap
       bun launcher.js --help
Plan prints exact Docker argv/rules; pass its full stdout to run unchanged.
--bind-origin checks pinned GitHub repo/head/base locally and uses exact origin.
Run/reap require hostname axat-vps AND the packaged SHA-256 of trimmed /etc/machine-id.
Owned directory: /var/lib/axstack/sandbox; image file and labelled Docker volume:
exact paths/names in plan.storage.imageFile and plan.storage.volumeName;
loop device: observed /dev/loopN, bound to that image file.
Admission uses flock and a short-lived Bun helper; writes admission.lock,
<runId>/plan.json and <runId>/source under the owned directory.
Fresh owned 0700 --evidence-dir on budgeted filesystem holds <runId>-plan.json,
capture .log/.json and <runId>-sandbox.json, within caps.
Run creates tracked-only source exports, capped ext4 storage, containers, networks,
scoped axstack_sandbox packet-filter rules, host capture logs and receipt files.
Pinned sidecars get a fixed 10-second startup grace inside the wall-time.
Run checks fresh per-run containment probes before PR commands; no reused results.
Reap removes only non-live labelled runs: containers before rules, volume before
matching loop detach/readback and image deletion. No unrelated state is pruned.
The owned inet axstack_sandbox table and input/forward chains persist after cleanup.
Writable /work tmpfs permits execution; /tmp and declared data tmpfs use noexec.
PID liveness uses /proc/<pid>/stat field 22 start ticks and kernel boot ID;
unreadable records hold until the owning driver resolves them.
Host wall-time covers every container (proxy and sidecars included): 900 seconds,
10 seconds grace, fixed maximum 910 seconds. Caller timeout MUST exceed 910 seconds.
SIGTERM, SIGINT and SIGHUP attempt best-effort cleanup. SIGKILL can leave bounded
objects until the next successful run/reap; a hung live launcher is not reaped.
Exit codes: 0 facts/success (child exit recorded separately),
1 invalid input/I/O, exit 2 containment, identity, capacity or cleanup hold.
Residual risks: shared kernel escape, opaque allowlisted HTTPS tunnels and no
upper bound on orphan lifetime if later reaping passes are missed or held.
`;

export async function cli(args) {
  if (args.length === 1 && args[0] === '--help') { console.log(help); return 0; }
  const [mode, ...rest] = args;
  if (!['plan', 'run', 'reap'].includes(mode)) throw Error('expected plan, run or reap; see --help');
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    if (mode === 'plan' && key === '--bind-origin' && !(key in flags)) { flags[key] = true; continue; }
    if (!['--input', '--evidence-dir'].includes(key) || !rest[i + 1] || key in flags) throw Error('invalid option; see --help');
    flags[key] = rest[++i];
  }
  if (mode === 'reap') {
    if (rest.length) throw Error('reap accepts no options');
    const assets = await hostIO.loadAssets();
    console.log(JSON.stringify(await reap({ assets, host: await hostIO.observeHost(assets) }), null, 2));
    return 0;
  }
  if (!flags['--input'] || (mode === 'run') !== Boolean(flags['--evidence-dir'])) throw Error('invalid options; see --help');
  const input = await Bun.file(flags['--input']).json();
  if (flags['--bind-origin']) input.request = await bindCheckoutOrigin(input?.request, hostIO.execute);
  const result = mode === 'plan' ? plan(input) : await run({ plan: input, evidenceDir: flags['--evidence-dir'] });
  console.log(JSON.stringify(result, null, 2));
  return 0;
}
if (import.meta.main) {
  try { process.exitCode = await cli(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = error.sandboxHold ? 2 : 1; }
}
