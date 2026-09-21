import { afterEach, expect, test } from 'bun:test';
import {
  existsSync,
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

function runArchive(f, extra = [], { expectFail = false } = {}) {
  const result = Bun.spawnSync([
    BUN_BIN, SCRIPT,
    '--source-root', f.source,
    '--archive-root', f.archive,
    '--repo', 'defi-com/monorepo',
    '--pr', '123',
    '--head', 'a'.repeat(40),
    '--dispatch', 'ctx_fixture123',
    '--file', 'review.md',
    '--file', 'nested/receipt.json',
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
  const manifest = JSON.parse(readFileSync(receipt.manifestPath, 'utf8'));

  expect(receipt.status).toBe('archived');
  expect(receipt.manifestHash).toMatch(/^[0-9a-f]{64}$/);
  expect(manifest.identity).toEqual({
    repo: 'defi-com/monorepo',
    pr: 123,
    head: 'a'.repeat(40),
    dispatch: 'ctx_fixture123',
  });
  expect(Object.keys(manifest.files)).toEqual(['nested/receipt.json', 'review.md']);
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
