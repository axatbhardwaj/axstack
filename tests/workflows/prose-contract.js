import { expect } from 'bun:test';

// Declared instruction checks only; these do not prove live agent compliance.
export const sentences = (text) => text
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/\s+/g, ' ')
  .split(/[.!?;]\s+|\s+and (?=never\b)/i);

const denied = /\b(?:no|not|never|skip|avoid\w*|optional|may)\b/i;
const pattern = (expression, global = false) => new RegExp(expression.source,
  expression.flags.replace(/[gy]/g, '') + (global ? 'g' : ''));
// Concepts start at a word boundary; explicit stems may still match inflections.
// This excludes "settled" inside "unsettled" and "expected" inside "unexpected".
const matches = (text, concept) => new RegExp(`(?<!\\w)(?:${concept.source})`,
  concept.flags.replace(/[gy]/g, '')).test(text);
export const requires = (text, ...concepts) => sentences(text).some((sentence) =>
  !denied.test(sentence) && concepts.every((concept) => matches(sentence, concept)));

// A prohibition must state its negative concept explicitly. Mask only that
// expected phrase, then apply the same denial guard to the rest of the sentence.
export const prohibits = (text, prohibition, ...concepts) => sentences(text).some((sentence) =>
  matches(sentence, prohibition) && concepts.every((concept) => matches(sentence, concept))
  && requires(sentence.replace(pattern(prohibition, prohibition.global), ''), /^/));

// Mutate normalized clauses in memory, so wrapped Markdown and links cannot
// prevent substitution. Keep every sibling clause in each mutated document.
export function checkRule(text, accepts, rewording, inversions, concepts = []) {
  expect(accepts(text)).toBe(true);
  const clauses = sentences(text);
  const targets = clauses.filter(accepts);
  expect(targets.length).toBeGreaterThan(0);
  const substitute = (transform) => clauses.map((clause) =>
    targets.includes(clause) ? transform(clause) : clause).join('. ');
  expect(accepts(substitute(() => ''))).toBe(false);
  for (const concept of concepts) {
    const occurrences = pattern(concept, true);
    expect(accepts(substitute((target) => target.replace(occurrences, '')))).toBe(false);
  }
  expect(accepts(substitute(() => rewording))).toBe(true);
  for (const [direction, inversion] of inversions) {
    const invert = (target) => {
      const mutated = target.replace(pattern(direction, true), inversion);
      expect(mutated).not.toBe(target);
      return mutated;
    };
    expect(accepts(substitute(invert))).toBe(false);
    expect(accepts(substitute(() => invert(rewording)))).toBe(false);
  }
}

// Preserve the linked target: a positive load/read directive owns its links,
// including a list introduced by a colon, rather than every link in a paragraph.
export function loadedReferences(text) {
  const references = [];
  const paragraphs = text.split(/\n\s*\n/);
  for (let index = 0; index < paragraphs.length; index++) {
    for (const sentence of paragraphs[index].replace(/\s+/g, ' ').split(/[.!?;]\s+/)) {
      if (!requires(sentence, /\b(?:load(?:s|ed)?|read|consult|follow)\b/i)) continue;
      let links = sentence;
      if (sentence.endsWith(':') && /^\s*[-*]\s+\[/m.test(paragraphs[index + 1] ?? '')) {
        links += paragraphs[index + 1];
      }
      for (const [, link] of links.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) references.push(link);
    }
  }
  return [...new Set(references)];
}
