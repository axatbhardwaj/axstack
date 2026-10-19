import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const prose = (path) => read(path).replace(/\s+/g, ' ');

test('presets: Opus advises and Fable escalates with explicit absence', () => {
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const roles = JSON.parse(read(`profiles/presets/${preset}.json`)).roles;
    const byId = Object.fromEntries(roles.map((role) => [role.id, role]));
    expect(roles.map(({ id }) => id)).toEqual(JSON.parse(read('profiles/presets/mixed.json')).roles.map(({ id }) => id));
    expect(byId['axstack-advisor-fable']).toBeUndefined();
    expect(byId['axstack-arena-judge-fable']).toBeUndefined();
    if (preset !== 'claude-only') expect(byId['axstack-advisor-astra'].notes).toContain('question as Opus');
    for (const [id, model] of [
      ['axstack-advisor-opus', 'opus'],
      ['axstack-escalation-fable', 'fable'],
    ]) {
      expect((byId[id]?.modelClass ?? byId[id]?.model)).toBe(preset === 'codex-only' ? null : model);
      expect(byId[id]?.thinkingOptionId).toBe('xhigh');
    }
    expect(roles.filter(({ modelClass }) => modelClass === 'opus').every(({ thinkingOptionId }) => thinkingOptionId !== 'max')).toBe(true);
  }
});

test('workflow: escalation is bounded, fresh, and leaves prior holds intact', () => {
  const contracts = prose('skills/axstack/references/contracts.md');
  expect(contracts).toMatch(/high-stakes[^.]*axstack-advisor-astra[^.]*axstack-escalation-fable[^.]*plain AGREE/i);
  expect(contracts).toMatch(/two attempts[^.]*same named goal[^.]*acceptance check/i);
  const trigger = [/\bAstra\b/i, /\bOpus\b/i, /\bone reconciliation\b/i, /\bno safe discriminating check\b/i];
  checkRule(contracts, (text) => prohibits(text, /\bno safe discriminating check\b/i, ...trigger),
    'Escalation applies when Astra and Opus contradict after one reconciliation with no safe discriminating check.',
    [[/\bno safe discriminating check\b/i, 'a safe discriminating check'],
      ...trigger.map((concept) => [new RegExp(concept.source, 'gi'), 'other$&wise'])], trigger);
  const carveOut = [/\badvised hold or step-back\b/i, /\bnot high-stakes\b/i, /\bsplit\b.*\buser\b/i, /\bno reconciliation\b.*\bno Fable\b/i];
  const ban = /\b(?:not high-stakes|no reconciliation|no Fable)\b/gi;
  checkRule(contracts, (text) => prohibits(text, ban, ...carveOut),
    'At an advised hold or step-back that is not high-stakes, send the adviser split to the user with no reconciliation and no Fable.',
    [[ban, 'permit'],
      ...carveOut.map((concept) => [new RegExp(concept.source, 'gi'), 'other$&wise'])], carveOut);
  expect(contracts).toMatch(/stuck[^.]*two failed attempts/i);
  expect(contracts).toMatch(/setup slips[^.]*new user requirements[^.]*do not count/i);
  expect(contracts).toMatch(/fresh session[^.]*never reuses[^.]*adviser[^.]*candidate/i);
  expect(contracts).toMatch(/never resets[^.]*holds[^.]*attempt budgets/i);
  expect(prose('skills/axstack-debug/SKILL.md')).toMatch(/\| L2 \|[^|]*\| `axstack-advisor-astra` and `axstack-escalation-fable`[^|]*\|/i);
  expect(prose('skills/axstack-audit/references/record.md')).toMatch(/Decisions:.*escalation trigger.*evidence pointers.*outcome changed/i);
  expect(prose('skills/axstack-align/SKILL.md')).toContain('`axstack-advisor-opus`');
  expect(prose('skills/axstack-spec/SKILL.md')).toContain('`axstack-advisor-opus`');
});
