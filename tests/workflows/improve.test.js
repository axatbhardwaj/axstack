import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

// Structural instruction-contract checks only. They verify declared routing
// and evidence boundaries, not whether a model will follow those instructions.

test('improve: direct discovery is bounded and report-only', () => {
  const text = compact('skills/axstack-improve/SKILL.md');
  expect(text).toMatch(/no spec|needs no[^.]*spec/i);
  expect(text).toMatch(/no[^.]*ticket|needs no[^.]*ticket/i);
  expect(text).toMatch(/named[^.]*subsystem|named[^.]*pain/i);
  expect(text).toMatch(/otherwise[^.]*recent[^.]*hot spot|recent[^.]*change[^.]*hot spot/i);
  for (const marker of ['paths', 'revision', 'history window', 'known decisions']) {
    expect(text.toLowerCase()).toContain(marker);
  }
  expect(text).toMatch(/stable source identity|content hash/i);
  expect(text).toMatch(/non-versioned|screenshot|exported snippet/i);
  expect(text).toMatch(/history[^.]*unavailable[^.]*limitation|unavailable history[^.]*limitation/i);
  expect(text).toMatch(/read[^.]*code[^.]*history[^.]*tests/i);
  expect(text).toMatch(/requested report[^.]*only|writes? only[^.]*report/i);
  expect(text).toMatch(/no worthwhile (?:change|improvement)[^.]*valid/i);
  expect(sentences(text).some((sentence) =>
    /(?:does not|must not|never) (?:edit|change)[^.]*source code[^.]*domain documentation[^.]*issues/i.test(sentence),
  )).toBe(true);
  expect(sentences(text).some((sentence) =>
    /(?:never|must not|does not) (?:auto-refactor|automatically refactor)/i.test(sentence),
  )).toBe(true);
});

test('improve: findings are evidenced, ranked, and decision-useful', () => {
  const text = compact('skills/axstack-improve/SKILL.md');
  for (const marker of ['maintainability', 'architecture', 'testability', 'current', 'proposed', 'benefit', 'tradeoff', 'behavior to preserve', 'test approach', 'uncertainty', 'recommendation strength']) {
    expect(text.toLowerCase()).toContain(marker);
  }
  expect(requires(text, /(?:source|inspected) evidence/i, /scoped problem/i)).toBe(true);
  expect(text).toMatch(/small[^.]*ranked[^.]*candidate/i);
  expect(text).toMatch(/KISS[^.]*YAGNI[^.]*SOLID[^.]*judg/i);
  expect(text).toMatch(/no invented metrics|never invent[^.]*metric/i);
  expect(text).toMatch(/no arbitrary[^.]*complexity|never[^.]*arbitrary[^.]*complexity/i);
  expect(text).toMatch(/shallow interfaces|lost locality/i);
  expect(text).toMatch(/hidden state|needless layers/i);
  expect(text).toMatch(/smaller interfaces|deeper modules/i);
});

test('improve: explanation is optional and selection preserves the phase boundary', () => {
  const text = compact('skills/axstack-improve/SKILL.md');
  expect(text).toMatch(/axstack-explain/);
  expect(text).toMatch(/worthwhile[^.]*before[^.]*after|before[^.]*after[^.]*visual/i);
  expect(sentences(text).some((sentence) =>
    /(?:never|do not) (?:force|require)[^.]*HTML|no mandatory HTML/i.test(sentence),
  )).toBe(true);
  expect(text).toMatch(/unresolved[^.]*design[^.]*axstack-align|axstack-align[^.]*unresolved[^.]*design/i);
  expect(text).toMatch(/clear[^.]*authorized[^.]*small-change intent|small-change intent[^.]*settled/i);
  expect(text).toMatch(/no[^.]*new approval|without[^.]*new approval/i);
  expect(text).toMatch(/preparation[^.]*execution[^.]*separate|preparation[^.]*execution[^.]*boundary/i);
  expect(text).toMatch(/report card[^.]*not[^.]*authoriz|selection[^.]*not[^.]*authoriz/i);
  expect(text).toMatch(/structure-preserving/i);
  expect(text).toMatch(/record[^.]*explicit tag|record that explicit tag/i);
  expect(text).toMatch(/never infer[^.]*tag[^.]*refactor|refactor[^.]*alone[^.]*tag/i);
});

test('improve: structure-preserving work uses old-green same-check evidence', () => {
  const text = compact('skills/axstack-implement/SKILL.md');
  expect(text).toMatch(/accepted[^.]*scope[^.]*structure-preserving/i);
  expect(text).toMatch(/behavioral baseline|characterization/i);
  expect(requires(text,
    /old revision/i, /must (?:run|be) green/i, /before[^.]*structural (?:edit|change)/i,
  )).toBe(true);
  expect(text).toMatch(/same checks[^.]*new revision[^.]*green/i);
  expect(text).toMatch(/never[^.]*manufacture[^.]*red|no[^.]*fabricated[^.]*red/i);
  expect(text).toMatch(/mutation[^.]*optional|optional[^.]*mutation/i);
  expect(text).toMatch(/artifact|equivalence/i);
});

test('improve: normal TDD and bounded ownership remain intact', () => {
  const implement = compact('skills/axstack-implement/SKILL.md');
  expect(implement).toMatch(/bug|new behavior/i);
  expect(requires(implement,
    /bug|new behavior/i, /separately accepted|requires separate acceptance/i,
    /normal[^.]*real red[^.]*green/i,
  )).toBe(true);
  expect(implement).toMatch(/red[^.]*green/i);
  expect(implement).toMatch(/outside[^.]*listed[^.]*files|exceed[^.]*files/i);
  expect(implement).toMatch(/reassess/i);
  expect(implement).toMatch(/exactly one author|one writer/i);
  const profiles = JSON.parse(read('profiles/presets/mixed.json'));
  expect(profiles.roles.some(({ id }) => id === 'axstack-improve')).toBe(false);
});

test('improve: implementation receipt and audit accept the applicable evidence path', () => {
  const implement = compact('skills/axstack-implement/SKILL.md');
  const auditPolicy = compact('skills/axstack-audit/SKILL.md');
  const audit = `${auditPolicy} ${compact('skills/axstack-audit/references/record.md')}`;
  expect(implement).toMatch(/TDD:[^>]*normal red\/green[^>]*structure-preserving[^>]*old-green[^>]*same-check-new-green/i);
  expect(audit).toMatch(/normal[^.]*real red[- ]green|red[- ]green[^.]*normal/i);
  expect(audit).toMatch(/structure-preserving[^.]*old revision[^.]*green[^.]*same checks[^.]*new revision[^.]*green/i);
  expect(requires(auditPolicy,
    /explicitly accepted structure-preserving work/i,
    /old revision green before (?:edits|changes)/i,
    /(?:same|identical) checks green on the new revision/i,
    /(?:artifact|equivalence) evidence/i,
  )).toBe(true);
  expect(audit).toMatch(/missing|absent/i);
  expect(audit).toMatch(/noncompliance|UNKNOWN/i);
  expect(audit).toMatch(/applicable[^.]*evidence path|evidence path[^.]*applicable/i);
});
