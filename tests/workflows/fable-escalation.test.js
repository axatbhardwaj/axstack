import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const prose = (path) => read(path).replace(/\s+/g, ' ');

test('presets: Opus advises and Fable escalates with explicit absence', () => {
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const roles = JSON.parse(read(`profiles/presets/${preset}.json`)).roles;
    const byId = Object.fromEntries(roles.map((role) => [role.id, role]));
    expect(roles).toHaveLength(27);
    expect(byId['axstack-advisor-fable']).toBeUndefined();
    expect(byId['axstack-arena-judge-fable']).toBeUndefined();
    for (const [id, model] of [
      ['axstack-advisor-opus', 'claude-opus-5-5'],
      ['axstack-escalation-fable', 'claude-fable-5-1'],
    ]) {
      expect(byId[id]?.model).toBe(preset === 'codex-only' ? null : model);
      expect(byId[id]?.thinkingOptionId).toBe('xhigh');
    }
    expect(roles.filter(({ model }) => model === 'claude-opus-5-5').every(({ thinkingOptionId }) => thinkingOptionId !== 'max')).toBe(true);
  }
});

test('workflow: escalation is bounded, fresh, and leaves prior holds intact', () => {
  const contracts = prose('skills/axstack/references/contracts.md');
  expect(contracts).toMatch(/high-stakes[^.]*axstack-advisor-astra[^.]*axstack-escalation-fable[^.]*plain AGREE/i);
  expect(contracts).toMatch(/two attempts[^.]*same named goal[^.]*acceptance check/i);
  expect(contracts).toMatch(/Astra[^.]*Opus[^.]*one reconciliation[^.]*no safe discriminating check/i);
  expect(contracts).toMatch(/stuck[^.]*two failed attempts/i);
  expect(contracts).toMatch(/setup slips[^.]*new user requirements[^.]*do not count/i);
  expect(contracts).toMatch(/fresh session[^.]*never reuses[^.]*adviser[^.]*candidate/i);
  expect(contracts).toMatch(/never resets[^.]*holds[^.]*attempt budgets/i);
  expect(prose('skills/axstack-debug/SKILL.md')).toMatch(/\| L2 \|[^|]*\| `axstack-escalation-fable`[^|]*\|/i);
  expect(prose('skills/axstack-audit/references/record.md')).toMatch(/Decisions:.*escalation trigger.*evidence pointers.*outcome changed/i);
  expect(prose('skills/axstack-align/SKILL.md')).toContain('`axstack-advisor-opus`');
  expect(prose('skills/axstack-spec/SKILL.md')).toContain('`axstack-advisor-opus`');
});
