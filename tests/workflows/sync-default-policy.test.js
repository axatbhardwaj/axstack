import { expect, test } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { commit, decide } from '../../skills/axstack/scripts/sync-default.js';
import { fixture, weekly, codex, pool, codexWeekly } from './sync-default-fixture.js';

test('Usage env pool dry-run chooses the other driver and prints its full selection', async () => {
  const f = fixture([{ id: 'current', body: weekly(66, 62) },
    { id: 'sol', driver: 'codex', body: codexWeekly(30, 43) },
    { id: 'disabled', driver: 'codex', enabled: false, body: codexWeekly(0, 1) }]);
  const before = readFileSync(f.settings);
  const result = await f.run(['--dry-run'], { AXSTACK_SYNC_POOL: pool });
  expect(result.status).toBe(0);
  expect(result.data).toMatchObject({ action: 'updated', to: 'sol', selection: {
    instanceId: 'sol', model: 'gpt-6-astra', options: [{ id: 'reasoningEffort', value: 'medium' }] } });
  expect(result.output.trim().split('\n')).toHaveLength(1);
  expect(result.error).toBe('');
  expect(f.requests).toEqual(['current', 'sol']);
  expect(readFileSync(f.settings)).toEqual(before);
});

test('pooled writes replace the full root selection and preserve every surrounding byte', async () => {
  for (const driver of ['codex', 'claudeAgent']) {
    const f = fixture([{ id: 'current', body: weekly(66, 62) },
      { id: 'winner', driver, body: driver === 'codex' ? codexWeekly(30, 43) : weekly(30, 43) }]);
    const before = readFileSync(f.settings, 'utf8');
    const selection = driver === 'codex'
      ? { instanceId: 'winner', model: 'gpt-6-astra', options: [{ id: 'reasoningEffort', value: 'medium' }] }
      : { instanceId: 'winner', model: 'claude-opus-5-5' };
    expect((await f.run([], { AXSTACK_SYNC_POOL: pool })).data).toMatchObject({ action: 'updated', selection });
    const originalSelection = JSON.stringify(f.data.defaultModelSelection, null, 2).replaceAll('\n', '\n  ');
    expect(readFileSync(f.settings, 'utf8')).toBe(before.replace(originalSelection, JSON.stringify(selection)));
  }
  const f = fixture();
  const selection = { instanceId: 'claudeAlt', model: 'claude-opus-5-5', options: [{ id: 'effort', value: 'high' }] };
  f.data.defaultModelSelection = { ...selection, instanceId: 'claudeAgent' };
  writeFileSync(f.settings, JSON.stringify(f.data, null, 2));
  const before = readFileSync(f.settings, 'utf8');
  expect((await f.run([], { AXSTACK_SYNC_POOL: 'claudeAgent=claude-opus-5-5:high' })).status).toBe(0);
  expect(readFileSync(f.settings, 'utf8')).toBe(before.replace('"instanceId": "claudeAgent"', '"instanceId": "claudeAlt"'));
});

test('commit accepts only the decided root selection and rejects changes elsewhere', () => {
  const f = fixture();
  const original = readFileSync(f.settings, 'utf8');
  const selection = { instanceId: 'claudeAlt', model: 'pool-model' };
  const next = { ...f.data, defaultModelSelection: selection };
  expect(() => commit(f.settings, original, JSON.stringify({ ...next, planModelSelection: selection }), selection)).toThrow();
  expect(() => commit(f.settings, original, JSON.stringify({ ...next,
    defaultModelSelection: { ...selection, options: [] } }), selection)).toThrow();
  expect(readFileSync(f.settings, 'utf8')).toBe(original);
  expect(commit(f.settings, original, JSON.stringify(next), selection)).toBe('updated');
  expect(JSON.parse(readFileSync(f.settings, 'utf8'))).toEqual(next);
});

test('non-current absent credentials are excluded but malformed or unreadable credentials hold in both modes', async () => {
  for (const poolValue of ['', pool]) {
    for (const failure of ['absent', 'malformed', 'unreadable']) {
      const f = fixture([{ id: 'current', body: weekly(66, 62) },
        { id: 'other', missing: true }, { id: 'winner', body: weekly(30, 43) }]);
      const path = `${f.home}/account-1/.credentials.json`;
      if (failure === 'malformed') writeFileSync(path, '{invalid');
      if (failure === 'unreadable') mkdirSync(path);
      const before = readFileSync(f.settings);
      const result = await f.run([], { AXSTACK_SYNC_POOL: poolValue });
      expect(result.data).toMatchObject(failure === 'absent'
        ? { action: 'updated', to: 'winner' } : { action: 'unchanged', reason: 'unknown' });
      expect(result.data.instances.find((entry) => entry.instanceId === 'other').state)
        .toBe(failure === 'absent' ? 'excluded' : 'unknown');
      if (failure !== 'absent') expect(readFileSync(f.settings)).toEqual(before);
    }
  }
});

test('pooled short Codex windows are unknown while weekly primary clocks qualify', async () => {
  for (const seconds of [18000, 604800]) {
    const f = fixture([{ id: 'current', body: weekly(66, 62) }, { id: 'sol', driver: 'codex', body: {
      rate_limit: { primary_window: { used_percent: 20, limit_window_seconds: seconds,
        reset_after_seconds: seconds / 4 } } } }]);
    const before = readFileSync(f.settings);
    const result = await f.run(['--dry-run'], { AXSTACK_SYNC_POOL: pool });
    expect(result.data).toMatchObject(seconds < 604800
      ? { action: 'unchanged', reason: 'unknown' } : { action: 'updated', to: 'sol' });
    expect(readFileSync(f.settings)).toEqual(before);
  }
});

test('pooled short-window exhaustion still allows current escape across drivers', async () => {
  for (const body of [codex(95), codex(10, null, true)]) {
    const f = fixture([{ id: 'current', body },
      { id: 'opus', driver: 'claudeAgent', body: weekly(90, 60) }], 'codex');
    expect((await f.run(['--dry-run'], { AXSTACK_SYNC_POOL: pool })).data)
      .toMatchObject({ action: 'updated', reason: 'current-excluded', to: 'opus',
        selection: { instanceId: 'opus', model: 'claude-opus-5-5' } });
  }
});

test('pooled manual picks persist on margin or unknown, excluded current escapes across drivers', async () => {
  for (const scenario of ['margin', 'unknown', 'exhausted', 'unauthorized', 'skipped']) {
    const f = fixture([{ id: 'current', body: weekly(scenario === 'exhausted' ? 95 : 60, 60),
      ...(scenario === 'unauthorized' && { status: 401 }), ...(scenario === 'skipped' && { missing: true }) },
    { id: 'sol', driver: 'codex', body: codexWeekly(55) },
    ...(scenario === 'unknown' || scenario === 'exhausted' ? [{ id: 'unknown', status: 503 }] : [])]);
    const before = readFileSync(f.settings);
    const result = await f.run([], { AXSTACK_SYNC_POOL: pool });
    expect(result.data).toMatchObject(['margin', 'unknown'].includes(scenario)
      ? { action: 'unchanged', reason: scenario } : { action: 'updated', reason: 'current-excluded', to: 'sol' });
    if (['margin', 'unknown'].includes(scenario)) expect(readFileSync(f.settings)).toEqual(before);
  }
});

test('pool outside current driver is unmanaged and invalid pools fail without requests or writes', async () => {
  const f = fixture();
  const before = readFileSync(f.settings);
  expect((await f.run([], { AXSTACK_SYNC_POOL: 'codex=gpt-6-astra:medium' })).data)
    .toMatchObject({ action: 'unchanged', reason: 'unmanaged' });
  for (const value of ['grok=model', 'claudeAgent=', 'codex=sol,codex=astra', 'codex=sol:extra-high',
    'codex=sol:HIGH', 'codex=sol:', 'codex=sol,', 'constructor=sol']) {
    expect((await f.run([], { AXSTACK_SYNC_POOL: value })).status).toBe(1);
  }
  expect(f.requests).toEqual([]);
  expect(readFileSync(f.settings)).toEqual(before);
  expect((await f.run(['--dry-run'], { AXSTACK_SYNC_POOL: 'claudeAgent=opus:future' })).data.selection)
    .toEqual({ instanceId: 'claudeAlt', model: 'opus', options: [{ id: 'effort', value: 'future' }] });
});

const policyNow = 2000000000000;
const policyPool = { claudeAgent: { model: 'claude-opus-5-5' },
  codex: { model: 'gpt-6-astra', options: [{ id: 'reasoningEffort', value: 'medium' }] } };
function policyPair(currentUsed, otherUsed, currentElapsed = 90, otherElapsed = 10) {
  const settings = { providerInstances: {
    current: { driver: 'claudeAgent', enabled: true }, other: { driver: 'codex', enabled: true } },
  defaultModelSelection: { instanceId: 'current', model: 'manual', options: [{ id: 'effort', value: 'high' }] } };
  const usage = [currentUsed, otherUsed].map((used, i) => ({ instanceId: i ? 'other' : 'current',
    state: 'fresh', updatedAt: policyNow, utilization: used, windows: [{ used: 10 },
      { used, seconds: 604800, resetAt: policyNow + 604800000 * (1 - (i ? otherElapsed : currentElapsed) / 100) }] }));
  return { settings, usage };
}

for (const [currentUsed, otherUsed, to] of [
  [86, 85, 'other'], [91, 90, 'other'], // R=14 -> 15 and R=9 -> 10
  [85.001, 85, 'other'], [90.001, 90, 'other'],
  [86, 85.001, 'current'], [91, 90.001, 'current'],
]) {
  test(`pooled used ${currentUsed} versus ${otherUsed} selects ${to} despite opposing pace`, () => {
    const { settings, usage } = policyPair(currentUsed, otherUsed);
    expect(decide(settings, usage, policyNow, policyPool)).toMatchObject({
      action: to === 'other' ? 'updated' : 'unchanged', to });
    // Reverse the pace advantage: the higher-band current must stay selected.
    const reversed = policyPair(otherUsed, currentUsed, 10, 90);
    expect(decide(reversed.settings, reversed.usage, policyNow, policyPool).to)
      .toBe(to === 'other' ? 'current' : 'other');
  });
}

test('every pooled band keeps the ten-point pace margin, current ties, and low accounts usable', () => {
  for (const used of [50, 88, 92]) {
    for (const [elapsed, to] of [[50, 'current'], [59, 'current'], [60, 'other'], [65, 'other']]) {
      const { settings, usage } = policyPair(used, used, 50, elapsed);
      expect(decide(settings, usage, policyNow, policyPool)).toMatchObject({
        action: to === 'other' ? 'updated' : 'unchanged', to });
      // Candidate enumeration order must not turn a tie into a switch.
      if (elapsed === 50) {
        settings.providerInstances = { other: settings.providerInstances.other, current: settings.providerInstances.current };
        expect(decide(settings, usage, policyNow, policyPool).to).toBe('current');
      }
    }
    // Better pace can win with less remaining quota within the same band.
    const { settings, usage } = policyPair(used, used + 1, 50, 65);
    expect(decide(settings, usage, policyNow, policyPool)).toMatchObject({ action: 'updated', to: 'other' });
  }
});

test('reserve preference keeps unknown holds, excluded-current escape, and hard exclusions in order', () => {
  for (const unknown of [{ state: 'unknown' }, { updatedAt: policyNow - 300000 },
    { windows: [{ used: 10 }, { used: 0, seconds: 604800 }] },
    { windows: [{ used: 0, seconds: 18000, resetAt: policyNow + 100000 }] }]) {
    const { settings, usage } = policyPair(91, 85);
    settings.providerInstances.uncertain = { driver: 'codex', enabled: true };
    usage.push({ ...usage[1], instanceId: 'uncertain', ...unknown });
    expect(decide(settings, usage, policyNow, policyPool)).toMatchObject({ action: 'unchanged', reason: 'unknown' });
    usage[0].utilization = 95;
    expect(decide(settings, usage, policyNow, policyPool)).toMatchObject({ action: 'updated', reason: 'current-excluded', to: 'other' });
  }
  for (const exclusion of [{ utilization: 95 }, { limitReached: true }, { credentialsAbsent: true }]) {
    const { settings, usage } = policyPair(92, 85);
    Object.assign(usage[1], exclusion);
    expect(decide(settings, usage, policyNow, policyPool)).toMatchObject({ action: 'unchanged', to: 'current' });
    usage[0].utilization = 95;
    expect(decide(settings, usage, policyNow, policyPool)).toMatchObject({ action: 'unchanged', reason: 'no-eligible' });
  }
});

test('without a pool reserve thresholds do not change pace selection or enforce a model', () => {
  const { settings, usage } = policyPair(86, 85);
  settings.providerInstances.other.driver = 'claudeAgent';
  expect(decide(settings, usage, policyNow)).toEqual({ action: 'unchanged', reason: 'margin',
    from: 'current', to: 'current', instances: [
      { instanceId: 'current', state: 'eligible', pace: 4 }, { instanceId: 'other', state: 'eligible', pace: -75 } ] });
  usage[1].windows[1].used = 65;
  usage[1].windows[1].resetAt = usage[0].windows[1].resetAt;
  expect(decide(settings, usage, policyNow).selection).toEqual({ ...settings.defaultModelSelection, instanceId: 'other' });
  expect(decide(settings, [usage[0]], policyNow, policyPool)).toMatchObject({ action: 'unchanged', reason: 'unknown' });
});

test('reserve-driven CLI dry-run and write preserve settings bytes outside the selected root object', async () => {
  const f = fixture([{ id: 'current', body: weekly(86, 10) },
    { id: 'astra', driver: 'codex', body: codexWeekly(85, 160) }]);
  const before = readFileSync(f.settings, 'utf8');
  const selection = { instanceId: 'astra', ...policyPool.codex };
  const dry = await f.run(['--dry-run'], { AXSTACK_SYNC_POOL: pool });
  expect(dry.status).toBe(0);
  expect(dry.data).toMatchObject({ action: 'updated', to: 'astra', selection });
  expect(readFileSync(f.settings, 'utf8')).toBe(before);
  const written = await f.run([], { AXSTACK_SYNC_POOL: pool });
  expect(written.status).toBe(0);
  expect(written.data).toMatchObject({ action: 'updated', to: 'astra', selection });
  const originalSelection = JSON.stringify(f.data.defaultModelSelection, null, 2).replaceAll('\n', '\n  ');
  expect(readFileSync(f.settings, 'utf8')).toBe(before.replace(originalSelection, JSON.stringify(selection)));
});
