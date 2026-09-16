import { expect, test } from 'bun:test';
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
