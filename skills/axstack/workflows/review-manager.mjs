import { createHash } from 'node:crypto';

export const workflowName = 'axstack-review-manager';
export const version = 2;
export const managerIdentity = `${workflowName}@${version}`;
export const interval = 1_800_000;
export const triggerId = `${workflowName}/every:${interval}`;
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
  if (!owner || !(reviewId(owner[1]) || owner[1] === triggerId) || !reviewId(owner[2]) || !reviewId(owner[3]) ||
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

function reapStatus(reap) {
  if (!Number.isInteger(reap.exitCode) || typeof reap.dockerAvailable !== 'boolean') return 'unknown';
  return reap.exitCode === 0 && reap.dockerAvailable ? 'pass' : 'fail';
}

export function projectQuietFacts(report) {
  if (!Array.isArray(report?.terms)) return null;
  const holds = report.terms.find((term) => term?.id === 'pending-work')?.evidence?.holds;
  return {
    version: report.version,
    terms: report.terms.map((term) => ({ id: term?.id ?? null, status: term?.status ?? null })),
    ...(Array.isArray(holds) && { holdCount: holds.filter((row) => row !== '- none').length }),
  };
}

export function decide({ discovery, inventory, reap, facts }, scheduledAt) {
  const reasons = [];
  if (!inSlot(inventory.observedAt, scheduledAt)) reasons.push('slot-observation:unknown');
  if (inventory.coverage !== 'pass') reasons.push('project-coverage:unknown');
  if (discovery.status !== 'pass') reasons.push('safe-6:unknown');
  const reapFact = reapStatus(reap);
  if (reapFact !== 'pass') reasons.push('reap:' + reapFact);
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

export function reportFacts(runId, scheduledAt, state, { discovery, inventory, reap, facts }) {
  const terms = facts?.version === 2 && Array.isArray(facts.terms)
    ? facts.terms.filter((term) => quietTerms.includes(term.id)).map(({ id, status }) =>
      ({ id, status: status === 'pass' || status === 'fail' ? status : 'unknown' }))
    : [];
  return {
    runId, scheduledAt, observedAt: inventory.observedAt,
    coverage: {
      projects: inventory.coverage, readableProjects: inventory.readableProjects ?? null, discovery: discovery.status,
    },
    continuity: { sourceSha: state.sourceSha, prior: state.prior, schedule: state.schedule },
    holds: {
      count: facts?.version === 2 ? facts.holdCount ?? null : null,
      flagged: inventory.flagged.filter((row) => reviewId(row.id)).map((row) => ({ threadId: row.id, status: row.status })),
    },
    reap: {
      status: reapStatus(reap),
      exitCode: Number.isInteger(reap.exitCode) ? reap.exitCode : null,
      dockerAvailable: typeof reap.dockerAvailable === 'boolean' ? reap.dockerAvailable : null,
    },
    terms,
    prs: [...new Set(discovery.prs.filter(prId))].sort(),
  };
}
