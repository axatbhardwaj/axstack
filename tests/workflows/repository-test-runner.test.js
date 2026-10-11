import { afterAll, expect, test } from 'bun:test';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';

const repo = `${import.meta.dir}/../..`;
const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/repository-test-runner-`);
afterAll(() => rmSync(root, { recursive: true }));
const scripts = (await Bun.file(`${repo}/package.json`).json()).scripts;
const runner = 'skills/axstack/scripts/test-repository.js';
const linuxRoot = process.platform === 'linux' && process.getuid() === 0;

function fixture(source) {
  const cwd = mkdtempSync(`${root}/case-`);
  writeFileSync(`${cwd}/package.json`, JSON.stringify({ scripts }));
  writeFileSync(`${cwd}/fixture.test.js`, source);
  // Exercise the declared scripts with the actual helper bytes, including pre-fix scripts.
  if (existsSync(`${repo}/${runner}`)) {
    mkdirSync(`${cwd}/skills/axstack/scripts`, { recursive: true });
    copyFileSync(`${repo}/${runner}`, `${cwd}/${runner}`);
  }
  return cwd;
}

function run(cwd, name = 'test', args = [], options = {}) {
  const result = Bun.spawnSync([process.execPath, 'run', name, ...args], {
    cwd, stdout: 'pipe', stderr: 'pipe', ...options,
  });
  return { code: result.exitCode, output: result.stdout.toString() + result.stderr.toString() };
}

for (const name of ['test', 'test:all']) {
  test(`${name} preserves permission denials and forwards test selection`, () => {
    const cwd = fixture(`import { expect, test } from 'bun:test';
import { chmodSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
test('permission denial', () => {
  mkdirSync('locked'); writeFileSync('locked/file', 'private'); chmodSync('locked', 0o555);
  try { expect(() => unlinkSync('locked/file')).toThrow(); }
  finally { chmodSync('locked', 0o700); }
});
test('excluded failure', () => { throw Error('selection was lost'); });`);
    const result = run(cwd, name, ['fixture.test.js', '--test-name-pattern', 'permission denial']);
    expect(result.output).toContain('1 pass');
    expect(result.output).not.toContain('(fail)');
    expect(result.code).toBe(0);
  });
}

test('declared test script returns the failing test exit', () => {
  const cwd = fixture("import { expect, test } from 'bun:test'; test('failure', () => expect(1).toBe(2));");
  const result = run(cwd, 'test', ['fixture.test.js']);
  expect(result.output).toContain('1 fail');
  expect(result.code).toBe(1);
});

test.skipIf(!linuxRoot)('root holds when setpriv is unavailable instead of running privileged tests', () => {
  const cwd = fixture("import { test } from 'bun:test'; test('should not run', () => console.log('UNSAFE_TEST_RAN'));");
  mkdirSync(`${cwd}/bin`);
  symlinkSync(process.execPath, `${cwd}/bin/bun`);
  const result = run(cwd, 'test', ['fixture.test.js'], { env: { ...process.env, PATH: `${cwd}/bin` } });
  expect(result.code).toBe(2);
  expect(result.output).toContain('setpriv');
  expect(result.output).not.toContain('UNSAFE_TEST_RAN');
});

test.skipIf(process.getuid() === 0)('non-root runs without setpriv', () => {
  const cwd = fixture("import { test } from 'bun:test'; test('ordinary user', () => console.log('USER_TEST_RAN'));");
  mkdirSync(`${cwd}/bin`);
  symlinkSync(process.execPath, `${cwd}/bin/bun`);
  const result = run(cwd, 'test', ['fixture.test.js'], { env: { ...process.env, PATH: `${cwd}/bin` } });
  expect(result.code).toBe(0);
  expect(result.output).toContain('1 pass');
  expect(result.output).toContain('USER_TEST_RAN');
});
