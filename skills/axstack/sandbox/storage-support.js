import * as fs from 'node:fs/promises';
import { LOOP_LIST, storageNames, storageLabels, validateOwner } from './storage-plan.js';
export { fs };

export function hold(message) { return Object.assign(Error(message), { sandboxHold: true }); }
export function term(id, ...evidence) { return { id, status: 'pass', evidence: evidence.map(String) }; }
export async function runCommand(argv) {
  const child = Bun.spawn(argv, { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
    env: { PATH: '/usr/sbin:/usr/bin:/sbin:/bin', LC_ALL: 'C' } });
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { stdout, stderr, exitCode };
}
export function commands(run) {
  const raw = async argv => {
    try { return await run(argv); } catch (error) { throw hold(`Storage command unavailable: ${argv[0]}: ${error.message}`); }
  };
  const checked = async argv => {
    const result = await raw(argv);
    if (result.exitCode !== 0) throw hold(`Storage command failed: ${JSON.stringify(argv)}: ${result.stderr}`);
    return result.stdout.trim();
  };
  return { raw, checked };
}
export async function statOrNull(path) {
  try { return await fs.lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
export function planContext(owner, plan) {
  validateOwner(owner);
  const dir = plan.imageFile.slice(0, plan.imageFile.lastIndexOf('/'));
  const names = storageNames(owner.runId, dir);
  if (plan.imageFile !== names.imageFile || plan.volumeName !== names.volumeName || plan.filesystem !== 'ext4' ||
      plan.autoclear !== false || plan.keepFreeLoops !== 1 || JSON.stringify(plan.mountOptions) !== '["nosuid","nodev"]') throw Error('Storage plan identity mismatch');
  return { dir, record: `${plan.imageFile}.owner.json`, lock: `${dir}/.axstack-storage.lock` };
}
export async function privateDirectory(dir) {
  const stat = await fs.lstat(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077) || await fs.realpath(dir) !== dir) {
    throw hold(`Storage directory must be canonical, private and owned: ${dir}`);
  }
}
export async function readRecord(path, owner, plan) {
  const stat = await statOrNull(path);
  if (!stat) return null;
  if (!stat.isFile() || stat.uid !== process.getuid() || stat.nlink !== 1 || stat.mode & 0o077) throw hold('Unsafe storage owner record');
  let record;
  try { record = JSON.parse(await fs.readFile(path, 'utf8')); } catch { throw hold('Unreadable storage owner record'); }
  if (JSON.stringify(record.owner) !== JSON.stringify(owner) || record.imageFile !== plan.imageFile ||
      record.volumeName !== plan.volumeName || record.bytes !== plan.bytes || record.inodes !== plan.inodes) throw hold('Storage owner record does not match');
  return record;
}
export async function writeRecord(path, record, exclusive = false) {
  const file = await fs.open(path, exclusive ? 'wx' : 'r+', 0o600);
  try { await file.truncate(0); await file.writeFile(JSON.stringify(record)); await file.sync(); } finally { await file.close(); }
}
export async function loops(checked) {
  let data;
  try { data = JSON.parse(await checked(LOOP_LIST)); } catch (error) { throw hold(`Loop readback unknown: ${error.message}`); }
  if (!Array.isArray(data.loopdevices) || data.loopdevices.some(loop => !/^\/dev\/loop\d+$/.test(loop.name) ||
      typeof loop['back-file'] !== 'string' || ![true, false, 0, 1].includes(loop.autoclear))) throw hold('Incomplete loop-device enumeration');
  return data.loopdevices;
}
export function ownLoops(list, plan) {
  // No prefix matching: snap and every other backing file are untouched.
  if (list.some(loop => loop['back-file'] === `${plan.imageFile} (deleted)`)) throw hold('Owned backing file was deleted while attached');
  return list.filter(loop => loop['back-file'] === plan.imageFile);
}
export async function inspectVolume(raw, plan) {
  const result = await raw(['docker', 'volume', 'inspect', plan.volumeName]);
  if (result.exitCode !== 0) {
    // Do not mistake daemon/API/permission failures for absence.
    if (result.stderr.toLowerCase().includes(`get ${plan.volumeName}: no such volume`)) return null;
    throw hold(`Volume inspection unknown: ${result.stderr}`);
  }
  try {
    const list = JSON.parse(result.stdout);
    if (list.length !== 1 || list[0].Name !== plan.volumeName) throw Error('unexpected volume');
    return list[0];
  } catch { throw hold('Invalid volume readback'); }
}
export function validateVolume(volume, owner, device = null) {
  if (volume.Driver !== 'local' || Object.entries(storageLabels(owner)).some(([key, value]) => volume.Labels?.[key] !== value) ||
      volume.Options?.type !== 'ext4' || volume.Options?.o !== 'nosuid,nodev' ||
      !/^\/dev\/loop\d+$/.test(volume.Options?.device ?? '') || (device && volume.Options.device !== device)) throw hold('Volume ownership/options mismatch');
}
export async function unlinkOwned(path) {
  try { await fs.unlink(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

export function unrelatedLoops(list, plan) {
  return JSON.stringify(list.filter(loop => loop['back-file'] !== plan.imageFile).sort((a, b) => a.name.localeCompare(b.name)));
}
