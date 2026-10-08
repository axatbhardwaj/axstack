import { afterAll, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';

const script = `${import.meta.dir}/../../skills/axstack/scripts/readiness.js`;
const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/readiness-`);
const fakeGh = `${root}/gh`;
writeFileSync(fakeGh, `#!/usr/bin/env bun
console.error('fixture: permission denied'); process.exit(1);
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
