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
  // Step 4 means real code ran, not a convincing explanation; step 1 is worthless.
  expect(text).toMatch(/4\. \*\*Ran it\.\*\* A script or test that calls the real code and fails loud if the claim is wrong/);
  expect(text).toMatch(/1\. \*\*Said so\.\*\* Worthless on its own/);
  expect(text).toMatch(/writeup that sounds right is worthless/i);
  expect(text).toMatch(/5\. \*\*Prove the one fact\.\*\* Write the script or test, run it against the real code, and paste what happened/);
  expect(text).toMatch(/If it cannot be proven cheaply, mark it unproven; do not overstate/);
  // Where grep stops: the sources a symbol search misses are named, not implied.
  for (const source of ['Library source at the pinned version', 'the JSON an API returns', 'a database column', 'wire or on-chain format', 'a feature flag', 'code three hops downstream']) {
    expect(text, `must name ${source}`).toContain(source);
  }
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
  const step = explain.match(/6\. For "show me your work"[^]*?rather than inventing one\./)?.[0];
  expect(step, 'show-me-your-work step must be one bounded instruction').toBeTruthy();
  expect(step).toMatch(/reconstruct the decision trail rather than re-describing the diff/);
  // The record is read first, then the named evidence sources, in that order.
  expect(step).toMatch(/read the run record's `Decisions` and `Learnings` \(\[run record\]\([^)]*\)\), then the commits, PR body, review receipts, and ADRs/);
  expect(step).toMatch(/what was chosen, why, the evidence pointer, and its result/);
  // Proof is separated from inference; missing reasons are reported open, never filled in.
  expect(step).toMatch(/separate what the record proves from what is inferred/);
  expect(step).toMatch(/list choices with no recorded reason as open rather than inventing one/);
});
