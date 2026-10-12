import { afterAll, expect, test } from 'bun:test';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { main } from '../../skills/axstack/scripts/pr-shape.js';

const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/pr-shape-tests-`);
chmodSync(root, 0o700);
afterAll(() => rmSync(root, { recursive: true }));

function git(repo, ...args) {
  const result = Bun.spawnSync(['git', '-c', 'core.hooksPath=/dev/null', ...args], {
    cwd: repo, stdout: 'pipe', stderr: 'pipe',
  });
  if (result.exitCode) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
}

function commit(repo, message) {
  git(repo, 'add', '--all');
  git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', message);
  return git(repo, 'rev-parse', 'HEAD');
}

function fixture() {
  const repo = mkdtempSync(`${root}/repo-`);
  git(repo, 'init', '-q', '-b', 'main');
  mkdirSync(`${repo}/nested`);
  writeFileSync(`${repo}/old name.txt`, 'rename\n'.repeat(12));
  writeFileSync(`${repo}/delete.txt`, 'gone\n');
  writeFileSync(`${repo}/.gitattributes`, '*.generated linguist-generated\n');
  commit(repo, 'root');
  writeFileSync(`${repo}/parent.txt`, 'parent change\n'.repeat(20));
  const parent = commit(repo, 'stack parent');
  git(repo, 'branch', 'parent');
  git(repo, 'mv', 'old name.txt', 'renamed ü.txt');
  git(repo, 'rm', 'delete.txt');
  const files = {
    'space name.txt': 'one\ntwo\n', 'ü.txt': 'unicode\n', '-leading.txt': 'dash\n',
    'tab\tline\n.txt': 'unusual\n', 'nested/package-lock.json': 'lock\nlock\n',
    'bun.lock': 'bun\n', 'not-a-lock.json': 'ordinary\n',
    'code.generated': 'generated\n'.repeat(4), 'nested/local.generated': 'manual\n',
    'nested/explicit.js': 'generated true\n', 'nested/bun.lock': 'both buckets\n',
  };
  for (const [path, content] of Object.entries(files)) writeFileSync(`${repo}/${path}`, content);
  writeFileSync(`${repo}/nested/.gitattributes`, 'local.generated -linguist-generated\nexplicit.js linguist-generated=true\nbun.lock linguist-generated\n');
  writeFileSync(`${repo}/binary.bin`, new Uint8Array([0, 1, 2, 3]));
  const head = commit(repo, 'child');
  // An advanced base still measures from the shared parent, not its tip.
  git(repo, 'checkout', '-q', 'parent');
  writeFileSync(`${repo}/base-only.txt`, 'base only\n'.repeat(30));
  const base = commit(repo, 'advanced parent');
  git(repo, 'checkout', '-q', 'main');
  // Working tree and index attributes must not replace the committed head.
  writeFileSync(`${repo}/.gitattributes`, '* linguist-generated\n');
  git(repo, 'add', '.gitattributes');
  return { repo, parent, head, base };
}

function invoke(repo, argv) {
  const cwd = process.cwd();
  let stdout = '', stderr = '';
  try {
    process.chdir(repo);
    const code = main(argv, { stdout: (text) => { stdout += text; }, stderr: (text) => { stderr += text; } });
    return { code, stdout, stderr, data: stdout.startsWith('{') ? JSON.parse(stdout) : null };
  } finally { process.chdir(cwd); }
}

test('measures the stacked merge-base with renames, binaries and unusual paths without mutating Git', () => {
  const { repo, parent, head, base } = fixture();
  const status = git(repo, 'status', '--porcelain', '--ignored');
  const index = readFileSync(`${repo}/.git/index`);
  const result = invoke(repo, ['--base', 'parent', '--head', 'HEAD']);
  expect(result.code, result.stderr).toBe(0);
  expect(result.data.inputs).toMatchObject({ baseRef: 'parent', headRef: 'HEAD', base, head });
  expect(result.data.mergeBase).toMatchObject({ status: 'pass', value: parent });
  // Independent Git oracle (non-NUL output suffices for numeric columns).
  const rows = git(repo, 'diff', '-M', '--numstat', `${parent}..${head}`).split('\n');
  const textRows = rows.filter((row) => !row.startsWith('-\t-\t'));
  expect(result.data.totals).toMatchObject({ status: 'pass',
    additions: textRows.reduce((sum, row) => sum + Number(row.split('\t')[0]), 0),
    deletions: textRows.reduce((sum, row) => sum + Number(row.split('\t')[1]), 0),
    renames: 1, binaries: rows.length - textRows.length, files: rows.length,
  });
  expect(result.data.buckets.lockfiles).toMatchObject({ status: 'pass', files: 3, additions: 4, deletions: 0, binaries: 0, renames: 0 });
  expect(result.data.buckets.generated).toMatchObject({ status: 'pass', files: 3, additions: 6, deletions: 0, binaries: 0, renames: 0 });
  for (const term of [result.data.mergeBase, result.data.totals, ...Object.values(result.data.buckets)]) {
    expect(term.evidence.commands.length).toBeGreaterThan(0);
    for (const command of term.evidence.commands) {
      const reproduced = Bun.spawnSync(command, { cwd: repo, stdout: 'pipe', stderr: 'pipe',
        stdin: command.includes('check-attr') ? new TextEncoder().encode('code.generated\0nested/explicit.js\0nested/bun.lock\0') : 'ignore',
        env: { ...process.env, ...term.evidence.environment },
      });
      expect(reproduced.exitCode, reproduced.stderr.toString()).toBe(0);
      if (command.includes('check-attr')) expect(reproduced.stdout.toString()).toContain('code.generated\0linguist-generated\0set\0');
    }
  }
  expect(result.data.disclosures).toMatch(/formatter-only.*manual/i);
  expect(result.data.disclosures).toMatch(/never subtract/i);
  expect(git(repo, 'status', '--porcelain', '--ignored')).toBe(status);
  expect(readFileSync(`${repo}/.git/index`)).toEqual(index);
  expect(git(repo, 'rev-parse', 'HEAD')).toBe(head);
});

test('help advertises every flag, a complete example, fixed buckets and read-only behavior', () => {
  const result = invoke(root, ['--help']);
  expect(result.code, result.stderr).toBe(0);
  for (const flag of ['--help', '--base', '--head']) expect(result.stdout).toContain(flag);
  expect(result.stdout).toMatch(/bun scripts\/pr-shape\.js --base main --head HEAD/);
  expect(result.stdout).toMatch(/read-only/i);
  expect(result.stdout).toContain('linguist-generated');
  for (const name of ['bun.lock', 'bun.lockb', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock']) {
    expect(result.stdout).toContain(name);
  }
});

test('a nested caller measures the same repository paths despite diff.relative configuration', () => {
  const { repo } = fixture();
  git(repo, 'config', 'diff.relative', 'true');
  const result = invoke(`${repo}/nested`, ['--base', 'parent', '--head', 'HEAD']);
  expect(result.code, result.stderr).toBe(0);
  expect(result.data.totals).toMatchObject({ files: 15, renames: 1, binaries: 1 });
  expect(result.data.buckets.lockfiles).toMatchObject({ files: 3, additions: 4 });
  expect(result.data.buckets.generated).toMatchObject({ files: 3, additions: 6 });
});

test('local info attributes hold only the generated bucket without inventing zero counts', () => {
  const { repo, base, head } = fixture();
  const info = `${repo}/.git/info/attributes`;
  writeFileSync(info, '* linguist-generated\n');
  const status = git(repo, 'status', '--porcelain', '--ignored');
  const index = readFileSync(`${repo}/.git/index`);
  const result = invoke(`${repo}/nested`, ['--base', 'parent', '--head', 'HEAD']);
  expect(result.code, result.stderr).toBe(2);
  expect(result.data.inputs).toMatchObject({ base, head });
  expect(result.data.totals).toMatchObject({ status: 'pass', files: 15, renames: 1, binaries: 1 });
  expect(result.data.buckets.lockfiles).toMatchObject({ status: 'pass', files: 3, additions: 4 });
  expect(result.data.buckets.generated).toMatchObject({ status: 'unknown', evidence: {
    reason: `local attribute override exists: ${info}`,
  } });
  for (const metric of ['files', 'additions', 'deletions', 'renames', 'binaries']) {
    expect(result.data.buckets.generated).not.toHaveProperty(metric);
  }
  expect(readFileSync(info, 'utf8')).toBe('* linguist-generated\n');
  expect(git(repo, 'status', '--porcelain', '--ignored')).toBe(status);
  expect(readFileSync(`${repo}/.git/index`)).toEqual(index);
  expect(git(repo, 'rev-parse', 'HEAD')).toBe(head);
});

test.each([[], ['--base'], ['--base', 'main'], ['--head', 'HEAD'],
  ['--base', 'main', '--head'], ['--base', 'main', '--head', 'HEAD', '--unknown'],
  ['--base', 'main', '--base', 'main', '--head', 'HEAD'],
  ['--base', '--all', '--head', 'HEAD'],
].map((argv) => [argv]))('input errors explain the correction: %j', (argv) => {
  const result = invoke(root, argv);
  expect(result.code).toBe(1);
  expect(result.stderr).toMatch(/pass --base|pass --head|use --help|pass it once/);
  expect(result.stdout).toBe('');
});

test('outside Git and unresolved refs give actionable errors', () => {
  const outside = invoke(root, ['--base', 'main', '--head', 'HEAD']);
  expect(outside.code).toBe(1);
  expect(outside.stderr).toMatch(/Git checkout/i);
  const { repo } = fixture();
  const invalid = invoke(repo, ['--base', 'missing', '--head', 'HEAD']);
  expect(invalid.code).toBe(1);
  expect(invalid.stderr).toMatch(/--base.*commit/i);
});

test('unrelated histories retain every measurement as unknown rather than inventing zero counts', () => {
  const { repo, head } = fixture();
  git(repo, 'checkout', '--orphan', 'unrelated');
  const base = commit(repo, 'unrelated root');
  const result = invoke(repo, ['--base', base, '--head', head]);
  expect(result.code).toBe(2);
  expect(result.data.inputs).toMatchObject({ base, head });
  for (const term of [result.data.mergeBase, result.data.totals, result.data.buckets?.lockfiles, result.data.buckets?.generated]) {
    expect(term?.status).toBe('unknown');
    expect(term.evidence.commands[0].slice(-3)).toEqual(['merge-base', base, head]);
    expect(term.evidence.reason).toMatch(/no common ancestor/);
    expect(term).not.toHaveProperty('additions');
  }
});

// Local Git characterization only: forge retargeting is a separate boundary.
test('three-layer chains and siblings preserve commit identity through parent/base merges and retarget shape', () => {
  const repo = mkdtempSync(`${root}/chain-`);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.name', 'Fixture');
  git(repo, 'config', 'user.email', 'fixture@example.test');
  writeFileSync(`${repo}/root.txt`, 'root\n');
  const base = commit(repo, 'base');
  git(repo, 'checkout', '-qb', 'parent');
  writeFileSync(`${repo}/parent.txt`, 'parent\n');
  const parent = commit(repo, 'parent');
  git(repo, 'checkout', '-qb', 'child');
  writeFileSync(`${repo}/child.txt`, 'child\n');
  const child = commit(repo, 'child');
  git(repo, 'checkout', '-qb', 'grandchild');
  writeFileSync(`${repo}/grandchild.txt`, 'grandchild\n');
  const grandchild = commit(repo, 'grandchild');
  git(repo, 'checkout', '-qb', 'sibling', parent);
  writeFileSync(`${repo}/sibling.txt`, 'sibling\n');
  const sibling = commit(repo, 'sibling');
  const identities = [parent, child, grandchild, sibling].map((sha) => git(repo, 'cat-file', 'commit', sha));
  const ancestor = (older, newer) => Bun.spawnSync(['git', 'merge-base', '--is-ancestor', older, newer],
    { cwd: repo, stdout: 'pipe', stderr: 'pipe' }).exitCode === 0;

  git(repo, 'checkout', '-q', 'parent');
  writeFileSync(`${repo}/fix.txt`, 'parent fix\n');
  const fixed = commit(repo, 'parent fix after child review');
  expect(ancestor(fixed, child)).toBe(false);
  git(repo, 'checkout', '-q', 'child');
  git(repo, 'merge', '--no-ff', '-qm', 'refresh parent', 'parent');
  const refreshed = git(repo, 'rev-parse', 'HEAD');
  expect(ancestor(child, refreshed)).toBe(true);
  expect(ancestor(fixed, refreshed)).toBe(true);
  expect(ancestor(fixed, grandchild)).toBe(false);
  expect(ancestor(fixed, sibling)).toBe(false);
  const beforeRetarget = invoke(repo, ['--base', 'parent', '--head', 'child']).data;
  expect(beforeRetarget.totals).toMatchObject({ additions: 1, deletions: 0, files: 1 });

  git(repo, 'checkout', '-q', 'main');
  git(repo, 'merge', '--no-ff', '-qm', 'integrate parent', 'parent');
  const integrated = git(repo, 'rev-parse', 'HEAD');
  expect(ancestor(fixed, integrated)).toBe(true);
  // Original parent commits alone do not contain the integration merge commit.
  expect(ancestor(integrated, refreshed)).toBe(false);
  const afterRetarget = invoke(repo, ['--base', 'main', '--head', 'child']).data;
  expect(afterRetarget.inputs.head).toBe(refreshed);
  expect(afterRetarget.inputs.base).toBe(integrated);
  expect(afterRetarget.inputs.base).not.toBe(beforeRetarget.inputs.base);
  expect(afterRetarget.totals).toEqual(beforeRetarget.totals);
  // A retarget changes evidence identity despite unchanged head and patch shape.
  expect(git(repo, 'rev-parse', 'grandchild')).toBe(grandchild);
  expect(git(repo, 'rev-parse', 'sibling')).toBe(sibling);
  git(repo, 'checkout', '-q', 'child');
  git(repo, 'merge', '--no-ff', '-qm', 'enter integration tip', 'main');
  expect(ancestor(integrated, 'child')).toBe(true);
  expect(invoke(repo, ['--base', 'main', '--head', 'child']).data.mergeBase.value).toBe(integrated);

  git(repo, 'checkout', '-q', 'main');
  writeFileSync(`${repo}/other.txt`, 'other integration\n');
  const currentTip = commit(repo, 'integration advanced');
  expect(ancestor(currentTip, 'child')).toBe(false);
  git(repo, 'checkout', '-q', 'sibling');
  git(repo, 'merge', '--no-ff', '-qm', 'batch parent and integration changes', 'main');
  expect(ancestor(currentTip, 'sibling')).toBe(true);
  expect(ancestor(sibling, 'sibling')).toBe(true);
  expect(invoke(repo, ['--base', 'main', '--head', 'sibling']).data.totals).toMatchObject({ files: 1, additions: 1 });
  git(repo, 'checkout', '-q', 'grandchild');
  git(repo, 'merge', '--no-ff', '-qm', 'refresh direct parent when ready', 'child');
  expect(ancestor(grandchild, 'grandchild')).toBe(true);
  expect(invoke(repo, ['--base', 'child', '--head', 'grandchild']).data.totals).toMatchObject({ files: 1, additions: 1 });
  expect([parent, child, grandchild, sibling].map((sha) => git(repo, 'cat-file', 'commit', sha))).toEqual(identities);

  git(repo, 'checkout', '-qb', 'external-squash', base);
  git(repo, 'merge', '--squash', 'parent');
  commit(repo, 'external squash loses reviewed parent identity');
  expect(ancestor(fixed, 'external-squash')).toBe(false);
});
