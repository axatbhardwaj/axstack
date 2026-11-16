import { lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { runCommand } from '../scripts/command-capture.js';
import { captureTerms, sha256, sourceIdentity } from '../scripts/capture-identity.js';
import { hold } from './launcher-policy.js';
import { checkFilesystem } from './probes-storage.js';

export function receiptBytes(evidenceDir) {
  let bytes = 0;
  for (const name of readdirSync(evidenceDir)) {
    const s = lstatSync(`${evidenceDir}/${name}`);
    if (!s.isFile() || s.isSymbolicLink()) hold('evidence directory contains non-regular entries');
    if (!name.endsWith('.log')) bytes += s.size;
  }
  return bytes;
}
function workloadExec(p, role, argv) {
  const c = p.containers.find(c => c.role === role);
  return ['docker', 'exec', '--user', p.policy.user, '--workdir', '/work', c.id, '/bin/sh', '-c', 'cp -R /source/. /work/ && chmod -R u+w /work && cd /work && exec "$@"', 'axstack', ...argv];
}
export function verifyCapture(path, p, argv) {
  const bytes = readFileSync(path), step = JSON.parse(bytes.toString());
  const expected = { repository: p.request.repository, head: p.request.head, base: p.request.base };
  const terms = captureTerms(step, expected);
  if (terms.some(t => t.status !== 'pass')) hold('W3-1 capture identity/log/source/proof incomplete');
  const role = step.kind === 'sandbox-fetch' ? 'fetch' : 'test';
  if (step.cwd !== realpathSync(p.request.repo) || JSON.stringify(step.argv) !== JSON.stringify(argv) || JSON.stringify(step.spawnArgv) !== JSON.stringify(workloadExec(p, role, argv)) || step.sandboxImageDigest !== p.containers.find(c => c.role === 'test').image.split('@')[1] || step.tool.name !== 'axstack-sandbox' || step.tool.version !== '1.0.0') hold('capture does not match effective sandbox plan');
  return { schemaVersion: 1, receiptPath: realpathSync(path), receiptSha256: sha256(bytes) };
}
export async function recordCapture(p, evidenceDir, active, checkStorage = role => checkFilesystem({ storage: p.storage, containerId: p.containers.find(c => c.role === role).id })) {
  const registryPlanBytes = new TextEncoder().encode(`${JSON.stringify(p)}\n`).length;
  if (receiptBytes(evidenceDir) + registryPlanBytes > p.policy.receiptMaxBytes / 2) hold('insufficient receipt directory budget');
  const initial = sourceIdentity(p.request);
  const binding = { ...p.request, snapshot: initial.snapshot, tool: { name: 'axstack-sandbox', version: '1.0.0' }, sandboxImageDigest: p.containers.find(c => c.role === 'test').image.split('@')[1], writableRoots: [p.sourceExport.path] };
  const commands = [], state = { active: null, signal: null };
  const started = performance.now();
  let used = 0, last;
  for (const role of ['fetch', 'test']) {
    const argv = role === 'fetch' ? p.request.fetchArgv : p.request.testArgv;
    if (!argv.length) continue;
    await checkStorage(role);
    active();
    const spawnArgv = workloadExec(p, role, argv);
    const reserveBytes = 16384 + 4 * new TextEncoder().encode(JSON.stringify({ binding, argv, spawnArgv, initial })).length;
    // W3-1 bounds log writes; reserve metadata before its host-side writer runs.
    if (receiptBytes(evidenceDir) + registryPlanBytes + reserveBytes > p.policy.receiptMaxBytes) hold('insufficient host capture receipt reserve');
    const logBytes = role === 'fetch' ? Math.floor(p.policy.captureMaxBytes / 2) : p.policy.captureMaxBytes - used;
    const remainingMs = Math.max(1, p.policy.wallTimeSeconds * 1000 - (performance.now() - started));
    last = await runCommand(commands, { evidence: evidenceDir }, `sandbox-${role}`, argv, p.request.repo,
      { PATH: '/usr/sbin:/usr/bin:/sbin:/bin', LANG: 'C', HOME: '/nonexistent', DOCKER_HOST: 'unix:///var/run/docker.sock', DOCKER_CONFIG: '/nonexistent' },
      { timeoutMs: remainingMs, logBytes }, state, spawnArgv, binding);
    used += last.logBytes;
    if (receiptBytes(evidenceDir) + registryPlanBytes > p.policy.receiptMaxBytes) hold('host capture/receipt directory cap exceeded');
    active();
    const reference = verifyCapture(last.receiptPath, p, argv);
    if (last.exitCode !== 0 || role === 'test') return reference;
  }
  hold('test capture unavailable');
}
export async function saveReceipt(receipt, evidenceDir, p) {
  const bytes = `${JSON.stringify(receipt)}\n`;
  if (receiptBytes(evidenceDir) + new TextEncoder().encode(bytes).length > p.policy.receiptMaxBytes) hold('sandbox envelope exceeds receipt directory cap');
  writeFileSync(`${evidenceDir}/${p.runId}-sandbox.json`, bytes, { flag: 'wx', mode: 0o600 });
}
