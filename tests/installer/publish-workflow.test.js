// Contract for the release publish workflow.
//
// This job performs an irreversible public action while holding a live
// registry credential, and every weaker guard was bypassable: string searches
// accepted an extra trigger and an echoed token; inspecting only `run` and
// `env` accepted `continue-on-error` on the guards and a pinned
// upload-artifact step that uploads ~/.npmrc. Shell and workflow semantics
// cannot be blocklisted, so the whole job is pinned and any change to it has
// to be a deliberate edit here.
import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';

const ROOT = join(import.meta.dir, '../..');
const PATH_ = '.github/workflows/publish.yml';
const source = () => readFileSync(join(ROOT, PATH_), 'utf8');
// YAML 1.1 reads a bare `on` key as the boolean true; 1.2 keeps the string.
const parsed = () => {
  const doc = Bun.YAML.parse(source());
  return { ...doc, on: doc.on ?? doc[true] };
};

const CHECKOUT = 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262';
const SETUP_BUN = 'oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6';

const TAG_GUARD = `set -eu
tag="\${GITHUB_REF_NAME#v}"
version="$(bun --print 'require("./package.json").version')"
if [ "$tag" != "$version" ]; then
  echo "tag \${GITHUB_REF_NAME} does not match package.json version \${version}" >&2
  exit 1
fi
`;

// Proves the credential before the irreversible step. bun publish falls back
// to interactive web auth when the token is missing or invalid, which in CI
// prints a login URL and hangs until the job times out.
const AUTH_CHECK = `set -eu
: "\${NPM_CONFIG_TOKEN:?NPM_ACCESS_TOKEN is not set}"
curl -sfS -H "Authorization: Bearer \${NPM_CONFIG_TOKEN}" \\
  https://registry.npmjs.org/-/whoami > /dev/null
`;

// The complete job. Anything absent here — continue-on-error, an extra step,
// an artifact upload, a `with:` input, another env var — is a difference.
const TOKEN_ENV = { NPM_CONFIG_TOKEN: '${{ secrets.NPM_ACCESS_TOKEN }}' };

// The complete job. Anything absent here — continue-on-error, an extra step,
// an artifact upload, a `with:` input, another env var — is a difference.
const EXPECTED_STEPS = [
  { uses: CHECKOUT },
  { uses: SETUP_BUN, with: { 'bun-version': '1.4.2' } },
  { run: 'bun test' },
  { name: 'Tag must match the manifest version', run: TAG_GUARD },
  { name: 'Registry credential must work', env: TOKEN_ENV, run: AUTH_CHECK },
  { name: 'Publish', env: TOKEN_ENV, run: 'bun publish --access public' },
];

test('publish workflow fires only on a version tag', () => {
  expect(existsSync(join(ROOT, PATH_)), `missing ${PATH_}`).toBe(true);
  const on = parsed().on;
  // A second trigger would be a weaker path to the same irreversible action.
  expect(Object.keys(on)).toEqual(['push']);
  expect(Object.keys(on.push)).toEqual(['tags']);
  expect(on.push.tags).toEqual(['v*']);
});

test('publish workflow job is pinned in full', () => {
  const doc = parsed();
  expect(Object.keys(doc).filter((key) => key !== 'on').sort()).toEqual(['jobs', 'name', 'permissions']);
  expect(doc.permissions).toEqual({ contents: 'read' });
  expect(Object.keys(doc.jobs)).toEqual(['publish']);

  const job = doc.jobs.publish;
  expect(Object.keys(job).sort(), 'the job may declare only runs-on, timeout-minutes and steps')
    .toEqual(['runs-on', 'steps', 'timeout-minutes']);
  expect(job['runs-on']).toBe('ubuntu-latest');
  // An interactive auth fallback hangs; bound it rather than idling.
  expect(job['timeout-minutes']).toBe(10);
  // Deep equality closes the whole class: no added step, no continue-on-error,
  // no artifact upload of the credential, no extra `with:` input.
  expect(job.steps, 'the publish job is pinned; update this test deliberately').toEqual(EXPECTED_STEPS);
});

test('publish workflow runs the whole suite before it publishes, and refuses a mismatched tag', () => {
  const runs = EXPECTED_STEPS.map((step) => step.run ?? '');
  const test_ = runs.findIndex((run) => /\bbun test\b/.test(run));
  const publish = runs.findIndex((run) => /\bbun publish\b/.test(run));
  expect(publish, 'publish must not precede the tests').toBeGreaterThan(test_);
  expect(runs.some((run) => /npm publish/.test(run)), 'must publish with bun').toBe(false);
  expect(TAG_GUARD, 'a mismatched tag must fail the job').toMatch(/exit 1/);
});

test('the registry secret appears exactly once in the whole document', () => {
  const occurrences = source().match(/secrets\.NPM_ACCESS_TOKEN/g) ?? [];
  // Twice: the credential check and the publish, both pinned above.
  expect(occurrences.length, 'the secret must appear only in the two pinned env blocks').toBe(2);
  // And that one reference is the pinned env entry above, not a workflow- or
  // job-level env that every step would inherit.
  const doc = parsed();
  expect(doc.env, 'no workflow-level env').toBeUndefined();
  expect(doc.jobs.publish.env, 'no job-level env').toBeUndefined();
});

test('every action in the publishing job is pinned to a full commit SHA', () => {
  for (const step of parsed().jobs.publish.steps) {
    if (!step.uses) continue;
    expect(step.uses, `${step.uses} must be pinned to a 40-character SHA`).toMatch(/@[0-9a-f]{40}$/);
  }
});
