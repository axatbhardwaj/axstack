import { expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { usingIsolatedT3 } from '../../skills/axstack/workflows/conformance/isolated.mjs';
import { missingResources } from '../../skills/axstack/workflows/conformance/provision.mjs';
import { makeTempRoot } from '../installer/helpers.js';

test('the isolated T3 server receives only the explicitly bound sandbox flag across restarts', async () => {
  const root = makeTempRoot('axstack-isolated-env-');
  const t3 = root + '/t3';
  const captured = root + '/started.jsonl';
  writeFileSync(t3, `#!${process.execPath}
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (args[0] === '--version') {
  console.log('t3 v0.1.12');
  process.exit(0);
}
const value = (name) => args[args.indexOf(name) + 1];
await Bun.write(value('--base-dir') + '/userdata/server-runtime.json', JSON.stringify({ pid: process.pid }));
appendFileSync(${JSON.stringify(captured)}, JSON.stringify({
  flag: process.env.IS_SANDBOX ?? null,
  serverHome: process.env.HOME, injected: process.env.FIXTURE_SECRET ?? null,
}) + '\\n');
Bun.serve({ hostname: value('--host'), port: Number(value('--port')), fetch: () => new Response('fixture') });
`, { mode: 0o700 });
  await usingIsolatedT3({ t3 }, () => {});
  await usingIsolatedT3({ t3, isolatedEnv: { IS_SANDBOX: '1' } }, (server) => server.restart());
  await expect(usingIsolatedT3({ t3, isolatedEnv: { FIXTURE_SECRET: 'sentinel' } }, () => {}))
    .rejects.toThrow(/isolated environment/);
  const launches = readFileSync(captured, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  expect(launches.map(({ flag, injected }) => ({ flag, injected }))).toEqual([
    { flag: null, injected: null }, { flag: '1', injected: null }, { flag: '1', injected: null },
  ]);
  expect(launches.every(({ serverHome }) => serverHome !== Bun.env.HOME)).toBe(true);
}, 15_000);

test('private binding rejects arbitrary environment and insecure Executor targets', () => {
  expect(missingResources({ isolatedEnv: { PATH: '/tmp/bin' } })).toContain('isolated environment');
  expect(missingResources({ isolatedEnv: { IS_SANDBOX: 'secret-like-value' } })).toContain('isolated environment');
  const linear = { clientFile: '/private/executor.json', tool: 'linear_app.fixture.list_issues' };
  const requirement = 'Executor Linear read fixture';
  expect(missingResources({ linear: { ...linear, endpoint: 'http://127.0.0.1:1234/mcp', loopback: true } }))
    .not.toContain(requirement);
  for (const endpoint of ['http://127.0.0.1:1234/mcp', 'http://127.0.0.1.example.invalid:1234/mcp',
    'http://127.0.0.1:1234@remote.invalid/mcp']) {
    expect(missingResources({ linear: { ...linear, endpoint, loopback: false } })).toContain(requirement);
  }
  expect(missingResources({ linear: { ...linear, endpoint: 'http://192.0.2.1:1234/mcp', loopback: true } }))
    .toContain(requirement);
});
