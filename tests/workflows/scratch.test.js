import { afterAll, expect, test } from 'bun:test';
import { checkRule, prohibits, requires } from './prose-contract.js';
import { chmodSync, chownSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync,
  symlinkSync, writeFileSync } from 'node:fs';

const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/scratch-test-`);
const helper = `${import.meta.dir}/../../skills/axstack/scripts/scratch.js`;
afterAll(() => rmSync(root, { recursive: true }));
function directory(prefix = 'case-') { return mkdtempSync(`${root}/${prefix}`); }
let canChangeOwner = false;
if (process.getuid() === 0) {
  const probe = directory('owner-probe-');
  try { chownSync(probe, 65534, 65534); canChangeOwner = true; } catch (error) {
    if (!['EPERM', 'EINVAL'].includes(error.code)) throw error;
  } finally {
    if (canChangeOwner) chownSync(probe, process.getuid(), process.getgid());
    rmSync(probe, { recursive: true });
  }
}
function invoke(args, cwd, env = {}) {
  const result = Bun.spawnSync([process.execPath, helper, ...args], {
    cwd, env: { ...process.env, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0', ...env },
    stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
  });
  return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
}
function inventory(path) {
  return readdirSync(path, { recursive: true }).sort().map((entry) => {
    const file = `${path}/${entry}`, stat = lstatSync(file);
    return [entry, stat.mode, stat.uid, stat.isFile() ? readFileSync(file, 'utf8') : null];
  });
}
const writer = [process.execPath, '-e', `
  await Bun.write('relative.txt', 'cwd write');
  await Bun.write(process.env.TMPDIR + '/temporary.txt', 'temp write');
`];

test('a cwd/TMPDIR-honouring child leaves the outside inventory unchanged', () => {
  const outside = directory('outside-'), temp = directory('parent-');
  writeFileSync(`${outside}/keep.txt`, 'untouched');
  const before = inventory(outside);
  const result = invoke(['run', '--', ...writer], outside, { TMPDIR: temp });
  expect(result.code, result.err).toBe(0);
  expect(inventory(outside)).toEqual(before);
  const report = JSON.parse(result.out);
  expect(report.root.startsWith(`${temp}/axstack-scratch-`)).toBe(true);
  expect(report.cwd).toBe(`${report.root}/cwd`);
  expect(report.tmp).toBe(`${report.root}/tmp`);
  expect(readFileSync(`${report.cwd}/relative.txt`, 'utf8')).toBe('cwd write');
  expect(readFileSync(`${report.tmp}/temporary.txt`, 'utf8')).toBe('temp write');
  for (const path of [report.root, report.cwd, report.tmp]) {
    expect(lstatSync(path).mode & 0o777).toBe(0o700);
    expect(lstatSync(path).uid).toBe(process.getuid());
  }
  expect(JSON.parse(readFileSync(`${report.root}/owner.json`, 'utf8'))).toEqual({
    version: 1, kind: 'axstack-scratch', uid: process.getuid(),
    root: report.root, cwd: report.cwd, tmp: report.tmp,
  });
  expect(report.child.exitCode).toBe(0);
  expect(readdirSync(temp)).toEqual([report.root.slice(temp.length + 1)]);
});

test.each(['absent', 'world-writable', 'under HOME', 'symlink', 'ancestor symlink'])('%s TMPDIR falls back to a private stamped root', (kind) => {
  const outside = directory(), home = directory(), temp = directory();
  let inherited = temp;
  if (kind === 'absent') inherited = undefined;
  if (kind === 'world-writable') chmodSync(temp, 0o777);
  if (kind === 'under HOME') inherited = home;
  if (kind.includes('symlink')) {
    symlinkSync(temp, `${outside}/link`);
    inherited = `${outside}/link`;
    if (kind === 'ancestor symlink') {
      mkdirSync(`${temp}/nested`, { mode: 0o700 });
      inherited += '/nested';
    }
  }
  const result = invoke(['run', '--', ...writer], outside, { HOME: home, TMPDIR: inherited });
  expect(result.code, result.err).toBe(0);
  const report = JSON.parse(result.out);
  try {
    expect(report.root.startsWith('/tmp/axstack-scratch-')).toBe(true);
    expect(report.root.startsWith(`${home}/`)).toBe(false);
    expect(readFileSync(`${report.tmp}/temporary.txt`, 'utf8')).toBe('temp write');
    expect(report.terms.some((term) => term.id === 'parent' && term.status === 'pass')).toBe(true);
  } finally {
    if (report.root.startsWith('/tmp/axstack-scratch-')) rmSync(report.root, { recursive: true });
  }
});

test.each(['trailing slash', 'doubled slash'])('%s TMPDIR outside HOME records paths accepted by plan', (kind) => {
  const outside = directory(), home = directory(), parent = directory();
  const inherited = kind === 'trailing slash' ? `${parent}/` : `/${parent}`;
  const result = invoke(['run', '--', ...writer], outside, { HOME: home, TMPDIR: inherited });
  expect(result.code, result.err).toBe(0);
  const run = JSON.parse(result.out);
  expect(run.root.startsWith(`${parent}/axstack-scratch-`)).toBe(true);
  expect(run.root).not.toContain('//');
  const plan = invoke(['plan', '--root', run.root], outside, { HOME: home });
  expect(plan.code).toBe(0);
  expect(JSON.parse(plan.out).terms.every((term) => term.status === 'pass')).toBe(true);
});

test('dot components outside HOME are rejected independently of the HOME boundary', () => {
  const outside = directory(), home = directory(), parent = directory();
  const inherited = `${parent}/../${parent.split('/').at(-1)}`;
  const result = invoke(['run', '--', ...writer], outside, { HOME: home, TMPDIR: inherited });
  expect(result.code, result.err).toBe(0);
  const run = JSON.parse(result.out);
  try {
    expect(run.root.startsWith('/tmp/axstack-scratch-')).toBe(true);
    expect(run.terms.find((term) => term.id === 'path').status).toBe('fail');
    expect(readdirSync(parent)).toEqual([]);
  } finally {
    if (run.root.startsWith('/tmp/axstack-scratch-')) rmSync(run.root, { recursive: true });
  }
});

test('world-writable non-sticky ancestor holds before any child runs', () => {
  const outside = directory(), ancestor = directory();
  const parent = `${ancestor}/parent`;
  mkdirSync(parent, { mode: 0o700 });
  chmodSync(ancestor, 0o777);
  const result = invoke(['run', '--root', parent, '--', ...writer], outside);
  expect(result.code).toBe(2);
  expect(readdirSync(parent)).toEqual([]);
});

for (const kind of ['world-writable', 'other-owned', 'under HOME', 'symlink', 'ancestor symlink']) {
test.skipIf(kind === 'other-owned' && !canChangeOwner)(`${kind} explicit parent holds without launching or writing`, () => {
  const outside = directory(), home = directory(), parent = directory();
  let path = parent;
  if (kind === 'world-writable') chmodSync(parent, 0o777);
  if (kind === 'other-owned') chownSync(parent, 65534, 65534);
  if (kind === 'under HOME') path = home;
  if (kind.includes('symlink')) {
    symlinkSync(parent, `${outside}/link`);
    path = `${outside}/link`;
    if (kind === 'ancestor symlink') {
      mkdirSync(`${parent}/nested`, { mode: 0o700 });
      path += '/nested';
    }
  }
  try {
    const result = invoke(['run', '--root', path, '--', ...writer], outside, { HOME: home });
    expect(result.code).toBe(2);
    expect(readdirSync(outside)).toEqual(kind.includes('symlink') ? ['link'] : []);
    expect(JSON.parse(result.out).terms.some((term) => term.status === 'fail')).toBe(true);
    const plan = invoke(['plan', '--root', path], outside, { HOME: home });
    expect(plan.code).toBe(0);
    expect(JSON.parse(plan.out).terms.some((term) => term.status === 'fail')).toBe(true);
    if (kind === 'other-owned') chownSync(parent, process.getuid(), process.getgid());
    expect(readdirSync(parent)).toEqual(kind === 'ancestor symlink' ? ['nested'] : []);
  } finally {
    if (kind === 'other-owned') chownSync(parent, process.getuid(), process.getgid());
  }
});
}

test('plan measures only named roots and never changes bytes or inventories', () => {
  const outside = directory(), parent = directory();
  const run = JSON.parse(invoke(['run', '--root', parent, '--', ...writer], outside).out);
  const before = inventory(parent);
  const measured = invoke(['plan', '--root', run.root], outside);
  expect(measured.code, measured.err).toBe(0);
  const report = JSON.parse(measured.out);
  expect(report.roots).toEqual([run.root]);
  expect(report.terms.length).toBeGreaterThan(0);
  expect(report.terms.every((term) => term.status === 'pass')).toBe(true);
  expect(inventory(parent)).toEqual(before);
  const missing = `${parent}/missing`;
  const incomplete = invoke(['plan', '--root', run.root, '--root', missing], outside);
  expect(incomplete.code).toBe(2);
  expect(JSON.parse(incomplete.out).terms.some((term) => term.root === missing && term.status === 'unknown')).toBe(true);
  expect(inventory(parent)).toEqual(before);
});

test('plan reports unowned roots and symlinked stamps without following them', () => {
  const outside = directory(), parent = directory();
  const run = JSON.parse(invoke(['run', '--root', parent, '--', ...writer], outside).out);
  const stamp = `${run.root}/owner.json`, saved = readFileSync(stamp, 'utf8');
  writeFileSync(stamp, saved.replace('axstack-scratch', 'someone-else'));
  let result = invoke(['plan', '--root', run.root], outside);
  expect(result.code).toBe(0); // a measured failure is not an execution error
  expect(JSON.parse(result.out).terms.find((term) => term.id === 'stamp').status).toBe('fail');
  rmSync(stamp);
  writeFileSync(`${outside}/private.json`, saved);
  symlinkSync(`${outside}/private.json`, stamp);
  const before = inventory(outside);
  result = invoke(['plan', '--root', run.root], outside);
  expect(result.code).toBe(0);
  expect(JSON.parse(result.out).terms.find((term) => term.id === 'stamp').status).toBe('fail');
  expect(inventory(outside)).toEqual(before);
});

test('child failure is separate from helper measurement and child output stays out of JSON', () => {
  const outside = directory(), parent = directory();
  const result = invoke(['run', '--root', parent, '--', process.execPath, '-e', 'console.log("child stdout"); process.exit(7)'], outside);
  expect(result.code).toBe(0);
  expect(JSON.parse(result.out).child.exitCode).toBe(7);
  expect(result.err).toContain('child stdout');
});

test('permission gaps remain unknown and hold instead of reporting a measured failure', () => {
  const outside = directory(), parent = directory();
  writeFileSync(`${outside}/not-executable`, '#!/bin/sh\nexit 0\n', { mode: 0o600 });
  const result = invoke(['run', '--root', parent, '--', `${outside}/not-executable`], outside);
  expect(result.code).toBe(2);
  expect(JSON.parse(result.out).terms.find((term) => term.id === 'execution').status).toBe('unknown');
});

test('help distinguishes child results from helper exit and selects the repository explicitly', () => {
  const help = invoke(['--help'], directory());
  expect(help.code).toBe(0);
  expect(requires(help.out, /Child exitCode and signal/i, /stored separately/i)).toBe(true);
  checkRule(help.out, (text) => prohibits(text, /does not (?:mean|imply)/i, /helper exit 0/i, /child (?:passed|succeeded)/i),
    'Helper exit 0 does not imply that the child succeeded.',
    [[/does not (?:mean|imply)/gi, 'means']]);
  expect(help.out).toContain('run -- bun --cwd=/absolute/repo run test');
});

test('unknown HOME holds, launch errors exit 1, and help/input errors write nothing', () => {
  const outside = directory(), parent = directory();
  const held = invoke(['run', '--root', parent, '--', ...writer], outside, { HOME: undefined });
  expect(held.code).toBe(2);
  expect(JSON.parse(held.out).terms.some((term) => term.status === 'unknown')).toBe(true);
  expect(readdirSync(parent)).toEqual([]);
  expect(invoke(['run', '--root', parent, '--', '/nonexistent-command-T13'], outside).code).toBe(1);
  const before = inventory(parent);
  const help = invoke(['--help'], outside);
  expect(help.code).toBe(0);
  expect(help.out).toMatch(/not filesystem containment/i);
  const syntax = [/--cwd=/, /required/i, /spaced/i, /prints help/i, /exits 0/i];
  checkRule(help.out, (text) => requires(text, ...syntax),
    'The --cwd= form is required because the spaced variant prints help and exits 0.',
    [[/required/gi, 'optional']], syntax);
  for (const word of ['HOME', 'absolute paths', 'process', 'filesystem', 'network', 'container', 'cleanup', '--root', 'plan', 'exit']) {
    expect(help.out.toLowerCase()).toContain(word.toLowerCase());
  }
  for (const args of [[], ['plan'], ['run', '--root', 'relative', '--', 'true'], ['plan', '--root', parent, '--', 'true']]) {
    expect(invoke(args, outside).code).toBe(1);
  }
  expect(inventory(parent)).toEqual(before);
});
