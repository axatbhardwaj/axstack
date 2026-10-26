import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8').replace(/\s+/g, ' ');
const optional = [
  'axstack-arena-candidate-grok',
  'axstack-research-x', 'axstack-checker',
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
  const loss = data.cases.find(({ id }) => id === 'mixed-provider-loss');
  expect(loss.expected.reason).toMatch(/fewer than two (?:different )?providers/i);
});

test('optional seats are enumerated and absent only after a recorded failure', () => {
  const roster = read('skills/axstack/references/role-roster.md');
  const listed = roster.match(/Optional seats:([^.]+)\./i)?.[1];
  expect(listed).toBeDefined();
  for (const id of optional) expect(listed).toContain(`\`${id}\``);
  expect(roster).toMatch(/dispatch optional seats when configured and available/i);
  expect(roster).toMatch(/launch failure[^.]*trust\/login prompt[^.]*prompt block/i);
  expect(roster).toMatch(/fence[^.]*absent \(<reason>\)[^.]*next read-back[^.]*skip[^.]*without a relay/i);
  expect(roster).toMatch(/mixed[^.]*Codex[^.]*Claude/i);
});

test('research sizing overrides optional dispatch without treating unneeded branches as outages', () => {
  const text = sentences(read('skills/axstack/references/role-roster.md')).join('. ');
  const sizing = [/always dispatch optional seats/i, /configured and available/i,
    /except research branches/i, /Research step 2/i, /sizing/i];
  checkRule(text, (source) => sentences(source).some((sentence) =>
    sizing.every((concept) => concept.test(sentence))
    && requires(sentence.replace(/optional seats/gi, 'seats'), /^/)),
  'When configured and available, always dispatch optional seats except research branches, which follow Research step 2 sizing.',
  [[/except research branches/i, 'including research branches']], sizing);

  const status = [/research branch/i, /unneeded|unnecessary/i, /open claim/i,
    /recorded/i, /not needed \(<reason>\)/i, /never as absent or a malfunction/i];
  const accepts = (source) => sentences(source).some((sentence) =>
    status.every((concept) => concept.test(sentence))
    && requires(sentence.replace(/not needed \(<reason>\)/gi, 'reason label')
      .replace(/never as absent or a malfunction/gi, ''), /^/));
  checkRule(text, accepts,
    'An unnecessary research branch for an open claim is recorded `not needed (<reason>)`, never as absent or a malfunction.',
    [[/never as absent or a malfunction/i, 'always as absent or a malfunction']], status);
});

for (const path of ['skills/axstack/references/role-roster.md', 'skills/axstack-research/SKILL.md']) {
  test(`research independence allows two providers while preserving other mixed minima: ${path}`, () => {
    const text = sentences(read(path)).join('. ');
    const sized = [/sized/i, /mixed/i, /research fan-out/i, /requires|must retain/i,
      /dispatched branches/i, /at least two/i, /different providers/i];
    checkRule(text, (source) => requires(source, ...sized),
      'A sized research fan-out in mixed must retain dispatched branches from at least two different providers.',
      [[/at least two/i, 'at least one'], [/different providers/i, 'the same provider'],
        [/requires|must retain/i, 'may retain']], sized);
    const other = [/every other|all other/i, /mixed fan-out/i, /arena/i, /peer review/i,
      /retains|must retain/i, /at least one/i, /Codex/i, /Claude/i];
    checkRule(text, (source) => requires(source, ...other),
      'All other mixed fan-outs, including peer review and arena, must retain at least one Claude and one Codex seat.',
      [[/every other|all other/i, 'research'], [/retains|must retain/i, 'may retain']], other);
  });
  for (const minimum of [/sized mixed research fan-out/i, /every other mixed fan-out/i]) {
    test(`provider loss holds its own fan-out: ${path} ${minimum}`, () => {
      // Keep each semicolon-linked consequence with its own minimum.
      const policy = read(path).split(/[.!?]\s+/).find((clause) => minimum.test(clause));
      expect(policy).toBeDefined();
      const holds = (clause) => requires(clause.split(';')[1] ?? '',
        /otherwise|else/i, /hold|block/i, /fan-out/i);
      expect(holds(policy)).toBe(true);
      expect(holds(policy.replace(/;[^;]+$/, ''))).toBe(false);
      expect(holds(policy.replace(/\b(?:hold|block)\b/i, 'continue with available branches'))).toBe(false);
      expect(holds(policy.replace(/\b(hold|block)\b/i, 'do not $1'))).toBe(false);
      expect(holds(policy.replace(/(?:otherwise|else)[^;]+$/i, 'else block the affected fan-out'))).toBe(true);
    });
  }
}

test('Scout roster keeps the required seats per facet in each preset', () => {
  const roster = readFileSync(`${root}/skills/axstack/references/role-roster.md`, 'utf8');
  const bullet = roster.split(/\n(?=- )/).find((part) => part.includes('`axstack-explore-codebase-luna`'));
  expect(bullet).toBeDefined();
  const text = sentences(bullet).join('. ');
  const direction = /\b(?:requires|must)\b/i;
  const paired = [/Scout/i, /`axstack-explore-codebase`/, /`axstack-explore-codebase-luna`/,
    /per facet|each facet/i, /mixed/i, /codex-only/i, direction];
  checkRule(text, (source) => requires(source, ...paired),
    'For Scout, mixed and codex-only must use `axstack-explore-codebase` and `axstack-explore-codebase-luna` for each facet.',
    [[direction, 'may']], paired);
  const claude = [/claude-only/i, /Haiku high/i, /base seat/i, /per facet|each facet/i, direction];
  checkRule(text, (source) => requires(source, ...claude),
    'In claude-only, the Haiku high base seat must be used for each facet.',
    [[direction, 'may']], claude);
});

test('shared rules qualify only optional seats and preserve required holds', () => {
  const contracts = read('skills/axstack/references/contracts.md');
  const routing = read('skills/axstack/references/routing.md');
  expect(contracts).toMatch(/Optional seats follow \[Role roster\]\(role-roster\.md\)/i);
  expect(contracts).toMatch(/required seats[^.]*model: null[^.]*hold without substitution/i);
  expect(routing).toMatch(/\[Model discipline\]\(contracts\.md#model-discipline\) governs optional seats[^.]*auditor preflight[^.]*required holds/i);
  expect(routing).toMatch(/\[Role roster\]\(role-roster\.md\) governs[^.]*single-provider absence[^.]*mixed Codex\+Claude fan-out/i);
  const researchMinimum = [/Role roster/i, /governs/i, /mixed research/i, /at least two/i, /different providers/i];
  checkRule(sentences(routing).join('. '), (source) => requires(source, ...researchMinimum),
    'Role roster governs mixed research with at least two different providers.',
    [[/at least two/i, 'at least one'], [/different providers/i, 'the same provider']], researchMinimum);
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
