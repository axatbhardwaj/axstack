import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const script = `${import.meta.dir}/../../skills/axstack/scripts/pr-fresh.js`;
const head = 'a'.repeat(40);
const drift = 'c'.repeat(40);
const reviewId = 5937560000;
const marker = `<!-- axstack-automation verdict head=${head} -->`;
const pullRequestUrl = 'https://api.github.com/repos/example/project/pulls/42';
const body = `Untrusted prose: APPROVE at ${drift}\n\n${marker}\n`;
const submission = { id: reviewId, commit_id: head, pull_request_url: pullRequestUrl, state: 'CHANGES_REQUESTED', body };
const receipt = {
  version: 1,
  reviewId,
  submission,
  immediateReadback: { ...submission },
  laterReadback: { id: reviewId, commit_id: drift, pull_request_url: pullRequestUrl },
};

function run(data, extra = []) {
  const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/pr-fresh-receipt-`);
  try {
    const input = `${root}/receipt.json`;
    const bytes = typeof data === 'string' ? data : JSON.stringify(data);
    if (data !== undefined) writeFileSync(input, bytes);
    const emptyPath = `${root}/empty`;
    mkdirSync(emptyPath);
    const result = Bun.spawnSync(
      [process.execPath, '--no-env-file', script, '--repo', 'example/project', '--pr', '42', '--head', head,
        '--receipt', input, ...extra],
      { cwd: '/', env: { ...process.env, PATH: emptyPath, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0' } },
    );
    expect(readdirSync(root).sort()).toEqual(data === undefined ? ['empty'] : ['empty', 'receipt.json']);
    if (data !== undefined) expect(readFileSync(input, 'utf8')).toBe(bytes);
    return { code: result.exitCode, stderr: result.stderr.toString(), stdout: result.stdout.toString() };
  } finally {
    rmSync(root, { recursive: true });
  }
}

function report(data, exit = 0) {
  const { code, stderr, stdout } = run(data);
  expect(stderr).toBe('');
  expect(code).toBe(exit);
  expect(stdout).not.toContain('Untrusted prose');
  const result = JSON.parse(stdout);
  expect(result).toMatchObject({ source: 'saved receipt', repo: 'example/project', pr: 42, head });
  expect(result).not.toHaveProperty('comparedAt');
  expect(result).not.toHaveProperty('admitted');
  return Object.fromEntries(result.terms.map((term) => [term.id, term]));
}

test('original publication binds both exact responses; a later same-ID change is only drift', () => {
  const { publication, laterReviewCommit } = report(receipt);
  expect(publication).toMatchObject({ status: 'pass', evidence: { reviewId, state: 'CHANGES_REQUESTED' } });
  expect(laterReviewCommit).toMatchObject({ status: 'fail', evidence: { reason: 'drift', commitId: drift } });
  expect(report({ ...receipt, laterReadback: { ...receipt.laterReadback, commit_id: head } }).laterReviewCommit.status)
    .toBe('pass');
  expect(report({ ...receipt, laterReadback: undefined }).laterReviewCommit.status).toBe('n/a');
});

for (const [name, data, kind, field, status] of [
  ['missing file', undefined, 'missing', 'receipt', 'unknown'],
  ['malformed JSON', '{', 'malformed', 'receipt', 'unknown'],
  ['null envelope', 'null', 'malformed', 'receipt', 'unknown'],
  ['unsupported version', { ...receipt, version: 2 }, 'malformed', 'version', 'unknown'],
  ['missing original ID', { ...receipt, reviewId: undefined }, 'missing', 'reviewId', 'unknown'],
  ['malformed ID', { ...receipt, reviewId: String(reviewId) }, 'malformed', 'reviewId', 'unknown'],
  ['missing immediate readback', { ...receipt, immediateReadback: undefined }, 'missing', 'immediateReadback', 'unknown'],
  ['different original response ID', { ...receipt, submission: { ...submission, id: reviewId + 2 } },
    'conflicts', 'submission.id', 'fail'],
  ['different immediate ID', { ...receipt, immediateReadback: { ...submission, id: reviewId + 1 } },
    'conflicts', 'immediateReadback.id', 'fail'],
  ['different immediate PR', { ...receipt, immediateReadback: { ...submission, pull_request_url: `${pullRequestUrl}1` } },
    'conflicts', 'immediateReadback.pull_request_url', 'fail'],
  ['different submit commit', { ...receipt, submission: { ...submission, commit_id: drift } },
    'conflicts', 'submission.commit_id', 'fail'],
  ['different immediate commit', { ...receipt, immediateReadback: { ...submission, commit_id: drift } },
    'conflicts', 'immediateReadback.commit_id', 'fail'],
  ['different immediate state', { ...receipt, immediateReadback: { ...submission, state: 'APPROVED' } },
    'conflicts', 'immediateReadback.state', 'fail'],
  ['non-binding review', { ...receipt, submission: { ...submission, state: 'COMMENTED' } },
    'conflicts', 'submission.state', 'fail'],
  ['no marker', { ...receipt, submission: { ...submission, body: `APPROVE at ${head}` } },
    'missing', 'submission.marker', 'unknown'],
  ['abbreviated marker', { ...receipt, submission: { ...submission, body: marker.replace(head, head.slice(0, 7)) } },
    'malformed', 'submission.marker', 'unknown'],
  ['marker followed by prose', { ...receipt, submission: { ...submission, body: `${marker}\ntrailing prose` } },
    'malformed', 'submission.marker', 'unknown'],
  ['ambiguous markers', { ...receipt, submission: { ...submission, body: `${marker}\n${marker}` } },
    'malformed', 'submission.marker', 'unknown'],
  ['different immediate marker', { ...receipt, immediateReadback: { ...submission, body: marker.replace(head, drift) } },
    'conflicts', 'immediateReadback.marker', 'fail'],
]) {
  test(`${name} cannot be replaced by a later readback`, () => {
    const laterRequested = typeof data === 'object' && data.version === 1 && 'laterReadback' in data;
    const { publication, laterReviewCommit } = report(data, status === 'unknown' || laterRequested ? 2 : 0);
    expect(publication.status).toBe(status);
    expect(publication.evidence[kind]).toContain(field);
    expect(laterReviewCommit.status).toBe(laterRequested ? 'unknown' : 'n/a');
    if (laterRequested) expect(laterReviewCommit.evidence.reason).not.toBe('drift');
  });
}

test('later readback must identify the same review before it can show drift', () => {
  const other = { ...receipt.laterReadback, id: reviewId + 1 };
  const { publication, laterReviewCommit } = report({ ...receipt, laterReadback: other });
  expect(publication.status).toBe('pass');
  expect(laterReviewCommit).toMatchObject({ status: 'fail', evidence: { conflicts: ['laterReadback.id'] } });
  expect(laterReviewCommit.evidence.reason).not.toBe('drift');
  expect(report({ ...receipt, laterReadback: null }, 2).laterReviewCommit.evidence.missing).toEqual(['laterReadback']);
});

test('later-only metadata cannot fill an original evidence gap', () => {
  const { publication, laterReviewCommit } = report({ ...receipt, immediateReadback: undefined,
    laterReadback: { ...submission, commit_id: head } }, 2);
  expect(publication.evidence.missing).toEqual(['immediateReadback']);
  expect(laterReviewCommit.evidence.reason).toBe('original not established');
});

test('receipt mode cannot be mixed with phase policy or live observation flags', () => {
  for (const extra of [['--phase', 'submission'], ['--input', '/fixture'], ['--policy', '/fixture']]) {
    const { code, stderr, stdout } = run(receipt, extra);
    expect(code).toBe(1);
    expect(stderr).toContain('receipt');
    expect(stdout).toBe('');
  }
});
