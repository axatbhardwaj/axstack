import { lstat, readFile, realpath } from 'node:fs/promises';
import { hostname } from 'node:os';
import rpcReader from '../scripts/t3-workflow-read.js' with { type: 'text' };
import { bindingMatches } from './binding.mjs';
import { json, run } from './dependabot-runtime.mjs';
import { IDENTITY, NAME, ownerReceipt, ownerState, VERSION } from './watch-backstops.mjs';

const hosts = ['io', 'iobox', 'iosatellite', 'axat-vps'];
const safePath = (path) => typeof path === 'string' && /^\/(?:[A-Za-z0-9._:-]+\/)*[A-Za-z0-9._:-]+$/.test(path) &&
  !path.split('/').some((segment) => segment === '.' || segment === '..');

async function privateFile(path) {
  if (!safePath(path)) throw new Error();
  const info = await lstat(path);
  if (!info.isFile() || info.uid !== process.getuid() || (info.mode & 0o077) ||
      info.size > 32_768 || await realpath(path) !== path) throw new Error();
  return readFile(path);
}

export async function control(base, ownerId) {
  let config;
  try {
    const record = json(await privateFile(base + '/.axstack-workflows.json'))?.workflows?.[IDENTITY];
    const bytes = await privateFile(record?.binding);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    if (!bindingMatches(record.bindingDigest, Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join(''))) {
      throw new Error();
    }
    config = json(bytes);
    if (!['bun', 't3', 'registryTokenFile', 'ownersDirectory'].every((key) => safePath(config?.[key]))) throw new Error();
  } catch {
    return { hold: 'private binding is missing, invalid, or changed' };
  }
  if (!hosts.includes(config.host) || config.host !== hostname().split('.')[0]) {
    return { hold: 'backstop is unavailable on this local host' };
  }
  const raw = await privateFile(config.ownersDirectory + '/' + ownerId + '.json').catch(() => null);
  const receipt = ownerReceipt(json(raw), ownerId, Date.now());
  return receipt ? { config, receipt } : { hold: 'private owner receipt is missing or invalid' };
}

const projectionScript = rpcReader + `
const [origin, file, threadId] = Bun.argv.slice(1);
console.log(JSON.stringify(await readWorkflowRpc(origin, file, 'orchestration.getThreadProjection', { threadId })));
`;

function command(base, config, words, args) {
  return run(config.t3, [...words, '--base-dir', base, ...args, '--json'], { cwd: '/' }).then(json);
}

function runtime(base) {
  return readFile(base + '/userdata/server-runtime.json', 'utf8').catch(() => null).then(json);
}

export async function observeOwner(base, config, ownerId, binding, ending) {
  const before = await runtime(base);
  let projection = null;
  const view = await command(base, config, ['thread', 'show'], [ownerId, '--messages', '1']);
  if (typeof before?.origin === 'string' && Number.isInteger(before.pid) && typeof before.startedAt === 'string') {
    projection = json(await run(config.bun, ['--no-env-file', '-e', projectionScript, before.origin,
      config.registryTokenFile, ownerId], { cwd: '/' }));
    const after = await runtime(base);
    if (after?.origin !== before.origin || after.pid !== before.pid || after.startedAt !== before.startedAt) projection = null;
  }
  return { ...ownerState(ownerId, binding, view, projection, ending), messages: projection?.messages };
}

export async function priorState(base, config, runId) {
  const { run: observed } = await command(base, config, ['workflow', 'show'], [runId]) ?? {};
  if (observed?.runId !== runId || observed.workflow !== NAME || observed.version !== VERSION) return null;
  return observed.status;
}
