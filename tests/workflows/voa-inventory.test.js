import { expect, test } from 'bun:test';
import { collectInventory } from '../../skills/voa/references/native-inventory.js';

const pr = 'https://github.com/axatbhardwaj/axstack/pull/710';
const env = (host) => `env-${host}`;
const link = (host, status = 'reachable') => ({ label: host, environmentId: env(host), status });
const wrap = (structuredContent) => ({ structuredContent, content: [], isError: false });
const page = (threads = [], nextCursor = null, total = threads.length) => wrap({ threads, total, nextCursor });
const row = (host, id, extra = {}) => ({
  threadId: id, projectId: 'project', latestRunId: `run-${id}`,
  link: `[title](t3-thread://v2/${env(host)}/${id})`, title: 'title',
  status: 'completed', updatedAt: '2000-01-01T01:00:00Z', settled: true, snoozed: false,
  blockedOnThreadWait: false, pendingBackgroundTasks: [], pullRequests: [], linkedPullRequest: null,
  model: 'unused-provider-metadata', ...extra,
});
const inputs = (links, listThreads, opts) => ({
  localHost: 'iobox', listLinks: async () => wrap({ environmentId: env('iobox'), links }),
  listThreads, timeoutMs: 1000, ...opts,
});
const lookup = (hosts, host) => hosts.find((result) => result.host === host);

test('a slow first page does not block a sibling from following its own cursor', async () => {
  const io = Promise.withResolvers();
  const calls = [];
  const hosts = await collectInventory(inputs([link('io'), link('iosatellite'), link('axat-vps', 'unreachable')],
    async (args) => {
      calls.push(args);
      if (args.environmentId === env('io')) return io.promise;
      if (args.environmentId === env('iobox') && args.cursor === undefined) {
        return page([row('iobox', 'owner-1')], 1, 2);
      }
      if (args.environmentId === env('iobox') && args.cursor === 1) {
        io.resolve(page([row('io', 'owner-3')]));
        return page([row('iobox', 'owner-2')], null, 2);
      }
      return page();
    }));
  expect(calls).toEqual([
    { environmentId: env('io'), allProjects: true, includeSubagents: false, limit: 8 },
    { environmentId: env('iobox'), allProjects: true, includeSubagents: false, limit: 8 },
    { environmentId: env('iosatellite'), allProjects: true, includeSubagents: false, limit: 8 },
    { environmentId: env('iobox'), allProjects: true, includeSubagents: false, limit: 8, cursor: 1 },
  ]);
  expect(hosts.map(({ host, coverage, threads }) => [host, coverage, threads.map((t) => t.threadId)])).toEqual([
    ['io', 'complete', ['owner-3']], ['iobook', 'unknown', []], ['iobox', 'complete', ['owner-1', 'owner-2']],
    ['iosatellite', 'complete', []], ['axat-vps', 'unknown', []],
  ]);
  expect(lookup(hosts, 'axat-vps')).toMatchObject({ environmentId: env('axat-vps'), gaps: ['unreachable'] });
});

test('page cap, bad cursors, later failures and no readable page have distinct coverage', async () => {
  const hosts = await collectInventory(inputs([link('io'), link('iobook'), link('iosatellite'), link('axat-vps')],
    async ({ environmentId, cursor }) => {
      if (environmentId === env('axat-vps')) throw Error('private error');
      if (environmentId === env('iosatellite')) return { ...page(), isError: true };
      const host = environmentId.slice(4);
      if (cursor === undefined) return page([row(host, 'first')], 1, 4);
      if (host === 'iobook') return page([row(host, 'second')], 1, 4);
      if (host === 'io') return { ...page(), isError: true };
      return page([row(host, 'second')], 2, 4);
    }));
  expect(hosts.map(({ coverage, threads, total, nextCursor, gaps }) => [
    coverage, threads.length, total, nextCursor, gaps,
  ])).toEqual([
    ['partial', 1, 4, 1, ['page-error']], ['partial', 2, 4, null, ['cursor-invalid']],
    ['partial', 2, 4, 2, ['page-limit']], ['unknown', 0, null, null, ['page-error']],
    ['unknown', 0, null, null, ['page-error']],
  ]);
  expect(JSON.stringify(hosts)).not.toContain('private error');
});

test('a missing local identity, ambiguous links and changing inventory stay explicit', async () => {
  const conflicting = [link('io'), { ...link('iobook'), environmentId: env('io') }];
  const hosts = await collectInventory(inputs([...conflicting, link('iosatellite', 'expired')],
    async ({ environmentId, cursor }) => {
      expect(environmentId).toBe(env('iobox'));
      if (cursor === undefined) return page([row('iobox', 'same')], 1, 2);
      return page([row('iobox', 'same'), row('iobox', 'new', { link: null })], null, 3);
    }));
  expect(lookup(hosts, 'iobox')).toMatchObject({ coverage: 'partial', total: null, threads: [
    { threadId: 'same' }, { threadId: 'new', link: null, title: 'title' },
  ] });
  expect(lookup(hosts, 'iobox').gaps).toEqual(expect.arrayContaining(['inventory-changed', 'duplicate-thread', 'missing-link']));
  expect(lookup(hosts, 'io').gaps).toEqual(['link-ambiguous']);
  expect(lookup(hosts, 'iobook').gaps).toEqual(['link-ambiguous']);
  expect(lookup(hosts, 'iosatellite').gaps).toEqual(['expired']);

  const other = await collectInventory(inputs([link('io')], async () => page(), { localHost: null }));
  expect(lookup(other, 'iobox')).toMatchObject({ environmentId: null, coverage: 'unknown' });
  expect(lookup(other, 'io').coverage).toBe('complete');
});

test('the compact projection preserves native owner and PR links and flags evidence for deeper reads', async () => {
  const active = row('iobox', 'active', {
    status: 'waiting', settled: false, snoozed: true, snoozedUntil: '2026-11-25T02:00:00Z',
    blockedOnThreadWait: true, linkedPullRequest: { url: pr, repository: 'axatbhardwaj/axstack' },
    pendingBackgroundTasks: [{ taskId: 'task', kind: 'subagent', childThreadId: 'child', awaited: true,
      description: 'unused-background-description' }],
  });
  const hosts = await collectInventory(inputs([], async () => page([
    active,
    row('iobox', 'idle', { status: 'idle', settled: false }),
    row('iobox', 'failed', { status: 'failed' }),
    row('iobox', 'queued', { status: 'queued' }),
    row('iobox', 'stale', { status: 'running' }),
    row('iobox', 'unknown', { status: 'custom', pendingBackgroundTasks: undefined }),
  ])));
  const threads = lookup(hosts, 'iobox').threads;
  expect(threads[0]).toMatchObject({
    threadId: 'active', link: active.link,
    status: 'waiting', updatedAt: active.updatedAt, settled: false, snoozed: true,
    snoozedUntil: active.snoozedUntil, blockedOnThreadWait: true, prs: [pr],
    tasks: [{ taskId: 'task', kind: 'subagent', childThreadId: 'child', awaited: true }],
  });
  expect(threads.map(({ flags }) => flags)).toEqual([
    ['waiting', 'background-task'], ['unsettled-idle'], ['failed-run'], ['queued-run'], ['stale-run'], ['activity-unknown'],
  ]);
  expect(JSON.stringify(hosts)).not.toMatch(/unused-provider-metadata|unused-background-description/);
  expect(threads[0]).not.toHaveProperty('projectId');
  expect(threads[0]).not.toHaveProperty('latestRunId');
  expect(threads[0]).not.toHaveProperty('title');
});

test('the wall-clock limit preserves completed siblings even when a native request never returns', async () => {
  const stalled = new Promise(() => {});
  const hosts = await collectInventory(inputs([link('io'), link('iobook')], async ({ environmentId, cursor }) => {
    if (environmentId === env('io') || cursor === 1) return stalled;
    if (environmentId === env('iobox')) return page([row('iobox', 'first')], 1, 2);
    return page();
  }, { timeoutMs: 25 }));
  expect(lookup(hosts, 'iobook')).toMatchObject({ coverage: 'complete', gaps: [] });
  expect(lookup(hosts, 'io')).toMatchObject({ coverage: 'unknown', gaps: ['deadline'] });
  expect(lookup(hosts, 'iobox')).toMatchObject({ coverage: 'partial', gaps: ['deadline'], threads: [{ threadId: 'first' }] });
});
