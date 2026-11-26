import { expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { makeTempRoot } from '../installer/helpers.js';
import { fakeFleet, targets, workflow } from './release-reinstall-fixture.js';

const source = new URL('../../skills/axstack/workflows/', import.meta.url).pathname;
const runId = 'f'.repeat(32);
const linuxTest = test.skipIf(process.platform !== 'linux');
const command = Bun.env.AXSTACK_C11_ENTRY_DIR || source;
const baseline = Bun.spawnSync([process.execPath, 'build', 'entries/' + workflow + '.mjs', '--target=node', '--format=esm'], {
  cwd: command,
});
const runner = `
import { writeFileSync } from 'node:fs';
const [file, record, release, id, seeded] = Bun.argv.slice(1);
const unit = (run) => ({ *[Symbol.iterator]() { return yield run; }, run });
const gen = (f) => unit(async () => {
  const op = f();
  let next = op.next();
  while (!next.done) next = op.next(await next.value());
  return next.value;
});
const values = new Map(JSON.parse(seeded));
const calls = [];
const steps = [];
globalThis.Schema = { Json: {}, String: {}, Boolean: {}, Struct: (value) => value };
globalThis.Option = { isSome: (option) => option.value !== undefined,
  getOrElse: (option, fallback) => option.value === undefined ? fallback() : option.value };
globalThis.Effect = { gen, promise: unit, fail: (error) => unit(() => { throw error; }) };
globalThis.T3 = {
  workflow: (_name, _options, body) => body,
  sleep: (name) => unit(() => { steps.push(name); }),
  stop: (reason) => unit(() => ({ stopped: reason })),
  step: (name, _options, work) => unit(async () => {
    steps.push(name);
    return work.run();
  }),
  store: {
    transaction: (work) => work,
    entry: (key) => ({
      get: unit(() => ({ value: values.get(key) })),
      set: (value) => unit(() => values.set(key, value)),
    }),
  },
  agent: { try: (name, config) => unit(() => {
    steps.push(name);
    calls.push(config);
    writeFileSync(record, JSON.stringify(calls));
    return { outcome: 'done', thread: { threadId: 'workflow:fixture' } };
  }) },
};
const entry = (await import(file)).default;
try {
  const result = await entry({ version: release }, { id }).run();
  console.log(JSON.stringify({ result, calls, steps, store: [...values] }));
} catch (error) {
  console.log(JSON.stringify({ hold: error.message, calls, steps, store: [...values] }));
}
`;

function replay(options = {}) {
  expect(baseline.exitCode, baseline.stderr.toString()).toBe(0);
  const root = makeTempRoot('axstack-release-decision-');
  const home = root + '/home';
  const base = home + '/.t3';
  const workflows = base + '/workflows';
  for (const dir of [workflows, base + '/userdata', root + '/project']) mkdirSync(dir, { recursive: true });
  const env = { HOME: home, PATH: Bun.env.PATH, TMPDIR: root };
  const fixture = fakeFleet({ root, home, base, workflows, project: root + '/project', env, t3: '/fixture/t3' },
    baseline.stdout);
  fixture.changeBinding({ agent: true, ...options.binding });
  for (const host of targets) fixture.host(host, { version: '1.2.3' });
  fixture.host(options.host ?? 'iobook', { version: '1.2.2', ...options.hostState });
  fixture.registry(options.registry ?? {});
  const result = Bun.spawnSync([process.execPath, '-e', runner, workflows + '/' + workflow + '-v1.mjs', fixture.prompts,
    options.version ?? 'v1.2.3', options.id ?? runId, JSON.stringify(options.store ?? [])], { env, timeout: 25_000 });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  const actual = { ...JSON.parse(result.stdout.toString()), writes: fixture.writes(), events: fixture.events() };
  if (Bun.env.AXSTACK_C11_REPLAY_EVIDENCE && options.label) {
    writeFileSync(Bun.env.AXSTACK_C11_REPLAY_EVIDENCE + '/decision-' + options.label + '.json',
      JSON.stringify(actual, null, 2));
  }
  return actual;
}

const claims = (phase, run = runId, leasePhase = phase, release = 'v1.2.3') => {
  const claim = { run, release, phase };
  return [
    ['release-reinstall:release:' + release + ':iobook', claim],
    ['release-reinstall:host:iobook', { ...claim, phase: leasePhase }],
  ];
};

linuxTest.each([
  ['install-exit', { hostState: { exit: 42 } }, 'install exited nonzero'],
  ['receipt-mismatch', { hostState: { mismatch: 'default-sync' } }, 'verification mismatch'],
  ['single-server-disabled', { hostState: { mismatch: 'single-server', disabledAfter: true } }, 'verification mismatch'],
  ['installed-skill-missing', { hostState: { missingSkills: true } }, 'verification mismatch'],
  ['agent-readback', { hostState: { mismatch: true, agentMismatch: true } }, 'binding or transcript mismatched'],
])('failure replay %s reports only to the bound failure agent', (label, options, reason) => {
  const actual = replay({ ...options, label });
  expect(actual.hold).toContain(reason);
  if (label !== 'agent-readback') expect(actual.hold).not.toContain('failure agent');
  expect(actual.writes.filter((write) => write === 'iobook reinstall 1.2.3')).toHaveLength(1);
  expect(actual.calls).toEqual([{
    project: expect.stringMatching(/\/project$/), title: 'Axstack release reinstall failure', timeout: '10 minutes',
    brief: 'AXSTACK-WAKE axstack-release-reinstall@1 run ' + runId +
      '\n\nRead this T3 workflow run and report the release reinstall failure in this thread. The release driver owns recovery and hold clearance.',
    model: { instanceId: 'codex', model: 'gpt-6.2-sol', options: [{ id: 'reasoningEffort', value: 'high' }] },
    runtimeMode: 'full-access',
  }]);
});

linuxTest.each([
  ['payload-format', { version: 'v1.2.3-2' }, 'invalid release payload'],
  ['payload-whitespace', { version: 'v1.2.3\n' }, 'invalid release payload'],
  ['run-id', { id: 'invalid run id' }, 'invalid release payload'],
  ['binding-digest', { binding: { digest: '0'.repeat(64) } }, 'private binding'],
  ['binding-mode', { binding: { insecureBinding: true } }, 'private binding'],
  ['script-digest', { binding: { scriptDigest: '0'.repeat(64) } }, 'private binding'],
  ['host-set', { binding: { missingHost: true } }, 'private binding'],
  ['local-host', { binding: { wrongLocalHostname: true } }, 'local execution host'],
  ['latest-unknown', { registry: { latest: ['1.2.3'] } }, 'registry latest is unknown'],
  ['latest-newer', { registry: { latest: 'v1.2.4' } }, 'older than npm latest'],
  ['latest-older', { registry: { latest: 'v1.2.2' } }, 'ahead of npm latest'],
  ['tarball-invalid', { registry: { invalidMetadata: true } }, 'tarball metadata'],
  ['tarball-integrity', { registry: { invalidIntegrity: true } }, 'tarball metadata'],
  ['tarball-unavailable', { registry: { unavailable: 10 } }, 'tarball not fetchable'],
  ['unreachable', { hostState: { offline: true } }, 'iobook=host unreachable'],
  ['malformed-host', { hostState: { malformed: true } }, 'iobook=host evidence unknown'],
  ['incomplete-receipt', { hostState: { doneReceipt: { packageSkills: 'absent' } } }, 'iobook=host evidence unknown'],
  ['receipt-default-sync-inactive', { hostState: { doneReceipt: { defaultActive: 'inactive' } } }, 'iobook=host evidence unknown'],
  ['receipt-default-sync-disabled', { hostState: { doneReceipt: { defaultEnabled: 'disabled' } } }, 'iobook=host evidence unknown'],
  ['receipt-single-server-inactive', { hostState: { doneReceipt: { singleActive: 'inactive' } } }, 'iobook=host evidence unknown'],
  ['receipt-single-server-disabled', { hostState: { doneReceipt: { singleEnabled: 'disabled' } } }, 'iobook=host evidence unknown'],
  ['required-timer-unknown', { hostState: { timerUnknown: 'axstack-default-sync.timer' } }, 'iobook=host evidence unknown'],
  ['single-server-unknown', { hostState: { timerUnknown: 'axstack-single-server.timer' } }, 'iobook=host evidence unknown'],
  ['required-timer-disabled', { hostState: { disabled: true } }, 'iobook=required timer inactive or disabled'],
  ['host-newer', { hostState: { version: '1.2.4' } }, 'iobook=installed release is newer'],
  ['host-moved', { hostState: { newerOnApply: true } }, 'iobook=installed release is newer'],
  ['host-pkg-unknown', { hostState: { malformedPackage: true } }, 'iobook=host evidence unknown'],
  ['release-host-claim', { store: claims('writing', 'another') }, 'iobook=host already claimed'],
  ['cross-release-claim', { store: claims('writing', 'another', 'writing', 'v1.2.2') }, 'iobook=host already claimed'],
  ['inconsistent-claim', { store: claims('reading', runId, 'writing') }, 'iobook=host claim evidence is unknown'],
  ['resumed-write', { store: claims('writing') }, 'iobook=prior write needs readback'],
  ['registry-moved-before-write', { registry: { latestAt: 2 } }, 'iobook=release is older than npm latest'],
  ['binding-moved-before-write', { host: 'axat-vps', registry: { changeBindingAt: 2 } }, 'axat-vps=private binding'],
])('hold replay %s has zero host writes and zero agent invocations', (label, options, reason) => {
  const actual = replay({ ...options, label });
  expect(actual.hold ?? 'workflow completed').toContain(reason);
  expect(actual.writes).toEqual([]);
  expect(actual.calls).toEqual([]);
}, 30_000);

linuxTest('failure replay vps rejects a tarball whose bytes disagree with npm integrity', () => {
  const actual = replay({ host: 'axat-vps', registry: { badVpsIntegrity: true }, label: 'bad-vps-integrity' });
  expect(actual.hold).toContain('axat-vps=install exited nonzero');
  expect(actual.writes).toEqual(['axat-vps reinstall 1.2.3']);
  expect(actual.calls).toHaveLength(1);
});

linuxTest('success replay vps-clean-harness clears the shadow Claude environment for each harness', () => {
  const actual = replay({ host: 'axat-vps', label: 'vps-clean-harness' });
  expect(actual.result.hosts['axat-vps'].bunGlobal).toBe('v1.2.3');
  expect(actual.writes).toEqual([
    'axat-vps reinstall 1.2.3', 'axat-vps claude clean', 'axat-vps codex clean',
    'axat-vps opencode clean --no-claude-settings', 'axat-vps bun-global axstack@1.2.3',
  ]);
  expect(actual.calls).toEqual([]);
});
