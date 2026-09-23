import { afterEach, expect, test } from 'bun:test';
import {
  chmodSync,
  existsSync,
  copyFileSync,
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from '../../src/posixpath.js';
import { BUN_BIN, makeTempRoot } from '../installer/helpers.js';

const SCRIPT = resolve(import.meta.dir, '../../skills/axstack/scripts/archive-evidence.js');
const CONTRACT = resolve(import.meta.dir, '../../skills/axstack/references/evidence-archive.md');
const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = makeTempRoot('ax-evidence-archive-');
  roots.push(root);
  const source = join(root, 'source');
  const archive = join(root, 'private-archive');
  mkdirSync(join(source, 'nested'), { recursive: true });
  writeFileSync(join(source, 'review.md'), 'review evidence\n');
  writeFileSync(join(source, 'nested', 'receipt.json'), '{"ok":true}\n');
  writeFileSync(join(source, 'dirty-source.js'), 'must stay outside archive\n');
  return { root, source, archive };
}

function runArchive(f, extra = [], {
  expectFail = false,
  files = ['review.md', 'nested/receipt.json'],
  head = 'a'.repeat(40),
  env = process.env,
  script = SCRIPT,
  source = f.source,
} = {}) {
  const result = Bun.spawnSync([
    BUN_BIN, script,
    '--source-root', source,
    '--archive-root', f.archive,
    '--repo', 'defi-com/monorepo',
    '--pr', '123',
    '--head', head,
    '--dispatch', 'ctx_fixture123',
    ...files.flatMap((file) => ['--file', file]),
    ...extra,
  ], { stdout: 'pipe', stderr: 'pipe', env });
  const out = result.stdout.toString() + result.stderr.toString();
  if (expectFail) {
    expect(result.exitCode).not.toBe(0);
    return out;
  }
  expect(result.exitCode, out).toBe(0);
  return JSON.parse(result.stdout.toString());
}

function git(cwd, ...args) {
  const result = Bun.spawnSync(['git', '-C', cwd, ...args], { stdout: 'pipe', stderr: 'pipe' });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  return result.stdout.toString().trim();
}

function initializeRepo(f) {
  git(f.source, 'init', '-q');
  git(f.source, 'config', 'user.email', 'fixture@example.com');
  git(f.source, 'config', 'user.name', 'Fixture');
  git(f.source, 'add', 'dirty-source.js');
  git(f.source, 'commit', '-qm', 'fixture');
  return git(f.source, 'rev-parse', 'HEAD');
}

function runTaskArchive(f, extra = [], {
  expectFail = false,
  head = 'a'.repeat(40),
  identityArgs = ['--run', 'run_fixture123', '--task', 'task_fixture123'],
} = {}) {
  const result = Bun.spawnSync([
    BUN_BIN, SCRIPT,
    '--source-root', f.source,
    '--archive-root', f.archive,
    '--repo', 'defi-com/monorepo',
    ...identityArgs,
    '--head', head,
    '--dispatch', 'ctx_fixture123',
    '--file', 'review.md',
    ...extra,
  ], { stdout: 'pipe', stderr: 'pipe' });
  const out = result.stdout.toString() + result.stderr.toString();
  if (expectFail) {
    expect(result.exitCode).not.toBe(0);
    return out;
  }
  expect(result.exitCode, out).toBe(0);
  return JSON.parse(result.stdout.toString());
}

test('archives only explicitly classified evidence with private verified receipts', () => {
  const f = fixture();
  const receipt = runArchive(f);
  const manifestRaw = readFileSync(receipt.manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw);

  expect(receipt.status).toBe('archived');
  expect(Object.keys(receipt)).toEqual([
    'status', 'archiveDir', 'manifestPath', 'manifestHash', 'files',
  ]);
  expect(receipt.archiveDir).toContain(`/defi-com--monorepo/pr-123/${'a'.repeat(40)}/ctx_fixture123`);
  expect(receipt.manifestHash).toMatch(/^[0-9a-f]{64}$/);
  expect(manifest.identity).toEqual({
    repo: 'defi-com/monorepo',
    pr: 123,
    head: 'a'.repeat(40),
    dispatch: 'ctx_fixture123',
  });
  expect(Object.keys(manifest.files)).toEqual(['nested/receipt.json', 'review.md']);
  expect(manifestRaw).toBe(JSON.stringify(manifest, null, 2) + '\n');
  expect(readFileSync(join(receipt.archiveDir, 'files', 'review.md'), 'utf8')).toBe('review evidence\n');
  expect(existsSync(join(receipt.archiveDir, 'files', 'dirty-source.js'))).toBe(false);
  expect(lstatSync(receipt.archiveDir).mode & 0o077).toBe(0);
  expect(lstatSync(receipt.manifestPath).mode & 0o077).toBe(0);
});

test('repeat invocation verifies the same immutable archive and stable receipt', () => {
  const f = fixture();
  const first = runArchive(f);
  const second = runArchive(f);

  expect(second.status).toBe('verified');
  expect(second.archiveDir).toBe(first.archiveDir);
  expect(second.manifestHash).toBe(first.manifestHash);
});

test('archives non-PR supervised evidence under exact run and task identity', () => {
  const f = fixture();
  const receipt = runTaskArchive(f);
  const manifest = JSON.parse(readFileSync(receipt.manifestPath, 'utf8'));

  expect(receipt.archiveDir).toContain('/run-run_fixture123/task-task_fixture123/');
  expect(manifest.identity).toEqual({
    repo: 'defi-com/monorepo',
    run: 'run_fixture123',
    task: 'task_fixture123',
    head: 'a'.repeat(40),
    dispatch: 'ctx_fixture123',
  });
});

test('refuses incomplete or mixed PR and run/task identities before archive creation', () => {
  for (const [identityArgs, extra] of [
    [['--run', 'run_fixture123', '--task', 'task_fixture123'], ['--pr', '123']],
    [['--run', 'run_fixture123'], []],
  ]) {
    const f = fixture();
    const out = runTaskArchive(f, extra, { expectFail: true, identityArgs });
    expect(out).toMatch(/identity|mutually exclusive|run.*task|pr/i);
    expect(existsSync(f.archive)).toBe(false);
  }
});

test('installed skill layout runs without repository source files', () => {
  const f = fixture();
  const installedScript = join(f.root, 'installed', 'axstack', 'scripts', 'archive-evidence.js');
  mkdirSync(join(f.root, 'installed', 'axstack', 'scripts'), { recursive: true });
  copyFileSync(SCRIPT, installedScript);

  const receipt = runArchive(f, [], { script: installedScript });

  expect(receipt.status).toBe('archived');
});

test('repeat verification refuses archive corruption and extra files', () => {
  const f = fixture();
  const first = runArchive(f);
  writeFileSync(join(first.archiveDir, 'files', 'unexpected.txt'), 'corrupt\n');

  const out = runArchive(f, [], { expectFail: true });

  expect(out).toMatch(/mismatch|unexpected|corrupt/i);
});

test('repeat verification refuses changed source evidence', () => {
  const f = fixture();
  runArchive(f);
  writeFileSync(join(f.source, 'review.md'), 'changed evidence\n');

  const out = runArchive(f, [], { expectFail: true });

  expect(out).toMatch(/manifest mismatch|hash mismatch/i);
});

test('refuses evidence symlinks without creating an archive', () => {
  const f = fixture();
  const outside = join(f.root, 'outside.txt');
  writeFileSync(outside, 'outside\n');
  rmSync(join(f.source, 'review.md'));
  symlinkSync(outside, join(f.source, 'review.md'));

  const out = runArchive(f, [], { expectFail: true });

  expect(out).toMatch(/symlink|refus/i);
  expect(readFileSync(outside, 'utf8')).toBe('outside\n');
  expect(existsSync(f.archive)).toBe(false);
});

test('refuses a group-readable archive root', () => {
  const f = fixture();
  mkdirSync(f.archive, { mode: 0o750 });

  const out = runArchive(f, [], { expectFail: true });

  expect(out).toMatch(/private|permission|0700/i);
  expect(existsSync(join(f.archive, 'defi-com--monorepo'))).toBe(false);
});

test('retires the complete PR manifest file set and preserves neighboring state', () => {
  const f = fixture();
  const head = initializeRepo(f);
  const archive = runArchive(f, [], { head });

  const receipt = runArchive(f, [
    '--operation', 'retire',
    '--manifest-hash', archive.manifestHash,
  ], { head });

  expect(existsSync(join(f.source, 'review.md'))).toBe(false);
  expect(existsSync(join(f.source, 'nested', 'receipt.json'))).toBe(false);
  expect(receipt.status).toBe('retired');
  expect(receipt.removed).toEqual(['nested/receipt.json', 'review.md']);
  expect(receipt.alreadyAbsent).toEqual([]);
  expect(receipt.pending).toEqual([]);
  expect(existsSync(join(f.source, 'nested'))).toBe(true);
  expect(readFileSync(join(f.source, 'dirty-source.js'), 'utf8')).toBe('must stay outside archive\n');
  expect(existsSync(archive.manifestPath)).toBe(true);

  const repeat = runArchive(f, [
    '--operation', 'retire',
    '--manifest-hash', archive.manifestHash,
  ], { head });
  expect(repeat.removed).toEqual([]);
  expect(repeat.alreadyAbsent).toEqual(['nested/receipt.json', 'review.md']);
  expect(repeat.pending).toEqual([]);
});

test('retires evidence using exact non-PR Run and Task identity', () => {
  const f = fixture();
  initializeRepo(f);
  git(f.source, 'add', 'nested/receipt.json');
  git(f.source, 'commit', '-qm', 'track neighboring receipt');
  const head = git(f.source, 'rev-parse', 'HEAD');
  const archive = runTaskArchive(f, [], { head });

  const receipt = runTaskArchive(f, [
    '--operation', 'retire',
    '--manifest-hash', archive.manifestHash,
  ], { head });

  expect(receipt.status).toBe('retired');
  expect(receipt.removed).toEqual(['review.md']);
  expect(existsSync(join(f.source, 'review.md'))).toBe(false);
  expect(existsSync(join(f.source, 'nested', 'receipt.json'))).toBe(true);
});

test('retirement fails closed on archive, identity, root, source, and Git ambiguity', () => {
  {
    const f = fixture();
    const head = initializeRepo(f);
    const archive = runArchive(f, [], { head });
    const out = runArchive(f, ['--operation', 'retire', '--manifest-hash', '0'.repeat(64)], {
      expectFail: true, head,
    });
    expect(out).toMatch(/manifest hash mismatch/i);
    expect(existsSync(join(f.source, 'review.md'))).toBe(true);
    rmSync(archive.manifestPath);
    expect(runArchive(f, ['--operation', 'retire', '--manifest-hash', archive.manifestHash], {
      expectFail: true, head,
    })).toMatch(/missing file|manifest/i);
  }
  {
    const f = fixture();
    const head = initializeRepo(f);
    const archive = runArchive(f, [], { head });
    expect(runArchive(f, [
      '--file', 'dirty-source.js', '--operation', 'retire', '--manifest-hash', archive.manifestHash,
    ], { expectFail: true, head })).toMatch(/file set mismatch/i);
    expect(runArchive(f, ['--operation', 'retire', '--manifest-hash', archive.manifestHash], {
      expectFail: true, head, source: join(f.source, 'nested'),
    })).toMatch(/Git top-level|rev-parse/i);
  }
  {
    const f = fixture();
    const head = initializeRepo(f);
    const archive = runArchive(f, [], { head });
    writeFileSync(join(f.source, 'review.md'), 'changed after archive\n');
    const out = runArchive(f, ['--operation', 'retire', '--manifest-hash', archive.manifestHash], {
      expectFail: true, head,
    });
    expect(out).toMatch(/source evidence hash mismatch/i);
  }
  {
    const f = fixture();
    const head = initializeRepo(f);
    const archive = runArchive(f, [], { head });
    writeFileSync(join(f.source, 'neighbor.tmp'), 'unclassified\n');
    const out = runArchive(f, ['--operation', 'retire', '--manifest-hash', archive.manifestHash], {
      expectFail: true, head,
    });
    expect(out).toMatch(/unclassified Git dirt/i);
  }
  {
    const f = fixture();
    const head = initializeRepo(f);
    const archive = runArchive(f, [], { head });
    chmodSync(f.archive, 0o750);
    const out = runArchive(f, ['--operation', 'retire', '--manifest-hash', archive.manifestHash], {
      expectFail: true, head,
    });
    expect(out).toMatch(/permissions are not private/i);
  }
});

test('retirement rejects source symlinks, hard links, and staged files', () => {
  for (const mutate of [
    (f) => {
      rmSync(join(f.source, 'review.md'));
      symlinkSync(join(f.root, 'outside.txt'), join(f.source, 'review.md'));
    },
    (f) => linkSync(join(f.source, 'review.md'), join(f.source, 'review-hardlink.md')),
    (f) => git(f.source, 'add', 'review.md'),
  ]) {
    const f = fixture();
    writeFileSync(join(f.root, 'outside.txt'), 'outside\n');
    const head = initializeRepo(f);
    const archive = runArchive(f, [], { head });
    mutate(f);
    const out = runArchive(f, ['--operation', 'retire', '--manifest-hash', archive.manifestHash], {
      expectFail: true, head,
    });
    expect(out).toMatch(/symlink|hard-linked|tracked, staged/i);
    expect(existsSync(archive.manifestPath)).toBe(true);
  }
});

test('partial unlink failure reports progress and a safe retry converges', () => {
  const f = fixture();
  const head = initializeRepo(f);
  const archive = runArchive(f, [], { head });
  chmodSync(f.source, 0o555);

  const out = runArchive(f, ['--operation', 'retire', '--manifest-hash', archive.manifestHash], {
    expectFail: true, head,
  });
  const partial = JSON.parse(out.split('\n')[0]);
  expect(partial.status).toBe('partial');
  expect(partial.removed).toEqual(['nested/receipt.json']);
  expect(partial.alreadyAbsent).toEqual([]);
  expect(partial.pending).toEqual(['review.md']);
  expect(existsSync(archive.manifestPath)).toBe(true);

  chmodSync(f.source, 0o755);
  const receipt = runArchive(f, ['--operation', 'retire', '--manifest-hash', archive.manifestHash], { head });
  expect(receipt.removed).toEqual(['review.md']);
  expect(receipt.alreadyAbsent).toEqual(['nested/receipt.json']);
  expect(receipt.pending).toEqual([]);
});

test('installed helper retires the observed seven-file manifest set without a shell loop', () => {
  const f = fixture();
  rmSync(join(f.source, 'review.md'));
  rmSync(join(f.source, 'nested', 'receipt.json'));
  const files = Array.from({ length: 7 }, (_, index) => `evidence/receipt-${index + 1}.json`);
  mkdirSync(join(f.source, 'evidence'));
  for (const file of files) writeFileSync(join(f.source, file), `${file}\n`);
  const head = initializeRepo(f);
  const installedScript = join(f.root, 'installed', 'axstack', 'scripts', 'archive-evidence.js');
  mkdirSync(join(f.root, 'installed', 'axstack', 'scripts'), { recursive: true });
  copyFileSync(SCRIPT, installedScript);
  const archive = runArchive(f, [], { files, head, script: installedScript });

  const receipt = runArchive(f, [
    '--operation', 'retire', '--manifest-hash', archive.manifestHash,
  ], { files, head, script: installedScript });

  expect(receipt.removed).toEqual(files);
  expect(receipt.alreadyAbsent).toEqual([]);
  expect(receipt.pending).toEqual([]);
  for (const file of files) expect(existsSync(join(f.source, file))).toBe(false);
  expect(existsSync(join(f.source, 'evidence'))).toBe(true);
});

test('retirement rejects changed HEAD and unsafe archived or source file types', () => {
  {
    const f = fixture();
    const head = initializeRepo(f);
    const archive = runArchive(f, [], { head });
    writeFileSync(join(f.source, 'dirty-source.js'), 'new tracked bytes\n');
    git(f.source, 'add', 'dirty-source.js');
    git(f.source, 'commit', '-qm', 'advance head');
    const out = runArchive(f, ['--operation', 'retire', '--manifest-hash', archive.manifestHash], {
      expectFail: true, head,
    });
    expect(out).toMatch(/Git HEAD mismatch/i);
  }
  {
    const f = fixture();
    const head = initializeRepo(f);
    const archive = runArchive(f, [], { head });
    linkSync(join(archive.archiveDir, 'files', 'review.md'), join(f.root, 'archive-hardlink'));
    const out = runArchive(f, ['--operation', 'retire', '--manifest-hash', archive.manifestHash], {
      expectFail: true, head,
    });
    expect(out).toMatch(/hard-linked archive file/i);
  }
  {
    const f = fixture();
    const head = initializeRepo(f);
    const archive = runArchive(f, [], { head });
    rmSync(join(f.source, 'review.md'));
    mkdirSync(join(f.source, 'review.md'));
    const out = runArchive(f, ['--operation', 'retire', '--manifest-hash', archive.manifestHash], {
      expectFail: true, head,
    });
    expect(out).toMatch(/not a regular file/i);
  }
});

test('retirement detects a same-byte source replacement between preflight and unlink', () => {
  const f = fixture();
  const head = initializeRepo(f);
  const archive = runArchive(f, [], { head });
  const wrapperDir = join(f.root, 'bin');
  const wrapper = join(wrapperDir, 'git');
  mkdirSync(wrapperDir);
  writeFileSync(wrapper, `#!/bin/sh
if [ "$3" = status ]; then
  cp "$RACE_SOURCE" "$RACE_SOURCE.swap"
  mv "$RACE_SOURCE.swap" "$RACE_SOURCE"
fi
exec "${Bun.which('git')}" "$@"
`);
  chmodSync(wrapper, 0o755);

  const out = runArchive(f, ['--operation', 'retire', '--manifest-hash', archive.manifestHash], {
    expectFail: true,
    head,
    env: { ...process.env, PATH: `${wrapperDir}:${process.env.PATH}`, RACE_SOURCE: join(f.source, 'review.md') },
  });

  expect(out).toMatch(/source changed before retirement/i);
  expect(readFileSync(join(f.source, 'review.md'), 'utf8')).toBe('review evidence\n');
  expect(existsSync(archive.manifestPath)).toBe(true);
});

test('native retirement closes setup shells before exit proof and removes only verified evidence', () => {
  const contract = readFileSync(CONTRACT, 'utf8');
  expect(contract).toMatch(/unused\s+setup shell[^.]*exact-terminal close[^.]*re-list[^.]*exit/i);
  expect(contract).toMatch(/--operation retire --manifest-hash/);
  expect(contract).toMatch(/removed[^.]*alreadyAbsent[^.]*pending/);
  expect(contract).toMatch(/never replace[^.]*shell loop[^.]*broad deletion/i);
  expect(contract).toMatch(/Archive Script[^.]*provenance/i);
  expect(contract).toMatch(/unknown hook[^.]*provenance is not trusted[^.]*holds/i);
  for (const outcome of ['unconfigured', 'passed', 'failed', 'unknown']) expect(contract).toContain(`\`${outcome}\``);
  expect(contract).toMatch(/native worktree cleanup/i);
});
