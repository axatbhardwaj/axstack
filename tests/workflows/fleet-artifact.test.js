import { expect, test } from 'bun:test';
import { recommend } from '../../skills/axstack/scripts/fleet-route.js';
import { NOW } from './fleet-route-fixture.js';
import { configuration } from './dispatch-plan/fixtures.js';
import { article } from './fleet-artifact-fixture.js';

test('explicit No-project article scope produces a native shared task with exact target and settings', () => {
  const f = article();
  const result = f.run();
  expect(result.status, result.error).toBe(0);
  const plan = JSON.parse(result.output);
  expect(plan.isolation).toBe('shared');
  expect(plan.target).toEqual({ environmentId: f.scope.environmentId, projectId: f.scope.projectId,
    providerInstanceId: 'codex', model: 'gpt-6.1-sol', options: [{ id: 'reasoningEffort', value: 'high' }] });
  expect(plan.runtimeMode).toBe('full-access');
  expect(plan.artifactScope).toEqual(f.scope); // Evidence only, never a native argument.
  const readback = { ...configuration(), environmentId: f.scope.environmentId, projectId: f.scope.projectId,
    fleetBinding: plan.fleetBinding, artifactScope: f.scope, isolation: 'shared' };
  expect(f.run(f.scope.roleId, 'task', readback).output).toContain('MATCH');
  readback.artifactScope = { ...f.scope, artifactRoot: '/root/.t3/scratch/other' };
  expect(f.run(f.scope.roleId, 'task', readback).status).toBe(2);
});

test.each(['research', 'explain', 'publish'])('%s artifact workflow preserves applicable roles', (workflow) => {
  const f = article();
  f.scope.workflow = workflow;
  for (const role of ['axstack-research-web', 'axstack-research-code-sol', 'axstack-explore-execution', 'axstack-explore-execution-sol', 'axstack-diligence',
    ...(workflow === 'research' ? [] : ['axstack-explainer', 'axstack-explainer-review', 'axstack-ui-verifier'])]) {
    f.scope.roleId = role;
    f.roles.roles = [{ ...f.roles.roles[0], id: role }];
    expect(f.run().status, role).toBe(0);
  }
});

test.each([
  ['absent scope', (f) => { delete f.input.request.scope; }],
  ['null scope', (f) => { f.input.request.scope = null; }],
  ['engineering author', (f) => { f.input.request.role = 'author'; }],
  ['code reviewer', (f) => { f.scope.roleId = 'axstack-reviewer-primary'; }],
  ['wrong workflow', (f) => { f.scope.workflow = 'implement'; }],
  ['wrong workflow role', (f) => { f.scope.workflow = 'research'; f.scope.roleId = 'axstack-explainer-review'; }],
  ['repository fabrication', (f) => { f.input.request.repositoryId = 'unrelated/repo'; }],
  ['relative root', (f) => { f.scope.artifactRoot = 'article'; }],
  ['shared root', (f) => { f.scope.artifactRoot = f.scope.workspaceRoot; }],
  ['escaping root', (f) => { f.scope.artifactRoot += '/../escape'; }],
  ['overlapping roots', (f) => { f.scope.evidenceRoot = f.scope.artifactRoot + '/evidence'; }],
  ['occupied root', (f) => { f.scope.reservedRoots = [f.scope.artifactRoot + '/other']; }],
])('artifact scope rejects %s before selection', (_, change) => {
  const f = article(); change(f);
  expect(() => recommend(f.input, NOW)).toThrow();
});

test('artifact routes never leave the explicit local environment/project/workspace', () => {
  for (const change of [
    (f) => { f.scope.environmentId = 'env-worker-a'; },
    (f) => { f.scope.projectId = 'other-project'; },
    (f) => { f.input.destinations.find((d) => d.environmentId === f.scope.environmentId).project.workspaceRoot = '/other'; },
    (f) => { f.input.destinations.find((d) => d.environmentId === f.scope.environmentId).project.repositoryId = 'a/repo'; },
  ]) {
    const f = article(); change(f);
    expect(recommend(f.input, NOW).selected).toBeNull();
  }
  const f = article();
  const result = recommend(f.input, NOW);
  expect(result.eligible.map((d) => d.environmentId)).toEqual([f.scope.environmentId]);
  expect(result.excluded.filter((d) => d.environmentId !== f.scope.environmentId)
    .every((d) => d.reasons.includes('artifact-local-only'))).toBe(true);
});

test('article plans require matching role and native shared-task mode', () => {
  const f = article();
  f.roles.roles.push({ ...f.roles.roles[0], id: 'axstack-diligence' });
  expect(f.run('axstack-diligence').error).toContain('artifact-role-mismatch');
  expect(f.run(f.scope.roleId, 'launch').error).toContain('artifact-task-only');
  delete f.input.nativeDestination;
  expect(f.run().error).toContain('artifact-native-destination-required');
});

test('native artifact identity requires explicit null from complete project read/list', () => {
  for (const change of [
    (o) => { delete o.project.value.repositoryIdentity; },
    (o) => { o.project.value.repositoryIdentity = { canonicalKey: 'a/repo' }; },
    (o) => { delete o.projectList; },
    (o) => { o.projectList[0].value.nextCursor = 100; },
    (o) => { o.projectList[0].environmentId = 'remote'; },
    (o) => { o.projectList[0].value.projects[0] = { ...o.project.value, repositoryIdentity: { canonicalKey: 'a/repo' } }; },
  ]) {
    const f = article(); change(f.input.nativeDestination);
    expect(f.run().status).toBe(2);
  }
});

test('native execution/project authority still holds independently for artifacts', () => {
  for (const change of [
    (f) => { f.input.nativeDestination.project.value.id = 'other'; },
    (f) => { f.input.nativeDestination.environment.value.environmentId = 'other'; },
    (f) => { f.capabilities.providers[0].canRunChildTask = false; f.refreshCatalog(); },
    (f) => { f.capabilities.providers[0].constraints = ['denied']; f.refreshCatalog(); },
    (f) => { f.capabilities.runtimeMode = 'plan'; f.refreshCatalog(); },
    (f) => { f.capabilities.providers[0].runtimeModes = ['plan']; f.refreshCatalog(); },
  ]) {
    const f = article(); change(f);
    expect(f.run().status).toBe(2);
  }
  for (const [key, value] of Object.entries({ providerInstanceId: 'other', model: 'other',
    options: { reasoningEffort: 'low' }, runtimeMode: 'plan' })) {
    const f = article();
    f.input.destinations.find((d) => d.environmentId === f.scope.environmentId).execution[key] = value;
    expect(recommend(f.input, NOW).selected, key).toBeNull();
  }
});


test('native article workspace must match scope even when both native reads agree', () => {
  const f = article();
  expect(f.run().status).toBe(0);
  f.input.nativeDestination.project.value.workspaceRoot = '/other';
  f.input.nativeDestination.projectList[0].value.projects[0].workspaceRoot = '/other';
  expect(f.run().status).toBe(2);
});

test('article readback rejects worktree isolation with unchanged scope', () => {
  const f = article();
  const plan = JSON.parse(f.run().output);
  const readback = { ...configuration(), environmentId: f.scope.environmentId, projectId: f.scope.projectId,
    fleetBinding: plan.fleetBinding, artifactScope: f.scope, isolation: 'shared' };
  expect(f.run(f.scope.roleId, 'task', readback).output).toContain('MATCH');
  readback.isolation = 'worktree';
  expect(f.run(f.scope.roleId, 'task', readback).status).toBe(2);
});

test('article evidence root must be inside workspace independently of artifact root', () => {
  const f = article();
  expect(recommend(f.input, NOW).selected).not.toBeNull();
  f.scope.evidenceRoot = '/other/evidence';
  expect(() => recommend(f.input, NOW)).toThrow();
});
