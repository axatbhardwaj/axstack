import { expect, test } from 'bun:test';
import { decide } from '../../skills/axstack/scripts/default-policy.js';
import { readHub } from '../../skills/axstack/scripts/hub-usage.js';
import { fixture, now } from './default-routing-fixtures.js';

for (const account of [0, 1]) for (const window of [0, 1]) for (const reset of [null, undefined]) {
  test(`known usage with unknown reset: account ${account}, window ${window}, ${reset}`, () => {
    const f = fixture(); const w = f.usage[0].accounts[account].usageLimits.windows[window];
    w.usedPercent = 40; w.resetsAt = reset;
    const before = JSON.stringify(f.usage);
    const r = decide(f.settings, f.usage, f.catalogs, f.now);
    expect(r.action).not.toBe('held');
    const pool = r.pools[account ? 'codex' : 'claudeAgent'];
    expect(pool[window ? 'weeklyRemaining' : 'sessionRemaining']).toBe(60);
    expect(pool.untimedWindows).toBe(1);
    expect(pool.score).toBe(-40);
    expect(JSON.stringify(f.usage)).toBe(before);
  });
}

for (const used of [75, 75.01, 100]) test(`unknown reset preserves Codex usage/reserve at ${used}% used`, () => {
  const f = fixture();
  f.usage[0].accounts[0].usageLimits.windows.forEach((w) => { w.usedPercent = 100; });
  f.usage[0].accounts[1].usageLimits.windows.forEach((w) => { w.usedPercent = used; w.resetsAt = null; });
  const r = decide(f.settings, f.usage, f.catalogs, f.now);
  if (used === 100) expect(r.action).toBe('held');
  else expect(r.selection.model).toBe(used === 75 ? 'gpt-6-astra' : 'gpt-6.1-sol');
});

for (const reset of [null, undefined]) for (const used of [0, 40, 100]) test(`unknown scoped Opus reset ${reset} keeps ${used}% usage`, () => {
  const f = fixture();
  f.usage[0].accounts[0].usageLimits.windows.push({ id: 'seven_day_opus', kind: 'weekly', label: 'Weekly · Opus',
    usedPercent: used, resetsAt: reset, windowDurationMins: 10080 });
  const r = decide(f.settings, f.usage, f.catalogs, f.now);
  expect(r.action).not.toBe('held');
  expect(r.pools.claudeAgent.eligibleAccounts).toBe(used === 100 ? 0 : 1);
});

for (const bad of [false, 0, '', 'bad-date', new Date(now).toISOString(), new Date(now + 18000001).toISOString()]) {
  test(`non-null malformed or expired reset still holds: ${bad}`, () => {
    const f = fixture(); f.usage[0].accounts[0].usageLimits.windows[0].resetsAt = bad;
    expect(decide(f.settings, f.usage, f.catalogs, f.now).action).toBe('held');
  });
}

test('unknown reset does not bypass stale telemetry', () => {
  const f = fixture(); const u = f.usage[0].accounts[0].usageLimits;
  u.windows.forEach((w) => { w.resetsAt = null; }); u.checkedAt = new Date(now - 300001).toISOString();
  expect(decide(f.settings, f.usage, f.catalogs, f.now).action).toBe('held');
});

test('hub rejects a malformed non-null Codex reset instead of silently dropping it', async () => {
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch(req) {
    return Response.json(new URL(req.url).pathname.endsWith('auth-files')
      ? { files: [{ id: 'a', auth_index: 'a', provider: 'codex' }] }
      : { status_code: 200, body: JSON.stringify({ rate_limit: { primary_window: {
        used_percent: 0, limit_window_seconds: 604800, reset_at: 'bad-date',
      } } }) });
  } });
  try {
    const r = await readHub({ usageLimitSources: { hub: { enabled: true, kind: 'cliproxy',
      url: `http://127.0.0.1:${server.port}`, managementKey: 'fixture' } } }, now);
    expect(r[0].accounts[0].usageLimits.unavailable?.reason).toBe('probeFailed');
  } finally { server.stop(true); }
});

for (const provider of ['claude', 'codex']) test(`hub normalizes ${provider} unknown resets without a timestamp`, async () => {
  const usage = provider === 'claude' ? {
    five_hour: { utilization: 0, resets_at: null }, seven_day: { utilization: 20, resets_at: null },
    limits: [{ kind: 'weekly_scoped', percent: 60, resets_at: null, scope: { model: { display_name: 'Opus' } } }],
  } : { rate_limit: {
    primary_window: { used_percent: 40, limit_window_seconds: 18000 },
    secondary_window: { used_percent: 76, limit_window_seconds: 604800, reset_at: null },
  } };
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch(req) {
    return Response.json(new URL(req.url).pathname.endsWith('auth-files')
      ? { files: [{ id: 'a', auth_index: 'a', provider }] }
      : { status_code: 200, body: JSON.stringify(usage) });
  } });
  try {
    const r = await readHub({ usageLimitSources: { hub: { enabled: true, kind: 'cliproxy',
      url: `http://127.0.0.1:${server.port}`, managementKey: 'fixture' } } }, now);
    const u = r[0].accounts[0].usageLimits;
    expect(u.unavailable).toBeUndefined();
    expect(u.windows.map((w) => w.usedPercent)).toEqual(provider === 'claude' ? [0, 20, 60] : [40, 76]);
    expect(u.windows.every((w) => !Object.hasOwn(w, 'resetsAt'))).toBe(true);
  } finally { server.stop(true); }
});
