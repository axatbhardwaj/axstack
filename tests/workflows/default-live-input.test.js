import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import * as fs from 'node:fs';
import { fixture } from './default-routing-fixtures.js';
const script = `${import.meta.dir}/../../skills/axstack/scripts/sync-default.js`;

test('real CLI combines masked key, weekly-only Codex, Fable limits and automatic native history safely', async () => {
  const dir = fs.mkdtempSync(`${process.env.TMPDIR}/default-live-input-`);
  const at = Date.now(); const f = fixture(); const sentinel = 'cli-secret-sentinel';
  fs.mkdirSync(`${dir}/userdata`, { mode: 0o700 }); fs.mkdirSync(`${dir}/caches`);
  fs.mkdirSync(`${dir}/userdata/secrets`, { mode: 0o700 });
  const secret = `${dir}/userdata/secrets/usage-limit-source-${Buffer.from('hub').toString('base64url')}.bin`;
  fs.writeFileSync(secret, sentinel, { mode: 0o600 });
  const d = new Database(`${dir}/userdata/statev2.sqlite`, { create: true });
  d.exec('CREATE TABLE orchestration_v2_projection_threads (thread_id TEXT, created_at TEXT, provider_instance_id TEXT, payload_json TEXT)');
  for (let i = 0; i < 5; i++) d.query('INSERT INTO orchestration_v2_projection_threads VALUES (?, ?, ?, ?)').run(`${i}`,
    new Date(at - 1000).toISOString(), 'code', JSON.stringify({ createdBy: 'user', creationSource: 'mobile',
      lineage: { parentThreadId: null }, modelSelection: { model: 'gpt-6-astra' } }));
  d.close();
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(req) {
    if (req.headers.get('authorization') !== `Bearer ${sentinel}`) return new Response('', { status: 401 });
    if (new URL(req.url).pathname.endsWith('auth-files')) return Response.json({ files: [
      { id: 'c1', auth_index: 'c1', provider: 'claude' }, { id: 'c2', auth_index: 'c2', provider: 'claude' },
      { id: 'x1', auth_index: 'x1', provider: 'codex' }, { id: 'x2', auth_index: 'x2', provider: 'codex' },
    ] });
    const body = await req.json();
    const usage = body.auth_index.startsWith('c') ? {
      five_hour: { utilization: 20, resets_at: new Date(at + 9000000).toISOString() },
      seven_day: { utilization: 30, resets_at: new Date(at + 302400000).toISOString() },
      limits: [{ kind: 'weekly_scoped', percent: 100, resets_at: new Date(at + 100000).toISOString(),
        scope: { model: { display_name: 'Fable' } } }],
    } : { rate_limit: { primary_window: { used_percent: body.auth_index === 'x1' ? 0 : 24,
      limit_window_seconds: 604800, reset_at: Math.floor((at + 302400000) / 1000) } } };
    return Response.json({ status_code: 200, body: JSON.stringify(usage) });
  } });
  try {
    for (const c of f.catalogs) fs.writeFileSync(`${dir}/caches/${c.instanceId}.json`, JSON.stringify({ ...c, checkedAt: new Date(at).toISOString() }));
    f.settings.usageLimitSources = { hub: { enabled: true, kind: 'cliproxy', managementKey: '••••••', url: `http://127.0.0.1:${server.port}` } };
    const before = JSON.stringify(f.settings);
    const path = `${dir}/userdata/settings.json`;
    fs.writeFileSync(path, before, { mode: 0o600 });
    const invoke = async (...flags) => {
      const p = Bun.spawn([process.execPath, script, '--settings', path, ...flags], { stdout: 'pipe', stderr: 'pipe' });
      const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
      expect(out + err).not.toContain(sentinel);
      expect(code).toBe(0);
      return JSON.parse(out);
    };
    const dry = await invoke();
    expect(dry.selection.model).toBe('gpt-6.1-sol');
    expect(dry.pools.codex.sessionStatus).toBe('n/a');
    expect(dry.pools.codex.weeklyRemaining).toBe(88);
    expect(dry.history.counts['gpt-6-astra']).toBe(5);
    expect(fs.readFileSync(path, 'utf8')).toBe(before);
    await invoke('--apply');
    const after = JSON.parse(fs.readFileSync(path, 'utf8'));
    expect(after.usageLimitSources).toEqual(f.settings.usageLimitSources);
    expect(after.defaultModelSelection.model).toBe('gpt-6.1-sol');
    expect(fs.readFileSync(secret, 'utf8')).toBe(sentinel);
    fs.unlinkSync(secret);
    const missing = Bun.spawn([process.execPath, script, '--settings', path], { stdout: 'pipe', stderr: 'pipe' });
    const [out, err, code] = await Promise.all([new Response(missing.stdout).text(), new Response(missing.stderr).text(), missing.exited]);
    expect(code).toBe(2); expect(JSON.parse(out).reason).toBe('hub management key missing or unsafe');
    expect(out + err).not.toContain(sentinel);
  } finally { server.stop(true); fs.rmSync(dir, { recursive: true, force: true }); }
});
