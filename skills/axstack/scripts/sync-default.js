import * as fs from 'node:fs';
import { accountUsage, expandHome } from './account-usage.js';

const drivers = { claudeAgent: 'claude', codex: 'codex' };
function parsePool(value) {
  if (!value) return null;
  const pool = {};
  for (const entry of value.split(',')) {
    const match = /^(claudeAgent|codex)=([^:,=\s]+)(?::([a-z]+))?$/.exec(entry);
    if (!match || Object.hasOwn(pool, match[1])) throw new Error('invalid pool');
    const [, driver, model, effort] = match;
    pool[driver] = { model, ...(effort && { options: [
      { id: driver === 'codex' ? 'reasoningEffort' : 'effort', value: effort },
    ] }) };
  }
  return pool;
}
const candidates = (settings, pool) => Object.entries(settings.providerInstances ?? {}).filter(([, instance]) =>
  instance.enabled && Object.hasOwn(pool, instance.driver));

export function decide(settings, usage, now, pool = null) {
  const from = settings.defaultModelSelection?.instanceId ?? null;
  const result = { action: 'unchanged', reason: 'unmanaged', from, to: from, instances: [] };
  const driver = settings.providerInstances?.[from]?.driver;
  const pooled = pool !== null;
  pool ??= { [driver]: null };
  if (!Object.hasOwn(drivers, driver) || !Object.hasOwn(pool, driver)) return result;
  const updated = (best, reason) => ({ ...result, action: 'updated', reason, to: best.instanceId,
    selection: pooled ? { instanceId: best.instanceId, ...pool[settings.providerInstances[best.instanceId].driver] }
      : { ...settings.defaultModelSelection, instanceId: best.instanceId } });
  result.instances = candidates(settings, pool).map(([instanceId, instance]) => {
    const account = usage.find((entry) => entry.instanceId === instanceId);
    const window = instance.driver === 'claudeAgent' ? account?.windows?.[1]
      : account?.windows?.[1] ?? account?.windows?.[0];
    const excluded = account?.utilization >= 95 || account?.limitReached || account?.credentialsAbsent
      || (instanceId === from && (account?.unauthorized || account?.state === 'skipped'));
    const known = account && ['fresh', 'cached'].includes(account.state)
      && Number.isFinite(account.updatedAt) && now - account.updatedAt < 300000
      && Number.isFinite(window?.used) && Number.isFinite(window?.seconds) && window.seconds > 0
      && Number.isFinite(window?.resetAt) && window.resetAt > now
      && (!pooled || window.seconds >= 604800);
    return { instanceId, state: excluded ? 'excluded' : known ? 'eligible' : 'unknown',
      pace: known ? 100 * (1 - (window.resetAt - now) / (window.seconds * 1000)) - window.used : null };
  });
  const current = result.instances.find((entry) => entry.instanceId === from);
  const best = result.instances.filter((entry) => entry.state === 'eligible').sort((a, b) => b.pace - a.pace)[0];
  const excluded = !current || current.state === 'excluded';
  if (excluded && best) return updated(best, 'current-excluded');
  if (result.instances.some((entry) => entry.state === 'unknown')) return { ...result, reason: 'unknown' };
  if (!best) return { ...result, reason: 'no-eligible' };
  if (best.instanceId !== from && best.pace - current.pace >= 10) {
    return updated(best, 'pace');
  }
  return { ...result, reason: 'margin' };
}

// Preserve the instance-only edit when the rest of the selection is already identical.
function selectionBytes(original, selection) {
  const previous = JSON.parse(original).defaultModelSelection;
  const instanceOnly = deepEqual({ ...previous, instanceId: selection.instanceId }, selection);
  let start;
  const tokens = [...original.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g)];
  let depth = 0;
  let selectionDepth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i][0];
    if (depth === 1 && token.startsWith('"') && JSON.parse(token) === 'defaultModelSelection'
      && tokens[i + 1]?.[0] === ':' && tokens[i + 2]?.[0] === '{') {
      selectionDepth = depth + 1;
      start = tokens[i + 2].index;
    }
    if (instanceOnly && selectionDepth && depth === selectionDepth && token.startsWith('"') && JSON.parse(token) === 'instanceId'
      && tokens[i + 1]?.[0] === ':') {
      const value = tokens[i + 2];
      return original.slice(0, value.index) + JSON.stringify(selection.instanceId) + original.slice(value.index + value[0].length);
    }
    if (token === '{' || token === '[') depth++;
    if (token === '}' || token === ']') {
      if (depth === selectionDepth) {
        if (!instanceOnly) return original.slice(0, start) + JSON.stringify(selection) + original.slice(tokens[i].index + 1);
        selectionDepth = 0;
      }
      depth--;
    }
  }
  throw new Error('missing instance string');
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
}

export function commit(path, originalBytes, nextBytes, selection) {
  const original = JSON.parse(originalBytes);
  const next = JSON.parse(nextBytes);
  const from = original.defaultModelSelection?.instanceId;
  const to = next.defaultModelSelection?.instanceId;
  if (typeof from !== 'string' || typeof to !== 'string') throw new Error('invalid instance string');
  selection ??= { ...original.defaultModelSelection, instanceId: to };
  if (!deepEqual(next.defaultModelSelection, selection)) throw new Error('refusing undecided selection');
  const unchanged = deepEqual(original.defaultModelSelection, selection);
  original.defaultModelSelection = selection;
  if (!deepEqual(original, next)) throw new Error('refusing change outside defaultModelSelection');
  if (unchanged) return 'unchanged';
  const lock = `${path}.axstack-default-sync.lock`;
  try { fs.mkdirSync(lock, { mode: 0o700 }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (Date.now() - fs.lstatSync(lock).mtimeMs <= 60000) return 'locked';
    fs.rmdirSync(lock);
    try { fs.mkdirSync(lock, { mode: 0o700 }); }
    catch (retryError) { if (retryError.code === 'EEXIST') return 'locked'; throw retryError; }
  }
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
  const pool = parsePool(process.env.AXSTACK_SYNC_POOL);
  const usage = [];
  if (Object.hasOwn(drivers, driver) && (!pool || Object.hasOwn(pool, driver))) {
    for (const [id, instance] of candidates(settings, pool ?? { [driver]: null })) {
      usage.push(await accountUsage(id, instance, drivers[instance.driver]));
    }
  }
  let decision = decide(settings, usage, Date.now(), pool);
  if (decision.action === 'updated' && !dryRun) {
    const reason = commit(path, original, selectionBytes(original, decision.selection), decision.selection);
    if (reason !== 'updated') decision = { ...decision, action: 'unchanged', reason, to: decision.from };
  }
  console.log(JSON.stringify(decision));
}

if (import.meta.main) main().catch((error) => {
  console.error(error.message === 'read-back mismatch' ? 'default sync failed: read-back mismatch'
    : 'default sync failed: invalid input/settings or failed write');
  process.exitCode = 1;
});
