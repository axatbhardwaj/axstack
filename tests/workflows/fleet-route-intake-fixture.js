import { fixture, NOW } from './fleet-route-fixture.js';

export { NOW };
export function intakeFixture() {
  const f = fixture();
  f.config.intakeRouting = true;
  f.config.intakeSupport = [{ environmentId: f.input.origin.environmentId,
    providerInstanceId: 'codex', supported: true, evidence: 'pilot://origin/codex' }];
  Object.assign(f.input.origin, { threadId: 'origin-thread', title: 'Implement task' });
  Object.assign(f.input.request, { role: 'driver', providerInstanceId: 'codex', model: 'gpt-6.1-sol',
    options: { reasoningEffort: 'high' } });
  f.input.intake = { kind: 'new-task', willDispatch: true, routed: false, launchKey: 'run:driver:task:a1',
    taskText: 'Implement the exact requested task.', scope: { identity: 'spec-r5', content: 'Approved scope.' },
    authority: 'Implement only the approved scope.', grantCitation: 'user-message://standing-intake-grant' };
  f.input.staffing = { author: { providerInstanceId: 'codex', model: 'gpt-6.1-sol' },
    reviewer: { providerInstanceId: 'claudeAgent', model: 'claude-opus-5-5' }, advisers: [] };
  const catalog = { runtimeMode: 'full-access', providers: [
    { providerInstanceId: 'codex', driverKind: 'codex', canRunChildTask: true, constraints: [], runtimeModes: ['full-access'],
      models: [{ id: 'gpt-6.1-sol', options: [{ id: 'reasoningEffort', values: ['high'] }] }] },
    { providerInstanceId: 'claudeAgent', driverKind: 'claudeAgent', canRunChildTask: true, constraints: [],
      runtimeModes: ['full-access'], models: [{ id: 'claude-opus-5-5', options: [] }] },
  ] };
  f.input.nativeDestinations = {};
  for (const d of f.input.destinations) {
    d.execution = { available: true, ...Object.fromEntries(['providerInstanceId', 'model', 'options', 'runtimeMode']
      .map((key) => [key, f.input.request[key]])) };
    const valueText = JSON.stringify(catalog);
    d.capabilitiesDigest = new Bun.CryptoHasher('sha256').update(valueText).digest('hex');
    const read = (tool, args, value, environmentId = d.environmentId) => ({ tool, args, value, environmentId,
      observedAt: NOW, evidence: 'native://saved' });
    f.input.nativeDestinations[d.environmentId] = {
      environment: read('t3_environment_read', {}, { environmentId: d.environmentId, serverVersion: '0.1.5' }),
      project: read('t3_project_read', { projectId: d.project.id }, { id: d.project.id,
        workspaceRoot: '/fixture/project', repositoryIdentity: { canonicalKey: f.input.request.repositoryId } }),
      capabilities: { ...read('orchestrator_capabilities', {}, null), valueText },
      links: read('t3_environment_links', {}, { environmentId: f.input.origin.environmentId,
        links: f.input.destinations.map((host) => ({ environmentId: host.environmentId, status: 'reachable',
          access: 'full-access', expiresAt: new Date(NOW + 60000).toISOString() })) }, f.input.origin.environmentId),
    };
  }
  return f;
}
