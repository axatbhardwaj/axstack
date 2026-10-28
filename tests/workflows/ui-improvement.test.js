import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, loadedReferences, prohibits, requires, sentences } from './prose-contract.js';

const read = (path) => {
  const full = `${import.meta.dir}/../../${path}`;
  return existsSync(full) ? sentences(readFileSync(full, 'utf8')).join('. ') : '';
};
const improve = 'skills/axstack-improve/SKILL.md';
const implement = 'skills/axstack-implement/SKILL.md';
const loop = 'skills/axstack/references/ui-improvement-loop.md';

// Instruction contracts: mutations test each real-source obligation, not live model compliance.
const discovery = [
  {
    concepts: [/UI discovery/i, /named screen or flow/i, /report-only/i],
    rewording: 'UI discovery for a named screen or flow remains report-only.',
    inversion: [/report-only/i, 'source-editing'],
  },
  {
    concepts: [/UI discovery/i, /requires/i, /axstack-ui-verifier/i, /Playwright/i, /render evidence/i, /exact revision/i],
    rewording: 'UI discovery requires Playwright render evidence from axstack-ui-verifier at the exact revision.',
    inversion: [/requires/i, 'may skip'],
  },
  {
    concepts: [/rank/i, /UI defects/i, /hierarchy/i, /typography/i, /spacing/i, /contrast/i, /responsive/i, /interaction/i, /with evidence/i, /acceptance criteria/i],
    rewording: 'Rank UI defects in hierarchy, typography, spacing, contrast, responsive layout and interaction with evidence and acceptance criteria.',
    inversion: [/with evidence/i, 'without evidence'],
  },
  {
    concepts: [/missing|failed/i, /capture/i, /unverified/i, /UI discovery/i],
    rewording: 'UI discovery labels a missing capture unverified.',
    inversion: [/unverified/i, 'verified'],
  },
];
for (const [index, rule] of discovery.entries()) {
  test(`UI discovery obligation ${index + 1} survives rewording and rejects removal/inversion`, () => {
    checkRule(read(improve), (text) => requires(text, ...rule.concepts),
      rule.rewording, [rule.inversion], rule.concepts);
  });
}

const iteration = [
  {
    concepts: [/freeze/i, /capture protocol/i, /routes/i, /fixtures/i, /viewports/i, /themes/i, /states/i],
    rewording: 'Freeze the capture protocol with routes, fixtures, viewports, themes and states.',
    inversion: [/freeze/i, 'may vary'],
  },
  {
    concepts: [/anchor/i, /task/i, /visual/i, /acceptance criteria/i, /before/i, /edit/i],
    rewording: 'Before the first edit, anchor task and visual goals to acceptance criteria.',
    inversion: [/before/i, 'after'],
  },
  {
    concepts: [/record/i, /finite/i, /attempt/i, /time budget/i, /plateau/i, /before/i, /edit/i],
    rewording: 'Before the first edit, record a finite attempt and time budget plus a plateau threshold.',
    inversion: [/finite/i, 'unlimited'],
  },
  {
    concepts: [/baseline/i, /best.known/i, /preserve|retain/i, /revision/i, /evidence/i],
    rewording: 'Preserve the baseline as the best-known revision with its evidence.',
    inversion: [/preserve|retain/i, 'discard'],
  },
  {
    concepts: [/one writer/i, /one hypothesis/i, /each attempt/i],
    rewording: 'Use one writer and one hypothesis for each attempt.',
    inversion: [/one writer/i, 'concurrent writers'],
  },
  {
    concepts: [/visual.only attempt/i, /red/i, /axstack-ui-verifier/i, /execute|run/i, /anchored acceptance check/i, /best.known/i, /before the edit/i, /record/i, /failure/i, /capture evidence/i],
    rewording: 'For a visual-only attempt, red requires axstack-ui-verifier to run the anchored acceptance check against best-known before the edit and record failure with capture evidence.',
    inversion: [/before the edit/i, 'after the edit'],
  },
  {
    concepts: [/green/i, /verifier/i, /fresh candidate/i, /pass/i, /same acceptance check/i, /all hard gates/i],
    rewording: 'Green requires the verifier to pass the same acceptance check and all hard gates on the fresh candidate.',
    inversion: [/pass/i, 'may fail'],
  },
  {
    concepts: [/observable repository behavior tests/i, /required/i, /where applicable/i],
    rewording: 'Where applicable, observable repository behavior tests are required.',
    inversion: [/required/i, 'optional'],
  },
  {
    concepts: [/browser checks/i, /red/i, /green/i, /delegated/i, /axstack-ui-verifier/i],
    rewording: 'Browser checks for red and green stay delegated to axstack-ui-verifier.',
    inversion: [/delegated/i, 'performed by the author instead of'],
  },
  {
    concepts: [/meaningful test.first check/i, /unavailable/i, /hold/i, /dependent implementation/i, /scoped decision/i],
    rewording: 'Hold dependent implementation for a scoped decision when a meaningful test-first check is unavailable.',
    inversion: [/hold/i, 'proceed with'],
  },
  {
    concepts: [/each attempt/i, /fresh renders/i, /best.known/i, /candidate/i, /same/i, /protocol/i, /exact revisions/i],
    rewording: 'Each attempt requires fresh renders of best-known and candidate exact revisions under the same protocol.',
    inversion: [/fresh renders/i, 'reused images'],
  },
  {
    concepts: [/protocol changes/i, /recapture/i, /both/i, /comparison/i],
    rewording: 'When the protocol changes, recapture both sides before comparison.',
    inversion: [/recapture/i, 'reuse'],
  },
  {
    concepts: [/independent/i, /reviewer/i, /blind/i, /A\/B/i, /random/i, /criteria/i],
    rewording: 'Give an independent reviewer a blind A/B with random labels and the anchored criteria.',
    inversion: [/blind/i, 'author-labelled'],
  },
  {
    concepts: [/functional/i, /accessibility/i, /interaction/i, /hard gates/i, /pass/i, /before/i, /keep/i],
    rewording: 'Functional, accessibility and interaction hard gates must pass before any keep decision.',
    inversion: [/must pass/i, 'may fail'],
  },
  {
    concepts: [/keep/i, /only/i, /evidence/i, /criteria/i, /improvement/i, /otherwise revert/i, /best.known/i],
    rewording: 'Keep only an evidence-backed improvement against the criteria, otherwise revert to best-known.',
    inversion: [/only/i, 'regardless of'],
  },
  {
    concepts: [/disagreement/i, /recapture/i, /budget/i, /unresolved/i, /retain/i, /best.known/i],
    rewording: 'Resolve disagreement with specific evidence and recapture within budget, then retain best-known if unresolved.',
    inversion: [/retain/i, 'replace'],
  },
  {
    concepts: [/stop/i, /goal/i, /budget/i, /plateau/i, /report/i, /unverified/i],
    rewording: 'Stop at the goal, budget exhaustion or plateau and report unverified boundaries.',
    inversion: [/stop/i, 'continue indefinitely'],
  },
];
for (const [index, rule] of iteration.entries()) {
  test(`UI iteration obligation ${index + 1} survives rewording and rejects removal/inversion`, () => {
    checkRule(read(loop), (text) => requires(text, ...rule.concepts),
      rule.rewording, [rule.inversion], rule.concepts);
  });
}

for (const [concepts, rewording, inversion] of [
  [[/screenshot alone/i, /count/i, /behavioral red/i],
    'Never count a screenshot alone as behavioral red.', [/Never/i, 'Always']],
  [[/subjective score/i, /count/i, /behavioral red/i],
    'Never count a subjective score as behavioral red.', [/Never/i, 'Always']],
  [[/retrospective checks/i, /count/i, /red/i],
    'Never count retrospective checks as red.', [/Never/i, 'Always']],
  [[/missing|failed/i, /capture/i, /uncertain/i, /comparison/i, /justify/i, /win/i],
    'A missing capture or uncertain comparison cannot justify a win.', [/cannot/i, 'can']],
  [[/numeric/i, /aesthetic score/i, /sole/i, /success/i],
    'Never use a numeric aesthetic score as the sole success criterion.', [/Never/i, 'Always']],
]) {
  test(`UI iteration evidence guard: ${rewording}`, () => {
    const negative = /cannot|never/i;
    checkRule(read(loop), (text) => prohibits(text, negative, ...concepts),
      rewording, [inversion], concepts);
  });
}

test('authorized UI implementation loads the shared loop while preserving the perf route', () => {
  const text = readFileSync(`${import.meta.dir}/../../${implement}`, 'utf8');
  expect(loadedReferences(text)).toContain('../axstack/references/ui-improvement-loop.md');
  expect(loadedReferences(text)).toContain('../axstack/references/perf-loop.md');
  expect(read(loop)).toMatch(/existing[^.]*review[^.]*verification[^.]*merge gates/i);
});
