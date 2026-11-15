import { afterAll, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const script = `${import.meta.dir}/../../skills/axstack/scripts/pr-shape.js`;
const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/pr-proof-`);
chmodSync(root, 0o700);
afterAll(() => rmSync(root, { recursive: true }));

function git(repo, ...args) {
  const result = Bun.spawnSync(['git', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: repo });
  if (result.exitCode) throw Error(result.stderr.toString());
  return result.stdout.toString().trim();
}
function commit(repo) {
  git(repo, 'add', '.');
  git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=f@example.invalid', 'commit', '-qm', 'fixture');
  return git(repo, 'rev-parse', 'HEAD');
}
function fixture() {
  const repo = mkdtempSync(`${root}/repo-`);
  git(repo, 'init', '-qb', 'main');
  writeFileSync(`${repo}/a`, 'old\n');
  const base = commit(repo);
  writeFileSync(`${repo}/a`, 'new\nsecond\n');
  commit(repo);
  writeFileSync(`${repo}/b`, 'third\n');
  const head = commit(repo);
  return { repo, base, head };
}
function block(base, head) {
  return `<!-- axstack:proof -->\nFiles: 2\nLines added: 3\nLines removed: 1\nCommits: 2\nHead SHA: ${head}\nBase SHA: ${base}\n<!-- /axstack:proof -->`;
}
function invoke(repo, args, env = {}) {
  const result = Bun.spawnSync([process.execPath, script, '--proof', ...args], {
    cwd: repo, env: { ...process.env, ...env },
  });
  const stdout = result.stdout.toString();
  return { code: result.exitCode, stdout, stderr: result.stderr.toString(),
    data: stdout.startsWith('{') ? JSON.parse(stdout) : null };
}
function statuses(result) {
  expect(result.data, result.stderr).not.toBeNull();
  return Object.fromEntries(result.data.terms.map((term) => [term.id, term.status]));
}
const passing = { files: 'pass', additions: 'pass', deletions: 'pass', commits: 'pass', head: 'pass', base: 'pass' };

test('renders independently known facts and checks the rendered body without changing Git', () => {
  const { repo, base, head } = fixture();
  const before = readFileSync(`${repo}/.git/index`);
  const rendered = invoke(repo, ['--base', base, '--head', head]);
  expect(statuses(rendered)).toEqual(passing);
  expect(rendered.code).toBe(0);
  expect(rendered.data.block).toBe(block(base, head));
  const body = `${root}/body.md`;
  writeFileSync(body, `Problem and fix.\n## Proof\n${rendered.data.block}\nTests passed.\nOther SHA: ${'a'.repeat(40)}`);
  const checked = invoke(repo, ['--base', base, '--head', head, '--body', body]);
  expect(statuses(checked)).toEqual(passing);
  expect(checked.data.terms.every((term) => term.evidence.commands.length > 0)).toBe(true);
  expect(readFileSync(`${repo}/.git/index`)).toEqual(before);
  expect(git(repo, 'status', '--porcelain', '--ignored')).toBe('');
});

for (const [id, edit] of [
  ['head', (s) => s.replace(/Head SHA: .*/, `Head SHA: ${'a'.repeat(40)}`)],
  ['base', (s) => s.replace(/Base SHA: .*/, `Base SHA: ${'b'.repeat(40)}`)],
  ['files', (s) => s.replace('Files: 2', 'Files: 3')],
  ['additions', (s) => s.replace('Lines added: 3', 'Lines added: 4')],
  ['deletions', (s) => s.replace('Lines removed: 1', 'Lines removed: 0')],
  ['commits', (s) => s.replace('Commits: 2', 'Commits: 1')],
]) {
  test(`edited ${id} fails against the current refs`, () => {
    const { repo, base, head } = fixture();
    const body = `${repo}/body.md`;
    writeFileSync(body, edit(block(base, head)));
    const result = invoke(repo, ['--base', base, '--head', head, '--body', body]);
    expect(statuses(result)).toEqual({ ...passing, [id]: 'fail' });
    expect(result.code).toBe(0); // measured failures are facts, not authority
  });
}

test('a real head advance and base-only advance invalidate unchanged body identities', () => {
  const { repo, base, head } = fixture();
  const body = `${root}/stale.md`;
  writeFileSync(body, block(base, head));
  git(repo, 'checkout', '-qb', 'base', base);
  writeFileSync(`${repo}/base-only`, 'base change\n');
  const advancedBase = commit(repo);
  git(repo, 'checkout', '-q', 'main');
  let result = invoke(repo, ['--base', advancedBase, '--head', 'HEAD', '--body', body]);
  expect(statuses(result)).toEqual({ ...passing, base: 'fail' });
  writeFileSync(`${repo}/c`, 'head change\n');
  commit(repo);
  result = invoke(repo, ['--base', base, '--head', 'HEAD', '--body', body]);
  expect(statuses(result).head).toBe('fail');
});

test('missing facts block and duplicate fields fail; matching SHA prefixes require seven characters', () => {
  const { repo, base, head } = fixture();
  const body = `${root}/invalid.md`;
  for (const [text, expected] of [
    ['Tests passed.', Object.fromEntries(Object.keys(passing).map((id) => [id, 'fail']))],
    [block(base, head).replace('Files: 2', 'Files: 2\nFiles: 2'), { ...passing, files: 'fail' }],
    [block(base.slice(0, 7), head.slice(0, 7)), passing],
    [block(base, head.slice(0, 6)), { ...passing, head: 'fail' }],
    [block(base, head) + '\n' + block(base, head), Object.fromEntries(Object.keys(passing).map((id) => [id, 'fail']))],
  ]) {
    writeFileSync(body, text);
    expect(statuses(invoke(repo, ['--base', base, '--head', head, '--body', body]))).toEqual(expected);
  }
});

test('unavailable Git data or body is unknown rather than zero or a match', () => {
  const { repo, base, head } = fixture();
  for (const args of [
    ['--base', 'missing', '--head', head],
    ['--base', base, '--head', head, '--body', `${root}/absent`],
  ]) {
    const result = invoke(repo, args);
    expect(result.code).toBe(2);
    expect(Object.values(statuses(result))).toContain('unknown');
    expect(result.data.terms.filter((term) => term.status === 'unknown').every((term) => term.evidence.reason)).toBe(true);
  }
  const noGit = invoke(root, ['--base', base, '--head', head], { PATH: root });
  expect(noGit.code).toBe(2);
  expect(Object.values(statuses(noGit)).every((s) => s === 'unknown')).toBe(true);
});

test('forge snapshot checks live body and uses unknown for unavailable or incomplete gh data', () => {
  const { repo, base, head } = fixture();
  const gh = `${root}/gh`;
  writeFileSync(gh, `#!${process.execPath}\nprocess.stdout.write(process.env.PROOF_RESPONSE ?? ''); process.exit(Number(process.env.PROOF_EXIT ?? 0));\n`);
  chmodSync(gh, 0o700);
  const snapshot = { changed_files: 2, additions: 3, deletions: 1, commits: 2,
    head: { sha: head }, base: { sha: base }, body: block(base, head) };
  const env = { PATH: root, PROOF_RESPONSE: JSON.stringify(snapshot) };
  const args = ['--pr', '42', '--repo', 'owner/repo'];
  const result = invoke(repo, args, env);
  expect(statuses(result)).toEqual(passing);
  expect(result.data.terms[0].evidence.commands).toEqual([['gh', 'api', 'repos/owner/repo/pulls/42']]);
  expect(result.data.terms[0].evidence.results).toEqual([{ exitCode: 0, stderr: '' }]);
  expect(statuses(invoke(repo, args, { ...env, PROOF_RESPONSE: JSON.stringify({ ...snapshot, body: block(base, 'f'.repeat(40)) }) })).head).toBe('fail');
  for (const extra of [{ PROOF_EXIT: '1' }, { PROOF_RESPONSE: '{}' }, { PROOF_RESPONSE: 'not JSON' }]) {
    const unavailable = invoke(repo, args, { ...env, ...extra });
    expect(unavailable.code).toBe(2);
    expect(Object.values(statuses(unavailable)).every((s) => s === 'unknown')).toBe(true);
    expect(unavailable.data.terms[0].evidence.results[0].exitCode).toBe(extra.PROOF_EXIT ? 1 : 0);
  }
});

test('proof help lists inputs, output, read-only boundary and exit codes', () => {
  const result = invoke(root, ['--help']);
  expect(result.code).toBe(0);
  for (const text of ['--proof', '--base', '--head', '--body', '--pr', '--repo', '--help', 'read-only', '0', '1', '2']) {
    expect(result.stdout).toContain(text);
  }
});
