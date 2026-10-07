import * as fs from 'node:fs';
import { accountUsage, expandHome } from './account-usage.js';

const drivers = { claudeAgent: 'claude', codex: 'codex' };
const candidates = (settings) => Object.entries(settings.providerInstances).filter(([, instance]) =>
  instance.enabled && instance.driver === settings.providerInstances[settings.defaultModelSelection.instanceId]?.driver);

export function decide(settings, usage, now) {
  const from = settings.defaultModelSelection?.instanceId ?? null;
  const result = { action: 'unchanged', reason: 'unmanaged', from, to: from, instances: [] };
  const driver = settings.providerInstances?.[from]?.driver;
  if (!Object.hasOwn(drivers, driver)) return result;
  result.instances = candidates(settings).map(([instanceId]) => {
    const account = usage.find((entry) => entry.instanceId === instanceId);
    const window = driver === 'claudeAgent' ? account?.windows?.[1]
      : account?.windows?.[1] ?? account?.windows?.[0];
    const excluded = account?.utilization >= 95 || account?.limitReached
      || (instanceId === from && (account?.unauthorized || account?.state === 'skipped'));
    const known = account && ['fresh', 'cached'].includes(account.state)
      && Number.isFinite(account.updatedAt) && now - account.updatedAt < 300000
      && Number.isFinite(window?.used) && Number.isFinite(window?.seconds) && window.seconds > 0
      && Number.isFinite(window?.resetAt) && window.resetAt > now;
    return { instanceId, state: excluded ? 'excluded' : known ? 'eligible' : 'unknown',
      pace: known ? 100 * (1 - (window.resetAt - now) / (window.seconds * 1000)) - window.used : null };
  });
  const current = result.instances.find((entry) => entry.instanceId === from);
  const best = result.instances.filter((entry) => entry.state === 'eligible').sort((a, b) => b.pace - a.pace)[0];
  const excluded = !current || current.state === 'excluded';
  if (excluded && best) return { ...result, action: 'updated', reason: 'current-excluded', to: best.instanceId };
  if (result.instances.some((entry) => entry.state === 'unknown')) return { ...result, reason: 'unknown' };
  if (!best) return { ...result, reason: 'no-eligible' };
  if (best.instanceId !== from && best.pace - current.pace >= 10) {
    return { ...result, action: 'updated', reason: 'pace', to: best.instanceId };
  }
  return { ...result, reason: 'margin' };
}

// Locate only the root selection's instance string, leaving every other byte intact.
function selectionBytes(original, instanceId) {
  const tokens = [...original.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g)];
  let depth = 0;
  let selectionDepth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i][0];
    if (depth === 1 && token.startsWith('"') && JSON.parse(token) === 'defaultModelSelection'
      && tokens[i + 1]?.[0] === ':' && tokens[i + 2]?.[0] === '{') selectionDepth = depth + 1;
    if (selectionDepth && depth === selectionDepth && token.startsWith('"') && JSON.parse(token) === 'instanceId'
      && tokens[i + 1]?.[0] === ':') {
      const value = tokens[i + 2];
      return original.slice(0, value.index) + JSON.stringify(instanceId) + original.slice(value.index + value[0].length);
    }
    if (token === '{' || token === '[') depth++;
    if (token === '}' || token === ']') { if (depth === selectionDepth) selectionDepth = 0; depth--; }
  }
  throw new Error('missing instance string');
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
}

export function commit(path, originalBytes, nextBytes) {
  const original = JSON.parse(originalBytes);
  const next = JSON.parse(nextBytes);
  const from = original.defaultModelSelection?.instanceId;
  const to = next.defaultModelSelection?.instanceId;
  if (typeof from !== 'string' || typeof to !== 'string') throw new Error('invalid instance string');
  original.defaultModelSelection.instanceId = to;
  if (!deepEqual(original, next)) throw new Error('refusing non-instanceId change');
  if (from === to) return 'unchanged';
  const lock = `${path}.axstack-default-sync.lock`;
  try { fs.mkdirSync(lock, { mode: 0o700 }); }
  catch (error) { if (error.code === 'EEXIST') return 'locked'; throw error; }
  let temp;
  let fd;
  try {
    const info = fs.lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('settings must be a regular file');
    const sibling = `${path}.axstack-default-sync-${crypto.randomUUID()}.tmp`;
    fd = fs.openSync(sibling, 'wx', info.mode & 0o7777);
    temp = sibling;
    fs.fchmodSync(fd, info.mode & 0o7777);
    fs.writeFileSync(fd, nextBytes);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    // This is the final operation before rename; the remaining sub-ms race is accepted.
    if (!fs.readFileSync(path).equals(Buffer.from(originalBytes))) return 'concurrent-edit';
    fs.renameSync(temp, path);
    temp = undefined;
    if (!fs.readFileSync(path).equals(Buffer.from(nextBytes))) throw new Error('read-back mismatch');
    return 'updated';
  } finally {
    try { if (fd !== undefined) fs.closeSync(fd); }
    finally {
      try { if (temp) fs.unlinkSync(temp); }
      finally { fs.rmdirSync(lock); }
    }
  }
}

async function main() {
  if (process.env.AXSTACK_SYNC_DEFAULT === '0') {
    console.log(JSON.stringify({ action: 'unchanged', reason: 'disabled', from: null, to: null, instances: [] }));
    return;
  }
  let path = `${process.env.HOME}/.t3/userdata/settings.json`;
  let dryRun = false;
  const args = process.argv.slice(2);
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    if (seen.has(args[i])) throw new Error('duplicate flag');
    seen.add(args[i]);
    if (args[i] === '--dry-run') dryRun = true;
    else if (args[i] === '--settings' && args[i + 1] && !args[i + 1].startsWith('--')) path = args[++i];
    else throw new Error('expected [--settings path] [--dry-run]');
  }
  path = expandHome(path);
  const original = fs.readFileSync(path, 'utf8');
  const settings = JSON.parse(original);
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)
    || (Object.hasOwn(settings, 'providerInstances') && (!settings.providerInstances
      || typeof settings.providerInstances !== 'object' || Array.isArray(settings.providerInstances)))) throw new Error('invalid settings');
  const driver = settings.providerInstances?.[settings.defaultModelSelection?.instanceId]?.driver;
  const provider = Object.hasOwn(drivers, driver) ? drivers[driver] : null;
  const usage = [];
  if (provider) for (const [id, instance] of candidates(settings)) usage.push(await accountUsage(id, instance, provider));
  let decision = decide(settings, usage, Date.now());
  if (decision.action === 'updated' && !dryRun) {
    const reason = commit(path, original, selectionBytes(original, decision.to));
    if (reason !== 'updated') decision = { ...decision, action: 'unchanged', reason, to: decision.from };
  }
  console.log(JSON.stringify(decision));
}

if (import.meta.main) main().catch((error) => {
  console.error(error.message === 'read-back mismatch' ? 'default sync failed: read-back mismatch'
    : 'default sync failed: invalid input/settings or failed write');
  process.exitCode = 1;
});
