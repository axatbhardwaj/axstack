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

// The token-bearing step is pinned verbatim. A blocklist cannot model shell
// semantics — `env`, `printenv | tee`, a here-doc, indirect expansion, or a
// later `cat ~/.npmrc` all read the credential without naming the variable —
// so the allowed body is whitelisted and any change must be deliberate.
const TOKEN_STEP_RUN = `set -eu
: "\${REGISTRY_TOKEN:?NPM_ACCESS_TOKEN is not set}"
umask 077
printf '//registry.npmjs.org/:_authToken=%s\\n' "\${REGISTRY_TOKEN}" > "\${HOME}/.npmrc"`;

test('publish workflow never exposes the registry token', () => {
  // The secret expression belongs in env:, never inside a shell command.
  for (const step of steps()) {
    expect(step.run ?? '', 'secret expression must not appear in a run body')
      .not.toMatch(/secrets\.NPM_ACCESS_TOKEN/);
  }
  const holders = steps().filter((step) =>
    Object.values(step.env ?? {}).some((value) => String(value).includes('secrets.NPM_ACCESS_TOKEN')));
  expect(holders.length, 'exactly one step may hold the token').toBe(1);
  expect(Object.keys(holders[0].env), 'the token step may hold only the token').toEqual(['REGISTRY_TOKEN']);
  expect(holders[0].run.trim(), 'the token step body is pinned; update this test deliberately')
    .toBe(TOKEN_STEP_RUN);
});

test('no other step can read the credential the token step wrote', () => {
  for (const step of steps()) {
    const body = step.run ?? '';
    if (body.trim() === TOKEN_STEP_RUN) continue;
    // `cat ~/.npmrc` in any later step leaks it just as well.
    expect(body, `step must not touch .npmrc: ${body.trim()}`).not.toMatch(/npmrc/);
    // Whole-environment dumps take the token without ever naming it.
    expect(body, `step must not dump the environment: ${body.trim()}`)
      .not.toMatch(/(?:^|[;&|(\s])(?:env|printenv|export\s*$|set)\b(?![^\n]*-[eu]+\b)/m);
    expect(body, 'shell tracing would print the token').not.toMatch(/set\s+-[a-z]*x|xtrace/);
    // No step may carry the token under another name.
    expect(Object.values(step.env ?? {}).join(' ')).not.toMatch(/NPM_ACCESS_TOKEN/);
  }
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
