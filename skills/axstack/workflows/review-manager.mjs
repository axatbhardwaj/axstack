import { createHash } from 'node:crypto';

export const workflowName = 'axstack-review-manager';
export const version = 1;
export const managerIdentity = `${workflowName}@${version}`;
export const interval = 1_800_000;
export const busy = ['preparing', 'queued', 'starting', 'running', 'waiting'];
export const reviewId = (value) => typeof value === 'string' && /^[A-Za-z0-9_][A-Za-z0-9:_%.-]{0,511}$/.test(value);
export const repository = (value) => typeof value === 'string' &&
  /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value);
export const prId = (value) => {
  if (typeof value !== 'string') return false;
  const [repo, number, ...rest] = value.split('#');
  return !rest.length && repository(repo) && /^[1-9]\d*$/.test(number);
};
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const time = (value) => typeof value === 'string' && /T\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) ?
  Date.parse(value) : NaN;
export const inSlot = (observedAt, scheduledAt) => Math.abs(time(observedAt) - time(scheduledAt)) <= interval;

export function importState(progress) {
  if (typeof progress !== 'string') return null;
  const headings = [...progress.matchAll(/^## (.+)$/gm)].map((line) => line[1]);
  if (headings.join('/') !== 'Lane state/Open holds/Watermarks/Last pass') return null;
  const lane = progress.split('## Open holds\n')[0];
  const owner = /^- scheduledTaskId, threadId\/runId, workspace and exact terminal receipt: ([^,]+), ([^/\s,]+)\/([^,]+), ([^,]+), (.+)$/m.exec(lane);
  if (!owner || !reviewId(owner[1]) || !reviewId(owner[2]) || !reviewId(owner[3]) ||
      !/^- Active PR jobs and descendants: .+$/m.test(lane) || !/^- Quiet gate: .+$/m.test(progress) ||
      !/^- Last full pass: .+$/m.test(progress)) return null;
  const current = /^- Current pass identity: \S+ (\S+) /m.exec(lane)?.[1];
  const unresolved = progress.split('## Watermarks\n')[0];
  const flagged = [...unresolved.matchAll(/^- (\S+): (?:flagged|held)\b/gm)].map((line) => line[1]).filter(reviewId);
  return {
    progress, sourceSha: hash(progress), prior: owner[2], schedule: owner[1],
    owners: [...new Set([owner[2], current].filter(reviewId))], flagged: [...new Set(flagged)].sort(),
  };
}

const quietTerms = [
  'observations', 'continuity', 'identity', 'reap', 'discovery', 'pr-list', 'full-pass-age',
  'thread-readbacks', 'ownership', 'prior-pass', 'lane-idle', 'pending-work',
];

export function decide({ discovery, inventory, reap, facts }, scheduledAt) {
  const reasons = [];
  if (!inSlot(inventory.observedAt, scheduledAt)) reasons.push('slot-observation:unknown');
  if (inventory.coverage !== 'pass') reasons.push('project-coverage:unknown');
  if (discovery.status !== 'pass') reasons.push('safe-6:unknown');
  if (reap.exitCode !== 0 || reap.dockerAvailable !== true) {
    reasons.push(Number.isInteger(reap.exitCode) && typeof reap.dockerAvailable === 'boolean' ? 'reap:fail' : 'reap:unknown');
  }
  if (inventory.flagged.some((row) => row.status === 'reply')) reasons.push('flagged-reply');
  if (inventory.flagged.some((row) => row.status === 'unknown')) reasons.push('flagged-history:unknown');
  const prior = inventory.prior?.thread;
  const ownerUpdatedAt = inventory.ownerUpdatedAt ?? (busy.includes(prior?.status) ? prior.updatedAt : null);
  if (time(inventory.observedAt) - time(ownerUpdatedAt) >= 4 * interval) {
    reasons.push('wedged-owner');
  }
  if (facts?.version !== 2 || !Array.isArray(facts.terms) || facts.terms.length !== quietTerms.length) {
    reasons.push('quiet-facts:unknown');
  } else {
    for (const term of quietTerms) {
      const found = facts.terms.filter((fact) => fact.id === term);
      const status = found.length === 1 ? found[0].status : null;
      if (status !== 'pass') reasons.push(term + ':' + (status === 'fail' ? 'fail' : 'unknown'));
    }
  }
  return [...new Set(reasons)];
}

export function brief(runId, state, prs, flagged) {
  const lines = [
    `AXSTACK-WAKE ${managerIdentity} run ${runId}`,
    '',
    'Follow the Workflow report section of the installed review-manager-prompt.md. Use read-only tools and submit the typed receipt.',
    `Continuity store key: ${managerIdentity}:continuity`,
    `Import digest: ${state.sourceSha}`,
    `Prior manager: ${state.prior}`,
    `Flagged threads: ${flagged.map((row) => row.id).filter(reviewId).join(', ')}`,
    `Observed PRs: ${[...new Set(prs.filter(prId))].sort().join(', ')}`,
  ];
  return lines.join('\n');
}

export function receiptMatches(result, runId, state) {
  const receipt = result?.value;
  return result?.outcome === 'done' && receipt?.kind === 'AXSTACK-REVIEW-MANAGER' &&
    receipt.runId === runId && receipt.sourceSha === state.sourceSha && reviewId(receipt.threadId) &&
    receipt.threadId === result.thread?.threadId;
}
