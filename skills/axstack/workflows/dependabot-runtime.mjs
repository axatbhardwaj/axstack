import { execFile } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { bindingMatches } from './binding.mjs';

export function run(program, args, { cwd, input } = {}) {
  return new Promise((resolve) => {
    // T3 runs workflow definitions in a Node context. Keep its event loop
    // responsive for CLI readbacks against the same server.
    const child = execFile(program, args, { cwd, timeout: 30_000, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout) => resolve(error ? null : stdout));
    child.stdin?.on('error', () => {});
    child.stdin?.end(input);
  });
}

export const json = (bytes) => {
  try {
    return JSON.parse(bytes);
  } catch {
    return null;
  }
};

export async function github(endpoint) {
  const output = await run('gh', ['api', '--hostname', 'github.com', '--method', 'GET', '--include', endpoint]);
  const divider = output?.match(/\r?\n\r?\n/);
  if (!divider) return null;
  const [line, ...headers] = output.slice(0, divider.index).split(/\r?\n/);
  const status = /^HTTP\/\d(?:\.\d)? (\d{3})(?: |$)/.exec(line)?.[1];
  const links = headers.filter((header) => /^link:/i.test(header)).map((header) => header.slice(5).trim());
  return { status: Number(status), link: links.join(', '), body: json(output.slice(divider.index + divider[0].length)) };
}

async function privateBytes(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.uid !== process.getuid() || (info.mode & 0o077) || path !== await realpath(path)) {
    throw new Error('workflow binding member is not a canonical private file');
  }
  return readFile(path);
}

export async function verifiedBinding(base, identity) {
  try {
    const record = json(await privateBytes(base + '/.axstack-workflows.json'))?.workflows?.[identity];
    const bytes = await privateBytes(record.binding);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const digest = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const binding = json(bytes);
    if (bindingMatches(record.bindingDigest, digest) && binding &&
        ['project', 'worktreeRoot', 'roles', 'registryTokenFile', 'bun', 't3'].every((key) =>
          typeof binding[key] === 'string' && binding[key].startsWith('/')) &&
        (binding.reportOnlyTrial === undefined || typeof binding.reportOnlyTrial === 'boolean')) return binding;
  } catch {
    // Keep host paths and the contents of private files out of run reports.
  }
  return null;
}

const yamlReader = `try {
  console.log(JSON.stringify(Bun.YAML.parse(await Bun.stdin.text())));
} catch { process.exit(1) }`;
export const parseYaml = async (bun, input) =>
  json(await run(bun, ['--no-env-file', '-e', yamlReader], { input }));

const configReader = `
const origin = Bun.argv[1];
const token = (await Bun.stdin.text()).trim();
const url = new URL('/ws?orchestrationProtocol=2', origin);
if (!token || !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname) ||
    !['http:', 'https:'].includes(url.protocol) || url.username || url.password) process.exit(1);
url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(url, { headers: { Authorization: 'Bearer ' + token } });
const timer = setTimeout(() => process.exit(1), 8000);
socket.addEventListener('open', () => socket.send(JSON.stringify({
  _tag: 'Request', id: '1', tag: 'server.getConfig', payload: {}, headers: [],
})));
socket.addEventListener('error', () => process.exit(1));
socket.addEventListener('message', ({ data }) => {
  const frame = JSON.parse(data);
  if (frame._tag !== 'Exit' || frame.requestId !== '1') return;
  clearTimeout(timer);
  socket.close();
  if (frame.exit?._tag !== 'Success') process.exit(1);
  console.log(JSON.stringify(frame.exit.value.providers));
});`;

function roleSelection(snapshot, catalog) {
  const roles = snapshot?.version === 1 && snapshot.roles?.filter((role) => role.id === 'axstack-owner');
  if (!roles || roles.length !== 1 || !Array.isArray(catalog)) return null;
  const [role] = roles;
  const codex = role.provider === 'codex' && role.modeId === 'full-access';
  const claude = role.provider === 'claude' && role.modeId === 'bypassPermissions';
  if (!codex && !claude) return null;
  const instanceId = codex ? 'codex' : 'claudeAgent';
  const instances = catalog.filter((entry) => entry.instanceId === instanceId && entry.driver === instanceId);
  const [instance] = instances;
  if (instances.length !== 1 || !instance.enabled || !instance.installed ||
      ['error', 'disabled'].includes(instance.status) || instance.availability === 'unavailable' ||
      instance.supportsTextGeneration === false ||
      (instance.supportedRuntimeModes && !instance.supportedRuntimeModes.includes('full-access'))) return null;
  const safeClass = typeof role.modelClass === 'string' && /^[a-z]+$/.test(role.modelClass);
  const family = !safeClass ? null : codex
    ? new RegExp(`^gpt-([0-9]+(?:\\.[0-9]+)*)-${role.modelClass}$`)
    : new RegExp(`^claude-${role.modelClass}-([0-9]+-[0-9]+)$`);
  const models = instance.models.filter((model) => model.supportsTextGeneration !== false &&
    (role.model ? model.slug === role.model : family?.test(model.slug)));
  const [model] = models.sort((a, b) => b.slug.localeCompare(a.slug, 'en', { numeric: true }));
  const id = codex ? 'reasoningEffort' : 'effort';
  const descriptor = model?.capabilities?.optionDescriptors?.find((item) => item.id === id);
  if (!descriptor?.options?.some((option) => option.id === role.thinkingOptionId)) return null;
  return { model: { instanceId, model: model.slug, options: [{ id, value: role.thinkingOptionId }] },
    runtimeMode: 'full-access' };
}

export async function ownerBinding(base, binding) {
  try {
    const [roles, token, state] = await Promise.all([
      readFile(binding.roles, 'utf8'), privateBytes(binding.registryTokenFile),
      readFile(base + '/userdata/server-runtime.json', 'utf8'),
    ]);
    const { origin, pid, startedAt } = json(state);
    const catalog = json(await run(binding.bun, ['--no-env-file', '-e', configReader, origin], { input: token }));
    const after = json(await readFile(base + '/userdata/server-runtime.json', 'utf8'));
    if (after?.pid !== pid || after?.startedAt !== startedAt || after?.origin !== origin) return null;
    return roleSelection(json(roles), catalog);
  } catch {
    return null;
  }
}

const selectionReader = `
import { Database } from 'bun:sqlite';
const db = new Database(Bun.argv[1], { readonly: true });
try {
  const row = db.query('SELECT payload_json FROM orchestration_v2_projection_threads WHERE thread_id = ?').get(Bun.argv[2]);
  console.log(JSON.stringify(JSON.parse(row.payload_json).modelSelection));
} finally { db.close() }`;

const identifier = /^[A-Za-z0-9_-]+$/;
export const validId = (value) => typeof value === 'string' && identifier.test(value);
export async function driverReadback(base, binding, expected, worktree, threadId, { exclusive = false } = {}) {
  if (typeof threadId !== 'string' || !/^[A-Za-z0-9:_-]{1,160}$/.test(threadId)) return null;
  const [view, selection] = await Promise.all([
    run(binding.t3, ['thread', 'show', '--base-dir', base, threadId, '--messages', '12', '--json']),
    run(binding.bun, ['--no-env-file', '-e', selectionReader, base + '/userdata/statev2.sqlite', threadId]),
  ]);
  const observed = json(view);
  const thread = observed?.thread;
  const model = json(selection);
  const desired = expected.model;
  if (thread?.threadId !== threadId || thread.status !== 'completed' || thread.archived !== false ||
      thread.pinned !== false || thread.createdBy !== 'system' || thread.creationSource !== 'server' ||
      thread.worktreePath !== worktree ||
      thread.providerInstanceId !== desired.instanceId || thread.model !== desired.model ||
      thread.runtimeMode !== expected.runtimeMode || model?.instanceId !== desired.instanceId ||
      model.model !== desired.model || !Array.isArray(model.options) ||
      model.options.length !== desired.options.length ||
      !desired.options.every((option) => model.options.some((item) =>
        item.id === option.id && item.value === option.value))) return null;
  if (exclusive) {
    const threads = json(await run(binding.t3, ['thread', 'list', '--base-dir', base, '--project', binding.project, '--json']));
    if (!Array.isArray(threads)) return null;
    const attached = threads.filter((item) => item?.worktreePath === worktree);
    if (attached.length !== 1 || attached[0].threadId !== threadId) return null;
  }
  return observed;
}
