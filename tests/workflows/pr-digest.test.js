import { expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';

const script = `${import.meta.dir}/../../skills/axstack/scripts/pr-digest.js`;
const pageInfo = { hasNextPage: false };
const connection = (nodes) => ({ pageInfo, nodes });
const check = (id = 'check-1') => ({ id, name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS', startedAt: '2026-09-30T00:00:00Z' });
const pr = () => ({
  number: 42, headRefOid: 'head-1', baseRefOid: 'base-1', body: 'PR body',
  isDraft: false, state: 'OPEN', mergeable: 'MERGEABLE',
  commits: connection([{ commit: { statusCheckRollup: { contexts: connection([check()]) } } }]),
  reviews: connection([{ id: 'review-1', state: 'APPROVED', body: 'looks good', updatedAt: '2026-09-30T00:00:00Z' }]),
  reviewRequests: connection([]), comments: connection([]),
  reviewThreads: connection([{ id: 'thread-1', isResolved: false, comments: connection([]) }]),
  labels: connection([{ id: 'label-1', name: 'do-not-merge' }]),
});
const response = (pullRequest) => ({ data: { repository: { pr0: pullRequest } } });

function run(before, after) {
  const dir = mkdtempSync(`${process.env.AXSTACK_TEST_TMP_ROOT ?? process.env.TMPDIR ?? '/tmp'}/axstack-pr-digest-`);
  const watermark = `${dir}/watermark.json`;
  const input = `${dir}/input.json`;
  writeFileSync(watermark, JSON.stringify(response(before)));
  writeFileSync(input, JSON.stringify(response(after)));
  const result = Bun.spawnSync(['bun', script, '--input', input, '--watermark', watermark], { stdout: 'pipe', stderr: 'pipe' });
  return { status: result.exitCode, output: result.stdout.toString(), error: result.stderr.toString() };
}

test('identical complete PR state is silent', () => {
  const result = run(pr(), pr());
  expect(result.status).toBe(0);
  expect(result.output).toBe('');
});

test('new CHANGES_REQUESTED wakes on an unchanged head and base', () => {
  const after = pr();
  after.reviews.nodes.push({ id: 'review-2', state: 'CHANGES_REQUESTED', body: 'fix', updatedAt: '2026-09-30T01:00:00Z' });
  const result = run(pr(), after);
  expect(result.status).toBe(10);
  expect(result.output).toContain('reviews');
});

test('new check attempt wakes on an unchanged head', () => {
  const after = pr();
  after.commits.nodes[0].commit.statusCheckRollup.contexts.nodes[0] = check('check-2');
  const result = run(pr(), after);
  expect(result.status).toBe(10);
  expect(result.output).toContain('checks');
});

test('resolved thread wakes on an unchanged head', () => {
  const after = pr();
  after.reviewThreads.nodes[0].isResolved = true;
  const result = run(pr(), after);
  expect(result.status).toBe(10);
  expect(result.output).toContain('reviewThreads');
});

test('removed do-not-merge label wakes on an unchanged head', () => {
  const after = pr();
  after.labels.nodes = [];
  const result = run(pr(), after);
  expect(result.status).toBe(10);
  expect(result.output).toContain('labels');
});

test('unfollowed pagination makes readiness incomplete', () => {
  const after = pr();
  after.reviewThreads.nodes[0].comments.pageInfo = { hasNextPage: true };
  const result = run(pr(), after);
  expect(result.status).toBe(2);
  expect(result.output).toBe('');
});

test('GraphQL errors make readiness incomplete', () => {
  const dir = mkdtempSync(`${process.env.AXSTACK_TEST_TMP_ROOT ?? process.env.TMPDIR ?? '/tmp'}/axstack-pr-digest-`);
  const input = `${dir}/error.json`;
  writeFileSync(input, JSON.stringify({ errors: [{ message: 'rate limited' }] }));
  const result = Bun.spawnSync(['bun', script, '--input', input, '--watermark', `${dir}/missing.json`], { stdout: 'pipe', stderr: 'pipe' });
  expect(result.exitCode).toBe(2);
  expect(result.stdout.toString()).toBe('');
});
