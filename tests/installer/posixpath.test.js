// Explicit POSIX path semantics for src/posixpath.js (no pathe: pathe
// normalizes Windows backslashes, which must stay literal here).
// Backslash, percent, hash, and space cases lock the divergence.
import { describe, expect, test } from 'bun:test';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  resolveFrom,
  sep,
} from '../../src/posixpath.js';

describe('sep/isAbsolute', () => {
  test('posix separator and absolute detection', () => {
    expect(sep).toBe('/');
    expect(isAbsolute('/a')).toBe(true);
    expect(isAbsolute('/')).toBe(true);
    expect(isAbsolute('a')).toBe(false);
    expect(isAbsolute('')).toBe(false);
    expect(isAbsolute('C:\\x')).toBe(false);
  });
});

describe('join', () => {
  test('basic joins and normalization', () => {
    expect(join('/a', 'b', 'c')).toBe('/a/b/c');
    expect(join('/a', 'b/../c')).toBe('/a/c');
    expect(join('/a', './b')).toBe('/a/b');
    expect(join('/a//b', 'c')).toBe('/a/b/c');
    expect(join('a', 'b')).toBe('a/b');
    expect(join('/a', '')).toBe('/a');
    expect(join()).toBe('.');
  });
  test('backslashes stay literal (not separators)', () => {
    expect(join('/a', 'b\\c')).toBe('/a/b\\c');
    expect(join('a\\b', 'c')).toBe('a\\b/c');
  });
  test('spaces, percent, and hash are ordinary characters', () => {
    expect(join('/a b', 'c%20d')).toBe('/a b/c%20d');
    expect(join('/a', '#hash')).toBe('/a/#hash');
  });
});

describe('resolveFrom/resolve', () => {
  test('rightmost absolute segment anchors', () => {
    expect(resolveFrom('/cwd', '/a', 'b', '/c', 'd')).toBe('/c/d');
    expect(resolveFrom('/cwd', 'a', 'b')).toBe('/cwd/a/b');
    expect(resolveFrom('/cwd', 'a', '../b')).toBe('/cwd/b');
    expect(resolveFrom('/cwd')).toBe('/cwd');
  });
  test('.. cannot escape the filesystem root', () => {
    expect(resolveFrom('/cwd', '/../../a')).toBe('/a');
    expect(resolveFrom('/a', '../../b')).toBe('/b');
  });
  test('backslashes never anchor or split', () => {
    expect(resolveFrom('/cwd', 'a\\b')).toBe('/cwd/a\\b');
    expect(resolveFrom('/cwd', '\\a')).toBe('/cwd/\\a');
  });
  test('resolve uses the process working directory', () => {
    expect(resolve('/definitely/absolute/x')).toBe('/definitely/absolute/x');
  });
});

describe('relative', () => {
  test('sibling, parent, disjoint, and identity paths', () => {
    expect(relative('/a/b/c', '/a/b/d')).toBe('../d');
    expect(relative('/a/b', '/a/b/c/d')).toBe('c/d');
    expect(relative('/a/b/c', '/a/b')).toBe('..');
    expect(relative('/a', '/a')).toBe('');
    expect(relative('/', '/a')).toBe('a');
    expect(relative('/a/b', '/c')).toBe('../../c');
  });
  test('trailing slashes are ignored', () => {
    expect(relative('/a/b/', '/a/b/c/')).toBe('c');
  });
  test('backslashes are literal segments', () => {
    expect(relative('/a', '/a/b\\c')).toBe('b\\c');
    expect(relative('/a/b\\c', '/a')).toBe('..');
  });
});

describe('basename', () => {
  test('file names and edge paths', () => {
    expect(basename('/a/b.txt')).toBe('b.txt');
    expect(basename('/a/')).toBe('a');
    expect(basename('/')).toBe('');
    expect(basename('')).toBe('');
    expect(basename('plain')).toBe('plain');
    expect(basename('/a/b/')).toBe('b');
  });
  test('special characters are preserved', () => {
    expect(basename('/a/b\\c')).toBe('b\\c');
    expect(basename('/a/c%20d')).toBe('c%20d');
    expect(basename('/a/#hash')).toBe('#hash');
    expect(basename('/a/my file.md')).toBe('my file.md');
  });
});

describe('dirname', () => {
  test('parent directories and edge paths', () => {
    expect(dirname('/a/b')).toBe('/a');
    expect(dirname('/a')).toBe('/');
    expect(dirname('/')).toBe('/');
    expect(dirname('a')).toBe('.');
    expect(dirname('a/')).toBe('.');
    expect(dirname('')).toBe('.');
    expect(dirname('/a/b/')).toBe('/a');
  });
  test('backslashes do not split segments', () => {
    expect(dirname('/a/b\\c')).toBe('/a');
    expect(dirname('a\\b')).toBe('.');
  });
});
