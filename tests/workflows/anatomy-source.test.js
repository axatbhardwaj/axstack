import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { isVendored, VENDORED_PATHS } from './vendored-paths.js';

const root = `${import.meta.dir}/../..`;
const directory = 'skills/axstack-anatomy';
const manifestPath = `${root}/${directory}/SOURCE-PROOF.json`;

test('vendored source proof binds the complete payload to upstream Git blobs', () => {
  // Absence is an observable missing provenance contract, not a module-load failure.
  expect(existsSync(manifestPath)).toBe(true);
  if (!existsSync(manifestPath)) return;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  expect(manifest.upstream).toEqual({ repo: 'https://github.com/wheresryan22/anatomy',
    sha: '689dcf966e63d92be10a5d593c6e19e10acd4422', license: 'MIT' });
  const owned = new Set(['SKILL.md', 'PROVENANCE.md', 'SOURCE-PROOF.json', 'theme.js']);
  const disk = [...new Bun.Glob('**/*').scanSync({ cwd: `${root}/${directory}`, onlyFiles: true, dot: true })]
    .filter((path) => !owned.has(path)).sort();
  expect(disk.every((path) => isVendored(`${directory}/${path}`))).toBe(true);
  expect(disk).toEqual(Object.keys(manifest.files).sort());
  expect(disk.some((path) => /examples\/.*\.html$|SKILL\.md$|\.git|\.github|agents\/|evals\/|tests\/fixtures/.test(path))).toBe(false);
  const modified = [];
  for (const [path, record] of Object.entries(manifest.files)) {
    const bytes = readFileSync(`${root}/${directory}/${path}`);
    expect(new Bun.CryptoHasher('sha256').update(bytes).digest('hex'), path).toBe(record.sha256);
    if (record.modified) modified.push(path);
    else expect(new Bun.CryptoHasher('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), path)
      .toBe(record.gitBlob);
  }
  expect(modified.sort()).toEqual(['README.md', 'scripts/capture.mjs', 'scripts/drive.mjs']);
  expect(manifest.files['ANATOMY.md'].modified).toBe(false);
  expect(manifest.files.LICENSE.modified).toBe(false);
  expect(readFileSync(`${root}/${directory}/PROVENANCE.md`, 'utf8')).toContain(manifest.upstream.sha);
});

test('both repository configs exclude precisely the shared vendored paths', () => {
  const bun = Bun.TOML.parse(readFileSync(`${root}/bunfig.toml`, 'utf8'));
  const biome = JSON.parse(readFileSync(`${root}/biome.json`, 'utf8'));
  expect(bun.test.pathIgnorePatterns).toEqual(VENDORED_PATHS);
  expect(biome.linter.includes).toEqual(['**/*.js', ...VENDORED_PATHS.map((path) => `!${path}`)]);
  expect(bun.test).not.toHaveProperty('timeout');
});

test('approved execution baseline is byte-identical to issue 437 r10', () => {
  const bytes = readFileSync(`${root}/docs/specs/explain-anatomy.md`);
  expect(new Bun.CryptoHasher('sha256').update(bytes).digest('hex')).toBe('057bccbcef79930bb95363ac3511983771fe40f2202fd686a6253830f44f2e82');
});
