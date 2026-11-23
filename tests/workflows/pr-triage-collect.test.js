import { expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const skill = `${import.meta.dir}/../../skills/axstack`;
const prompt = readFileSync(`${skill}/references/pr-triage-nightly.md`, 'utf8');
// Drive the published entry. The old entry could only run its identity lookup directly.
const command = prompt.match(/^```bash\n([\s\S]+?)\n```/m)?.[1] ?? prompt.match(/`(gh api user --jq \.login)`/)[1];
const repos = ['one/project', 'two/project', 'three/project', 'four/project', 'five/project'];
const head = 'a'.repeat(40);
const url = 'https://github.com/one/project/pull/';

async function run(repositories, mode = 'mixed') {
  const dir = mkdtempSync(`${process.env.TMPDIR}/pr-triage-`);
  try {
    const trace = `${dir}/calls`;
    writeFileSync(`${dir}/gh`, `#!/bin/sh\nexec "${process.execPath}" --no-env-file "$TRIAGE_FIXTURE" "$@"\n`);
    chmodSync(`${dir}/gh`, 0o700);
    const child = Bun.spawn(['bash', '-c', command, 'triage', ...repositories], {
      stdout: 'pipe', stderr: 'pipe',
      env: {
        ...process.env, PATH: `${dir}:${process.env.PATH}`, AXSTACK_SKILL_DIR: skill,
        TRIAGE_FIXTURE: `${import.meta.dir}/pr-triage-forge-fixture.js`, TRIAGE_TEST_MODE: mode, TRIAGE_TEST_TRACE: trace,
      },
    });
    const [output, stderr, exit] = await Promise.all([child.stdout.text(), child.stderr.text(), child.exited]);
    return { output, stderr, exit, calls: readFileSync(trace, 'utf8').trim().split('\n').map((line) => JSON.parse(line)) };
  } finally {
    rmSync(dir, { recursive: true });
  }
}

test('nightly entry batches the full own queue and emits compact, field-local evidence', async () => {
  const { output, stderr, calls, exit } = await run(repos);
  expect(output).toContain('"repositories":');
  const report = JSON.parse(output);
  expect(exit).toBe(2);
  expect(stderr).toBe('');
  expect(report.login).toBe('axat');
  expect(report.repositories.map(({ repo, coverage, prs }) => [repo, coverage.status, prs.map(({ number }) => number)])).toEqual([
    ['one/project', 'pass', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
    ['two/project', 'unknown', []],
    ['three/project', 'pass', [15]],
    ['four/project', 'unknown', [16]],
    ['five/project', 'pass', []],
  ]);
  const [one, , three, four] = report.repositories;
  expect(one.prs[0]).toMatchObject({
    number: 1, url: `${url}1`, head, ci: 'FAILURE', checksUrl: `${url}1/checks`, reviews: 'CHANGES_REQUESTED',
    mergeable: 'CONFLICTING', draft: false, stale: true, unresolvedThreads: 3,
    threadLinks: [`${url}1#discussion_r11`, `${url}1#discussion_r12`],
  });
  expect(one.prs[1]).toMatchObject({
    number: 2, ci: 'PENDING', reviews: 'UNKNOWN', mergeable: 'MERGEABLE',
    draft: false, stale: false, unresolvedThreads: 'UNKNOWN',
  });
  expect(one.prs[2]).toMatchObject({
    number: 3, head, ci: 'NONE', reviews: 'NO_DECISION', mergeable: 'UNKNOWN',
    draft: true, stale: false, unresolvedThreads: 0,
  });
  expect(one.prs[3]).toMatchObject({ number: 4, ci: 'UNKNOWN', reviews: 'APPROVED', unresolvedThreads: 0 });
  expect(one.prs[4]).toMatchObject({ number: 5, ci: 'UNKNOWN', reviews: 'APPROVED', stale: 'UNKNOWN' });
  expect(one.prs[5]).toMatchObject({ number: 6, ci: 'UNKNOWN', head: 'UNKNOWN', reviews: 'UNKNOWN', stale: 'UNKNOWN' });
  expect(one.prs.at(-1)).toMatchObject({ number: 12, ci: 'SUCCESS', reviews: 'APPROVED' });
  expect(three.prs[0]).toMatchObject({ number: 15, ci: 'UNKNOWN', reviews: 'UNKNOWN', draft: 'UNKNOWN', mergeable: 'UNKNOWN' });
  expect(four.prs[0]).toMatchObject({ number: 16, ci: 'SUCCESS', reviews: 'APPROVED' });
  const detailCalls = calls.filter(({ details }) => details);
  expect(detailCalls.filter(({ repo }) => repo === 'one/project').map(({ details }) => details.length)).toEqual([8, 4]);
  expect(detailCalls.flatMap(({ details }) => details)).not.toContain(99);
  expect(calls.filter(({ cursor }) => cursor).map(({ cursor }) => cursor).sort()).toEqual(['one-next', 'partial-next']);
  expect(calls.filter(({ raw }) => raw)).toEqual([]);
  expect(output).not.toContain('UNTRUSTED_RAW_FORGE_TEXT');
  expect(output.length).toBeLessThan(5_600);
});

test('nightly entry distinguishes a complete empty queue from unavailable author identity', async () => {
  const empty = await run(['five/project'], 'clean');
  expect(empty.output).toContain('"repositories":');
  expect(empty.exit).toBe(0);
  expect(JSON.parse(empty.output).repositories).toEqual([{ repo: 'five/project', coverage: { status: 'pass' }, prs: [] }]);
  const unknown = await run(repos, 'no-login');
  expect(unknown.exit).toBe(2);
  expect(unknown.stderr).toBe('');
  expect(unknown.calls).toEqual([{ login: true }]);
  const report = JSON.parse(unknown.output);
  expect(report.login).toBe('UNKNOWN');
  expect(report.repositories.map(({ repo, coverage }) => [repo, coverage.status])).toEqual(repos.map((repo) => [repo, 'unknown']));
});
