import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

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
  expect(routing).toMatch(/Optional-seat absence[^.]*follow \[Role roster\]\(role-roster\.md\)/i);
  expect(routing).toMatch(/required seats[^.]*model: null[^.]*hold without substitution/i);
  expect(routing).toMatch(/intentional single-provider `model: null` absences/i);
  for (const prose of [contracts, routing]) expect(prose).not.toContain('absent (<reason>)');
  expect(routing).toContain('Codex `--retry-of`');
  expect(routing).toContain('pre-turn Codex rejection');
  for (const prose of [contracts, routing]) {
    expect(prose).toMatch(/base auditor[^.]*preflight rejection[^.]*Close-out/i);
  }
});

test('research and arena continue after optional dropout, with required seats held', () => {
  const research = read('skills/axstack-research/SKILL.md');
  const align = read('skills/axstack-align/SKILL.md');
  expect(research).toMatch(/optional[^.]*absent[^.]*continue/i);
  expect(research).toMatch(/Required branches hold their affected work/i);
  expect(align).toMatch(/optional[^.]*candidate[^.]*absent[^.]*continue/i);
  expect(align).toMatch(/required adviser, candidate, or judge[^.]*holds/i);
  expect(align).toMatch(/adviser[^.]*unavailable[^.]*hold/i);
  for (const prose of [research, align]) {
    expect(prose).toMatch(/launch failure[^.]*trust\/login prompt[^.]*prompt block/i);
  }
});

test('unlaunchable base auditor archives UNKNOWN with route and error', () => {
  const lifecycle = read('skills/axstack/references/lifecycle.md');
  const audit = read('skills/axstack-audit/SKILL.md');
  for (const prose of [lifecycle, audit]) {
    expect(prose).toMatch(/auditor: UNKNOWN \(unlaunchable\)/i);
    expect(prose).toMatch(/attempted route[^.]*error[^.]*archive/i);
    expect(prose).toMatch(/launched[^.]*Dispatch[^.]*settle/i);
    expect(prose).toMatch(/no substitution/i);
  }
});
