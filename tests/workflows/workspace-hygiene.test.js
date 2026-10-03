import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { requires, sentences } from './prose-contract.js';
const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();

const hygiene = () => read('skills/axstack/references/workspace-hygiene.md');
const scenarios = JSON.parse(read('tests/workflows/workspace-hygiene-scenarios.json')).cases;
// Exact safety pins: deliberate wording changes require a test edit.
for (const { id, input, expected, contract } of scenarios) {
  test(`hygiene safety: ${id} rejects removal and token negation`, () => {
    expect(input.length).toBeGreaterThan(20);
    expect(expected.length).toBeGreaterThan(5);
    const text = normalize(hygiene());
    expect(text).toContain(contract);
    expect(text.replace(contract, '')).not.toContain(contract);
    expect(text.replace(contract, contract.replace(/^\S+/, '$& not'))).not.toContain(contract);
  });
}
const rules = [
  ['settlement proof', [/terminal/i, /run evidence/i, /before/i, /t3_thread_organize/i], 'Require terminal run evidence before t3_thread_organize archive.'],
  ['sweep records', [/record/i, /removed/i, /held/i, /run record/i], 'Record held and removed resources in the private run record.'],
  ['unreachable inventory', [/unreachable/i, /report/i, /continue/i, /phase/i], 'Report an unreachable T3 host and continue the phase.'],
];
for (const [name, concepts, holdout] of rules) {
  test(`hygiene rule: ${name}`, () => {
    expect(requires(hygiene(), ...concepts)).toBe(true);
    const clauses = sentences(hygiene());
    const matching = clauses.filter((clause) => requires(clause, ...concepts));
    expect(requires(clauses.filter((clause) => !matching.includes(clause)).join('. '), ...concepts)).toBe(false);
    expect(requires(clauses.map((clause) => matching.includes(clause) ? `Do not ${clause}` : clause).join('. '), ...concepts)).toBe(false);
    expect(requires(holdout, ...concepts)).toBe(true);
    expect(requires(`Do not ${holdout}`, ...concepts)).toBe(false);
  });
}
// These phase/link assertions belong to T5a; retain them until that text changes.
test('existing phase entry points load hygiene and private evidence', () => {
  for (const path of ['lifecycle.md', 'routing.md', 't3-runtime.md', 'run-record.md']) {
    expect(read(`skills/axstack/references/${path}`)).toContain('workspace-hygiene.md');
  }
  const phases = ['align', 'audit', 'debug', 'explain', 'implement', 'improve', 'research', 'review', 'spec', 'tickets', 'watch'];
  for (const phase of phases) {
    const text = read(`skills/axstack-${phase}/SKILL.md`);
    expect(requires(text, /driver entry/i, /sweep/i, /Workspace hygiene/i), phase).toBe(true);
    expect(text, phase).toMatch(/dispatch brief[^.]*<run dir>\/evidence\/<dispatch>\//i);
  }
  expect(read('skills/axstack/references/run-record.md')).toMatch(/Worktrees in other repositories: <per-run repository and worktree IDs or none>/);
});
