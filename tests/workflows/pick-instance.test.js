import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';

const script = `${import.meta.dir}/../../skills/axstack/scripts/pick-instance.js`;
const token = 'fixture-secret-token-never-output';
const servers = [];
afterEach(() => { for (const server of servers.splice(0)) server.stop(true); });

function fixture(provider, accounts) {
  const home = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/pick-instance-`);
  const requests = [];
  const replies = new Map();
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    const id = request.headers.get('authorization')?.replace(`Bearer ${token}-`, '');
    requests.push({ id, headers: request.headers });
    const reply = replies.get(id);
    return Response.json(reply?.body ?? {}, { status: reply?.status ?? 200 });
  } });
  servers.push(server);
  const instances = accounts.map((account, index) => {
    const id = account.id ?? `${provider}-${index}`;
    const dir = account.defaultHome ? `${home}/.${provider}` : `${home}/account-${index}`;
    mkdirSync(dir, { recursive: true });
    const credentials = provider === 'claude'
      ? { claudeAiOauth: { accessToken: `${token}-${id}`, rateLimitTier: account.tier } }
      : { tokens: { access_token: `${token}-${id}`, account_id: id } };
    if (!account.missing) writeFileSync(`${dir}/${provider === 'claude' ? '.credentials.json' : 'auth.json'}`,
      JSON.stringify(credentials));
    replies.set(id, { body: account.body, status: account.status });
    return { id, driver: account.driver ?? (provider === 'claude' ? 'claudeAgent' : 'codex'),
      enabled: account.enabled ?? true, config: account.defaultHome ? {} : provider === 'claude'
        ? { homePath: dir } : { homePath: `${home}/wrong-home`, shadowHomePath: dir } };
  });
  mkdirSync(`${home}/.t3/userdata`, { recursive: true });
  const settings = `${home}/.t3/userdata/settings.json`;
  writeFileSync(settings, JSON.stringify({ providerInstances: instances }));
  async function run(args = ['--json']) {
    const child = Bun.spawn(['bun', script, '--provider', provider, ...args], {
      env: { ...process.env, HOME: home, XDG_CACHE_HOME: `${home}/cache`,
        AXSTACK_CLAUDE_USAGE_URL: server.url.href, AXSTACK_CODEX_USAGE_URL: server.url.href },
      stdout: 'pipe', stderr: 'pipe',
    });
    const [output, error, status] = await Promise.all([
      new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
    ]);
    expect(output + error).not.toContain(token);
    return { output, error, status, data: output.startsWith('{') ? JSON.parse(output) : null };
  }
  return { home, settings, requests, replies, instances, run };
}

const claudeUsage = (five, seven) => ({ five_hour: { utilization: five }, seven_day: { utilization: seven } });
const codexUsage = (plan, primary, secondary, reached = false) => ({ plan_type: plan,
  rate_limit: { limit_reached: reached, primary_window: { used_percent: primary },
    secondary_window: { used_percent: secondary } } });

test('Claude CLI selects weighted headroom across enabled same-driver accounts', async () => {
  const f = fixture('claude', [
    { id: 'max20', defaultHome: true, tier: 'default_claude_max_20x', body: claudeUsage(40, 70) },
    { id: 'max5', tier: 'default_claude_max_5x', body: claudeUsage(10, null) },
    { id: 'other-tier', tier: 'future-tier', body: claudeUsage(null, 20) },
    { id: 'disabled', enabled: false, body: claudeUsage(0, 0) },
    { id: 'wrong-driver', driver: 'codex', body: claudeUsage(0, 0) },
  ]);
  const result = await f.run();
  expect(result.status).toBe(0);
  expect(result.data.chosenInstanceId).toBe('max20');
  expect(result.data.instances.map(({ instanceId, score, state }) => ({ instanceId, score, state }))).toEqual([
    { instanceId: 'max20', score: 120, state: 'fresh' },
    { instanceId: 'max5', score: 90, state: 'fresh' },
    { instanceId: 'other-tier', score: 80, state: 'fresh' },
  ]);
  expect(f.requests.map(({ id }) => id)).toEqual(['max20', 'max5', 'other-tier']);
  expect(f.requests[0].headers.get('anthropic-beta')).toBe('oauth-2025-04-20');
  expect(f.requests[0].headers.get('user-agent')).toMatch(/^claude-cli\/.*external, cli/);
  expect((await f.run(['--settings', f.settings])).output).toBe('max20\n');
});

test('Codex CLI uses shadow home, plan weights and worst window', async () => {
  const f = fixture('codex', [
    { id: 'pro', defaultHome: true, body: codexUsage('pro', 60, 70) },
    { id: 'lite', body: codexUsage('prolite', 0, null) },
    { id: 'unknown-plan', body: codexUsage('future-plan', 20, 40) },
  ]);
  const result = await f.run();
  expect(result.status).toBe(0);
  expect(result.data.chosenInstanceId).toBe('pro');
  expect(result.data.instances.map(({ score }) => score)).toEqual([120, 100, 60]);
  expect(f.requests.map(({ headers }) => headers.get('chatgpt-account-id'))).toEqual(['pro', 'lite', 'unknown-plan']);
});
