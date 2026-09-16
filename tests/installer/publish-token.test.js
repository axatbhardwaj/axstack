// Proves that `bun publish` on THIS bun, on this machine, actually sends the
// NPM_CONFIG_TOKEN credential — the mechanism the release workflow depends on.
//
// The v0.8.2 release failed because the workflow wrote ~/.npmrc and bun never
// read it: it fell back to interactive web auth and hung until the step timed
// out. That was only discovered at the irreversible step. This runs in the
// ordinary suite, which the publish job runs before publishing, so the same
// class of failure now surfaces before anything is published.
//
// It proves the credential is transmitted. It cannot prove npmjs.com accepts
// that token for this package; only a real publish does that.
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';

const TOKEN = 'test-token-not-a-real-credential';

test('bun publish sends NPM_CONFIG_TOKEN to the registry', async () => {
  const seen = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      seen.push({
        method: request.method,
        path: new URL(request.url).pathname,
        authorization: request.headers.get('authorization'),
      });
      // Enough of a registry for publish to consider itself done.
      return Response.json({ ok: true, success: true }, { status: 201 });
    },
  });

  const dir = mkdtempSync(`${Bun.env.TMPDIR ?? '/tmp'}/axstack-publish-token-`);
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: 'axstack-token-probe',
      version: '0.0.0',
      // Keep the probe package from ever reaching a real registry by accident.
      publishConfig: { registry: server.url.href },
    }));
    writeFileSync(join(dir, 'index.js'), '// probe\n');

    // Async spawn, not spawnSync: the registry above runs in this process, so
    // a blocking spawn would deadlock waiting for a reply it cannot serve.
    const child = Bun.spawn(
      [process.execPath, 'publish', '--registry', server.url.href],
      {
        cwd: dir,
        env: { ...process.env, NPM_CONFIG_TOKEN: TOKEN },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );
    const [stdout, stderr] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    await child.exited;

    const output = `${stdout}${stderr}`;
    // The regression this exists to catch: bun asking a human to log in.
    expect(output, 'bun must not fall back to interactive auth').not.toMatch(/npmjs\.com\/auth\/cli|press ENTER/i);

    const put = seen.find((request) => request.method === 'PUT');
    expect(put, `no publish request reached the registry; bun said: ${output.slice(0, 400)}`).toBeDefined();
    expect(put.authorization, 'publish request carried no credential').toBe(`Bearer ${TOKEN}`);
  } finally {
    server.stop(true);
    rmSync(dir, { recursive: true, force: true });
  }
}, 40000);
