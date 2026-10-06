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
  const instances = Object.fromEntries(accounts.map((account, index) => {
    const id = account.id ?? `${provider}-${index}`;
    const dir = account.defaultHome ? `${home}/.${provider}` : `${home}/account-${index}`;
    mkdirSync(dir, { recursive: true });
    const credentials = provider === 'claude'
      ? { claudeAiOauth: { accessToken: `${token}-${id}`, rateLimitTier: account.tier } }
      : { tokens: { access_token: `${token}-${id}`, account_id: id } };
    if (!account.missing) writeFileSync(`${dir}/${provider === 'claude' ? '.credentials.json' : 'auth.json'}`,
      JSON.stringify(credentials));
    replies.set(id, { body: account.body, status: account.status });
    return [id, { driver: account.driver ?? (provider === 'claude' ? 'claudeAgent' : 'codex'),
      enabled: account.enabled ?? true, config: account.defaultHome
        ? { homePath: '', ...(provider === 'codex' ? { shadowHomePath: '' } : {}) } : provider === 'claude'
        ? { homePath: dir } : { homePath: `${home}/wrong-home`, shadowHomePath: dir } }];
  }));
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

function expireCache(f) {
  const path = `${f.home}/cache/axstack/usage.json`;
  const data = JSON.parse(readFileSync(path, 'utf8'));
  for (const entry of Object.values(data)) entry.updatedAt = Date.now() - 6 * 60 * 1000;
  writeFileSync(path, JSON.stringify(data));
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

test('excludes any exhausted window or reached limit while preserving a below-threshold sibling', async () => {
  for (const provider of ['claude', 'codex']) {
    const f = fixture(provider, [
      { id: 'short-exhausted', body: provider === 'claude' ? claudeUsage(95, 0) : codexUsage('pro', 95, 0) },
      { id: 'long-exhausted', body: provider === 'claude' ? claudeUsage(0, 99) : codexUsage('pro', 0, 99) },
      ...(provider === 'codex' ? [{ id: 'limit', body: codexUsage('pro', 0, 0, true) }] : []),
      { id: 'eligible', body: provider === 'claude' ? claudeUsage(94, null) : codexUsage('prolite', 94, null) },
    ]);
    const result = await f.run();
    expect(result.status).toBe(0);
    expect(result.data.chosenInstanceId).toBe('eligible');
    expect(result.data.instances.filter(({ state }) => state === 'excluded').length).toBe(provider === 'codex' ? 3 : 2);
  }
});

test('missing credentials skip only that instance and leave a reason without exposing secrets', async () => {
  for (const provider of ['claude', 'codex']) {
    const f = fixture(provider, [
      { id: 'missing', missing: true },
      { id: 'eligible', body: provider === 'claude' ? claudeUsage(1, 1) : codexUsage('pro', 1, 1) },
    ]);
    const result = await f.run();
    expect(result.status).toBe(0);
    expect(result.data.chosenInstanceId).toBe('eligible');
    expect(result.data.instances[0]).toMatchObject({ instanceId: 'missing', state: 'skipped', reason: 'missing credentials' });
    expect(f.requests.map(({ id }) => id)).toEqual(['eligible']);
  }
});

test('no eligible instance exits nonzero with a short reason and no chosen ID', async () => {
  for (const accounts of [[], [{ missing: true }], [{ body: codexUsage('pro', 95, 0) }]]) {
    const result = await fixture('codex', accounts).run();
    expect(result.status).toBe(1);
    expect(result.output).toBe('');
    expect(result.error).toMatch(/no eligible provider instances/);
  }
});

test('fresh per-account cache avoids requests and keeps credentials out of the cache', async () => {
  const f = fixture('codex', [
    { id: 'one', body: codexUsage('pro', 10, 40) },
    { id: 'two', body: codexUsage('prolite', 10, 20) },
  ]);
  const first = await f.run();
  expect(first.status).toBe(0);
  const second = await f.run();
  expect(second.status).toBe(0);
  expect(second.data.chosenInstanceId).toBe('one');
  expect(second.data.instances.map(({ score, state }) => ({ score, state }))).toEqual([
    { score: 240, state: 'cached' }, { score: 80, state: 'cached' },
  ]);
  expect(f.requests.length).toBe(2);
  expect(readFileSync(`${f.home}/cache/axstack/usage.json`, 'utf8')).not.toContain(token);
});

test('failed usage requests without cache rank by tier alone and mark uncertainty', async () => {
  for (const status of [429, 503]) {
    const f = fixture('claude', [
      { id: 'max5', tier: 'default_claude_max_5x', status, body: { error: token } },
      { id: 'max20', tier: 'default_claude_max_20x', status, body: { error: token } },
    ]);
    const result = await f.run();
    expect(result.status).toBe(0);
    expect(result.data.chosenInstanceId).toBe('max20');
    expect(result.data.instances.map(({ score, state }) => ({ score, state }))).toEqual([
      { score: 1, state: 'unknown' }, { score: 4, state: 'unknown' },
    ]);
  }
  const f = fixture('codex', [{ id: 'unknown-plan', status: 429, body: { error: token } }]);
  const result = await f.run();
  expect(result.status).toBe(0);
  expect(result.data.instances[0]).toMatchObject({ score: 1, state: 'unknown' });
});

test('429 uses expired per-account usage and preserves exhausted-account exclusion', async () => {
  const f = fixture('codex', [
    { id: 'available', status: 429, body: { error: token } },
    { id: 'exhausted', status: 429, body: { error: token } },
  ]);
  mkdirSync(`${f.home}/cache/axstack`, { recursive: true });
  writeFileSync(`${f.home}/cache/axstack/usage.json`, JSON.stringify({
    [JSON.stringify(['codex', `${f.home}/account-0`])]: {
      updatedAt: Date.now() - 360000, tier: 'pro', utilization: 40, limitReached: false,
    },
    [JSON.stringify(['codex', `${f.home}/account-1`])]: {
      updatedAt: Date.now() - 360000, tier: 'pro', utilization: 95, limitReached: false,
    },
  }));
  const result = await f.run();
  expect(result.status).toBe(0);
  expect(result.data.chosenInstanceId).toBe('available');
  expect(result.data.instances[0]).toMatchObject({ score: 240, state: 'stale' });
  expect(result.data.instances[1]).toMatchObject({ score: null, state: 'excluded', stale: true });
});

test('corrupt cache cannot block a healthy usage request', async () => {
  for (const cache of [null, { invalid: true }]) {
    const f = fixture('codex', [{ id: 'healthy', body: codexUsage('pro', 30, 40) }]);
    mkdirSync(`${f.home}/cache/axstack`, { recursive: true });
    const key = JSON.stringify(['codex', `${f.home}/account-0`]);
    writeFileSync(`${f.home}/cache/axstack/usage.json`, JSON.stringify(cache === null ? null : {
      [key]: { updatedAt: Date.now(), utilization: 'invalid', tier: 'pro' },
    }));
    const result = await f.run();
    expect(result.status).toBe(0);
    expect(result.data.instances[0]).toMatchObject({ score: 240, state: 'fresh' });
    expect(f.requests.length).toBe(1);
  }
});

test('expired cache refreshes successfully and network failure retains the last usage', async () => {
  const f = fixture('claude', [{ id: 'account', tier: 'default_claude_max_20x', body: claudeUsage(10, 40) }]);
  expect((await f.run()).data.instances[0].score).toBe(240);
  expireCache(f);
  f.replies.set('account', { body: claudeUsage(80, 20) });
  expect((await f.run()).data.instances[0]).toMatchObject({ score: 80, state: 'fresh' });
  expect(f.requests.length).toBe(2);
  expireCache(f);
  servers.pop().stop(true);
  const result = await f.run();
  expect(result.status).toBe(0);
  expect(result.data.instances[0]).toMatchObject({ score: 80, state: 'stale' });
});

test('Codex homePath fallback and tilde expansion reach the configured credentials', async () => {
  const f = fixture('codex', [{ id: 'home-only', body: codexUsage('prolite', 20, 10) }]);
  f.instances['home-only'].config = { homePath: '~/account-0' };
  writeFileSync(f.settings, JSON.stringify({ providerInstances: f.instances }));
  const result = await f.run(['--settings', f.settings, '--json']);
  expect(result.status).toBe(0);
  expect(result.data.instances[0]).toMatchObject({ score: 80, state: 'fresh' });
});

test('unknown tiers cannot borrow weights from a different provider', async () => {
  for (const provider of ['claude', 'codex']) {
    const f = fixture(provider, [{ id: 'unknown-tier', tier: 'pro', body: provider === 'claude'
      ? claudeUsage(20, 30) : codexUsage('default_claude_max_20x', 20, 30) }]);
    const result = await f.run();
    expect(result.status).toBe(0);
    expect(result.data.instances[0].score).toBe(70);
  }
});
