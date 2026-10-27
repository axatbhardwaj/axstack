import { expect, test } from 'bun:test';
import { decide } from '../../skills/axstack/scripts/default-policy.js';
import { fixture, selection } from './default-routing-fixtures.js';

test('underused Codex becomes the new-chat default without changing any other setting', () => {
  const f = fixture();
  const before = JSON.stringify(f.settings);
  const result = decide(f.settings, f.usage, f.catalogs, f.now);
  expect(result.action).toBe('update');
  expect(result.selection).toEqual(selection('code', 'gpt-6-astra', 'medium'));
  expect(JSON.stringify(f.settings)).toBe(before);
  expect(result.projectOverrides).toEqual(['project']);
  expect(result.projectOverrideCoverage).toMatch(/legacy project records not inspected/);
});

for (const [used, astra] of [[75, true], [75.01, false]]) {
  test(`Astra reserve boundary at ${100 - used}% remaining`, () => {
    const f = fixture();
    f.usage[0].accounts[1].usageLimits.windows[1].usedPercent = used;
    f.usage[0].accounts[0].usageLimits.windows.forEach((w) => { w.usedPercent = 98; });
    const r = decide(f.settings, f.usage, f.catalogs, f.now);
    expect(r.selection.model).toBe(astra ? 'gpt-6-astra' : 'gpt-6.1-sol');
    expect(r.selection.options[0].value).toBe(astra ? 'medium' : 'xhigh');
  });
}

test('pool mean includes exhausted accounts; one exhausted account does not exhaust the pool', () => {
  const f = fixture();
  const a = structuredClone(f.usage[0].accounts[1]);
  a.id = 'c';
  a.usageLimits.windows.forEach((w) => { w.usedPercent = 100; });
  f.usage[0].accounts.push(a);
  const r = decide(f.settings, f.usage, f.catalogs, f.now);
  expect(r.action).toBe('update');
  expect(r.pools.codex.sessionRemaining).toBe(45);
  expect(r.pools.codex.weeklyRemaining).toBe(45);
});

test('capacity must exist in both windows of the same account', () => {
  const f = fixture();
  const a = structuredClone(f.usage[0].accounts[1]);
  a.id = 'c';
  a.usageLimits.windows[0].usedPercent = 100;
  f.usage[0].accounts[1].usageLimits.windows[1].usedPercent = 100;
  f.usage[0].accounts.push(a);
  const r = decide(f.settings, f.usage, f.catalogs, f.now);
  expect(r.selection.instanceId).toBe('claude');
  expect(r.pools.codex.eligibleAccounts).toBe(0);
});

for (const corrupt of [
  (f) => { f.usage[0].accounts[1].usageLimits.windows.pop(); },
  (f) => { f.usage[0].accounts[1].usageLimits.windows[0].usedPercent = -1; },
  (f) => { f.usage[0].checkedAt = new Date(f.now - 300001).toISOString(); },
  (f) => { f.usage[0].accounts[1].usageLimits.checkedAt = 'bad'; },
  (f) => { f.usage[0].accounts[1].usageLimits.windows[0].resetsAt = new Date(f.now).toISOString(); },
  (f) => { f.catalogs[1].models = []; },
  (f) => { f.catalogs[1].checkedAt = new Date(f.now - 86400001).toISOString(); },
]) test('uncertain telemetry or catalog holds without failover', () => {
  const f = fixture(); corrupt(f);
  const r = decide(f.settings, f.usage, f.catalogs, f.now);
  expect(r.action).toBe('held');
  expect(r.reason).toBeTruthy();
  expect(r.selection).toEqual(f.settings.defaultModelSelection);
});

test('fully exhausted pools hold, while Opus remains eligible below the Codex reserve', () => {
  const f = fixture();
  f.usage[0].accounts.forEach((a) => { a.usageLimits.windows.forEach((w) => { w.usedPercent = 100; }); });
  expect(decide(f.settings, f.usage, f.catalogs, f.now).action).toBe('held');
  f.usage[0].accounts[0].usageLimits.windows.forEach((w) => { w.usedPercent = 80; });
  expect(decide(f.settings, f.usage, f.catalogs, f.now).selection.model).toBe('claude-opus-5-5');
});

test('reset timing ranks underused capacity and tiny movement does not churn', () => {
  const f = fixture();
  f.usage[0].accounts.forEach((a) => { a.usageLimits.windows.forEach((w) => { w.usedPercent = 30; }); });
  const stable = decide(f.settings, f.usage, f.catalogs, f.now);
  expect(stable.action).toBe('unchanged');
  f.usage[0].accounts[1].usageLimits.windows.forEach((w) => {
    w.resetsAt = new Date(f.now + w.windowDurationMins * 60000 * 0.1).toISOString();
  });
  const r = decide(f.settings, f.usage, f.catalogs, f.now);
  expect(r.selection.model).toBe('gpt-6-astra');
  f.settings.defaultModelSelection = r.selection;
  f.usage[0].accounts[1].usageLimits.windows[0].usedPercent += 0.01;
  expect(decide(f.settings, f.usage, f.catalogs, f.now).action).toBe('unchanged');
});

test('seven-day manual driver starts break similar pressure ties once counts improve', () => {
  const f = fixture();
  f.usage[0].accounts.forEach((a) => { a.usageLimits.windows.forEach((w) => { w.usedPercent = 30; }); });
  const history = { threads: Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, createdAt: new Date(f.now - 3600000).toISOString(),
    createdBy: 'user', creationSource: 'web', parentThreadId: null, modelSelection: f.settings.defaultModelSelection })) };
  const r = decide(f.settings, f.usage, f.catalogs, f.now, history);
  expect(r.selection.model).toBe('gpt-6-astra');
  expect(r.fairness).toBe('seven-day manual driver starts');
});

test('native model-scoped weekly windows constrain Opus without making the main window ambiguous', () => {
  const f = fixture();
  f.usage[0].accounts[0].usageLimits.windows.push({ id: 'seven_day_opus', kind: 'weekly', label: 'Weekly · Opus',
    usedPercent: 100, resetsAt: new Date(f.now + 3600000).toISOString(), windowDurationMins: 10080 });
  const r = decide(f.settings, f.usage, f.catalogs, f.now);
  expect(r.action).toBe('update');
  expect(r.selection.instanceId).toBe('code');
});
