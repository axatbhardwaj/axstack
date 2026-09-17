import { test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

// Structural checks for the blast-radius reference and its wiring into review
// and explain. They verify the declared ladder and hand-back, not whether a
// model follows them.

const REF = 'skills/axstack/references/blast-radius.md';

test('blast-radius: reference declares the five-step evidence ladder', () => {
  expect(existsSync(`${root}/${REF}`)).toBe(true);
  const text = compact(REF);
  for (const step of ['Said so', 'Pointed at the line', 'Walked the failure', 'Ran it', 'Reproduced it in the running app']) {
    expect(text, `ladder step ${step}`).toContain(step);
  }
  expect(text).toMatch(/below step 4 is written as \*\*unproven\*\*, never as settled/i);
  expect(text).toMatch(/one fact it is safe because of/i);
  expect(text).toMatch(/never invent a caller or an API/i);
  expect(text).toMatch(/beyond the diff/i);
});

test('blast-radius: hand-back names what, the fact, risks, cleared, and before merge', () => {
  const text = compact(REF);
  for (const item of ['What it does', 'The one fact it is safe because of', 'Risks', 'Cleared', 'Before merge']) {
    expect(text, `hand-back item ${item}`).toContain(item);
  }
  expect(text).toMatch(/strip anything private/i);
  expect(text).toMatch(/unproven safety fact[^.]*consequential change[^.]*finding/i);
});

test('blast-radius: review loads it under angle 3 and the receipt carries the safety fact', () => {
  const review = compact('skills/axstack-review/SKILL.md');
  expect(review).toMatch(/3\. Integration and regressions:[^.]*\(\.\.\/axstack\/references\/blast-radius\.md\)/);
  expect(review).toMatch(/below "ran it" is unproven/i);
  const receipt = read('skills/axstack-review/SKILL.md').split('## Template: review receipt')[1];
  expect(receipt).toMatch(/^Safety fact: <[^\n]*> — <ladder step \+ proof \| unproven>$/m);
});

test('blast-radius: explain and routing expose the direct "what could this break" route', () => {
  const explain = compact('skills/axstack-explain/SKILL.md');
  expect(explain).toMatch(/what could this break.{0,120}blast-radius\.md/i);
  const routing = compact('skills/axstack/references/routing.md');
  expect(routing).toMatch(/what could this break[^.]*\(blast-radius\.md\)/i);
});

test('explain: "show me your work" reconstructs the decision trail from the record', () => {
  const explain = compact('skills/axstack-explain/SKILL.md');
  expect(explain).toMatch(/show me your work[^.]*decision trail/i);
  expect(explain).toMatch(/`Decisions` and `Learnings`/);
  expect(explain).toMatch(/what was chosen, why, the evidence pointer, and its result/i);
  expect(explain).toMatch(/no recorded reason as open rather than inventing one/i);
});
