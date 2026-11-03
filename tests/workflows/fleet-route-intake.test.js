import { expect, test } from 'bun:test';
import { mkdirSync } from 'node:fs';
import { intakeFixture, NOW } from './fleet-route-intake-fixture.js';
import { setup } from './dispatch-plan/fixtures.js';

function run(f, extra = []) {
  const s = setup();
  const facts = `${s.dir}/facts`;
  mkdirSync(facts);
  s.save('facts/input', f.bind());
  const result = Bun.spawnSync([process.execPath, 'skills/axstack/scripts/fleet-route.js', 'plan',
    '--facts', facts, '--config', s.save('config', f.config), '--config-digest', f.input.configDigest,
    '--now', String(NOW), '--json', ...extra], { stdout: 'pipe', stderr: 'pipe' });
  return { status: result.exitCode, error: result.stderr.toString(),
    report: result.stdout.length ? JSON.parse(result.stdout.toString()) : null };
}

test('intake plan selects and binds a whole-task driver using saved native destination reads', () => {
  const r = run(intakeFixture());
  expect(r.status, r.error).toBe(0);
  expect(r.report).toMatchObject({ disposition: 'launch', selected: { environmentId: 'env-worker-a', projectId: 'project-worker-a' },
    launch: { clientRequestId: 'run:driver:task:a1', delegatedFrom: { environmentId: 'env-personal-a',
      threadId: 'origin-thread', title: 'Implement task' } } });
  expect(r.report.terms.every((t) => ['pass', 'fail', 'unknown', 'n/a'].includes(t.state))).toBe(true);
});

test.each(['scheduled', 'status', 'follow-up'])('%s is not intake and stays local', (kind) => {
  const f = intakeFixture(); f.input.intake.kind = kind;
  const r = run(f);
  expect(r.status, r.error).toBe(0);
  expect(r.report).toMatchObject({ disposition: 'stay', reason: 'not-intake' });
});

test.each([
  ['routed', (f) => { f.input.intake.routed = true; }, 'already-routed'],
  ['no dispatch', (f) => { f.input.intake.willDispatch = false; }, 'not-intake'],
  ['switch missing', (f) => { delete f.config.intakeRouting; }, 'routing-disabled'],
  ['switch false', (f) => { f.config.intakeRouting = false; }, 'routing-disabled'],
  ['here', (f) => { f.input.intake.namedHost = 'here'; }, 'named-local'],
  ['support missing', (f) => { delete f.config.intakeSupport; }, 'routing unsupported'],
  ['wrong provider support', (f) => { f.config.intakeSupport[0].providerInstanceId = 'claudeAgent'; }, 'routing unsupported'],
  ['different launching provider', (f) => { f.input.origin.providerInstanceId = 'claudeAgent'; }, 'routing unsupported'],
  ['unknown launching provider', (f) => { delete f.input.origin.providerInstanceId; }, 'routing unsupported'],
])('%s cannot trigger automatic hand-off', (_, change, reason) => {
  const f = intakeFixture(); change(f);
  const r = run(f); expect(r.status, r.error).toBe(0);
  expect(r.report).toMatchObject({ disposition: 'stay', reason });
});

test('explicit named-host pilot bypasses only the automatic switch', () => {
  const f = intakeFixture(); f.config.intakeRouting = false; f.input.intake.namedHost = 'worker-b';
  expect(run(f).report).toMatchObject({ disposition: 'launch', selected: { hostId: 'worker-b' } });
  delete f.config.intakeSupport;
  expect(run(f).report).toMatchObject({ disposition: 'stay', reason: 'routing unsupported' });
});

test.each([
  ['failed clone', (f) => { f.input.destinations[0].project = null; }],
  ['unreachable', (f) => { f.input.routeFacts[0].reachable = false; }],
  ['no isolation', (f) => { f.input.destinations[0].capabilities['worktree-isolation'].value = false; }],
  ['missing native reads', (f) => { delete f.input.nativeDestinations['env-worker-a']; }],
  ['missing project list', (f) => { delete f.input.nativeDestinations['env-worker-a'].projectList; }],
  ['incomplete project list', (f) => { f.input.nativeDestinations['env-worker-a'].projectList[0].value.nextCursor = 20; }],
  ['wrong catalog bytes', (f) => { f.input.nativeDestinations['env-worker-a'].capabilities.valueText += '\n'; }],
  ['no reviewer', (f) => { f.input.nativeDestinations['env-worker-a'].capabilities.valueText = '{}'; }],
])('%s excludes that host, selecting the next eligible host', (_, change) => {
  const f = intakeFixture(); change(f);
  const r = run(f); expect(r.status, r.error).toBe(0);
  expect(r.report).toMatchObject({ disposition: 'launch', selected: { hostId: 'worker-b' } });
});

test('no remote route stays local, but missing local staffing holds', () => {
  const f = intakeFixture(); f.input.routeFacts.forEach((r) => { r.reachable = false; });
  expect(run(f).report).toMatchObject({ disposition: 'stay', reason: 'no-eligible-host' });
  f.input.staffing.reviewer.providerInstanceId = 'codex';
  const r = run(f); expect(r.status).toBe(2);
  expect(r.report).toMatchObject({ disposition: 'hold', reason: 'local-staffing-unproven' });
});

test('automatic switch off never waives local staffing', () => {
  const f = intakeFixture(); f.config.intakeRouting = false; delete f.input.staffing;
  expect(run(f).status).toBe(2);
});

test('missing runtime support is an unknown term with retained evidence', () => {
  const f = intakeFixture(); delete f.config.intakeSupport;
  const r = run(f);
  expect(r.report.terms).toContainEqual({ code: 'launch-support', state: 'unknown', evidence: null });
});

test('launch inputs require authority, scope content and origin identity', () => {
  for (const change of [
    (f) => { delete f.input.intake.grantCitation; },
    (f) => { delete f.input.intake.scope.content; },
    (f) => { delete f.input.origin.threadId; },
  ]) {
    const f = intakeFixture(); change(f);
    expect(run(f).status).toBe(2);
  }
});

test('observed native 0.1.5 mode omission retains supported driver staffing', () => {
  const f = intakeFixture();
  for (const [id, o] of Object.entries(f.input.nativeDestinations)) {
    const catalog = JSON.parse(o.capabilities.valueText);
    catalog.providers.forEach((p) => { delete p.runtimeModes; });
    o.capabilities.valueText = JSON.stringify(catalog);
    f.input.destinations.find((d) => d.environmentId === id).capabilitiesDigest =
      new Bun.CryptoHasher('sha256').update(o.capabilities.valueText).digest('hex');
  }
  const r = run(f); expect(r.status, r.error).toBe(0);
  expect(r.report.disposition).toBe('launch');
});

test('malformed catalog excludes only that host and exposes its failing evidence', () => {
  const f = intakeFixture();
  f.input.nativeDestinations['env-worker-a'].capabilities.valueText = '{"providers":{}}';
  const r = run(f); expect(r.status, r.error).toBe(0);
  expect(r.report.selected.hostId).toBe('worker-b');
  expect(r.report.terms.some((t) => t.environmentId === 'env-worker-a' && t.state !== 'pass')).toBe(true);
});

test('unknown reviewer provider cannot prove cross-provider local staffing', () => {
  const f = intakeFixture();
  const o = f.input.nativeDestinations['env-worker-a'];
  const catalog = JSON.parse(o.capabilities.valueText);
  delete catalog.providers[1].driverKind;
  o.capabilities.valueText = JSON.stringify(catalog);
  f.input.destinations[0].capabilitiesDigest = new Bun.CryptoHasher('sha256').update(o.capabilities.valueText).digest('hex');
  const r = run(f); expect(r.status, r.error).toBe(0);
  expect(r.report.selected.hostId).toBe('worker-b');
});
