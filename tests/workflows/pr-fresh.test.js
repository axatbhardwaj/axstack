import { afterEach, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const script = `${import.meta.dir}/../../skills/axstack/scripts/pr-fresh.js`;
const fixture = await Bun.file(`${import.meta.dir}/fixtures/pr-fresh.json`).json();
const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true }); });
const pr = (d) => d.response.data.repository.pullRequest;
const commit = (d) => pr(d).commits.nodes[0].commit;
const contexts = (d) => commit(d).statusCheckRollup.contexts;
const fact = (r, id) => r.terms.find((t) => t.id === id);
function run(change = () => {}, live = false) {
  const data = structuredClone(fixture);
  change(data);
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/pr-fresh-`);
  roots.push(dir);
  const input = `${dir}/input.json`, policy = `${dir}/policy.json`;
  writeFileSync(input, JSON.stringify(data.response));
  if (data.policy !== undefined) writeFileSync(policy, typeof data.policy === 'string' ? data.policy : JSON.stringify(data.policy));
  if (live) {
    // Executable fixture enforces the read-only query shape; it never contacts GitHub.
    writeFileSync(`${dir}/gh`, `#!${process.execPath}\nconst a = process.argv.slice(2);\n` +
      `if (a[0] !== 'api' || a[1] !== 'graphql' || a[2] !== '-f' || !a[3]?.startsWith('query=query ') || a[3].includes('mutation')) process.exit(9);\n` +
      `console.log(await Bun.file(${JSON.stringify(input)}).text());\n`);
    chmodSync(`${dir}/gh`, 0o700);
  }
  const before = readFileSync(input, 'utf8');
  const result = Bun.spawnSync([process.execPath, '--no-env-file', script, '--repo', 'example/project',
    '--pr', '42', '--head', 'a'.repeat(40), '--base', 'b'.repeat(40), '--base-ref', 'main',
    '--phase', data.phase ?? 'admission', ...(live ? [] : ['--input', input]), '--policy', policy, '--now', data.now],
  { cwd: '/', stdout: 'pipe', stderr: 'pipe', env: { ...process.env,
    PATH: live ? dir : process.env.PATH, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0' } });
  expect(readFileSync(input, 'utf8')).toBe(before);
  return { code: result.exitCode, report: JSON.parse(result.stdout.toString()) };
}

for (const [seconds, expected] of [[599, 'fail'], [600, 'pass'], [601, 'pass']]) {
  test(`synthetic policy inclusive age threshold: ${seconds}s`, () => {
    const { code, report } = run((d) => { commit(d).committedDate = new Date(Date.parse(d.now) - seconds * 1000).toISOString(); });
    expect(fact(report, 'headAge').status).toBe(expected);
    expect(fact(report, 'headAge').evidence.ageSeconds).toBe(seconds);
    expect(code).toBe(0);
  });
}
test('unchanged open non-draft event reports facts without an aggregate verdict', () => {
  const { code, report } = run();
  expect(code).toBe(0);
  expect(report.terms.every((t) => t.status === 'pass')).toBe(true);
  expect(report).not.toHaveProperty('verdict');
  expect(report).not.toHaveProperty('admitted');
});
for (const [name, change, id] of [
  ['head move', (d) => { pr(d).headRefOid = commit(d).oid = 'c'.repeat(40); }, 'pinnedHead'],
  ['base move', (d) => { pr(d).baseRefOid = 'c'.repeat(40); }, 'baseUnchanged'],
  ['base retarget', (d) => { pr(d).baseRefName = 'other'; }, 'baseUnchanged'],
  ['merged', (d) => { pr(d).merged = true; pr(d).state = 'MERGED'; }, 'unmerged'],
  ['closed', (d) => { pr(d).state = 'CLOSED'; }, 'open'],
  ['draft', (d) => { pr(d).isDraft = true; }, 'nonDraft'],
]) test(`${name} remains a measured failed fact`, () => {
  const { code, report } = run(change);
  expect(code).toBe(0);
  expect(fact(report, id).status).toBe('fail');
});
for (const [name, check, pending, successful] of [
  ['pending run', { __typename: 'CheckRun', name: 'ci', status: 'IN_PROGRESS', conclusion: null }, 'fail', 'n/a'],
  ['queued run', { __typename: 'CheckRun', name: 'ci', status: 'QUEUED', conclusion: null }, 'fail', 'n/a'],
  ['successful run', { __typename: 'CheckRun', name: 'ci', status: 'COMPLETED', conclusion: 'SUCCESS' }, 'pass', 'pass'],
  ['failed run', { __typename: 'CheckRun', name: 'ci', status: 'COMPLETED', conclusion: 'FAILURE' }, 'pass', 'fail'],
  ['pending status', { __typename: 'StatusContext', context: 'ci', state: 'PENDING' }, 'fail', 'n/a'],
  ['successful status', { __typename: 'StatusContext', context: 'ci', state: 'SUCCESS' }, 'pass', 'pass'],
  ['failed status', { __typename: 'StatusContext', context: 'ci', state: 'ERROR' }, 'pass', 'fail'],
]) test(name, () => {
  const { code, report } = run((d) => { contexts(d).nodes = [check]; });
  expect(code).toBe(0);
  expect(fact(report, 'pendingChecks').status).toBe(pending);
  expect(fact(report, 'checksSuccessful').status).toBe(successful);
});
for (const policy of [undefined, '{', {}, { version: 1, review: { admission: { status: 'known', headAgeThresholdSeconds: -1 } } }]) {
  test(`absent/malformed policy ${JSON.stringify(policy)} preserves raw PR facts`, () => {
    const { code, report } = run((d) => { d.policy = policy; });
    expect(code).toBe(2);
    for (const id of ['policy', 'headAge']) expect(fact(report, id).status).toBe('unknown');
    for (const id of ['open', 'nonDraft', 'pinnedHead', 'baseUnchanged', 'unmerged', 'pendingChecks']) {
      expect(fact(report, id).status).toBe('pass');
    }
  });
}
test('shipped T09 policy preserves its unknown policy rather than inventing a threshold', () => {
  const policy = JSON.parse(readFileSync(`${import.meta.dir}/../../skills/axstack/references/schedule-policy.json`, 'utf8'));
  const { code, report } = run((d) => { d.policy = policy; });
  expect(code).toBe(2);
  expect(fact(report, 'policy').status).toBe('unknown');
  expect(fact(report, 'headAge').evidence.ageSeconds).toBe(600);
});
for (const [name, change, id] of [
  ['pagination', (d) => { contexts(d).pageInfo.hasNextPage = true; }, 'pendingChecks'],
  ['missing checks', (d) => { delete commit(d).statusCheckRollup; }, 'pendingChecks'],
  ['unrecognized check', (d) => { contexts(d).nodes = [{}]; }, 'pendingChecks'],
  ['missing draft', (d) => { delete pr(d).isDraft; }, 'nonDraft'],
  ['future clock', (d) => { commit(d).committedDate = '2026-11-18T00:00:00Z'; }, 'headAge'],
  ['missing clock', (d) => { delete commit(d).committedDate; }, 'headAge'],
  ['wrong head commit', (d) => { commit(d).oid = 'd'.repeat(40); }, 'headAge'],
  ['wrong PR', (d) => { pr(d).number = 41; }, 'open'],
  ['wrong repository', (d) => { d.response.data.repository.nameWithOwner = 'other/repo'; }, 'open'],
  ['API errors', (d) => { d.response.errors = [{ message: 'denied' }]; }, 'open'],
]) test(`${name} reports unknown`, () => {
  const { code, report } = run(change);
  expect(code).toBe(2);
  expect(fact(report, id).status).toBe('unknown');
});
test('null rollup is observed absence of checks, not successful checks', () => {
  const { code, report } = run((d) => { commit(d).statusCheckRollup = null; });
  expect(code).toBe(0);
  expect(fact(report, 'pendingChecks').status).toBe('pass');
  expect(fact(report, 'checksSuccessful').status).toBe('n/a');
});
test('help and CLI errors', () => {
  const help = Bun.spawnSync([process.execPath, '--no-env-file', script, '--help'], { cwd: '/' });
  expect(help.exitCode).toBe(0);
  for (const flag of ['--repo', '--pr', '--head', '--base', '--base-ref', '--phase', '--input', '--policy', '--now', '--help']) {
    expect(help.stdout.toString()).toContain(flag);
  }
  expect(Bun.spawnSync([process.execPath, script, '--bad'], { cwd: '/' }).exitCode).toBe(1);
});
test('submission uses its recorded threshold and preserves pending treatment for the driver', () => {
  const { code, report } = run((d) => { d.phase = 'submission'; });
  expect(code).toBe(0);
  expect(fact(report, 'headAge').status).toBe('fail');
  expect(fact(report, 'headAge').evidence.thresholdSeconds).toBe(900);
  expect(fact(report, 'policy').evidence.recorded.pendingCheckTreatment).toBe('allow');
});
test('live adapter uses one read-only gh api query with the same facts', () => {
  const { code, report } = run(() => {}, true);
  expect(code).toBe(0);
  expect(report.source).toBe('gh api graphql');
  expect(report.terms.every((t) => t.status === 'pass')).toBe(true);
});
test('mixed failed and pending checks preserve both observations', () => {
  const { code, report } = run((d) => { contexts(d).nodes.push(
    { __typename: 'CheckRun', name: 'build', status: 'COMPLETED', conclusion: 'FAILURE' },
    { __typename: 'StatusContext', context: 'deploy', state: 'PENDING' }); });
  expect(code).toBe(0);
  expect(fact(report, 'pendingChecks').evidence.pending).toEqual(['deploy']);
  expect(fact(report, 'checksSuccessful').evidence.failed).toEqual(['build']);
});
