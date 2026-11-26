import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot } from '../installer/helpers.js';

const runtime = join(import.meta.dir, '../../skills/axstack/workflows/conformance/isolated.mjs');

test('conformance rejects the default T3 base and its symlink aliases before an operation', async () => {
  const root = makeTempRoot('axstack-conformance-guard-');
  const home = join(root, 'home');
  const live = join(home, '.t3');
  const scratch = join(root, 'isolated');
  const alias = join(root, 'alias');
  mkdirSync(live, { recursive: true });
  mkdirSync(scratch);
  symlinkSync(live, alias);
  expect(existsSync(runtime)).toBe(true);
  const { assertIsolatedBase } = await import(runtime);
  expect(() => assertIsolatedBase(live, home)).toThrow(/default T3 base/);
  expect(() => assertIsolatedBase(alias, home)).toThrow(/default T3 base/);
  expect(() => assertIsolatedBase(join(scratch, '.t3'), home)).not.toThrow();
});

test('the persistence replay rejects an aliased default base before starting either run', async () => {
  const root = makeTempRoot('axstack-persistence-guard-');
  const home = join(root, 'home');
  const base = join(root, 'aliased-base');
  const workflows = join(root, 'workflows');
  const marker = join(root, 'command-started');
  mkdirSync(join(home, '.t3'), { recursive: true });
  mkdirSync(workflows);
  symlinkSync(join(home, '.t3'), base);
  const fixtureT3 = join(root, 't3');
  writeFileSync(fixtureT3, `#!${process.execPath}
await Bun.write(${JSON.stringify(marker)}, 'started');
console.log(JSON.stringify({ run: { runId: 'fixture-run' } }));
`, { mode: 0o700 });

  const { assertIsolatedBase } = await import(runtime);
  const { runLocalCases } = await import(join(runtime, '../local.mjs'));
  const refuse = () => assertIsolatedBase(base, home);
  const report = await runLocalCases({
    root, base, workflows, t3: fixtureT3, env: {},
    restart: async () => {}, stop: refuse, start: refuse, startAsync: async () => refuse(), waitFor: refuse,
  });
  expect(existsSync(marker)).toBe(false);
  expect(report['POC-7']).toEqual({ status: 'fail', detail: 'refusing the default T3 base' });
});

const t3 = Bun.which('t3');
test.skipIf(!t3)('isolated T3 replays local conformance cases (skips when t3 is absent from PATH)', async () => {
  const path = join(import.meta.dir, '../../skills/axstack/workflows/conformance/local.mjs');
  expect(existsSync(path)).toBe(true);
  const { runLocalCases } = await import(path);
  const { usingIsolatedT3 } = await import(runtime);
  const report = await usingIsolatedT3({ t3 }, runLocalCases);
  expect(report).toMatchObject({
    'POC-2': { status: 'pass' },
    'POC-3': { status: 'pass' },
    'POC-5': { status: 'pass' },
    'POC-7': { status: 'pass' },
    'POC-9': { status: 'pass' },
  });
}, 360_000);

test.skipIf(!t3)('the real T3 loader accepts bound fixtures with object-shaped provider settings', async () => {
  const { usingIsolatedT3 } = await import(runtime);
  const { provision } = await import(join(runtime, '../provision.mjs'));
  const fixture = (server, name, json) => {
    const file = join(server.root, name);
    writeFileSync(file, JSON.stringify(json), { mode: 0o600 });
    return file;
  };
  await usingIsolatedT3({
    t3,
    beforeStart: (server, settings) => provision(server, settings, {
      providers: { settings: fixture(server, 'provider-settings.json', { providerInstances: {} }), secrets: [] },
      forge: { repo: 'fixture-org/disposable', absentRepo: 'fixture-org/absent', cases: {},
        config: fixture(server, 'forge-config.json', {}) },
      ssh: {},
      linear: { clientFile: fixture(server, 'executor-client.json', { mcpServers: {} }),
        endpoint: 'https://example.invalid/mcp', tool: 'linear_app.fixture.list_issues' },
    }),
  }, async (server) => {
    const run = server.start('ax-conf-linear', 'missing-credential');
    expect((await server.waitFor(run.runId, 'completed')).result).toEqual({ status: 'unknown' });
  });
}, 60_000);
