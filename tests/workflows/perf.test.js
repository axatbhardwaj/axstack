import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { loadedReferences, prohibits, requires } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => existsSync(`${root}/${path}`) ? readFileSync(`${root}/${path}`, 'utf8') : '';
const skill = () => read('skills/axstack-perf/SKILL.md');
const routing = () => read('skills/axstack/references/routing.md');
const clausesOf = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean);

// Independent entry-point contracts: perf-loop.test.js owns the experiment
// procedure, but cannot catch wrong routing or lost phase acceptance checks.
const rules = [
  ['phase acceptance checks', skill, [/record|set/i, /target/i, /noise criterion/i, /finite attempt budget/i, /acceptance checks/i, /routed phase/i],
    [/acceptance checks/gi, 'optional notes'], 'Set the target, noise criterion and finite attempt budget as acceptance checks in the routed phase.'],
  ['loop load', skill, [/load|read|consult/i, /Performance loop/i],
    [/load|read|consult/gi, 'skip'], 'Consult [Performance loop](../axstack/references/perf-loop.md).'],
  ['regression route', skill, [/regression/i, /route|send/i, /axstack-debug/i],
    [/axstack-debug/gi, 'axstack-improve'], 'Send a performance regression to `axstack-debug`.'],
  ['discovery route', skill, [/optimization discovery/i, /route|send/i, /axstack-improve/i],
    [/axstack-improve/gi, 'axstack-implement'], 'Send optimization discovery to `axstack-improve`.'],
  ['accepted change route', skill, [/accepted change/i, /route|send/i, /axstack-implement/i],
    [/axstack-implement/gi, 'axstack-debug'], 'Send an accepted change to `axstack-implement`.'],
  ['phase scope owner', skill, [/routed phase/i, /owns|controls/i, /scope/i],
    [/routed phase/gi, 'perf entry point'], 'The routed phase controls scope.'],
  ['thin entry point', skill, [/entry point/i, /additional workflow/i, /role/i, /runtime/i],
    [/no additional/gi, 'an additional'], 'This entry point adds no additional workflow, role or runtime.', /no additional/i],
  ['natural request route', routing, [/make X faster/i, /route|send/i, /axstack-perf/i],
    [/axstack-perf/gi, 'axstack-implement'], '- Send "make X faster" to `axstack-perf`.'],
];
const accepts = (row) => (text) => clausesOf(text).some((clause) => row[5]
  ? prohibits(clause, row[5], ...row[2]) : requires(clause, ...row[2]));

// The first red checks the design's Usage path and its phase acceptance handoff.
test('perf usage: deploy target reaches the routed phase acceptance checks', () => {
  expect(skill()).toContain('/axstack-perf make the deploy step faster; target -30%');
  expect(accepts(rules[0])(skill()), 'target, noise and budget must bind the routed phase').toBe(true);
  expect(accepts(rules[3])(skill()), 'optimization discovery route').toBe(true);
});

for (const row of rules) {
  const [name, source, concepts, [direction, inverse], rewording] = row;
  test(`perf router: ${name}`, () => {
    const clauses = clausesOf(source());
    const check = accepts(row);
    const matches = clauses.filter(check);
    expect(matches, 'missing or ambiguous required instruction').toHaveLength(1);
    const substitute = (replacement) => clauses.map((clause) => clause === matches[0] ? replacement : clause).join('\n');
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

test('perf router: model invocation stays enabled and the loop load resolves', () => {
  const frontmatter = skill().match(/^---\n([\s\S]*?)\n---/)?.[1];
  expect(frontmatter).toBeDefined();
  expect(frontmatter).not.toMatch(/^disable-model-invocation:/m);
  const target = '../axstack/references/perf-loop.md';
  expect(loadedReferences(skill())).toContain(target);
  expect(existsSync(`${root}/skills/axstack-perf/${target}`)).toBe(true);
  expect(loadedReferences(skill().replaceAll(target, '../axstack/references/performance-checklist.md'))).not.toContain(target);
});
