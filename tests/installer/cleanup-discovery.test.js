import { afterEach, expect, test } from 'bun:test';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli } from './helpers.js';

const ROOT = join(import.meta.dir, '../..');
const CLI = join(ROOT, 'bin', 'axstack.js');
const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('real bundle install exposes axstack-cleanup through Codex discovery', () => {
  const home = makeTempRoot('axstack-cleanup-discovery-');
  roots.push(home);

  runCli(CLI, [
    'install', '--preset', 'codex-only', '--bundle', ROOT,
    '--harness', 'codex', '--yes',
  ], { env: { HOME: home, CODEX_HOME: join(home, '.codex') } });

  const skill = join(home, '.agents', 'skills', 'axstack-cleanup', 'SKILL.md');
  expect(existsSync(skill)).toBe(true);
  expect(readFileSync(skill, 'utf8')).toContain('name: axstack-cleanup');
});
