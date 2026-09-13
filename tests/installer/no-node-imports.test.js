// Migration lock: shipped runtime must be Bun with only the node:fs
// exception. Fails until every non-fs node: import is gone from src/bin,
// tests run on bun:test, and packaging names Bun.
import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from '../../src/posixpath.js';

const ROOT = join(import.meta.dir, '../..');
const SCAN_DIRS = ['src', 'bin', 'tests'];

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (full.endsWith('.js')) out.push(full);
  }
  return out;
}

describe('bun-native import surface', () => {
  test('no non-fs node: imports in src, bin, or tests', () => {
    const offenders = [];
    for (const dir of SCAN_DIRS) {
      for (const file of sourceFiles(join(ROOT, dir))) {
        const text = readFileSync(file, 'utf8');
        for (const match of text.matchAll(/from\s+['"](node:[^'"]+)['"]/g)) {
          const spec = match[1];
          if (spec !== 'node:fs' && spec !== 'node:fs/promises') {
            offenders.push(`${file}: ${spec}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('no node:test runner or child_process spawning remains', () => {
    const offenders = [];
    for (const dir of SCAN_DIRS) {
      for (const file of sourceFiles(join(ROOT, dir))) {
        const text = readFileSync(file, 'utf8');
        if (/\bexecFileSync\b/.test(text)) offenders.push(`${file}: execFileSync`);
        if (/from\s+['"]node:test['"]/.test(text)) offenders.push(`${file}: node:test`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('package declares the Bun floor and Bun test scripts', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.engines?.bun).toBeDefined();
    expect(pkg.engines).not.toHaveProperty('node');
    expect(pkg.scripts.test).toMatch(/bun test/);
    expect(pkg.scripts.test).not.toMatch(/node --test/);
  });

  test('CLI entry uses the Bun shebang', () => {
    const first = readFileSync(join(ROOT, 'bin', 'axstack.js'), 'utf8').split('\n')[0];
    expect(first.trim()).toBe('#!/usr/bin/env bun');
  });
});
