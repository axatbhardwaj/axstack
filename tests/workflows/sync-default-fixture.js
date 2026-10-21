import { afterEach, expect } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';

const script = `${import.meta.dir}/../../skills/axstack/scripts/sync-default.js`;
export const token = 'sync-fixture-secret';
const servers = [];
afterEach(() => { for (const server of servers.splice(0)) server.stop(true); });
export const weekly = (used, hours) => ({ five_hour: { utilization: 10,
  resets_at: new Date(Date.now() + 3 * 3600000).toISOString() },
  seven_day: { utilization: used, resets_at: new Date(Date.now() + hours * 3600000).toISOString() } });

export function fixture(accounts = [{ id: 'claudeAgent', body: weekly(66, 62), tier: 'default_claude_max_20x' },
  { id: 'claudeAlt', body: weekly(63, 43), tier: 'default_claude_max_20x' }], driver = 'claudeAgent') {
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
    const accountDriver = account.driver ?? driver;
    if (!account.missing) writeFileSync(`${dir}/${accountDriver === 'codex' ? 'auth.json' : '.credentials.json'}`,
      JSON.stringify(accountDriver === 'codex' ? { tokens: { access_token: `${token}-${account.id}`, account_id: account.id } }
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
      env: { ...process.env, HOME: home, XDG_CACHE_HOME: `${home}/cache`, AXSTACK_SYNC_DEFAULT: '1', AXSTACK_SYNC_POOL: '',
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

export const codex = (primary, secondary, reached = false) => ({ rate_limit: { limit_reached: reached,
  primary_window: { used_percent: primary, limit_window_seconds: 18000, reset_after_seconds: 7200 },
  ...(secondary && { secondary_window: secondary }) } });
export const pool = 'claudeAgent=claude-opus-5-5,codex=gpt-6-astra:medium';
export const codexWeekly = (used, hours = 60) => codex(10, { used_percent: used,
  limit_window_seconds: 604800, reset_after_seconds: hours * 3600 });
