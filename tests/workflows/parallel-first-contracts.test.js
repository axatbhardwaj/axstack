import { existsSync, readFileSync } from 'node:fs';
import { test } from 'bun:test';
import { checkRule, prohibits, requires } from './prose-contract.js';

const root = `${import.meta.dir}/../../skills/axstack/references`;
// The baseline has run-record.md, but lacks the accepted shared contract.
// Read its current guidance so baseline failure is a behavioral omission,
// rather than a missing-file/import/setup failure. P1 owns the new reference.
const source = ['parallel-first.md', 'run-record.md']
  .filter((path) => existsSync(`${root}/${path}`))
  .map((path) => readFileSync(`${root}/${path}`, 'utf8')).join('\n')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '').replace(/\s+/g, ' ');

const rules = [
  ['useful execution evidence differs from queued work',
    [/native|execution/i, /overlap/i, /queued|queue/i, /separate|distinguish/i],
    'Record native execution overlap separately from queued tasks.'],
  ['missing duration and cost evidence stays unknown',
    [/cost/i, /duration/i, /unknown/i, /receipt|evidence/i],
    'Report cost and duration as UNKNOWN without trustworthy receipts.'],
];
for (const [name, concepts, equivalent] of rules) {
  test(`parallel-first shipped contract: ${name}; removal/inversion/rewording`, () => {
    // Verbs carry direction independently of the vocabulary of each concept.
    const direction = /record|report|remain|keep|separat\w*|distinguish\w*|excluded|ineligible/gi;
    const accepts = (text) => requires(text, new RegExp(direction.source, 'i'), ...concepts);
    checkRule(source, accepts, equivalent,
      [[direction, 'need not']], concepts);
  });
}

test('parallel-first shipped contract: contributor provenance excludes self-review of the joined candidate; removal/inversion/rewording', () => {
  const exclusion = /\b(?:never review|ineligible to review|excluded from reviewing)\b/i;
  const concepts = [/\bowner\b/i, /\b(?:every|all)\b/i,
    /\bcontribut(?:ors?|ing writers?)\b/i, /\bjoined\b/i, /\bcandidate\b/i];
  const accepts = (text) => prohibits(text, exclusion, ...concepts);
  for (const equivalent of [
    'The owner and every contributing writer never review the joined candidate.',
    'Every contributor and the owner are ineligible to review the joined candidate.',
    'Every contributor and the owner are excluded from reviewing the joined candidate.',
  ]) {
    checkRule(source, accepts, equivalent,
      [[exclusion, 'may review'], [exclusion, 'can review']], concepts);
  }
});
