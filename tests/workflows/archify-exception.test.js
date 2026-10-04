import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { requires, sentences } from './prose-contract.js';

const source = () => readFileSync(`${import.meta.dir}/../../AGENTS.md`, 'utf8');
// These guard the narrow external-tool exception, absent from earlier policy
// checks. Each probe rewrites the real source in memory only.
const rules = [
  [[/permit|allow/i, /installer/i, /network/i, /Git/i, /step/i, /only for archify/i],
    /only for archify/i, 'for every tool',
    'Allow an installer Git and network step only for archify.'],
  [[/run|execute/i, /Node-oriented/i, /tool/i, /Bun/i],
    /Bun/i, 'Node.js', 'Execute this Node-oriented tool with Bun.'],
  [[/keep|retain/i, /exception/i, /limited to archify|archify only/i],
    /limited to archify|archify only/i, 'open to all tools',
    'Retain this exception for archify only.'],
];

for (const [concepts, flip, inverse, rewording] of rules) {
  test(`archify exception: ${rewording}`, () => {
    const accepts = (text) => requires(text, ...concepts);
    const check = (text) => {
      const clauses = sentences(text);
      const matching = clauses.filter(accepts);
      expect(matching).toHaveLength(1);
      const rewrite = (replacement) => clauses.map((clause) => accepts(clause) ? replacement(clause) : clause).join('. ');
      expect(accepts(rewrite(() => ''))).toBe(false);
      expect(accepts(rewrite((clause) => clause.replace(flip, inverse)))).toBe(false);
      expect(accepts(rewrite(() => `Do not ${rewording}`))).toBe(false);
      expect(accepts(rewrite(() => rewording))).toBe(true);
    };
    const text = source();
    check(text);
    const original = text.replace(/\s+/g, ' ').split(/[.!?;]\s+/).find(accepts);
    expect(original).toBeTruthy();
    const pattern = new RegExp(original.split(/\s+/).map((word) =>
      word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'));
    const rewritten = text.replace(pattern, rewording.replace(/[.]$/, ''));
    check(rewritten);
    for (const [sibling] of rules) expect(requires(rewritten, ...sibling)).toBe(true);
  });
}
