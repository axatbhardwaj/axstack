import { expect, test } from 'bun:test';
import { chmodSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { archifyFixture, git } from './archify-fixture.js';

function checkFixture() {
  const f = archifyFixture();
  const bin = join(f.root, 'bin');
  mkdirSync(bin);
  symlinkSync(Bun.which('git'), join(bin, 'git'));
  for (const [name, version] of [['gh', 'gh fixture'], ['t3', '0.0.46-nightly.20261003.2610']]) {
    writeFileSync(join(bin, name), `#!/bin/sh\necho '${version}'\n`);
    chmodSync(join(bin, name), 0o755);
  }
  const check = (env = {}, expectFail = false) => f.run(['check', '--skills-dir', f.skills], {
    env: { PATH: bin, ARCHIFY_CHROME: join(f.root, 'missing-chrome'), ...env }, expectFail,
  });
  return { ...f, bin, check };
}

test('check fails for a missing record, missing copy, or mismatched checkout', () => {
  const f = checkFixture();
  expect(f.check({}, true).out).toMatch(/archify.*missing/i);
  f.install();
  const original = readFileSync(f.record, 'utf8');
  writeFileSync(f.record, JSON.stringify({ path: join(f.root, 'missing'), sha: f.sha }));
  expect(f.check({}, true).out).toMatch(/archify.*missing/i);
  writeFileSync(f.record, original);
  git(f.copy, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'changed');
  const result = f.check({}, true);
  expect(result.out).toMatch(/archify.*mismatch/i);
  expect(result.out).toContain(f.sha);
  expect(result.out).toContain(git(f.copy, 'rev-parse', 'HEAD'));
});

test('Chrome absence warns without a gap; override wins over PATH detection', () => {
  const f = checkFixture();
  f.install();
  const missing = f.check();
  expect(missing.out).toMatch(/WARN.*Chrome/);
  expect(missing.out).toContain(f.copy);
  expect(missing.out).toContain(f.sha);
  const chrome = join(f.bin, 'chromium');
  writeFileSync(chrome, '#!/bin/sh\nexit 0\n');
  chmodSync(chrome, 0o755);
  expect(f.check().out).toMatch(/WARN.*Chrome/);
  expect(f.check({ ARCHIFY_CHROME: '' }).out).toContain(`Chrome: ${chrome}`);
  expect(f.check({ ARCHIFY_CHROME: chrome }).out).toContain(`Chrome: ${chrome}`);
});
