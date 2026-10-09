import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, symlinkSync, readdirSync, lstatSync, readlinkSync } from 'node:fs';
import { main, summarizePillars } from '../../skills/axstack/scripts/readiness.js';

const script = `${import.meta.dir}/../../skills/axstack/scripts/readiness.js`;
const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/readiness-`);
const fakeGh = `${root}/gh`;
writeFileSync(fakeGh, `#!/usr/bin/env bun
import { appendFileSync } from 'node:fs';
if (process.env.GH_LOG) appendFileSync(process.env.GH_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.argv.includes('--slurp')) { console.error('unknown flag: --slurp'); process.exit(1); }
const response = JSON.parse(process.env.GH_FIXTURE ?? '{}')[process.argv.at(-1)];
if (!response || response.error) { console.error(response?.error ?? 'fixture: permission denied'); process.exit(1); }
const pages = response.pages ?? [response.data];
console.log(response.raw ?? pages.map((page) => JSON.stringify(page)).join('\\n'));
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
  return { code: result.exitCode, error: result.stderr.toString(), report: output ? JSON.parse(readFileSync(out, 'utf8')) : null, out };
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
    scriptVersion: '1.1.0', criteriaVersion: 1,
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
  expect(criterion(report, 'security.secrets').evidence.join(' ')).not.toContain('.env.example');
  expect(criterion(report, 'security.secrets').evidence.join(' ')).toContain('key.pem');
});

test('secret-file readiness ignores PEM fixture strings and conventional env templates', () => {
  const repo = fixture({
    ...complete, 'tests/keys.test.js': 'const fixture = "-----BEGIN PRIVATE KEY-----";',
    '.env.example': 'EXAMPLE=', 'docs/.env.sample': 'SAMPLE=', 'config/.env.template': 'TEMPLATE=',
  });
  const before = assess(repo);
  expect(before.code).toBe(0);
  status(before.report, 'security.secrets', 'pass');
  put(repo, '.env.local', 'SECRET=value');
  git(repo, 'add', '.');
  git(repo, 'commit', '-qm', 'tracked local secrets');
  const after = assess(repo).report;
  status(after, 'security.secrets', 'fail');
  expect(criterion(after, 'security.secrets').evidence).toEqual([`git show ${after.header.revision}:.env.local`]);
});

test.each(['.envrc', 'config/.env-local', 'nested/.env_prod', '.environment'])('secret-file readiness rejects every .env prefix: %s', (name) => {
  const { code, report } = assess(fixture({ ...complete, [name]: 'opaque fixture' }));
  expect(code).toBe(0);
  status(report, 'security.secrets', 'fail');
  expect(criterion(report, 'security.secrets').evidence).toEqual([`git show ${report.header.revision}:${name}`]);
});

test('secret-file readiness rejects env files and private-key names without reading contents', () => {
  const names = ['.env', '.env.production', 'nested/.env.example.local', 'id_rsa', 'id_ed25519', 'id_ecdsa', 'key.pem', 'key.key', 'key.p12', 'nested/key.pfx'];
  const repo = fixture({ ...complete, ...Object.fromEntries(names.map((name) => [name, 'opaque fixture'])) });
  const { report } = assess(repo);
  status(report, 'security.secrets', 'fail');
  expect(criterion(report, 'security.secrets').evidence).toEqual(names.sort().map((name) => `git show ${report.header.revision}:${name}`));
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
  status(prose, 'env.build', 'n/a', 'missing build script; prose-declared; not run');
  status(prose, 'testing.test', 'fail', 'missing test script; prose-declared; not run');
  status(prose, 'testing.lint-typecheck', 'fail', 'missing lint and typecheck scripts; prose-declared; not run');
  const classic = assess(fixture({ ...complete, 'bun.lock': '', 'yarn.lock': '# yarn lockfile v1' })).report;
  status(classic, 'testing.test', 'unknown', 'ambiguous lockfile');
  const onlyClassic = assess(fixture({ 'package.json': { scripts: { test: 'echo test' } }, 'yarn.lock': '# yarn lockfile v1' })).report;
  status(onlyClassic, 'testing.test', 'unknown', 'unsupported package manager');
});

test('committed symlinks and YAML event mappings work, invalid YAML remains unknown', () => {
  const repo = fixture({ ...complete, '.github/workflows/test.yml': 'on:\n  pull_request:\njobs:\n  test:\n    steps:\n      - run: |\n          echo preparing\n          bun run test\n' });
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
  expect(result.stdout.toString()).toContain('--run');
  const repo = fixture({ 'package.json': {} });
  expect(assess(repo, ['--unknown']).code).toBe(1);
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
    expect(call).not.toContain('--slurp');
    expect(call).toContain('GET');
  }
  const denied = assess(repo).report;
  status(denied, 'security.status-checks', 'unknown', 'gh settings unavailable');
  const missingOrigin = assess(fixture(complete)).report;
  status(missingOrigin, 'security.status-checks', 'unknown', 'no GitHub origin');
});

test('out rejects outside paths, wrong suffixes and symlinks in report, ancestors or evidence folder', () => {
  const repo = fixture(complete);
  const dir = `${repo}/.git/axstack/readiness`;
  mkdirSync(dir, { recursive: true });
  for (const out of [`${repo}/report.json`, `${dir}-other/report.json`, `${dir}/report.txt`, `${dir}/../../escape.json`]) {
    expect(assess(repo, [], { out }).code).toBe(1);
    expect(() => readFileSync(out)).toThrow();
  }
  const target = `${repo}/AGENTS.md`;
  symlinkSync(target, `${dir}/link.json`);
  const linked = assess(repo, [], { out: `${dir}/link.json` });
  expect(linked.code).toBe(1);
  expect(linked.error).toContain('pass --out');
  expect(readFileSync(target, 'utf8')).toBe(complete['AGENTS.md']);
  symlinkSync(root, `${dir}/parent`);
  expect(assess(repo, [], { out: `${dir}/parent/report.json` }).code).toBe(1);
  expect(assess(repo, [], { out: `${dir}/parent/../report.json` }).code).toBe(1);
  symlinkSync(root, `${dir}/evidence`);
  expect(assess(repo, [], { out: `${dir}/evidence.json` }).code).toBe(1);
  const result = assess(repo, [], { out: `${dir}/safe.json` });
  expect(result.code).toBe(0);
  expect(JSON.parse(readFileSync(result.out, 'utf8'))).toEqual(result.report);
});

test('baseline compares same identity and version, names regressions, and preserves reports on incomplete comparison', () => {
  const repo = fixture(complete);
  const baseline = assess(repo, [], { out: `${repo}/.git/axstack/readiness/baseline.json` });
  expect(baseline.code).toBe(0);
  expect(JSON.parse(readFileSync(baseline.out, 'utf8'))).toEqual(baseline.report);
  git(repo, 'rm', 'AGENTS.md');
  git(repo, 'commit', '-qm', 'remove agent guidance');
  let result = assess(repo, ['--baseline', baseline.out]);
  expect(result.code).toBe(10);
  expect(result.report.comparison.regressions).toEqual(['docs.agents']);
  expect(result.error).toContain('docs.agents');
  expect(result.report.comparison.changes).toContainEqual({ id: 'docs.agents', before: 'pass', after: 'fail' });

  put(repo, 'AGENTS.md', complete['AGENTS.md']);
  put(repo, 'tsconfig.json', '{ invalid');
  git(repo, 'add', '.');
  git(repo, 'commit', '-qm', 'invalid config');
  result = assess(repo, ['--baseline', baseline.out]);
  expect(result.code).toBe(0);
  expect(result.report.comparison.regressions).toEqual([]);
  expect(result.report.comparison.changes).toContainEqual({ id: 'style.strict', before: 'pass', after: 'unknown' });

  const foreign = assess(fixture({ ...complete, 'README.md': 'Foreign repository' }));
  const versioned = `${root}/other-version.json`;
  put(root, 'other-version.json', { ...baseline.report, header: { ...baseline.report.header, criteriaVersion: 2 } });
  put(root, 'invalid-report.json', { header: baseline.report.header, criteria: 'invalid' });
  for (const path of [`${root}/missing.json`, root, foreign.out, versioned, `${root}/invalid-report.json`]) {
    result = assess(repo, ['--baseline', path]);
    expect(result.code).toBe(2);
    expect(result.error).toContain('comparison unavailable');
    expect(result.report.comparison).toBeUndefined();
    expect(result.report.comparisonUnavailable).toContain('comparison unavailable');
    expect(JSON.parse(readFileSync(result.out, 'utf8'))).toEqual(result.report);
  }
  const extended = { ...baseline.report, criteria: baseline.report.criteria.filter((item) => item.id !== 'docs.claude').concat({ id: 'removed', status: 'pass' }) };
  put(root, 'extended.json', extended);
  result = assess(repo, ['--baseline', `${root}/extended.json`]);
  expect(result.code).toBe(0);
  expect(result.report.comparison.changes).toContainEqual({ id: 'removed', before: 'pass', after: null });
  expect(result.report.comparison.changes).toContainEqual({ id: 'docs.claude', before: null, after: 'pass' });
});

function manifest(repo, relative = '') {
  const result = {};
  for (const name of readdirSync(`${repo}/${relative}`).sort()) {
    const path = relative ? `${relative}/${name}` : name;
    if (path === '.git/axstack/readiness') continue;
    const stat = lstatSync(`${repo}/${path}`);
    if (stat.isDirectory()) Object.assign(result, manifest(repo, path));
    else result[path] = stat.isSymbolicLink() ? readlinkSync(`${repo}/${path}`) : new Bun.CryptoHasher('sha256').update(readFileSync(`${repo}/${path}`)).digest('hex');
  }
  return result;
}

test('static runs preserve source HEAD, index, status and tracked/untracked/ignored bytes with optional locks disabled', () => {
  const repo = fixture({ ...complete, '.gitignore': 'ignored/\n' });
  const old = git(repo, 'rev-parse', 'HEAD');
  put(repo, 'AGENTS.md', 'staged guidance');
  git(repo, 'add', 'AGENTS.md');
  put(repo, 'README.md', 'unstaged changes');
  put(repo, 'untracked.md', 'untracked');
  put(repo, 'ignored/data.txt', 'ignored bytes');
  symlinkSync('README.md', `${repo}/untracked-link`);
  const before = { status: git(repo, 'status', '--porcelain', '--ignored'), head: git(repo, 'rev-parse', 'HEAD'), files: manifest(repo) };
  const shims = `${root}/shims`;
  mkdirSync(shims);
  const realGit = Bun.which('git');
  const log = `${root}/git-calls.jsonl`;
  writeFileSync(`${shims}/git`, `#!/usr/bin/env bun
import { appendFileSync } from 'node:fs';
appendFileSync(process.env.READINESS_GIT_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');
const result = Bun.spawnSync([${JSON.stringify(realGit)}, ...process.argv.slice(2)], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
process.exit(result.exitCode);
`, { mode: 0o700 });
  const result = assess(repo, ['--rev', old], { env: { PATH: `${shims}:${process.env.PATH}`, READINESS_GIT_LOG: log } });
  expect(result.code).toBe(0);
  expect(result.report.header).toMatchObject({ revision: old, dirty: true });
  status(result.report, 'docs.agents', 'pass');
  const after = { status: git(repo, 'status', '--porcelain', '--ignored'), head: git(repo, 'rev-parse', 'HEAD'), files: manifest(repo) };
  expect(after).toEqual(before);
  for (const argv of readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse)) expect(argv).toContain('--no-optional-locks');
  expect(JSON.parse(readFileSync(result.out, 'utf8'))).toEqual(result.report);
  expect(lstatSync(result.out.slice(0, -5)).isDirectory()).toBe(true);
});

test('linked worktrees use the common git directory and assess the selected revision', () => {
  const repo = fixture(complete);
  const revision = git(repo, 'rev-parse', 'HEAD');
  const linked = `${root}/linked`;
  git(repo, 'worktree', 'add', '-b', 'linked', linked);
  git(linked, 'rm', 'AGENTS.md');
  git(linked, 'commit', '-qm', 'remove guidance on linked branch');
  const before = { common: manifest(repo), linked: manifest(linked) };
  const result = assess(linked, ['--rev', revision], { out: `${repo}/.git/axstack/readiness/linked.json` });
  expect(result.code).toBe(0);
  status(result.report, 'docs.agents', 'pass');
  expect(result.report.header.revision).toBe(revision);
  expect({ common: manifest(repo), linked: manifest(linked) }).toEqual(before);
});

test('workflow configuration requires the selected package manager test command, not printed prose', () => {
  for (const run of ['echo bun test', 'npm test', '# bun test', 'echo "bun test"']) {
    const report = assess(fixture({ ...complete, '.github/workflows/test.yml': `on: [pull_request]\njobs:\n  tests:\n    steps:\n      - run: ${JSON.stringify(run)}\n` })).report;
    status(report, 'security.pr-tests', 'fail', 'missing pull_request test step');
  }
});

test('workflow test script forms are recognized for each supported package manager', () => {
  const { 'bun.lock': unused, ...base } = complete;
  for (const [lock, contents, commands] of [
    ['bun.lock', '{}', ['bun test', 'bun run test']],
    ['package-lock.json', '{}', ['npm test', 'npm run test']],
    ['pnpm-lock.yaml', '{}', ['pnpm test', 'pnpm run test']],
    ['yarn.lock', '__metadata:\n  version: 8', ['yarn test', 'yarn run test']],
  ]) {
    for (const run of commands) {
      const repo = fixture({ ...base, [lock]: contents, '.github/workflows/test.yml': `on: [pull_request]\njobs:\n  tests:\n    steps:\n      - run: ${run}\n` });
      const { report, code } = assess(repo);
      expect(code).toBe(0);
      status(report, 'security.pr-tests', 'pass');
    }
  }
});

test('stale report staging files cannot block a later static report', () => {
  const repo = fixture(complete);
  const folder = `${repo}/.git/axstack/readiness/report`;
  mkdirSync(folder, { recursive: true });
  writeFileSync(`${folder}/.report.json`, 'stale stage');
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = assess(repo);
    expect(result.code).toBe(0);
    expect(JSON.parse(readFileSync(result.out, 'utf8'))).toEqual(result.report);
    expect(readFileSync(`${folder}/.report.json`, 'utf8')).toBe('stale stage');
    expect(readdirSync(folder)).toEqual(['.report.json']);
  }
});

test('failed report replacement removes only its own staging file', () => {
  const repo = fixture(complete);
  const out = `${repo}/.git/axstack/readiness/blocked.json`;
  const folder = out.slice(0, -5);
  mkdirSync(out, { recursive: true });
  mkdirSync(folder);
  writeFileSync(`${out}/keep`, 'existing directory content');
  writeFileSync(`${folder}/.report.json`, 'unrelated stage');
  const result = assess(repo, [], { out });
  expect(result.code).toBe(1);
  expect(result.error).toContain('Readiness error:');
  expect(result.report).toBeNull();
  expect(readFileSync(`${out}/keep`, 'utf8')).toBe('existing directory content');
  expect(readFileSync(`${folder}/.report.json`, 'utf8')).toBe('unrelated stage');
  expect(readdirSync(folder)).toEqual(['.report.json']);
});

test('readable effective rules prove required checks after legacy protection permission gaps', () => {
  const repo = fixture(complete);
  git(repo, 'remote', 'add', 'origin', 'https://github.com/example/readiness.git');
  const metadata = { 'repos/example/readiness': { data: { default_branch: 'main' } } };
  const protection = 'repos/example/readiness/branches/main/protection';
  const rules = 'repos/example/readiness/rules/branches/main?per_page=100';
  const required = [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'ci' }] } }];
  for (const code of [403, 404]) {
    for (const [data, expected, reason] of [[required, 'pass', ''], [[], 'unknown', 'gh settings unavailable']]) {
      const responses = { ...metadata, [protection]: { error: `gh: unavailable (HTTP ${code})` }, [rules]: { data } };
      const log = `${root}/fallback-${code}-${expected}.jsonl`;
      const { report } = assess(repo, [], { env: { GH_FIXTURE: JSON.stringify(responses), GH_LOG: log } });
      status(report, 'security.status-checks', expected, reason);
      expect(readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse).some((argv) => argv.at(-1) === rules)).toBe(true);
    }
  }
});

test('malformed committed package declarations report uncertainty rather than missing scripts', () => {
  const report = assess(fixture({ ...complete, 'package.json': '{ broken JSON' })).report;
  for (const id of ['env.build', 'testing.test', 'testing.lint-typecheck']) status(report, id, 'unknown', 'invalid package.json');
});

test('alternate config locations and ordinary test directories are recognized', () => {
  const report = assess(fixture({ 'src/main.js': 'export const main = 1;', '.devcontainer.json': '{}', 'test/unit.js': 'test("example", () => {});' })).report;
  status(report, 'env.toolchain', 'pass');
  status(report, 'testing.files', 'pass');
});

test('origin normalization preserves local origin identity and normalizes SSH ports without exposing credentials', () => {
  const repo = fixture(complete);
  git(repo, 'remote', 'add', 'origin', 'ssh://git@github.com:22/Example/Readiness.git/');
  const baseline = assess(repo, [], { out: `${repo}/.git/axstack/readiness/origin.json` });
  expect(baseline.report.header.repoIdentity.origin).toBe('https://github.com/example/readiness');
  git(repo, 'remote', 'set-url', 'origin', 'https://user:password@github.com/Example/Readiness.git');
  const same = assess(repo, ['--baseline', baseline.out]);
  expect(same.code).toBe(0);
  expect(same.report.header.repoIdentity.origin).not.toContain('password');
  git(repo, 'remote', 'set-url', 'origin', `${root}/local-source.git`);
  const changed = assess(repo, ['--baseline', baseline.out]);
  expect(changed.code).toBe(2);
  expect(changed.report.header.repoIdentity.origin).toBe(`file://${root}/local-source`);
});

test('pillar fractions exclude n/a, retain unknown counts and render all-n/a as 0/0', () => {
  const pillars = summarizePillars([
    { pillar: 'Style', status: 'pass' }, { pillar: 'Style', status: 'unknown' }, { pillar: 'Style', status: 'n/a' },
    { pillar: 'Build/Env', status: 'n/a' }, { pillar: 'Build/Env', status: 'n/a' },
  ]);
  expect(pillars).toEqual({
    Style: { passes: 1, total: 2, unknown: 1, na: 1, fraction: '1/2' },
    'Build/Env': { passes: 0, total: 0, unknown: 0, na: 2, fraction: '0/0' },
  });
});

test('unrelated hooks and printed CodeQL references do not imply configured protection', () => {
  const repo = fixture({
    'package.json': { 'lint-staged': { '*.js': 'eslint' } }, 'bun.lock': '{}',
    '.husky/pre-push': 'bun test',
    '.github/workflows/print.yml': 'on: [push]\njobs:\n  echo:\n    steps:\n      - run: echo github/codeql-action/init@v3\n',
  });
  let report = assess(repo).report;
  status(report, 'style.pre-commit', 'fail');
  status(report, 'security.updates', 'fail');
  put(repo, '.husky/pre-commit', 'bun lint');
  put(repo, '.github/workflows/scan.yml', 'on: [push]\njobs:\n  scan:\n    steps:\n      - uses: github/codeql-action/init@v3\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-qm', 'configure hooks and scanning');
  report = assess(repo).report;
  status(report, 'style.pre-commit', 'pass');
  status(report, 'security.updates', 'pass');
});

test('dirty observation cannot execute repository-configured filters or filesystem monitor hooks', () => {
  const repo = fixture({ ...complete, '.gitattributes': 'src/index.ts filter=fixture\n' });
  const marker = `${repo}/OBSERVATION_HOOK_RAN`;
  const hook = `${root}/observation-hook`;
  writeFileSync(hook, `#!/usr/bin/env bun
import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(marker)}, 'ran');
console.log(await Bun.stdin.text());
`, { mode: 0o700 });
  git(repo, 'config', 'filter.fixture.clean', hook);
  git(repo, 'config', 'filter.fixture.required', 'true');
  git(repo, 'config', 'core.fsmonitor', hook);
  put(repo, 'src/index.ts', 'export const n: number = 2;');
  const before = manifest(repo);
  const result = assess(repo);
  expect(result.code).toBe(0);
  expect(result.report.header.dirty).toBe(true);
  expect(() => readFileSync(marker)).toThrow();
  expect(manifest(repo)).toEqual(before);
});

test('committed text reads are batched and binary files cannot declare prose commands', () => {
  const docs = Object.fromEntries(Array.from({ length: 40 }, (_, index) => [`docs/note-${index}.md`, `Ordinary note ${index}`]));
  const repo = fixture({ ...complete, ...docs, 'package.json': {}, 'docs/odd\nfilename.md': 'Ordinary note with an unusual filename' });
  put(repo, 'docs/binary.md', 'placeholder');
  put(repo, 'assets/data.bin', 'placeholder');
  const binary = new Uint8Array([0, ...new TextEncoder().encode('npm test and npm run build')]);
  writeFileSync(`${repo}/docs/binary.md`, binary);
  writeFileSync(`${repo}/assets/data.bin`, new Uint8Array(1024 * 1024));
  git(repo, 'add', '.');
  git(repo, 'commit', '-qm', 'binary fixtures');
  const shim = `${root}/batch-git`;
  mkdirSync(shim);
  const log = `${root}/batch-git-calls.jsonl`;
  writeFileSync(`${shim}/git`, `#!/usr/bin/env bun
import { appendFileSync } from 'node:fs';
appendFileSync(process.env.READINESS_GIT_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');
const result = Bun.spawnSync([${JSON.stringify(Bun.which('git'))}, ...process.argv.slice(2)], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
process.exit(result.exitCode);
`, { mode: 0o700 });
  const { code, report } = assess(repo, [], { env: { PATH: `${shim}:${process.env.PATH}`, READINESS_GIT_LOG: log } });
  expect(code).toBe(0);
  status(report, 'docs.claude', 'pass');
  status(report, 'security.pr-tests', 'pass');
  status(report, 'testing.test', 'fail', 'missing test script');
  const reads = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse).filter((argv) => argv.includes('cat-file'));
  expect(reads).toHaveLength(1);
  expect(reads[0]).toContain('--batch');
});

test('static CLI summarizes arbitrarily large evidence without silently omitting it', async () => {
  const repo = fixture({ 'package.json': {}, ...Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`keys/${i}.pem`, 'fixture'])) });
  const out = `${repo}/.git/axstack/readiness/large.json`;
  let output = '';
  expect(await main(['--repo', repo, '--out', out], { stdout: (text) => { output += text; }, stderr: () => {} })).toBe(0);
  const summary = JSON.parse(output), full = JSON.parse(readFileSync(out, 'utf8'));
  expect(summary.reportPath).toBe(out);
  expect(summary.revision).toBe(git(repo, 'rev-parse', 'HEAD'));
  expect(summary.inputs).toEqual(full.header.inputs);
  expect(summary.omittedCriteria).toBe(17);
  expect(summary.omittedCommands).toBe(0);
  expect(summary.omittedLogBytes).toBe(0);
  expect(summary.criteria).toBeUndefined();
  expect(criterion(full, 'security.secrets').evidence).toHaveLength(100);
  expect(output.length).toBeLessThan(2000);
});

test('output-path input errors explain the replacement argument', () => {
  const repo = fixture({});
  for (const out of [`${repo}/bad.json`, `${repo}/.git/axstack/readiness/bad.txt`]) {
    const result = assess(repo, [], { out });
    expect(result.code).toBe(1);
    expect(result.error).toContain('pass --out');
  }
});

test('dependency-free repositories select Bun without changing lockfile readiness', () => {
  for (const declaration of [
    { packageManager: 'bun@1.3.14' },
    { engines: { bun: '>=1.3.14' }, dependencies: {}, devDependencies: {}, workspaces: [] },
  ]) {
    const repo = fixture({ 'package.json': { ...declaration, scripts: { build: 'echo build', test: 'echo test', lint: 'echo lint' } } });
    const { code, report } = assess(repo);
    expect(code).toBe(0);
    status(report, 'env.lockfile', 'fail');
    for (const id of ['env.build', 'testing.test', 'testing.lint-typecheck']) {
      status(report, id, 'unknown', 'not run');
      expect(criterion(report, id).evidence.join(' ')).toContain('bun run');
      expect(criterion(report, id).evidence.join(' ')).toContain('package.json');
    }
  }
});

test('dependency declarations prevent the lockfile-free manager fallback', () => {
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'bundledDependencies', 'bundleDependencies']) {
    const dependencies = field.includes('bundle') ? ['example'] : { example: '*' };
    const report = assess(fixture({ 'package.json': { packageManager: 'bun@1.3.14', engines: { bun: '>=1.3.14' }, [field]: dependencies, scripts: { test: 'echo test' } } })).report;
    status(report, 'testing.test', 'unknown', 'no lockfile');
  }
  const ambiguous = assess(fixture({ ...complete, 'package-lock.json': '{}', 'package.json': { packageManager: 'bun@1.3.14', scripts: { test: 'echo test' } } })).report;
  status(ambiguous, 'testing.test', 'unknown', 'ambiguous lockfile');
  for (const packageManager of ['bun', 'unknown@1.0.0', '', null]) {
    const report = assess(fixture({ 'package.json': { packageManager, engines: { bun: '>=1.3.14' }, scripts: { test: 'echo test' } } })).report;
    status(report, 'testing.test', 'unknown', 'no lockfile');
  }
});

test('legacy gh pagination reads concatenated JSON and preserves real API or pagination gaps', () => {
  const repo = fixture(complete);
  git(repo, 'remote', 'add', 'origin', 'https://github.com/example/readiness.git');
  const metadata = { 'repos/example/readiness': { data: { default_branch: 'main' } } };
  const protection = 'repos/example/readiness/branches/main/protection';
  const rules = 'repos/example/readiness/rules/branches/main?per_page=100';
  const required = { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'ci } [ "quoted" \\ path' }] } };
  for (const [response, expected, reason] of [
    [{ pages: [[], [required]] }, 'pass', ''],
    [{ data: [] }, 'fail', 'needs admin'],
    [{ raw: '[]\n[{' }, 'unknown', 'gh settings unavailable'],
    [{ raw: '[]\ninvalid' }, 'unknown', 'gh settings unavailable'],
    [{ raw: '' }, 'unknown', 'gh settings unavailable'],
    [{ data: {} }, 'unknown', 'gh settings unavailable'],
    [{ error: 'gh: pagination failed (HTTP 403)' }, 'unknown', 'gh settings unavailable'],
  ]) {
    const responses = { ...metadata, [protection]: { data: { required_status_checks: null } }, [rules]: response };
    const { code, report } = assess(repo, [], { env: { GH_FIXTURE: JSON.stringify(responses) } });
    expect(code).toBe(0);
    status(report, 'security.status-checks', expected, reason);
    const evidence = criterion(report, 'security.status-checks').evidence.join(' ');
    expect(evidence).not.toContain('--slurp');
    if (expected === 'unknown') expect(criterion(report, 'security.status-checks').evidence.length).toBeGreaterThan(3);
  }
});
