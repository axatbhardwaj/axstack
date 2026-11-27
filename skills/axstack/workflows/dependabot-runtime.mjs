import { execFile } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import rpcReader from '../scripts/t3-workflow-read.js' with { type: 'text' };
import { bindingMatches } from './binding.mjs';

const baseEnvironment = ['PATH', 'HOME', 'TMPDIR'];
const forgeEnvironment = ['XDG_CONFIG_HOME', 'GH_CONFIG_DIR', 'GH_TOKEN', 'GITHUB_TOKEN'];

export function run(program, args, { cwd, input, forge = false } = {}) {
  const names = forge ? [...baseEnvironment, ...forgeEnvironment] : baseEnvironment;
  const env = Object.fromEntries(names.filter((key) => process.env[key] !== undefined)
    .map((key) => [key, process.env[key]]));
  return new Promise((resolve) => {
    // T3 runs workflow definitions in a Node context. Keep its event loop
    // responsive for CLI readbacks against the same server.
    const child = execFile(program, args, { cwd, env, timeout: 30_000, maxBuffer: 8 * 1024 * 1024, killSignal: 'SIGKILL' },
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
  const output = await run('gh', ['api', '--hostname', 'github.com', '--method', 'GET', '--include', endpoint], { forge: true });
  const divider = output?.match(/\r?\n\r?\n/);
  if (!divider) return null;
  const [line, ...headers] = output.slice(0, divider.index).split(/\r?\n/);
  const httpStatus = /^HTTP\/\d(?:\.\d)? (\d{3})(?: |$)/.exec(line)?.[1];
  const links = headers.filter((header) => /^link:/i.test(header)).map((header) => header.slice(5).trim());
  return { status: Number(httpStatus), link: links.join(', '), body: json(output.slice(divider.index + divider[0].length)) };
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
          typeof binding[key] === 'string' && binding[key].startsWith('/'))) return binding;
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

// Reuse the packaged read-only RPC bridge in Bun. The T3 loader itself has no Bun global.
const rpcScript = rpcReader + `
const [origin, tokenPath, method, threadId] = Bun.argv.slice(1);
console.log(JSON.stringify(await readWorkflowRpc(origin, tokenPath, method, threadId ? { threadId } : {})));
`;

export async function runtimeRpc(binding, origin, method, threadId) {
  if (typeof origin !== 'string') return null;
  return json(await run(binding.bun, ['--no-env-file', '-e', rpcScript, origin,
    binding.registryTokenFile, method, ...(threadId ? [threadId] : [])]));
}

function roleSelection(snapshot, catalog) {
  const roles = snapshot?.version === 1 && snapshot.roles?.filter((candidateRole) => candidateRole.id === 'axstack-owner');
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
  const models = instance.models.filter((candidateModel) => candidateModel.supportsTextGeneration !== false &&
    (role.model ? candidateModel.slug === role.model : family?.test(candidateModel.slug)));
  const [model] = models.sort((a, b) => b.slug.localeCompare(a.slug, 'en', { numeric: true }));
  const id = codex ? 'reasoningEffort' : 'effort';
  const descriptor = model?.capabilities?.optionDescriptors?.find((item) => item.id === id);
  if (!descriptor?.options?.some((option) => option.id === role.thinkingOptionId)) return null;
  return { model: { instanceId, model: model.slug, options: [{ id, value: role.thinkingOptionId }] },
    runtimeMode: 'full-access' };
}

export async function ownerBinding(base, binding) {
  try {
    const [roles, state] = await Promise.all([
      readFile(binding.roles, 'utf8'),
      readFile(base + '/userdata/server-runtime.json', 'utf8'),
    ]);
    const { origin, pid, startedAt } = json(state);
    const apiConfig = await runtimeRpc(binding, origin, 'server.getConfig');
    const after = json(await readFile(base + '/userdata/server-runtime.json', 'utf8'));
    if (after?.pid !== pid || after?.startedAt !== startedAt || after?.origin !== origin) return null;
    return roleSelection(json(roles), apiConfig?.providers);
  } catch {
    return null;
  }
}

const identifier = /^[A-Za-z0-9_-]+$/;
export const validId = (value) => typeof value === 'string' && identifier.test(value);
export async function driverReadback(base, binding, expected, worktree, threadId, { exclusive = false } = {}) {
  if (typeof threadId !== 'string' || !/^[A-Za-z0-9:_-]{1,160}$/.test(threadId)) return null;
  const loadRuntime = async () => json(await readFile(base + '/userdata/server-runtime.json', 'utf8').catch(() => null));
  const state = await loadRuntime();
  if (!state?.origin || !state.pid || !state.startedAt) return null;
  const [view, projection] = await Promise.all([
    run(binding.t3, ['thread', 'show', '--base-dir', base, threadId, '--messages', '12', '--json']),
    runtimeRpc(binding, state.origin, 'orchestration.getThreadProjection', threadId),
  ]);
  const observed = json(view);
  const thread = observed?.thread;
  const observedRuntime = await loadRuntime();
  if (observedRuntime?.pid !== state.pid || observedRuntime.startedAt !== state.startedAt ||
      observedRuntime.origin !== state.origin || projection?.thread?.id !== threadId ||
      projection.thread.runtimeMode !== expected.runtimeMode) return null;
  const model = projection.thread.modelSelection;
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
