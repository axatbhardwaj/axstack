import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// The runnable recipe is the interface; this does not prove harness discovery.
const packageScripts = JSON.parse(readFileSync(`${import.meta.dir}/../../package.json`, 'utf8')).scripts;
const fullSuiteUsesRunner = (text, scripts) => /```bash\n[^`]*^bun\s+run\s+test:all(?:\s|$)/m.test(text)
  && /^bun\s+skills\/axstack\/scripts\/test-repository\.js$/.test(scripts['test:all']);
const recipe = readFileSync(`${import.meta.dir}/../../.agents/skills/verify-axstack/SKILL.md`, 'utf8');
test('verification launch uses rootless user/network namespaces and retains offline ownership guards', () => {
  const launch = recipe.split('## Launch')[1].split('## Doctor')[0];
  const flags = launch.match(/unshare ([^\n]+?) -- env -i/)?.[1]?.split(/\s+/) ?? [];
  expect(flags).toEqual(['--user', '--map-root-user', '--net']);
  expect(launch).toContain('HOME="$TMPDIR/home"');
  expect(recipe).toContain('test "$(stat -c \'%a:%u\' "$TMPDIR")" = "700:$(id -u)"');
  expect(recipe).toContain('test "$(readlink /proc/self/ns/net)" != "$HOST_NET"');
  expect(fullSuiteUsesRunner(recipe, packageScripts)).toBe(true);
});

// Positive runnable edge; repository-test-runner.test.js owns DAC/context behavior.
test('verification full suite loads the permission-aware runner through its declared script', () => {
  expect(fullSuiteUsesRunner(recipe, packageScripts)).toBe(true);
  expect(fullSuiteUsesRunner(recipe.replace('bun run test:all', ''), packageScripts)).toBe(false);
  expect(fullSuiteUsesRunner(recipe.replace('bun run test:all', 'bun test'), packageScripts)).toBe(false);
  expect(fullSuiteUsesRunner(recipe.replace('bun run test:all', '# bun run test:all'), packageScripts)).toBe(false);
  expect(fullSuiteUsesRunner(recipe.replace('bun run test:all', 'bun   run   test:all'), packageScripts)).toBe(true);
  expect(fullSuiteUsesRunner(recipe, { ...packageScripts, 'test:all': 'bun test' })).toBe(false);
});
