import { expect, test } from 'bun:test';
import { decide } from '../../skills/axstack/scripts/default-policy.js';
import { fixture, selection } from './default-routing-fixtures.js';

function remaining(f, opus, codex) {
  f.usage[0].accounts.forEach((a, i) => {
    a.usageLimits.windows.forEach((w) => { w.usedPercent = 100 - [opus, codex][i]; });
  });
}

for (const account of [0, 1]) for (const window of [0, 1]) {
  test(`pool ${account} window ${window} minimum admits Sol despite other high windows`, () => {
    const f = fixture(); remaining(f, 29.99, 29.99);
    f.usage[0].accounts[account].usageLimits.windows[1 - window].usedPercent = 10;
    const r = decide(f.settings, f.usage, f.catalogs, f.now);
    expect(r.action).toBe('update');
    expect(r.selection).toEqual(selection('code', 'gpt-6.1-sol', 'xhigh'));
  });
}

for (const weekly of [29.99, 30]) test(`weekly-only Codex ${weekly}% keeps session n/a`, () => {
  const f = fixture(); remaining(f, 29.99, weekly);
  const u = f.usage[0].accounts[1].usageLimits;
  u.windows.shift(); u.notApplicable = { session: 'verified Codex weekly-only response' };
  const r = decide(f.settings, f.usage, f.catalogs, f.now);
  expect(r.action).toBe('update');
  expect(r.pools.codex.sessionRemaining).toBeNull();
  expect(r.pools.codex.sessionStatus).toBe('n/a');
  expect(r.selection.model).toBe(weekly === 30 ? 'gpt-6-astra' : 'gpt-6.1-sol');
});

test('non-low primary wins even when the low primary has much better pacing and fewer starts', () => {
  const f = fixture(); remaining(f, 30, 29.99);
  f.settings.defaultModelSelection = selection('code', 'gpt-6-astra', 'medium');
  f.usage[0].accounts[1].usageLimits.windows.forEach((w) => {
    w.resetsAt = new Date(f.now + 60000).toISOString();
  });
  const threads = Array.from({ length: 5 }, (_, i) => ({ id: `${i}`,
    createdAt: new Date(f.now - 1000).toISOString(), createdBy: 'user', creationSource: 'web',
    parentThreadId: null, modelSelection: selection('claude', 'claude-opus-5-5', 'medium') }));
  expect(decide(f.settings, f.usage, f.catalogs, f.now, { threads }).selection.model).toBe('claude-opus-5-5');
});

for (const opus of [20, 80]) test(`scoped-exhausted Opus at ${opus}% is unavailable, not extra low capacity`, () => {
  const f = fixture(); remaining(f, opus, 20);
  f.usage[0].accounts[0].usageLimits.windows.push({ id: 'seven_day_opus', kind: 'weekly',
    label: 'Weekly · Opus', usedPercent: 100, resetsAt: new Date(f.now + 3600000).toISOString(),
    windowDurationMins: 10080 });
  const r = decide(f.settings, f.usage, f.catalogs, f.now);
  expect(r.action).toBe('update');
  expect(r.pools.claudeAgent.eligibleAccounts).toBe(0);
  expect(r.selection.model).toBe(opus === 20 ? 'gpt-6.1-sol' : 'gpt-6-astra');
});

for (const corrupt of [
  (f) => { f.usage[0].accounts[0].usageLimits.unavailable = { reason: 'probeFailed' }; },
  (f) => { f.usage[0].accounts[0].usageLimits.windows.pop(); },
  (f) => { f.catalogs[1].models.pop(); },
]) test('unknown primary telemetry or unavailable Sol catalog holds rather than inventing low capacity', () => {
  const f = fixture(); remaining(f, 20, 20); corrupt(f);
  const r = decide(f.settings, f.usage, f.catalogs, f.now);
  expect(r.action).toBe('held');
  expect(r.selection).toEqual(f.settings.defaultModelSelection);
});

test('both low does not create Codex capacity when its accounts are exhausted', () => {
  const f = fixture(); remaining(f, 20, 0);
  let r = decide(f.settings, f.usage, f.catalogs, f.now);
  expect(r.action).toBe('unchanged');
  expect(r.selection.model).toBe('claude-opus-5-5');
  remaining(f, 0, 0);
  r = decide(f.settings, f.usage, f.catalogs, f.now);
  expect(r.action).toBe('held');
  expect(r.reason).toMatch(/exhausted/);
});
