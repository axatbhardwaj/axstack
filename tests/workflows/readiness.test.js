import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';

const script = `${import.meta.dir}/../../skills/axstack/scripts/readiness.js`;
const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/readiness-`);
const fakeGh = `${root}/gh`;
writeFileSync(fakeGh, `#!/usr/bin/env bun
import { appendFileSync } from 'node:fs';
if (process.env.GH_LOG) appendFileSync(process.env.GH_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');
const response = JSON.parse(process.env.GH_FIXTURE ?? '{}')[process.argv.at(-1)];
if (!response || response.error) { console.error(response?.error ?? 'fixture: permission denied'); process.exit(1); }
console.log(JSON.stringify(response.pages ?? [response.data]));
`, { mode: 0o700 });

function command(cwd, argv) {
  const result = Bun.spawnSync(argv, { cwd, stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
}
const git = (repo, ...args) => command(repo, ['git', '--no-optional-locks', '-c', 'core.hooksPath=/dev/null', ...args]);
function put(repo, name, contents) {
  const path = `${repo}/${name}`;
  mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true });
  writeFileSync(path, typeof contents === 'string' ? contents : JSON.stringify(contents));
}
function fixture(files = {}) {
  const repo = mkdtempSync(`${root}/repo-`);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 'fixture@example.test');
  git(repo, 'config', 'user.name', 'Fixture');
  put(repo, 'README.md', 'Fixture repository');
  for (const [name, contents] of Object.entries(files)) put(repo, name, contents);
  git(repo, 'add', '.');
  git(repo, 'commit', '-qm', 'fixture');
  return repo;
}
function assess(repo, extra = [], options = {}) {
  const out = options.out ?? `${repo}/.git/axstack/readiness/report.json`;
  const result = Bun.spawnSync(['bun', script, '--repo', repo, '--out', out, ...extra], {
    env: { ...process.env, GH: fakeGh, ...options.env }, stdout: 'pipe', stderr: 'pipe',
  });
  const output = result.stdout.toString();
  return { code: result.exitCode, error: result.stderr.toString(), report: output ? JSON.parse(output) : null, out };
}
function criterion(report, id) {
  return report.criteria.find((item) => item.id === id);
}
function status(report, id, expected, reason) {
  const item = criterion(report, id);
  expect(item).toBeDefined();
  expect(item.status).toBe(expected);
  if (reason !== undefined) expect(item.reason).toBe(reason);
  expect(item.evidence.length).toBeGreaterThan(0);
  expect(['configured', 'executed']).toContain(item.kind);
  expect(item.pillar).toBeString();
}

const complete = {
  'package.json': { engines: { bun: '>=1.3.14' }, scripts: { build: 'echo build', test: 'echo test', lint: 'echo lint', typecheck: 'echo typecheck' } },
  'bun.lock': '{}', 'AGENTS.md': 'Project instructions', 'CLAUDE.md': '@AGENTS.md',
  'eslint.config.js': 'export default []', '.prettierrc': '{}',
  'tsconfig.json': '{ // JSONC\n "compilerOptions": { "strict": true, },\n}',
  'src/index.ts': 'export const n: number = 1;', '.pre-commit-config.yaml': 'repos: []',
  'tests/example.test.ts': 'test("example", () => {});',
  '.agents/skills/verify-demo/SKILL.md': 'Verification',
  '.github/workflows/test.yml': 'on: [pull_request]\njobs:\n  tests:\n    steps:\n      - run: bun run test\n',
  '.github/dependabot.yml': 'version: 2',
};

test('committed configured criteria and header ignore staged, untracked and ignored files', () => {
  const repo = fixture(complete);
  git(repo, 'remote', 'add', 'origin', 'git@github.com:Example/Readiness.git');
  const revision = git(repo, 'rev-parse', 'HEAD');
  put(repo, 'AGENTS.md', 'changed');
  put(repo, 'package.json', { scripts: {} });
  git(repo, 'add', 'package.json');
  put(repo, '.env', 'secret');
  const result = assess(repo, ['--rev', revision]);
  expect(result.code).toBe(0);
  for (const id of ['docs.agents', 'docs.claude', 'style.linter', 'style.formatter', 'style.strict', 'style.pre-commit', 'env.lockfile', 'env.toolchain', 'testing.files', 'testing.verify-skill', 'security.pr-tests', 'security.updates', 'security.secrets']) {
    status(result.report, id, 'pass');
  }
  expect(result.report.header).toMatchObject({
    repoIdentity: { roots: [revision], origin: 'https://github.com/example/readiness' }, revision, dirty: true,
    scriptVersion: '1.0.0', criteriaVersion: 1,
  });
  for (const field of ['observedAt', 'ghObservedAt']) expect(Number.isNaN(Date.parse(result.report.header[field]))).toBe(false);
});

test('absent configured criteria fail, TypeScript is n/a, and unsupported stacks stay unknown', () => {
  const repo = fixture({ 'package.json': {} });
  const { report } = assess(repo);
  for (const id of ['docs.agents', 'docs.claude', 'style.linter', 'style.formatter', 'style.pre-commit', 'env.lockfile', 'env.toolchain', 'testing.files', 'testing.verify-skill', 'security.pr-tests', 'security.updates']) status(report, id, 'fail');
  status(report, 'style.strict', 'n/a', 'no TypeScript');
  status(report, 'security.secrets', 'pass');
  const unsupported = assess(fixture({ 'main.py': 'print(1)' })).report;
  expect(unsupported.criteria).toHaveLength(17);
  for (const item of unsupported.criteria) status(unsupported, item.id, 'unknown', 'unsupported stack');
  for (const pillar of Object.values(unsupported.pillars)) {
    expect(pillar.passes).toBe(0);
    expect(pillar.unknown).toBe(pillar.total);
  }
});

test('configured failures include loose TypeScript, wrong docs linkage and tracked secrets', () => {
  const repo = fixture({ ...complete, 'tsconfig.json': { compilerOptions: { strict: false } }, 'CLAUDE.md': 'See README', '.env.example': 'EXAMPLE=', 'key.pem': '-----BEGIN PRIVATE KEY-----\nsecret' });
  const { report } = assess(repo);
  status(report, 'style.strict', 'fail');
  status(report, 'docs.claude', 'fail');
  status(report, 'security.secrets', 'fail');
  expect(criterion(report, 'security.secrets').evidence.join(' ')).toContain('.env.example');
  expect(criterion(report, 'security.secrets').evidence.join(' ')).toContain('key.pem');
});

test('executed criteria apply presence, prose and lockfile precedence without running commands', () => {
  const repo = fixture({ ...complete, 'package.json': { scripts: { test: 'touch SHOULD_NOT_EXIST' } } });
  let report = assess(repo).report;
  status(report, 'env.build', 'n/a', 'missing build script');
  status(report, 'testing.test', 'unknown', 'not run');
  status(report, 'testing.lint-typecheck', 'fail', 'missing lint and typecheck scripts');
  expect(() => readFileSync(`${repo}/SHOULD_NOT_EXIST`)).toThrow();

  const noLock = fixture({ 'package.json': { scripts: { build: 'echo build', test: 'echo test', lint: 'echo lint' } } });
  report = assess(noLock).report;
  for (const id of ['env.build', 'testing.test', 'testing.lint-typecheck']) status(report, id, 'unknown', 'no lockfile');
  const ambiguous = fixture({ ...complete, 'package-lock.json': '{}' });
  report = assess(ambiguous).report;
  for (const id of ['env.build', 'testing.test', 'testing.lint-typecheck']) status(report, id, 'unknown', 'ambiguous lockfile');
  const missing = assess(fixture({ 'package.json': {} })).report;
  status(missing, 'env.build', 'n/a', 'missing build script');
  status(missing, 'testing.test', 'fail', 'missing test script');

  const prose = assess(fixture({ 'package.json': {}, 'AGENTS.md': 'Use npm run build and npm test. Use npm run typecheck.' })).report;
  for (const id of ['env.build', 'testing.test', 'testing.lint-typecheck']) status(prose, id, 'unknown', 'prose-declared; not run');
  const classic = assess(fixture({ ...complete, 'bun.lock': '', 'yarn.lock': '# yarn lockfile v1' })).report;
  status(classic, 'testing.test', 'unknown', 'ambiguous lockfile');
  const onlyClassic = assess(fixture({ 'package.json': { scripts: { test: 'echo test' } }, 'yarn.lock': '# yarn lockfile v1' })).report;
  status(onlyClassic, 'testing.test', 'unknown', 'unsupported package manager');
});

test('committed symlinks and YAML event mappings work, invalid YAML remains unknown', () => {
  const repo = fixture({ ...complete, '.github/workflows/test.yml': 'on:\n  pull_request:\njobs:\n  test:\n    steps:\n      - run: |\n          echo preparing\n          bun test\n' });
  git(repo, 'rm', 'CLAUDE.md');
  symlinkSync('AGENTS.md', `${repo}/CLAUDE.md`);
  git(repo, 'add', 'CLAUDE.md');
  git(repo, 'commit', '-qm', 'symlink');
  let report = assess(repo).report;
  status(report, 'docs.claude', 'pass');
  status(report, 'security.pr-tests', 'pass');
  put(repo, '.github/workflows/test.yml', 'on: [pull_request\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-qm', 'invalid YAML');
  report = assess(repo).report;
  status(report, 'security.pr-tests', 'unknown', 'invalid workflow YAML');
  const wrong = assess(fixture({ ...complete, '.github/workflows/test.yml': 'on: [push]\njobs:\n  test:\n    steps:\n      - run: bun test\n' })).report;
  status(wrong, 'security.pr-tests', 'fail');
});

test('header roots are sorted across unrelated histories and origin is empty when absent', () => {
  const repo = fixture({ 'package.json': {} });
  const first = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'checkout', '--orphan', 'other');
  git(repo, 'commit', '-qam', 'second root');
  const second = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'checkout', 'main');
  git(repo, 'merge', '--allow-unrelated-histories', '--no-edit', 'other');
  const { report } = assess(repo);
  expect(report.header.repoIdentity).toEqual({ roots: [first, second].sort(), origin: '' });
  expect(report.pillars.Style).toMatchObject({ passes: 0, total: 3, na: 1, fraction: '0/3' });
  const jsOnly = assess(fixture({ 'src/main.js': 'export const main = 1;' })).report;
  status(jsOnly, 'testing.test', 'fail', 'missing test script');
});

test('help describes flags and static writes; invalid CLI and revisions fail', () => {
  const result = Bun.spawnSync(['bun', script, '--help'], { stdout: 'pipe' });
  expect(result.exitCode).toBe(0);
  for (const flag of ['--repo', '--rev', '--baseline', '--out', '--help']) expect(result.stdout.toString()).toContain(flag);
  expect(result.stdout.toString()).not.toContain('--run');
  const repo = fixture({ 'package.json': {} });
  expect(assess(repo, ['--run']).code).toBe(1);
  expect(assess(repo, ['--rev', 'no-such-revision']).code).toBe(1);
  const outside = Bun.spawnSync(['bun', script, '--repo', root, '--out', `${root}/bad.json`], { stdout: 'pipe', stderr: 'pipe' });
  expect(outside.exitCode).toBe(1);
});

test('forge reads distinguish protection, effective rules, permissions and missing administration', () => {
  const repo = fixture(complete);
  git(repo, 'remote', 'add', 'origin', 'https://github.com/example/readiness.git');
  const metadata = { 'repos/example/readiness': { data: { default_branch: 'release/main' } } };
  const protection = 'repos/example/readiness/branches/release%2Fmain/protection';
  const rules = 'repos/example/readiness/rules/branches/release%2Fmain?per_page=100';
  const cases = [
    [{ [protection]: { data: { required_status_checks: { contexts: ['test'] } } } }, 'pass', ''],
    [{ [protection]: { data: { required_status_checks: null } }, [rules]: { pages: [[], [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'ci' }] } }]] } }, 'pass', ''],
    [{ [protection]: { error: 'gh: Branch not protected (HTTP 404)' }, [rules]: { data: [] } }, 'fail', 'needs admin'],
    [{ [protection]: { data: { required_status_checks: { contexts: [], checks: [] } } }, [rules]: { data: [] } }, 'fail', 'needs admin'],
    [{ [protection]: { error: 'gh: Resource not accessible (HTTP 403)' } }, 'unknown', 'gh settings unavailable'],
    [{ [protection]: { error: 'gh: Not Found (HTTP 404)' } }, 'unknown', 'gh settings unavailable'],
    [{ [protection]: { data: { required_status_checks: null } }, [rules]: { error: 'gh: permission denied' } }, 'unknown', 'gh settings unavailable'],
  ];
  const log = `${root}/gh-calls.jsonl`;
  for (const [responses, expected, reason] of cases) {
    const { report, code } = assess(repo, [], { env: { GH_FIXTURE: JSON.stringify({ ...metadata, ...responses }), GH_LOG: log } });
    expect(code).toBe(0);
    status(report, 'security.status-checks', expected, reason);
    expect(Date.parse(report.header.ghObservedAt)).toBeGreaterThanOrEqual(Date.parse(report.header.observedAt));
  }
  for (const call of readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse)) {
    expect(call).toContain('--paginate');
    expect(call).toContain('--slurp');
    expect(call).toContain('GET');
  }
  const denied = assess(repo).report;
  status(denied, 'security.status-checks', 'unknown', 'gh settings unavailable');
  const missingOrigin = assess(fixture(complete)).report;
  status(missingOrigin, 'security.status-checks', 'unknown', 'no GitHub origin');
});
