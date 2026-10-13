import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
// Enumerated compatibility surfaces; no active provisioner or viewer route.
const compatibility = new Set([
  'src/archify-legacy.js', 'src/manifest.js', 'src/installer.js',
  'tests/installer/archify-fixture.js', 'tests/installer/archify-retirement.test.js',
  'tests/installer/legacy-archify.test.js', 'tests/workflows/anatomy-boundary.test.js',
  'tests/workflows/legacy-tool-boundary.test.js',
]);

test('retired tool references stay within the enumerated compatibility surfaces', () => {
  const files = [...new Bun.Glob('**/*').scanSync({ cwd: root, onlyFiles: true, dot: true })]
    .filter((path) => !/^(?:\.git(?:\/|$)|node_modules\/|docs\/(?:specs|plans)\/)/.test(path));
  const violations = [];
  for (const path of files) {
    if (compatibility.has(path)) continue;
    let text = readFileSync(`${root}/${path}`, 'utf8');
    if (path === 'AGENTS.md') text = text.replace(/^- Permit only local read-only Git checks[^\n]*\n {2}for legacy archify release\.$/m, '');
    if (path === 'bin/axstack.js') text = text.replace(/^.*--tools-dir is obsolete; archify provisioning has been retired.*$/m, '');
    if (path === 'tests/workflows/prose-size.test.js') text = text.replace(/^.*\/\/.*archify.*$/gim, '');
    if (path === 'skills/axstack-explain/SKILL.md') {
      text = text.replace('[archify](https://github.com/tt-a1i/archify)', 'retired idea credit');
    }
    if (/archify/i.test(text) || /archify/i.test(path)) violations.push(path);
  }
  expect(violations).toEqual([]);
});
