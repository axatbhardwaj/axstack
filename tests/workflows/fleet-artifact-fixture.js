import { readFileSync } from 'node:fs';
import { recommend } from '../../skills/axstack/scripts/fleet-route.js';
import { fixture, NOW } from './fleet-route-fixture.js';
import { invoke, setup } from './dispatch-plan/fixtures.js';

export function article() {
  const f = setup();
  const data = fixture();
  const input = data.bind();
  const scope = { kind: 'local-artifact', workflow: 'explain', roleId: 'axstack-explainer',
    environmentId: input.origin.environmentId, projectId: '0875f034-af93-4c5e-9acf-5fe2abc1f606',
    workspaceRoot: '/root/.t3/scratch', artifactRoot: '/root/.t3/scratch/article/author',
    evidenceRoot: '/root/.t3/scratch/article/evidence/author', reservedRoots: [] };
  Object.assign(input.request, { task: 'explain', repositoryId: null, scope,
    providerInstanceId: 'codex', model: 'gpt-6.1-sol', options: { reasoningEffort: 'high' } });
  f.roles.roles.push({ ...f.roles.roles[0], id: scope.roleId });
  const capabilitiesText = JSON.stringify(f.capabilities);
  for (const d of input.destinations) {
    d.project = { id: scope.projectId, repositoryId: null, workspaceRoot: scope.workspaceRoot };
    d.execution = { available: true, providerInstanceId: 'codex', model: 'gpt-6.1-sol',
      options: input.request.options, runtimeMode: 'full-access' };
    d.capabilitiesDigest = new Bun.CryptoHasher('sha256').update(capabilitiesText).digest('hex');
  }
  const read = (tool, args, value) => ({ tool, environmentId: scope.environmentId,
    args, value, observedAt: NOW, evidence: 'saved://native' });
  const project = { id: scope.projectId, workspaceRoot: scope.workspaceRoot, repositoryIdentity: null };
  input.nativeDestination = {
    environment: read('t3_environment_read', {}, { environmentId: scope.environmentId, serverVersion: '0.1.5' }),
    project: read('t3_project_read', { projectId: scope.projectId }, project),
    projectList: [read('t3_project_list', { limit: 100 }, { projects: [structuredClone(project)], nextCursor: null })],
    capabilities: { ...read('orchestrator_capabilities', {}, null), valueText: capabilitiesText },
    links: read('t3_environment_links', {}, { environmentId: scope.environmentId, links: [] }),
  };
  // Native execution authority is independent of the model/options resolver.
  Object.assign(f.capabilities, { runtimeMode: 'full-access' });
  Object.assign(f.capabilities.providers[0], { driverKind: 'codex', canRunChildTask: true, constraints: [] });
  const refreshCatalog = () => {
    const raw = JSON.stringify(f.capabilities);
    input.nativeDestination.capabilities.valueText = raw;
    input.destinations.forEach((d) => { d.capabilitiesDigest = new Bun.CryptoHasher('sha256').update(raw).digest('hex'); });
    return raw;
  };
  refreshCatalog();
  const run = (role = scope.roleId, kind = 'task', readback) => {
    const saved = recommend(input, NOW);
    const args = ['--role', role, '--roles', f.save('roles', f.roles), '--kind', kind,
      '--capabilities', f.save('caps', f.capabilities), '--fleet-input', f.save('input', input),
      '--recommendation', f.save('recommendation', saved), '--now', String(NOW), '--config-digest', input.configDigest];
    if (readback) args.push('--verify', f.save('readback', readback));
    return invoke(args);
  };
  return { ...f, input, scope, run, refreshCatalog };
}

export function configuredArtifact(seat, workflow, preset = 'mixed') {
  const [role, providerInstanceId, model, option, effort] = seat;
  const f = article();
  Object.assign(f.scope, { workflow, roleId: role });
  f.roles.roles = JSON.parse(readFileSync(`${import.meta.dir}/../../profiles/presets/${preset}.json`, 'utf8')).roles;
  Object.assign(f.input.request, { providerInstanceId, model, options: { [option]: effort } });
  f.input.destinations.forEach((d) => {
    Object.assign(d.execution, { providerInstanceId, model, options: { [option]: effort } });
  });
  f.capabilities.providers.forEach((p) => {
    Object.assign(p, { canRunChildTask: true, constraints: [], runtimeModes: ['full-access'] });
  });
  const provider = f.capabilities.providers.find((p) => p.providerInstanceId === providerInstanceId);
  if (!provider.models.some((m) => m.id === model)) {
    provider.models.push({ ...structuredClone(provider.models[0]), id: model });
  }
  f.refreshCatalog();
  return f;
}
