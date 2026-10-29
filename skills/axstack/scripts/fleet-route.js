// Pure supplied-facts API. No clock, filesystem, networking or dispatch.
import { parseFleetConfig, validateInput } from './fleet-config.js';
import { assignmentCounts, routeReasons, telemetry } from './fleet-facts.js';
export { parseFleetConfig } from './fleet-config.js';

export function recommend(input, now) {
  validateInput(input, now);
  const config = parseFleetConfig(input.configText, input.configDigest);
  const counts = assignmentCounts(input, config.hosts);
  const preference = Object.hasOwn(config.taskOrders, input.request.task)
    ? config.taskOrders[input.request.task] : config.defaultOrder;
  const eligible = [];
  const excluded = [];
  for (const hostId of preference) {
    const host = config.hosts.find((h) => h.id === hostId);
    const destination = input.destinations.find((d) => d.environmentId === host.environmentId);
    const routes = config.routes.filter((r) => r.environmentId === host.environmentId
      && r.originEnvironmentId === input.origin.environmentId);
    let accepted = null;
    for (const route of routes) {
      const facts = input.routeFacts.find((f) => f.routeId === route.id);
      const reasons = routeReasons(route, host, destination, facts, input, now);
      if (reasons.length) {
        excluded.push({ hostId, environmentId: host.environmentId, routeId: route.id, reasons,
          exclusion: (Object.hasOwn(input.exclusions.hosts, hostId) ? input.exclusions.hosts[hostId] : null)
            ?? (Object.hasOwn(input.exclusions.routes, route.id) ? input.exclusions.routes[route.id] : null),
          evidence: { configuredRoute: route.evidence ?? null, observedRoute: facts?.evidence ?? null,
            destination: destination?.evidence ?? null, destinationSnapshotId: destination?.snapshotId ?? null,
            configuredCapabilities: host.capabilities, observedCapabilities: destination?.capabilities ?? null } });
      } else if (!accepted) {
        accepted = { hostId, environmentId: host.environmentId, projectId: destination.project.id,
          repositoryId: destination.project.repositoryId, routeId: route.id, routeKind: route.kind,
          destinationSnapshotId: destination.snapshotId, destinationObservedAt: destination.observedAt,
          destinationEvidence: destination.evidence, routeEvidence: facts.evidence, versions: destination.versions,
          execution: destination.execution, capabilities: destination.capabilities,
          fallbackLimitBp: host.fallbackLimitBp, assignmentCount: counts.byEnvironment[host.environmentId],
          telemetry: telemetry(input.telemetry.find((s) => s.environmentId === host.environmentId), now) };
      }
    }
    if (accepted) eligible.push(accepted);
    if (!routes.length) excluded.push({ hostId, environmentId: host.environmentId, routeId: null, reasons: ['route-missing'], exclusion: null });
  }
  const pool = eligible.filter((h) => config.pool.includes(h.hostId));
  const measured = (h) => h.telemetry.status === 'measured';
  const rank = (h) => preference.indexOf(h.hostId);
  const byLoad = (a, b) => a.telemetry.loadBp - b.telemetry.loadBp || rank(a) - rank(b);
  const under = pool.filter((h) => measured(h) && h.telemetry.loadBp <= config.balanceLimitBp);
  let stage; let reason; let selected = null;
  if (!eligible.length) { stage = 'no-route'; reason = 'no-executable-route'; }
  else if (under.length) {
    stage = 'balance'; reason = 'pool-under-limit';
    selected = under.sort((a, b) => a.assignmentCount - b.assignmentCount || byLoad(a, b))[0];
  } else if (pool.length && pool.every((h) => !measured(h))) {
    stage = 'pool-unknown'; reason = 'pool-all-unknown'; selected = pool[0];
  } else {
    stage = 'fallback';
    selected = eligible.find((h) => measured(h) && h.telemetry.loadBp <= h.fallbackLimitBp);
    if (selected) reason = 'first-within-limit';
    else {
      const observed = eligible.filter(measured).sort(byLoad);
      selected = observed[0] ?? eligible[0];
      reason = observed.length ? 'least-loaded-over-limit' : 'all-telemetry-unknown';
    }
  }
  const flags = {
    countsUnknown: input.inventoryStatus === 'unknown', poolEmpty: pool.length === 0,
    poolPartlyUnknown: pool.some(measured) && pool.some((h) => !measured(h)),
    telemetryUnknown: eligible.some((h) => !measured(h)),
    overloaded: selected ? measured(selected) && selected.telemetry.loadBp > selected.fallbackLimitBp : false,
    localAuthorOnly: input.request.role === 'author' && eligible.length > 0
      && eligible.every((h) => h.environmentId === input.origin.environmentId),
  };
  // Copy supplied nested facts so callers cannot mutate input through the result.
  return structuredClone({ schemaVersion: 1, configDigest: input.configDigest, evaluatedAt: now,
    originEnvironmentId: input.origin.environmentId, request: input.request,
    stage, reason: flags.localAuthorOnly ? 'author-local-only' : reason, decisionReason: reason,
    selected, flags, counts, eligible, excluded });
}
