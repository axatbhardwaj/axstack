import { afterAll, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync } from 'node:fs';

const file = Bun.file(`${import.meta.dir}/../../.github/workflows/dependabot-merge.yml`);
const config = await file.exists() ? Bun.YAML.parse(await file.text()) : {};
const sha = 'a'.repeat(40);
const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/dependabot-merge-`);
afterAll(() => {
  const result = Bun.spawnSync(['bash', '-c', 'rm -r "${RA_FIXTURE_DIR:?}"'], {
    env: { ...process.env, RA_FIXTURE_DIR: root },
  });
  expect(result.exitCode).toBe(0);
});

function job() {
  expect(Object.keys(config.jobs ?? {})).toEqual(['merge']);
  return config.jobs.merge;
}

test('merge starts only after a successful pull_request ci run', () => {
  expect(config.on).toEqual({ workflow_run: { workflows: ['ci'], types: ['completed'] } });
  expect(job().if.replace(/\s+/g, ' ').trim()).toBe(
    "${{ github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'pull_request' }}",
  );
});

test('privileged job uses only GITHUB_TOKEN and never checks out or runs PR code', () => {
  expect(Object.keys(config).sort()).toEqual(['jobs', 'name', 'on', 'permissions']);
  expect(config.permissions).toEqual({});
  const merge = job();
  expect(Object.keys(merge).sort()).toEqual(['if', 'permissions', 'runs-on', 'steps']);
  expect(merge.permissions).toEqual({ contents: 'write', 'pull-requests': 'write' });
  expect(merge['runs-on']).toBe('ubuntu-latest');
  expect(merge.steps).toHaveLength(1);
  const [step] = merge.steps;
  expect(Object.keys(step).sort()).toEqual(['env', 'name', 'run', 'shell']);
  expect(step.shell).toBe('bash');
  expect(step.env).toEqual({
    GH_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
    GH_REPO: '${{ github.repository }}',
    RUN_SHA: '${{ github.event.workflow_run.head_sha }}',
  });
  expect(step.run).not.toMatch(/\$\{\{/); // Event data must enter via env, not shell source.
  expect(step.run).not.toMatch(/\b(checkout|download-artifact|curl|wget|eval|source|exec|bash|sh|npx|npm|bun|node|python|git)\b/);
  // Only the three read APIs and the guarded merge may invoke gh.
  expect(step.run.match(/\bgh\s+[^\n]+/g)).toHaveLength(4);
  expect(step.run).not.toMatch(/--auto\b|--admin\b/);
});

// Execute the actual YAML shell with fixture API responses. No real token/network/merge.
async function drive(overrides = {}) {
  const dir = mkdtempSync(`${root}/case-`);
  const pr = {
    number: 411, state: 'open', user: { login: 'dependabot[bot]' },
    head: { ref: 'dependabot/github_actions/group-123', sha }, changed_files: 2,
    ...overrides.pr,
  };
  const pages = overrides.pages ?? [[
    { filename: '.github/workflows/ci.yml' }, { filename: '.github/workflows/publish.yml' },
  ]];
  await Bun.write(`${dir}/fixture.json`, JSON.stringify({
    // The commit-to-PR listing omits changed_files; the detail endpoint supplies it.
    pulls: overrides.pulls ?? [[{ number: pr.number }]], pr, pages, fail: overrides.fail,
  }));
  await Bun.write(`${dir}/gh`, `#!${process.execPath}
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(process.env.CALLS, JSON.stringify(args) + '\\n');
const fixture = await Bun.file(process.env.FIXTURE).json();
if (args[0] === 'api') {
  const files = args[1].includes('/files');
  const listing = args[1].includes('/commits/');
  if (fixture.fail === (files ? 'files' : listing ? 'pulls' : 'detail')) process.exit(1);
  process.stdout.write(JSON.stringify(files ? fixture.pages : listing ? fixture.pulls : fixture.pr));
} else if (args[0] !== 'pr' || args[1] !== 'merge') process.exit(1);
`);
  chmodSync(`${dir}/gh`, 0o700);
  const child = Bun.spawn(['bash', '-e', '-o', 'pipefail', '-c', job().steps[0].run], {
    env: {
      PATH: `${dir}:/usr/bin:/bin`, GH_TOKEN: 'fixture', GH_REPO: 'owner/repo', RUN_SHA: sha,
      FIXTURE: `${dir}/fixture.json`, CALLS: `${dir}/calls.jsonl`,
    }, stdout: 'pipe', stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  const callsFile = Bun.file(`${dir}/calls.jsonl`);
  const calls = await callsFile.exists()
    ? (await callsFile.text()).trim().split('\n').map(JSON.parse) : [];
  return { stdout, stderr, code, calls, merges: calls.filter(args => args[0] === 'pr') };
}

test('eligible workflow-only Dependabot PR merges the CI-tested head with paginated reads', async () => {
  const result = await drive({ pages: [[{ filename: '.github/workflows/ci.yml' }], [
    { filename: '.github/workflows/publish.yml' },
  ]] });
  expect(result.code, result.stderr).toBe(0);
  expect(result.merges).toEqual([['pr', 'merge', '411', '--merge', '--match-head-commit', sha]]);
  expect(result.calls.filter(args => args[0] === 'api')).toEqual([
    ['api', `repos/owner/repo/commits/${sha}/pulls`, '--paginate', '--slurp'],
    ['api', 'repos/owner/repo/pulls/411'],
    ['api', 'repos/owner/repo/pulls/411/files', '--paginate', '--slurp'],
  ]);
});

const rejected = [
  ['closed PR', { pr: { state: 'closed' } }],
  ['human author', { pr: { user: { login: 'human' } } }],
  ['wrong ecosystem', { pr: { head: { ref: 'dependabot/npm_and_yarn/bun', sha } } }],
  ['prefix embedded in another branch', { pr: { head: { ref: 'feature/dependabot/github_actions/x', sha } } }],
  ['stale CI head', { pr: { head: { ref: 'dependabot/github_actions/x', sha: 'b'.repeat(40) } } }],
  ['non-workflow file on later page', { pages: [[{ filename: '.github/workflows/ci.yml' }], [{ filename: 'src/index.js' }]] }],
  ['workflow-like path', { pages: [[{ filename: '.github/workflows-evil/ci.yml' }]], pr: { changed_files: 1 } }],
  ['empty file response', { pages: [[]] }],
  ['incomplete file response', { pages: [[{ filename: '.github/workflows/ci.yml' }]] }],
  ['no associated PR', { pulls: [[]] }],
  ['ambiguous PR association', { pulls: [[{ number: 411 }, { number: 412 }]] }],
  ['unavailable PR API', { fail: 'pulls' }],
  ['unavailable PR details', { fail: 'detail' }],
  ['unavailable files API', { fail: 'files' }],
];
for (const [reason, input] of rejected) {
  test(`skip with a reason and no merge: ${reason}`, async () => {
    const result = await drive(input);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout.trim()).not.toBe('');
    expect(result.merges).toEqual([]);
  });
}
