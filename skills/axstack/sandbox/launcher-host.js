import { lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statfsSync, writeFileSync } from 'node:fs';
import { sha256 } from '../scripts/capture-identity.js';
import { fact, hold, safePath, validate } from './launcher-policy.js';

export const ownedDirectory = '/var/lib/axstack/sandbox';
const moduleDir = import.meta.dir;
const env = { PATH: '/usr/sbin:/usr/bin:/sbin:/bin', LANG: 'C', HOME: '/nonexistent', DOCKER_HOST: 'unix:///var/run/docker.sock', DOCKER_CONFIG: '/nonexistent' };
export async function execute(argv, { maxBytes = 1048576, binary = false, timeoutMs = 10000 } = {}) {
  let p;
  try { p = Bun.spawn(argv, { env, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' }); }
  catch { hold(`host prerequisite unavailable: ${argv[0]}`); }
  let timer, used = 0;
  const read = async stream => {
    const chunks = [];
    for await (const data of stream) {
      used += data.length;
      if (used > maxBytes) { p.kill('SIGKILL'); hold('host command output cap exceeded'); }
      chunks.push(data);
    }
    const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
    return bytes;
  };
  try {
    timer = setTimeout(() => p.kill('SIGKILL'), timeoutMs);
    const [stdout, stderr, exitCode] = await Promise.all([read(p.stdout), read(p.stderr), p.exited]);
    return { exitCode, stdout: binary ? stdout : new TextDecoder().decode(stdout), stderr: new TextDecoder().decode(stderr) };
  } finally { clearTimeout(timer); }
}
function jsonFile(name) { return JSON.parse(readFileSync(`${moduleDir}/${name}`, 'utf8')); }
export async function loadAssets() {
  const optional = name => { try { return jsonFile(name); } catch (e) { if (e.code !== 'ENOENT') throw e; return null; } };
  return { hostBinding: optional('launcher-host.json'), hostBudget: optional('launcher-host-budget.json'), policy: optional('launcher-policy.json'),
    proxy: optional('proxy-config.json'), sidecars: optional('sidecars.json'), workloadImage: optional('launcher-image.json')?.image ?? null,
    registryAllowlist: optional('inventory.json')?.registryAllowlist, ownedDir: ownedDirectory };
}
export function processState(owner, read = path => readFileSync(path, 'utf8')) {
  let boot;
  try { boot = read('/proc/sys/kernel/random/boot_id').trim(); } catch { return 'unknown'; }
  if (!owner?.bootId || !/^\d+$/.test(owner.startTimeTicks) || !Number.isSafeInteger(owner.pid) || owner.pid < 1) return 'unknown';
  if (boot !== owner.bootId) return 'dead';
  try {
    const text = read(`/proc/${owner.pid}/stat`);
    const rest = text.slice(text.lastIndexOf(')') + 2).trim().split(/\s+/);
    if (!text.startsWith(`${owner.pid} (`) || !/^\d+$/.test(rest[19])) return 'unknown';
    return rest[19] === owner.startTimeTicks ? 'live' : 'dead';
  } catch (e) { return e.code === 'ENOENT' || e.code === 'ESRCH' ? 'dead' : 'unknown'; }
}
export async function currentOwner(runId) {
  const text = readFileSync(`/proc/${process.pid}/stat`, 'utf8');
  const startTimeTicks = text.slice(text.lastIndexOf(')') + 2).trim().split(/\s+/)[19];
  const owner = { label: 'axstack.sandbox', runId, pid: process.pid, startTimeTicks, bootId: readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim() };
  if (processState(owner) !== 'live') hold('cannot establish launcher PID/start time');
  return owner;
}
export async function observeHost(a) {
  const hostname = readFileSync('/proc/sys/kernel/hostname', 'utf8').trim();
  const machineIdSha256 = sha256(readFileSync('/etc/machine-id', 'utf8').trim());
  const memory = /^MemAvailable:\s+(\d+) kB$/m.exec(readFileSync('/proc/meminfo', 'utf8'));
  let path = a.ownedDir;
  while (true) {
    try { lstatSync(path); break; } catch (e) { if (e.code !== 'ENOENT') throw e; path = path.slice(0, path.lastIndexOf('/')) || '/'; }
  }
  const fs = statfsSync(path);
  const r = await execute(['ip', '-j', 'address', 'show']);
  let addresses = [];
  try { if (r.exitCode === 0 && typeof r.stdout === 'string') addresses = JSON.parse(r.stdout).flatMap(n => n.addr_info.map(x => x.local)); } catch { /* Unknown facts hold. */ }
  return { hostname, machineIdSha256, freeMemoryBytes: memory ? Number(memory[1]) * 1024 : NaN, freeDiskBytes: Number(fs.bavail) * Number(fs.bsize), addresses,
    terms: [fact('host-addresses', addresses.length ? 'pass' : 'unknown', 'ip -j address show'), fact('host-memory', memory ? 'pass' : 'unknown', '/proc/meminfo MemAvailable'),
      fact('host-process-visibility', readFileSync('/proc/1/comm', 'utf8').trim() === 'systemd' ? 'pass' : 'unknown', 'approved host requires visible systemd PID 1; hidden host processes hold reaping')] };
}
function privateDirectory(path, create = false) {
  safePath(path);
  if (create) mkdirSync(path, { mode: 0o700, recursive: true });
  const s = lstatSync(path);
  if (!s.isDirectory() || s.isSymbolicLink() || s.uid !== process.getuid() || (s.mode & 0o777) !== 0o700 || realpathSync(path) !== path) hold(`require owned 0700 real directory: ${path}`);
}
export async function withAdmission(fn, directory = ownedDirectory) {
  privateDirectory(directory, true);
  // The kernel drops flock when this helper exits, even after launcher SIGKILL.
  const p = Bun.spawn(['flock', '--exclusive', '--nonblock', `${directory}/admission.lock`, process.execPath, '-e', 'process.stdout.write("locked\\n"); await Bun.stdin.text();'], { env, stdin: 'pipe', stdout: 'pipe', stderr: 'ignore' });
  const reader = p.stdout.getReader();
  let timer;
  try {
    const first = await Promise.race([reader.read(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('admission lock timeout')), 5000); })]);
    if (first.done || new TextDecoder().decode(first.value) !== 'locked\n') hold('host admission busy; retry in a later run');
    return await fn();
  } finally {
    // Wait for flock AND its child to release the inherited lock fd. Killing only
    // flock can return while its still-exiting child briefly retains admission.
    clearTimeout(timer); reader.releaseLock(); p.stdin.end(); await p.exited;
  }
}
export async function records(a) {
  const runs = [];
  for (const entry of readdirSync(a.ownedDir, { withFileTypes: true })) {
    if (entry.name === 'admission.lock') continue;
    if (entry.isFile() && entry.name.endsWith('.img')) continue; // Checked against records below.
    if (!entry.isDirectory() || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(entry.name)) hold(`unknown owned state: ${entry.name}; driver must resolve`);
    try {
      privateDirectory(`${a.ownedDir}/${entry.name}`);
      const p = JSON.parse(readFileSync(`${a.ownedDir}/${entry.name}/plan.json`, 'utf8'));
      validate('plan', p);
      const image = safePath(p.storage.imageFile);
      if (p.runId !== entry.name || p.sourceExport.path !== `${a.ownedDir}/${p.runId}/source` || !image.startsWith(`${a.ownedDir}/`) || image.slice(a.ownedDir.length + 1).includes('/')) hold('record paths do not match owned run');
      runs.push(p);
    } catch (e) { hold(`unreadable run record ${entry.name}: ${e.message}; owning driver must resolve`); }
  }
  for (const file of readdirSync(a.ownedDir).filter(n => n.endsWith('.img'))) if (!runs.some(p => p.storage.imageFile === `${a.ownedDir}/${file}`)) hold(`orphan image file ${file}; owning driver must resolve`);
  const r = await execute(['docker', 'ps', '-a', '--filter', 'label=axstack.sandbox=true', '--format', '{{.Names}}']);
  if (r.exitCode !== 0 || typeof r.stdout !== 'string') hold('cannot enumerate labelled containers');
  for (const name of r.stdout.trim().split('\n').filter(Boolean)) if (!runs.some(p => p.containers.some(c => c.id === name))) hold(`labelled container lacks liveness record: ${name}`);
  return runs;
}
export async function savePlan(p, evidenceDir, directory = ownedDirectory) {
  privateDirectory(evidenceDir);
  const sourceRoot = realpathSync(p.request.repo);
  if (evidenceDir === sourceRoot || evidenceDir.startsWith(`${sourceRoot}/`) || evidenceDir === directory || evidenceDir.startsWith(`${directory}/`)) hold('evidence must be outside source and owned writable roots');
  const dir = `${directory}/${p.runId}`;
  let existing = false;
  try { lstatSync(dir); existing = true; } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (!existing && readdirSync(evidenceDir).length) hold('a new run requires an empty evidence directory');
  if (lstatSync(evidenceDir).dev !== lstatSync(directory).dev) hold('evidence and owned storage must use the budgeted filesystem');
  privateDirectory(dir, true);
  const bytes = `${JSON.stringify(p, null, 2)}\n`;
  if (new TextEncoder().encode(bytes).length * 2 > p.policy.receiptMaxBytes) hold('effective plan exceeds host receipt directory cap');
  writeFileSync(`${dir}/plan.json`, bytes, { mode: 0o600 });
  writeFileSync(`${evidenceDir}/${p.runId}-plan.json`, bytes, { mode: 0o600 });
  return bytes;
}
export async function removeRecord(p) {
  const dir = `${ownedDirectory}/${p.runId}`;
  if (p.sourceExport.path !== `${dir}/source`) hold('unexpected source cleanup path');
  privateDirectory(dir);
  rmSync(dir, { recursive: true, force: true });
}
export function setDeadline(wallMs, graceMs, cancel) {
  const timer = setTimeout(() => cancel('wall-time'), wallMs);
  const hard = setTimeout(() => cancel('wall-time-plus-grace'), wallMs + graceMs);
  return () => { clearTimeout(timer); clearTimeout(hard); };
}
export function onSignal(cancel) {
  const listeners = new Map();
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) { const fn = () => cancel(signal); process.on(signal, fn); listeners.set(signal, fn); }
  return () => { for (const [signal, fn] of listeners) process.off(signal, fn); };
}
