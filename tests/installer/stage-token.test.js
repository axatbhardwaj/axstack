// Proves the release path actually transmits the credential.
//
// v0.8.2 failed because the workflow wrote ~/.npmrc and bun never read it: it
// fell back to interactive web auth and hung until the step timed out, and
// that was only discovered at the irreversible step. The release now stages
// with npm, which does read .npmrc — this asserts that end to end against a
// loopback registry, in the ordinary suite, which the publish job runs before
// staging anything.
//
// It proves transmission and that the command stages rather than publishes.
// It cannot prove npmjs.com accepts the token for this package.
import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';

const ROOT = join(import.meta.dir, '../..');
const TOKEN = 'test-token-not-a-real-credential';
// Pinned to the version the workflow runs.
const NPM = 'npm@12.0.2';

test('the repository ships no .npmrc, so staging depends on the one the workflow writes', () => {
  // npm reads a project-level .npmrc in preference to HOME. If one were ever
  // committed here it would silently take over the release credential path.
  expect(existsSync(join(ROOT, '.npmrc')), 'a committed .npmrc would shadow $HOME/.npmrc').toBe(false);
});

test('npm stage publish sends the .npmrc token and stages rather than publishes', async () => {
  const seen = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      seen.push({
        method: request.method,
        path: url.pathname,
        authorization: request.headers.get('authorization'),
      });
      return Response.json({ ok: true, success: true }, { status: 201 });
    },
  });

  const sandbox = mkdtempSync(`${Bun.env.TMPDIR ?? '/tmp'}/axstack-stage-token-`);
  // The credential lives in HOME, never beside the package: the workflow
  // writes $HOME/.npmrc and runs npm from the repo, so that is the path worth
  // proving. A .npmrc next to package.json would be read even if HOME were
  // never consulted, and would prove nothing about production.
  const home = join(sandbox, 'home');
  const dir = join(sandbox, 'pkg');
  mkdirSync(home, { recursive: true });
  mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: 'axstack-stage-probe',
      version: '0.0.0',
    }));
    writeFileSync(join(dir, 'index.js'), '// probe\n');
    const host = server.url.href.replace(/^https?:\/\//, '');
    writeFileSync(join(home, '.npmrc'), `//${host}:_authToken=${TOKEN}\n`);

    // Async spawn: the registry runs in this process, so a blocking spawn
    // would deadlock waiting for a reply it cannot serve.
    const child = Bun.spawn(
      ['bunx', NPM, 'stage', 'publish', '.', '--registry', server.url.href],
      // HOME points at the sandbox so npm resolves ~/.npmrc implicitly, the
      // way the workflow relies on; --userconfig would not exercise that.
      { cwd: dir, env: { ...process.env, HOME: home }, stdout: 'pipe', stderr: 'pipe' },
    );
    const [stdout, stderr] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    await child.exited;
    const output = `${stdout}${stderr}`;

    const staged = seen.find((request) => request.path.includes('/-/stage/package/'));

    expect(staged, `nothing was staged; npm said: ${output.slice(-500)}`).toBeDefined();
    expect(staged.method, 'staging must POST to the stage endpoint').toBe('POST');
    expect(staged.authorization, 'the staging request carried no credential').toBe(`Bearer ${TOKEN}`);
    // Staging must not fall through to a direct publish, which would bypass
    // the approval this token type exists to require.
    expect(seen.some((request) => request.method === 'PUT'), 'must stage, not publish directly').toBe(false);
    expect(output).toMatch(/staged/i);
  } finally {
    server.stop(true);
    rmSync(sandbox, { recursive: true, force: true });
  }
}, 120000);
