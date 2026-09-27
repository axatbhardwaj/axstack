import { expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli, writeFixtureBundle } from './helpers.js';
import {
  assessInstalledRoleSnapshot,
  assessRoleReadiness,
  installedRoleBytes,
} from '../../src/roles.js';

const role = (id, model = 'model') => ({
  id,
  name: id,
  provider: 'codex',
  model,
});

const root = import.meta.dir.slice(0, -'/tests/installer'.length);

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

test('a pristine 24-row installation upgrades to 26 and exposes both added IDs', () => {
  const rootDir = makeTempRoot('axstack-role-upgrade-');
  const home = rootDir;
  const skillsDir = join(rootDir, 'installed');
  const current = JSON.parse(readFileSync(`${root}/profiles/presets/mixed.json`, 'utf8')).roles.filter(({ id }) => id !== 'axstack-arena-judge-opus');
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
  const current = JSON.parse(readFileSync(`${root}/profiles/presets/mixed.json`, 'utf8')).roles;
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
    expect(installed).toHaveLength(27);
    expect(installed.map(({ id }) => id)).toEqual(current.map(({ id }) => id));
    const again = runCli(cli, args(newBundle), { env: { HOME: rootDir } });
    expect(again.out).not.toContain('added role IDs:');
    expect(again.out).not.toContain('removed role IDs:');
  }
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
      ...role('axstack-reviewer-secondary', 'claude-sonnet-5'),
      provider: 'claude', thinkingOptionId: 'xhigh',
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
