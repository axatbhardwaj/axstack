export const at = '2026-10-30T12:00:00Z';
export const later = '2026-10-30T12:10:00Z';
export const expiry = '2026-10-31T12:00:00Z';
export const owner = { host: 'axat-vps', environmentId: 'env-vps', threadId: 'driver', threadLink: 't3-thread://v2/env-vps/driver' };
export const recoveryOwner = { ...owner, threadId: 'recovery', threadLink: 't3-thread://v2/env-vps/recovery' };
export const key = ['axat-vps', 'driver', 'upstream-1'];

export function waitRecord() {
  return {
    schemaVersion: 1, recordType: 'waiting-turn', conditionId: 'upstream-1', waitKind: 'external-dependency',
    diagnosis: 'blocked upstream', dependency: { kind: 'upstream-pr', id: 'https://github.com/example/repo/pull/1', evidence: ['forge:pr-1'] },
    owner, lastMeaningfulProgress: { at: '2026-10-30T11:00:00Z', evidence: 'native:progress' },
    authority: { scope: 'accepted-run', evidence: 'native:authority' },
    nextAction: { action: 'Revalidate and continue existing work', mode: 'read-only', evidence: 'native:action' },
    wake: { mechanism: 'native-event', id: 'watch-1', scope: 'upstream-1' },
    nextEligibleCheck: at, pause: false, snoozeUntil: null,
    lifetime: { scope: 'run', expiresAt: expiry }, cleanupOwner: owner,
  };
}

export function message(record, role = 'assistant') {
  return { id: 'native:message-1', source: 'native', role, author: owner, text: `Waiting.\n\n\
\`\`\`json\n${JSON.stringify(record)}\n\`\`\`` };
}

export function fixture() {
  const record = waitRecord();
  return {
    schemaVersion: 1, at, collectedAt: at, budget: { maxOwners: 20, maxMessages: 100, deadlineAt: later },
    hosts: ['io', 'iobook', 'iobox', 'iosatellite', 'axat-vps'].map((host) => ({
      host, environmentId: host === 'axat-vps' ? 'env-vps' : `env-${host}`,
      reachable: true, paginationComplete: true, evidence: `native:inventory-${host}`,
      threads: host === 'axat-vps' ? [{
        threadId: owner.threadId, threadLink: owner.threadLink, title: 'Driver', project: 'example',
        branch: 'feature', prs: [record.dependency.id], updatedAt: '2026-10-30T11:00:00Z', run: 'completed',
        pendingRequests: 0, requestsKnown: true, childActivity: 'none', paused: false, snoozeUntil: null,
        parkedUserReply: false, humanGate: 'none', completed: false, historyKnown: true,
        queue: { known: true, held: false, items: [] }, wakeDeliveries: [], messages: [message(record)],
        blocker: { ...record.dependency, state: 'cleared', nonHuman: true, inspectedAt: at, evidence: 'forge:merged-1' },
      }] : [],
    })),
    ownership: [{ owner, role: 'Driver', topLevel: true, scope: 'accepted-run',
      authorityEvidence: 'native:authority', nextActionEvidence: ['native:action'] }],
    deliveryHistory: { known: true, entries: [] }, edges: [],
    recovery: { scope: 'accepted-run', owner: recoveryOwner, existingThread: true,
      trigger: { source: 'user', mode: 'recovery', scope: 'accepted-run', evidence: 'native:invocation' },
      model: 'example-model', effort: 'high', expiresAt: expiry, canaryEvidence: 'native:canary',
      scopeExclusive: true, idempotencyVerified: true, deliveryReadbackVerified: true,
      cleanupOwner: recoveryOwner, schedule: null },
  };
}

export const thread = (input) => input.hosts.find((host) => host.host === 'axat-vps').threads[0];
export function editWait(input, change) {
  const record = JSON.parse(thread(input).messages.at(-1).text.split('```json\n')[1].split('\n```')[0]);
  change(record);
  thread(input).messages = [message(record)];
}
export function diagnostic(input) {
  editWait(input, (record) => { record.diagnosis = 'none'; record.waitKind = 'own-pr-ci-review'; });
  thread(input).blocker.state = 'unexplained';
}
