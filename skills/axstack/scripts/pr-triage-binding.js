import { resolveModel } from './resolve-models.js';
import { readWorkflowRpc } from './t3-workflow-read.js';

const ROLE = 'axstack-auditor-sol';
const ID = /^[A-Za-z0-9:_-]{1,160}$/;
const observed = (binding) => ({ status: 'pass', binding });
const unknown = (reason) => ({ status: 'unknown', reason });

function reportBinding(roles, providers) {
  const matches = roles?.version === 1 && Array.isArray(roles.roles) ? roles.roles.filter((role) => role?.id === ROLE) : [];
  const role = matches[0];
  if (matches.length !== 1 || role.provider !== 'codex' || role.modeId !== 'full-access') {
    return unknown('installed report role is missing, ambiguous, or has a different runtime mode');
  }
  if (!Array.isArray(providers)) return unknown('live T3 provider catalog is unreadable');
  const seats = providers.filter((seat) => seat?.instanceId === role.provider);
  const seat = seats[0];
  if (seats.length !== 1 || seat.driver !== 'codex' || seat.enabled !== true || seat.installed !== true ||
      seat.status === 'error' || !Array.isArray(seat.models)) return unknown('Codex provider seat is unavailable or ambiguous');
  try {
    const models = seat.models.map((model) => ({ id: model.slug, options: model.capabilities?.optionDescriptors }));
    const resolved = resolveModel({ providers: [{ providerInstanceId: seat.instanceId, driverKind: seat.driver, models }] }, {
      provider: role.provider, model: role.model, class: role.modelClass, effort: role.thinkingOptionId, excluded: [],
    });
    return observed({
      model: { instanceId: resolved.providerInstanceId, model: resolved.model, options: [resolved.effortOption] },
      runtimeMode: role.modeId,
    });
  } catch {
    return unknown('report model or effort is unavailable in the live catalog');
  }
}

async function readBinding(runtimeFile, registryTokenFile, rolesFile, threadId = undefined) {
  const runtime = await Bun.file(runtimeFile).json().catch(() => null);
  if (typeof runtime?.origin !== 'string') return unknown('local T3 runtime metadata is unreadable');
  const { origin } = runtime;
  if (threadId) {
    if (!ID.test(threadId)) return unknown('report thread ID is invalid');
    const projection = await readWorkflowRpc(origin, registryTokenFile, 'orchestration.getThreadProjection', { threadId });
    const thread = projection?.thread;
    if (thread?.id !== threadId || !thread.modelSelection || typeof thread.runtimeMode !== 'string') {
      return unknown('effective report thread binding is unreadable');
    }
    return observed({ model: thread.modelSelection, runtimeMode: thread.runtimeMode });
  }
  const [roles, config] = await Promise.all([
    Bun.file(rolesFile).json().catch(() => null), readWorkflowRpc(origin, registryTokenFile, 'server.getConfig', {}),
  ]);
  if (!roles) return unknown('installed role snapshot is unreadable');
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
    const result = await readBinding(args[0], args[1], args[2], args[3])
      .catch(() => unknown('report binding evidence is unreadable'));
    console.log(JSON.stringify(result));
    if (result.status === 'unknown') process.exitCode = 2;
  }
}
