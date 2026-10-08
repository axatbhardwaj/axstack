import { afterAll, expect, test } from 'bun:test';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { main } from '../../skills/axstack/scripts/run-init.js';

const script = `${import.meta.dir}/../../skills/axstack/scripts/run-init.js`;
const reference = `${import.meta.dir}/../../skills/axstack/references/run-record.md`;
const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/run-init-tests-`);
chmodSync(root, 0o700);
afterAll(() => rmSync(root, { recursive: true }));

function git(repo, ...args) {
  const result = Bun.spawnSync(['git', '-c', 'core.hooksPath=/dev/null', ...args], {
    cwd: repo, stdout: 'pipe', stderr: 'pipe',
  });
  if (result.exitCode) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
}

function fixture(commit = true) {
  const repo = mkdtempSync(`${root}/repo-`);
  git(repo, 'init', '-q', '-b', 'main');
  if (commit) git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test',
    'commit', '--allow-empty', '-qm', 'fixture');
  return repo;
}

function invoke(repo, argv, env = {}) {
  const cwd = process.cwd();
  const previous = { HOME: process.env.HOME, TMPDIR: process.env.TMPDIR };
  let stdout = '', stderr = '';
  try {
    process.chdir(repo);
    Object.assign(process.env, { TMPDIR: root, ...env });
    const code = main(argv, { stdout: (text) => { stdout += text; }, stderr: (text) => { stderr += text; } });
    return { code, stdout, stderr, data: stdout.startsWith('{') ? JSON.parse(stdout) : null };
  } finally {
    process.chdir(cwd);
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const template = (text) => text.split('## Compact template\n')[1].match(/```text\n([\s\S]*?)```/)[1];

test('creates paths in the Git common dir, renders the source template and owns private scratch', () => {
  const repo = fixture();
  const result = invoke(repo, ['--slug', 'a2-test', '--date', '20261008']);
  expect(result.code, result.stderr).toBe(0);
  const { runId, runDir, recordPath, evidenceDir, scratchDir, inputs, terms } = result.data;
  expect(runId).toBe('20261008-a2-test');
  expect(runDir).toBe(`${git(repo, 'rev-parse', '--path-format=absolute', '--git-common-dir')}/axstack/runs/${runId}`);
  expect(recordPath).toBe(`${runDir}/progress.md`);
  expect(evidenceDir).toBe(`${runDir}/evidence`);
  expect(readdirSync(evidenceDir)).toEqual([]);
  expect(readFileSync(recordPath, 'utf8')).toBe(template(readFileSync(reference, 'utf8'))
    .replace(/^Run: .*$/m, `Run: ${runId}`));
  expect(inputs).toMatchObject({ head: git(repo, 'rev-parse', 'HEAD'), slug: 'a2-test', date: '20261008', template: realpathSync(reference) });
  expect(terms.length).toBeGreaterThan(0);
  for (const term of terms) {
    expect(term.status).toBe('pass');
    expect(term.evidence).toBeTruthy();
  }
  expect(scratchDir.startsWith(`${realpathSync(root)}/`)).toBe(true);
  expect(scratchDir.startsWith(`${realpathSync(process.env.HOME)}/`)).toBe(false);
  expect(statSync(scratchDir).mode & 0o777).toBe(0o700);
  expect(statSync(scratchDir).uid).toBe(process.getuid());
  expect(git(repo, 'status', '--porcelain', '--ignored')).toBe('');
});

test('collisions preserve old records and allocate successive suffixes even for an occupied file', () => {
  const repo = fixture();
  const runs = `${repo}/.git/axstack/runs`;
  mkdirSync(`${runs}/20261008-collision/evidence`, { recursive: true });
  writeFileSync(`${runs}/20261008-collision/progress.md`, 'existing record');
  writeFileSync(`${runs}/20261008-collision-1`, 'occupied file');
  for (const suffix of [2, 3]) {
    const result = invoke(repo, ['--slug', 'collision', '--date', '20261008']);
    expect(result.code, result.stderr).toBe(0);
    expect(result.data.runId).toBe(`20261008-collision-${suffix}`);
  }
  expect(readFileSync(`${runs}/20261008-collision/progress.md`, 'utf8')).toBe('existing record');
  expect(readFileSync(`${runs}/20261008-collision-1`, 'utf8')).toBe('occupied file');
});

test('linked worktrees share runs and default to the current UTC date', () => {
  const repo = fixture();
  const linked = `${repo}-linked`;
  git(repo, 'worktree', 'add', '--detach', '-q', linked);
  const before = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const first = invoke(repo, ['--slug', 'shared']);
  const second = invoke(linked, ['--slug', 'shared', '--date', first.data?.inputs.date ?? before]);
  expect(first.code, first.stderr).toBe(0);
  expect(second.code, second.stderr).toBe(0);
  expect([before, new Date().toISOString().slice(0, 10).replaceAll('-', '')]).toContain(first.data.inputs.date);
  expect(second.data.runDir).toBe(`${first.data.runDir}-1`);
});

test('unborn repositories initialize with an unknown revision', () => {
  const result = invoke(fixture(false), ['--slug', 'unborn']);
  expect(result.code, result.stderr).toBe(0);
  expect(result.data.inputs.head).toBeNull();
  expect(result.data.terms.find((term) => term.id === 'revision').status).toBe('unknown');
});

test('help works outside Git, advertises inputs, a complete example and every write', () => {
  const before = readdirSync(root).sort();
  const result = invoke(root, ['--help']);
  expect(result.code, result.stderr).toBe(0);
  for (const flag of ['--help', '--slug', '--date']) expect(result.stdout).toContain(flag);
  expect(result.stdout).toMatch(/bun .*run-init\.js --slug [a-z0-9-]+ --date \d{8}/);
  for (const path of ['axstack/runs', 'progress.md', 'evidence/', 'scratch', '0700', 'HOME', 'TMPDIR']) {
    expect(result.stdout).toContain(path);
  }
  expect(result.stdout).toMatch(/parent directories/i);
  expect(readdirSync(root).sort()).toEqual(before);
});

test.each([
  [], ['--slug'], ['--slug', 'Bad'], ['--slug', '../escape'], ['--slug', 'a/b'],
  ['--slug', 'a\\b'], ['--slug', 'a\nb'], ['--slug', ''], ['--slug', 'x', '--date'],
  ['--slug', 'x', '--date', '20260230'], ['--slug', 'x', '--date', '2026-10-08'],
  ['--slug', 'x', '--slug', 'y'], ['--slug', 'x', '--unknown'],
].map((argv) => [argv]))('input errors are actionable and write nothing: %j', (argv) => {
  const repo = fixture();
  const before = readdirSync(root).sort();
  const result = invoke(repo, argv);
  expect(result.code).toBe(1);
  expect(result.stderr).toMatch(/--slug|--date|--help/);
  expect(result.stdout).toBe('');
  expect(existsSync(`${repo}/.git/axstack`)).toBe(false);
  expect(readdirSync(root).sort()).toEqual(before);
});

test('outside Git and a home-contained or symlinked temp directory fail before writing', () => {
  const outside = invoke(root, ['--slug', 'outside']);
  expect(outside.code).toBe(1);
  expect(outside.stderr).toMatch(/Git repository.*run/i);
  const repo = fixture();
  const home = `${root}/fake-home`;
  mkdirSync(`${home}/temp`, { recursive: true });
  symlinkSync(`${home}/temp`, `${root}/temp-link`);
  for (const temp of [home, `${home}/temp`, `${root}/temp-link`]) {
    const result = invoke(repo, ['--slug', 'unsafe'], { HOME: home, TMPDIR: temp });
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/outside.*HOME/);
    expect(existsSync(`${repo}/.git/axstack`)).toBe(false);
  }
});

test('CLI reads the adjacent compact block as its single template source', () => {
  const packageDir = `${root}/package`;
  mkdirSync(`${packageDir}/scripts`, { recursive: true });
  mkdirSync(`${packageDir}/references`);
  writeFileSync(`${packageDir}/scripts/run-init.js`, readFileSync(script));
  const source = readFileSync(reference, 'utf8').replace('Goal: <bounded task goal>', 'Goal: fixture template revision');
  writeFileSync(`${packageDir}/references/run-record.md`, source);
  const result = Bun.spawnSync([process.execPath, `${packageDir}/scripts/run-init.js`, '--slug', 'source', '--date', '20261008'], {
    cwd: fixture(), env: { ...process.env, TMPDIR: root }, stdout: 'pipe', stderr: 'pipe',
  });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  const data = JSON.parse(result.stdout.toString());
  expect(readFileSync(data.recordPath, 'utf8')).toBe(template(source).replace(/^Run: .*$/m, 'Run: 20261008-source'));
});
