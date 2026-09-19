import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
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
    role('axstack-author', 'gpt-5.6-sol'),
    role('axstack-reviewer-primary', 'gpt-5.6-sol'),
    role('axstack-reviewer-secondary', 'claude-opus-5'),
    role('axstack-checker', null),
  ];
  const installed = installedRoleBytes('mixed', [role('axstack-checker', null)]);

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
    { ...role('axstack-advisor-fable', null), thinkingOptionId: 'high' },
    role('axstack-author', 'gpt-5.6-sol'),
    role('axstack-reviewer-primary', 'gpt-5.6-sol'),
    { ...role('axstack-reviewer-secondary', 'gpt-5.6-terra'), thinkingOptionId: 'xhigh' },
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

test('claude-only readiness permits the unavailable Astra slot', () => {
  const roles = [
    { ...role('axstack-advisor-astra', null), provider: 'claude', thinkingOptionId: 'high' },
    { ...role('axstack-advisor-fable', 'claude-fable-5-1'), provider: 'claude', thinkingOptionId: 'high' },
    { ...role('axstack-author', 'claude-opus-5'), provider: 'claude' },
    { ...role('axstack-reviewer-primary', 'claude-opus-5'), provider: 'claude' },
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
    { ...role('axstack-advisor-fable', null), thinkingOptionId: 'high' },
    role('axstack-author', 'gpt-5.6-sol'),
    role('axstack-reviewer-primary', 'gpt-5.6-sol'),
    { ...role('axstack-reviewer-secondary', 'gpt-5.6-terra'), thinkingOptionId: 'xhigh' },
    { ...role('axstack-arena-judge-astra', 'gpt-6-astra'), thinkingOptionId: 'xhigh' },
    { ...role('axstack-arena-judge-fable', null), thinkingOptionId: 'xhigh' },
  ];
  expect(assessRoleReadiness(codex, 'codex-only')).toEqual({ ready: true, gaps: [] });
  codex.find(({ id }) => id === 'axstack-arena-judge-astra').model = null;
  expect(assessRoleReadiness(codex, 'codex-only').gaps).toEqual([
    'axstack-arena-judge-astra requires a configured model',
  ]);

  const mixed = [
    { ...role('axstack-advisor-astra', 'gpt-6-astra'), thinkingOptionId: 'high' },
    { ...role('axstack-advisor-fable', 'claude-fable-5-1'), provider: 'claude', thinkingOptionId: 'high' },
    role('axstack-author', 'gpt-5.6-sol'),
    role('axstack-reviewer-primary', 'gpt-5.6-sol'),
    { ...role('axstack-reviewer-secondary', 'claude-opus-5'), provider: 'claude', thinkingOptionId: 'medium' },
    { ...role('axstack-arena-judge-fable', null), provider: 'claude', thinkingOptionId: 'xhigh' },
  ];
  expect(assessRoleReadiness(mixed, 'mixed').gaps).toEqual([
    'axstack-arena-judge-fable requires a configured model',
  ]);
});

test('readiness rejects a null model on a non-intentional row such as an investigator seat', () => {
  const roles = [
    { ...role('axstack-advisor-astra', 'gpt-6-astra'), thinkingOptionId: 'high' },
    { ...role('axstack-advisor-fable', null), thinkingOptionId: 'high' },
    role('axstack-author', 'gpt-5.6-sol'),
    role('axstack-reviewer-primary', 'gpt-5.6-sol'),
    { ...role('axstack-reviewer-secondary', 'gpt-5.6-terra'), thinkingOptionId: 'xhigh' },
    role('axstack-debug-investigator-1', null),
  ];
  expect(assessRoleReadiness(roles, 'codex-only').gaps).toEqual([
    'axstack-debug-investigator-1 requires a configured model',
  ]);
});
