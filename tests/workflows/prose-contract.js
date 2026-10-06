import { expect } from 'bun:test';

// Declared instruction checks only; these do not prove live agent compliance.
export const sentences = (text) => text
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/\s+/g, ' ')
  .split(/[.!?;]\s+|\s+and (?=never\b)/i);

const denied = /\b(?:no|not|never|skip|avoid\w*|optional|may)\b/i;
export const requires = (text, ...concepts) => sentences(text).some((sentence) =>
  !denied.test(sentence) && concepts.every((concept) => concept.test(sentence)));

// A prohibition must state its negative concept explicitly. Mask only that
// expected phrase, then apply the same denial guard to the rest of the sentence.
export const prohibits = (text, prohibition, ...concepts) => sentences(text).some((sentence) =>
  new RegExp(prohibition.source, prohibition.flags.replace(/[gy]/g, '')).test(sentence) && concepts.every((concept) => concept.test(sentence))
  && requires(sentence.replace(prohibition, ''), /^/));

// Both recovery suites mutate only their accepted real-source sentences in memory.
export function checkRule(text, accepts, rewording, inversions, concepts = []) {
  expect(accepts(text)).toBe(true);
  const targets = sentences(text).filter(accepts);
  expect(targets.length).toBeGreaterThan(0);
  const substitute = (transform) => targets.reduce((source, target) =>
    source.replace(target, transform(target)), text);
  expect(accepts(substitute(() => ''))).toBe(false);
  for (const concept of concepts) {
    const occurrences = new RegExp(concept.source, `${concept.flags}g`);
    expect(accepts(substitute((target) => target.replace(occurrences, '')))).toBe(false);
  }
  expect(accepts(substitute(() => rewording))).toBe(true);
  for (const [direction, inversion] of inversions) {
    const invert = (target) => {
      const mutated = target.replace(direction, inversion);
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
