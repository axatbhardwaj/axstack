import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const section = (text, start, end) => text.split(start)[1].split(end)[0];
const align = () => section(read('skills/axstack-align/SKILL.md'), '## Read back, classify, and route', '\nAlignment completes');
const review = () => read('skills/axstack-review/SKILL.md');
const consumers = [
  ['implement §5', () => section(read('skills/axstack-implement/SKILL.md'), '## 5. Verify and return the candidate', '\n## 6.')],
  ['UI verification', () => read('skills/axstack/references/ui-verification.md')],
];
const watchCopies = ['skills/axstack-watch/SKILL.md', 'docs/workflows.md'];
const proven = (path) => section(read(path), '### Proven verification', '\nThe driver first closes');

// These contracts protect workflow handoffs, not live agent compliance. Existing
// verify-integration tests cover author development, not reviewer-owned proof.
const rules = [
  ['Align runnable scope decision', align,
    [/scope/i, /changes|alters/i, /runnable|executable/i, /behavior/i, /read.back|summary/i, /record|write/i, /Verification decision/i],
    'When scope alters executable behavior, the summary writes a Verification decision.',
    [[/runnable|executable/gi, 'static'], [/record|write/gi, 'omit']]],
  ['Align applicable skill features', align,
    [/applicable/i, /verify-<app>/i, /skill/i, /record|list/i, /features/i, /cover/i, /change/i],
    'For an applicable verify-<app> skill, list the features that cover the change.',
    [[/features/gi, 'commands'], [/cover/gi, 'ignore']]],
  ['Align absent skill first PR', align,
    [/missing|absent/i, /skill/i, /plan/i, /always|must/i, /include|add/i, /axstack-verify create/i, /first PR/i],
    'For an absent skill, the plan must add axstack-verify create as the first PR.',
    [[/first PR/gi, 'last PR'], [/always|must/gi, 'may']]],
  ['Align adviser agreement for skip', align,
    [/skipping|omitting/i, /first PR/i, /requires/i, /plain AGREE/i, /both/i,
      /axstack-advisor-astra/i, /axstack-advisor-opus/i, /verification skill/i, /unnecessary|unneeded/i],
    'Omitting this first PR requires plain AGREE from both axstack-advisor-opus and axstack-advisor-astra that a verification skill is unneeded.',
    [[/both/gi, 'either'], [/plain AGREE/gi, 'qualified agreement'], [/unnecessary|unneeded/gi, 'required']]],
  ['Align skip reason recorded', align,
    [/record|write/i, /both advisers/i, /reason/i, /Verification decision/i],
    'Write both advisers reasons in the Verification decision.',
    [[/record|write/gi, 'omit'], [/both advisers/gi, 'one adviser']]],
  ['Review base recipe at pinned head', review,
    [/verify-<app>/i, /covers/i, /affected behavior/i, /authored reviewer/i, /runs|executes/i,
      /base.revision/i, /Launch/i, /Doctor/i, /pinned final head/i, /detached checkout/i],
    'When verify-<app> covers affected behavior, the authored reviewer executes base-revision Doctor and Launch against the pinned final head in its detached checkout.',
    [[/base.revision/gi, 'candidate-revision'], [/pinned final head/gi, 'earlier head'], [/authored reviewer/gi, 'author']]],
  ['Review author excluded', review,
    [/author/i, /performs|conducts/i, /review drive/i],
    'The author never conducts this review drive.',
    [[/never/gi, 'always']], /never/i],
  ['Review every affected feature as final-head proof', review,
    [/reviewer/i, /drives|exercises/i, /each|every/i, /affected feature/i,
      /record|log/i, /drive/i, /Final-head check/i],
    'The reviewer exercises every affected feature and logs the drive as the Final-head check.',
    [[/reviewer/gi, 'author'], [/each|every/gi, 'selected'], [/Final-head check/gi, 'development check']]],
  ['Review browser feature handoff', review,
    [/delegate|send/i, /browser drives/i, /axstack-ui-verifier/i, /feature file path/i],
    'Send browser drives to axstack-ui-verifier with the feature file path.',
    [[/axstack-ui-verifier/gi, 'author'], [/feature file path/gi, 'preview URL']]],
  ['Review applicable surface spin-up', review,
    [/running|executing/i, /applicable surface/i, /counts|qualifies/i, /spin.up/i],
    'Executing the applicable surface qualifies as spin-up.', [[/applicable surface/gi, 'preview build']]],
  ['Review CLI qualifies', review,
    [/CLI run/i, /qualifies|counts/i], 'A CLI run counts.', [[/qualifies|counts/gi, 'never counts']]],
  ['Review isolated loopback', review,
    [/use|keep/i, /loopback/i, /isolated instances/i, /axstack-verify/i],
    'Keep isolated instances on loopback under axstack-verify.', [[/loopback/gi, 'public interfaces']]],
  ['Verify trusted recipe for review runs', () => read('skills/axstack-verify/SKILL.md'),
    [/review run/i, /read|load/i, /Launch recipe/i, /helpers/i, /base revision/i, /execute|run/i, /pinned candidate/i],
    'For a review run, load the Launch recipe and helpers from the base revision and run against the pinned candidate.',
    [[/base revision/gi, 'candidate revision'], [/pinned candidate/gi, 'base checkout']]],
];

for (const [owner, source] of consumers) {
  rules.push([`${owner} stale recipe maintenance finding`, source,
    [/report|raise/i, /broken or stale/i, /recipe/i, /low/i, /finding/i, /naming|names/i, /axstack-verify maintain/i],
    'Raise a broken or stale recipe as a low finding that names axstack-verify maintain.',
    [[/low/gi, 'medium'], [/axstack-verify maintain/gi, 'axstack-verify create']]]);
}
for (const path of watchCopies) {
  rules.push(
    [`${path} local result ownership`, () => proven(path),
      [/passing result/i, /must|requires/i, /reviewer/i, /or/i, /axstack-ui-verifier/i, /local drive/i, /that head/i],
      'The passing result requires a local drive at that head by the reviewer or axstack-ui-verifier.',
      [[/reviewer/gi, 'author'], [/local drive/gi, 'preview build'], [/that head/gi, 'an earlier head']]],
    [`${path} author log excluded`, () => proven(path),
      [/author/i, /log alone/i, /satisfies|fulfills/i, /requirement/i],
      'The author log alone never fulfills this requirement.', [[/never/gi, 'always']], /never/i],
    [`${path} preview excluded`, () => proven(path),
      [/preview URL/i, /satisfies|fulfills/i, /requirement/i],
      'A preview URL never fulfills this requirement.', [[/never/gi, 'always']], /never/i],
  );
}
for (const [name, start, end] of [
  ['brief', '## Template: candidate review brief', '## Template: review receipt'],
  ['receipt', '## Template: review receipt', '## Prompt-only urgent escalation'],
]) {
  rules.push([`Review ${name} applicable final-head drive`, () => section(review(), start, end),
    [/verify-<app>/i, /Final-head check/i, /record|log/i, /reviewer/i,
      /local drive/i, /each|every/i, /affected feature/i, /pinned final head/i],
    'Applicable verify-<app>: Final-head check logs the reviewer local drive of every affected feature at the pinned final head.',
    [[/reviewer/gi, 'author'], [/pinned final head/gi, 'earlier head'], [/each|every/gi, 'selected']]]);
}

for (const [name, readSource, concepts, rewording, inversions, prohibition] of rules) {
  test(`verify wiring: ${name} rejects removal/inversion and accepts rewording`, () => {
    const accepts = (text) => sentences(text).some((sentence) =>
      !/\b(?:unless|except)\b/i.test(sentence)
      && (prohibition ? prohibits(sentence, prohibition, ...concepts) : requires(sentence, ...concepts)));
    checkRule(sentences(readSource()).join('. '), accepts, rewording.replace(/\.$/, ''),
      [...inversions, [/^/, 'Do not '], [/$/, ' unless convenient']], concepts);
  });
}

test('verification guidance keeps both lockstep copies consistent', () => {
  expect(sentences(proven(watchCopies[0]))).toEqual(sentences(proven(watchCopies[1])));
  const integration = (text) => section(text, 'Use a present', '\nKeep browser recipes').trim();
  expect(integration(consumers[0][1]())).toBe(integration(consumers[1][1]()));
});
