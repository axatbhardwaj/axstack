import { identity, instant, normalize, pointer, sameKey, sameOwner, term, validKey } from './observations.js';
import { condition, currentRecord } from './records.js';
import { cleanupPlan } from './cleanup.js';

function activation(input, at) {
  const r = input.recovery;
  const trigger = r?.trigger;
  const schedule = r?.schedule;
  const validSchedule = schedule === null || (pointer(schedule?.id) && sameOwner(schedule.owner, r?.owner)
    && schedule.scope === r?.scope && schedule.bindingVerified === true && pointer(schedule.evidence)
    && instant(schedule.expiresAt) && Date.parse(schedule.expiresAt) > at
    && Date.parse(schedule.expiresAt) <= Date.parse(r?.expiresAt));
  return [
    term('explicit-mode', ['user', 'authorized-schedule'].includes(trigger?.source)
      && trigger.mode === 'recovery' && trigger.scope === r?.scope && pointer(trigger.evidence) ? 'pass' : 'unknown',
    trigger?.evidence ?? 'no explicit recovery invocation'),
    term('recovery-binding', identity(r?.owner) && r.owner.host === 'axat-vps' && r.existingThread === true
      && identity(r.cleanupOwner) && pointer(r.scope) && validSchedule
      && (trigger?.source !== 'authorized-schedule' || schedule !== null) ? 'pass' : 'unknown',
    schedule?.evidence ?? 'existing recovery-thread binding'),
    term('activation-proof', pointer(r?.canaryEvidence) && pointer(r?.model) && pointer(r?.effort)
      && r.scopeExclusive === true && r.idempotencyVerified === true && r.deliveryReadbackVerified === true ? 'pass' : 'unknown',
    r?.canaryEvidence ?? 'missing canary/model/effort/exclusivity/delivery proof'),
    term('recovery-lifetime', instant(r?.expiresAt) && Date.parse(r.expiresAt) > at ? 'pass' : 'fail',
      r?.expiresAt ?? 'unknown expiry'),
  ];
}

function ownerTerms(input, row, record, at, base) {
  const raw = row.raw;
  const matches = (Array.isArray(input.ownership) ? input.ownership : []).filter((entry) => sameOwner(entry.owner, row.owner));
  const accepted = matches.length === 1 ? matches[0] : null;
  const key = record ? [row.owner.host, row.owner.threadId, record.conditionId] : null;
  const reason = condition(record, raw.blocker, at);
  const history = input.deliveryHistory;
  const prior = Array.isArray(history?.entries) ? history.entries.filter((entry) => sameKey(entry.key, key)) : [];
  const deliveryKnown = (entry) => pointer(entry?.id) && validKey(entry.key)
    && ['queued', 'running', 'delivered', 'completed', 'cancelled', 'failed'].includes(entry.state);
  const queueKnown = raw.queue?.known === true && raw.queue.held === false && Array.isArray(raw.queue.items)
    && raw.queue.items.every(deliveryKnown);
  const wakesKnown = Array.isArray(raw.wakeDeliveries) && raw.wakeDeliveries.every(deliveryKnown);
  const historyKnown = history?.known === true && Array.isArray(history.entries)
    && history.entries.every((entry) => pointer(entry?.id) && validKey(entry.key) && pointer(entry.evidence)
      && ['accepted', 'queued', 'running', 'ambiguous'].includes(entry.outcome));
  const queued = queueKnown && raw.queue.items.some((entry) => sameKey(entry.key, key));
  const waking = wakesKnown && raw.wakeDeliveries.some((entry) => sameKey(entry.key, key));
  const sameHost = input.recovery?.owner?.host === row.owner.host;
  const edge = (Array.isArray(input.edges) ? input.edges : []).find((entry) => sameOwner(entry.from, input.recovery?.owner)
    && sameOwner(entry.to, row.owner) && entry.c4Installed === true && entry.writeVerified === true
    && instant(entry.expiresAt) && Date.parse(entry.expiresAt) > at && pointer(entry.evidence));
  const temporal = record?.recordType === 'waiting-turn' && record.pause === false
    && (record.snoozeUntil === null || Date.parse(record.snoozeUntil) <= at)
    && raw.paused === false && (raw.snoozeUntil === null || (instant(raw.snoozeUntil) && Date.parse(raw.snoozeUntil) <= at))
    && Date.parse(record.lifetime.expiresAt) > at && Date.parse(record.lastMeaningfulProgress.at) <= at;
  const gates = ['none', 'user-merge', 'npm-stage', 'human-review'];
  return { key, reason, terms: [
    ...base,
    term('host-inventory', row.inventoryKnown ? 'pass' : 'unknown', row.owner.host),
    term('current-record', record ? 'pass' : 'unknown', record?.conditionId ?? 'missing/stale/untrusted/incomplete record'),
    term('accepted-owner', accepted?.topLevel === true && ['Coordinator', 'Driver'].includes(accepted.role)
      && accepted.scope === record?.authority.scope && accepted.scope === input.recovery?.scope
      && accepted.authorityEvidence === record?.authority.evidence && pointer(accepted.authorityEvidence)
      && Array.isArray(accepted.nextActionEvidence) && accepted.nextActionEvidence.includes(record?.nextAction.evidence) ? 'pass' : 'unknown',
    accepted?.authorityEvidence ?? 'unknown or delegated owner'),
    term('idle-owner', row.state === 'idle' && raw.childActivity === 'none' && raw.completed === false ? 'pass' : 'unknown',
      `run=${raw.run}; children=${raw.childActivity}; completed=${raw.completed}`),
    term('human-guards', raw.requestsKnown === true && raw.pendingRequests === 0 && raw.parkedUserReply === false
      && record?.wake.mechanism !== 'user-reply'
      && gates.includes(raw.humanGate) ? 'pass' : 'unknown', `pending=${raw.pendingRequests}; gate=${raw.humanGate}`),
    term('pause-lifetime', temporal ? 'pass' : 'fail', record?.lifetime.expiresAt ?? 'unknown pause/expiry'),
    term('queue-known', queueKnown && wakesKnown ? 'pass' : 'unknown', 'native queue/held state and wake deliveries'),
    term('history-known', raw.historyKnown === true && historyKnown ? 'pass' : 'unknown',
      'owner and recovery receipt history'),
    term('condition-dedupe', prior.length === 0 ? 'pass' : 'fail', prior[0]?.evidence ?? 'no prior same-key delivery in saved history'),
    term('wake-precedence', record && (record.nextEligibleCheck === null || Date.parse(record.nextEligibleCheck) <= at)
      && !queued && !waking ? 'pass' : 'fail', 'next eligible check and same-key observed delivery'),
    term('directed-edge', sameHost ? 'n/a' : edge ? 'pass' : 'unknown', sameHost ? 'same-host' : edge?.evidence ?? 'missing installed C4/directed C5 proof'),
    term('named-condition', reason && (raw.humanGate === 'none' || reason === 'missing-diagnosis') ? 'pass' : 'fail',
      raw.blocker?.evidence ?? record?.dependency?.id ?? 'no inspected specific nonhuman condition'),
  ] };
}

function classify(row, record, at) {
  if (row.raw.completed === true || record?.recordType === 'closing') return 'completed-cleanup';
  if (row.state === 'working' || row.raw.childActivity === 'active') return 'active-worker';
  if (row.state === 'failed') return 'failed-interrupted';
  if (row.raw.paused === true || record?.pause === true
    || (instant(row.raw.snoozeUntil) && Date.parse(row.raw.snoozeUntil) > at)
    || (instant(record?.snoozeUntil) && Date.parse(record.snoozeUntil) > at)) return 'explicit-pause';
  if (row.state === 'needs-you' || row.raw.parkedUserReply === true) return 'human-approval';
  if (row.state === 'unknown' || row.raw.childActivity !== 'none') return 'unknown';
  return record?.waitKind ?? 'unknown';
}

export function evaluate(input, mode = 'status') {
  if (!['status', 'recovery', 'cleanup'].includes(mode)) throw Error('unknown mode');
  const saved = normalize(input);
  const result = { schemaVersion: 1, mode, coverage: saved.coverage, cursor: saved.cursor,
    owners: [], continuations: [], cleanup: null };
  if (mode === 'cleanup') result.cleanup = cleanupPlan(input);
  const base = mode === 'recovery' ? activation(input, saved.at) : [];
  for (const row of saved.threads) {
    const record = currentRecord(row.raw, row.owner, input.budget.maxMessages);
    const classification = classify(row, record, saved.at);
    const { raw, inventoryKnown, ...status } = row;
    const facts = { ...status, humanGate: raw.humanGate ?? 'unknown', classification,
      terms: [term('activity-known', row.state !== 'unknown' && ['none', 'active'].includes(raw.childActivity)
        && raw.requestsKnown === true ? 'pass' : 'unknown', `native run=${raw.run}; children=${raw.childActivity}`)] };
    if (mode === 'recovery') {
      const checked = ownerTerms(input, row, record, saved.at, base);
      facts.terms = checked.terms;
      if (classification !== 'completed-cleanup' && checked.reason
        && checked.terms.every((entry) => ['pass', 'n/a'].includes(entry.state))) {
        result.continuations.push({ key: checked.key, target: row.owner, reason: checked.reason,
          evidence: [record.authority.evidence, record.nextAction.evidence, raw.blocker.evidence],
          message: 'Revalidate; act only within your existing authorized next action.' });
      }
    }
    result.owners.push(facts);
  }
  return result;
}
