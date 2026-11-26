export const WORKFLOW_T3_FLOOR = '0.1.12';
export const CONFORMANCE_SUITE = 1;
const NAME = /^[A-Za-z0-9_][\w.-]*$/;
const DIGEST = /^[a-f0-9]{64}$/;
const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-[\w.-]+)?$/;

export function supportsWorkflowT3(version) {
  const parts = VERSION.exec(version)?.slice(1).map(Number);
  if (!parts || version.startsWith(WORKFLOW_T3_FLOOR + '-')) return false;
  const floor = WORKFLOW_T3_FLOOR.split('.').map(Number);
  for (const [index, value] of parts.entries()) {
    const observed = Number.isInteger(value) ? value : 0;
    if (observed !== floor[index]) return observed > floor[index];
  }
  return true;
}

export function matchesWorkflowConformance(receipt, version, environment) {
  return receipt?.version === version && receipt.suite === CONFORMANCE_SUITE &&
    receipt.status === 'pass' && receipt.environment === environment;
}

export function validateWorkflowManifest(json) {
  if (json?.version !== 1 || !json.workflows || typeof json.workflows !== 'object' || Array.isArray(json.workflows)) {
    throw new Error('workflow manifest has an unsupported format');
  }
  for (const [key, record] of Object.entries(json.workflows)) {
    const [name, version] = key.split('@');
    if (!NAME.test(name) || !/^[1-9]\d*$/.test(version) || key !== name + '@' + version ||
        !DIGEST.test(record?.digest) || !DIGEST.test(record?.bindingDigest) ||
        typeof record?.binding !== 'string' || !record.binding.startsWith('/')) {
      throw new Error('workflow manifest has an invalid record');
    }
  }
  return json;
}
