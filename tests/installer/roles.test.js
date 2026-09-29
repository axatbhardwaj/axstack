import { expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli, writeFixtureBundle } from './helpers.js';
import {
  assertBundleRoles,
  assessInstalledRoleSnapshot,
  assessRoleReadiness,
  deriveModelClass,
  installedRoleBytes,
} from '../../src/roles.js';

const role = (id, model = 'model') => ({
  id,
  name: id,
  provider: 'codex',
  model,
});

const root = import.meta.dir.slice(0, -'/tests/installer'.length);
const solPairIds = [
  'axstack-research-code-sol', 'axstack-explore-execution-sol', 'axstack-auditor-sol',
];

test('model classes derive only from complete Codex IDs and Claude family prefixes', () => {
  for (const [modelClass, id, provider] of [
    ['sol', 'gpt-6.10-sol', 'codex'],
    ['astra', 'gpt-6-astra', 'codex'],
    ['luna', 'gpt-6.1-luna', 'codex'],
    ...['fable', 'opus', 'sonnet', 'haiku'].map((name) => [name, `claude-${name}-5-5`, 'claude']),
  ]) {
    expect(() => assertBundleRoles([{ ...role('axstack-driver', id), provider, modelClass }])).not.toThrow();
  }
  for (const id of ['gpt-5.6-terra', 'gpt-5.5', 'gpt-reserve', 'gpt-6-sol-preview', 'xgpt-6-sol']) {
    expect(() => assertBundleRoles([{ ...role('axstack-driver', id), modelClass: 'sol' }])).toThrow();
  }
});

test('deriveModelClass maps exact model families and rejects IDs outside them', () => {
  for (const [model, expected] of [
    ['gpt-6-sol', 'sol'],
    ['gpt-6.1-sol', 'sol'],
    ['gpt-6.10-luna', 'luna'],
    ['claude-opus-5-5', 'opus'],
    ['gpt-5.6-terra', null],
    ['gpt-5.5', null],
    ['gpt-reserve', null],
    ['gpt-sol', null],
    ['gpt-6..1-sol', null],
    ['gpt-6-sol-mini', null],
    ['xgpt-6-sol', null],
    ['claude-opus', null],
    ['claude-opusx-5', null],
    ['xclaude-opus-5', null],
    ['claude-terra-1', null],
  ]) {
    expect(deriveModelClass(model), model).toBe(expected);
  }
});

test('role rows accept class only, class with matching pin, legacy pin and allowlisted absence', () => {
  const rows = [
    { id: 'axstack-driver', name: 'Driver', provider: 'codex', modelClass: 'sol' },
    { ...role('axstack-monitor', null), modelClass: 'astra' },
    { ...role('axstack-advisor-opus', 'claude-opus-5-5'), provider: 'claude', modelClass: 'opus' },
    role('axstack-research-code', 'gpt-5.6-terra'),
    { ...role('axstack-checker', null), provider: 'antigravity' },
  ];
  expect(() => assertBundleRoles(rows)).not.toThrow();
  expect(assessRoleReadiness(rows, 'mixed')).toEqual({ ready: true, gaps: [] });
});

test('role rows reject class/provider and pin/class mismatches before installation', () => {
  for (const [row, message] of [
    [{ ...role('axstack-driver', null), provider: 'claude', modelClass: 'sol' }, /class.*provider/i],
    [{ ...role('axstack-driver', 'gpt-6-luna'), modelClass: 'sol' }, /pin.*class/i],
    [{ ...role('axstack-driver', 'gpt-5.6-terra'), modelClass: 'sol' }, /pin.*class/i],
    [{ ...role('axstack-driver', null), modelClass: 'terra' }, /modelClass/i],
    [{ ...role('axstack-driver', null), modelClass: ['sol'] }, /modelClass/i],
    [{ id: 'axstack-driver', name: 'Driver', provider: 'codex' }, /model/i],
  ]) {
    expect(() => assertBundleRoles([row])).toThrow(message);
  }
});

test('upgrade reports existing role IDs when modelClass or model changes', () => {
  const rootDir = makeTempRoot('axstack-model-field-upgrade-');
  const skillsDir = join(rootDir, 'installed');
  const old = [role('axstack-driver', 'gpt-6-sol'), role('axstack-monitor', 'gpt-6-astra'), role('axstack-checker', 'gpt-6-luna')];
  const current = [
    { ...old[0], modelClass: 'sol' },
    { ...old[1], model: 'gpt-6.1-astra' },
    { ...old[2] },
  ];
  const oldBundle = writeFixtureBundle(rootDir, { name: 'old', presets: { mixed: old } });
  const newBundle = writeFixtureBundle(rootDir, { name: 'new', presets: { mixed: current } });
  const cli = `${root}/bin/axstack.js`;
  const args = (bundle) => ['install', '--bundle', bundle, '--preset', 'mixed', '--skills-dir', skillsDir, '--no-claude-settings', '--yes'];
  runCli(cli, args(oldBundle), { env: { HOME: rootDir } });
  const result = runCli(cli, args(newBundle), { env: { HOME: rootDir } });
  expect(result.out).toContain('changed role models: axstack-driver (modelClass), axstack-monitor (model)');
  expect(result.out).not.toContain('axstack-checker (');
  expect(runCli(cli, args(newBundle), { env: { HOME: rootDir } }).out).not.toContain('changed role models:');
});

test('installed readiness compares role IDs with the selected bundle', () => {
  const expectedRoles = [
    role('axstack-author', 'gpt-6-sol'),
    role('axstack-reviewer-primary', 'gpt-6-sol'),
    role('axstack-reviewer-secondary', 'claude-opus-5-5'),
    { ...role('axstack-checker', null), provider: 'antigravity' },
  ];
  const installed = installedRoleBytes('mixed', [
    { ...role('axstack-checker', null), provider: 'antigravity' },
  ]);

  const result = assessInstalledRoleSnapshot(installed, 'mixed', expectedRoles);

  expect(result.ready).toBe(false);
  expect(result.gaps).toEqual([
    'missing selected bundle role: axstack-author',
    'missing selected bundle role: axstack-reviewer-primary',
    'missing selected bundle role: axstack-reviewer-secondary',
  ]);
});

test('single-provider readiness accepts only the intentionally unavailable adviser', () => {
  const roles = [
    { ...role('axstack-advisor-astra', 'gpt-6-astra'), thinkingOptionId: 'high' },
    { ...role('axstack-advisor-opus', null), thinkingOptionId: 'xhigh' },
    role('axstack-author', 'gpt-6-sol'),
    role('axstack-reviewer-primary', 'gpt-6-sol'),
    { ...role('axstack-reviewer-secondary', 'gpt-6-luna'), thinkingOptionId: 'xhigh' },
  ];

  expect(assessRoleReadiness(roles, 'codex-only')).toEqual({ ready: true, gaps: [] });
  roles.find(({ id }) => id === 'axstack-author').model = null;
  expect(assessRoleReadiness(roles, 'codex-only').gaps).toContain(
    'axstack-author requires a configured model',
  );
});

test('readiness accepts the intentionally unavailable X research route', () => {
  const mixed = [
    role('axstack-research-x', null),
  ];
  mixed[0].provider = 'grok';
  expect(assessRoleReadiness(mixed, 'mixed')).toEqual({ ready: true, gaps: [] });

  for (const preset of ['codex-only', 'claude-only']) {
    const provider = preset === 'codex-only' ? 'codex' : 'claude';
    expect(assessRoleReadiness([
      { ...role('axstack-research-x', null), provider },
    ], preset)).toEqual({ ready: true, gaps: [] });
  }
});

test('mixed X research null model is launchable only through the Grok provider', () => {
  expect(assessRoleReadiness([
    { ...role('axstack-research-x', null), provider: 'claude' },
  ], 'mixed').gaps).toContain(
    'axstack-research-x requires a configured model',
  );
});

test('preset readiness accepts the configured research routes', () => {
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const { roles } = JSON.parse(readFileSync(`${root}/profiles/presets/${preset}.json`, 'utf8'));
    expect(assessRoleReadiness(roles, preset), preset).toEqual({ ready: true, gaps: [] });
  }
});

test('claude-only intentional-absence allowlist contains exactly the accepted IDs', () => {
  const source = readFileSync(`${root}/src/roles.js`, 'utf8');
  const clause = source.match(/\(preset === 'claude-only' && \[([^\]]+)\]\.includes\(role\.id\)\)/)?.[1];
  expect(clause).toBeTruthy();
  const ids = [...clause.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  expect(ids).toEqual([
    'axstack-advisor-astra', 'axstack-arena-judge-astra',
    'axstack-research-web-google', 'axstack-research-x',
    'axstack-arena-candidate-grok', 'axstack-arena-candidate-antigravity',
    'axstack-auditor-sol', 'axstack-research-code-sol', 'axstack-explore-execution-sol',
  ]);
  expect(assessRoleReadiness([
    { id: 'axstack-auditor', name: 'Auditor', provider: 'claude', model: null },
  ], 'claude-only').gaps).toContain('axstack-auditor requires a configured model');
});

test('installed presets route analysis roles to the selected provider', () => {
  const expected = {
    mixed: ['claude', 'claude-sonnet-5-5', 'high'],
    'claude-only': ['claude', 'claude-sonnet-5-5', 'high'],
    'codex-only': null,
  };
  const analysisIds = [
    'axstack-auditor', 'axstack-research-code', 'axstack-explore-execution',
  ];
  for (const [preset, route] of Object.entries(expected)) {
    const rootDir = makeTempRoot(`axstack-analysis-${preset}-`);
    const skillsDir = join(rootDir, 'installed');
    runCli(`${root}/bin/axstack.js`, [
      'install', '--bundle', root, '--preset', preset, '--skills-dir', skillsDir,
      '--no-claude-settings', '--yes',
    ], { env: { HOME: rootDir } });
    const { roles } = JSON.parse(readFileSync(join(skillsDir, 'axstack', 'roles.json'), 'utf8'));
    const byId = Object.fromEntries(roles.map((entry) => [entry.id, entry]));
    for (const id of analysisIds) {
      const actual = byId[id];
      const codexOnlyRoute = id === 'axstack-auditor'
        ? ['codex', 'gpt-6-luna', 'xhigh']
        : ['codex', 'gpt-6-sol', 'high'];
      expect([actual.provider, actual.model, actual.thinkingOptionId], `${preset}: ${id}`)
        .toEqual(route ?? codexOnlyRoute);
    }
    if (preset === 'mixed') {
      expect(byId['axstack-research-web-google'].provider).toBe('antigravity');
      expect(byId['axstack-research-x'].provider).toBe('grok');
    }
  }
});

test('installed presets expose independent Sol analysis pair seats', () => {
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const rootDir = makeTempRoot(`axstack-sol-pairs-${preset}-`);
    const skillsDir = join(rootDir, 'installed');
    runCli(`${root}/bin/axstack.js`, [
      'install', '--bundle', root, '--preset', preset, '--skills-dir', skillsDir,
      '--no-claude-settings', '--yes',
    ], { env: { HOME: rootDir } });
    const { roles } = JSON.parse(readFileSync(join(skillsDir, 'axstack', 'roles.json'), 'utf8'));
    expect(roles).toHaveLength(32);
    for (const id of [
      'axstack-auditor-sol', 'axstack-research-code-sol', 'axstack-explore-execution-sol',
    ]) {
      const pair = roles.find((entry) => entry.id === id);
      expect(pair, `${preset}: ${id}`).toMatchObject(preset === 'claude-only'
        ? { provider: 'claude', model: null }
        : { provider: 'codex', model: 'gpt-6-sol', thinkingOptionId: 'high' });
    }
  }
});

test('a pristine 24-row installation upgrades to 26 and exposes both added IDs', () => {
  const rootDir = makeTempRoot('axstack-role-upgrade-');
  const home = rootDir;
  const skillsDir = join(rootDir, 'installed');
  const current = JSON.parse(readFileSync(`${root}/profiles/presets/mixed.json`, 'utf8')).roles.filter(({ id }) => !['axstack-arena-judge-opus', 'axstack-ui-verifier', 'axstack-diligence', ...solPairIds].includes(id));
  const old = current.filter(({ id }) => !['axstack-arena-candidate-grok', 'axstack-arena-candidate-antigravity'].includes(id));
  const oldBundle = writeFixtureBundle(rootDir, { name: 'old', presets: { mixed: old } });
  const newBundle = writeFixtureBundle(rootDir, { name: 'new', presets: { mixed: current } });
  const cli = `${root}/bin/axstack.js`;
  const args = (bundle) => ['install', '--bundle', bundle, '--preset', 'mixed', '--skills-dir', skillsDir, '--no-claude-settings', '--yes'];
  runCli(cli, args(oldBundle), { env: { HOME: home } });
  const rolesPath = join(skillsDir, 'axstack', 'roles.json');
  const before = readFileSync(rolesPath);
  expect(JSON.parse(before.toString()).roles).toHaveLength(24);
  expect(assessInstalledRoleSnapshot(before, 'mixed', current).gaps).toEqual([
    'missing selected bundle role: axstack-arena-candidate-grok',
    'missing selected bundle role: axstack-arena-candidate-antigravity',
  ]);
  const result = runCli(cli, args(newBundle), { env: { HOME: home } });
  expect(result.out).toContain('axstack/roles.json');
  expect(result.out).toContain('added role IDs: axstack-arena-candidate-grok, axstack-arena-candidate-antigravity');
  expect(JSON.parse(readFileSync(rolesPath, 'utf8')).roles).toHaveLength(26);
  expect(runCli(cli, args(newBundle), { env: { HOME: home } }).out).not.toContain('added role IDs:');
  writeFileSync(rolesPath, JSON.stringify({ version: 1, preset: 'mixed', roles: old }) + '\n');
  const preserved = runCli(cli, args(newBundle), { env: { HOME: home }, expectFail: true });
  expect(preserved.out).toContain('preserved user edits');
  expect(preserved.out).not.toContain('added role IDs:');
  expect(JSON.parse(readFileSync(rolesPath, 'utf8')).roles).toHaveLength(24);
});

test('a pristine 26-row installation upgrades to 27 and exposes the Opus judge', () => {
  const rootDir = makeTempRoot('axstack-opus-upgrade-');
  const skillsDir = join(rootDir, 'installed');
  const current = JSON.parse(readFileSync(`${root}/profiles/presets/mixed.json`, 'utf8')).roles.filter(({ id }) => !['axstack-ui-verifier', 'axstack-diligence', ...solPairIds].includes(id));
  const old = current.filter(({ id }) => id !== 'axstack-arena-judge-opus');
  const oldBundle = writeFixtureBundle(rootDir, { name: 'old', presets: { mixed: old } });
  const newBundle = writeFixtureBundle(rootDir, { name: 'new', presets: { mixed: current } });
  const args = (bundle) => ['install', '--bundle', bundle, '--preset', 'mixed', '--skills-dir', skillsDir, '--no-claude-settings', '--yes'];
  runCli(`${root}/bin/axstack.js`, args(oldBundle), { env: { HOME: rootDir } });
  const rolesPath = join(skillsDir, 'axstack', 'roles.json');
  const before = readFileSync(rolesPath);
  expect(JSON.parse(before.toString()).roles).toHaveLength(26);
  expect(assessInstalledRoleSnapshot(before, 'mixed', current).gaps).toEqual([
    'missing selected bundle role: axstack-arena-judge-opus',
  ]);
  const result = runCli(`${root}/bin/axstack.js`, args(newBundle), { env: { HOME: rootDir } });
  expect(result.out).toContain('added role IDs: axstack-arena-judge-opus');
  expect(JSON.parse(readFileSync(rolesPath, 'utf8')).roles).toHaveLength(27);
  expect(runCli(`${root}/bin/axstack.js`, args(newBundle), { env: { HOME: rootDir } }).out).not.toContain('added role IDs:');
});

test('a pristine 27-row installation reports the added UI verifier', () => {
  const rootDir = makeTempRoot('axstack-ui-verifier-upgrade-');
  const skillsDir = join(rootDir, 'installed');
  const current = JSON.parse(readFileSync(`${root}/profiles/presets/mixed.json`, 'utf8')).roles.filter(({ id }) => id !== 'axstack-diligence' && !solPairIds.includes(id));
  const old = current.filter(({ id }) => id !== 'axstack-ui-verifier');
  const oldBundle = writeFixtureBundle(rootDir, { name: 'old', presets: { mixed: old } });
  const newBundle = writeFixtureBundle(rootDir, { name: 'new', presets: { mixed: current } });
  const args = (bundle) => ['install', '--bundle', bundle, '--preset', 'mixed', '--skills-dir', skillsDir, '--no-claude-settings', '--yes'];
  const cli = `${root}/bin/axstack.js`;
  runCli(cli, args(oldBundle), { env: { HOME: rootDir } });
  const rolesPath = join(skillsDir, 'axstack', 'roles.json');
  expect(JSON.parse(readFileSync(rolesPath, 'utf8')).roles).toHaveLength(27);
  const result = runCli(cli, args(newBundle), { env: { HOME: rootDir } });
  expect(result.out).toContain('added role IDs: axstack-ui-verifier');
  expect(JSON.parse(readFileSync(rolesPath, 'utf8')).roles).toHaveLength(28);
});

test('a pristine 28-row installation reports all three Sol pair seats', () => {
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const rootDir = makeTempRoot(`axstack-sol-upgrade-${preset}-`);
    const skillsDir = join(rootDir, 'installed');
    const current = JSON.parse(readFileSync(`${root}/profiles/presets/${preset}.json`, 'utf8')).roles.filter(({ id }) => id !== 'axstack-diligence');
    const old = current.filter(({ id }) => !solPairIds.includes(id));
    const oldBundle = writeFixtureBundle(rootDir, { name: 'old', presets: { [preset]: old } });
    const newBundle = writeFixtureBundle(rootDir, { name: 'new', presets: { [preset]: current } });
    const args = (bundle) => ['install', '--bundle', bundle, '--preset', preset, '--skills-dir', skillsDir, '--no-claude-settings', '--yes'];
    runCli(`${root}/bin/axstack.js`, args(oldBundle), { env: { HOME: rootDir } });
    const result = runCli(`${root}/bin/axstack.js`, args(newBundle), { env: { HOME: rootDir } });
    expect(result.out).toContain(`added role IDs: ${solPairIds.join(', ')}`);
    const installed = JSON.parse(readFileSync(join(skillsDir, 'axstack', 'roles.json'), 'utf8')).roles;
    expect(installed).toHaveLength(31);
    expect(installed.map(({ id }) => id)).toEqual(current.map(({ id }) => id));
  }
});

test('a 31-row installation reports the added diligence role', () => {
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const rootDir = makeTempRoot(`axstack-diligence-upgrade-${preset}-`);
    const skillsDir = join(rootDir, 'installed');
    const current = JSON.parse(readFileSync(`${root}/profiles/presets/${preset}.json`, 'utf8')).roles;
    const old = current.filter(({ id }) => id !== 'axstack-diligence');
    const oldBundle = writeFixtureBundle(rootDir, { name: 'old', presets: { [preset]: old } });
    const newBundle = writeFixtureBundle(rootDir, { name: 'new', presets: { [preset]: current } });
    const args = (bundle) => ['install', '--bundle', bundle, '--preset', preset, '--skills-dir', skillsDir, '--no-claude-settings', '--yes'];
    runCli(`${root}/bin/axstack.js`, args(oldBundle), { env: { HOME: rootDir } });
    const result = runCli(`${root}/bin/axstack.js`, args(newBundle), { env: { HOME: rootDir } });
    expect(old).toHaveLength(31);
    expect(result.out).toContain('added role IDs: axstack-diligence');
    expect(JSON.parse(readFileSync(join(skillsDir, 'axstack', 'roles.json'), 'utf8')).roles).toHaveLength(32);
  }
});

test('retired Fable seats migrate to Opus adviser and escalation seat once', () => {
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const rootDir = makeTempRoot('axstack-fable-migration-');
    const skillsDir = join(rootDir, 'installed');
    const current = JSON.parse(readFileSync(`${root}/profiles/presets/${preset}.json`, 'utf8')).roles;
    const old = current.map((entry) => {
      if (entry.id === 'axstack-advisor-opus') return { ...entry, id: 'axstack-advisor-fable' };
      if (entry.id === 'axstack-escalation-fable') return { ...entry, id: 'axstack-arena-judge-fable' };
      return entry;
    });
    const oldBundle = writeFixtureBundle(rootDir, { name: 'old', presets: { [preset]: old } });
    const newBundle = writeFixtureBundle(rootDir, { name: 'new', presets: { [preset]: current } });
    const args = (bundle) => ['install', '--bundle', bundle, '--preset', preset, '--skills-dir', skillsDir, '--no-claude-settings', '--yes'];
    const cli = `${root}/bin/axstack.js`;
    runCli(cli, args(oldBundle), { env: { HOME: rootDir }, expectFail: preset === 'codex-only' });
    const result = runCli(cli, args(newBundle), { env: { HOME: rootDir } });
    expect(result.out).toContain('added role IDs: axstack-advisor-opus, axstack-escalation-fable');
    expect(result.out).toContain('removed role IDs: axstack-advisor-fable, axstack-arena-judge-fable');
    const installed = JSON.parse(readFileSync(join(skillsDir, 'axstack', 'roles.json'), 'utf8')).roles;
    expect(installed).toHaveLength(32);
    expect(installed.map(({ id }) => id)).toEqual(current.map(({ id }) => id));
    const again = runCli(cli, args(newBundle), { env: { HOME: rootDir } });
    expect(again.out).not.toContain('added role IDs:');
    expect(again.out).not.toContain('removed role IDs:');
  }
});

test('a null row in prior installed roles does not hide removed role IDs', () => {
  const rootDir = makeTempRoot('axstack-null-role-diff-');
  const skillsDir = join(rootDir, 'installed');
  const old = [role('axstack-driver'), role('axstack-retired')];
  const current = [role('axstack-driver'), role('axstack-new')];
  const oldBundle = writeFixtureBundle(rootDir, { name: 'old', presets: { mixed: old } });
  const newBundle = writeFixtureBundle(rootDir, { name: 'new', presets: { mixed: current } });
  const args = (bundle, force = false) => ['install', '--bundle', bundle, '--preset', 'mixed', '--skills-dir', skillsDir, '--no-claude-settings', '--yes', ...(force ? ['--force'] : [])];
  const cli = `${root}/bin/axstack.js`;
  runCli(cli, args(oldBundle), { env: { HOME: rootDir } });
  const rolesPath = join(skillsDir, 'axstack', 'roles.json');
  writeFileSync(rolesPath, JSON.stringify({ version: 1, preset: 'mixed', roles: [null, old[1]] }) + '\n');

  const result = runCli(cli, args(newBundle, true), { env: { HOME: rootDir } });
  expect(result.out).toContain('added role IDs: axstack-driver, axstack-new');
  expect(result.out).toContain('removed role IDs: axstack-retired');
  expect(JSON.parse(readFileSync(rolesPath, 'utf8')).roles).toEqual(current);
});

test('mixed Antigravity null models are limited to the configured launch-by-agent-id roles', () => {
  expect(assessRoleReadiness([
    { ...role('axstack-research-web-google', null), provider: 'antigravity' },
    { ...role('axstack-checker', null), provider: 'antigravity' },
  ], 'mixed')).toEqual({ ready: true, gaps: [] });

  expect(assessRoleReadiness([
    { ...role('axstack-monitor', null), provider: 'antigravity' },
  ], 'mixed').gaps).toContain(
    'axstack-monitor requires a configured model',
  );
});

test('arena candidate null models follow their configured family or intentional single-provider absence', () => {
  for (const [id, provider] of [
    ['axstack-arena-candidate-grok', 'grok'],
    ['axstack-arena-candidate-antigravity', 'antigravity'],
  ]) {
    expect(assessRoleReadiness([{ ...role(id, null), provider }], 'mixed')).toEqual({ ready: true, gaps: [] });
    expect(assessRoleReadiness([{ ...role(id, null), provider: 'codex' }], 'mixed').gaps).toContain(`${id} requires a configured model`);
    for (const preset of ['codex-only', 'claude-only']) {
      const singleProvider = preset === 'codex-only' ? 'codex' : 'claude';
      expect(assessRoleReadiness([{ ...role(id, null), provider: singleProvider }], preset)).toEqual({ ready: true, gaps: [] });
    }
  }
});

test('claude-only readiness permits the unavailable Astra slot', () => {
  const roles = [
    { ...role('axstack-advisor-astra', null), provider: 'claude', thinkingOptionId: 'high' },
    { ...role('axstack-advisor-opus', 'claude-opus-5-5'), provider: 'claude', thinkingOptionId: 'xhigh' },
    { ...role('axstack-author', 'claude-opus-5-5'), provider: 'claude' },
    { ...role('axstack-reviewer-primary', 'claude-opus-5-5'), provider: 'claude' },
    {
      ...role('axstack-reviewer-secondary', 'claude-sonnet-5-5'),
      provider: 'claude', thinkingOptionId: 'high',
    },
  ];

  expect(assessRoleReadiness(roles, 'claude-only')).toEqual({ ready: true, gaps: [] });
});

test('arena judge seats follow the adviser absence rule per provider preset', () => {
  const codex = [
    { ...role('axstack-advisor-astra', 'gpt-6-astra'), thinkingOptionId: 'high' },
    { ...role('axstack-advisor-opus', null), thinkingOptionId: 'xhigh' },
    role('axstack-author', 'gpt-6-sol'),
    role('axstack-reviewer-primary', 'gpt-6-sol'),
    { ...role('axstack-reviewer-secondary', 'gpt-6-luna'), thinkingOptionId: 'xhigh' },
    { ...role('axstack-arena-judge-astra', 'gpt-6-astra'), thinkingOptionId: 'xhigh' },
    { ...role('axstack-escalation-fable', null), thinkingOptionId: 'xhigh' },
  ];
  expect(assessRoleReadiness(codex, 'codex-only')).toEqual({ ready: true, gaps: [] });
  codex.find(({ id }) => id === 'axstack-arena-judge-astra').model = null;
  expect(assessRoleReadiness(codex, 'codex-only').gaps).toEqual([
    'axstack-arena-judge-astra requires a configured model',
  ]);

  const mixed = [
    { ...role('axstack-advisor-astra', 'gpt-6-astra'), thinkingOptionId: 'high' },
    { ...role('axstack-advisor-opus', 'claude-opus-5-5'), provider: 'claude', thinkingOptionId: 'xhigh' },
    role('axstack-author', 'gpt-6-sol'),
    role('axstack-reviewer-primary', 'gpt-6-sol'),
    { ...role('axstack-reviewer-secondary', 'claude-opus-5-5'), provider: 'claude', thinkingOptionId: 'medium' },
    { ...role('axstack-escalation-fable', null), provider: 'claude', thinkingOptionId: 'xhigh' },
  ];
  expect(assessRoleReadiness(mixed, 'mixed').gaps).toEqual([
    'axstack-escalation-fable requires a configured model',
  ]);
});

test('Opus judge is absent only in codex-only readiness', () => {
  const opus = { ...role('axstack-arena-judge-opus', null), provider: 'codex', thinkingOptionId: 'xhigh' };
  expect(assessRoleReadiness([opus], 'codex-only')).toEqual({ ready: true, gaps: [] });
  expect(assessRoleReadiness([{ ...opus, provider: 'claude' }], 'mixed').gaps).toContain(
    'axstack-arena-judge-opus requires a configured model',
  );
  expect(assessRoleReadiness([{ ...opus, provider: 'claude' }], 'claude-only').gaps).toContain(
    'axstack-arena-judge-opus requires a configured model',
  );
});

test('readiness rejects a null model on a non-intentional row such as an investigator seat', () => {
  const roles = [
    { ...role('axstack-advisor-astra', 'gpt-6-astra'), thinkingOptionId: 'high' },
    { ...role('axstack-advisor-opus', null), thinkingOptionId: 'xhigh' },
    role('axstack-author', 'gpt-6-sol'),
    role('axstack-reviewer-primary', 'gpt-6-sol'),
    { ...role('axstack-reviewer-secondary', 'gpt-6-luna'), thinkingOptionId: 'xhigh' },
    role('axstack-debug-investigator-1', null),
  ];
  expect(assessRoleReadiness(roles, 'codex-only').gaps).toEqual([
    'axstack-debug-investigator-1 requires a configured model',
  ]);
});
