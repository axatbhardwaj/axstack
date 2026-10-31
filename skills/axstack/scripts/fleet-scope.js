// Explicit artifact authority, separate from repository engineering authority.
const sourceRoles = ['axstack-research-requirements', 'axstack-research-code', 'axstack-research-code-sol',
  'axstack-explore-execution', 'axstack-explore-execution-sol',
  'axstack-research-web', 'axstack-research-web-sol', 'axstack-research-x', 'axstack-diligence'];
const articleRoles = ['axstack-explainer', 'axstack-explainer-review', 'axstack-ui-verifier', 'axstack-ui-verifier-sonnet'];
const brainstormRoles = ['axstack-advisor-astra', 'axstack-advisor-opus', 'axstack-arena-candidate-grok',
  'axstack-arena-judge-opus', 'axstack-escalation-fable', 'axstack-arena-judge-astra'];
const workflowRoles = { research: sourceRoles, explain: [...sourceRoles, ...articleRoles],
  publish: [...sourceRoles, ...articleRoles], brainstorm: brainstormRoles };
export const isArtifact = (request) => request?.scope?.kind === 'local-artifact';
const path = (value) => typeof value === 'string' && value.startsWith('/') && value !== '/'
  && !/[\s\x00-\x1f\x7f]/.test(value) && !value.slice(1).split('/').some((v) => ['', '.', '..'].includes(v));
export const inside = (value, root) => path(value) && path(root) && value.startsWith(`${root}/`);
const overlaps = (a, b) => a === b || inside(a, b) || inside(b, a);

export function validScope(request) {
  const s = request.scope;
  if (s === undefined) return typeof request.repositoryId === 'string' && request.repositoryId.trim().length > 0;
  if (s?.kind === 'repository') return typeof request.repositoryId === 'string' && request.repositoryId.trim().length > 0;
  if (!isArtifact(request) || request.repositoryId !== null || request.role !== 'reader'
    || !Object.hasOwn(workflowRoles, s.workflow) || !workflowRoles[s.workflow].includes(s.roleId)
    || ![s.environmentId, s.projectId].every((v) => typeof v === 'string' && v.trim().length > 0)
    || !inside(s.artifactRoot, s.workspaceRoot) || !inside(s.evidenceRoot, s.workspaceRoot)
    || overlaps(s.artifactRoot, s.evidenceRoot) || !Array.isArray(s.reservedRoots)
    || s.reservedRoots.some((root) => !path(root) || overlaps(root, s.artifactRoot) || overlaps(root, s.evidenceRoot))) return false;
  return true;
}
