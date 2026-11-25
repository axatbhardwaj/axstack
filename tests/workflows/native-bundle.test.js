import { expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from '../../src/posixpath.js';

const workflows = join(import.meta.dir, '../../skills/axstack/workflows');
const bundled = join(workflows, 'bundles');
const probe = 'axstack-load-probe';

test('each catalogued workflow ships one entry that matches a fresh Bun build and loads with T3 globals', async () => {
  const catalogFile = join(workflows, 'catalog.json');
  expect(existsSync(catalogFile)).toBe(true);
  const catalog = JSON.parse(readFileSync(catalogFile, 'utf8'));
  expect(catalog[probe]).toBeGreaterThanOrEqual(1);
  expect(readdirSync(bundled).sort()).toEqual(Object.entries(catalog).map(([name, version]) => name + '-v' + version + '.mjs').sort());
  for (const [name, version] of Object.entries(catalog)) {
    const file = join(bundled, name + '-v' + version + '.mjs');
    const build = Bun.spawnSync([
      process.execPath, 'build', 'entries/' + name + '.mjs', '--target=node', '--format=esm',
    ], { cwd: workflows });
    expect(build.stderr.toString()).toBe('');
    expect(build.exitCode).toBe(0);
    expect(build.stdout.toString()).toBe(readFileSync(file, 'utf8'));
    const loaded = Bun.spawnSync([process.execPath, '-e', `
      const type = new Proxy({}, { get: () => () => ({}) });
      Object.assign(globalThis, {
        T3: { workflow: (name, options, body) => ({ name, options, hasBody: typeof body === 'function' }) },
        Effect: type, Schema: type, Option: type, Duration: type, Schedule: type,
      });
      console.log(JSON.stringify((await import(Bun.argv[1])).default));
    `, file]);
    expect(loaded.stderr.toString()).toBe('');
    expect(loaded.exitCode).toBe(0);
    expect(JSON.parse(loaded.stdout.toString())).toMatchObject({ name, options: { version }, hasBody: true });
  }
});

test('binding decision fails closed for a missing, malformed or changed digest', async () => {
  const path = join(workflows, 'binding.mjs');
  expect(existsSync(path)).toBe(true);
  const { bindingMatches } = await import(path);
  const digest = 'a'.repeat(64);
  expect(bindingMatches(digest, digest)).toBe(true);
  expect(bindingMatches(digest, 'b'.repeat(64))).toBe(false);
  expect(bindingMatches(undefined, undefined)).toBe(false);
  expect(bindingMatches('x', 'x')).toBe(false);
});
