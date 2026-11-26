import { expect, test } from 'bun:test';
import { operation, replay, runId, secondOperation, workflow } from './fleet-cleanup-fixture.js';

const claim = workflow + '@1:operation:' + operation;
const marker = `AXSTACK-WAKE ${workflow}@1 run ${runId}`;

test('quiet inventories the five hosts and wakes no agent', async () => {
  const { result, agents, commands, triggers } = await replay();
  expect(result).toEqual({ decision: 'quiet', items: [], gaps: [] });
  expect(agents).toEqual([]);
  expect(triggers).toEqual(['30 minutes']);
  expect(commands.filter((call) => call.binary === 'ssh')).toHaveLength(8);
  expect(commands.filter((call) => call.binary === 't3')).toHaveLength(1);
  expect(commands.filter((call) => call.binary === 'git')).toHaveLength(1);
  expect(commands.every((call) => !call.leaked)).toBe(true);
}, 12_000);

test('eligible item claims one operation and runs in the verified owner thread', async () => {
  const { result, agents, claims } = await replay({ eligible: true, olderPaused: true });
  expect(result).toMatchObject({ decision: 'complete', items: [operation], gaps: [] });
  expect(agents.map(({ name }) => name)).toEqual(['prepare-owner', 'cleanup-owner']);
  expect(agents[0].options).toMatchObject({
    model: { instanceId: 'codex', model: 'gpt-6.2-sol', options: [{ id: 'reasoningEffort', value: 'high' }] },
    runtimeMode: 'full-access',
  });
  expect(agents[1].options.thread).toEqual({ threadId: 'workflow:c5-replay' });
  expect(agents[1].options).not.toHaveProperty('model');
  for (const { options } of agents) {
    expect(options.brief.split('\n')[0]).toBe(marker);
    expect(options.brief).not.toContain('UNTRUSTED THREAD TITLE');
  }
  expect(agents[1].options.brief).toContain(operation);
  expect(claims[claim]).toBe(runId);
}, 12_000);

for (const [label, receiptTime] of [
  ['one second before the tick', '2026-11-26T23:59:59.000Z'],
  ['exactly one interval before the tick', '2026-11-26T23:30:00.000Z'],
]) {
  test(`a receipt captured ${label} keeps the item eligible`, async () => {
    const { result, agents, claims } = await replay({
      eligible: true, receiptTime,
      thread: { updatedAt: receiptTime },
      decision: { updatedAt: receiptTime },
    });
    expect(result).toMatchObject({ decision: 'complete', items: [operation], gaps: [] });
    expect(agents.map(({ name }) => name)).toEqual(['prepare-owner', 'cleanup-owner']);
    expect(claims[claim]).toBe(runId);
  }, 12_000);
}

for (const [label, scenario, gap] of [
  ['unreachable host', { offline: true }, 'iobox/host-unreachable'],
  ['partial list', { partial: true }, 'axat-vps/thread-coverage'],
  ['bare list', { bare: true }, 'axat-vps/thread-coverage'],
  ['missing descendants', { descendantGap: true }, 'axat-vps/thread-coverage'],
  ['missing project coverage', { projectGap: true }, 'iobook/project-coverage'],
  ['unreadable Git', { gitGap: true }, 'axat-vps/worktrees'],
  ['receipt older than one interval', { receiptTime: '2026-11-26T23:29:59.999Z' }, 'fleet/receipt'],
  ['future-dated receipt', { receiptTime: '2026-11-27T00:00:00.001Z' }, 'fleet/receipt'],
  ['invalid predecessor format', { legacy: true }, 'fleet/receipt'],
  ['unfinished continuity', { snoozes: [{}] }, 'fleet/continuity'],
  ...['accepted', 'descendantsClear', 'ownership', 'preserved', 'protectionClear'].map((guard) =>
    ['unproved ' + guard, { decision: { guards: { [guard]: false } } }, 'axat-vps/decision']),
  ['unknown pending tasks', { thread: { pendingBackgroundTasks: null } }, 'axat-vps/thread-coverage'],
  ['stale candidate revision', {
    receiptTime: '2026-11-26T23:59:59.000Z',
    thread: { updatedAt: '2026-11-26T23:59:59.500Z' },
    decision: { updatedAt: '2026-11-26T23:59:58.000Z' },
  }, 'axat-vps/decision'],
  ['invalid thread identity', { thread: { threadId: 'mcp:private id' } }, 'axat-vps/thread-coverage'],
  ['missing claimed worktree', { worktree: '/fixture/missing' }, 'axat-vps/worktree-identity'],
  ['moved worktree head', { worktree: '/fixture/topic', movedHead: true }, 'axat-vps/worktree-identity'],
  ['unproved published head', { worktree: '/fixture/topic', decision: { publishedHead: null } }, 'axat-vps/publication'],
  ['missing acceptance', { unrecorded: true }, 'axat-vps/decision'],
  ['unknown Git filter configuration', { worktree: '/fixture/topic', filterGap: true }, 'axat-vps/worktree-status'],
  ['nested checkout not inspected', { worktree: '/fixture/topic', submodule: true }, 'axat-vps/worktree-status'],
  ['unreadable worktree status', { worktree: '/fixture/topic', statusGap: true }, 'axat-vps/worktree-status'],
  ['unreadable publication', { worktree: '/fixture/topic', pushGap: true }, 'axat-vps/publication'],
]) {
  test(`${label} wakes a diagnostic agent only`, async () => {
    const { result, agents, claims } = await replay({ eligible: !scenario.unrecorded, ...scenario });
    expect(result).toMatchObject({ decision: 'unknown', items: [], gaps: expect.arrayContaining([gap]) });
    expect(agents.map(({ name }) => name)).toEqual(['report-gap']);
    expect(agents[0].options.brief.split('\n')[0]).toBe(marker);
    expect(agents[0].options.brief).toContain(gap);
    expect(agents[0].options.brief).not.toContain(operation);
    expect(claims).toEqual({});
  }, 12_000);
}

for (const [label, scenario] of [
  ['dirty worktree', { worktree: '/fixture/topic', dirty: true }],
  ['unpushed worktree', { worktree: '/fixture/topic', unpushed: true }],
  ['locked worktree', { worktree: '/fixture/topic', worktreeLock: true }],
  ['active thread', { thread: { activeRunId: 'active-run' } }],
  ['pending background task', { thread: { pendingBackgroundTasks: [{ taskId: 'known-task' }] } }],
  ['pending request', { thread: { pendingRequestCount: 1 } }],
  ['manual pin', { thread: { pinned: true } }],
  ['manual snooze', { thread: { snoozed: true } }],
  ['thread waiter', { thread: { blockedOnThreadWait: true } }],
  ['terminal failure', { thread: { status: 'failed' } }],
  ['user-owned thread', { thread: { createdBy: 'user' } }],
  ['archived thread', { thread: { archived: true } }],
]) {
  test(`${label} never enters a cleanup brief`, async () => {
    const { result, agents, claims } = await replay({ eligible: true, ...scenario });
    expect(result).toEqual({ decision: 'quiet', items: [], gaps: [] });
    expect(agents).toEqual([]);
    expect(claims).toEqual({});
  }, 12_000);
}

for (const [label, scenario, reason, expected] of [
  ['invalid workflow run ID', { runKey: 'invalid run ID' }, 'invalid cleanup run ID', []],
  ['missing private binding', { bindingGap: true }, 'private binding', []],
  ['another active run', { active: true }, 'earlier cleanup run is active', []],
  ['prior claim', { claim }, 'prior cleanup claim', []],
  ['unavailable catalog', { catalogGap: true }, 'owner binding', []],
  ['unavailable live catalog RPC', { rpcGap: true }, 'owner binding', []],
  ['owner thread from a different project', { ownerProjectId: '71710000-0000-4000-8000-000000000002' },
    'effective owner binding or transcript mismatched', ['prepare-owner']],
  ['catalog change after owner preparation', { catalogChangeAt: 2 }, 'effective owner binding changed', ['prepare-owner']],
  ['catalog change after cleanup turn', { catalogChangeAt: 3 },
    'effective owner binding changed', ['prepare-owner', 'cleanup-owner']],
  ['effective binding mismatch', { readbackMismatch: true }, 'effective owner binding', ['prepare-owner']],
  ['user takeover', { takenOver: true }, 'effective owner binding', ['prepare-owner']],
  ['cleanup agent hold', { workHold: true }, 'cleanup owner held', ['prepare-owner', 'cleanup-owner']],
]) {
  test(`${label} pauses the real entry`, async () => {
    const { result, agents } = await replay({ eligible: true, ...scenario });
    expect(result).toMatchObject({ decision: 'paused', detail: expect.stringContaining(reason) });
    expect(agents.map(({ name }) => name)).toEqual(expected);
  }, 12_000);
}

test('shadow replays an eligible decision without a claim or agent', async () => {
  const { result, agents, claims } = await replay({ eligible: true, shadow: true });
  expect(result).toEqual({ decision: 'eligible', items: [operation], gaps: [] });
  expect(agents).toEqual([]);
  expect(claims).toEqual({});
}, 12_000);

test('an unverified cleanup result pauses and retains its claim', async () => {
  const { result, agents, claims } = await replay({ eligible: true, missingReadback: true });
  expect(result).toMatchObject({ decision: 'paused', detail: expect.stringContaining('native cleanup readback') });
  expect(agents.map(({ name }) => name)).toEqual(['prepare-owner', 'cleanup-owner']);
  expect(claims[claim]).toBe(runId);
}, 12_000);

test('two eligible operations claim both and use one owner thread', async () => {
  const { result, agents, claims } = await replay({ eligible: true, second: true, worktree: '/fixture/topic' });
  expect(result).toMatchObject({ decision: 'complete', items: [operation, secondOperation] });
  expect(agents.map(({ name }) => name)).toEqual(['prepare-owner', 'cleanup-owner']);
  expect(claims).toEqual({ [claim]: runId, [workflow + '@1:operation:' + secondOperation]: runId });
}, 12_000);

test('a second-item duplicate pauses the batch before claiming the first item', async () => {
  const secondClaim = workflow + '@1:operation:' + secondOperation;
  const { result, agents, claims } = await replay({ eligible: true, second: true, claim: secondClaim });
  expect(result).toMatchObject({ decision: 'paused', detail: expect.stringContaining('prior cleanup claim') });
  expect(agents).toEqual([]);
  expect(Object.keys(claims)).toEqual([secondClaim]);
}, 12_000);

test('configured Git filters and fsmonitor are disabled for the status read', async () => {
  const { result, commands } = await replay({ eligible: true, worktree: '/fixture/topic', filter: true });
  expect(result.decision).toBe('complete');
  const status = commands.find(({ args }) => args.includes('status'));
  expect(status?.args).toEqual(expect.arrayContaining([
    '--no-optional-locks', 'core.fsmonitor=false', 'core.hooksPath=/dev/null',
    'filter.fixture.clean=', 'filter.fixture.process=', 'filter.fixture.required=false',
  ]));
}, 12_000);

test('an accepted archive requires a settled thread and reads back archival', async () => {
  const archive = operation.replace(/settle$/, 'archive');
  const { result, agents } = await replay({ eligible: true, thread: { settled: true }, decision: { action: 'archive' } });
  expect(result).toMatchObject({ decision: 'complete', items: [archive] });
  expect(agents[1].options.brief).toContain(archive);
}, 12_000);

test('an unsettled archive request never reaches a cleanup agent', async () => {
  const { result, agents } = await replay({ eligible: true, decision: { action: 'archive' } });
  expect(result).toEqual({ decision: 'unknown', items: [], gaps: ['axat-vps/decision'] });
  expect(agents.map(({ name }) => name)).toEqual(['report-gap']);
}, 12_000);

test('the shadow exposes host gaps without creating a diagnostic thread', async () => {
  const { result, agents, claims } = await replay({ eligible: true, offline: true, shadow: true });
  expect(result).toMatchObject({ decision: 'unknown', items: [], gaps: expect.arrayContaining(['iobox/host-unreachable']) });
  expect(agents).toEqual([]);
  expect(claims).toEqual({});
}, 12_000);
