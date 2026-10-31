// Validate explicit saved native reads. These bindings do not authenticate input.
import { isArtifact } from './fleet-scope.js';
import { canonical, text, time } from './fleet-config.js';

export function inspectDestination(observation, recommendation, capabilitiesText, now) {
  const terms = [];
  const term = (code, pass, evidence, missing = evidence == null) => terms.push({ code,
    state: pass ? 'pass' : missing ? 'unknown' : 'fail', evidence: evidence ?? null });
  const s = recommendation.selected;
  const o = observation ?? {};
  const observed = (read, tool, environmentId, args) => read?.tool === tool
    && read?.environmentId === environmentId && canonical(read?.args) === canonical(args)
    && time(read?.observedAt) && read.observedAt <= now && text(read?.evidence);
  for (const [name, tool, environmentId, args] of [
    ['environment', 't3_environment_read', s.environmentId, {}],
    ['project', 't3_project_read', s.environmentId, { projectId: s.projectId }],
    ['capabilities', 'orchestrator_capabilities', s.environmentId, {}],
    ['links', 't3_environment_links', recommendation.originEnvironmentId, {}],
  ]) {
    const read = o[name];
    term('destination-observation', observed(read, tool, environmentId, args), read);
  }
  term('destination-identity', o.environment?.value?.environmentId === s.environmentId,
    o.environment?.value?.environmentId);
  term('destination-project', o.project?.value?.id === s.projectId && text(o.project?.value?.workspaceRoot),
    o.project?.value);
  const project = o.project?.value;
  let listed;
  if (o.projectList !== undefined) {
    const pages = o.projectList;
    const projects = [];
    let cursor = 0;
    let complete = Array.isArray(pages) && pages.length > 0;
    if (complete) for (const page of pages) {
      const args = page?.args;
      const limit = args?.limit ?? 20;
      const rows = page?.value?.projects;
      const next = page?.value?.nextCursor;
      complete &&= cursor !== null && observed(page, 't3_project_list', s.environmentId, {
        ...(args?.cursor === undefined ? {} : { cursor }),
        ...(args?.limit === undefined ? {} : { limit }),
      }) && (args?.cursor ?? 0) === cursor && Number.isInteger(limit) && limit >= 1 && limit <= 100
        && Array.isArray(rows) && rows.length <= limit
        && (next === null || (next === cursor + limit && rows.length === limit));
      if (Array.isArray(rows)) projects.push(...rows);
      cursor = next;
    }
    listed = projects.find((p) => p?.id === s.projectId);
    term('destination-project-list', complete && cursor === null
      && projects.every((p) => text(p?.id)) && new Set(projects.map((p) => p?.id)).size === projects.length
      && listed?.id === s.projectId && listed.id === project?.id && listed?.workspaceRoot === project?.workspaceRoot, pages);
  }
  // ProjectService.listPage resolves the cold identity cache; getById need not.
  const identities = [project?.repositoryIdentity, listed?.repositoryIdentity].filter((v) => v != null);
  if (isArtifact(recommendation.request)) {
    const scope = recommendation.request.scope;
    term('destination-artifact-project', project?.repositoryIdentity === null
      && listed?.repositoryIdentity === null && project?.workspaceRoot === scope.workspaceRoot
      && s.environmentId === scope.environmentId && s.projectId === scope.projectId,
    { project, listed });
  } else {
    term('destination-repository', identities.length > 0
      && identities.every((v) => v.canonicalKey === s.repositoryId), identities,
    identities.length === 0);
  }
  term('destination-catalog', o.capabilities?.valueText === capabilitiesText, o.capabilities?.valueText);
  const catalog = JSON.parse(capabilitiesText);
  const providers = catalog.providers?.filter((v) => v.providerInstanceId === recommendation.request.providerInstanceId);
  const provider = providers?.length === 1 ? providers[0] : undefined;
  const mode = recommendation.request.runtimeMode;
  // T3 0.1.5 resolveRuntimeMode/RuntimePolicy preserve modes without restrictions.
  // Limit omission semantics to the observed version and native drivers we checked.
  const unrestricted = provider?.runtimeModes === undefined && o.environment?.value?.serverVersion === '0.1.5'
    && ['codex', 'claudeAgent'].includes(provider?.driverKind);
  const supported = unrestricted || (Array.isArray(provider?.runtimeModes) && provider.runtimeModes.includes(mode));
  term('destination-execution', provider?.canRunChildTask === true && supported
    && catalog.runtimeMode === mode && Array.isArray(provider?.constraints) && provider.constraints.length === 0,
  { provider, runtimeMode: catalog.runtimeMode, serverVersion: o.environment?.value?.serverVersion },
  providers?.length === 0 || provider?.canRunChildTask == null || catalog.runtimeMode == null
    || provider?.constraints == null || (provider?.runtimeModes === undefined && !unrestricted));
  const local = s.environmentId === recommendation.originEnvironmentId;
  const link = o.links?.value?.links?.find((v) => v.environmentId === s.environmentId);
  term('destination-access', o.links?.value?.environmentId === recommendation.originEnvironmentId
    && (local || (link?.status === 'reachable' && link?.access === recommendation.request.runtimeMode
      && Date.parse(link?.expiresAt) > now)), local ? o.links?.value : link);
  return terms;
}
