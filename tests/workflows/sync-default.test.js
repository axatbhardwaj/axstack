import { afterEach, expect, test, spyOn } from 'bun:test';
import * as fs from 'node:fs';
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { commit } from '../../skills/axstack/scripts/sync-default.js';

const script = `${import.meta.dir}/../../skills/axstack/scripts/sync-default.js`;
const token = 'sync-fixture-secret';
const servers = [];
afterEach(() => { for (const server of servers.splice(0)) server.stop(true); });
const weekly = (used, hours) => ({ five_hour: { utilization: 10,
  resets_at: new Date(Date.now() + 3 * 3600000).toISOString() },
  seven_day: { utilization: used, resets_at: new Date(Date.now() + hours * 3600000).toISOString() } });

function fixture(accounts = [{ id: 'claudeAgent', body: weekly(66, 62), tier: 'default_claude_max_20x' },
  { id: 'claudeAlt', body: weekly(63, 43), tier: 'default_claude_max_5x' }], driver = 'claudeAgent') {
  const home = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/sync-default-`);
  const replies = new Map(accounts.map((account) => [account.id, account]));
  const requests = [];
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    const id = request.headers.get('authorization')?.replace(`Bearer ${token}-`, '');
    requests.push(id);
    const reply = replies.get(id);
    return Response.json(reply?.body ?? {}, { status: reply?.status ?? 200 });
  } });
  servers.push(server);
  const instances = Object.fromEntries(accounts.map((account, i) => {
    const dir = `${home}/account-${i}`;
    mkdirSync(dir);
    if (!account.missing) writeFileSync(`${dir}/${driver === 'codex' ? 'auth.json' : '.credentials.json'}`,
      JSON.stringify(driver === 'codex' ? { tokens: { access_token: `${token}-${account.id}`, account_id: account.id } }
        : { claudeAiOauth: { accessToken: `${token}-${account.id}`, rateLimitTier: account.tier } }));
    return [account.id, { driver: account.driver ?? driver, enabled: account.enabled ?? true, config: { homePath: dir } }];
  }));
  const settings = `${home}/settings.json`;
  const data = { providerInstances: instances, defaultModelSelection: { instanceId: accounts[0]?.id, model: 'keep-model' },
    planModelSelection: { instanceId: 'unchanged', model: 'other' },
    projectSettingsOverrides: { project: { defaultModelSelection: { instanceId: 'unchanged', model: 'project' } } } };
  writeFileSync(settings, JSON.stringify(data, null, 2) + '\n');
  async function run(args = [], env = {}) {
    const child = Bun.spawn(['bun', script, '--settings', settings, ...args], {
      env: { ...process.env, HOME: home, XDG_CACHE_HOME: `${home}/cache`, AXSTACK_SYNC_DEFAULT: '1',
        AXSTACK_CLAUDE_USAGE_URL: server.url.href, AXSTACK_CODEX_USAGE_URL: server.url.href, ...env },
      stdout: 'pipe', stderr: 'pipe',
    });
    const [output, error, status] = await Promise.all([
      new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
    ]);
    expect(output + error).not.toContain(token);
    return { output, error, status, data: output.startsWith('{') ? JSON.parse(output) : null };
  }
  return { home, settings, data, requests, replies, run };
}

test('Usage CLI dry-run reports weekly pace choice in one JSON line without writing settings', async () => {
  const f = fixture();
  const before = readFileSync(f.settings);
  const result = await f.run(['--dry-run']);
  expect(result.status).toBe(0);
  expect(result.data).toMatchObject({ action: 'updated', from: 'claudeAgent', to: 'claudeAlt' });
  expect(result.output.trim().split('\n')).toHaveLength(1);
  expect(result.error).toBe('');
  expect(f.requests).toEqual(['claudeAgent', 'claudeAlt']);
  expect(readFileSync(f.settings)).toEqual(before);
});
