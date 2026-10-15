import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { isVendored, VENDORED_PATHS } from './vendored-paths.js';

const root = `${import.meta.dir}/../..`;
const directory = 'skills/axstack-explain/references/frontend-design';
const upstream = '41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f';
const blobs = {
  'FRONTEND-DESIGN.md': 'a5333457c414d20d625f307df945842c0952ecc3',
  'LICENSE.txt': 'f433b1a53f5b830a205fd2df78e2b34974656c7b',
};

test('frontend-design reference preserves the reviewed upstream bytes and licence', () => {
  for (const [name, blob] of Object.entries(blobs)) {
    const path = `${root}/${directory}/${name}`;
    expect(existsSync(path), `packaged upstream ${name}`).toBe(true);
    const bytes = readFileSync(path);
    expect(new Bun.CryptoHasher('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), name)
      .toBe(blob);
  }
});

test('frontend-design provenance stays owned and the payload stays reference-only', () => {
  const path = `${root}/${directory}/PROVENANCE.md`;
  expect(existsSync(path)).toBe(true);
  const provenance = readFileSync(path, 'utf8');
  for (const fact of ['anthropics/skills', upstream, 'skills/frontend-design/SKILL.md',
    blobs['FRONTEND-DESIGN.md'], blobs['LICENSE.txt'], 'renamed, bytes unchanged', 'Apache-2.0', 'not registered as a skill']) {
    expect(provenance).toContain(fact);
  }
  expect(existsSync(`${root}/${directory}/SKILL.md`)).toBe(false);
  expect(isVendored(`${directory}/PROVENANCE.md`)).toBe(false);
});

test('only the two frontend-design upstream files are excluded in all path lists', () => {
  expect(VENDORED_PATHS.filter((path) => path.startsWith(`${directory}/`)))
    .toEqual(Object.keys(blobs).map((name) => `${directory}/${name}`));
  const bun = Bun.TOML.parse(readFileSync(`${root}/bunfig.toml`, 'utf8'));
  const biome = JSON.parse(readFileSync(`${root}/biome.json`, 'utf8'));
  expect(bun.test.pathIgnorePatterns).toEqual(VENDORED_PATHS);
  expect(biome.linter.includes).toEqual(['**/*.js', ...VENDORED_PATHS.map((path) => `!${path}`)]);
});
