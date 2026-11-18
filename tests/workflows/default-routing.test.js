import { expect, test } from 'bun:test';
import { decide } from '../../skills/axstack/scripts/default-policy.js';
import { fixture, selection } from './default-routing-fixtures.js';

test('underused Codex becomes the new-chat default without changing any other setting', () => {
  const f = fixture();
  const before = JSON.stringify(f.settings);
  const result = decide(f.settings, f.usage, f.catalogs, f.now);
  expect(result.action).toBe('update');
  expect(result.selection).toEqual(selection('code', 'gpt-6.2-astra', 'medium'));
  expect(JSON.stringify(f.settings)).toBe(before);
  expect(result.projectOverrides).toEqual(['project']);
  expect(result.projectOverrideCoverage).toMatch(/legacy project records not inspected/);
});

for (const [opus, astra, model] of [
  [29.99, 29.99, 'gpt-6.2-sol'], [29.99, 30, 'gpt-6.2-astra'],
  [30, 29.99, 'claude-opus-5-5'], [30, 30, 'claude-opus-5-5'], [80, 20, 'claude-opus-5-5'],
  [20, 80, 'gpt-6.2-astra'], [70, 70, 'claude-opus-5-5'],
]) test(`reserve routing with Opus ${opus}% / Astra ${astra}% remaining`, () => {
  const f = fixture();
  // Current Sol must not bypass the primary-pool threshold through hysteresis.
  f.settings.defaultModelSelection = selection('code', 'gpt-6.2-sol', 'xhigh');
  f.usage[0].accounts.forEach((a, i) => {
    a.usageLimits.windows.forEach((w) => { w.usedPercent = 100 - [opus, astra][i]; });
  });
  const r = decide(f.settings, f.usage, f.catalogs, f.now, { threads: [] });
  expect(r.action).toBe(model === 'gpt-6.2-sol' ? 'unchanged' : 'update');
  expect(r.selection).toEqual(selection(model.startsWith('gpt') ? 'code' : 'claude', model,
    model === 'gpt-6.2-sol' ? 'xhigh' : 'medium'));
});

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

test('fully exhausted pools hold, while available Opus can serve an exhausted Codex pool', () => {
  const f = fixture();
  f.usage[0].accounts.forEach((a) => { a.usageLimits.windows.forEach((w) => { w.usedPercent = 100; }); });
  expect(decide(f.settings, f.usage, f.catalogs, f.now).action).toBe('held');
  f.usage[0].accounts[0].usageLimits.windows.forEach((w) => { w.usedPercent = 80; });
  expect(decide(f.settings, f.usage, f.catalogs, f.now).selection.model).toBe('claude-opus-5-5');
});

test('reset timing ranks underused capacity and tiny movement does not churn', () => {
  const f = fixture();
  f.settings.defaultModelSelection = selection('code', 'gpt-6.2-astra', 'medium');
  f.usage[0].accounts.forEach((a) => { a.usageLimits.windows.forEach((w) => { w.usedPercent = 30; }); });
  const stable = decide(f.settings, f.usage, f.catalogs, f.now, { threads: [] });
  expect(stable.action).toBe('unchanged');
  f.usage[0].accounts[1].usageLimits.windows.forEach((w) => {
    w.resetsAt = new Date(f.now + w.windowDurationMins * 60000 * 0.1).toISOString();
  });
  const r = decide(f.settings, f.usage, f.catalogs, f.now);
  expect(r.selection.model).toBe('gpt-6.2-astra');
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
  expect(r.selection.model).toBe('gpt-6.2-astra');
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

test('authoritative session n/a leaves weekly reserve and eligibility applicable', () => {
  const f = fixture();
  const u = f.usage[0].accounts[1].usageLimits;
  u.windows.shift();
  u.notApplicable = { session: 'verified Codex weekly-only response' };
  let r = decide(f.settings, f.usage, f.catalogs, f.now);
  expect(r.action).toBe('update');
  expect(r.pools.codex.sessionRemaining).toBeNull();
  expect(r.pools.codex.sessionStatus).toBe('n/a');
  expect(r.selection.model).toBe('gpt-6.2-astra');
  u.windows[0].usedPercent = 76;
  f.usage[0].accounts[0].usageLimits.windows.forEach((w) => { w.usedPercent = 99; });
  r = decide(f.settings, f.usage, f.catalogs, f.now);
  expect(r.selection.model).toBe('gpt-6.2-sol');
  u.windows = [];
  expect(decide(f.settings, f.usage, f.catalogs, f.now).action).toBe('held');
});

for (const missing of ['gpt-6.2-astra', 'gpt-6.2-sol', 'both']) {
  test(`missing required 6.2 catalog model ${missing} holds even with older alternatives`, () => {
    const f = fixture();
    const codex = f.catalogs[1];
    const older = codex.models.map((m, i) => ({ ...structuredClone(m),
      slug: ['gpt-6-astra', 'gpt-6.1-sol'][i] }));
    codex.models = [...codex.models.filter((m) => missing !== 'both' && m.slug !== missing), ...older];
    const before = JSON.stringify(f.settings);
    const r = decide(f.settings, f.usage, f.catalogs, f.now);
    expect(r.action).toBe('held');
    expect(r.reason).toBe('unverified codex model catalog');
    expect(r.selection).toEqual(f.settings.defaultModelSelection);
    expect(JSON.stringify(f.settings)).toBe(before);
  });
}

for (const low of [false, true]) {
  test(`mixed old/new catalog moves an old default to 6.2 with both pools low=${low}`, () => {
    const f = fixture();
    f.catalogs[1].models.unshift(...f.catalogs[1].models.map((m, i) => ({ ...structuredClone(m),
      slug: ['gpt-6-astra', 'gpt-6.1-sol'][i] })));
    f.settings.defaultModelSelection = selection('code', low ? 'gpt-6.1-sol' : 'gpt-6-astra', low ? 'xhigh' : 'medium');
    if (low) f.usage[0].accounts.forEach((a) => {
      a.usageLimits.windows.forEach((w) => { w.usedPercent = 80; });
    });
    const r = decide(f.settings, f.usage, f.catalogs, f.now);
    expect(r.action).toBe('update');
    expect(r.selection).toEqual(selection('code', low ? 'gpt-6.2-sol' : 'gpt-6.2-astra', low ? 'xhigh' : 'medium'));
  });
}
