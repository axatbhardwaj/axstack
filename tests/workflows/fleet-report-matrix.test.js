import { expect, test } from 'bun:test';
import { recommend } from '../../skills/axstack/scripts/fleet-route.js';
import { NOW } from './fleet-route-fixture.js';
import { article } from './fleet-artifact-fixture.js';
import { reportWorkflows } from './fleet-report-matrix-fixture.js';

function report(workflow, role) {
  const f = article();
  Object.assign(f.scope, { workflow, roleId: role });
  f.roles.roles = [{ ...f.roles.roles[0], id: role }];
  return f;
}
for (const [workflow, roles] of Object.entries(reportWorkflows)) {
  test.each(roles)(`${workflow} admits its direct or inherited report seat %s`, (role) => {
    const f = report(workflow, role);
    const result = f.run();
    expect(result.status, result.error).toBe(0);
    const plan = JSON.parse(result.output);
    expect(plan.isolation).toBe('shared');
    expect(plan.artifactScope).toEqual(f.scope);
  });
  const unrelated = [...new Set(Object.values(reportWorkflows).flat())].filter((role) => !roles.includes(role));
  test.each([...unrelated, 'axstack-owner', 'axstack-author', 'axstack-reviewer-primary',
    'axstack-checker', 'axstack-explore-codebase', 'axstack-advisor-custom'])(
    `${workflow} rejects unrelated seat %s`, (role) => {
      expect(() => recommend(report(workflow, role).input, NOW)).toThrow('request-schema');
    });
  test.each(['spec', 'tickets', 'scout', 'debug', 'implement', 'review', 'verify', 'watch',
    'correct', 'cleanup', 'voa', 'anatomy', 'perf'])(`${workflow} authority cannot alias unsupported %s`, (unsupported) => {
    const f = report(workflow, roles[0]);
    expect(recommend(f.input, NOW).selected).not.toBeNull();
    f.scope.workflow = unsupported;
    expect(() => recommend(f.input, NOW)).toThrow('request-schema');
  });
}

test.each(Object.keys(reportWorkflows))('%s never waives null-repo engineering or local ownership', (workflow) => {
  const role = reportWorkflows[workflow][0];
  for (const change of [
    (f) => { f.input.request.role = 'author'; },
    (f) => { delete f.input.request.scope; },
    (f) => { f.scope.artifactRoot = f.scope.workspaceRoot; },
    (f) => { f.scope.reservedRoots = [f.scope.evidenceRoot]; },
  ]) {
    const f = report(workflow, role);
    expect(recommend(f.input, NOW).selected).not.toBeNull();
    change(f);
    expect(() => recommend(f.input, NOW)).toThrow('request-schema');
  }
  const f = report(workflow, role);
  expect(recommend(f.input, NOW).selected).not.toBeNull();
  f.scope.environmentId = 'env-worker-a';
  expect(recommend(f.input, NOW).selected).toBeNull();
});

// Inherited audits retain the parent workflow, never its advice consultation.
test.each(['axstack-auditor', 'axstack-auditor-sol'])('advice cannot alias parent audit %s', (role) => {
  const f = report('brainstorm', role);
  expect(recommend(f.input, NOW).selected).not.toBeNull();
  f.scope.workflow = 'advice';
  expect(() => recommend(f.input, NOW)).toThrow('request-schema');
});
