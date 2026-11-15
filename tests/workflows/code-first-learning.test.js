import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
// Declared correction policy only; this does not prove live agent compliance.
const concepts = [
  /propose|suggest|prefer/i,
  /recurring|repeated/i,
  /mechanical/i,
  /(?:code|structur\w*|checks?)\b[^.!?;]*\bfix\b/i,
  /(?:code|structur\w*|checks?)\b[^.!?;]*\b(?:before|ahead of)\b[^.!?;]*\binstructions?\b/i,
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
      [/before|ahead of/gi, 'after'],
      [/propose|suggest|prefer/gi, 'ignore'],
      [/^/, 'Do not '],
    ], [...concepts, ...extra]);
  });
}
