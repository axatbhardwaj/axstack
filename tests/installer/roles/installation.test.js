import { expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from '../../../src/posixpath.js';
import { makeTempRoot, runCli, writeFixtureBundle } from '../helpers.js';
import { assessInstalledRoleSnapshot } from '../../../src/roles.js';

const role = (id, model = 'model') => ({
  id,
  name: id,
  provider: 'codex',
  model,
});

const root = import.meta.dir.slice(0, -'/tests/installer/roles'.length);
const solPairIds = [
  'axstack-research-code-sol', 'axstack-explore-execution-sol', 'axstack-auditor-sol',
];


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

test('installed presets route analysis roles to the selected provider', () => {
  const expected = {
    mixed: ['claude', 'sonnet', 'high'],
    'claude-only': ['claude', 'sonnet', 'high'],
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
      const mixedAuditor = preset === 'mixed' && id === 'axstack-auditor';
      const codexOnlyRoute = id === 'axstack-auditor'
        ? ['codex', 'luna', 'xhigh']
        : ['codex', 'sol', 'high'];
      expect([actual.provider, actual.modelClass ?? actual.model, actual.thinkingOptionId], `${preset}: ${id}`)
        .toEqual(mixedAuditor ? ['claude', 'haiku', 'xhigh'] : route ?? codexOnlyRoute);
      if (mixedAuditor) expect(actual.model).toBe('claude-haiku-5-5');
    }
    if (preset === 'mixed') {
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
    const presetRoles = JSON.parse(readFileSync(`${root}/profiles/presets/${preset}.json`, 'utf8')).roles;
    expect(roles).toHaveLength(presetRoles.length);
    for (const id of [
      'axstack-auditor-sol', 'axstack-research-code-sol', 'axstack-explore-execution-sol',
    ]) {
      const pair = roles.find((entry) => entry.id === id);
      expect(pair, `${preset}: ${id}`).toMatchObject(preset === 'claude-only'
        ? { provider: 'claude', model: null }
        : { provider: 'codex', modelClass: 'sol', thinkingOptionId: 'high' });
    }
  }
});

test('an installation without arena candidate reports its added ID', () => {
  const rootDir = makeTempRoot('axstack-role-upgrade-');
  const home = rootDir;
  const skillsDir = join(rootDir, 'installed');
  const current = JSON.parse(readFileSync(`${root}/profiles/presets/mixed.json`, 'utf8')).roles.filter(({ id }) => !['axstack-arena-judge-opus', 'axstack-ui-verifier', 'axstack-diligence', ...solPairIds].includes(id));
  const old = current.filter(({ id }) => id !== 'axstack-arena-candidate-grok');
  const oldBundle = writeFixtureBundle(rootDir, { name: 'old', presets: { mixed: old } });
  const newBundle = writeFixtureBundle(rootDir, { name: 'new', presets: { mixed: current } });
  const cli = `${root}/bin/axstack.js`;
  const args = (bundle) => ['install', '--bundle', bundle, '--preset', 'mixed', '--skills-dir', skillsDir, '--no-claude-settings', '--yes'];
  runCli(cli, args(oldBundle), { env: { HOME: home } });
  const rolesPath = join(skillsDir, 'axstack', 'roles.json');
  const before = readFileSync(rolesPath);
  expect(JSON.parse(before.toString()).roles).toHaveLength(old.length);
  expect(assessInstalledRoleSnapshot(before, 'mixed', current).gaps).toEqual([
    'missing selected bundle role: axstack-arena-candidate-grok',
  ]);
  const result = runCli(cli, args(newBundle), { env: { HOME: home } });
  expect(result.out).toContain('axstack/roles.json');
  expect(result.out).toContain('added role IDs: axstack-arena-candidate-grok');
  expect(JSON.parse(readFileSync(rolesPath, 'utf8')).roles).toHaveLength(current.length);
  expect(runCli(cli, args(newBundle), { env: { HOME: home } }).out).not.toContain('added role IDs:');
  writeFileSync(rolesPath, JSON.stringify({ version: 1, preset: 'mixed', roles: old }) + '\n');
  const preserved = runCli(cli, args(newBundle), { env: { HOME: home }, expectFail: true });
  expect(preserved.out).toContain('preserved user edits');
  expect(preserved.out).not.toContain('added role IDs:');
  expect(JSON.parse(readFileSync(rolesPath, 'utf8')).roles).toHaveLength(old.length);
});

test('an installation without the Opus judge reports its added ID', () => {
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
  expect(JSON.parse(before.toString()).roles).toHaveLength(old.length);
  expect(assessInstalledRoleSnapshot(before, 'mixed', current).gaps).toEqual([
    'missing selected bundle role: axstack-arena-judge-opus',
  ]);
  const result = runCli(`${root}/bin/axstack.js`, args(newBundle), { env: { HOME: rootDir } });
  expect(result.out).toContain('added role IDs: axstack-arena-judge-opus');
  expect(JSON.parse(readFileSync(rolesPath, 'utf8')).roles).toHaveLength(current.length);
  expect(runCli(`${root}/bin/axstack.js`, args(newBundle), { env: { HOME: rootDir } }).out).not.toContain('added role IDs:');
});

test('an installation without the UI verifier reports its added ID', () => {
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
  expect(JSON.parse(readFileSync(rolesPath, 'utf8')).roles).toHaveLength(old.length);
  const result = runCli(cli, args(newBundle), { env: { HOME: rootDir } });
  expect(result.out).toContain('added role IDs: axstack-ui-verifier');
  expect(JSON.parse(readFileSync(rolesPath, 'utf8')).roles).toHaveLength(current.length);
});

test('an installation without Sol pair seats reports their added IDs', () => {
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
    expect(installed.map(({ id }) => id)).toEqual(current.map(({ id }) => id));
  }
});

test('an installation without diligence reports its added ID', () => {
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
    expect(old).toHaveLength(current.length - 1);
    expect(result.out).toContain('added role IDs: axstack-diligence');
    expect(JSON.parse(readFileSync(join(skillsDir, 'axstack', 'roles.json'), 'utf8')).roles).toHaveLength(current.length);
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

test('installed presets expose the peer seat without changing authored routes', () => {
  for (const [preset, peer] of [
    ['mixed', { provider: 'claude', modelClass: 'opus', modeId: 'bypassPermissions', thinkingOptionId: 'medium' }],
    ['codex-only', { provider: 'codex', modelClass: 'luna', modeId: 'full-access', thinkingOptionId: 'xhigh' }],
    ['claude-only', { provider: 'claude', modelClass: 'sonnet', modeId: 'bypassPermissions', thinkingOptionId: 'high' }],
  ]) {
    const home = makeTempRoot('axstack-peer-install-');
    const skillsDir = join(home, 'installed');
    runCli(`${root}/bin/axstack.js`, [
      'install', '--bundle', root, '--preset', preset, '--skills-dir', skillsDir,
      '--no-claude-settings', '--yes',
    ], { env: { HOME: home } });
    const bytes = readFileSync(join(skillsDir, 'axstack', 'roles.json'));
    const { roles } = JSON.parse(bytes);
    expect(roles.find(({ id }) => id === 'axstack-reviewer-peer')).toMatchObject(peer);
    if (preset === 'mixed') {
      expect(roles.find(({ id }) => id === 'axstack-owner')).toMatchObject({
        provider: 'codex', modelClass: 'sol', modeId: 'full-access', thinkingOptionId: 'high',
      });
    }
    const bundled = JSON.parse(readFileSync(`${root}/profiles/presets/${preset}.json`)).roles;
    expect(assessInstalledRoleSnapshot(bytes, preset, bundled)).toEqual({ ready: true, gaps: [] });
  }
});
