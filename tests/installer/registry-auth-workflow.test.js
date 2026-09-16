// A manually runnable credential check. Its whole purpose is to prove the
// registry token authenticates WITHOUT performing the irreversible publish,
// so the contract worth enforcing is that it can never publish or mutate.
//
// Pinned in full rather than blocklisted: a blocklist on step bodies accepted
// an added publishing action or a second job, which is the same mistake the
// publish workflow's guards went through.
import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';

const ROOT = join(import.meta.dir, '../..');
const PATH_ = '.github/workflows/registry-auth-check.yml';
const source = () => readFileSync(join(ROOT, PATH_), 'utf8');
const parsed = () => {
  const doc = Bun.YAML.parse(source());
  return { ...doc, on: doc.on ?? doc[true] };
};

const WHOAMI = `set -eu
: "\${NPM_CONFIG_TOKEN:?NPM_ACCESS_TOKEN is not set}"
body="$(curl -sfS -H "Authorization: Bearer \${NPM_CONFIG_TOKEN}" \\
  https://registry.npmjs.org/-/whoami)"
who="$(printf '%s' "$body" | sed -n 's/.*"username"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p')"
if [ -z "$who" ]; then
  echo "authenticated, but no username in the response (\${#body} bytes)" >&2
  exit 1
fi
echo "token authenticates as: \${who}"
`;

const EXPECTED_STEPS = [
  {
    name: 'Who does the token authenticate as',
    env: { NPM_CONFIG_TOKEN: '${{ secrets.NPM_ACCESS_TOKEN }}' },
    run: WHOAMI,
  },
];

test('credential check is manual only', () => {
  expect(existsSync(join(ROOT, PATH_)), `missing ${PATH_}`).toBe(true);
  expect(Object.keys(parsed().on)).toEqual(['workflow_dispatch']);
});

test('credential check is pinned in full, so it can never publish', () => {
  const doc = parsed();
  expect(Object.keys(doc).filter((key) => key !== 'on').sort()).toEqual(['jobs', 'name', 'permissions']);
  expect(doc.permissions).toEqual({ contents: 'read' });
  expect(doc.env, 'no workflow-level env').toBeUndefined();
  // One job only: a second job could publish while this one only reads.
  expect(Object.keys(doc.jobs)).toEqual(['registry-auth-check']);

  const job = doc.jobs['registry-auth-check'];
  expect(Object.keys(job).sort()).toEqual(['runs-on', 'steps', 'timeout-minutes']);
  expect(job['runs-on']).toBe('ubuntu-latest');
  expect(job['timeout-minutes']).toBe(5);
  // Deep equality closes the class: no added step, action, or publish command.
  expect(job.steps, 'this workflow is pinned; update this test deliberately').toEqual(EXPECTED_STEPS);
});

test('credential check never publishes and never prints the token', () => {
  expect(WHOAMI, 'this workflow must never publish').not.toMatch(/\bpublish\b/);
  // The secret expression appears once, in the pinned env above.
  expect((source().match(/secrets\.NPM_ACCESS_TOKEN/g) ?? []).length).toBe(1);
  expect(WHOAMI, 'shell tracing would print the token').not.toMatch(/set\s+-[a-z]*x|xtrace/);
  // The token is only ever an Authorization header; what is echoed is the
  // username the registry reports back.
  expect(WHOAMI).toMatch(/Authorization: Bearer/);
  expect(WHOAMI).toMatch(/echo "token authenticates as/);
  // A 2xx with an unparsed body must fail, not report a blank success.
  expect(WHOAMI, 'an empty username must fail the job').toMatch(/if \[ -z "\$who" \]/);
  expect(WHOAMI).toMatch(/exit 1/);
  // The diagnostic reports the body's size, never its contents.
  expect(WHOAMI, 'the response body must not be echoed').not.toMatch(/echo[^\n]*\$body|printf[^\n]*"\$body"[^|]*$/m);
});
