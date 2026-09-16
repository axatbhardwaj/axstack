// Contract for the release publish workflow. A publish is irreversible and
// runs with a registry token, so these assert the guards rather than the
// happy path: the tag must match the manifest, the token is only ever read
// from secrets, and the workflow cannot fire on an ordinary push.
import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';

const ROOT = join(import.meta.dir, '../..');
const PATH_ = '.github/workflows/publish.yml';
const workflow = () => readFileSync(join(ROOT, PATH_), 'utf8');

test('publish workflow exists and fires only on a version tag', () => {
  expect(existsSync(join(ROOT, PATH_)), `missing ${PATH_}`).toBe(true);
  const text = workflow();
  expect(text, 'must trigger on tags').toMatch(/tags:/);
  expect(text).toMatch(/['"]v\*['"]/);
  // An ordinary branch push must never reach a publish.
  expect(text, 'must not trigger on branches').not.toMatch(/^\s*branches:/m);
  expect(text, 'must not trigger on pull_request').not.toMatch(/^\s*pull_request:/m);
});

test('publish workflow refuses a tag that disagrees with the manifest', () => {
  const text = workflow();
  expect(text).toMatch(/package\.json/);
  // The comparison must be able to fail the job, not just print.
  expect(text, 'version mismatch must exit non-zero').toMatch(/exit 1/);
});

test('publish workflow reads the registry token only from secrets', () => {
  const text = workflow();
  expect(text).toMatch(/secrets\.NPM_ACCESS_TOKEN/);
  // No literal token, and the secret is never echoed into the log.
  expect(text).not.toMatch(/npm_[A-Za-z0-9]{20,}/);
  for (const line of text.split('\n')) {
    if (/\becho\b|\bprintf\b/.test(line)) {
      expect(line, `token must not be echoed: ${line.trim()}`).not.toMatch(/secrets\.NPM_ACCESS_TOKEN/);
    }
  }
});

test('publish workflow runs the suite and publishes with bun', () => {
  const text = workflow();
  expect(text).toMatch(/bun test/);
  expect(text, 'must publish with bun, not npm').toMatch(/bun publish/);
  expect(text).not.toMatch(/npm publish/);
  expect(text, 'unscoped package still needs explicit public access').toMatch(/--access public/);
});
