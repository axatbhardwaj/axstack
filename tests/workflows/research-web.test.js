import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { assessRoleReadiness } from '../../src/roles.js';
import { configuration, setup } from './dispatch-plan/fixtures.js';
import { checkRule, requires, sentences } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const preset = (name) => JSON.parse(read(`profiles/presets/${name}.json`));

test('mixed web pair resolves and reads back Terra high; single-provider absence stays in bounds', () => {
  const id = 'axstack-research-web-sol';
  for (const name of ['mixed', 'codex-only', 'claude-only']) {
    const data = preset(name);
    const role = data.roles.find((role) => role.id === id);
    expect(role, name).toBeDefined();
    expect(assessRoleReadiness(data.roles, name)).toEqual({ ready: true, gaps: [] });
    const f = setup(); f.roles.roles = [role];
    f.capabilities.providers[0].models.push({ id: 'gpt-6.1-terra', options: [
      { id: 'reasoningEffort', options: [{ id: 'high' }] },
    ] });
    if (name === 'mixed') {
      expect(role).toMatchObject({ provider: 'codex', modelClass: 'terra', thinkingOptionId: 'high' });
      const result = f.run(id, 'task');
      expect(result.status).toBe(0);
      expect(JSON.parse(result.output).target).toEqual({ providerInstanceId: 'codex', model: 'gpt-6.1-terra',
        options: [{ id: 'reasoningEffort', value: 'high' }] });
      const effective = configuration(); effective.modelSelection.model = 'gpt-6.1-terra';
      expect(f.run(id, 'task', effective).status).toBe(0);
    } else {
      expect(role.provider).toBe(name === 'codex-only' ? 'codex' : 'claude');
      expect(role.model).toBeNull();
      expect(role.modelClass).toBeUndefined();
      expect(role.notes).toMatch(/intentional single-provider absence/i);
      expect(f.run(id, 'task').status).toBe(2);
    }
  }
});

test('needed web research uses an independent pair under the existing optional-seat policy', () => {
  const text = read('skills/axstack-research/SKILL.md').replace(/\s+/g, ' ');
  const concepts = [/web pair/i, /axstack-research-web`/, /axstack-research-web-sol/, /Terra high/i, /mixed/i];
  checkRule(sentences(text).join('. '), (source) => requires(source, ...concepts),
    'In mixed the web pair is `axstack-research-web` plus `axstack-research-web-sol` (Terra high).',
    [[/Terra high/i, 'Terra medium']], concepts);
  const paired = text.split('When dispatching ')[1]?.split('3. **Gather')[0];
  expect(paired).toContain('axstack-research-web');
  expect(paired).toMatch(/independently[^.]*same bounded brief[^.]*without cross-reading/i);
  expect(paired).toMatch(/optional[^.]*launch failure[^.]*trust\/login prompt[^.]*prompt block/i);
  expect(paired).toMatch(/two different providers[^.]*otherwise hold/i);
  const roster = read('skills/axstack/references/role-roster.md');
  const optional = roster.split('Optional seats:')[1]?.split('Always dispatch')[0];
  expect(optional).toContain('axstack-research-web-sol');
});
