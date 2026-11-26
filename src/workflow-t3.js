import { readFileSync } from 'node:fs';
import { meetsFloor } from './capabilities.js';
import { join } from './posixpath.js';

export const WORKFLOW_T3_FLOOR = '0.1.12';
export const CONFORMANCE_SUITE = 1;
const TERMINAL = new Set(['completed', 'stopped', 'skipped', 'cancelled']);

export function matchesWorkflowConformance(receipt, version, environment) {
  return receipt?.version === version && receipt.suite === CONFORMANCE_SUITE &&
    receipt.status === 'pass' && receipt.environment === environment;
}

export function workflowT3Version(t3) {
  const check = Bun.spawnSync([t3, '--version'], { timeout: 10_000 });
  const version = /^t3 v(\d+\.\d+\.\d+(?:-[\w.-]+)?)$/.exec(check.stdout.toString().trim())?.[1];
  if (check.exitCode !== 0 || !version || !meetsFloor(version, WORKFLOW_T3_FLOOR) ||
      version.startsWith(WORKFLOW_T3_FLOOR + '-')) {
    throw new Error(`workflow activation requires T3 >= ${WORKFLOW_T3_FLOOR}`);
  }
  return version;
}

export function t3Environment(base) {
  const environment = readFileSync(join(base, 'userdata/environment-id'), 'utf8').trim();
  if (!environment) throw new Error('T3 environment identity is missing');
  return environment;
}

export function requireRunningT3Version(base, version) {
  const { serverVersion } = JSON.parse(readFileSync(join(base, 'userdata/server-runtime.json'), 'utf8'));
  if (serverVersion !== version) throw new Error('running T3 server version differs from the local CLI; complete the T3 update');
}

export function workflowCommand(t3, base, verb, ...args) {
  const result = Bun.spawnSync([t3, 'workflow', verb, '--base-dir', base, '--json', ...args], {
    timeout: 10_000, stderr: 'pipe',
  });
  if (result.exitCode !== 0) throw new Error(`T3 workflow ${verb} failed; check server availability and workflow registration`);
  try {
    return JSON.parse(result.stdout.toString());
  } catch {
    throw new Error(`T3 workflow ${verb} returned unreadable JSON`);
  }
}

export function requireDrained(t3, base, name, version) {
  for (const status of ['running', 'waiting', 'paused']) {
    const runs = workflowCommand(t3, base, 'list', '--status', status);
    if (!Array.isArray(runs)) throw new Error('T3 workflow run inventory is unreadable');
    for (const run of runs) {
      if (typeof run?.workflow !== 'string' || !Number.isSafeInteger(run.version)) {
        throw new Error('T3 workflow run inventory is unreadable');
      }
      if (run.workflow === name && run.version === version && !TERMINAL.has(run.status)) {
        throw new Error(`${name}@${version} has a ${run.status ?? 'unknown'} run (${run.runId ?? 'unknown'}); drain or cancel it in T3 first`);
      }
    }
  }
}

export async function requireProbe(t3, base, name, version) {
  const identity = name + '@' + version;
  const { run } = workflowCommand(t3, base, 'start', name, '--key', 'axstack-opt-in-' + crypto.randomUUID(), '--input', 'null');
  if (run?.workflow !== name || run.version !== version || typeof run.runId !== 'string') {
    throw new Error(`T3 registration differs from expected ${identity}`);
  }
  const deadline = Date.now() + 15_000;
  let observed = run;
  while (observed?.status === 'running' && Date.now() < deadline) {
    await Bun.sleep(150);
    observed = workflowCommand(t3, base, 'show', run.runId).run;
  }
  if (observed?.runId !== run.runId || observed.workflow !== name || observed.version !== version ||
      observed.status !== 'completed' || observed.result?.workflow !== identity || observed.result.binding !== 'pass') {
    if (observed?.runId === run.runId && !TERMINAL.has(observed.status)) {
      workflowCommand(t3, base, 'cancel', run.runId);
    }
    throw new Error(`T3 registration/load probe did not complete with a valid binding for ${identity}`);
  }
}
