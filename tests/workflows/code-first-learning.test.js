import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
// Declared correction policy only; this does not prove live agent compliance.
const concepts = [
  /propose|suggest|prefer/i,
  /recur\w*|repeat\w*/i,
  /mechanical/i,
  /(?:code|structur\w*|checks?)\b[^.!?;]*\bfix\b/i,
  /(?:code|structur\w*|checks?)\b[^.!?;]*\b(?:before|ahead of|over|rather than|instead of)\b[^.!?;]*\binstructions?\b/i,
];

for (const [name, path, extra, rewording] of [
  ['audit learning candidates', 'skills/axstack-audit/SKILL.md', [/learning candidates/i],
    'For repeated mechanical failures, learning candidates suggest a structural, code or check fix ahead of changing instructions.'],
  ['repository default', 'AGENTS.md', [],
    'Prefer a check, structural or code fix ahead of changing instructions for repeated mechanical failures.'],
]) {
  test(`code-first learning: ${name} rejects removal and instruction-first policy, survives rewording`, () => {
    const source = readFileSync(`${root}/${path}`, 'utf8');
    const accepts = (text) => requires(text, ...concepts, ...extra);
    checkRule(source, accepts, rewording, [
      [/before|ahead of|over|rather than|instead of/gi, 'after'],
      [concepts[4], 'instruction change before a code, structure or check fix'],
      [/propose|suggest|prefer/gi, 'ignore'],
      [/^/, 'Do not '],
    ], [...concepts, ...extra]);
  });

  const subject = extra.length ? 'learning candidates ' : '';
  for (const [wording, holdout] of [
    ['over', `For recurring mechanical classes, ${subject}prefer a code, structure or check fix over an instruction change.`],
    ['repeats', `When a mechanical class repeats, ${subject}prefer a code, structure or check fix before an instruction change.`],
    ['recurs', `When a mechanical class recurs, ${subject}prefer a code, structure or check fix before an instruction change.`],
    ['rather than', `For recurring mechanical classes, ${subject}prefer a code, structure or check fix rather than an instruction change.`],
    ['instead of', `For recurring mechanical classes, ${subject}prefer a code, structure or check fix instead of an instruction change.`],
  ]) {
    test(`code-first learning: ${name} accepts ${wording} and rejects instruction-first`, () => {
      const source = readFileSync(`${root}/${path}`, 'utf8');
      const accepts = (text) => requires(text, ...concepts, ...extra);
      const clauses = sentences(source);
      const targets = clauses.filter(accepts);
      expect(targets).toHaveLength(1);
      const rewritten = clauses.map((clause) => targets.includes(clause) ? holdout : clause).join('. ');
      checkRule(rewritten, accepts, holdout, [
        [/before|ahead of|over|rather than|instead of/gi, 'after'],
        [concepts[4], 'instruction change before a code, structure or check fix'],
        [/^/, 'Do not '],
      ], [...concepts, ...extra]);
    });
  }
}
