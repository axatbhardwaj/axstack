import { expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const readJson = (path) => JSON.parse(readFileSync(`${root}/${path}`, 'utf8'));
const presetDir = `${root}/profiles/presets`;
const presetNames = ['mixed', 'codex-only', 'claude-only'];
const roleIds = [
  'axstack-advisor-astra',
  'axstack-advisor-opus',
  'axstack-owner',
  'axstack-author',
  'axstack-reviewer-primary',
  'axstack-reviewer-secondary',
  'axstack-diligence',
  'axstack-checker',
  'axstack-research-requirements',
  'axstack-research-code',
  'axstack-research-code-sol',
  'axstack-research-web',
  'axstack-research-web-google',
  'axstack-research-x',
  'axstack-explainer',
  'axstack-explainer-review',
  'axstack-ui-verifier',
  'axstack-explore-codebase',
  'axstack-explore-execution',
  'axstack-explore-execution-sol',
  'axstack-monitor',
  'axstack-auditor',
  'axstack-auditor-sol',
  'axstack-debug-investigator-1',
  'axstack-debug-investigator-2',
  'axstack-debug-investigator-3',
  'axstack-debug-investigator-4',
  'axstack-arena-judge-astra',
  'axstack-escalation-fable',
  'axstack-arena-judge-opus',
  'axstack-arena-candidate-grok',
  'axstack-arena-candidate-antigravity',
];

const c = (model, effort) => ['codex', model, 'full-access', effort];
const a = (model, effort) => ['claude', model, 'bypassPermissions', effort];
const g = (model, effort) => ['grok', model, 'full-access', effort];
const ag = (model, effort) => ['antigravity', model, 'full-access', effort];
const expected = {
  mixed: [
    c('astra', 'high'),
    a('opus', 'xhigh'),
    a('opus', 'medium'), c('sol', 'high'),
    c('sol', 'high'), a('opus', 'medium'),
    a('sonnet', 'high'),
    ag(null, 'low'), a('sonnet', 'high'),
    a('sonnet', 'high'), c('sol', 'high'), a('sonnet', 'high'), ag(null, 'high'),
    g(null, 'high'),
    a('sonnet', 'high'), c('luna', 'xhigh'),
    a('sonnet', 'high'),
    a('sonnet', 'high'), a('sonnet', 'high'), c('sol', 'high'),
    a('sonnet', 'high'),
    a('sonnet', 'high'), c('sol', 'high'),
    a('opus', 'medium'), c('sol', 'high'),
    a('sonnet', 'high'), c('sol', 'high'),
    c('astra', 'xhigh'), a('fable', 'xhigh'), a('opus', 'xhigh'),
    g(null, 'high'), ag(null, 'high'),
  ],
  'codex-only': [
    c('astra', 'high'),
    c(null, 'xhigh'),
    c('sol', 'high'), c('sol', 'high'),
    c('sol', 'high'), c('luna', 'xhigh'),
    c('sol', 'high'),
    c('luna', 'low'), c('astra', 'medium'),
    c('sol', 'high'), c('sol', 'high'), c('sol', 'low'), c(null, 'high'),
    c(null, 'high'),
    c('sol', 'high'), c('luna', 'xhigh'),
    c('sol', 'medium'),
    c('sol', 'high'), c('sol', 'high'), c('sol', 'high'),
    c('sol', 'low'),
    c('luna', 'xhigh'), c('sol', 'high'),
    c('sol', 'high'), c('sol', 'high'),
    c('sol', 'high'), c('sol', 'high'),
    c('astra', 'xhigh'), c(null, 'xhigh'), c(null, 'xhigh'),
    c(null, 'high'), c(null, 'high'),
  ],
  'claude-only': [
    a(null, 'high'),
    a('opus', 'xhigh'),
    a('opus', 'medium'),
    a('opus', 'medium'),
    a('opus', 'medium'),
    a('sonnet', 'high'),
    a('sonnet', 'high'),
    a('sonnet', 'high'),
    a('sonnet', 'high'),
    a('sonnet', 'high'),
    a(null, 'high'),
    a('sonnet', 'high'),
    a(null, 'high'),
    a(null, 'high'),
    a('sonnet', 'high'),
    a('sonnet', 'high'),
    a('sonnet', 'high'),
    a('sonnet', 'high'),
    a('sonnet', 'high'),
    a(null, 'high'),
    a('sonnet', 'high'),
    a('sonnet', 'high'),
    a(null, 'high'),
    a('opus', 'medium'),
    a('sonnet', 'high'),
    a('opus', 'medium'),
    a('sonnet', 'high'),
    a(null, 'xhigh'),
    a('fable', 'xhigh'),
    a('opus', 'xhigh'),
    a(null, 'high'),
    a(null, 'high'),
  ],};

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
    expect(data.roles.map(({ provider, model, modelClass, modeId, thinkingOptionId }) =>
      [provider, modelClass ?? model, modeId, thinkingOptionId])).toEqual(expected[preset]);
    for (const profile of data.roles) {
      expect(Object.keys(profile)).toEqual(profile.modelClass
        ? ['id', 'name', 'provider', 'modeId', 'thinkingOptionId', 'notes', 'modelClass']
        : ['id', 'name', 'provider', 'model', 'modeId', 'thinkingOptionId', 'notes']);
      expect(profile.name).toBeTruthy();
      expect(profile.notes).toBeTruthy();
    }
  }
});

test('Claude class notes state first-launch alias and rejection hold', () => {
  for (const preset of presetNames) {
    const roles = readJson(`profiles/presets/${preset}.json`).roles;
    for (const role of roles.filter(({ provider, modelClass }) => provider === 'claude' && modelClass)) {
      expect(role.notes, `${preset}: ${role.id}`).toContain('Claude alias resolves at first launch; a Claude rejection holds');
      expect(role.notes).not.toContain('Codex rejection');
    }
  }
});

test('UI verification routes rendered checks to the read-only verifier', () => {
  const rule = readFileSync(`${root}/skills/axstack/references/ui-verification.md`, 'utf8');
  expect(rule).toMatch(/every Playwright, browser, or rendered-UI check/i);
  expect(rule).toMatch(/Orca[\s\S]*axstack-ui-verifier/i);
  expect(rule).toMatch(/read-only/i);
  expect(rule).toMatch(/dispatch.s evidence folder/i);
  expect(rule).toMatch(/desktop[\s\S]*mobile[\s\S]*reduced-motion/i);
  for (const path of [
    'skills/axstack-implement/SKILL.md',
    'skills/axstack-review/SKILL.md',
    'skills/axstack-explain/references/visual-qa.md',
    'skills/axstack-debug/SKILL.md',
  ]) {
    expect(readFileSync(`${root}/${path}`, 'utf8'), path).toContain('ui-verification.md');
  }
  const cases = readJson('tests/workflows/routing-scenarios.json').cases;
  const ui = cases.find(({ id }) => id === 'ui-change-rendered-check');
  expect(ui?.expected?.role).toBe('axstack-ui-verifier');
  expect(ui?.expected?.forbidden).toContain('PR writer performs rendered check');
});

for (const preset of presetNames) {
  test(`UI verification: ${preset} explainer reviewer keeps text and fidelity`, () => {
    const roles = readJson(`profiles/presets/${preset}.json`).roles;
    const notes = roles.find(({ id }) => id === 'axstack-explainer-review')?.notes;
    expect(notes).toMatch(/checks the exact artifact for text and source fidelity/i);
    expect(notes).toMatch(/rendered pass belongs to axstack-ui-verifier/i);
    expect(notes).not.toMatch(/rendered behavior where warranted/i);
  });
}

test('UI verification: visual QA keeps explainer text and fidelity review', () => {
  const qa = readFileSync(`${root}/skills/axstack-explain/references/visual-qa.md`, 'utf8');
  expect(qa).toMatch(/The explainer reviewer checks text and source fidelity/i);
});

test('UI verification: the PR writer remains the sole writer', () => {
  const rule = readFileSync(`${root}/skills/axstack/references/ui-verification.md`, 'utf8');
  expect(rule).toMatch(/The PR writer remains the sole writer/i);
});

test('UI verification: debug delegates both L0 and L1 browser reproductions', () => {
  const debug = readFileSync(`${root}/skills/axstack-debug/SKILL.md`, 'utf8');
  expect(debug).toMatch(/L0 or L1 headless-browser reproduction through\s+\[UI verification\]\(\.\.\/axstack\/references\/ui-verification\.md\)/i);
});

test('UI verification: shared routing lists the verifier role', () => {
  const roster = readFileSync(`${root}/skills/axstack/references/role-roster.md`, 'utf8');
  expect(roster).toMatch(/^- `axstack-ui-verifier`:.*\(ui-verification\.md\)/m);
});

test('presets: Sol author and primary reviewer run at high effort', () => {
  for (const preset of ['mixed', 'codex-only']) {
    const roles = readJson(`profiles/presets/${preset}.json`).roles;
    const byId = Object.fromEntries(roles.map((role) => [role.id, role]));
    expect(byId['axstack-author']).toMatchObject({
      provider: 'codex', modelClass: 'sol', thinkingOptionId: 'high',
    });
    expect(byId['axstack-reviewer-primary'].thinkingOptionId).toBe('high');
  }
});

for (const id of ['axstack-owner', 'axstack-debug-investigator-3']) {
  test(`presets: claude-only lowers ${id} to medium`, () => {
    const role = readJson('profiles/presets/claude-only.json').roles
      .find((entry) => entry.id === id);
    expect(role).toMatchObject({
      provider: 'claude', modelClass: 'opus', thinkingOptionId: 'medium',
    });
  });
}

test('presets: auditor route agrees with audit skill and workflow table', () => {
  const audit = readFileSync(`${root}/skills/axstack-audit/SKILL.md`, 'utf8');
  const workflows = readFileSync(`${root}/docs/workflows.md`, 'utf8');
  for (const preset of presetNames) {
    const roles = readJson(`profiles/presets/${preset}.json`).roles;
    const auditor = roles.find(({ id }) => id === 'axstack-auditor');
    const sonnet = preset !== 'codex-only';
    expect(auditor).toMatchObject(sonnet
      ? { provider: 'claude', modelClass: 'sonnet', thinkingOptionId: 'high' }
      : { provider: 'codex', modelClass: 'luna', thinkingOptionId: 'xhigh' });
    expect(workflows).toContain(`| \`${preset}\` |`);
    expect(workflows.split('\n').find((line) => line.startsWith(`| \`${preset}\` |`)))
      .toEndWith(sonnet
        ? (preset === 'mixed' ? '| Sonnet high + Sol high |' : '| Sonnet high (Sol absent) |')
        : '| Luna xhigh + Sol high |');
  }
  expect(audit.replace(/\s+/g, ' ')).toContain('`axstack-auditor` profile (claude/sonnet high in mixed/claude-only; codex/luna xhigh in codex-only)');
});

test('presets: Codex explainer reviewer uses supported Luna effort', () => {
  for (const preset of ['mixed', 'codex-only']) {
    const roles = readJson(`profiles/presets/${preset}.json`).roles;
    const reviewer = roles.find(({ id }) => id === 'axstack-explainer-review');
    expect(reviewer).toMatchObject({
      provider: 'codex', modelClass: 'luna', thinkingOptionId: 'xhigh',
    });
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
      ? 'axstack-advisor-opus'
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
    '`axstack-research-x`: X (Twitter) posts and threads via Grok; cite post URLs and dates.',
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

test('presets: research fans out through the Google web route', () => {
  const research = readFileSync(`${root}/skills/axstack-research/SKILL.md`, 'utf8');
  expect(research).toMatch(/every other research run dispatches every configured research branch/i);
  expect(research).toContain('`axstack-research-web-google`');
  expect(research).toMatch(/URL (?:\+|and) access date per claim/i);
  expect(research).toMatch(/re-open sources and never trust a search\s+summary/i);
  expect(research).toMatch(/reconciles agreements\/disagreements per claim/i);
  expect(research).toMatch(/unconfigured or unavailable branch[^.]*absent[^.]*never substituted/i);

  const mixed = readJson('profiles/presets/mixed.json').roles;
  const google = mixed.find(({ id }) => id === 'axstack-research-web-google');
  expect(google).toMatchObject({ provider: 'antigravity', model: null, thinkingOptionId: 'high' });
  expect(mixed.find(({ id }) => id === 'axstack-checker')).toMatchObject({
    provider: 'antigravity', model: null, thinkingOptionId: 'low',
  });
  for (const preset of ['codex-only', 'claude-only']) {
    const unavailable = readJson(`profiles/presets/${preset}.json`).roles
      .find(({ id }) => id === 'axstack-research-web-google');
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

test('presets: active guidance and tests contain no literal role count', () => {
  const files = [
    'README.md', 'docs/installation.md', 'docs/workflows.md',
    ...readdirSync(`${root}/skills`, { recursive: true })
      .filter((path) => path.endsWith('.md')).map((path) => `skills/${path}`),
    ...readdirSync(`${root}/tests/workflows`)
      .filter((path) => /\.(?:js|json)$/.test(path)).map((path) => `tests/workflows/${path}`),
    ...readdirSync(`${root}/tests/installer`)
      .filter((path) => path.endsWith('.js')).map((path) => `tests/installer/${path}`),
  ];
  for (const file of files) {
    expect(readFileSync(`${root}/${file}`, 'utf8'), file)
      .not.toMatch(/\b\d+[ -](?:[a-z]+[ -])?(?:role(?:s| rows| IDs)?|IDs|row)\b/i);
  }
});

test('presets: public docs and shared references describe all role IDs', () => {
  const files = [
    'README.md', 'docs/installation.md', 'docs/workflows.md',
    'skills/axstack/references/routing.md', 'skills/axstack/references/orca-runtime.md',
  ];
  for (const file of files) {
    const text = readFileSync(`${root}/${file}`, 'utf8');
    expect(text.replace(/\s+/g, ' '), file).toMatch(/all role IDs/i);
  }
  const install = readFileSync(`${root}/docs/installation.md`, 'utf8').replace(/\s+/g, ' ');
  expect(install).toMatch(/unavailable adviser and round-2 seat explicitly permit `model: null`/);
});

test('presets: public workflow table names the current codex-only peer model families', () => {
  const workflows = readFileSync(`${root}/docs/workflows.md`, 'utf8');
  expect(workflows).toContain(
    '| `codex-only` | Sol high | Sol high; Luna xhigh | Astra high / unavailable | Luna xhigh + Sol high |',
  );
});

test('presets: monitor remains a standalone read-only observer', () => {
  for (const preset of presetNames) {
    const byId = Object.fromEntries(readJson(`profiles/presets/${preset}.json`).roles.map((r) => [r.id, r]));
    const monitor = byId['axstack-monitor'].notes;
    expect(monitor, `${preset}: held wording`).not.toMatch(/activation is held|capability hold/i);
    expect(monitor).not.toMatch(/driver automation|mutating owner|pushes/i);
    expect(monitor).toMatch(/optional[^.]*read-only|read-only[^.]*optional/i);
    expect(monitor).toMatch(/never sends/i);
    expect(monitor).toMatch(/standalone PR watch/i);
    expect(byId['axstack-watchdog']).toBeUndefined();
  }
});
