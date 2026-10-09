import { expect, test } from 'bun:test';
import { existsSync, readFileSync, statSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const { scripts, engines, dependencies } = JSON.parse(readFileSync(`${root}/package.json`, 'utf8'));

test(`lockfile is readable by minimum Bun ${engines.bun}`, () => {
  // Bun 1.3.14 reads lockfile v1; newer Bun versions can write incompatible v2.
  const lock = readFileSync(`${root}/bun.lock`, 'utf8');
  expect(lock.match(/"lockfileVersion"\s*:\s*(\d+)/)?.[1]).toBe('1');
});

for (const [name, command] of [
  ['lint', /^biome\s+lint(?:\s|$)/],
  ['typecheck', /^bun\s+node_modules\/typescript\/bin\/tsc(?:\s|$)/],
]) {
  test(`contributors have a ${name} command`, () => {
    expect(typeof scripts[name]).toBe('string');
    expect(scripts[name]).toMatch(command);
  });
}

test('pre-commit checks lint and types without enforcing formatting', () => {
  const hook = `${root}/.husky/pre-commit`;
  expect(existsSync(hook)).toBe(true);
  expect(statSync(hook).mode & 0o111).toBeGreaterThan(0);
  const body = readFileSync(hook, 'utf8');
  expect(body).toMatch(/\bbun\s+run\s+lint\b/);
  expect(body).toMatch(/\bbun\s+run\s+typecheck\b/);
  expect(body).not.toMatch(/\bbiome\s+(?:check|format)\b|\bformat:check\b/);
});

test('tooling adds no runtime dependencies', () => {
  expect(dependencies ?? {}).toEqual({});
});

const skipMessage = 'axstack pre-commit: dev tools not installed; run `bun install` to enable lint/typecheck; skipping';

function hookFixture(tools) {
  const cwd = mkdtempSync(`${Bun.env.TMPDIR ?? '/tmp'}/axstack-hook-`);
  mkdirSync(`${cwd}/node_modules/.bin`, { recursive: true });
  for (const tool of tools) writeFileSync(`${cwd}/node_modules/.bin/${tool}`, '', { mode: 0o755 });
  return cwd;
}

for (const missing of ['biome', 'tsc']) {
  test(`hook skips when ${missing} is missing, even without Bun on PATH`, () => {
    const cwd = hookFixture(['biome', 'tsc'].filter((tool) => tool !== missing));
    const result = Bun.spawnSync(['/bin/sh', `${root}/.husky/pre-commit`], {
      cwd, env: { ...Bun.env, PATH: '/absent-dev-tools' }, stdout: 'pipe', stderr: 'pipe',
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString().trim()).toBe(skipMessage);
  });
}

test('installed hook runs lint and then typecheck', () => {
  const cwd = hookFixture(['biome', 'tsc']);
  writeFileSync(`${cwd}/package.json`, JSON.stringify({ scripts: { lint: 'bun lint.js', typecheck: 'bun types.js' } }));
  writeFileSync(`${cwd}/lint.js`, "console.log('lint ran');");
  writeFileSync(`${cwd}/types.js`, "console.log('typecheck ran');");
  const bunDir = process.execPath.slice(0, process.execPath.lastIndexOf('/'));
  const result = Bun.spawnSync(['/bin/sh', `${root}/.husky/pre-commit`], {
    cwd, env: { ...Bun.env, PATH: `${bunDir}:/usr/bin:/bin` }, stdout: 'pipe', stderr: 'pipe',
  });
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toBe('lint ran\ntypecheck ran\n');
});
