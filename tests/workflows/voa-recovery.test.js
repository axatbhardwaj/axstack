import { expect, test } from 'bun:test';
import { evaluate } from '../../skills/voa/scripts/evaluate.js';
import { diagnostic, editWait, fixture, key, later, message, owner, thread, waitRecord } from './voa-fixtures.js';

const recovery = (input) => evaluate(input, 'recovery');
const none = (input) => expect(recovery(input).continuations).toEqual([]);

test('1: missing diagnosis produces one bounded diagnostic preview, preserving downstream human gates', () => {
  for (const gate of ['none', 'user-merge', 'npm-stage', 'human-review']) {
    const input = fixture();
    diagnostic(input);
    thread(input).humanGate = gate;
    thread(input).touchesAuthCode = true;
    const before = JSON.stringify(input);
    const result = recovery(input);
    expect(result.continuations).toHaveLength(1);
    expect(result.continuations[0]).toMatchObject({ key, reason: 'missing-diagnosis', target: owner });
    expect(result.continuations[0].message).toBe('Revalidate; act only within your existing authorized next action.');
    expect(JSON.stringify(input)).toBe(before);
    expect(result.owners[0].humanGate).toBe(gate);
  }
});

test('2: the same historical condition after snooze receives no continuation', () => {
  const input = fixture(); diagnostic(input);
  editWait(input, (record) => { record.snoozeUntil = later; });
  none(input);
  editWait(input, (record) => { record.snoozeUntil = null; });
  thread(input).snoozeUntil = later;
  none(input);
});

test('3: named upstream still open remains blocked with exact dependency evidence', () => {
  const input = fixture();
  thread(input).blocker.state = 'open';
  const result = recovery(input);
  expect(result.continuations).toEqual([]);
  expect(result.owners[0].classification).toBe('external-dependency');
  expect(result.owners[0].terms).toContainEqual(expect.objectContaining({ term: 'named-condition', state: 'fail', evidence: 'forge:merged-1' }));
});

test('4: cleared dependency gets one preview; same condition/head/restart/native event cannot resend', () => {
  const input = fixture();
  expect(recovery(input).continuations).toHaveLength(1);
  for (const outcome of ['accepted', 'queued', 'running', 'ambiguous']) {
    const replay = structuredClone(input);
    replay.deliveryHistory.entries.push({ key, outcome, id: 'native:delivery-1', evidence: 'native:receipt-1' });
    editWait(replay, (record) => { record.dependency.head = 'different-sha'; record.lastMeaningfulProgress.evidence = 'native:revalidated'; });
    none(JSON.parse(JSON.stringify(replay)));
  }
  input.deliveryHistory.entries.push({ key: [...key.slice(0, 2), 'different-condition'], outcome: 'accepted', id: 'prior', evidence: 'native:prior' });
  expect(recovery(input).continuations).toHaveLength(1);
});

test('5: completed snapshots and owner closing blocks cannot redo implementation', () => {
  const input = fixture();
  thread(input).completed = true;
  expect(recovery(input).owners[0].classification).toBe('completed-cleanup');
  none(input);
  thread(input).completed = false;
  const record = waitRecord(); record.recordType = 'closing'; record.outcome = 'completed';
  record.evidence = ['native:closed']; record.cleanup = [];
  thread(input).messages.push(message(record));
  none(input);
});

test('6: pending approvals, credentials and user questions have no diagnosis exception', () => {
  const mutations = [
    (row) => { row.pendingRequests = 1; }, (row) => { row.parkedUserReply = true; },
    ...['credentials', 'session', 'pairing', 'permission', 'new-thread'].map((gate) => (row) => { row.humanGate = gate; }),
    (row) => { row.requestsKnown = false; },
  ];
  for (const mutate of mutations) { const input = fixture(); diagnostic(input); mutate(thread(input)); none(input); }
  const input = fixture();
  editWait(input, (record) => { record.waitKind = 'human-approval'; record.diagnosis = 'none'; });
  none(input); // A human gate alone is never a specific nonhuman diagnostic.
});

test('7: active workers/children, unknown activity, failures, held queues and pause take precedence', () => {
  for (const mutate of [
    (row) => { row.run = 'running'; }, (row) => { row.run = 'waiting'; },
    (row) => { row.run = 'failed'; }, (row) => { row.run = 'interrupted'; },
    (row) => { row.run = 'future-status'; }, (row) => { row.childActivity = 'active'; },
    (row) => { row.childActivity = 'unknown'; }, (row) => { row.queue.held = true; },
    (row) => { row.paused = true; }, (row) => { row.paused = null; },
  ]) { const input = fixture(); mutate(thread(input)); none(input); }
  const input = fixture(); input.ownership[0].role = 'Worker'; none(input);
  input.ownership[0].role = 'Driver';
  editWait(input, (record) => { record.pause = true; }); none(input);
});

test('8: only a current native owner-authored complete record and exact ownership can register', () => {
  for (const mutate of [
    (input) => { input.ownership = []; }, (input) => { input.ownership[0].topLevel = false; },
    (input) => { input.ownership[0].owner = { ...owner, environmentId: 'other' }; },
    (input) => { input.ownership[0].authorityEvidence = 'native:other'; },
    (input) => { thread(input).messages[0].role = 'tool'; },
    (input) => { thread(input).messages[0].role = 'user'; },
    (input) => { thread(input).messages[0].source = 'user-paste'; },
    (input) => { thread(input).messages[0].author = { ...owner, threadId: 'other' }; },
    (input) => { thread(input).messages.push({ ...message(waitRecord()), text: 'Later activity without fresh wait' }); },
    (input) => { thread(input).historyKnown = false; },
    (input) => { thread(input).queue.known = false; },
    (input) => { input.deliveryHistory.known = false; },
    (input) => { editWait(input, (record) => { record.schemaVersion = 2; }); },
    (input) => { editWait(input, (record) => { delete record.diagnosis; }); },
    (input) => { editWait(input, (record) => { record.owner.threadId = 'other'; }); },
  ]) { const input = fixture(); mutate(input); none(input); }
});

test('real closing wire without dependency remains reportable in recovery', () => {
  const input = fixture();
  const closing = { schemaVersion: 1, recordType: 'closing', conditionId: 'upstream-1',
    owner, outcome: 'completed', diagnosis: 'resolved', evidence: ['native:closed'],
    authority: { scope: 'accepted-run', evidence: 'native:authority' },
    nextAction: { action: 'none', mode: 'none', evidence: 'native:closed' },
    wake: { mechanism: 'none', id: null, scope: 'upstream-1' },
    lifetime: { scope: 'run', expiresAt: '2026-10-31T12:00:00Z' }, cleanupOwner: owner, cleanup: [] };
  const closed = structuredClone(thread(input));
  closed.messages = [message(closing)];
  delete closed.blocker;
  const result = recovery({ ...input, hosts: input.hosts.map((host) =>
    host.host === 'axat-vps' ? { ...host, threads: [closed] } : host) });
  expect(result.owners[0].classification).toBe('completed-cleanup');
  expect(result.continuations).toEqual([]);
});

for (const state of ['queued', 'running', 'delivered', 'completed', 'failed', 'cancelled']) {
  for (const field of ['queue', 'wakeDeliveries']) {
    test(`restart receipt gap suppresses same-key ${field} ${state}`, () => {
      const input = fixture();
      const items = field === 'queue' ? thread(input).queue.items : thread(input).wakeDeliveries;
      items.push({ key, state, id: 'native:delivery' });
      none(JSON.parse(JSON.stringify(input)));
      items[0].key = [...key.slice(0, 2), 'another-condition'];
      expect(recovery(input).continuations).toHaveLength(1);
    });
  }
}

test('unknown run and zoneless snooze cannot enable recovery', () => {
  const input = fixture(); thread(input).run = null; none(input);
  for (const zone of ['', 'Z', '+05:30']) {
    const snoozed = fixture();
    editWait(snoozed, (record) => { record.snoozeUntil = `2026-10-31T12:05:00${zone}`; });
    none(snoozed);
  }
});

test('a later silent run invalidates the previous run wait block', () => {
  const input = fixture();
  thread(input).latestRunId = 'native:run-2';
  none(input);
  thread(input).messages[0].runId = 'native:run-2';
  expect(recovery(input).continuations).toHaveLength(1);
  delete thread(input).latestRunId; none(input);
  thread(input).latestRunId = 'native:run-2';
  delete thread(input).messages[0].runId; none(input);
});

test('zone-less expired snooze is unknown rather than silently interpreted locally', () => {
  const input = fixture();
  editWait(input, (record) => { record.snoozeUntil = '2026-10-29T12:05:00'; });
  none(input);
});
