import { test } from 'bun:test';
import { readSkillFile as readFileSync } from './skill-source.js';
import { checkRule, prohibits, requires } from './prose-contract.js';

const review = readFileSync(`${import.meta.dir}/../../skills/axstack-review/SKILL.md`, 'utf8');
const diligence = readFileSync(`${import.meta.dir}/../../skills/axstack/references/diligence.md`, 'utf8');
const watch = readFileSync(`${import.meta.dir}/../../skills/axstack-watch/SKILL.md`, 'utf8')
  .split('## 5. State readiness precisely')[1].split('## 6.')[0];
const peer = review.split('## Peer mode (colleague PR)')[1].split('## Authored mode')[0];
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

rule('peer additions are first review only', peer,
  [/Pre-existing notes/i, /first review only/i],
  'Add Pre-existing notes on the first review only.', /first review only/i, 'every review');
rule('follow-up and fallback never re-ask or add notes', peer,
  [/follow-ups/i, /single-reviewer full-diff fallback/i, /Pre-existing notes/i, /repeat.*earlier note or request/i],
  'Follow-ups and the single-reviewer full-diff fallback never add Pre-existing notes or repeat an earlier note or request.',
  /never/i, 'always', /never/i);
rule('validated peer defects only block for serious risk', peer,
  [/validated Pre-existing defect/i, /blocks/i, /except/i, /serious security/i, /data-loss/i, /funds/i],
  'A validated Pre-existing defect never blocks except for serious security, data-loss or funds defects.',
  /never blocks/i, 'always blocks', /never blocks/i);
rule('draft eligibility stops at direct callers and callees', peer,
  [/only defects/i, /changed files/i, /direct callers and callees/i, /Pre-existing draft/i],
  'Only defects in changed files or their direct callers and callees get a Pre-existing draft.',
  /direct/i, 'transitive');
rule('one trailing block carries at most two drafts', peer,
  [/one trailing/i, /Pre-existing block/i, /at most two drafts/i],
  'Use one trailing Pre-existing block with at most two drafts.', /at most two/i, 'at most three');
rule('drafts are exempt from note and word budgets', peer,
  [/Pre-existing block/i, /exempt/i, /five-note limit/i, /word budget/i],
  'The Pre-existing block is exempt from the five-note limit and the word budget.',
  /exempt/i, 'counted');
rule('overflow and out-of-range defects stay on one line', peer,
  [/all other validated Pre-existing defects/i, /outside.*range/i, /one/i, /Also pre-existing:/i],
  'Put all other validated Pre-existing defects, including outside that range, on one Also pre-existing: line.',
  /one/i, 'several');
rule('draft makes non-causation explicit', peer,
  [/each draft/i, /bug is pre-existing/i, /not caused by this PR/i],
  'Each draft says the bug is pre-existing and not caused by this PR.',
  /not caused by this PR/i, 'caused by this PR', /not caused by this PR/i);
rule('draft is a self-contained bug report', peer,
  [/each draft/i, /self-contained bug report/i, /title/i, /file:line/i, /reference SHA/i, /reproduction or evidence/i, /impact/i],
  'Each draft gives a self-contained bug report: title, file:line, reference SHA, reproduction or evidence and impact.',
  /reference SHA/i, 'current head only');
rule('draft excludes private paths', peer, [/each draft/i, /private paths/i],
  'Each draft contains no private paths.', /no/i, 'any', /no/i);
rule('draft names the right tracker', peer,
  [/each draft/i, /names.*tracker/i, /Linear for.*defi-com/i, /GitHub Issues otherwise/i],
  'Each draft names the tracker: Linear for defi-com, GitHub Issues otherwise.',
  /Linear for/i, 'GitHub Issues for');
rule('author files and links the bug', peer,
  [/each draft/i, /asks the author/i, /file/i, /link.*PR/i],
  'Each draft asks the author to file it and link it in the PR.',
  /asks the author/i, 'instructs the agent');
rule('publisher searches once per draft before posting', peer,
  [/before posting/i, /publishing thread/i, /one read-only search per draft/i, /open issue/i, /same file or symbol/i, /same behavio[u]?r/i],
  'Before posting, the publishing thread runs one read-only search per draft for an open issue on the same file or symbol and same behavior.',
  /one read-only/i, 'unlimited');
rule('existing issue replaces the filing request', peer,
  [/match/i, /draft links.*issue/i, /instead of asking/i],
  'On a match the draft links the existing issue instead of asking.',
  /instead of asking/i, 'and asks again');
rule('failed tracker search still asks', peer,
  [/failed search/i, /tracker search failed/i, /still asks/i],
  'A failed search says tracker search failed and still asks.',
  /still asks/i, 'drops the request');
rule('failed search cannot imply absence', peer,
  [/failed search/i, /implies/i, /no issue exists/i],
  'A failed search never implies that no issue exists.',
  /never implies/i, 'always implies', /never implies.*no issue exists/i);
rule('filing request never gates approval', peer,
  [/filing request/i, /APPROVE/i],
  'The filing request never gates APPROVE.', /never gates/i, 'gates', /never gates/i);
rule('peer owner settles a disputed tag without diligence', peer,
  [/owner/i, /focused check/i, /settles/i, /disputed.*Pre-existing tag/i],
  "The owner's existing focused check settles a disputed Pre-existing tag.",
  /settles/i, 'ignores');
