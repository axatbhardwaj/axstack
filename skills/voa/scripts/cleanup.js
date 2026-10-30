import { identity, pointer, sameOwner, term } from './observations.js';

export function cleanupPlan(input) {
  const c = input.cleanup;
  const schedule = input.recovery?.schedule;
  const bound = c?.authorized === true && pointer(c.authorityEvidence) && identity(c.owner)
    && sameOwner(c.owner, input.recovery?.owner) && pointer(c.scope) && c.scope === input.recovery?.scope
    && ['completed', 'cancelled', 'expired', 'empty', 'handoff'].includes(c.reason)
    && (c.reason !== 'empty' || c.openRegistrationsKnown === true
      && Array.isArray(c.openRegistrations) && c.openRegistrations.length === 0);
  const known = bound && c.inventoryKnown === true && Array.isArray(c.resources) && Array.isArray(c.messages);
  const result = { scheduleIds: [], messageIds: [], preserveIds: [], terms: [
    term('cleanup-binding', bound ? 'pass' : 'unknown', c?.authorityEvidence ?? 'unknown owned cleanup authority'),
    term('cleanup-inventory', known ? 'pass' : 'unknown', 'native exact-ID resource and queue inventory'),
  ] };
  for (const resource of (Array.isArray(c?.resources) ? c.resources : [])) {
    const owned = known && resource.kind === 'schedule' && resource.lifetime === 'run'
      && pointer(resource.id) && resource.id === schedule?.id && schedule.bindingVerified === true
      && sameOwner(schedule.owner, c.owner) && schedule.scope === c.scope && pointer(schedule.evidence)
      && sameOwner(resource.owner, c.owner) && resource.scope === c.scope && pointer(resource.evidence);
    (owned ? result.scheduleIds : result.preserveIds).push(resource.id);
  }
  for (const message of (Array.isArray(c?.messages) ? c.messages : [])) {
    const owned = known && pointer(message.id) && sameOwner(message.owner, c.owner) && message.scope === c.scope
      && message.source === 'schedule' && message.duplicate === true && pointer(message.evidence)
      && result.scheduleIds.includes(message.scheduleId);
    (owned ? result.messageIds : result.preserveIds).push(message.id);
  }
  // Readback is evidence only. The helper performs no deletion or queue edit.
  for (const [ids, field, label] of [[result.scheduleIds, 'scheduleIds', 'schedule'], [result.messageIds, 'messageIds', 'message']]) {
    for (const id of ids) {
      const readback = c?.readback;
      const knownReadback = readback?.known === true && Array.isArray(readback[field]) && pointer(readback.evidence);
      result.terms.push(term(`${label}-absent:${id}`, !knownReadback ? 'unknown'
        : readback[field].includes(id) ? 'fail' : 'pass', readback?.evidence ?? 'absence not read back'));
    }
  }
  return result;
}
