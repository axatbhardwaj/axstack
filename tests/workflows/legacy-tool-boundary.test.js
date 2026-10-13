import { expect, test } from 'bun:test';
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { makeTempRoot } from '../installer/helpers.js';

const root = `${import.meta.dir}/../..`;
// Enumerated compatibility surfaces; no active provisioner or viewer route.
const compatibility = new Set([
  'src/archify-legacy.js', 'src/manifest.js', 'src/installer.js',
  'tests/installer/archify-fixture.js', 'tests/installer/archify-retirement.test.js',
  'tests/installer/legacy-archify.test.js', 'tests/workflows/anatomy-boundary.test.js',
  'tests/workflows/legacy-tool-boundary.test.js',
]);

function violationsIn(directory) {
  const tracked = Bun.spawnSync(['git', 'ls-files', '-z'],
    { cwd: directory, stdout: 'pipe', stderr: 'pipe' });
  expect(tracked.exitCode).toBe(0);
  // Git also lists symlinks; scan regular repository files, not linked directories.
  const files = tracked.stdout.toString().split('\0').filter((path) => path &&
    !/^docs\/(?:specs|plans)\//.test(path) && lstatSync(`${directory}/${path}`).isFile());
  const violations = [];
  for (const path of files) {
    if (compatibility.has(path)) continue;
    let text = readFileSync(`${directory}/${path}`, 'utf8');
    if (path === 'AGENTS.md') text = text.replace(/^- Permit only local read-only Git checks[^\n]*\n {2}for legacy archify release\.$/m, '');
    if (path === 'bin/axstack.js') text = text.replace(/^.*--tools-dir is obsolete; archify provisioning has been retired.*$/m, '');
    if (path === 'tests/workflows/prose-size.test.js') text = text.replace(/^.*\/\/.*archify.*$/gim, '');
    if (path === 'skills/axstack-explain/SKILL.md') {
      text = text.replace('[archify](https://github.com/tt-a1i/archify)', 'retired idea credit');
    }
    if (/archify/i.test(text) || /archify/i.test(path)) violations.push(path);
  }
  return violations;
}

test('retired tool references stay within the enumerated compatibility surfaces', () => {
  expect(violationsIn(root)).toEqual([]);
});

test('retirement scan ignores untracked caches and still catches tracked references', () => {
  const fixture = makeTempRoot('anatomy-boundary-');
  const git = (...args) => {
    const child = Bun.spawnSync(['git', ...args], { cwd: fixture, stdout: 'pipe', stderr: 'pipe' });
    expect(child.exitCode).toBe(0);
  };
  git('init', '--quiet');
  writeFileSync(`${fixture}/tracked.md`, 'archify must be detected');
  git('add', '--', 'tracked.md');
  mkdirSync(`${fixture}/.bun/install/cache/@t@`, { recursive: true });
  writeFileSync(`${fixture}/.bun/install/cache/@t@/probe.pile`, 'archify cached bytes');
  expect(violationsIn(fixture)).toEqual(['tracked.md']);
});
