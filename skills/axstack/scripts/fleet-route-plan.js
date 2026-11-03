// Whole-task placement over saved facts only. No I/O, dispatch or authority grant.
import { recommend, parseFleetConfig } from './fleet-route.js';
import { inspectDestination } from './fleet-destination.js';
import { canonical, text } from './fleet-config.js';

const hash = (value) => new Bun.CryptoHasher('sha256').update(value).digest('hex');
const term = (code, pass, evidence) => ({ code,
  state: pass ? 'pass' : evidence == null ? 'unknown' : 'fail', evidence: evidence ?? null });

function modelIn(catalog, pin, serverVersion) {
  const providers = Array.isArray(catalog?.providers)
    ? catalog.providers.filter((p) => p?.providerInstanceId === pin?.providerInstanceId) : [];
  const p = providers?.length === 1 ? providers[0] : null;
  const models = Array.isArray(p?.models) ? p.models.filter((m) => m?.id === pin?.model) : [];
  const unrestricted = p?.runtimeModes === undefined && serverVersion === '0.1.5'
    && ['codex', 'claudeAgent'].includes(p?.driverKind);
  return catalog?.runtimeMode === 'full-access' && p?.canRunChildTask === true && text(p.driverKind)
    && Array.isArray(p.constraints) && p.constraints.length === 0
    && (unrestricted || (Array.isArray(p.runtimeModes) && p.runtimeModes.includes('full-access')))
    && models.length === 1 ? { provider: p, model: models[0] } : null;
}

function staffingTerms(input, environmentId) {
  const o = input.nativeDestinations?.[environmentId];
  let catalog;
  try { catalog = JSON.parse(o?.capabilities?.valueText); } catch { /* unknown catalog */ }
  const resolve = (pin) => modelIn(catalog, pin, o?.environment?.value?.serverVersion);
  const driver = resolve(input.request);
  const author = resolve(input.staffing?.author);
  const reviewer = resolve(input.staffing?.reviewer);
  const options = input.request.options;
  const supportedOptions = driver && Object.entries(options).every(([id, value]) => {
    const definitions = Array.isArray(driver.model.options) ? driver.model.options.filter((v) => v?.id === id) : [];
    const d = definitions?.length === 1 ? definitions[0] : null;
    const values = d?.values ?? (Array.isArray(d?.options) ? d.options.map((v) => v?.id) : []);
    return Array.isArray(values) && values.includes(value);
  });
  return [term('driver-model', !!driver && supportedOptions && input.request.runtimeMode === 'full-access', catalog),
    term('local-staffing', !!author && !!reviewer && author.provider.driverKind !== reviewer.provider.driverKind
      && Array.isArray(input.staffing?.advisers) && input.staffing.advisers.every(resolve),
    { staffing: input.staffing ?? null, catalog: catalog ?? null })];
}

export function planIntake(input, now) {
  const config = parseFleetConfig(input.configText, input.configDigest);
  if (input.request?.role !== 'driver') throw new Error('driver-role-required');
  const initial = recommend(input, now); // Validate and rank the unchanged supplied facts.
  const terms = initial.excluded.map((e) => ({ code: 'route-eligibility',
    state: e.reasons.some((r) => /unproven|missing/.test(r)) ? 'unknown' : 'fail',
    environmentId: e.environmentId, evidence: e }));
  const intake = input.intake ?? {};
  const local = () => {
    const localTerms = staffingTerms(input, input.origin.environmentId);
    terms.push(...localTerms.map((t) => ({ ...t, environmentId: input.origin.environmentId })));
    return localTerms.every((t) => t.state === 'pass');
  };
  const result = (disposition, reason, selected = null, extra = {}) => structuredClone({
    schemaVersion: 1, kind: 'intake-plan', configDigest: input.configDigest, evaluatedAt: now,
    request: input.request, disposition, reason, selected, terms,
    counts: Object.fromEntries(['pass', 'fail', 'unknown', 'n/a'].map((s) => [s, terms.filter((t) => t.state === s).length])),
    ...extra,
  });
  const stay = (reason) => local() ? result('stay', reason) : result('hold', 'local-staffing-unproven');
  if (intake.routed === true) return stay('already-routed');
  if (intake.kind !== 'new-task' || intake.willDispatch !== true) return stay('not-intake');
  const named = intake.namedHost;
  if (named === 'here' || config.hosts.some((h) => h.id === named && h.environmentId === input.origin.environmentId)) return stay('named-local');
  if (named == null && config.intakeRouting !== true) return stay('routing-disabled');
  const support = config.intakeSupport?.filter((s) => s.environmentId === input.origin.environmentId
    && s.providerInstanceId === input.origin.providerInstanceId);
  const supported = support?.length === 1 && support[0].supported === true && text(support[0].evidence);
  terms.push(term('launch-support', supported, support?.length ? support : null));
  if (!supported) return stay('routing unsupported');
  const inputsReady = [input.origin.threadId, input.origin.title, intake.launchKey, intake.taskText,
    intake.scope?.identity, intake.scope?.content ?? intake.scope?.destinationRef, intake.authority, intake.grantCitation].every(text);
  terms.push(term('launch-inputs', inputsReady, intake));
  if (!inputsReady) return result('hold', 'launch-inputs-unproven');
  const exclusions = structuredClone(input.exclusions);
  for (const host of config.hosts) {
    if (named != null && host.id !== named) exclusions.hosts[host.id] = 'named-host-opt-out';
    const selected = initial.eligible.find((h) => h.hostId === host.id);
    if (!selected) continue;
    const observation = input.nativeDestinations?.[host.environmentId];
    const capabilitiesText = observation?.capabilities?.valueText;
    const checks = staffingTerms(input, host.environmentId);
    checks.push(term('project-list', Array.isArray(observation?.projectList)
      && observation.projectList.length > 0, observation?.projectList));
    checks.push(term('catalog-digest', typeof capabilitiesText === 'string'
      && hash(capabilitiesText) === selected.destinationCapabilitiesDigest, capabilitiesText));
    if (typeof capabilitiesText === 'string') {
      try { checks.push(...inspectDestination(observation, { ...initial, selected }, capabilitiesText, now)); }
      catch { checks.push(term('native-destination', false, observation)); }
    } else checks.push(term('native-destination', false, observation));
    terms.push(...checks.map((t) => ({ ...t, environmentId: host.environmentId })));
    if (checks.some((t) => t.state !== 'pass')) exclusions.hosts[host.id] = 'pre-launch-unproven';
  }
  const recommendation = recommend({ ...input, exclusions }, now);
  const selected = recommendation.selected;
  if (!selected) return stay('no-eligible-host');
  if (selected.environmentId === input.origin.environmentId) return stay('selected-local');
  const launch = { environmentId: selected.environmentId, projectId: selected.projectId,
    clientRequestId: intake.launchKey, title: `${input.origin.title} [${intake.launchKey}]`,
    delegatedFrom: { environmentId: input.origin.environmentId, threadId: input.origin.threadId, title: input.origin.title },
    message: JSON.stringify({ taskText: intake.taskText, scope: intake.scope, authority: intake.authority,
      routed: true, grantCitation: intake.grantCitation, launchKey: intake.launchKey,
      acceptanceOnly: 'Check scope/authority, readable inputs and local staffing (author, different-provider reviewer, advisers if needed). '
        + 'Do no implementation. End with exactly AXSTACK-ACCEPT or AXSTACK-HANDBACK <reason>. Wait for proceed.' }) };
  return result('launch', 'whole-task-intake', selected, { launch });
}

export function bindIntakePlan(input, saved, configDigest, now, capabilitiesText, resolved, kind) {
  const hold = (code) => { throw Object.assign(new Error(code), { exitCode: 2 }); };
  if (kind !== 'launch') hold('driver-launch-only');
  if (configDigest !== input.configDigest) hold('config-digest-mismatch');
  const current = planIntake(input, now);
  if (canonical(saved) !== canonical(current)) hold('intake-plan-mismatch');
  if (current.disposition !== 'launch') hold(current.reason);
  if (hash(capabilitiesText) !== current.selected.destinationCapabilitiesDigest) hold('capabilities-digest-mismatch');
  const r = input.request;
  if (r.providerInstanceId !== resolved.providerInstanceId || r.model !== resolved.model
    || r.options[resolved.effortOption?.id] !== resolved.effortOption?.value) hold('settings-mismatch');
  return { launch: current.launch, planTerms: current.terms,
    options: Object.entries(r.options).sort(([a], [b]) => a.localeCompare(b)).map(([id, value]) => ({ id, value })),
    destination: { environmentId: current.selected.environmentId, projectId: current.selected.projectId },
    fleetBinding: { configDigest, destinationSnapshotId: current.selected.destinationSnapshotId,
      destinationCapabilitiesDigest: current.selected.destinationCapabilitiesDigest } };
}
