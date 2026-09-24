import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => existsSync(`${root}/${path}`) ? readFileSync(`${root}/${path}`, 'utf8') : '';
const text = (path) => read(path).replace(/\s+/g, ' ');
const reference = 'skills/axstack/references/design-lens.md';

// Prose contracts and scenario schemas; neither proves future agent behavior.
test('design lens: factual ladder and proportionate routing', () => {
  expect(existsSync(`${root}/${reference}`), 'packaged design lens reference').toBe(true);
  const lens = text(reference);
  expect(lens).toMatch(/Rung 0[\s\S]*?one module[^.]*existing interface[^.]*ownership[^.]*data flow[^.]*failure guarantees/i);
  expect(lens).toMatch(/Rung 0[\s\S]*?no design questions and carry no sketch/i);
  expect(lens).toMatch(/Rung 1[\s\S]*?fails Rung 0/i);
  expect(lens).toMatch(/Rung 2[\s\S]*?Rung 1[^.]*ADR test[\s\S]*?arena/i);
  expect(lens).toMatch(/no (?:numeric|file-count|class-count) threshold/i);
  expect(lens).toMatch(/might be small[^.]*not a reason to skip/i);
  expect(lens).toMatch(/Rung 1[^.]*stay small/i);
  expect(lens).toMatch(/unsettled material design question[^.]*reassess size/i);
  expect(text('skills/axstack/references/routing.md')).toMatch(/Unclear:[\s\S]*?Rung 1[^.]*axstack-align/i);
});

test('design lens: installed roles cannot silently enter an active snapshot', () => {
  expect(text('skills/axstack/references/routing.md')).toMatch(/A role installed or changed later must not silently enter the snapshot/i);
});

test('design lens: live profiles remain authoritative for role snapshots', () => {
  expect(text('skills/axstack/references/routing.md')).toMatch(/Live profiles are authoritative at snapshot time and for availability; bundled presets are setup inputs, not runtime proof/i);
});

test('design lens: small ambiguity does not force substantial-work paperwork', () => {
  expect(text('skills/axstack/references/routing.md')).toContain('does not force substantial-work paperwork');
});

test('design lens: Align settles the rung from facts rather than asking the user', () => {
  expect(text(reference)).toMatch(/rung[^.]*researched facts[^.]*not a user choice/i);
  expect(text('skills/axstack-align/SKILL.md')).toMatch(/rung[^.]*researched facts[^.]*never ask the user/i);
});

test('design lens: ordered questions, vocabulary, and tailored rubric', () => {
  const lens = text(reference);
  expect(lens).toMatch(/Scope:[\s\S]*Caller first:[\s\S]*Shape:[\s\S]*Flow and failure:[\s\S]*Reversibility:/i);
  expect(lens).toMatch(/20[^.]*35[^.]*five/i);
  for (const term of ['deep module', 'shallow module', 'interface as test surface', 'seam', 'locality', 'ownership', 'deletion test', 'information leakage', 'temporal decomposition', 'pass-through', 'boring by default', 'reversible over clever']) {
    expect(lens, term).toContain(term);
  }
  expect(lens).toMatch(/red flags[^.]*prompts for evidence[^.]*not automatic defects/i);
  expect(lens).toMatch(/driver[^.]*selects[^.]*three to six[^.]*tailors[^.]*rubric criteria/i);
});

test('design lens: sketch block and conditional phase wiring', () => {
  const lens = text(reference);
  for (const line of ['Usage:', 'Shape:', 'Binding:', 'Flow + failure:', 'We accept:', 'Rejected:', 'Open:']) expect(lens).toContain(line);
  const sketch = read(reference).match(/```text\n([\s\S]*?)\n```/)?.[1];
  expect(sketch).toMatch(/^Shape: <signatures or a <=10-line ASCII\/Mermaid diagram>$/m);
  const phases = {
    align: 'skills/axstack-align/SKILL.md',
    spec: 'skills/axstack-spec/SKILL.md',
    tickets: 'skills/axstack-tickets/SKILL.md',
    implement: 'skills/axstack-implement/SKILL.md',
    review: 'skills/axstack-review/SKILL.md',
    improve: 'skills/axstack-improve/SKILL.md',
  };
  for (const [phase, path] of Object.entries(phases)) {
    expect(text(path), phase).toContain('../axstack/references/design-lens.md');
  }
  expect(text(phases.align)).toMatch(/Design the shape[\s\S]*?Rung 0: no design questions or sketch/i);
  expect(text(phases.align)).toMatch(/Otherwise load the[\s\S]*?design-lens\.md/i);
  expect(text(phases.align)).toMatch(/unresolved areas[^.]*existing budget/i);
  expect(text(phases.align)).toMatch(/design question alone[^.]*small work[^.]*substantial/i);
  expect(text(phases.spec)).toMatch(/sketch[^.]*approved revision[^.]*Usage[^.]*acceptance/i);
  expect(text(phases.tickets)).toMatch(/sketch[^.]*modules[^.]*named failure[^.]*acceptance[^.]*split signal/i);
  expect(text(phases.implement)).toMatch(/scope identity carries a sketch[^.]*author brief/i);
  expect(text(phases.implement)).toMatch(/Normal behavior path[^.]*first red check[^.]*Usage/i);
  expect(text(phases.implement)).toMatch(/structure-preserving path stays as is/i);
  expect(text(phases.implement)).toMatch(/first[^.]*red check[^.]*Usage/i);
  expect(text(phases.implement)).toMatch(/repeated workaround[^.]*unnamed boundary[^.]*sketch conflict[\s\S]*?only the affected decision[^.]*Align[^.]*material-revision/i);
  expect(text(phases.review)).toMatch(/architecture[\s\S]*?sketch[^.]*red flags[\s\S]*?Binding[^.]*accepted spec revision[^.]*finding/i);
  expect(text(phases.improve)).toMatch(/sketch[\s\S]*?vocabulary[^.]*red flags/i);
  expect(text(phases.improve)).toMatch(/return candidates in sketch form/i);
  for (const phase of ['spec', 'tickets', 'implement', 'review', 'improve']) {
    expect(text(phases[phase]), phase).toMatch(/only when[^.]*scope identity[^.]*sketch/i);
  }
});

test('design lens: spec counterpart has a comment header and one source heading', () => {
  expect(read('docs/specs/design-lens.md')).toMatch(/^<!-- Markdown counterpart of issue #180 approved rev 2 \(SHA-256 [a-f0-9]{64}\) -->\n# Design lens for Align/m);
});

test('design lens: structural scenario cases are present', () => {
  const cases = (path) => JSON.parse(read(`tests/workflows/${path}.json`)).cases;
  for (const id of ['design-rung-0', 'design-rung-1', 'design-rung-2']) {
    const scenario = cases('align-grilling-scenarios').find((item) => item.id === id);
    expect(scenario?.input).toBeTruthy();
    expect(scenario?.expected).toBeTruthy();
  }
  expect(cases('review-modes-scenarios').some((item) => item.id === 'binding-deviation')).toBe(true);
  expect(cases('implement-loop-evaluator-inputs').some((item) => item.id === 'sketch-friction')).toBe(true);
});
