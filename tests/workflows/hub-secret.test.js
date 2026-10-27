import { expect, test } from 'bun:test';
import * as fs from 'node:fs';
import { readHub } from '../../skills/axstack/scripts/hub-usage.js';
import { now } from './default-routing-fixtures.js';

async function fixture(run) {
  const dir = fs.mkdtempSync(`${process.env.TMPDIR}/hub-secret-`);
  fs.mkdirSync(`${dir}/secrets`, { mode: 0o700 });
  const sentinel = 'private-fixture-sentinel';
  const id = 'hub/utf8-é';
  const secret = `${dir}/secrets/usage-limit-source-${Buffer.from(id, 'utf8').toString('base64url')}.bin`;
  fs.writeFileSync(secret, sentinel, { mode: 0o600 });
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(req) {
    if (req.headers.get('authorization') !== `Bearer ${sentinel}`) return new Response('', { status: 401 });
    return Response.json(new URL(req.url).pathname.endsWith('auth-files')
      ? { files: [{ id: 'a', provider: 'claude', auth_index: '1' }] }
      : { status_code: 200, body: JSON.stringify({ five_hour: { utilization: 10, resets_at: new Date(now + 100000).toISOString() },
        seven_day: { utilization: 20, resets_at: new Date(now + 1000000).toISOString() } }) });
  } });
  const settings = { usageLimitSources: { [id]: { enabled: true, kind: 'cliproxy', managementKey: '••••••', url: `http://127.0.0.1:${server.port}` } } };
  fs.writeFileSync(`${dir}/settings.json`, JSON.stringify(settings));
  try { await run({ dir, settings, secret, sentinel, read: () => readHub(settings, now, `${dir}/settings.json`) }); }
  finally { server.stop(true); fs.rmSync(dir, { recursive: true, force: true }); }
}

test('masked hub key resolves only its source secret, preserving settings and secret bytes', async () => fixture(async (f) => {
  const before = fs.readFileSync(`${f.dir}/settings.json`);
  const r = await f.read();
  expect(r[0].accounts).toHaveLength(1);
  expect(r[0].accounts[0].usageLimits.windows.map((w) => w.usedPercent)).toEqual([10, 20]);
  expect(JSON.stringify(r)).not.toContain(f.sentinel);
  expect(fs.readFileSync(f.secret, 'utf8')).toBe(f.sentinel);
  expect(fs.readFileSync(`${f.dir}/settings.json`)).toEqual(before);
  expect(f.settings.usageLimitSources['hub/utf8-é'].managementKey).toBe('••••••');
}));

for (const damage of ['missing', 'symlink', 'directory-symlink', 'writable', 'malformed']) {
  test(`masked key ${damage} is held with sanitized secret reason`, async () => fixture(async (f) => {
    if (damage === 'missing') fs.unlinkSync(f.secret);
    if (damage === 'symlink') { fs.renameSync(f.secret, `${f.dir}/target`); fs.symlinkSync(`${f.dir}/target`, f.secret); }
    if (damage === 'directory-symlink') { fs.renameSync(`${f.dir}/secrets`, `${f.dir}/target`); fs.symlinkSync(`${f.dir}/target`, `${f.dir}/secrets`); }
    if (damage === 'writable') fs.chmodSync(f.secret, 0o666);
    if (damage === 'malformed') fs.writeFileSync(f.secret, `${f.sentinel}\n`);
    const r = await f.read();
    expect(r[0].error).toBe('hub management key missing or unsafe');
    expect(JSON.stringify(r)).not.toContain(f.sentinel);
  }));
}
