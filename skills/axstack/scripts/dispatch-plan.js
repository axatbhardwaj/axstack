import { readFileSync, writeFileSync } from 'node:fs';
import { inspectFleetReceipt } from './fleet-receipt.js';
import { bindFleet } from './fleet-dispatch.js';
import { canonical } from './fleet-config.js';
import { bindIntakePlan } from './fleet-route-plan.js';

const fleetFlags = ['--recommendation', '--fleet-input', '--now', '--config-digest'];
const flags = ['--role', '--roles', '--capabilities', '--kind', '--verify', '--out', ...fleetFlags];
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const help = `Usage: bun dispatch-plan.js --role <id> --roles <roles.json>
  --capabilities <saved.json> --kind task|launch
  [--verify <native-reads.json>] [--out <report.json>]
Example: bun dispatch-plan.js --role axstack-author --roles roles.json --capabilities capabilities.json --kind task

--role          Role ID from the supplied snapshot
--roles         Installed-style roles.json (version 1, roles array)
--capabilities  Saved orchestrator_capabilities JSON; reuse the run's saved snapshot
--kind          task emits target and, for axstack-author, isolation:"worktree"; launch emits modelSelection
--verify        Compare saved native thread/task reads; print evidence then MATCH or each mismatch
--out           Save the payload as full JSON here; stdout is an input/path/omitted-count summary
--recommendation Saved fleet-route recommendation; requires all following fleet flags
                 Also accepts a fleet-route plan result for a driver intake launch
--fleet-input   Saved complete selector input, including exact reviewed config bytes
--now           Injected nonnegative epoch-ms evaluation time matching the recommendation
--config-digest Run-pinned config SHA-256; must match facts and recommendation
--help          Show all flags and exit codes

Read-only inputs: reads supplied JSON, spawns adjacent resolve-models.js, writes stdout/stderr.
Writes only the caller's --out path when supplied; no retained state.
Results name input paths. Plan output over 4096 bytes requires --out.
Large verification retains its exit code, prints mismatches and advises --out on stderr.
An unwritable --out still prints verification mismatches and retains exit 2.
An omitted provider label is unknown; exact instance/model/options/mode checks still apply.
Verification input: {"thread": <t3_thread_read.thread>, "task": <task_status (optional)>}.
Save structured native data, not message text or requested dispatch settings.
thread fields: threadId (required non-empty ID), providerInstanceId, model, runtimeMode, options (if returned).
task fields: childThreadId (or remoteChild.threadId), providerInstanceId, model, options (if returned).
When task is supplied, its child thread ID must equal thread.threadId.
Local and remote child IDs must agree when both are returned.
Remote reads also require envelope environmentId matching task.remoteChild.environmentId.
Compare every returned setting; conflicting reads hold. Unreturned fields are unknown
and hold required checks; never fill them from the plan or catalog.
Never dispatches or changes snapshots. Reuse recorded exact model pins as given.
Fleet --capabilities is the selected destination's raw saved catalog, digest-bound
by its destination facts. It is never the origin catalog by default.
Fleet verification requires environmentId/projectId and fleetBinding alongside
the native thread/task reads. C3 collects that host-qualified evidence envelope.
Optional input.nativeDestination validates saved native forwarded reads.
Explicit local-artifact scope requires those reads and kind task; emits isolation:"shared".
artifactScope is preserved evidence only, never a native tool argument.
Artifact verification also requires artifactScope and independently checked isolation.
Optional --verify fleetAttempt/fleetReceipt validates host-qualified terminal facts;
--out retains per-term receipt evidence. Synthetic bindings cannot authenticate reads.
Coordinator routes remain unsupported here. A plan grants no launch authority.
Driver intake launches emit environmentId/projectId, delegatedFrom (including title),
clientRequestId, title and an acceptance-only message from the checked intake plan.
Driver --verify additionally uses native thread.title/projectId/latestRunId and
recentRuns from t3_thread_read (runId and nonempty startedAt); missing stays unknown.
Terms report pass/fail/unknown/n/a with evidence; never an authority verdict.
Exit codes: 0 ok, 1 error, 2 hold (including incomplete read-back).
`;

function hold(message) {
  throw Object.assign(new Error(message), { exitCode: 2 });
}

function argumentsFrom(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (!flags.includes(flag)) throw new Error(`unexpected argument ${flag}; use --help`);
    const value = args[i + 1];
    if (!nonempty(value) || value.startsWith('--')) throw new Error(`expected value after ${flag}; pass ${flag} <value>`);
    if (flag in options) throw new Error(`duplicate argument ${flag}; pass it once`);
    options[flag] = value;
  }
  for (const flag of ['--role', '--roles', '--capabilities', '--kind']) {
    if (!options[flag]) throw new Error(`expected ${flag}; pass ${flag} <value>`);
  }
  if (fleetFlags.some((flag) => options[flag])) {
    for (const flag of fleetFlags) if (!options[flag]) throw new Error(`expected ${flag} for fleet binding`);
  }
  if (!['task', 'launch'].includes(options['--kind'])) throw new Error('expected --kind task|launch; pass --kind task or --kind launch');
  return options;
}

function readJSON(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { throw new Error(`${error.message}; pass a readable, valid JSON file: ${path}`); }
}

function normalizedOptions(options) {
  const entries = Array.isArray(options) ? options.map((option) => [option?.id, option?.value])
    : options && typeof options === 'object' ? Object.entries(options) : null;
  if (!entries || entries.some(([id, value]) => typeof id !== 'string' || !id.trim()
    || !['string', 'boolean'].includes(typeof value))
    || new Set(entries.map(([id]) => id)).size !== entries.length) return null;
  return JSON.stringify(entries.sort(([left], [right]) => left.localeCompare(right)));
}

function verify(configuration, provider, model, options, fleet) {
  const mismatches = [];
  const terms = [];
  const { thread, task } = configuration ?? {};
  const sources = [thread, task].filter((source) => source && typeof source === 'object');
  const compare = (field, expected, observed, equal = expected === observed) => {
    if (fleet?.launch) terms.push({ code: field, state: equal ? 'pass' : observed == null || expected == null ? 'unknown' : 'fail',
      evidence: { expected, observed: observed ?? null } });
    if (!equal) mismatches.push(`${field}: ${observed == null || expected == null ? 'unknown' : 'fail'}; `
      + `expected ${JSON.stringify(expected)}; observed ${JSON.stringify(observed) ?? 'missing'}`);
  };
  compare('threadId', 'non-empty native thread ID', thread?.threadId, nonempty(thread?.threadId));
  // A field is unknown only when neither native read returns it.
  for (const [field, nativeField, expected] of [
    ['instanceId', 'providerInstanceId', provider], ['model', 'model', model],
    ['options', 'options', options], ['runtimeMode', 'runtimeMode', 'full-access'],
  ]) {
    const observed = sources.map((source) => source[nativeField]).filter((value) => value != null);
    if (!observed.length) compare(field, expected, undefined);
    for (const value of observed) compare(field, expected, value,
      field === 'options' ? normalizedOptions(expected) === normalizedOptions(value) : expected === value);
  }
  if (task != null) {
    if (task.childThreadId != null && task.remoteChild?.threadId != null) {
      compare('childThreadId', task.remoteChild.threadId, task.childThreadId);
    }
    if (task.remoteChild != null) {
      compare('remoteChild.environmentId', configuration?.environmentId, task.remoteChild.environmentId,
        nonempty(configuration?.environmentId) && task.remoteChild.environmentId === configuration.environmentId);
    }
    const childId = task.remoteChild?.threadId ?? task.childThreadId;
    compare('childThreadId', thread?.threadId, childId,
      nonempty(thread?.threadId) && childId === thread.threadId);
  }
  // T3 may omit the provider label: the exact instance ID is its binding.
  const labels = sources.map((source) => source.provider).filter((value) => value != null);
  for (const label of labels) compare('provider', provider, label,
    (label === 'claude' ? 'claudeAgent' : label) === provider);
  if (fleet) {
    for (const [field, expected] of Object.entries(fleet.destination)) compare(field, expected, configuration?.[field]);
    for (const [field, expected] of Object.entries(fleet.fleetBinding)) compare(field, expected, configuration?.fleetBinding?.[field]);
    if (fleet.launch) {
      compare('launch-title', fleet.launch.title, thread?.title);
      compare('launch-project', fleet.destination.projectId, thread?.projectId);
      const runs = configuration?.recentRuns;
      const run = Array.isArray(runs) ? runs.find((r) => r.runId === thread?.latestRunId) : null;
      const runEvidence = thread?.latestRunId === undefined || (run && run.startedAt === undefined) ? undefined : runs;
      compare('run-started', 'native latest run with startedAt', runEvidence,
        nonempty(thread?.latestRunId) && nonempty(run?.startedAt));
    }
    if (fleet.artifactScope) {
      compare('artifactScope', fleet.artifactScope, configuration?.artifactScope,
        canonical(fleet.artifactScope) === canonical(configuration?.artifactScope));
      compare('isolation', 'shared', configuration?.isolation);
    }
  }
  let receiptTerms;
  if (fleet && configuration?.fleetReceipt !== undefined) {
    receiptTerms = inspectFleetReceipt(configuration.fleetReceipt, {
      attempt: configuration.fleetAttempt, recommendation: fleet.recommendation,
      recommendationJSON: fleet.recommendationJSON, now: fleet.now,
    });
    for (const term of receiptTerms) if (term.state !== 'pass') mismatches.push(`${term.code}: ${term.state}; evidence ${JSON.stringify(term.evidence)}`);
  }
  return { mismatches, ...(fleet?.launch ? { terms } : {}), ...(receiptTerms ? { receiptTerms } : {}), ...(!labels.length ? {
    providerEvidence: `provider: unknown; expected ${JSON.stringify(provider)}; observed missing; `
      + 'provider binding checked via instanceId and saved capabilities',
  } : {}) };
}

function plan(argv, io) {
  if (argv.includes('--help')) {
    io.stdout(help);
    return 0;
  }
  const args = argumentsFrom(argv);
  const inputs = Object.fromEntries(Object.entries(args).filter(([flag]) => flag !== '--out').map(([flag, value]) => [flag.slice(2), value]));
  const emit = (result) => {
    const full = { inputs, ...result };
    const inline = result.mismatches
      ? `${[JSON.stringify({ inputs }), result.terms ? JSON.stringify({ terms: result.terms }) : null,
        result.providerEvidence, result.mismatches.join('\n') || 'MATCH'].filter(Boolean).join('\n')}\n`
      : `${JSON.stringify(full)}\n`;
    if (!args['--out']) {
      if (new TextEncoder().encode(inline).length > 4096) {
        if (!result.mismatches) throw new Error('large output; pass --out <report.json> to save full JSON');
        io.stderr('Large verification output; pass --out <path>.json for a saved JSON copy\n');
      }
      io.stdout(inline);
      return;
    }
    try { writeFileSync(args['--out'], `${JSON.stringify(full, null, 2)}\n`); }
    catch (error) {
      const message = `${error.message}; pass --out <writable report.json path>`;
      if (!result.mismatches?.length) throw new Error(message);
      io.stderr(`dispatch-plan hold: ${message}\n`);
      io.stdout(inline);
      return;
    }
    io.stdout(`${JSON.stringify({ inputs, reportPath: args['--out'],
      omittedPayloadFields: Object.keys(result).length, omittedMismatches: result.mismatches?.length ?? 0 })}\n`);
  };
  const snapshot = readJSON(args['--roles']);
  if (snapshot?.version !== 1 || !Array.isArray(snapshot.roles)) {
    throw new Error('roles snapshot must have version 1 and a roles array; pass --roles <valid roles.json>');
  }
  const roles = snapshot.roles.filter((role) => role?.id === args['--role']);
  if (roles.length !== 1) hold(`role ${args['--role']} unavailable or ambiguous`);
  const role = roles[0];
  if (!nonempty(role.provider)) hold(`provider unavailable for role ${role.id}`);
  if (role.modeId !== 'full-access' && !(role.provider === 'claude' && role.modeId === 'bypassPermissions')) {
    hold(`mode ${role.modeId ?? 'missing'} unavailable for role ${role.id}`);
  }
  if (!nonempty(role.thinkingOptionId)) hold(`effort unavailable for role ${role.id}`);
  if (!nonempty(role.model) && !nonempty(role.modelClass) && role.model !== null) {
    hold(`model unavailable for role ${role.id}`);
  }
  const modelArgs = typeof role.model === 'string' ? ['--model', role.model]
    : role.modelClass ? ['--class', role.modelClass] : ['--model', String(role.model)];
  const resolved = Bun.spawnSync([process.execPath, `${import.meta.dir}/resolve-models.js`,
    '--provider', role.provider, '--capabilities', args['--capabilities'],
    '--effort', role.thinkingOptionId, ...modelArgs], { stdout: 'pipe', stderr: 'pipe' });
  if (resolved.stderr.length) io.stderr(resolved.stderr.toString());
  if (resolved.exitCode !== 0) return resolved.exitCode === 1 ? 2 : 1;
  const resolution = JSON.parse(resolved.stdout.toString());
  const { model, effortOption, providerInstanceId } = resolution;
  let fleet;
  if (args['--recommendation']) {
    if (!/^\d+$/.test(args['--now'])) throw new Error('evaluation-time');
    const recommendationJSON = readFileSync(args['--recommendation'], 'utf8');
    const recommendation = JSON.parse(recommendationJSON);
    const binder = recommendation?.kind === 'intake-plan' ? bindIntakePlan : bindFleet;
    fleet = binder(readJSON(args['--fleet-input']), recommendation,
      args['--config-digest'], Number(args['--now']), readFileSync(args['--capabilities'], 'utf8'),
      resolution, ...(binder === bindIntakePlan ? [args['--kind']] : [role.id === 'axstack-author', role.id, args['--kind']]));
    fleet.recommendation = recommendation;
    fleet.recommendationJSON = recommendationJSON;
    fleet.now = Number(args['--now']);
  }
  const options = fleet?.options ?? (effortOption ? [effortOption] : []);
  if (args['--verify']) {
    const verification = verify(readJSON(args['--verify']), providerInstanceId, model, options, fleet);
    emit(verification);
    return verification.mismatches.length ? 2 : 0;
  }
  const selection = { [args['--kind'] === 'launch' ? 'instanceId' : 'providerInstanceId']: providerInstanceId,
    model, options, ...(args['--kind'] === 'task' ? fleet?.destination : {}) };
  emit({ [args['--kind'] === 'launch' ? 'modelSelection' : 'target']: selection, runtimeMode: 'full-access',
    ...(fleet?.launch ?? {}),
    ...(fleet?.planTerms ? { terms: fleet.planTerms } : {}),
    ...(fleet?.artifactScope ? { artifactScope: fleet.artifactScope, isolation: fleet.isolation } : {}),
    ...(fleet ? { fleetBinding: fleet.fleetBinding, ...(args['--kind'] === 'launch' ? fleet.destination : {}) } : {}),
    ...(args['--kind'] === 'task' && role.id === 'axstack-author' ? { isolation: 'worktree' } : {}) });
  return 0;
}

export function main(argv, io = { stdout: (text) => process.stdout.write(text), stderr: (text) => process.stderr.write(text) }) {
  try { return plan(argv, io); }
  catch (error) {
    io.stderr(`dispatch-plan ${error.exitCode === 2 ? 'hold' : 'error'}: ${error.message}\n`);
    return error.exitCode ?? 1;
  }
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
