import { afterAll, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const repo = `${import.meta.dir}/../..`;
const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/scratch-consumer-`);
afterAll(() => rmSync(root, { recursive: true }));

test('documented repository test command runs a failing test and reports its failure', () => {
  const fixture = `${root}/repo`, parent = `${root}/parent`;
  mkdirSync(fixture, { mode: 0o700 });
  mkdirSync(parent, { mode: 0o700 });
  writeFileSync(`${fixture}/package.json`, JSON.stringify({ scripts: { test: 'bun test' } }));
  writeFileSync(`${fixture}/broken.test.js`, 'import { test, expect } from "bun:test"; test("deliberate failure", () => expect(1).toBe(2));');
  const doc = readFileSync(`${repo}/skills/axstack/references/workspace-hygiene.md`, 'utf8');
  const template = doc.match(/`bun <installed-axstack>\/scripts\/scratch\.js run -- ([^`]+)`/)?.[1];
  expect(template).toBeDefined();
  const command = template.split(/\s+/).flatMap((token) => {
    if (token === '<command>') return [process.execPath, 'run', 'test', 'broken.test.js'];
    if (token === '[args...]') return [];
    return [token === 'bun' ? process.execPath : token === '<test-path>' ? 'broken.test.js' : token.replace('<repo>', fixture)];
  });
  const result = Bun.spawnSync([process.execPath, `${repo}/skills/axstack/scripts/scratch.js`, 'run', '--root', parent, '--', ...command], {
    cwd: fixture, env: { ...process.env, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0' }, stdout: 'pipe', stderr: 'pipe',
  });
  expect(result.exitCode).toBe(0); // R2 measures the child; its failure is a separate field.
  expect(JSON.parse(result.stdout.toString()).child.exitCode).not.toBe(0);
  expect(result.stderr.toString()).toContain('deliberate failure');
});

test.each([
  'skills/axstack/references/workspace-hygiene.md',
  'skills/axstack/references/t3-runtime.md',
  'skills/axstack/references/automations.md',
  'skills/axstack-verify/SKILL.md',
  'skills/voa/references/verification.md',
  'skills/axstack/references/fleet-verification.md',
])('scratch consumer %s keeps a resolving helper pointer', (path) => {
  const source = readFileSync(`${repo}/${path}`, 'utf8');
  const link = source.match(/\[[^\]]+\]\(([^)]+\/scratch\.js)\)/)?.[1];
  expect(link).toBeDefined();
  expect(existsSync(`${repo}/${path.slice(0, path.lastIndexOf('/'))}/${link}`)).toBe(true);
});
