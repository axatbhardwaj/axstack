import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { prohibits, requires } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => existsSync(`${root}/${path}`) ? readFileSync(`${root}/${path}`, 'utf8') : '';
const clausesOf = (text) => text
  .split(/\n\s*\n|\n(?=\s*(?:[-*]|\d+\.)\s)/)
  .flatMap((block) => block
    .replace(/^\s*\d+\.\s+\*\*.*\*\*\n/, '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?;])\s+/))
  .map((clause) => clause.trim()).filter(Boolean);
const loop = () => read('skills/axstack/references/perf-loop.md');
const phase = (name) => () => read(`skills/axstack-${name}/SKILL.md`);
const debug = phase('debug'), improve = phase('improve'), implement = phase('implement');
const link = '[Performance loop](../axstack/references/perf-loop.md)';

// Independent instruction contracts; existing checklist tests vet numbers,
// not the bounded experiment loop or the phase-specific action boundaries.
// Each row supplies concepts, a directional inversion, and equivalent wording.
const rules = [
  ...[debug, improve, implement].map((source, index) => [
    `${['debug', 'improve', 'implement'][index]} conditional load`, source,
    [/only/i, /performance work/i, /load|read|consult/i, /Performance loop/i],
    [/only/gi, 'also outside'], `Only for performance work, consult ${link}.`,
  ]),
  ['regression preparation', debug, [/regression/i, /freeze|pin/i, /workload/i, /command/i, /environment/i, /baseline/i],
    [/freeze|pin/gi, 'vary'], 'For a performance regression, pin the workload, command and environment before capturing the baseline.'],
  ['regression hypotheses', debug, [/regression/i, /rank|order/i, /hypotheses/i, /mantra order/i],
    [/mantra order/gi, 'arbitrary order'], 'For a performance regression, order the hypotheses in mantra order.'],
  ['regression handoff', debug, [/regression/i, /hand off|transfer/i, /axstack-implement/i, /real/i, /red.to.green/i, /evidence/i],
    [/red.to.green/gi, 'green-only'], 'For a performance regression, transfer the repair to axstack-implement with its real red-to-green evidence.'],
  ['debug commit boundary', debug, [/performance work/i, /committing/i],
    [/without committing/gi, 'after committing'], 'For performance work, hand off without committing.', /without committing/i],
  ['discovery boundary', improve, [/performance work/i, /report.only/i],
    [/report.only/gi, 'source-editing'], 'For performance work, discovery stays report-only.'],
  ['discovery ranking', improve, [/performance work/i, /rank|order/i, /candidates/i, /mantra order/i],
    [/mantra order/gi, 'arbitrary order'], 'For performance work, order candidates in mantra order.'],
  ['implementation loop', implement, [/performance work/i, /run|execute/i, /change loop/i, /defined|described/i, /Performance loop/i],
    [/run|execute/gi, 'skip'], `For performance work, execute the change loop described in ${link}.`],
  ['optimization route', implement, [/accepted/i, /optimization scope/i, /explicitly (?:marked|tagged)/i, /without new behavior/i, /structure.preserving/i, /same checks/i, /green/i, /before and after/i, /measured delta/i],
    [/explicitly (?:marked|tagged)/gi, 'author-inferred'], 'For an accepted optimization scope without new behavior explicitly tagged structure-preserving, use the structure-preserving path with the same checks green before and after plus the measured delta.'],
  ['new behavior route', implement, [/performance work/i, /new behavior/i, /failing check/i, /first|before/i],
    [/first|before/gi, 'afterward'], 'For performance work that adds new behavior, run a failing check first.'],
  ['unmarked optimization route', implement, [/optimization/i, /not explicitly (?:marked|tagged) structure.preserving/i, /normal behavior path/i, /real/i, /red.to.green/i],
    [/normal behavior path/gi, 'structure-preserving path'], 'For an optimization not explicitly tagged structure-preserving, follow the normal behavior path with real red-to-green evidence.', /not explicitly (?:marked|tagged) structure.preserving/i],
  ['change loop definition', loop, [/change loop/i, /\b(?:is|means)\b/i, /ordered steps/i, /(?:in|from) this reference/i, /run|execute/i, /axstack-implement/i],
    [/ordered steps/gi, 'unordered suggestions'], 'The change loop means the ordered steps from this reference, executed by axstack-implement.'],
  ['one writer', loop, [/keep|retain/i, /one writer/i, /per candidate/i],
    [/one writer/gi, 'parallel writers'], 'Retain one writer per candidate.'],
  ['change phase boundary', loop, [/change steps/i, /revert/i, /commit/i, /implement receipt/i, /only/i, /axstack-implement/i],
    [/only/gi, 'also outside'], 'Run the change steps (revert, commit and implement receipt) only in axstack-implement.'],
  ['freeze', loop, [/freeze|pin/i, /workload/i, /command/i, /environment/i, /before/i, /baseline/i],
    [/freeze|pin/gi, 'vary'], 'Pin the workload, command and environment before the baseline.'],
  ['sensitivity', loop, [/prove|demonstrate/i, /harness/i, /detect/i, /change/i],
    [/detect/gi, 'ignore'], 'Demonstrate that the harness can detect a change.'],
  ['insensitive harness', loop, [/hold|pause/i, /loop/i, /harness/i, /cannot detect/i, /change/i],
    [/hold|pause/gi, 'continue'], 'If the harness cannot detect a change, pause the loop.', /cannot detect/i],
  ['baseline', loop, [/^(?:capture|record)\b/i, /baseline/i],
    [/capture|record/gi, 'skip'], 'Record the baseline.'],
  ['number vetting', loop, [/vet|check/i, /every|each/i, /number/i, /Performance checklist/i],
    [/every|each/gi, 'one selected'], 'Check each number with [Performance checklist](performance-checklist.md).'],
  ['acceptance checks', loop, [/set|record/i, /target/i, /noise criterion/i, /finite attempt budget/i, /acceptance checks/i],
    [/finite attempt budget/gi, 'unlimited attempts'], 'Record a target, a noise criterion and a finite attempt budget as acceptance checks in the owning phase.'],
  ['mantras', loop, [/try|use/i, /mantras/i, /in (?:this )?order/i, /cheapest first/i],
    [/cheapest first/gi, 'most expensive first'], 'Use these mantras in order, cheapest first:'],
  ['early win', loop, [/stop/i, /earlier mantra/i, /meets|reaches/i, /target/i],
    [/stop/gi, 'continue'], 'When an earlier mantra reaches the target, stop.'],
  ['single change', loop, [/verify|check/i, /one change at a time/i],
    [/one change at a time/gi, 'several changes together'], 'Check one change at a time.'],
  ['correctness', loop, [/keep|retain/i, /unchanged correctness checks/i, /green/i],
    [/green/gi, 'red'], 'Retain unchanged correctness checks green.'],
  ['noise gate', loop, [/keep|retain/i, /change/i, /only when/i, /gain/i, /exceeds/i, /noise criterion/i],
    [/exceeds/gi, 'falls below'], 'Retain a change only when its gain exceeds the noise criterion.'],
  ['revert rejection', loop, [/revert|undo/i, /rejected experiment/i, /before/i, /next/i],
    [/before/gi, 'after'], 'Undo a rejected experiment before the next one.'],
  ['record rejection', loop, [/record|report/i, /rejected experiment/i, /number/i, /run record/i, /implement receipt/i],
    [/record|report/gi, 'omit'], 'Report each rejected experiment with its number in the run record and implement receipt.'],
  ['commit win', loop, [/one commit/i, /per|for each/i, /accepted win/i],
    [/one commit/gi, 'one shared commit'], 'Use one commit for each accepted win.'],
  ['changed harness', loop, [/changed harness/i, /invalidates|voids/i, /earlier comparisons/i],
    [/invalidates|voids/gi, 'preserves'], 'A changed harness voids earlier comparisons.'],
  ['stop', loop, [/stop/i, /target/i, /budget/i, /spent|exhausted/i],
    [/stop/gi, 'continue'], 'Stop at the target or when the budget is exhausted.'],
  ['report', loop, [/report|record/i, /baseline/i, /post.change number/i, /delta/i, /artifact path/i, /run record/i, /implement receipt/i],
    [/post.change number/gi, 'estimate'], 'Record the baseline, post-change number, delta and artifact path in the run record and implement receipt.'],
  ['unmet target', loop, [/report|state/i, /unmet target/i, /as unmet/i],
    [/as unmet/gi, 'as met'], 'State an unmet target as unmet.'],
];

const accepts = (row) => (text) => clausesOf(text).some((clause) => row[5]
  ? prohibits(clause, row[5], ...row[2]) : requires(clause, ...row[2]));

for (const row of rules) {
  const [name, source, concepts, [direction, inverse], rewording] = row;
  test(`performance loop: ${name}`, () => {
    const clauses = clausesOf(source());
    const check = accepts(row);
    const matches = clauses.filter(check);
    expect(matches, 'missing or ambiguous required instruction').toHaveLength(1);
    const substitute = (replacement) => clauses.map((clause) => clause === matches[0] ? replacement : clause).join('\n\n');
    expect(check(substitute('')), 'removal').toBe(false);
    for (const concept of concepts) {
      expect(check(substitute(matches[0].replace(new RegExp(concept.source, 'gi'), ''))), 'qualifier removal').toBe(false);
    }
    expect(matches[0]).toMatch(direction);
    expect(check(substitute(matches[0].replace(direction, inverse))), 'inversion').toBe(false);
    const rewritten = substitute(rewording);
    for (const sibling of rules.filter((item) => item[1] === source)) expect(accepts(sibling)(rewritten), sibling[0]).toBe(true);
    expect(rewording).toMatch(direction);
    expect(check(substitute(rewording.replace(direction, inverse))), 'reworded inversion').toBe(false);
  });
}

for (const name of ['implement conditional load', 'noise gate']) {
  test(`performance loop: rewrapped ${name} retains its meaning`, () => {
    const row = rules.find((item) => item[0] === name);
    const source = row[1]();
    const clause = clausesOf(source).find(accepts(row));
    expect(clause).toBeDefined();
    const split = clause.indexOf(' ', Math.floor(clause.length / 2));
    expect(split).toBeGreaterThan(0);
    const wrapped = source.replace(clause, `${clause.slice(0, split)}\n  ${clause.slice(split + 1)}`);
    expect(accepts(row)(wrapped), name).toBe(true);
  });
}

test('performance loop: ordered steps and cheapest-first mantras', () => {
  const text = loop();
  const clauses = clausesOf(text);
  const steps = ['freeze', 'baseline', 'acceptance checks', 'mantras', 'single change', 'commit win', 'stop', 'report'];
  const positions = steps.map((name) => clauses.findIndex(accepts(rules.find((row) => row[0] === name))));
  expect(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1]))).toBe(true);
  const mantras = ["don't do it", "don't do it again", 'do it less', 'do it later', "do it when they're not looking", 'do it concurrently', 'do it cheaper'];
  const ordered = (source) => {
    const entries = [...source.matchAll(/^\s*- (.+)$/gm)].map((match) => match[1].toLowerCase());
    return mantras.every((mantra, index) => entries[index] === mantra);
  };
  expect(ordered(text)).toBe(true);
  expect(ordered(text.replace(/- do it less\n\s*- do it later/, '- do it later\n- do it less'))).toBe(false);
});

test('performance loop: packaged load targets and pinned attribution', () => {
  for (const source of [debug, improve, implement]) {
    const directive = clausesOf(source()).find((clause) => clause.includes(link));
    expect(directive).toBeDefined();
    expect(requires(directive, /only/i, /performance work/i, /load|read|consult/i)).toBe(true);
  }
  expect(loop()).toContain('[Performance checklist](performance-checklist.md)');
  expect(existsSync(`${root}/skills/axstack/references/performance-checklist.md`)).toBe(true);
  expect(loop()).toContain('https://github.com/cursor/plugins/blob/d0ef80d86795816da932a153458c5dbe192d294e/pstack/skills/poteto-mode/playbooks/');
  expect(requires(loop(), /pstack/i, /perf-issue/i, /hillclimb/i, /MIT/i)).toBe(true);
});
