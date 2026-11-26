import { resolveModel } from './resolve-models.js';
import { readWorkflowRpc } from './t3-workflow-read.js';

const ROLE = 'axstack-auditor-sol';
const ID = /^[A-Za-z0-9:_-]{1,160}$/;

export function reportBinding(roles, providers) {
  const matches = roles?.version === 1 && Array.isArray(roles.roles) ? roles.roles.filter((role) => role?.id === ROLE) : [];
  const role = matches[0];
  if (matches.length !== 1 || role.provider !== 'codex' || role.modeId !== 'full-access') return null;
  if (!Array.isArray(providers)) return null;
  const seats = providers.filter((seat) => seat?.instanceId === role.provider);
  const seat = seats[0];
  if (seats.length !== 1 || seat.driver !== 'codex' || seat.enabled !== true || seat.installed !== true ||
      seat.status === 'error' || !Array.isArray(seat.models)) return null;
  const models = seat.models.map((model) => ({ id: model.slug, options: model.capabilities?.optionDescriptors }));
  try {
    const resolved = resolveModel({ providers: [{ providerInstanceId: seat.instanceId, driverKind: seat.driver, models }] }, {
      provider: role.provider, model: role.model, class: role.modelClass, effort: role.thinkingOptionId, excluded: [],
    });
    return {
      model: { instanceId: resolved.providerInstanceId, model: resolved.model, options: [resolved.effortOption] },
      runtimeMode: role.modeId,
    };
  } catch {
    return null;
  }
}

async function readBinding(runtimeFile, registryTokenFile, rolesFile, threadId = undefined) {
  const { origin } = await Bun.file(runtimeFile).json();
  if (threadId) {
    if (!ID.test(threadId)) return null;
    const projection = await readWorkflowRpc(origin, registryTokenFile, 'orchestration.getThreadProjection', { threadId });
    const thread = projection?.thread;
    if (thread?.id !== threadId) return null;
    return { model: thread.modelSelection, runtimeMode: thread.runtimeMode };
  }
  const [roles, config] = await Promise.all([
    Bun.file(rolesFile).json(), readWorkflowRpc(origin, registryTokenFile, 'server.getConfig', {}),
  ]);
  return reportBinding(roles, config?.providers);
}

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log(`Usage: bun --no-env-file pr-triage-binding.js RUNTIME_JSON REGISTRY_TOKEN_FILE ROLES_JSON [THREAD_ID]
Read local T3 runtime metadata, a private read-scoped token, and installed roles.
With THREAD_ID, read the effective thread binding instead of resolving the report seat.
Queries loopback T3 and writes only the binding observation to stdout.
Exit 0 for an observed binding, 2 for incomplete evidence, 1 for invalid arguments.`);
  } else if (![3, 4].includes(args.length) || !args.slice(0, 3).every((path) => path.startsWith('/'))) {
    console.error('Expected three absolute file paths and an optional thread ID. See --help.');
    process.exitCode = 1;
  } else {
    const binding = await readBinding(args[0], args[1], args[2], args[3]).catch(() => null);
    console.log(JSON.stringify(binding ? { status: 'pass', binding } : { status: 'unknown' }));
    if (!binding) process.exitCode = 2;
  }
}
