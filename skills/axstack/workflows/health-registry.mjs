import { readWorkflowRpc } from '../scripts/t3-workflow-read.js';

export async function workflowRegistry(origin, tokenPath) {
  const snapshot = await readWorkflowRpc(origin, tokenPath, 'workflows.subscribe', { changes: true });
  return Array.isArray(snapshot?.workflows) ? { workflows: snapshot.workflows, definition: snapshot.definition } : null;
}
