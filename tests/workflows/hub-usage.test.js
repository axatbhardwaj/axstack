import { expect, test } from 'bun:test';
import { readHub } from '../../skills/axstack/scripts/hub-usage.js';
import { now } from './default-routing-fixtures.js';

test('live adapter reads hub management protocol and normalizes provider usage without retrieving tokens', async () => {
  const calls = [];
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(req) {
    expect(req.headers.get('authorization')).toBe('Bearer fake-key');
    const path = new URL(req.url).pathname;
    if (path.endsWith('/auth-files')) return Response.json({ files: [
      { id: 'c', auth_index: '1', provider: 'claude' },
      { id: 'x', auth_index: '2', provider: 'codex', id_token: { chatgpt_account_id: 'fake-account' } },
      { id: 'disabled', auth_index: '3', provider: 'codex', disabled: true },
    ] });
    const body = await req.json(); calls.push(body);
    expect(body.method).toBe('GET');
    expect(body.header.Authorization).toBe('Bearer $TOKEN$');
    const usage = body.auth_index === '1'
      ? { five_hour: { utilization: 20, resets_at: new Date(now + 100000).toISOString() },
        seven_day: { utilization: 30, resets_at: new Date(now + 1000000).toISOString() } }
      : { rate_limit: { primary_window: { used_percent: 40, reset_at: (now + 100000) / 1000, limit_window_seconds: 18000 },
        secondary_window: { used_percent: 50, reset_at: (now + 1000000) / 1000, limit_window_seconds: 604800 } } };
    return Response.json({ status_code: 200, body: JSON.stringify(usage) });
  } });
  try {
    const r = await readHub({ usageLimitSources: { hub: { enabled: true, kind: 'cliproxy',
      url: `http://127.0.0.1:${server.port}`, managementKey: 'fake-key' } } }, now);
    expect(r[0].accounts.map((a) => a.driver)).toEqual(['claudeAgent', 'codex']);
    expect(r[0].accounts[1].usageLimits.windows.map((w) => w.usedPercent)).toEqual([40, 50]);
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toBe('https://chatgpt.com/backend-api/wham/usage');
    expect(JSON.stringify(r)).not.toContain('fake-key');
  } finally { server.stop(true); }
});

test('malformed provider status holds the account instead of trusting a quota-shaped body', async () => {
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch(req) {
    return Response.json(new URL(req.url).pathname.endsWith('auth-files')
      ? { files: [{ id: 'x', auth_index: '1', provider: 'claude' }] }
      : { body: JSON.stringify({ five_hour: { utilization: 0 }, seven_day: { utilization: 0 } }) });
  } });
  try {
    const r = await readHub({ usageLimitSources: { hub: { enabled: true, kind: 'cliproxy',
      url: `http://127.0.0.1:${server.port}`, managementKey: 'fake' } } }, now);
    expect(r[0].accounts[0].usageLimits.unavailable?.reason).toBe('probeFailed');
  } finally { server.stop(true); }
});
