import { term, timestamp, word } from './health-runs.mjs';

const PROBE = 'axstack-load-probe';
const PROBE_WINDOW = 60 * 60 * 1000;

export function journalPolicy(policy, journal, name, version) {
  if (policy?.kind !== 'scheduled' || !word(policy.triggerId)) return policy;
  const triggerId = policy.triggerId;
  if (!triggerId.startsWith(name + '/') || !Array.isArray(journal?.runs)) {
    return { ...policy, slots: null, slotsComplete: false };
  }
  const first = timestamp(policy.firstDueAt);
  const prefix = 'trigger:' + triggerId + ':';
  const slots = journal.runs.filter((run) => run?.workflow === name && run.version === version &&
      typeof run.idempotencyKey === 'string' && run.idempotencyKey.startsWith(prefix))
    .filter((run) => !(timestamp(run.scheduledAt) < first))
    .map((run) => ({
      runId: run.runId,
      scheduledAt: run.parentRunId === null && run.idempotencyKey === prefix + run.scheduledAt ? run.scheduledAt : null,
      startedAt: run.startedAt ?? null,
    }));
  return { ...policy, slots, slotsComplete: journal.complete === true };
}

export function journalRegistration(host, name, version, policy, slot, now) {
  if (host.reachable !== true) return null;
  const journal = host.journal;
  if (!Array.isArray(journal?.runs)) return null;
  const serverStart = timestamp(host.t3?.startedAt);
  if (name === PROBE) {
    const minimum = Math.max(now - PROBE_WINDOW, Number.isFinite(serverStart) ? serverStart : 0);
    const receipt = journal.runs.find((run) => {
      const start = timestamp(run?.startedAt);
      const end = timestamp(run?.endedAt);
      return run?.workflow === name && run.version === version && run.status === 'completed' &&
        typeof run.idempotencyKey === 'string' && run.idempotencyKey.startsWith('axstack-watchdog-') &&
        run.probeWorkflow === name + '@' + version && run.binding === 'pass' && word(run.runId) &&
        start >= minimum && end >= start && end <= now;
    });
    if (receipt) return term('pass', { runId: receipt.runId, reason: 'fresh native load-probe receipt' });
  }
  const triggerId = policy?.triggerId;
  if (slot.status === 'pass' && word(triggerId) && Array.isArray(journal.triggers)) {
    const trigger = journal.triggers.find((row) => row?.triggerId === triggerId && Number.isFinite(timestamp(row.nextAt)));
    const prefix = 'trigger:' + triggerId + ':';
    const laterVersion = journal.runs.some((run) => run?.workflow === name && run.version > version &&
      typeof run.idempotencyKey === 'string' && run.idempotencyKey.startsWith(prefix) &&
      timestamp(run.startedAt) >= timestamp(slot.evidence.startedAt));
    if (trigger && !laterVersion && !(timestamp(slot.evidence.startedAt) < serverStart)) {
      return term('pass', { triggerId, nextAt: trigger.nextAt, runId: slot.evidence.runId,
        reason: 'native trigger and current exact-version slot' });
    }
  }
  return null;
}
