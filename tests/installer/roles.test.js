import { expect, test } from 'bun:test';
import { assessInstalledRoleSnapshot, installedRoleBytes } from '../../src/roles.js';

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
