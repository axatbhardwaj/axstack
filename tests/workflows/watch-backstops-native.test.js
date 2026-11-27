import { expect, test } from 'bun:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';

const harness = new URL('./watch-backstops-engine.js', import.meta.url).pathname;
const shipped = new URL('../../skills/axstack/workflows/entries/axstack-watch-backstops.mjs', import.meta.url).pathname;

function replay(scenario = {}) {
  // Missing registration is observable in the prior package. The engine runs
  // the real registered entry once it exists, without a test-only entry point.
  if (!existsSync(shipped)) return { result: { decision: 'unregistered' } };
  const dir = mkdtempSync((process.env.TMPDIR ?? '/tmp') + '/axstack-watch-backstops-');
  try {
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== 'T3CODE_HOME'));
    const run = Bun.spawnSync([process.execPath, harness, shipped, dir, JSON.stringify(scenario)], { env, timeout: 20_000 });
    expect(run.stderr.toString()).toBe('');
    expect(run.exitCode).toBe(0);
    return JSON.parse(run.stdout.toString());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('wakes exactly the bound idle owner for hourly PR activity', () => {
  const replayed = replay();
  expect(replayed.result).toMatchObject({ decision: 'complete' });
  expect(replayed.agents).toEqual([{
    at: '2026-11-27T00:00:05.000Z',
    options: { thread: { threadId: replayed.ownerId },
      brief: `AXSTACK-WAKE axstack-watch-backstops@1 run ${replayed.runId}\nOwner ${replayed.ownerId} slot 1` },
    queue: 'started',
  }]);
  expect(replayed.triggers ?? []).toEqual([]);
});

test('a native binding with omitted default options matches an empty recorded option set', () => {
  const replayed = replay({ emptyOptions: true });
  expect(replayed.result.decision).toBe('complete');
  expect(replayed.agents).toHaveLength(1);
});

test('queues one backstop behind an unrelated busy owner turn', () => {
  const replayed = replay({ busy: true });
  expect(replayed.agents).toHaveLength(1);
  expect(replayed.agents[0].queue).toBe('queued');
});

test('runs four anchored timers with the native 5- and 60-minute wake cadence', () => {
  const replayed = replay({ cadence: true, rounds: 3 });
  expect(replayed.slots.map(({ due }) => due)).toEqual([['writer', 'recovery'], ['writer', 'recovery'], ['watch', 'autopilot']]);
  expect(replayed.agents.map(({ at }) => at)).toEqual([
    '2026-11-27T00:05:05.000Z', '2026-11-27T00:10:05.000Z', '2026-11-27T01:00:05.000Z',
  ]);
  expect(replayed.result.decision).toBe('complete');
});

test('after a 3h17m outage, one catch-up advances each timer to its latest due slot', () => {
  const replayed = replay({ outage: true, rounds: 2 });
  expect(replayed.slots.map(({ due, consumed }) => ({ due, consumed }))).toEqual([
    { due: ['watch', 'writer'], consumed: { watch: Date.parse('2026-11-27T03:00Z'), writer: Date.parse('2026-11-27T03:15Z') } },
    { due: ['writer'], consumed: { watch: Date.parse('2026-11-27T03:00Z'), writer: Date.parse('2026-11-27T03:20Z') } },
  ]);
  expect(replayed.agents.map(({ at }) => at)).toEqual(['2026-11-27T03:17:05.000Z', '2026-11-27T03:20:05.000Z']);
});

test('one claimed slot accepts a T3 resend after a failed owner turn and keeps the writer cadence', () => {
  const replayed = replay({ delivery: 'resend', rounds: 3 });
  expect(replayed.result.decision).toBe('complete');
  expect(replayed.agents.map(({ at }) => at)).toEqual([
    '2026-11-27T00:00:05.000Z', '2026-11-27T00:05:05.000Z', '2026-11-27T00:10:05.000Z',
  ]);
  expect(replayed.readbacks.map(({ observedMessages }) => observedMessages)).toEqual([2, 1, 1]);
});

test('two matching T3 messages without the exact slot claim cannot pass readback', () => {
  const replayed = replay({ guard: 'readback-claim-lost' });
  expect(replayed.result).toMatchObject({ decision: 'paused', step: 'wake-readback-1',
    reason: 'wake slot claim is unavailable or has another owner' });
  expect(replayed.agents).toHaveLength(1);
  expect(replayed.readbacks).toEqual([]);
});

test('readback rejects a claim for a different run with the same slot number', () => {
  const replayed = replay({ guard: 'readback-run-changed' });
  expect(replayed.result).toMatchObject({ decision: 'paused', step: 'wake-readback-1',
    reason: 'wake slot claim is unavailable or has another owner' });
  expect(replayed.agents).toHaveLength(1);
  expect(replayed.readbacks).toEqual([]);
});

for (const delivery of ['foreign-thread', 'agent-copy', 'non-server-copy']) {
  test('readback rejects same-text delivery with ' + delivery, () => {
    const replayed = replay({ delivery });
    expect(replayed.result).toMatchObject({ decision: 'paused', step: 'wake-readback-1',
      reason: 'wake delivery could not be read back' });
    expect(replayed.agents).toHaveLength(1);
    expect(replayed.readbacks).toEqual([]);
  });
}

for (const [guard, gap] of [
  ['owner-status-unknown', 'native owner status is unknown'],
  ['owner-queue-gap', 'native owner run coverage is unavailable'],
]) {
  test(`${guard} wakes with the gap even when a native event is present`, () => {
    const replayed = replay({ guard, native: 'simultaneous' });
    expect(replayed.result.decision).toBe('complete');
    expect(replayed.slots).toEqual([expect.objectContaining({ decision: 'wake', gap })]);
    expect(replayed.agents).toHaveLength(1);
  });
}

for (const status of ['parked', 'user-stopped', 'complete']) {
  test(`${status}: stop the run cleanly without waking`, () => {
    const replayed = replay({ status });
    expect(replayed.result.decision).toBe(status);
    expect(replayed.agents).toEqual([]);
  });
}

test('a native PR event arriving with the timer is the only wake', () => {
  for (const shadow of [true, false]) {
    const replayed = replay({ native: 'simultaneous', shadow });
    expect(replayed.slots).toEqual([expect.objectContaining({ decision: 'native', activity: 'pass' })]);
    expect(replayed.nativeEvents).toBe(1);
    expect(replayed.agents).toEqual([]);
  }
});

test('a parked owner with a native input request ends without delivery', () => {
  const replayed = replay({ status: 'parked', guard: 'owner-request' });
  expect(replayed.result.decision).toBe('parked');
  expect(replayed.agents).toEqual([]);
});

test('an old native event cannot consume a new slot', () => {
  const replayed = replay({ native: 'old' });
  expect(replayed.slots).toEqual([expect.objectContaining({ decision: 'wake', activity: 'fail' })]);
  expect(replayed.agents).toHaveLength(1);
});

test('caption text cannot create a native PR event', () => {
  const replayed = replay({ native: 'forged' });
  expect(replayed.slots).toEqual([expect.objectContaining({ decision: 'wake' })]);
  expect(replayed.agents).toHaveLength(1);
});

test('unknown activity coverage wakes with a fixed gap in the run and an IDs-only brief', () => {
  const replayed = replay({ activityGap: true });
  expect(replayed.slots).toEqual([expect.objectContaining({
    decision: 'wake', activity: 'unknown', gap: 'native PR message coverage is unavailable',
  })]);
  expect(replayed.agents).toHaveLength(1);
  expect(replayed.agents[0].options.brief.split('\n')).toEqual([
    `AXSTACK-WAKE axstack-watch-backstops@1 run ${replayed.runId}`, `Owner ${replayed.ownerId} slot 1`,
  ]);
});

test('shadow records would-wake and activity gaps without starting or queuing an agent', () => {
  const replayed = replay({ shadow: true, activityGap: true });
  expect(replayed.slots).toEqual([expect.objectContaining({ decision: 'wake', activity: 'unknown' })]);
  expect(replayed.agents).toEqual([]);
});

const guards = {
  'manifest-not-private': /private binding/,
  'binding-drift': /private binding/,
  'unsafe-path': /private binding/,
  'binding-not-private': /private binding/,
  'wrong-host': /local host/,
  'excluded-host': /local host/,
  'unsafe-owner': /identity/,
  'unsafe-run': /identity/,
  'receipt-missing': /owner receipt/,
  'wrong-receipt-owner': /owner receipt/,
  'unsafe-receipt-state': /owner receipt/,
  'missing-timer': /owner receipt/,
  'future-receipt': /owner receipt/,
  'owner-missing': /owner evidence/,
  'owner-archived': /archived/,
  'owner-protected': /protected/,
  'owner-request': /protected/,
  'owner-held-queue': /protected/,
  'owner-id-mismatch': /owner evidence/,
  'provider-mismatch': /binding/,
  'model-mismatch': /binding/,
  'options-mismatch': /binding/,
  'runtime-mismatch': /binding/,
  'project-mismatch': /binding/,
  'rpc-gap': /binding/,
  'receipt-binding-changed': /recorded owner binding/,
  'claim-conflict': /already has an active backstop/,
  'claim-raced': /already has an active backstop/,
  'prior-run-gap': /prior backstop state/,
  'slot-claim-lost': /wake slot claim/,
  'slot-claim-invalid': /wake slot claim/,
};

for (const [guard, reason] of Object.entries(guards)) {
  test(`guard ${guard} pauses the entry before any delivery`, () => {
    const replayed = replay({ guard });
    expect(replayed.result).toMatchObject({ decision: 'paused', reason: expect.stringMatching(reason) });
    expect(replayed.result.step).toBeString();
    expect(replayed.agents).toEqual([]);
  });
}

test('a terminal predecessor permits a new run after readback', () => {
  const replayed = replay({ prior: 'cancelled' });
  expect(replayed.result.decision).toBe('complete');
  expect(replayed.agents).toHaveLength(1);
});

test('an ambiguous delivery pauses without resending and a readback proves one delivery', () => {
  const ambiguous = replay({ delivery: 'missing' });
  expect(ambiguous.result).toMatchObject({ decision: 'paused', reason: expect.stringMatching(/wake delivery/) });
  expect(ambiguous.agents).toHaveLength(1);
  const accepted = replay({ delivery: 'ambiguous' });
  expect(accepted.result.decision).toBe('complete');
  expect(accepted.agents).toHaveLength(1);
});

test('delivery readback pauses when the owner binding changed during the wake', () => {
  const replayed = replay({ delivery: 'binding-changed' });
  expect(replayed.result).toMatchObject({ decision: 'paused', reason: expect.stringMatching(/binding/) });
  expect(replayed.agents).toHaveLength(1);
});

test('the owner can park while handling a delivered wake', () => {
  const replayed = replay({ delivery: 'parks' });
  expect(replayed.result.decision).toBe('parked');
  expect(replayed.agents).toHaveLength(1);
});

test('parking during native arbitration cancels the pending delivery', () => {
  const replayed = replay({ duringArbitration: 'parked' });
  expect(replayed.result.decision).toBe('parked');
  expect(replayed.agents).toEqual([]);
});
