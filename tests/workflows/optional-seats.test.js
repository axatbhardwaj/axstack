import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8').replace(/\s+/g, ' ');
const optional = [
  'axstack-arena-candidate-grok', 'axstack-arena-candidate-antigravity',
  'axstack-research-web-google', 'axstack-research-x', 'axstack-checker',
  'axstack-research-code-sol', 'axstack-explore-execution-sol', 'axstack-auditor-sol',
];

test('scenario corpus distinguishes optional absence from required and launched holds', () => {
  const data = JSON.parse(readFileSync(`${root}/tests/workflows/optional-seat-scenarios.json`, 'utf8'));
  expect(data.note).toMatch(/not live dispatch evidence/i);
  expect(data.cases.map(({ id }) => id)).toEqual([
    'optional-present', 'optional-absent', 'mixed-provider-loss',
    'required-adviser-outage', 'required-fable-outage', 'model-null-required',
    'auditor-unlaunchable', 'auditor-launched',
  ]);
});

test('optional seats are enumerated and absent only after a recorded failure', () => {
  const roster = read('skills/axstack/references/role-roster.md');
  for (const id of optional) expect(roster).toContain(`\`${id}\``);
  expect(roster).toMatch(/dispatch optional seats when configured and available/i);
  expect(roster).toMatch(/launch failure[^.]*trust\/login prompt[^.]*prompt block/i);
  expect(roster).toMatch(/fence[^.]*absent \(<reason>\)[^.]*next read-back[^.]*skip[^.]*without a relay/i);
  expect(roster).toMatch(/mixed[^.]*Codex[^.]*Claude/i);
});

test('shared rules qualify only optional seats and preserve required holds', () => {
  const contracts = read('skills/axstack/references/contracts.md');
  const routing = read('skills/axstack/references/routing.md');
  expect(contracts).toMatch(/Optional seats follow \[Role roster\]\(role-roster\.md\)/i);
  expect(contracts).toMatch(/required seats[^.]*model: null[^.]*hold without substitution/i);
  expect(routing).toMatch(/\[Model discipline\]\(contracts\.md#model-discipline\) governs optional seats[^.]*auditor preflight[^.]*required holds/i);
  expect(routing).toMatch(/\[Role roster\]\(role-roster\.md\) governs[^.]*single-provider absence[^.]*mixed Codex\+Claude fan-out/i);
  for (const prose of [contracts, routing]) expect(prose).not.toContain('absent (<reason>)');
  expect(routing).not.toMatch(/--retry-of|pre-turn Codex rejection/);
  expect(routing).toContain('holds that role with no substitution');
  expect(contracts).toMatch(/base auditor[^.]*preflight rejection[^.]*Close-out/i);
});

test('research and arena continue after optional dropout, with required seats held', () => {
  const research = read('skills/axstack-research/SKILL.md');
  const align = read('skills/axstack-align/SKILL.md');
  const arena = read('skills/axstack-brainstorm/references/arena.md');
  expect(research).toMatch(/optional[^.]*absent[^.]*continue/i);
  expect(research).toMatch(/Required branches hold their affected work/i);
  expect(arena).toMatch(/optional[^.]*candidate[^.]*absent[^.]*continue/i);
  expect(arena).toMatch(/required adviser, candidate, or judge[^.]*holds/i);
  expect(align).toMatch(/adviser[^.]*unavailable[^.]*hold/i);
  for (const prose of [research, arena]) {
    expect(prose).toMatch(/launch failure[^.]*trust\/login prompt[^.]*prompt block/i);
  }
});

test('unlaunchable base auditor archives UNKNOWN with route and error', () => {
  const lifecycle = read('skills/axstack/references/lifecycle.md');
  const audit = read('skills/axstack-audit/SKILL.md');
  for (const prose of [lifecycle, audit]) {
    expect(prose).toMatch(/auditor: UNKNOWN \(unlaunchable\)/i);
    expect(prose).toMatch(/attempted route[^.]*error[^.]*archive/i);
    expect(prose).toMatch(/launched[^.]*(?:Dispatch|task)[^.]*settle/i);
    expect(prose).toMatch(/no substitution/i);
  }
});

test('runtime holds preserve intentional absences and shared optional-seat exceptions', () => {
  const runtime = read('skills/axstack/references/t3-runtime.md');
  expect(runtime).toContain('An unavailable provider, model, role, mode or effort must hold that role with no substitution.');
  expect(runtime).toContain('Intentional absent seats remain recorded absences; availability is runtime proof.');
  expect(read('skills/axstack/references/routing.md')).toMatch(/\[Model discipline\]\(contracts\.md#model-discipline\) governs optional seats[^.]*auditor preflight[^.]*required holds/i);
});

// Catalog binding for null roles is exercised in resolve-models.test.js
// (model:null without class); intentional-absence policy stays checked below.
test('Codex and Claude missing model and class explicitly hold as intentional absences', () => {
  const concepts = [/Codex/i, /Claude/i, /neither|missing|lacking/i, /model/i, /class/i, /intentional/i, /absen/i, /hold/i];
  for (const path of ['t3-runtime.md', 'routing.md']) {
    const text = read(`skills/axstack/references/${path}`);
    const matches = sentences(text).filter((sentence) => requires(sentence, ...concepts));
    expect(matches, path).toHaveLength(1);
    expect(requires(sentences(text).filter((sentence) => !matches.includes(sentence)).join('. '), ...concepts)).toBe(false);
    expect(requires(`Do not ${matches[0]}`, ...concepts)).toBe(false);
  }
  for (const text of [
    'A role for Claude or Codex missing both class and model holds as an intentional absence.',
    'Hold an intentional absent Codex or Claude seat with neither class nor model.',
  ]) expect(requires(text, ...concepts)).toBe(true);
});
