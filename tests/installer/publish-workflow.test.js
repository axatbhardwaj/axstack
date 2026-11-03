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

// Dependabot may advance the SHA; action identities and full-length pins stay fixed.
const CHECKOUT = expect.stringMatching(/^actions\/checkout@[0-9a-f]{40}$/);
const SETUP_BUN = expect.stringMatching(/^oven-sh\/setup-bun@[0-9a-f]{40}$/);

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
// Keep the existing-package prerequisite before the irreversible publish.
const EXISTS_CHECK = `set -eu
# Distinguish the three outcomes: unreachable registry, no such package, and a
# tombstone — an unpublished name whose packument still resolves but carries no
# versions. A status-only probe cannot tell them apart.
status=0
response="$(curl -sS -w '\\n%{http_code}' https://registry.npmjs.org/axstack)" || status=$?
if [ "$status" -ne 0 ]; then
  echo "could not reach the registry (curl exit $status); not treating this as a missing package" >&2
  exit 1
fi
code="$(printf '%s' "$response" | tail -n 1)"
body="$(printf '%s' "$response" | sed '$d')"
case "$code" in
  200) ;;
  404) code=missing ;;
  *) echo "registry returned HTTP $code for axstack" >&2; exit 1 ;;
esac
if [ "$code" = 200 ]; then
  published="$(printf '%s' "$body" | jq -r '(.versions // {}) | length')"
  [ "$published" -gt 0 ] || code=missing
fi
if [ "$code" = missing ]; then
  echo "axstack has no published versions on the registry." >&2
  echo "Release publishing requires an existing package; investigate before retrying." >&2
  exit 1
fi
`;

const AUTH_CHECK = `set -eu
: "\${REGISTRY_TOKEN:?NPM_ACCESS_TOKEN is not set}"
curl -sfS -H "Authorization: Bearer \${REGISTRY_TOKEN}" \\
  https://registry.npmjs.org/-/whoami > /dev/null
umask 077
printf '//registry.npmjs.org/:_authToken=%s\\n' "\${REGISTRY_TOKEN}" > "\${HOME}/.npmrc"
`;

// npm reads the direct-publish credential from .npmrc, not NPM_CONFIG_TOKEN.
const NPM = 'npm@12.0.2';
// Fetched before the credential exists on disk, so the download cannot read
// it. The exact version is pinned; bunx resolves it once and caches it.
const PREFETCH = `bunx ${NPM} --version`;
// --no-install: serve from the cache the prefetch filled. Without it bunx can
// reinstall at this point, which is after the credential is on disk.
const PUBLISH = `bunx --no-install ${NPM} publish . --access public`;

// The complete job. Anything absent here — continue-on-error, an extra step,
// an artifact upload, a `with:` input, another env var — is a difference.
const TOKEN_ENV = { REGISTRY_TOKEN: '${{ secrets.NPM_ACCESS_TOKEN }}' };

// The complete job. Anything absent here — continue-on-error, an extra step,
// an artifact upload, a `with:` input, another env var — is a difference.
const EXPECTED_STEPS = [
  { uses: CHECKOUT },
  { uses: SETUP_BUN, with: { 'bun-version': '1.4.2' } },
  { name: 'Fetch npm before the credential exists', run: PREFETCH },
  { run: 'bun test' },
  { name: 'Tag must match the manifest version', run: TAG_GUARD },
  { name: 'Package must already exist', run: EXISTS_CHECK },
  { name: 'Registry credential must work', env: TOKEN_ENV, run: AUTH_CHECK },
  { name: 'Publish release', run: PUBLISH },
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
  const runs = parsed().jobs.publish.steps.map((step) => step.run ?? '');
  const test_ = runs.findIndex((run) => /\bbun test\b/.test(run));
  const publish = runs.findIndex((run) => /npm@12\.0\.2 publish/.test(run));
  expect(publish, 'publish must not precede the tests').toBeGreaterThan(test_);
  expect(runs.some((run) => /\bstage\s+publish\b/.test(run)), 'releases must publish directly').toBe(false);
  expect(runs.some((run) => /npm@12\.0\.2 publish/.test(run))).toBe(true);
  // npm must be on disk before the token is, so a compromised or substituted
  // download has nothing to read.
  const prefetch = runs.findIndex((run) => /--version/.test(run));
  const credential = runs.findIndex((run) => /_authToken/.test(run));
  expect(prefetch, 'npm must be fetched before the credential is written').toBeLessThan(credential);
  expect(prefetch, 'the suite must run the cached-npm transport probe').toBeLessThan(test_);
  // Both npm invocations must name the same pinned version.
  const pinned = runs.filter((run) => /bunx (?:--no-install )?npm@/.test(run));
  expect(pinned.length).toBe(2);
  for (const run of pinned) expect(run).toContain(NPM);
  // The invocation that runs after the credential exists must not reinstall.
  const publishRun = runs.find((run) => /npm@12\.0\.2 publish/.test(run));
  expect(publishRun, 'the publish invocation must be cache-only').toContain('--no-install');
  expect(PREFETCH, 'the prefetch is what fills that cache').not.toContain('--no-install');
  // The bootstrap prerequisite must fail loudly and before publishing.
  const exists = runs.findIndex((run) => /has no published versions/.test(run));
  expect(exists, 'no step checks the package exists').toBeGreaterThanOrEqual(0);
  expect(exists).toBeLessThan(runs.findIndex((run) => /npm@12\.0\.2 publish/.test(run)));
  expect(TAG_GUARD, 'a mismatched tag must fail the job').toMatch(/exit 1/);
});

test('the registry secret appears exactly once in the whole document', () => {
  const occurrences = source().match(/secrets\.NPM_ACCESS_TOKEN/g) ?? [];
  // Once: the credential step holds it and writes .npmrc for the publish step.
  expect(occurrences.length, 'the secret must appear only in the pinned env block').toBe(1);
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

test('CI prefetches the pinned npm before tests on both supported Bun versions', () => {
  const job = Bun.YAML.parse(readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8')).jobs.test;
  expect(job.strategy.matrix.bun).toEqual(['1.3.14', '1.4.2']);
  const prefetch = job.steps.findIndex((step) => step.run === PREFETCH);
  const suite = job.steps.findIndex((step) => step.run === 'bun test');
  expect(prefetch, 'CI must cache npm for the transport keeper').toBeGreaterThanOrEqual(0);
  expect(suite).toBeGreaterThan(prefetch);
  expect(job.steps[prefetch]).toEqual({ run: PREFETCH });
});
