import { expect, test } from 'bun:test';
import { readHub } from '../../skills/axstack/scripts/hub-usage.js';
import { decide } from '../../skills/axstack/scripts/default-policy.js';
import { fixture, now } from './default-routing-fixtures.js';

const reset = new Date(now + 84 * 3600000).toISOString();
const weeklyOnly = (used = 20) => ({ five_hour: null,
  seven_day: { utilization: used, resets_at: reset },
  limits: [{ kind: 'weekly_all', group: 'weekly', is_active: true, percent: used, resets_at: reset, scope: null },
    { kind: 'weekly_scoped', group: 'weekly', is_active: false, percent: 25, resets_at: reset,
      scope: { model: { display_name: 'Fable' }, surface: null } }],
});
const ordinary = () => ({ ...weeklyOnly(60),
  five_hour: { utilization: 40, resets_at: new Date(now + 150 * 60000).toISOString() },
});

async function integrated(payloads, status = 200) {
  const f = fixture();
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(req) {
    if (new URL(req.url).pathname.endsWith('auth-files')) return Response.json({
      files: payloads.map((_, i) => ({ id: `claude-${i}`, auth_index: String(i), provider: 'claude' })),
    });
    const request = await req.json();
    return Response.json({ status_code: status, body: JSON.stringify(payloads[Number(request.auth_index)]) });
  } });
  try {
    const snapshots = await readHub({ usageLimitSources: { hub: { enabled: true, kind: 'cliproxy',
      url: `http://127.0.0.1:${server.port}`, managementKey: 'fixture' } } }, now);
    f.usage[0].accounts = [...snapshots[0].accounts, f.usage[0].accounts[1]];
    return f;
  } finally { server.stop(true); }
}
const decision = (f) => decide(f.settings, f.usage, f.catalogs, f.now);

for (const allWeekly of [false, true]) test(`corroborated Claude weekly-only integrates with ${allWeekly ? 'weekly-only' : 'ordinary'} accounts`, async () => {
  const f = await integrated([weeklyOnly(), allWeekly ? weeklyOnly(60) : ordinary()]);
  const before = JSON.stringify(f);
  const r = decision(f);
  expect(r.action).not.toBe('held');
  const u = f.usage[0].accounts[0].usageLimits;
  expect(u.notApplicable).toEqual({ session: 'verified Claude weekly-only response' });
  expect(u.windows.map((w) => [w.id, w.usedPercent, w.resetsAt])).toEqual([
    ['seven_day', 20, reset], ['seven_day_fable', 25, reset],
  ]);
  expect(r.pools.claudeAgent).toMatchObject({ weeklyRemaining: 60, eligibleAccounts: 2,
    sessionRemaining: allWeekly ? null : 60, sessionStatus: allWeekly ? 'n/a' : 'applicable',
    sessionAccounts: allWeekly ? 0 : 1, score: 10, untimedWindows: 0 });
  expect(f.usage[0].accounts.map((a) => a.id)).toEqual(['claude-0', 'claude-1', 'b']);
  expect(JSON.stringify(f)).toBe(before);
});

const corruptions = [
  ['omitted session', (u) => { delete u.five_hour; }],
  ['false session', (u) => { u.five_hour = false; }],
  ['zero session', (u) => { u.five_hour = 0; }],
  ['malformed session', (u) => { u.five_hour = { utilization: null }; }],
  ['null alone', (u) => { delete u.limits; }],
  ['plan label without corroboration', (u) => { delete u.limits; u.plan = 'Ultra'; }],
  ['null limits', (u) => { u.limits = null; }],
  ['object limits', (u) => { u.limits = {}; }],
  ['empty limits', (u) => { u.limits = []; }],
  ['null row', (u) => { u.limits.push(null); }],
  ['missing weekly corroboration', (u) => { u.limits.shift(); }],
  ['duplicate weekly corroboration', (u) => { u.limits.push({ ...u.limits[0] }); }],
  ['inactive weekly corroboration', (u) => { u.limits[0].is_active = false; }],
  ['missing active flag', (u) => { delete u.limits[0].is_active; }],
  ['contradictory weekly group', (u) => { u.limits[0].group = 'session'; }],
  ['contradictory weekly usage', (u) => { u.limits[0].percent++; }],
  ['contradictory weekly reset', (u) => { u.limits[0].resets_at = new Date(now + 1000).toISOString(); }],
  ['scoped aggregate', (u) => { u.limits[0].scope = { model: { display_name: 'Opus' } }; }],
  ['inactive session row', (u) => { u.limits.push({ kind: 'session', group: 'session', is_active: false, percent: 4 }); }],
  ['active session row', (u) => { u.limits.push({ kind: 'session', group: 'session', is_active: true, percent: 4 }); }],
  ['unknown inactive limit', (u) => { u.limits.push({ kind: 'future_limit', group: 'weekly', is_active: false }); }],
  ['missing weekly', (u) => { delete u.seven_day; }],
  ['null weekly', (u) => { u.seven_day = null; }],
  ['string usage', (u) => { u.seven_day.utilization = '20'; u.limits[0].percent = '20'; }],
  ['negative usage', (u) => { u.seven_day.utilization = -1; u.limits[0].percent = -1; }],
  ['excess usage', (u) => { u.seven_day.utilization = 101; u.limits[0].percent = 101; }],
  ['malformed reset', (u) => { u.seven_day.resets_at = u.limits[0].resets_at = 'bad'; }],
  ['null reset', (u) => { u.seven_day.resets_at = u.limits[0].resets_at = null; }],
  ['missing reset', (u) => { delete u.seven_day.resets_at; delete u.limits[0].resets_at; }],
  ['expired reset', (u) => { u.seven_day.resets_at = u.limits[0].resets_at = new Date(now).toISOString(); }],
  ['distant reset', (u) => { u.seven_day.resets_at = u.limits[0].resets_at = new Date(now + 604800001).toISOString(); }],
  ['malformed scoped percent', (u) => { u.limits[1].percent = '0'; }],
  ['missing scoped active flag', (u) => { delete u.limits[1].is_active; }],
  ['malformed scoped reset', (u) => { u.limits[1].resets_at = 'bad'; }],
  ['missing scoped model', (u) => { u.limits[1].scope = null; }],
  ['unknown scoped surface', (u) => { u.limits[1].scope.surface = { display_name: 'Other' }; }],
  ['provider error', (u) => { u.error = 'refused'; }],
  ['provider errors', (u) => { u.errors = ['refused']; }],
  ['empty error field', (u) => { u.error = ''; }],
  ['uncorroborated flat scope', (u) => { u.seven_day_opus = { utilization: 100, resets_at: reset }; }],
];
for (const [name, corrupt] of corruptions) test(`uncorroborated Claude weekly-only holds every account: ${name}`, async () => {
  const payload = weeklyOnly(); corrupt(payload);
  const f = await integrated([ordinary(), payload]);
  const before = JSON.stringify(f.settings);
  expect(f.usage[0].accounts.map((a) => a.id)).toEqual(['claude-0', 'claude-1', 'b']);
  expect(f.usage[0].accounts[1].usageLimits.notApplicable).toBeUndefined();
  const r = decision(f);
  expect(r.action).toBe('held');
  expect(r.selection).toEqual(f.settings.defaultModelSelection);
  expect(JSON.stringify(f.settings)).toBe(before);
});

test('a present session remains applicable even when its limits row is inactive', async () => {
  const payload = ordinary();
  payload.five_hour.utilization = 4;
  payload.limits.push({ kind: 'session', group: 'session', is_active: false, percent: 4,
    resets_at: payload.five_hour.resets_at, scope: null });
  const f = await integrated([weeklyOnly(), payload]);
  expect(f.usage[0].accounts[1].usageLimits.notApplicable).toBeUndefined();
  expect(decision(f).action).not.toBe('held');
  expect(decision(f).pools.claudeAgent.sessionRemaining).toBe(96);
});

for (const field of ['checkedAt', 'accountCheckedAt', 'unavailable']) test(`weekly-only never bypasses ${field}`, async () => {
  const f = await integrated([weeklyOnly(), ordinary()]);
  if (field === 'checkedAt') f.usage[0].checkedAt = new Date(now - 300001).toISOString();
  else if (field === 'accountCheckedAt') f.usage[0].accounts[0].usageLimits.checkedAt = new Date(now - 300001).toISOString();
  else f.usage[0].accounts[0].usageLimits.unavailable = { reason: 'probeFailed' };
  expect(decision(f).action).toBe('held');
});

test('provider HTTP failure retains a failed account and holds the decision', async () => {
  const f = await integrated([weeklyOnly()], 500);
  expect(f.usage[0].accounts.map((a) => a.id)).toEqual(['claude-0', 'b']);
  expect(f.usage[0].accounts[0].usageLimits.unavailable?.reason).toBe('probeFailed');
  expect(decision(f).action).toBe('held');
});

test('weekly exhaustion stays in the mean without creating session capacity', async () => {
  const f = await integrated([weeklyOnly(100), weeklyOnly(20)]);
  let r = decision(f);
  expect(r.action).not.toBe('held');
  expect(r.pools.claudeAgent).toMatchObject({ sessionRemaining: null, weeklyRemaining: 40, eligibleAccounts: 1 });
  f.usage[0].accounts[1].usageLimits.windows[0].usedPercent = 100;
  r = decision(f);
  expect(r.pools.claudeAgent).toMatchObject({ weeklyRemaining: 0, eligibleAccounts: 0 });
  expect(r.selection.instanceId).toBe('code');
  f.usage[0].accounts[2].usageLimits.windows.forEach((w) => { w.usedPercent = 100; });
  expect(decision(f).action).toBe('held');
});

test('inactive scoped Opus weekly capacity still constrains weekly-only eligibility', async () => {
  const payload = weeklyOnly();
  payload.limits[1].scope.model.display_name = 'Opus'; payload.limits[1].percent = 100;
  const f = await integrated([payload]);
  expect(decision(f).action).not.toBe('held');
  expect(decision(f).pools.claudeAgent.eligibleAccounts).toBe(0);
  expect(decision(f).selection.instanceId).toBe('code');
});

for (const remaining of [29.99, 30]) test(`weekly-only Claude reserve uses its real weekly ${remaining}%`, async () => {
  const f = await integrated([weeklyOnly(100 - remaining)]);
  f.usage[0].accounts[1].usageLimits.windows.forEach((w) => { w.usedPercent = 80; });
  expect(decision(f).action).not.toBe('held');
  expect(decision(f).selection.model).toBe(remaining === 30 ? 'claude-opus-5-5' : 'gpt-6.1-sol');
});
