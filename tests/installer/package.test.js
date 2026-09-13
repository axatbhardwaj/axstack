// Package smoke: `npm pack` into temp output, inspect bundled assets, run
// the packed CLI's check/install surface without touching the real home.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;

test('packed tarball contains bin/src/docs and CLI answers --help', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'axstack-pack-'));
  const tarball = execFileSync('npm', ['pack', '--pack-destination', outDir, '--silent'], {
    encoding: 'utf8',
    cwd: ROOT,
  }).trim().split('\n').at(-1);
  const tgz = join(outDir, tarball);
  assert.ok(existsSync(tgz), 'expected npm pack to produce a tarball');

  const listing = execFileSync('tar', ['-tzf', tgz], { encoding: 'utf8' });
  for (const needed of ['package/bin/axstack.js', 'package/src/installer.js', 'package/docs/installation.md']) {
    assert.ok(listing.includes(needed), `tarball missing ${needed}`);
  }

  const extractDir = mkdtempSync(join(tmpdir(), 'axstack-smoke-'));
  execFileSync('tar', ['-xzf', tgz, '-C', extractDir]);
  const cli = join(extractDir, 'package', 'bin', 'axstack.js');
  const help = execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.match(help.toLowerCase(), /install|check|uninstall/);
  // installation doc must document the three commands and explicit targets
  const doc = readFileSync(join(extractDir, 'package', 'docs', 'installation.md'), 'utf8');
  assert.match(doc, /axstack install/);
  assert.match(doc, /axstack check/);
  assert.match(doc, /axstack uninstall/);
});
