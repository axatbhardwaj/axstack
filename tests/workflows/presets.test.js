import { readSkillFile } from './skill-source.js';
import { expect, test } from 'bun:test';
import { publicDocPaths } from './public-docs.js';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { checkRule, loadedReferences, prohibits, requires, sentences } from './prose-contract.js';

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
  'axstack-reviewer-peer',
  'axstack-diligence',
  'axstack-checker',
  'axstack-research-requirements',
  'axstack-research-code',
  'axstack-research-code-sol',
  'axstack-research-web',
  'axstack-research-x',
  'axstack-explainer',
  'axstack-explainer-review',
  'axstack-ui-verifier',
  'axstack-explore-codebase',
  'axstack-explore-codebase-luna',
  'axstack-explore-execution',
  'axstack-explore-execution-sol',
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
];

const c = (model, effort) => ['codex', model, 'full-access', effort];
const a = (model, effort) => ['claude', model, 'bypassPermissions', effort];
const g = (model, effort) => ['grok', model, 'full-access', effort];
const expected = {
  mixed: [
    c('astra', 'high'),
    a('opus', 'xhigh'),
    c('sol', 'high'), c('sol', 'high'),
    c('sol', 'high'), a('opus', 'high'), a('opus', 'medium'),
    a('sonnet', 'high'),
    a('sonnet', 'low'), a('sonnet', 'high'),
    a('sonnet', 'high'), c('terra', 'high'), a('sonnet', 'high'),
    g(null, 'high'),
    a('sonnet', 'high'), c('terra', 'medium'),
    a('sonnet', 'high'),
    a('haiku', 'high'), c('luna', 'xhigh'),
    a('sonnet', 'high'), c('terra', 'high'),
    a('haiku', 'xhigh'), c('sol', 'high'),
    a('opus', 'medium'), c('sol', 'high'),
    a('sonnet', 'high'), c('sol', 'high'),
    c('astra', 'xhigh'), a('fable', 'xhigh'), a('opus', 'xhigh'),
    g(null, 'high'),
  ],
  'codex-only': [
    c('astra', 'high'),
    c(null, 'xhigh'),
    c('sol', 'high'), c('sol', 'high'),
    c('sol', 'high'), c('terra', 'xhigh'), c('luna', 'xhigh'),
    c('sol', 'high'),
    c('luna', 'low'), c('astra', 'medium'),
    c('sol', 'high'), c('sol', 'high'), c('sol', 'low'),
    c(null, 'high'),
    c('sol', 'high'), c('luna', 'xhigh'),
    c('sol', 'medium'),
    c('sol', 'high'), c('luna', 'xhigh'),
    c('sol', 'high'), c('sol', 'high'),
    c('luna', 'xhigh'), c('sol', 'high'),
    c('sol', 'high'), c('sol', 'high'),
    c('sol', 'high'), c('sol', 'high'),
    c('astra', 'xhigh'), c(null, 'xhigh'), c(null, 'xhigh'),
    c(null, 'high'),
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
    a('sonnet', 'high'),
    a(null, 'high'),
    a('sonnet', 'high'),
    a(null, 'high'),
    a('sonnet', 'high'),
    a('sonnet', 'high'),
    a('sonnet', 'high'),
    a('haiku', 'high'),
    a(null, 'xhigh'),
    a('sonnet', 'high'),
    a(null, 'high'),
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
        ? ['id', 'name', 'provider', 'modeId', 'thinkingOptionId', 'notes', 'modelClass',
          ...(Object.hasOwn(profile, 'model') ? ['model'] : [])]
        : ['id', 'name', 'provider', 'model', 'modeId', 'thinkingOptionId', 'notes']);
      expect(profile.name).toBeTruthy();
      expect(profile.notes).toBeTruthy();
    }
  }
});

test('Claude class notes state saved capabilities resolution and rejection hold', () => {
  for (const preset of presetNames) {
    const roles = readJson(`profiles/presets/${preset}.json`).roles;
    for (const role of roles.filter(({ provider, modelClass }) => provider === 'claude' && modelClass)) {
      expect(role.notes, `${preset}: ${role.id}`).toMatch(/T3 (?:resolves Claude classes|uses the exact claude-haiku-5-5 pin) from saved capabilities; a Claude rejection holds/);
      expect(role.notes).not.toContain('Codex rejection');
    }
  }
});

test('UI verification routes rendered checks to the read-only verifier', () => {
  const rule = readFileSync(`${root}/skills/axstack/references/ui-verification.md`, 'utf8');
  // The shared routing boundary must retain delegation outside both exceptions.
  const concepts = [/every Playwright, browser, or rendered-UI check/i,
    /outside.*two named (?:author|browser) exceptions/i,
    /async.*delegate_task/i, /axstack-ui-verifier/i];
  for (const terminology of ['author', 'browser']) {
    const source = sentences(rule).join('. ')
      .replace(/two named (?:author|browser) exceptions/gi, `two named ${terminology} exceptions`);
    checkRule(source, (text) => requires(text, ...concepts),
      `Outside the two named ${terminology} exceptions, every Playwright, browser, or rendered-UI check uses async delegate_task to axstack-ui-verifier.`,
      [[/outside/i, 'including'], [/two named (?:author|browser) exceptions/i, 'all browser checks'],
        [/two/i, 'three'], [/named/i, 'unnamed'], [/async/i, 'synchronous'],
        [/delegate_task/i, 't3_thread_launch'], [/axstack-ui-verifier/i, 'driver']], concepts);
  }
  expect(rule).toMatch(/read-only/i);
  expect(rule).toMatch(/dispatch.s evidence folder/i);
  expect(rule).toMatch(/desktop[\s\S]*mobile[\s\S]*reduced-motion/i);
  for (const path of [
    'skills/axstack-implement/SKILL.md',
    'skills/axstack-review/SKILL.md',
    'skills/axstack-explain/references/visual-qa.md',
    'skills/axstack-debug/SKILL.md',
  ]) {
    expect(readSkillFile(`${root}/${path}`, 'utf8'), path).toContain('ui-verification.md');
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
    expect(notes).toMatch(/browser interaction pass belongs to axstack-ui-verifier/i);
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
    expect(auditor).toMatchObject(preset === 'mixed'
      ? { provider: 'claude', modelClass: 'haiku', model: 'claude-haiku-5-5', thinkingOptionId: 'xhigh' }
      : preset === 'claude-only'
        ? { provider: 'claude', modelClass: 'sonnet', thinkingOptionId: 'high' }
        : { provider: 'codex', modelClass: 'luna', thinkingOptionId: 'xhigh' });
    expect(workflows).toContain(`| \`${preset}\` |`);
    expect(workflows.split('\n').find((line) => line.startsWith(`| \`${preset}\` |`)))
      .toEndWith(preset === 'mixed' ? '| Haiku xhigh + Sol high |'
        : preset === 'claude-only' ? '| Sonnet high (Sol absent) |' : '| Luna xhigh + Sol high |');
  }
  checkRule(sentences(audit).join('. '), (text) => requires(text,
    /axstack-auditor.*profile/i, /claude\/haiku xhigh in mixed/i,
    /claude\/sonnet high in claude-only/i, /codex\/luna xhigh in codex-only/i),
  'The axstack-auditor profile uses claude/haiku xhigh in mixed, claude/sonnet high in claude-only, and codex/luna xhigh in codex-only.',
  [[/haiku xhigh/i, 'haiku high'], [/haiku/i, 'sonnet']]);
});

test('presets: Codex explainer reviewer uses the selected class and effort', () => {
  for (const [preset, modelClass, effort] of [['mixed', 'terra', 'medium'], ['codex-only', 'luna', 'xhigh']]) {
    const roles = readJson(`profiles/presets/${preset}.json`).roles;
    const reviewer = roles.find(({ id }) => id === 'axstack-explainer-review');
    expect(reviewer).toMatchObject({
      provider: 'codex', modelClass, thinkingOptionId: effort,
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
  expect(checker.modelClass).toBe('sonnet');
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
    ...publicDocPaths(root),
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
    'skills/axstack/references/routing.md', 'skills/axstack/references/t3-runtime.md',
  ];
  for (const file of files) {
    const text = readFileSync(`${root}/${file}`, 'utf8');
    expect(text.replace(/\s+/g, ' '), file).toMatch(file.endsWith('/t3-runtime.md') ? /stable role IDs/i : /all role IDs/i);
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

test('presets: retired monitor is absent from bundled roles and watch guidance', () => {
  for (const preset of presetNames) {
    const roles = readJson(`profiles/presets/${preset}.json`).roles;
    expect(roles.some(({ id }) => id === 'axstack-monitor'), preset).toBe(false);
  }
  for (const path of [
    'skills/axstack/references/role-roster.md',
    'skills/axstack/references/lifecycle.md',
    'skills/axstack/references/t3-runtime.md',
    'skills/axstack-watch/SKILL.md',
    'skills/axstack-watch/references/watch-runtime.md',
    'docs/workflows.md',
    'docs/installation.md',
  ]) {
    const text = readFileSync(`${root}/${path}`, 'utf8');
    expect(text, path).not.toContain('axstack-monitor');
    expect(text, path).not.toMatch(/\bchat-run\s+(?:read-only\s+)?observer\b/i);
  }
  const runtime = readFileSync(`${root}/skills/axstack/references/t3-runtime.md`, 'utf8');
  expect(runtime, 'dispatch table must omit the retired role').not.toMatch(/^\|[^\n]*\bmonitor\b[^\n]*\|$/im);
});

test('presets expose no retired workflow seats or provider', () => {
  for (const preset of presetNames) {
    const { roles } = readJson(`profiles/presets/${preset}.json`);
    expect(roles.some(({ provider }) => provider === 'antigravity')).toBe(false);
    for (const id of ['axstack-research-web-google', 'axstack-explore-codebase-flash',
      'axstack-arena-candidate-antigravity']) {
      expect(roles.some((role) => role.id === id)).toBe(false);
    }
  }
});
