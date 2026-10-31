import { expect, test } from 'bun:test';
import { recommend } from '../../skills/axstack/scripts/fleet-route.js';
import { NOW } from './fleet-route-fixture.js';
import { article } from './fleet-artifact-fixture.js';
import { configuredBrainstorm, seats } from './fleet-brainstorm-fixture.js';

const candidates = ['axstack-advisor-astra', 'axstack-advisor-opus', 'axstack-arena-candidate-grok'];
const judges = ['axstack-arena-judge-opus', 'axstack-escalation-fable', 'axstack-arena-judge-astra'];
function brainstorm(role = candidates[0]) {
  const f = article();
  Object.assign(f.scope, { workflow: 'brainstorm', roleId: role });
  f.roles.roles.push({ ...f.roles.roles[0], id: role });
  return f;
}

test.each(seats)('No-project brainstorm admits only its explicit seat: %s', (...seat) => {
  const f = configuredBrainstorm(seat);
  const selected = recommend(f.input, NOW);
  expect(selected.eligible.map((d) => d.environmentId)).toEqual([f.scope.environmentId]);
  const result = f.run();
  expect(result.status, result.error).toBe(0);
  const plan = JSON.parse(result.output);
  expect(plan.isolation).toBe('shared');
  expect(plan.artifactScope).toEqual(f.scope);
  expect(plan.target).toEqual({ environmentId: f.scope.environmentId, projectId: f.scope.projectId,
    providerInstanceId: seat[1], model: seat[2], options: [{ id: seat[3], value: seat[4] }] });
  expect(plan.runtimeMode).toBe('full-access');
});

test.each(['research', 'explain', 'publish'])('Brainstorm seats cannot enter %s artifact authority', (workflow) => {
  for (const role of [...candidates, ...judges]) {
    const f = brainstorm(role);
    f.scope.workflow = workflow;
    expect(() => recommend(f.input, NOW), role).toThrow('request');
  }
});

test.each(['axstack-research-web', 'axstack-diligence', 'axstack-explainer', 'axstack-owner',
  'axstack-author', 'axstack-reviewer-primary', 'axstack-advisor-custom'])('Brainstorm rejects unrelated role %s', (role) => {
  const f = brainstorm(role);
  expect(() => recommend(f.input, NOW)).toThrow('request');
});

// One changed fact per control: no earlier invalid role can mask these guards.
test.each([
  ['engineering authority', (f) => { f.input.request.role = 'author'; }],
  ['null-repo engineering without scope', (f) => { delete f.input.request.scope; }],
  ['unknown workflow', (f) => { f.scope.workflow = 'align'; }],
  ['fabricated repo', (f) => { f.input.request.repositoryId = 'other/repo'; }],
  ['shared artifact root', (f) => { f.scope.artifactRoot = f.scope.workspaceRoot; }],
  ['evidence outside workspace', (f) => { f.scope.evidenceRoot = '/other/evidence'; }],
  ['overlap', (f) => { f.scope.evidenceRoot = f.scope.artifactRoot + '/evidence'; }],
  ['reserved artifact root', (f) => { f.scope.reservedRoots = [f.scope.artifactRoot]; }],
  ['reserved evidence root', (f) => { f.scope.reservedRoots = [f.scope.evidenceRoot]; }],
  ['traversal', (f) => { f.scope.artifactRoot += '/../escape'; }],
])('Brainstorm rejects %s from a valid control', (_, change) => {
  const f = brainstorm();
  expect(recommend(f.input, NOW).selected).not.toBeNull();
  change(f);
  expect(() => recommend(f.input, NOW)).toThrow('request');
});

test.each([
  ['remote environment', (f) => { f.scope.environmentId = 'env-worker-a'; }],
  ['other project', (f) => { f.scope.projectId = 'other'; }],
  ['provider', (f) => { f.input.request.providerInstanceId = 'other'; }],
  ['model', (f) => { f.input.request.model = 'other'; }],
  ['effort', (f) => { f.input.request.options = { reasoningEffort: 'low' }; }],
  ['runtime', (f) => { f.input.request.runtimeMode = 'plan'; }],
])('Brainstorm retains %s route binding', (_, change) => {
  const f = brainstorm();
  expect(recommend(f.input, NOW).selected).not.toBeNull();
  change(f);
  expect(recommend(f.input, NOW).selected).toBeNull();
});

test.each([seats[2], seats[4]])('unavailable configured %s holds without substitution', (...seat) => {
  const f = configuredBrainstorm(seat);
  expect(f.run().status).toBe(0);
  f.capabilities.providers.find((p) => p.providerInstanceId === seat[1]).models = [];
  f.refreshCatalog();
  const result = f.run();
  expect(result.status).toBe(2);
  expect(result.output).toBe('');
  expect(result.error).toMatch(/missing first listed model|no matching fable model/);
});

test.each(['codex-only', 'claude-only'])('%s intentional absent seats cannot borrow a model', (preset) => {
  for (const seat of seats.filter((s) => s[0] === 'axstack-arena-candidate-grok'
    || (preset === 'codex-only' ? ['axstack-escalation-fable', 'axstack-arena-judge-opus'].includes(s[0])
      : s[0] === 'axstack-arena-judge-astra'))) {
    const f = configuredBrainstorm(seat, preset);
    const result = f.run();
    expect(result.status, seat[0]).toBe(2);
    expect(result.error).toContain('intentional absence');
    expect(result.output).toBe('');
  }
});

test.each([
  ['provider', 'providerInstanceId', 'claudeAgent'],
  ['model', 'model', 'gpt-6.1-sol'],
  ['effort', 'options', { reasoningEffort: 'low' }],
])('Brainstorm CLI independently enforces configured %s after selector passes', (_, key, value) => {
  const f = configuredBrainstorm(seats[0]);
  expect(f.run().status).toBe(0);
  f.input.request[key] = value;
  // Keep destination agreement valid to reach the distinct configured-role guard.
  f.input.destinations.forEach((d) => { d.execution[key] = value; });
  expect(recommend(f.input, NOW).selected).not.toBeNull();
  const result = f.run();
  expect(result.status).toBe(2);
  expect(result.output).toBe('');
  expect(result.error).toContain('settings-mismatch');
});
