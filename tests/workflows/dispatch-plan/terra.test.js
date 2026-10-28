import { expect, test } from 'bun:test';
import { configuration, setup } from './fixtures.js';

test('Terra dispatches require high and verify effective high for tasks and launches', () => {
  const f = setup();
  f.capabilities.providers[0].models.push({ id: 'gpt-6.1-terra', options: [
    { id: 'reasoningEffort', options: ['medium', 'high', 'xhigh'].map((id) => ({ id })) },
  ] });
  f.roles.roles[0] = { ...f.roles.roles[0], model: 'gpt-6.1-terra', modelClass: 'terra' };
  for (const kind of ['task', 'launch']) {
    for (const effort of ['medium', 'xhigh']) {
      f.roles.roles[0].thinkingOptionId = effort;
      const held = f.run('axstack-author', kind);
      expect(held.status).toBe(2);
      expect(held.output).toBe('');
      expect(held.error).toMatch(/Terra.*high/i);
    }
    f.roles.roles[0].thinkingOptionId = 'high';
    const valid = f.run('axstack-author', kind);
    expect(valid.status).toBe(0);
    const payload = JSON.parse(valid.output);
    expect((payload.target ?? payload.modelSelection).options).toEqual([{ id: 'reasoningEffort', value: 'high' }]);
    const effective = configuration(); effective.modelSelection.model = 'gpt-6.1-terra';
    expect(f.run('axstack-author', kind, effective).status).toBe(0);
    effective.modelSelection.options[0].value = 'xhigh';
    const mismatch = f.run('axstack-author', kind, effective);
    expect(mismatch.status).toBe(2);
    expect(mismatch.output).toContain('options: fail');
  }
  f.capabilities.providers[0].models.at(-1).options[0].options = [{ id: 'xhigh' }];
  const unavailable = f.run('axstack-author', 'task');
  expect(unavailable.status).toBe(2);
  expect(unavailable.output).toBe('');
  expect(unavailable.error).toMatch(/unsupported effort high/i);
});
