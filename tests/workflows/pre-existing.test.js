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
// Each case rejects removal, inversion and keywords hidden inside larger words,
// while accepting equivalent wording.
const rule = (name, source, concepts, rewording, direction, inverse, prohibition) => {
  source = source.replace(/`/g, '').replace(/\s+/g, ' ');
  test(`Pre-existing: ${name} (removal/inversion red, rewording green)`, () => {
    const keywordInversions = [direction, ...concepts].map((pattern) =>
      [new RegExp(pattern.source, `${pattern.flags}g`), `x${rewording.match(pattern)[0]}x`]);
    checkRule(source, (text) => prohibition
      ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts),
    rewording, [[direction, inverse], ...keywordInversions], concepts);
  });
};

rule('validated own medium/high is an approval exception', severity,
  [/\bmedium\b/i, /\bhigh\b/i, /\bblock\b/i, /\bAPPROVE\b/i, /\bexcept\b/i, /\bvalidated\b/i, /\bPre-existing\b/i, /\bauthored mode\b/i],
  'Medium and high findings block APPROVE except validated Pre-existing findings in authored mode.',
  /\bexcept\b/i, 'including');
rule('same-run defect at the parent head cannot qualify', severity,
  [/\bown run PRs\b/i, /\breference revision\b/i, /\bSource base\b/i, /\brather than\b/i, /\bparent head\b/i],
  "For own run PRs the reference revision is the run's Source base rather than a chain child's parent head.",
  /\bSource base\b/i, 'current base');

rule('adopted and peer use merge-base with default branch', severity,
  [/\badopted own PRs\b/i, /\bpeer PRs\b/i, /\breference revision\b/i, /\bmerge-base\b/i, /\bPR head\b/i, /\bdefault branch\b/i],
  'For adopted own PRs and peer PRs the reference revision is the merge-base of the PR head with the default branch.',
  /\bdefault branch\b/i, 'parent branch');
rule('disposition preserves severity', severity,
  [/\bPre-existing\b/i, /\bdisposition\b/i, /\bseverity\b/i],
  'Pre-existing is a disposition, not a severity.', /\bnot a severity\b/i, 'also a severity', /\bnot a severity\b/i);
rule('prove the defect at the reference revision', severity,
  [/\bprove\b/i, /\bdefect itself\b/i, /\breference revision\b/i, /\bquoted code\b/i, /\bplus\b/i, /\breproduction or\b.*\bsame-input argument\b/i],
  'Prove the defect itself exists at the reference revision using quoted code there plus reproduction or a same-input argument.',
  /\bplus\b/i, 'instead of');
rule('blame alone is insufficient', severity, [/\bblame alone\b/i],
  'Blame alone is not enough.', /\bnot enough\b/i, 'enough', /\bnot enough\b/i);
rule('diff leaves defective code unchanged', severity,
  [/\bdiff\b/i, /\bdefective code\b/i], 'The diff must not change the defective code.',
  /\bmust not change\b/i, 'can change', /\bmust not change\b/i);
rule('changed callers and configuration cannot cause the defect', severity,
  [/\bdiff\b/i, /\bintroduce\b/i, /\bamplify\b/i, /\bnewly expose\b/i, /\bdefect\b/i, /\bchanged callers or configuration\b/i],
  'The diff must not introduce, amplify or newly expose the defect through changed callers or configuration.',
  /\bmust not\b/i, 'can', /\bmust not\b/i);
for (const [name, subject, report] of [
  ['scope target', /\bdefect\b.*\baccepted scope targets\b.*\bpeer\b.*\blinked issue\b.*\bstated purpose\b/i,
    'the defect the accepted scope targets (peer: linked issue or stated purpose)'],
  ['acceptance dependency', /\bdefect\b.*\bacceptance check depends on\b/i, 'a defect an acceptance check depends on'],
  ['same-class instance inside diff', /\banother instance\b.*\bsame defect class inside the diff\b/i,
    'another instance of the same defect class inside the diff'],
  ['amplified or newly exposed', /\bamplified or newly exposed defects\b/i, 'amplified or newly exposed defects'],
]) {
  rule(`exclude ${name}`, severity, [/\bexclude\b/i, subject, /\bPre-existing\b/i],
    `Exclude ${report} from Pre-existing.`, /\bexclude\b/i, 'Include');
}
rule('sweep precedes disposition including peer candidates', severity,
  [/\bdefect-class sweep\b/i, /\bbefore\b/i, /\bfinding takes\b/i, /\bPre-existing\b/i, /\bpeer candidates\b/i],
  'Run the defect-class sweep before a finding takes Pre-existing, including peer candidates.',
  /\bbefore\b/i, 'after');
rule('failed proof only denies disposition', severity,
  [/\bfailed proof\b/i, /\bdenies\b/i, /\bdisposition\b/i, /\braises a rating\b/i, /\bcreates a peer blocker\b/i],
  'Failed proof denies the disposition, never raises a rating or creates a peer blocker by itself.',
  /\bnever\b/i, 'always', /\bnever\b/i);
rule('reviewer alone applies the tag', severity,
  [/\bonly\b.*\breviewer\b/i, /\bapplies\b/i, /\bPre-existing tag\b/i],
  'Only the reviewer applies the Pre-existing tag.', /\bonly\b.*\breviewer\b/i, 'The author');
rule('author cannot self-tag', severity, [/\bauthor\b/i, /\bself-tags\b/i],
  'The author never self-tags.', /\bnever\b/i, 'always', /\bnever\b/i);
rule('validated own findings need no fix or re-review', severity,
  [/\bfix\b/i, /\bre-review\b/i, /\bevery\b/i, /\bmedium\b/i, /\bhigh\b/i, /\bexcept\b/i, /\bvalidated\b/i, /\bPre-existing\b/i, /\bauthored mode\b/i],
  'Fix and re-review every medium or high finding except validated Pre-existing findings in authored mode.',
  /\bexcept\b/i, 'including');
rule('authored serious risk still holds', severity,
  [/\bauthored mode\b/i, /\bserious-risk categories\b/i, /\braise\b/i, /\bserious-risk hold\b/i, /\bPre-existing\b/i],
  'In authored mode serious-risk categories still raise the serious-risk hold for Pre-existing findings.',
  /\braise\b/i, 'waive');
rule('diligence contests unsupported or excluded tags', diligence,
  [/\bdiligence\b/i, /\bFINDINGS\b/i, /\bPre-existing tag\b/i, /\blacks evidence\b/i, /\bhits an exclusion\b/i],
  'Diligence returns FINDINGS to contest a Pre-existing tag that lacks evidence or hits an exclusion.',
  /\bFINDINGS\b/i, 'PASS');
rule('receipt carries evidence and reference or none', review.split('## Template: review receipt')[1].split('## Prompt-only')[0],
  [/\bPre-existing:/i, /\beach item\b/i, /\breference revision\b/i, /\bevidence\b/i, /\bnone\b/i],
  'Pre-existing: <each item with reference revision and evidence, or none>',
  /\breference revision\b/i, 'current head only');
rule('human change requests still hold', watch,
  [/\bhuman\b/i, /\bCHANGES_REQUESTED\b/i, /\bholds automatic merge\b/i, /\buntil resolved\b/i],
  'Human CHANGES_REQUESTED holds automatic merge until resolved.',
  /\bholds automatic merge\b/i, 'permits automatic merge');
rule('bot and human pre-existing comments keep their ratings', watch,
  [/\bbot or human comment\b/i, /\bPre-existing\b/i, /\bholds merge\b/i, /\bown rating\b/i],
  'A bot or human comment about Pre-existing still holds merge under its own rating.',
  /\bholds merge\b/i, 'permits merge');
rule('post-Source-base default-branch defects follow normal rules', severity,
  [/\bown run PRs\b/i, /\bdefault branch after\b/i, /\bSource base\b/i, /\bnormal rules\b/i],
  'On own run PRs defects others land on the default branch after Source base follow normal rules.',
  /\bnormal rules\b/i, 'Pre-existing rules');

rule('peer additions are first review only', peer,
  [/\bPre-existing notes\b/i, /\bfirst review only\b/i],
  'Add Pre-existing notes on the first review only.', /\bfirst review only\b/i, 'every review');
rule('follow-up and fallback never re-ask or add notes', peer,
  [/\bfollow-ups\b/i, /\bsingle-reviewer full-diff fallback\b/i, /\bPre-existing notes\b/i, /\brepeat\b.*\bearlier note or request\b/i],
  'Follow-ups and the single-reviewer full-diff fallback never add Pre-existing notes or repeat an earlier note or request.',
  /\bnever\b/i, 'always', /\bnever\b/i);
rule('validated peer defects only block for serious risk', peer,
  [/\bvalidated Pre-existing defect\b/i, /\bblocks\b/i, /\bexcept\b/i, /\bserious security\b/i, /\bdata-loss\b/i, /\bfunds\b/i],
  'A validated Pre-existing defect never blocks except for serious security, data-loss or funds defects.',
  /\bnever blocks\b/i, 'always blocks', /\bnever blocks\b/i);
rule('draft eligibility stops at direct callers and callees', peer,
  [/\bonly defects\b/i, /\bchanged files\b/i, /\bdirect callers and callees\b/i, /\bPre-existing draft\b/i],
  'Only defects in changed files or their direct callers and callees get a Pre-existing draft.',
  /\bdirect\b/i, 'transitive');
rule('one trailing block carries at most two drafts', peer,
  [/\bone trailing\b/i, /\bPre-existing block\b/i, /\bat most two drafts\b/i],
  'Use one trailing Pre-existing block with at most two drafts.', /\bat most two\b/i, 'at most three');
rule('drafts are exempt from note and word budgets', peer,
  [/\bPre-existing block\b/i, /\bexempt\b/i, /\bfive-note limit\b/i, /\bword budget\b/i],
  'The Pre-existing block is exempt from the five-note limit and the word budget.',
  /\bexempt\b/i, 'counted');
rule('overflow and out-of-range defects stay on one line', peer,
  [/\ball other validated Pre-existing defects\b/i, /\bnon-blocking\b/i, /\bunselected eligible defects\b/i, /\boutside\b.*\brange\b/i, /\bone\b/i, /\bAlso pre-existing:/i],
  'On one Also pre-existing: line, put all other validated Pre-existing defects that are non-blocking, including unselected eligible defects and defects outside that range.',
  /\bone\b/i, 'several');
rule('draft makes non-causation explicit', peer,
  [/\beach draft\b/i, /\bbug is pre-existing\b/i, /\bnot caused by this PR\b/i],
  'Each draft says the bug is pre-existing and not caused by this PR.',
  /\bnot caused by this PR\b/i, 'caused by this PR', /\bnot caused by this PR\b/i);
rule('draft is a self-contained bug report', peer,
  [/\beach draft\b/i, /\bself-contained bug report\b/i, /\btitle\b/i, /\bfile:line\b/i, /\breference SHA\b/i, /\breproduction or evidence\b/i, /\bimpact\b/i],
  'Each draft gives a self-contained bug report: title, file:line, reference SHA, reproduction or evidence and impact.',
  /\breference SHA\b/i, 'current head only');
rule('draft excludes private paths', peer, [/\beach draft\b/i, /\bprivate paths\b/i],
  'Each draft contains no private paths.', /\bno\b/i, 'any', /\bno\b/i);
rule('draft names the right tracker', peer,
  [/\beach draft\b/i, /\bnames\b.*\btracker\b/i, /\bLinear for\b.*\bdefi-com\b/i, /\bGitHub Issues otherwise\b/i],
  'Each draft names the tracker: Linear for defi-com, GitHub Issues otherwise.',
  /\bLinear for\b/i, 'GitHub Issues for');
rule('author files and links the bug', peer,
  [/\beach draft\b/i, /\basks the author\b/i, /\bfile\b/i, /\blink\b.*\bPR\b/i],
  'Each draft asks the author to file it and link it in the PR.',
  /\basks the author\b/i, 'instructs the agent');
rule('publisher searches once per draft before posting', peer,
  [/\bbefore posting\b/i, /\bpublishing thread\b/i, /\bone read-only search per draft\b/i, /\bopen issue\b/i, /\bsame file or symbol\b/i, /\bsame behavio[u]?r\b/i],
  'Before posting, the publishing thread runs one read-only search per draft for an open issue on the same file or symbol and same behavior.',
  /\bone read-only\b/i, 'unlimited');
rule('existing issue replaces the filing request', peer,
  [/\bmatch\b/i, /\bdraft links\b.*\bissue\b/i, /\binstead of asking\b/i],
  'On a match the draft links the existing issue instead of asking.',
  /\binstead of asking\b/i, 'and asks again');
rule('failed tracker search still asks', peer,
  [/\bfailed search\b/i, /\btracker search failed\b/i, /\bstill asks\b/i],
  'A failed search says tracker search failed and still asks.',
  /\bstill asks\b/i, 'drops the request');
rule('failed search cannot imply absence', peer,
  [/\bfailed search\b/i, /\bimplies\b/i, /\bno issue exists\b/i],
  'A failed search never implies that no issue exists.',
  /\bnever implies\b/i, 'always implies', /\bnever implies\b.*\bno issue exists\b/i);
rule('filing request never gates approval', peer,
  [/\bfiling request\b/i, /\bAPPROVE\b/i],
  'The filing request never gates APPROVE.', /\bnever gates\b/i, 'gates', /\bnever gates\b/i);
rule('peer owner settles a disputed tag without diligence', peer,
  [/\bowner\b/i, /\bfocused check\b/i, /\bsettles\b/i, /\bdisputed\b.*\bPre-existing tag\b/i],
  "The owner's existing focused check settles a disputed Pre-existing tag.",
  /\bsettles\b/i, 'ignores');

rule('validated agent threads never hold automatic merge', watch,
  [/\bagent-authored threads\b/i, /\bvalidated Pre-existing findings\b/i, /\bhold automatic merge\b/i],
  'For validated Pre-existing findings, agent-authored threads do not hold automatic merge.',
  /\bdo not\b/i, 'still', /\bdo not\b/i);
rule('peer serious-risk ping retains its security/funds threshold', peer,
  [/\bpeer serious-risk ping\b/i, /\bkeeps\b/i, /\bsecurity\/funds threshold\b/i],
  'The security/funds threshold is what the peer serious-risk ping keeps.',
  /\bkeeps\b/i,
  'extends to every validated Pre-existing defect');
rule('peer closed points stay closed under follow-up rules', peer,
  [/\bkeep\b/i, /\bclosed points closed\b/i, /\bfollow-up rules\b/i],
  'Under the follow-up rules, keep closed points closed.', /\bkeep\b/i, 'Reopen');

rule('serious inherited peer defects are labelled ordinary blockers', peer,
  [/\bpresent\b/i, /\bserious security\b/i, /\bdata-loss\b/i, /\bfunds\b/i,
    /\bPre-existing defect\b/i, /\bordinary blocker\b/i, /\bsays it is pre-existing\b/i],
  'Present a Pre-existing defect involving serious security, data-loss or funds as an ordinary blocker that says it is pre-existing.',
  /\bordinary blocker\b/i, 'non-blocking note');
rule('serious inherited blockers stay out of drafts and Also entries', peer,
  [/\bserious security\b/i, /\bdata-loss\b/i, /\bfunds blockers\b/i,
    /\bdraft\b/i, /\bAlso pre-existing:/i, /\bentry\b/i],
  'For serious security, data-loss or funds blockers, a draft or an Also pre-existing: entry is never added.',
  /\bnever\b/i, 'always', /\bnever\b/i);
rule('overflow peer drafts select the two highest-rated eligible defects', peer,
  [/\bmore than two\b/i, /\bnon-blocking defects\b/i, /\bqualify for drafts\b/i,
    /\bselect the two\b/i, /\bhighest rating\b/i],
  'Select the two with the highest rating when more than two non-blocking defects qualify for drafts.',
  /\bhighest\b/i, 'lowest');
rule('draft rating ties use first appearance in the diff', peer,
  [/\bbreak rating ties\b/i, /\bfirst appearance\b/i, /\bdiff\b/i],
  'Use first appearance in the diff to break rating ties.', /\bfirst\b/i, 'last');
rule('Also line closes the trailing exempt block', peer,
  [/\bAlso pre-existing:/i, /\bline last\b/i, /\btrailing Pre-existing block\b/i],
  'In the trailing Pre-existing block, place the Also pre-existing: line last.',
  /\blast\b/i, 'first');
rule('Also entries contain a title and location', peer,
  [/\beach Also pre-existing:/i, /\bentry\b/i, /\btitle\b/i, /\bfile:line\b/i],
  'A title and file:line are what each Also pre-existing: entry gives.',
  /\bfile:line\b/i, 'private receipt path');
rule('Also entries have neither tracker searches nor filing requests', peer,
  [/\bAlso pre-existing:/i, /\bentries\b/i, /\btracker search\b/i, /\bfiling request\b/i],
  'For Also pre-existing: entries, use no tracker search or filing request.',
  /\bno\b/i, 'a', /\bno\b/i);
rule('own-run diff checks span the reference revision through PR head', severity,
  [/\bown run PRs\b/i, /\ball Pre-existing diff checks\b/i,
    /\breference revision to the PR head\b/i, /\bunchanged defective code\b/i,
    /\bintroduction\b/i, /\bamplification\b/i, /\bnew exposure\b/i, /\bsame-class instances\b/i],
  'All Pre-existing diff checks for own run PRs span the reference revision to the PR head: unchanged defective code, introduction/amplification/new exposure and same-class instances.',
  /\breference revision to the PR head\b/i, 'PR head to the reference revision');
