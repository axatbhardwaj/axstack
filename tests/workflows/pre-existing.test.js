import { test } from 'bun:test';
import { readSkillFile as readFileSync } from './skill-source.js';
import { checkRule, prohibits, requires } from './prose-contract.js';

const review = readFileSync(`${import.meta.dir}/../../skills/axstack-review/SKILL.md`, 'utf8');
const diligence = readFileSync(`${import.meta.dir}/../../skills/axstack/references/diligence.md`, 'utf8');
const watch = readFileSync(`${import.meta.dir}/../../skills/axstack-watch/SKILL.md`, 'utf8')
  .split('## 5. State readiness precisely')[1].split('## 6.')[0];
const severity = review.split('## Finding severity')[1].split('## Codebase findings mode')[0];

// The shipped instructions are the public boundary, not a simulated reviewer.
// Each case rejects removal and inversion and accepts equivalent wording.
const rule = (name, source, concepts, rewording, direction, inverse, prohibition) => {
  source = source.replace(/`/g, '').replace(/\s+/g, ' ');
  test(`Pre-existing: ${name} (removal/inversion red, rewording green)`, () => {
    checkRule(source, (text) => prohibition
      ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts),
    rewording, [[direction, inverse]], concepts);
  });
};

rule('validated own medium/high is an approval exception', severity,
  [/medium/i, /high/i, /block/i, /APPROVE/i, /except/i, /validated/i, /Pre-existing/i, /authored mode/i],
  'Medium and high findings block APPROVE except validated Pre-existing findings in authored mode.',
  /except/i, 'including');
rule('same-run defect at the parent head cannot qualify', severity,
  [/own run PRs/i, /reference revision/i, /Source base/i, /rather than/i, /parent head/i],
  "For own run PRs the reference revision is the run's Source base rather than a chain child's parent head.",
  /Source base/i, 'current base');

rule('adopted and peer use merge-base with default branch', severity,
  [/adopted own PRs/i, /peer PRs/i, /reference revision/i, /merge-base/i, /PR head/i, /default branch/i],
  'For adopted own PRs and peer PRs the reference revision is the merge-base of the PR head with the default branch.',
  /default branch/i, 'parent branch');
rule('disposition preserves severity', severity,
  [/Pre-existing/i, /disposition/i, /severity/i],
  'Pre-existing is a disposition, not a severity.', /not a severity/i, 'also a severity', /not a severity/i);
rule('prove the defect at the reference revision', severity,
  [/prove/i, /defect itself/i, /reference revision/i, /quoted code/i, /plus/i, /reproduction or.*same-input argument/i],
  'Prove the defect itself exists at the reference revision using quoted code there plus reproduction or a same-input argument.',
  /plus/i, 'instead of');
rule('blame alone is insufficient', severity, [/blame alone/i],
  'Blame alone is not enough.', /not enough/i, 'enough', /not enough/i);
rule('diff leaves defective code unchanged', severity,
  [/diff/i, /defective code/i], 'The diff must not change the defective code.',
  /must not change/i, 'can change', /must not change/i);
rule('changed callers and configuration cannot cause the defect', severity,
  [/diff/i, /introduce/i, /amplify/i, /newly expose/i, /defect/i, /changed callers or configuration/i],
  'The diff must not introduce, amplify or newly expose the defect through changed callers or configuration.',
  /must not/i, 'can', /must not/i);
for (const [name, subject, report] of [
  ['scope target', /defect.*accepted scope targets.*peer.*linked issue.*stated purpose/i,
    'the defect the accepted scope targets (peer: linked issue or stated purpose)'],
  ['acceptance dependency', /defect.*acceptance check depends on/i, 'a defect an acceptance check depends on'],
  ['same-class instance inside diff', /another instance.*same defect class inside the diff/i,
    'another instance of the same defect class inside the diff'],
  ['amplified or newly exposed', /amplified or newly exposed defects/i, 'amplified or newly exposed defects'],
]) {
  rule(`exclude ${name}`, severity, [/exclude/i, subject, /Pre-existing/i],
    `Exclude ${report} from Pre-existing.`, /exclude/i, 'Include');
}
rule('sweep precedes disposition including peer candidates', severity,
  [/defect-class sweep/i, /before/i, /finding takes/i, /Pre-existing/i, /peer candidates/i],
  'Run the defect-class sweep before a finding takes Pre-existing, including peer candidates.',
  /before/i, 'after');
rule('failed proof only denies disposition', severity,
  [/failed proof/i, /denies/i, /disposition/i, /raises a rating/i, /creates a peer blocker/i],
  'Failed proof denies the disposition, never raises a rating or creates a peer blocker by itself.',
  /never/i, 'always', /never/i);
rule('reviewer alone applies the tag', severity,
  [/only.*reviewer/i, /applies/i, /Pre-existing tag/i],
  'Only the reviewer applies the Pre-existing tag.', /only.*reviewer/i, 'The author');
rule('author cannot self-tag', severity, [/author/i, /self-tags/i],
  'The author never self-tags.', /never/i, 'always', /never/i);
rule('validated own findings need no fix or re-review', severity,
  [/fix/i, /re-review/i, /every/i, /medium/i, /high/i, /except/i, /validated/i, /Pre-existing/i, /authored mode/i],
  'Fix and re-review every medium or high finding except validated Pre-existing findings in authored mode.',
  /except/i, 'including');
rule('authored serious risk still holds', severity,
  [/authored mode/i, /serious-risk categories/i, /raise/i, /serious-risk hold/i, /Pre-existing/i],
  'In authored mode serious-risk categories still raise the serious-risk hold for Pre-existing findings.',
  /raise/i, 'waive');
rule('diligence contests unsupported or excluded tags', diligence,
  [/diligence/i, /FINDINGS/i, /Pre-existing tag/i, /lacks evidence/i, /hits an exclusion/i],
  'Diligence returns FINDINGS to contest a Pre-existing tag that lacks evidence or hits an exclusion.',
  /FINDINGS/i, 'PASS');
rule('receipt carries evidence and reference or none', review.split('## Template: review receipt')[1].split('## Prompt-only')[0],
  [/Pre-existing:/i, /each item/i, /reference revision/i, /evidence/i, /none/i],
  'Pre-existing: <each item with reference revision and evidence, or none>',
  /reference revision/i, 'current head only');
rule('human change requests still hold', watch,
  [/human/i, /CHANGES_REQUESTED/i, /holds automatic merge/i, /until resolved/i],
  'Human CHANGES_REQUESTED holds automatic merge until resolved.',
  /holds automatic merge/i, 'permits automatic merge');
rule('bot and human pre-existing comments keep their ratings', watch,
  [/bot or human comment/i, /Pre-existing/i, /holds merge/i, /own rating/i],
  'A bot or human comment about Pre-existing still holds merge under its own rating.',
  /holds merge/i, 'permits merge');
rule('post-Source-base default-branch defects follow normal rules', severity,
  [/own run PRs/i, /default branch after/i, /Source base/i, /normal rules/i],
  'On own run PRs defects others land on the default branch after Source base follow normal rules.',
  /normal rules/i, 'Pre-existing rules');

