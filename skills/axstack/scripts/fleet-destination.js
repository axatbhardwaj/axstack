// Validate explicit saved native reads. These bindings do not authenticate input.
import { canonical, text, time } from './fleet-config.js';

export function inspectDestination(observation, recommendation, capabilitiesText, now) {
  const terms = [];
  const term = (code, pass, evidence) => terms.push({ code,
    state: pass ? 'pass' : evidence == null ? 'unknown' : 'fail', evidence: evidence ?? null });
  const s = recommendation.selected;
  const o = observation ?? {};
  for (const [name, tool, environmentId, args] of [
    ['environment', 't3_environment_read', s.environmentId, {}],
    ['project', 't3_project_read', s.environmentId, { projectId: s.projectId }],
    ['capabilities', 'orchestrator_capabilities', s.environmentId, {}],
    ['links', 't3_environment_links', recommendation.originEnvironmentId, {}],
  ]) {
    const read = o[name];
    term('destination-observation', read?.tool === tool && read?.environmentId === environmentId
      && canonical(read?.args) === canonical(args) && time(read?.observedAt)
      && read.observedAt <= now && text(read?.evidence), read);
  }
  term('destination-identity', o.environment?.value?.environmentId === s.environmentId,
    o.environment?.value?.environmentId);
  term('destination-project', o.project?.value?.id === s.projectId && text(o.project?.value?.workspaceRoot),
    o.project?.value);
  term('destination-repository', o.project?.value?.repositoryIdentity?.canonicalKey === s.repositoryId,
    o.project?.value?.repositoryIdentity);
  term('destination-catalog', o.capabilities?.valueText === capabilitiesText, o.capabilities?.valueText);
  const catalog = JSON.parse(capabilitiesText);
  const provider = catalog.providers?.find((v) => v.providerInstanceId === recommendation.request.providerInstanceId);
  term('destination-execution', provider?.canRunChildTask === true
    && provider?.runtimeModes?.includes(recommendation.request.runtimeMode), provider);
  const local = s.environmentId === recommendation.originEnvironmentId;
  const link = o.links?.value?.links?.find((v) => v.environmentId === s.environmentId);
  term('destination-access', o.links?.value?.environmentId === recommendation.originEnvironmentId
    && (local || (link?.status === 'reachable' && link?.access === recommendation.request.runtimeMode
      && Date.parse(link?.expiresAt) > now)), local ? o.links?.value : link);
  return terms;
}
