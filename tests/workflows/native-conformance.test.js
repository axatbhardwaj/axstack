import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
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
}, 240_000);
