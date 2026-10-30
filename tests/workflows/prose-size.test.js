import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { isVendored } from './vendored-paths.js';

const root = `${import.meta.dir}/../..`;
const skills = `${root}/skills`;

test('packaged guidance stays within the aggregate and always-loaded budgets', () => {
  const markdown = readdirSync(skills, { recursive: true }).filter((path) => path.endsWith('.md') && !isVendored(`skills/${path}`));
  const bytes = (path) => readFileSync(`${skills}/${path}`).byteLength;
  const total = markdown.reduce((sum, path) => sum + bytes(path), 0);
  const alwaysLoaded = ['contracts.md', 'lifecycle.md', 'routing.md']
    .reduce((sum, path) => sum + bytes(`axstack/references/${path}`), 0);

  // Ceilings: 600,000 aggregate bytes; 40,000 always-loaded bytes.
  // The PR that would cross a ceiling raises it by a round step (+100,000
  // aggregate, +5,000 always-loaded), with a one-line reason in the PR body
  // and commit message. Contract text is never trimmed to fit.
  // Advised holds adds shared seat, card, wait and authority rules (+5,000 always-loaded).
  // Parked holds adds ordered disable, recovery and answer rules (+5,000 always-loaded).
  // C3a adds native fleet dispatch/receipt and bounded live verification contracts (+100,000 aggregate).
  expect(total).toBeLessThanOrEqual(600000);
  expect(alwaysLoaded).toBeLessThanOrEqual(40000);
});
