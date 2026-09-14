import { expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const readJson = (path) => JSON.parse(readFileSync(`${root}/${path}`, 'utf8'));
const presetDir = `${root}/profiles/presets`;
const presetNames = ['mixed', 'codex-only', 'claude-only'];
const roleIds = [
  'axstack-driver',
  'axstack-advisor',
  'axstack-owner',
  'axstack-author',
  'axstack-reviewer-primary',
  'axstack-reviewer-secondary',
  'axstack-checker',
  'axstack-research-requirements',
  'axstack-research-code',
  'axstack-research-web',
  'axstack-explainer',
  'axstack-explainer-review',
  'axstack-explore-codebase',
  'axstack-explore-execution',
  'axstack-monitor',
  'axstack-watchdog',
  'axstack-auditor',
];

const c = (model, effort) => ['codex', model, 'full-access', effort];
const a = (model, effort) => ['claude', model, 'bypassPermissions', effort];
const expected = {
  mixed: [
    c('gpt-6-astra', 'low'), a('claude-fable-5-1', 'medium'),
    a('claude-opus-5', 'medium'), c('gpt-5.6-sol', 'medium'),
    c('gpt-5.6-sol', 'medium'), a('claude-opus-5', 'medium'),
    c(null, 'low'), a('claude-opus-5', 'medium'),
    c('gpt-5.6-sol', 'medium'), a('claude-opus-5', 'low'),
    a('claude-sonnet-5', 'xhigh'), c('gpt-5.6-luna', 'max'),
    a('claude-sonnet-5', 'xhigh'), c('gpt-5.6-terra', 'low'),
    a('claude-opus-5', 'medium'), a('claude-opus-5', 'medium'),
    c('gpt-5.6-luna', 'max'),
  ],
  'codex-only': [
    c('gpt-5.6-sol', 'high'), c('gpt-6-astra', 'medium'),
    c('gpt-5.6-sol', 'high'), c('gpt-5.6-sol', 'medium'),
    c('gpt-5.6-sol', 'medium'), c('gpt-5.6-terra', 'xhigh'),
    c('gpt-5.6-luna', 'low'), c('gpt-6-astra', 'medium'),
    c('gpt-5.6-sol', 'medium'), c('gpt-5.6-terra', 'low'),
    c('gpt-5.6-sol', 'high'), c('gpt-5.6-luna', 'max'),
    c('gpt-5.6-terra', 'xhigh'), c('gpt-5.6-terra', 'low'),
    c('gpt-5.6-terra', 'low'), c('gpt-5.6-terra', 'low'),
    c('gpt-5.6-luna', 'max'),
  ],
  'claude-only': [
    a('claude-opus-5', 'high'), a('claude-fable-5-1', 'medium'),
    a('claude-opus-5', 'high'), a('claude-opus-5', 'medium'),
    a('claude-opus-5', 'medium'), a('claude-sonnet-5', 'xhigh'),
    a('claude-sonnet-5', 'low'), a('claude-opus-5', 'medium'),
    a('claude-opus-5', 'medium'), a('claude-sonnet-5', 'low'),
    a('claude-sonnet-5', 'xhigh'), a('claude-sonnet-5', 'high'),
    a('claude-sonnet-5', 'xhigh'), a('claude-sonnet-5', 'low'),
    a('claude-sonnet-5', 'low'), a('claude-sonnet-5', 'low'),
    a('claude-sonnet-5', 'xhigh'),
  ],
};

// Structural data checks only. They do not execute agents or prove routing behavior.
test('presets: canonical assets replace the legacy profile', () => {
  const actual = existsSync(presetDir)
    ? readdirSync(presetDir).filter((name) => name.endsWith('.json')).sort()
    : [];
  expect(actual).toEqual(presetNames.map((name) => `${name}.json`).sort());
  expect(existsSync(`${root}/profiles/paseo.json`)).toBe(false);
});

test('presets: all canonical assets have the exact ordered role matrix', () => {
  for (const preset of presetNames) {
    const data = readJson(`profiles/presets/${preset}.json`);
    expect(data.version).toBe(1);
    expect(data.preset).toBe(preset);
    expect(data.agentProfiles.map(({ id }) => id)).toEqual(roleIds);
    expect(data.agentProfiles.map(({ provider, model, modeId, thinkingOptionId }) =>
      [provider, model, modeId, thinkingOptionId])).toEqual(expected[preset]);
    for (const profile of data.agentProfiles) {
      expect(Object.keys(profile)).toEqual([
        'id', 'name', 'provider', 'model', 'modeId', 'thinkingOptionId', 'notes',
      ]);
      expect(profile.name).toBeTruthy();
      expect(profile.notes).toBeTruthy();
    }
  }
});

test('presets: provider boundaries and reviewer identities are explicit', () => {
  for (const preset of ['codex-only', 'claude-only']) {
    const profiles = readJson(`profiles/presets/${preset}.json`).agentProfiles;
    expect(new Set(profiles.map(({ provider }) => provider))).toEqual(
      new Set([preset === 'codex-only' ? 'codex' : 'claude']),
    );
  }
  for (const preset of presetNames) {
    const profiles = readJson(`profiles/presets/${preset}.json`).agentProfiles;
    expect(profiles.some(({ id }) => ['axstack-reviewer-opus', 'axstack-reviewer-sol'].includes(id))).toBe(false);
  }
  const checker = readJson('profiles/presets/mixed.json').agentProfiles
    .find(({ id }) => id === 'axstack-checker');
  expect(checker.model).toBeNull();
});

test('presets: all packaged Markdown pointers resolve', () => {
  const skills = `${root}/skills`;
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory() ? walk(path) : entry.name.endsWith('.md') ? [path] : [];
  });
  for (const file of walk(skills)) {
    const text = readFileSync(file, 'utf8');
    for (const [, link] of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      if (/^(?:https?:|mailto:|#)/.test(link)) continue;
      const target = new URL(link, `file://${file}`);
      expect(target.pathname.startsWith(`${skills}/`), `${file}: outside bundle: ${link}`).toBe(true);
      expect(existsSync(target.pathname), `${file}: missing ${link}`).toBe(true);
    }
  }
});
