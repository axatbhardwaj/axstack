import { expect, test } from 'bun:test';
import { evaluate } from '../../skills/voa/scripts/evaluate.js';
import { fixture, recoveryOwner } from './voa-fixtures.js';

function cleanupFixture(reason) {
  const input = fixture();
  const own = { id: 'recovery-schedule', owner: recoveryOwner, scope: 'accepted-run',
    kind: 'schedule', lifetime: 'run', title: 'Recovery', evidence: 'native:creation' };
  input.recovery.schedule = { ...own, bindingVerified: true, expiresAt: input.recovery.expiresAt };
  input.cleanup = { owner: recoveryOwner, scope: 'accepted-run', reason, authorized: true,
    authorityEvidence: 'native:cleanup-authority', inventoryKnown: true,
    openRegistrationsKnown: true, openRegistrations: [],
    resources: [own, { ...own, id: 'same-title-different-id' },
      { ...own, id: 'other-owner', owner: { ...recoveryOwner, threadId: 'someone-else' } }],
    messages: [
      { id: 'own-duplicate', owner: recoveryOwner, scope: 'accepted-run', source: 'schedule',
        scheduleId: own.id, duplicate: true, evidence: 'native:queue' },
      { id: 'user-message', owner: recoveryOwner, scope: 'accepted-run', source: 'user',
        scheduleId: own.id, duplicate: true, evidence: 'native:user-message' },
    ],
    readback: { known: true, scheduleIds: [], messageIds: ['user-message'], evidence: 'native:absence' },
  };
  return input;
}

test('10: completion/cancellation/expiry plans exact owned IDs and proves absence without altering input', () => {
  for (const reason of ['completed', 'cancelled', 'expired', 'empty', 'handoff']) {
    const input = cleanupFixture(reason);
    if (reason === 'expired') input.recovery.expiresAt = input.at;
    const before = JSON.stringify(input);
    const result = evaluate(input, 'cleanup');
    expect(result.continuations).toEqual([]);
    expect(result.cleanup).toMatchObject({ scheduleIds: ['recovery-schedule'], messageIds: ['own-duplicate'] });
    expect(result.cleanup.scheduleIds).toEqual(['recovery-schedule']);
    expect(result.cleanup.messageIds).toEqual(['own-duplicate']);
    expect(result.cleanup.preserveIds).toEqual(['same-title-different-id', 'other-owner', 'user-message']);
    expect(result.cleanup.terms).toContainEqual({ term: 'schedule-absent:recovery-schedule', state: 'pass', evidence: 'native:absence' });
    expect(JSON.stringify(input)).toBe(before);
  }
  const uncertain = cleanupFixture('completed');
  uncertain.cleanup.readback.known = false;
  expect(evaluate(uncertain, 'cleanup').cleanup.terms).toContainEqual(expect.objectContaining({ term: 'schedule-absent:recovery-schedule', state: 'unknown' }));
  uncertain.cleanup.inventoryKnown = false;
  expect(evaluate(uncertain, 'cleanup').cleanup.scheduleIds).toEqual([]);
  expect(evaluate(uncertain, 'status').cleanup).toBeNull();
  expect(evaluate(uncertain, 'recovery').cleanup).toBeNull();
  const nonempty = cleanupFixture('empty'); nonempty.cleanup.openRegistrations = ['upstream-1'];
  expect(evaluate(nonempty, 'cleanup').cleanup.scheduleIds).toEqual([]);
});

test('11: closing one registration preserves the shared service and every other registration', () => {
  const input = cleanupFixture('completed');
  const service = { ...input.cleanup.resources[0], id: 'shared-service', lifetime: 'shared', registrations: ['accepted-run', 'other-run'] };
  input.cleanup.resources = [service];
  input.recovery.schedule.id = service.id;
  const before = JSON.stringify(service);
  const result = evaluate(input, 'cleanup');
  expect(result.cleanup).toMatchObject({ scheduleIds: [], messageIds: [] });
  expect(result.cleanup.scheduleIds).toEqual([]);
  expect(result.cleanup.messageIds).toEqual([]);
  expect(result.cleanup.preserveIds).toContain('shared-service');
  expect(JSON.stringify(service)).toBe(before);
});

test('cleanup requires explicit scope even when all absent scopes match', () => {
  const input = cleanupFixture('completed');
  delete input.recovery.scope; delete input.recovery.schedule.scope; delete input.cleanup.scope;
  for (const item of [...input.cleanup.resources, ...input.cleanup.messages]) delete item.scope;
  expect(evaluate(input, 'cleanup').cleanup).toMatchObject({ scheduleIds: [], messageIds: [] });
});
