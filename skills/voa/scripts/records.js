import { identity, instant, pointer, sameOwner } from './observations.js';

const text = (value) => typeof value === 'string' && value.trim().length > 0;
const referenceList = (value) => Array.isArray(value) && value.length > 0 && value.every(pointer);
const waitKinds = new Set(['active-worker', 'own-pr-ci-review', 'external-dependency', 'human-approval',
  'explicit-pause', 'failed-interrupted', 'completed-cleanup', 'unknown']);

export function currentRecord(thread, owner, maxMessages) {
  if (thread.historyKnown !== true || !Array.isArray(thread.messages) || thread.messages.length > maxMessages) return null;
  // Native roles and authorship are supplied by the caller, never reconstructed from text.
  const last = thread.messages.at(-1);
  if (last?.role !== 'assistant' || last.source !== 'native' || !sameOwner(last.author, owner) || !pointer(last.id)
    || !pointer(thread.latestRunId) || last.runId !== thread.latestRunId
    || typeof last.text !== 'string') return null;
  let record = null;
  for (const match of last.text.matchAll(/(?:^|\n)```json\s*\n([\s\S]*?)\n```(?=\n|$)/g)) {
    try { record = JSON.parse(match[1]); } catch { record = null; }
  }
  if (record?.schemaVersion !== 1 || !sameOwner(record.owner, owner) || !pointer(record.conditionId)
    || !text(record.diagnosis) || !text(record.authority?.scope) || !pointer(record.authority?.evidence)
    || !text(record.nextAction?.action) || !text(record.nextAction?.mode) || !pointer(record.nextAction?.evidence)
    || !text(record.wake?.mechanism) || !(record.wake.id === null || pointer(record.wake.id))
    || !text(record.wake.scope) || !text(record.lifetime?.scope) || !instant(record.lifetime.expiresAt)
    || !identity(record.cleanupOwner)) return null;
  if (record.recordType === 'closing') {
    return ['resolved', 'completed', 'cancelled', 'accepted-handoff'].includes(record.outcome)
      && referenceList(record.evidence) && Array.isArray(record.cleanup) ? record : null;
  }
  if (record.recordType !== 'waiting-turn' || !waitKinds.has(record.waitKind)
    || !text(record.dependency?.kind) || !pointer(record.dependency?.id) || !referenceList(record.dependency?.evidence)
    || !instant(record.lastMeaningfulProgress?.at) || !pointer(record.lastMeaningfulProgress?.evidence)
    || typeof record.pause !== 'boolean' || !(record.snoozeUntil === null || instant(record.snoozeUntil))
    || !(record.nextEligibleCheck === null || instant(record.nextEligibleCheck))) return null;
  return record;
}

export function condition(record, blocker, at) {
  if (record?.recordType !== 'waiting-turn' || !blocker
    || blocker.nonHuman !== true || blocker.kind !== record.dependency.kind || blocker.id !== record.dependency.id
    || !['check', 'review', 'upstream-pr', 'dependency'].includes(blocker.kind)
    || !pointer(blocker.evidence) || !instant(blocker.inspectedAt)
    || Date.parse(blocker.inspectedAt) > at || Date.parse(blocker.inspectedAt) < at - 1800000) return null;
  if (record.waitKind === 'external-dependency' && blocker.state === 'cleared') return 'dependency-cleared';
  if (['own-pr-ci-review', 'external-dependency', 'human-approval'].includes(record.waitKind)
    && record.diagnosis === 'none' && blocker.state === 'unexplained'
    && record.nextAction.mode === 'read-only') return 'missing-diagnosis';
  return null;
}
