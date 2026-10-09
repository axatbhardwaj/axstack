import { expect, test } from 'bun:test';
import { existsSync, readFileSync, statSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const { scripts, engines } = JSON.parse(readFileSync(`${root}/package.json`, 'utf8'));

test(`lockfile is readable by minimum Bun ${engines.bun}`, () => {
  // Bun 1.3.14 reads lockfile v1; newer Bun versions can write incompatible v2.
  const lock = readFileSync(`${root}/bun.lock`, 'utf8');
  expect(lock.match(/"lockfileVersion"\s*:\s*(\d+)/)?.[1]).toBe('1');
});

for (const name of ['lint', 'typecheck']) {
  test(`contributors have a ${name} command`, () => {
    expect(typeof scripts[name]).toBe('string');
    expect(scripts[name].trim().length).toBeGreaterThan(0);
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
