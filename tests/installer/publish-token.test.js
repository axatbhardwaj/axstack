// The v0.8.2 regression wrote .npmrc, but the publisher never read it.
// Exercise the pinned npm against loopback; no real registry or token is used.
import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';

const NPM = 'npm@12.0.2';
const TEMP = Bun.env.TMPDIR ?? '/tmp';
const cached = join(TEMP, `bunx-${process.getuid?.() ?? 0}-${NPM}/node_modules/npm/package.json`);
const available = existsSync(cached);
if (!available) console.warn(`SKIP npm publish token probe: ${NPM} is not cached offline in TMPDIR`);

test.skipIf(!available)('pinned npm reads HOME .npmrc and authenticates a direct loopback PUT', async () => {
  expect(JSON.parse(readFileSync(cached, 'utf8')).version).toBe('12.0.2');
  const seen = [];
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      seen.push({ method: request.method, path: new URL(request.url).pathname,
        authorization: request.headers.get('authorization') });
      return Response.json({ ok: true }, { status: 201 });
    },
  });
  const sandbox = mkdtempSync(`${TEMP}/axstack-publish-token-`);
  const home = join(sandbox, 'home');
  const pkg = join(sandbox, 'pkg');
  mkdirSync(home);
  mkdirSync(pkg);
  try {
    writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: 'axstack-publish-probe', version: '0.0.0' }));
    writeFileSync(join(pkg, 'index.js'), '// synthetic probe\n');
    writeFileSync(join(home, 'global.npmrc'), '');
    // Keep the credential in HOME, never beside package.json or via --userconfig.
    const host = server.url.href.replace(/^https?:\/\//, '');
    writeFileSync(join(home, '.npmrc'), `//${host}:_authToken=synthetic-publish-probe\n`);
    const child = Bun.spawn(['bunx', '--no-install', NPM, 'publish', '.', '--access', 'public', '--registry', server.url.href], {
      cwd: pkg,
      // No inherited npm auth/config; leave userconfig unset to prove HOME pickup.
      env: { PATH: process.env.PATH, HOME: home, TMPDIR: TEMP,
        NPM_CONFIG_GLOBALCONFIG: join(home, 'global.npmrc'), NPM_CONFIG_CACHE: join(home, 'cache') },
      stdout: 'pipe', stderr: 'pipe',
    });
    const [stdout, stderr, exit] = await Promise.all([
      new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
    ]);
    expect(exit, `${stdout}${stderr}`).toBe(0);
    const published = seen.find((request) => request.method === 'PUT' && request.path === '/axstack-publish-probe');
    expect(published, 'npm must publish the probe directly').toBeDefined();
    expect(published.authorization).toBe('Bearer synthetic-publish-probe');
    expect(seen.some((request) => request.path.includes('/-/stage/'))).toBe(false);
  } finally {
    server.stop(true);
    rmSync(sandbox, { recursive: true });
  }
}, 120000);
