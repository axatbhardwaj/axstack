import { expect, test } from 'bun:test';
import { evaluate } from '../../skills/voa/scripts/evaluate.js';
import { editWait, fixture, key, later, owner, thread } from './voa-fixtures.js';

const recovery = (input) => evaluate(input, 'recovery');
const none = (input) => expect(recovery(input).continuations).toEqual([]);

test('9: five-host coverage reports unknowns and finite budgets never assume unseen owners idle', () => {
  const input = fixture();
  input.hosts[0].reachable = false;
  input.hosts[1].paginationComplete = false;
  const result = recovery(input);
  expect(result.coverage.filter((row) => row.state === 'unknown').map((row) => row.term)).toEqual(['io', 'iobook']);
  expect(result.coverage.map((row) => row.term)).toContain('iosatellite');
  input.budget.maxOwners = 1;
  input.hosts[2].threads = [structuredClone(thread(input)), structuredClone(thread(input))];
  const bounded = recovery(input);
  expect(bounded.owners).toHaveLength(1);
  expect(bounded.coverage.at(-1).state).toBe('unknown');
  expect(bounded.continuations).toEqual([]);
  input.at = later;
  expect(recovery(input).owners).toEqual([]);
  const over = fixture(); over.budget.maxOwners = 1;
  over.hosts[4].threads.push({ ...structuredClone(thread(over)), threadId: 'unprocessed' });
  const partial = recovery(over);
  expect(partial.continuations).toEqual([]);
  expect(partial.cursor).toEqual({ processedOwners: 1, next: { host: 'axat-vps', rowIndex: 1 } });
});

test('12: status cannot activate recovery; queued wakes suppress but unfired registrations do not', () => {
  const input = fixture();
  expect(evaluate(input).continuations).toEqual([]);
  expect(recovery(input).continuations).toHaveLength(1); // armed watch only
  editWait(input, (record) => { record.nextEligibleCheck = later; }); none(input);
  editWait(input, (record) => { record.nextEligibleCheck = input.at; });
  for (const state of ['queued', 'running']) {
    thread(input).wakeDeliveries = [{ id: 'native:wake-1', key, state }]; none(input);
    thread(input).wakeDeliveries = [];
    thread(input).queue.items = [{ id: 'native:queue-1', key, state, source: 'schedule' }]; none(input);
    thread(input).queue.items = [];
  }
  for (const mutate of [
    (data) => { data.recovery.trigger.source = 'agent'; },
    (data) => { data.recovery.trigger.mode = 'status'; },
    (data) => { data.recovery.expiresAt = data.at; },
    (data) => { data.recovery.idempotencyVerified = false; },
    (data) => { data.recovery.scopeExclusive = false; },
    (data) => { data.recovery.schedule = { id: 'unbound' }; },
  ]) { const data = fixture(); mutate(data); none(data); }
  const cross = fixture();
  const remote = { ...owner, host: 'io', environmentId: 'env-io', threadLink: 't3-thread://v2/env-io/driver' };
  editWait(cross, (record) => { record.owner = remote; record.cleanupOwner = remote; });
  const remoteThread = thread(cross);
  remoteThread.threadLink = remote.threadLink; remoteThread.messages[0].author = remote;
  cross.hosts[0].threads = [remoteThread]; cross.hosts[4].threads = [];
  cross.ownership[0].owner = remote;
  none(cross);
  cross.edges = [{ from: cross.recovery.owner, to: remote, c4Installed: true, writeVerified: true,
    expiresAt: cross.recovery.expiresAt, evidence: 'native:directed-edge' }];
  expect(recovery(cross).continuations).toHaveLength(1);
  cross.edges[0].expiresAt = cross.at; none(cross);
  cross.edges[0].expiresAt = cross.recovery.expiresAt; cross.edges[0].c4Installed = false; none(cross);
});
