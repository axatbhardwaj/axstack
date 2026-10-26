import { expect, test } from 'bun:test';
import { assertBundleRoles, assessRoleReadiness, deriveModelClass } from '../../../src/roles.js';

const role = (id, model = 'model') => ({
  id,
  name: id,
  provider: 'codex',
  model,
});


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

