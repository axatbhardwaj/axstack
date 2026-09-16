// Contract for the release publish workflow. A publish is irreversible and the
// job handles a live registry token, so these parse the workflow and assert its
// guards structurally — string searching accepted an extra trigger, a publish
// before the tests, and an echoed token.
import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';

const ROOT = join(import.meta.dir, '../..');
const PATH_ = '.github/workflows/publish.yml';
const source = () => readFileSync(join(ROOT, PATH_), 'utf8');
// YAML 1.1 reads a bare `on` key as the boolean true.
const parsed = () => {
  const doc = Bun.YAML.parse(source());
  return { ...doc, on: doc.on ?? doc[true] };
};
const steps = () => parsed().jobs.publish.steps;
const runs = () => steps().map((step) => step.run ?? '').filter(Boolean);

test('publish workflow fires only on a version tag', () => {
  expect(existsSync(join(ROOT, PATH_)), `missing ${PATH_}`).toBe(true);
  const on = parsed().on;
  // Exactly one trigger: an added workflow_dispatch or pull_request would be a
  // second, weaker path to the same irreversible action.
  expect(Object.keys(on)).toEqual(['push']);
  expect(Object.keys(on.push)).toEqual(['tags']);
  expect(on.push.tags).toEqual(['v*']);
});

test('publish workflow refuses a tag that disagrees with the manifest', () => {
  const guard = runs().find((run) => run.includes('package.json'));
  expect(guard, 'no step reads package.json to check the tag').toBeDefined();
  // A real comparison of the two values that can fail the job, not a print.
  expect(guard).toMatch(/GITHUB_REF_NAME/);
  expect(guard).toMatch(/\$\{?tag\}?"?\s*!=\s*"?\$\{?version\}?|\$\{?version\}?"?\s*!=\s*"?\$\{?tag\}?/);
  expect(guard, 'mismatch must exit non-zero').toMatch(/exit 1/);
});

test('publish workflow runs the whole suite before it publishes', () => {
  const order = runs();
  const test_ = order.findIndex((run) => /\bbun test\b/.test(run));
  const publish = order.findIndex((run) => /\bbun publish\b/.test(run));
  expect(test_, 'no bun test step').toBeGreaterThanOrEqual(0);
  expect(publish, 'no bun publish step').toBeGreaterThanOrEqual(0);
  expect(publish, 'publish must not precede the tests').toBeGreaterThan(test_);
  expect(order.some((run) => /npm publish/.test(run))).toBe(false);
  expect(order.some((run) => /--access public/.test(run))).toBe(true);
});

test('publish workflow never exposes the registry token', () => {
  // The secret expression belongs in env:, never inside a shell command.
  for (const step of steps()) {
    expect(step.run ?? '', 'secret expression must not appear in a run body')
      .not.toMatch(/secrets\.NPM_ACCESS_TOKEN/);
  }
  const holders = steps().filter((step) =>
    Object.values(step.env ?? {}).some((value) => String(value).includes('secrets.NPM_ACCESS_TOKEN')));
  expect(holders.length, 'exactly one step may hold the token').toBe(1);

  const [name] = Object.entries(holders[0].env)
    .find(([, value]) => String(value).includes('secrets.NPM_ACCESS_TOKEN'));
  const body = holders[0].run ?? '';
  const uses = body.split('\n').filter((line) => new RegExp(`\\$\\{?${name}\\b`).test(line));
  expect(uses.length, 'token is never used').toBeGreaterThan(0);

  // Exactly one line may write the token, and it must go into .npmrc.
  const npmrc = /(?:^|\s)>\s*"?(?:\$\{?HOME\}?|~)\/?\.npmrc/;
  const writes = uses.filter((line) => npmrc.test(line));
  expect(writes.length, 'exactly one line may write the token, into .npmrc').toBe(1);

  // Any other use must not be able to emit the value: a bare `${VAR:?msg}`
  // existence check prints the name, never the contents.
  for (const line of uses) {
    if (npmrc.test(line)) continue;
    expect(line, `token use may leak: ${line.trim()}`).toMatch(/^\s*:\s*"\$\{\w+:[?+-]/);
  }
  expect(body, 'shell tracing would print the token').not.toMatch(/set\s+-[a-z]*x/);
  expect(source()).not.toMatch(/npm_[A-Za-z0-9]{20,}/);
});

test('every action in the publishing job is pinned to a full commit SHA', () => {
  // A moving tag in the job that holds the token can be repointed at code that
  // reads ~/.npmrc.
  for (const step of steps()) {
    if (!step.uses) continue;
    expect(step.uses, `${step.uses} must be pinned to a 40-character SHA`)
      .toMatch(/@[0-9a-f]{40}$/);
  }
});
