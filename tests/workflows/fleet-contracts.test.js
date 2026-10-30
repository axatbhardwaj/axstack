import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const runtime = () => readFileSync(`${import.meta.dir}/../../skills/axstack/references/t3-runtime.md`, 'utf8');
// Evaluate each safety rule in its own paragraph, including its prohibition.
const rules = [
  ['native destination', /native (?:forwarded|destination) (?:APIs|reads)/i, /before dispatch/i, /must capture|shall collect/i,
    /capabilit/i, /project/i, /access/i],
  ['unknown effective settings', /t3_thread_configuration.*unavailable/i, /effective.*unknown/i, /must not invent|never invent/i],
  ['ambiguous submission', /ambiguous submission|submission ambiguity/i, /clientRequestId/i,
    /remote task/i, /unknown liveness/i, /prohibits? replacement|blocks? replacement/i],
  ['remote terminal', /must read task_status|shall inspect task_status/i, /task_status.*origin/i, /terminal.*destination/i, /latest.*run/i,
    /pending children/i, /unanswered question/i],
  ['author disabled', /remote author coordinator.*DISABLED/i, /checkpoint refs/i,
    /must not.*(?:enable|pilot)|never.*(?:enable|pilot)/i],
];
function satisfies(source, predicates) {
  return source.split(/\n\s*\n/).some((paragraph) => predicates.every((p) => p.test(paragraph.replace(/\s+/g, ' '))));
}
for (const [name, ...predicates] of rules) {
  test(`fleet runtime semantic guard: ${name}`, () => {
    const source = runtime();
    expect(satisfies(source, predicates)).toBe(true);
    const paragraphs = source.split(/\n\s*\n/);
    const index = paragraphs.findIndex((p) => predicates.every((r) => r.test(p.replace(/\s+/g, ' '))));
    const removed = paragraphs.filter((_, i) => i !== index).join('\n\n');
    expect(satisfies(removed, predicates)).toBe(false);
  });
}


const variants = [
  ['native destination', 'must capture', 'must not capture', 'shall collect'],
  ['unknown effective settings', 'must not invent', 'may invent', 'never invent'],
  ['ambiguous submission', 'prohibits replacement', 'permits replacement', 'blocks replacement'],
  ['remote terminal', 'must read task_status', 'may skip task_status', 'shall inspect task_status'],
  ['author disabled', 'must not enable', 'may enable', 'never enable'],
];
for (const [name, phrase, inverted, equivalent] of variants) {
  test(`fleet instruction rejects inversion and survives rewording: ${name}`, () => {
    const predicates = rules.find((r) => r[0] === name).slice(1);
    const source = runtime();
    const paragraphs = source.split(/\n\s*\n/);
    const index = paragraphs.findIndex((p) => satisfies(p, predicates));
    expect(index).toBeGreaterThanOrEqual(0);
    const original = paragraphs[index];
    expect(original).toContain(phrase);
    paragraphs[index] = original.replace(phrase, inverted);
    expect(satisfies(paragraphs.join('\n\n'), predicates)).toBe(false);
    paragraphs[index] = original.replace(phrase, equivalent);
    expect(satisfies(paragraphs.join('\n\n'), predicates)).toBe(true);
  });
}
