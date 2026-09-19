import { expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const readJson = (path) => JSON.parse(readFileSync(`${root}/${path}`, 'utf8'));
const presetDir = `${root}/profiles/presets`;
const presetNames = ['mixed', 'codex-only', 'claude-only'];
const roleIds = [
  'axstack-advisor-astra',
  'axstack-advisor-fable',
  'axstack-owner',
  'axstack-author',
  'axstack-reviewer-primary',
  'axstack-reviewer-secondary',
  'axstack-checker',
  'axstack-research-requirements',
  'axstack-research-code',
  'axstack-research-web',
  'axstack-research-x',
  'axstack-explainer',
  'axstack-explainer-review',
  'axstack-explore-codebase',
  'axstack-explore-execution',
  'axstack-monitor',
  'axstack-watchdog',
  'axstack-auditor',
  'axstack-debug-investigator-1',
  'axstack-debug-investigator-2',
  'axstack-debug-investigator-3',
  'axstack-debug-investigator-4',
  'axstack-arena-judge-astra',
  'axstack-arena-judge-fable',
];

const c = (model, effort) => ['codex', model, 'full-access', effort];
const a = (model, effort) => ['claude', model, 'bypassPermissions', effort];
const g = (model, effort) => ['grok', model, 'full-access', effort];
const expected = {
  mixed: [
    c('gpt-6-astra', 'high'),
    a('claude-fable-5-1', 'high'),
    a('claude-opus-5', 'medium'), c('gpt-5.6-sol', 'medium'),
    c('gpt-5.6-sol', 'medium'), a('claude-opus-5', 'medium'),
    c(null, 'low'), a('claude-opus-5', 'medium'),
    c('gpt-5.6-sol', 'medium'), a('claude-opus-5', 'low'),
    g(null, 'high'),
    a('claude-sonnet-5', 'xhigh'), c('gpt-5.6-luna', 'max'),
    a('claude-sonnet-5', 'xhigh'), c('gpt-5.6-terra', 'low'),
    a('claude-opus-5', 'medium'), a('claude-opus-5', 'medium'),
    c('gpt-5.6-luna', 'max'),
    a('claude-opus-5', 'medium'), c('gpt-5.6-sol', 'medium'),
    a('claude-sonnet-5', 'xhigh'), c('gpt-5.6-terra', 'low'),
    c('gpt-6-astra', 'xhigh'), a('claude-fable-5-1', 'xhigh'),
  ],
  'codex-only': [
    c('gpt-6-astra', 'high'),
    c(null, 'high'),
    c('gpt-5.6-sol', 'high'), c('gpt-5.6-sol', 'medium'),
    c('gpt-5.6-sol', 'medium'), c('gpt-5.6-terra', 'xhigh'),
    c('gpt-5.6-luna', 'low'), c('gpt-6-astra', 'medium'),
    c('gpt-5.6-sol', 'medium'), c('gpt-5.6-terra', 'low'),
    c(null, 'high'),
    c('gpt-5.6-sol', 'high'), c('gpt-5.6-luna', 'max'),
    c('gpt-5.6-terra', 'xhigh'), c('gpt-5.6-terra', 'low'),
    c('gpt-5.6-terra', 'low'), c('gpt-5.6-terra', 'low'),
    c('gpt-5.6-luna', 'max'),
    c('gpt-5.6-sol', 'medium'), c('gpt-5.6-terra', 'low'),
    c('gpt-5.6-sol', 'high'), c('gpt-5.6-terra', 'xhigh'),
    c('gpt-6-astra', 'xhigh'), c(null, 'xhigh'),
  ],
  'claude-only': [
    a(null, 'high'),
    a('claude-fable-5-1', 'high'),
    a('claude-opus-5', 'high'), a('claude-opus-5', 'medium'),
    a('claude-opus-5', 'medium'), a('claude-sonnet-5', 'xhigh'),
    a('claude-sonnet-5', 'low'), a('claude-opus-5', 'medium'),
    a('claude-opus-5', 'medium'), a('claude-sonnet-5', 'low'),
    a(null, 'high'),
    a('claude-sonnet-5', 'xhigh'), a('claude-sonnet-5', 'high'),
    a('claude-sonnet-5', 'xhigh'), a('claude-sonnet-5', 'low'),
    a('claude-sonnet-5', 'low'), a('claude-sonnet-5', 'low'),
    a('claude-sonnet-5', 'xhigh'),
    a('claude-opus-5', 'medium'), a('claude-sonnet-5', 'xhigh'),
    a('claude-opus-5', 'high'), a('claude-sonnet-5', 'xhigh'),
    a(null, 'xhigh'), a('claude-fable-5-1', 'xhigh'),
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
    expect(Object.keys(data)).toEqual(['version', 'roles']);
    expect(data.roles.map(({ id }) => id)).toEqual(roleIds);
    expect(data.roles.map(({ provider, model, modeId, thinkingOptionId }) =>
      [provider, model, modeId, thinkingOptionId])).toEqual(expected[preset]);
    for (const profile of data.roles) {
      expect(Object.keys(profile)).toEqual([
        'id', 'name', 'provider', 'model', 'modeId', 'thinkingOptionId', 'notes',
      ]);
      expect(profile.name).toBeTruthy();
      expect(profile.notes).toBeTruthy();
    }
  }
});

test('presets: provider boundaries, intentional adviser absence, and reviewer identities are explicit', () => {
  for (const preset of ['codex-only', 'claude-only']) {
    const profiles = readJson(`profiles/presets/${preset}.json`).roles;
    const providerBoundRoles = profiles;
    expect(new Set(providerBoundRoles.map(({ provider }) => provider))).toEqual(
      new Set([preset === 'codex-only' ? 'codex' : 'claude']),
    );
    const unavailableId = preset === 'codex-only'
      ? 'axstack-advisor-fable'
      : 'axstack-advisor-astra';
    expect(profiles.find(({ id }) => id === unavailableId)?.model).toBeNull();
  }
  for (const preset of presetNames) {
    const profiles = readJson(`profiles/presets/${preset}.json`).roles;
    expect(profiles.some(({ id }) => ['axstack-reviewer-opus', 'axstack-reviewer-sol'].includes(id))).toBe(false);
  }
  const checker = readJson('profiles/presets/mixed.json').roles
    .find(({ id }) => id === 'axstack-checker');
  expect(checker.model).toBeNull();
});

test('presets: X research uses the Grok route only in mixed', () => {
  const research = readFileSync(`${root}/skills/axstack-research/SKILL.md`, 'utf8');
  expect(research).toContain(
    '`axstack-research-x`: X (Twitter) posts and threads via Grok — only when X evidence is answer-changing; cite post URLs and dates.',
  );

  const mixed = readJson('profiles/presets/mixed.json').roles
    .find(({ id }) => id === 'axstack-research-x');
  expect(mixed?.provider).toBe('grok');
  expect(mixed?.model).toBeNull();
  for (const preset of ['codex-only', 'claude-only']) {
    const unavailable = readJson(`profiles/presets/${preset}.json`).roles
      .find(({ id }) => id === 'axstack-research-x');
    expect(unavailable?.model).toBeNull();
    expect(unavailable?.notes).toMatch(/intentional single-provider absence/i);
  }
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

test('presets: scenario corpora never reference a stale role count', () => {
  const roleCount = readJson('profiles/presets/mixed.json').roles.length;
  const corpora = readdirSync(`${root}/tests/workflows`).filter((f) => f.endsWith('-scenarios.json'));
  expect(corpora.length).toBeGreaterThan(0);
  for (const file of corpora) {
    const text = readFileSync(`${root}/tests/workflows/${file}`, 'utf8');
    const stale = text.match(/\b(\d+)(?=[ -]role\b)/g)?.filter((n) => Number(n) !== roleCount) ?? [];
    expect(stale, `${file}: role counts must be ${roleCount}`).toEqual([]);
  }
});

test('presets: public docs and shared references never state a stale role count', () => {
  const roleCount = readJson('profiles/presets/mixed.json').roles.length;
  const files = [
    'README.md', 'docs/installation.md', 'docs/workflows.md',
    'skills/axstack/references/routing.md', 'skills/axstack/references/orca-runtime.md',
  ];
  for (const file of files) {
    const text = readFileSync(`${root}/${file}`, 'utf8');
    // "24 role rows", "24-role inputs", "24 stable role IDs", "24 stable IDs".
    const stale = text.match(/\b(\d+)(?=[ -](?:stable )?(?:role|IDs)\b)/g)?.filter((n) => Number(n) !== roleCount) ?? [];
    expect(stale, `${file}: role counts must be ${roleCount}`).toEqual([]);
    expect(text, `${file}: must state the role count`).toMatch(new RegExp(`\\b${roleCount}(?=[ -](?:stable )?(?:role|IDs)\\b)`));
  }
  const install = readFileSync(`${root}/docs/installation.md`, 'utf8').replace(/\s+/g, ' ');
  expect(install).toMatch(/unavailable adviser and its matching arena judge seat explicitly permit `model: null`/);
});

test('presets: monitor/watchdog notes carry the lifted hold, not the held wording', () => {
  for (const preset of presetNames) {
    const byId = Object.fromEntries(readJson(`profiles/presets/${preset}.json`).roles.map((r) => [r.id, r]));
    const monitor = byId['axstack-monitor'].notes;
    const watchdog = byId['axstack-watchdog'].notes;
    for (const notes of [monitor, watchdog]) {
      expect(notes, `${preset}: held wording`).not.toMatch(/activation is held|capability hold/i);
    }
    // The driver is the automation session itself; the monitor is not redefined as it.
    expect(monitor).not.toMatch(/driver automation|mutating owner|pushes/i);
    expect(monitor).toMatch(/optional[^.]*read-only|read-only[^.]*optional/i);
    expect(monitor).toMatch(/never sends/i);
    expect(monitor).toMatch(/not the driver|driver is the automation session/i);
    expect(watchdog).toMatch(/independent read-only/i);
    expect(watchdog).toMatch(/automation health/i);
    expect(watchdog).toMatch(/never mutates GitHub/i);
    expect(watchdog).toMatch(/(?:only|one)[^.]*gate-authorized[^.]*send[^.]*watchdog\.json/i);
    expect(watchdog).not.toMatch(/never sends/i);
  }
});
