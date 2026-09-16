// Concurrent-edit regressions: a destructive rm must decide from a fresh
// pre-delete read through the ownership guard, never from the phase-1
// planning snapshot. Each test edits its victim synchronously inside the
// first rm call of the run, so the edit deterministically lands after
// planning but before the victim's own delete decision.
import { expect, mock, test } from 'bun:test';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';

const actualFs = await import('node:fs/promises');

let onFirstRm = null;
mock.module('node:fs/promises', () => ({
  ...actualFs,
  // Passthrough runs through sync node:fs on purpose: the module namespace
  // object above holds live bindings, so calling actualFs.rm here would
  // recurse into this mock.
  rm: async (path, options) => {
    if (onFirstRm) {
      const hook = onFirstRm;
      onFirstRm = null;
      hook();
    }
    rmSync(path, options);
  },
}));

const { installBundle, uninstallBundle } = await import('../../src/installer.js');
const { join } = await import('../../src/posixpath.js');
const { makeTempRoot, writeFixtureBundle } = await import('./helpers.js');

const manifestFiles = (skillsDir) => JSON.parse(
  readFileSync(join(skillsDir, '.axstack-manifest.json'), 'utf8'),
).files;

test('stale file edited after planning is preserved (fresh pre-delete read)', async () => {
  const root = makeTempRoot('axstack-stale-midedit-');
  const bundle = writeFixtureBundle(root, {
    supportFiles: { 'old-a.md': '# Old A\n', 'old-b.md': '# Old B\n' },
  });
  const skillsDir = join(root, 'skills');
  await installBundle({ bundleDir: bundle, skillsDir, preset: 'mixed' });

  rmSync(join(bundle, 'skills', 'axstack-demo', 'old-a.md'));
  rmSync(join(bundle, 'skills', 'axstack-demo', 'old-b.md'));
  const victimRel = 'axstack-demo/old-b.md';
  const victimDest = join(skillsDir, ...victimRel.split('/'));
  const edited = '# User edit mid-install\n\nHands off.\n';

  // First rm of the run deletes old-a.md; the hook edits old-b.md first, so
  // the edit lands after the planning snapshot but before old-b's decision.
  onFirstRm = () => writeFileSync(victimDest, edited);
  try {
    const summary = await installBundle({ bundleDir: bundle, skillsDir, preset: 'mixed' });
    expect(readFileSync(victimDest, 'utf8')).toBe(edited);
    expect(summary.removed).not.toContain(victimRel);
    expect(summary.stale).toContain(victimRel);
    expect(victimRel in manifestFiles(skillsDir)).toBe(true);
  } finally {
    onFirstRm = null;
  }
});

test('owned file edited after uninstall begins is preserved (fresh pre-delete read)', async () => {
  const root = makeTempRoot('axstack-uninstall-midedit-');
  const bundle = writeFixtureBundle(root, {
    supportFiles: { 'helper.md': '# Helper\n' },
  });
  const skillsDir = join(root, 'skills');
  await installBundle({ bundleDir: bundle, skillsDir, preset: 'mixed' });

  // Manifest order is bundle-sorted, so axstack/roles.json deletes last: the
  // hook edits it inside the run's first rm, after planning but before its
  // own delete decision.
  const victimRel = 'axstack/roles.json';
  const victimDest = join(skillsDir, ...victimRel.split('/'));
  const edited = '# User edit mid-uninstall\n';

  onFirstRm = () => writeFileSync(victimDest, edited);
  try {
    const summary = await uninstallBundle({ skillsDir });
    expect(readFileSync(victimDest, 'utf8')).toBe(edited);
    expect(summary.preserved).toContain(victimRel);
    expect(victimRel in manifestFiles(skillsDir)).toBe(true);
  } finally {
    onFirstRm = null;
  }
});
