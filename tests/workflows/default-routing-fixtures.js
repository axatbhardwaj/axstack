export const now = Date.parse('2026-10-27T12:00:00Z');
export const selection = (instanceId, model, value) => ({ instanceId, model,
  options: [{ id: instanceId === 'claude' ? 'effort' : 'reasoningEffort', value }] });
export function fixture() {
  const settings = { defaultModelSelection: selection('claude', 'claude-opus-5-5', 'medium'),
    providerInstances: { claude: { driver: 'claudeAgent', enabled: true }, code: { driver: 'codex', enabled: true } },
    textGenerationModelSelection: { instanceId: 'antigravity', model: 'gemini-3.8-flash-high' },
    projectSettingsOverrides: { project: { defaultModelSelection: { instanceId: 'custom', model: 'keep' } } },
    unrelated: { secret: 'fixture-secret' } };
  const account = (id, driver, used) => ({ id, driver, usageLimits: { checkedAt: new Date(now).toISOString(),
    windows: ['session', 'weekly'].map((kind, i) => ({ id: i ? 'seven_day' : 'five_hour', kind,
      usedPercent: used, resetsAt: new Date(now + (i ? 84 : 2.5) * 3600000).toISOString(),
      windowDurationMins: i ? 10080 : 300 })) } });
  const usage = [{ id: 'hub', kind: 'cliproxy', checkedAt: new Date(now).toISOString(),
    accounts: [account('a', 'claudeAgent', 70), account('b', 'codex', 10)] }];
  const catalogs = Object.entries(settings.providerInstances).map(([instanceId, p]) => ({
    instanceId, driver: p.driver, checkedAt: new Date(now).toISOString(), enabled: true, installed: true, status: 'ready',
    models: (p.driver === 'codex' ? ['gpt-6-astra', 'gpt-6.1-sol'] : ['claude-opus-5-5']).map((slug) => ({ slug,
      capabilities: { optionDescriptors: [{ id: p.driver === 'codex' ? 'reasoningEffort' : 'effort',
        options: [{ id: 'medium' }, { id: 'xhigh' }] }] } })) }));
  return { settings, usage, catalogs, now };
}
