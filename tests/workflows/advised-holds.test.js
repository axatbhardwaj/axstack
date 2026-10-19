import { expect, test } from 'bun:test';
import { readSkillFile as readFileSync } from './skill-source.js';
import { checkRule, loadedReferences, prohibits, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const contracts = () => read('skills/axstack/references/contracts.md').replace(/\s+/g, ' ');
const advised = () => contracts().split('## Advised holds')[1]?.split('## Serious risk')[0] ?? '';

// Each declared instruction is checked against its real source, removal,
// inversion and equivalent wording. This proves prose contracts, not live agents.
// Embedded lookalikes must not count as instruction keywords or negation.
function rule(name, concepts, rewording, ban, inversions = []) {
  test(name, () => {
    const accepts = (text) => ban ? prohibits(text, ban, ...concepts) : requires(text, ...concepts);
    checkRule(advised(), accepts, rewording,
      [...(ban ? [[ban, 'permit'], [ban, 'whenever']] : [[/^/, 'Do not ']]),
        ...concepts.map((concept) => [new RegExp(concept.source, 'gi'), 'other$&wise']),
        ...inversions], concepts);
  });
}

rule('Usage: eligible verification not proven gets the existing card advice lines',
  [/\badd\b/i, /\bexisting card\b/i, /\bRecommended\b/, /\bTrade-off\b/, /\bChecks would miss\b/, /\bnumbered\b.*\bReply\b/i],
  'Add Recommended, Trade-off, Checks would miss and numbered Reply lines to the existing card.');
rule('4.1: advise user holds with two or more executable paths',
  [/\badvise\b/i, /\bhold reaches the user\b/i, /\btwo or more paths\b/i, /\bagent\b.*\bcarry out\b/i],
  'Advise when a hold reaches the user and the reply picks two or more paths an agent can carry out.');
rule('4.1: criterion governs examples', [/\bcriterion governs\b/i, /\bexamples\b.*\billustrative\b/i],
  'The criterion governs and the examples are illustrative.');
rule('4.6: exhaustive exclusions follow the cause', [/\bnever-advised list\b/i, /\bexhaustive\b/i, /\bcause\b/i, /\breply\b.*\bwording\b/i],
  'The never-advised list is exhaustive and follows the cause rather than reply option wording.', /\bnever-advised\b/i);

const exclusions = [
  ['approval', /\bspec approval\b.*\bnpm stage approval\b.*\bcollaborator approval\b/i, 'spec approval, npm stage approval or collaborator approval'],
  ['access', /\baccess\b.*\bcredentials\b/i, 'access or credentials'],
  ['forge', /\bforge merges by the user\b/i, 'forge merges by the user'],
  ['off', /\bAuto-merge: off\b/i, 'Auto-merge: off'],
  ['report bases', /\bwork-promotion\b.*\bdeploying-base\b.*\bunknown-base\b.*\breport cards\b/i, 'work-promotion, deploying-base or unknown-base report cards'],
  ['ratings', /\breport-only comment-rating card\b/i, 'the report-only comment-rating card'],
  ['models', /\bmodel unavailability\b.*\bsubstitution\b/i, 'model unavailability or substitution'],
  ['stops', /\bdenied actions\b.*\bexplicit user stops\b/i, 'denied actions or explicit user stops'],
  ['peer', /\bpeer-review holds\b/i, 'peer-review holds'],
  ['manager', /\breview-manager pass holds\b/i, 'review-manager pass holds'],
];
for (const [name, concept, wording] of exclusions) {
  rule(`4.1: never advise ${name}`, [/\badvise\b/i, concept],
    `Never advise ${wording}.`, /\bnever\b/i);
}
rule('4.1: driver dispositions only advise if raised to the user',
  [/\bdiligence\b.*\bUNKNOWN\b/i, /\bLearning\b.*\bcontradiction\b/i, /\bdriver dispositions\b/i, /\bonly if\b.*\buser\b.*\bhold\b/i],
  'Diligence UNKNOWN and a Learning contradiction remain driver dispositions, advised only if raised to the user as a hold.');
rule('close gaps then form own assessment before advice',
  [/\bbefore\b.*\b(?:advice|consult)\b/i, /\bdriver\b.*\bcloses\b.*\bgap\b/i, /\bexisting\b.*\brules\b/i, /\bthen\b.*\bown assessment\b/i],
  'Before advice the driver closes the gap under existing rules where possible, then forms its own assessment.');
rule('pre-advice gap-closing does not spend the advice-driven action',
  [/\bpre-advice gap-closing\b/i, /\bspends\b.*\bone advice-driven action\b/i],
  'The pre-advice gap-closing never spends the one advice-driven action.', /\bnever\b/i);
rule('mixed adviser seats are independent and equally briefed',
  [/\bmixed\b/i, /\baxstack-advisor-astra\b/i, /\baxstack-advisor-opus\b/i, /\bindependently\b/i, /\bsame bounded evidence\b.*\bquestion\b/i],
  'In mixed consult axstack-advisor-astra and axstack-advisor-opus independently with the same bounded evidence packet and question.');
rule('independence excludes cross-reading', [/\badvisers\b/i, /\bcross-read\b/i],
  'Advisers never cross-read one another.', /\bnever\b/i);
rule('adviser packet and question omit the driver pick',
  [/\bevidence packet and question\b/i, /\bomit\b/i, /\bdriver\b.*\bown pick\b/i],
  "The driver's own pick is what the evidence packet and question omit.");
rule('single-provider intentional absence', [/\bsingle-provider\b/i, /\bone configured adviser\b/i, /\bother\b.*\bintentional absence\b/i],
  'Single-provider presets use the one configured adviser and record the other as an intentional absence.');
rule('4.2: high stakes overrides ordinary seats',
  [/\bhigh-stakes\b.*\bsingle-provider\b/i, /\baxstack-advisor-astra\b/i, /\baxstack-escalation-fable\b/i, /\bplain AGREE\b/i, /\bbounded checks\b/i],
  'For high-stakes holds including single-provider, use axstack-advisor-astra and axstack-escalation-fable plain AGREE after bounded checks.');
rule('4.2: high stakes retains card wait and authority rules',
  [/\bhigh-stakes\b/i, /\bcard\b.*\bwait\b.*\bauthority\b.*\bstill apply\b/i],
  'For high-stakes holds the card, wait and authority rules here still apply.');
rule('4.2: high-stakes split is explicitly unresolved',
  [/\bAstra\b.*\bFable\b.*\bdisagree\b/i, /\bboth options\b/i, /\bdriver\b.*\bpick first\b/i, /\bhigh-stakes: no AGREE\b/i],
  'If Astra and Fable still disagree, show both options with the driver pick first marked high-stakes: no AGREE.', /\bno AGREE\b/i);
rule('4.2: user pick resolves high stakes explicitly', [/\buser\b.*\bpick\b/i, /\bexplicit user decision\b/i],
  'The user pick is the explicit user decision.');
rule('4.2: driver pick is not AGREE', [/\bdriver\b.*\bpick\b/i, /\bcounts as AGREE\b/i],
  'The driver pick never counts as AGREE.', /\bnever\b/i);
rule('4.2: ordinary split presents reasons and driver pick first',
  [/\bnon-high-stakes\b.*\bsplit\b/i, /\bboth options\b/i, /\bone-line reasons\b/i, /\bdriver\b.*\bpick first\b/i],
  'On a non-high-stakes split show both options with one-line reasons and the driver pick first.');
rule('single-provider disagreement displays both options with driver first',
  [/\bsingle-provider adviser\b/i, /\bdisagreement with the driver\b/i, /\bshow both options\b/i, /\bone-line reasons\b/i, /\bdriver\b.*\bpick first\b/i, /\bas on a split\b/i],
  'For a single-provider adviser disagreement with the driver, show both options with one-line reasons and the driver pick first, as on a split.');

rule('4.6: advice grants no authority', [/\badvice\b/i, /\bclears\b.*\bhold\b/i, /\bgrants\b.*\bapproval\b.*\bmerge\b.*\buser-accepted unproven\b/i],
  'Advice never clears a hold or grants approval, merge or user-accepted unproven.', /\bnever\b/i);
rule('4.6: silence never applies advice', [/\bsilence\b/i, /\bapplies\b.*\brecommendation\b/i],
  'Silence never applies the recommendation.', /\bnever\b/i);
rule('4.6: reply clears only bound cause', [/\buser reply\b/i, /\bclears only\b.*\bbound cause\b/i],
  'A user reply clears only its bound cause.');
rule('multiple cards bind replies to PR or hold key', [/\bmultiple\b.*\bcards\b/i, /\breply\b.*\bPR\b/i, /\bhold key\b.*\bwithout a PR\b/i],
  'With multiple open cards each reply names its PR, or the hold key for a hold without a PR.', /\bwithout a PR\b/i);
rule('4.6: ambiguous reply clears nothing and asks once', [/\bambiguous reply\b/i, /\bclears nothing\b/i, /\bdriver asks once\b/i],
  'An ambiguous reply clears nothing and the driver asks once.');
rule('4.3: hung seat waits at most one bound wake', [/\brun watch armed\b/i, /\bwait\b.*\bat most\b/i, /\bnext bound watch wake\b/i, /\bpost\b.*\bcard\b/i],
  'With a run watch armed wait at most until the next bound watch wake, then post the card.');
rule('4.3: no-watch card is immediate', [/\bwatch armed\b/i, /\bpost\b.*\bcard\b.*\bat once\b/i],
  'With no watch armed post the card at once.', /\bno\b/i,
  [[/^.*$/, 'With a watch armed post the card at once and not at the next wake.']]);
rule('4.3: running seat remains pending on card', [/\brunning seat\b/i, /\bcard\b/i, /\badvice pending: <seat>(?!\w)/i],
  'A running seat shows advice pending: <seat> on the card.');
rule('4.4: failed or unavailable seat is labelled', [/\bfailed or unavailable seat\b/i, /\bcard\b/i, /\badvice unavailable: <seat>(?!\w)/i],
  'A failed or unavailable seat shows advice unavailable: <seat> on the card.');
rule('one attempt per seat', [/\bone attempt per seat\b/i, /\bautomatic retry\b.*\bsubstitution\b/i],
  'Make one attempt per seat with no automatic retry or substitution.', /\bno\b/i,
  [[/^.*$/, 'Make one attempt per seat, then an automatic retry or substitution with another seat.']]);
rule('4.7: late advice is an addendum without another hold or alert',
  [/\blate advice\b/i, /\baddendum\b.*\bdriver thread\b/i, /\bnew hold\b.*\bsecond alert\b/i],
  'Late advice is an addendum in the driver thread, never a new hold or second alert.', /\bnever\b/i);
rule('pending dispatches settle durably', [/\bpending dispatches\b/i, /\brun record\b/i, /\bsettle\b.*\bterminate\b/i],
  'Keep pending dispatches in the run record and settle them when they terminate.');
rule('unavailable seat records later model gap', [/\bunavailable seat\b/i, /\bmodel gap\b/i, /\blater work\b.*\bseat\b/i],
  'Record an unavailable seat as a model gap for later work needing that seat.');
rule('advice gap cannot block card or reply', [/\badvice gap\b/i, /\bblocks\b.*\bcard\b.*\buser\b.*\breply\b/i],
  'An advice gap never blocks the card or the user reply.', /\bnever\b/i);
rule('4.5: stable evidence reuses advice', [/\breuse\b.*\badvice receipt\b/i, /\bcause\b.*\bevidence packet\b.*\bpatch-id\b.*\bunchanged\b/i],
  'Reuse an advice receipt while its cause and evidence packet including patch-id are unchanged.');
rule('4.5: changed evidence authority or question requires fresh advice', [/\bchanged evidence\b.*\bauthority\b.*\bquestion\b/i, /\bfresh advice\b/i],
  'Changed evidence, authority or question requires fresh advice.');
rule('round-4 card reuses step-back advice with delta brief', [/\bround-4 card\b/i, /\breuses\b.*\bstep-back advisers\b/i, /\bdelta-only brief\b/i],
  'The round-4 card reuses step-back advisers with a delta-only brief.');
rule('head or base changes supersede the card',
  [/\bhead or base change\b/i, /\bsupersede the card\b/i, /\bexisting supersede rules\b/i],
  'Under the existing supersede rules, a head or base change requires the driver to supersede the card.');
rule('reissue only a still-needed decision at current revisions',
  [/\breissue the card\b/i, /\bonly if\b.*\bdecision is still needed\b/i, /\bcurrent head and base\b/i],
  'At the current head and base, reissue the card only if the decision is still needed.');
rule('reissued cards reuse unchanged advice',
  [/\breuse unchanged advice\b/i, /\breissuing the card\b/i],
  'When reissuing the card, reuse unchanged advice.');
rule('same-cause reissued card is the same hold without a new alert',
  [/\breissued card\b/i, /\bsame cause\b/i, /\bsame hold\b/i, /\bsends\b.*\bnew alert\b/i],
  'For the same cause, the reissued card is the same hold and sends no new alert.', /\bno\b/i);
rule('superseded-head or base reply clears nothing at new revisions',
  [/\breply bound to a superseded head or base\b/i, /\bclears nothing\b/i, /\bnew head or base\b/i],
  'At the new head or base, a reply bound to a superseded head or base clears nothing.');
rule('4.7: self-close is bounded and agreed',
  [/\bafter advice\b/i, /\bper PR and cause kind\b/i, /\bonce\b/i, /\bclose\b.*\bcause\b/i, /\bexisting authority\b/i, /\bonly\b.*\badvisers agree\b/i],
  'After advice, per PR and cause kind the driver can act once to close the cause within existing authority only when advisers agree.');
rule('4.7: single adviser agrees with driver for self-close', [/\bsingle-provider\b/i, /\bself-close\b/i, /\badviser\b.*\bmust agree\b.*\bdriver\b/i],
  'In single-provider presets self-close requires the adviser must agree with the driver.');
rule('4.7: split or single-adviser disagreement raises card',
  [/\bpost the card\b/i, /\bsplit or a single-adviser disagreement\b/i, /\bwith the driver\b/i],
  'Post the card when there is a split or a single-adviser disagreement with the driver.');
rule('4.7: cause recurrence after the advice-driven action raises card',
  [/\bpost the card\b/i, /\bcause recurs after that one action\b/i],
  'If the cause recurs after that one action, post the card.');
rule('4.7: action raising a new hold raises card',
  [/\bpost the card\b/i, /\baction raises a new hold\b/i],
  'When the action raises a new hold, post the card.');
rule('4.7: serious risk raises immediately across phases before advice',
  [/\boutside peer mode\b/i, /\bserious-risk\b.*\bimmediately\b/i, /\bwatch\b.*\bimplement\b.*\breview\b.*\bautopilot\b.*\bdebug\b/i, /\bbefore\b.*\badvisers\b/i],
  'Outside peer mode raise every serious-risk hold immediately in watch, implement, review, autopilot or debug before dispatching advisers.');
rule('serious risk categories stay complete', [/\bserious-risk\b/i, /\bsecurity\b.*\bdowntime\b.*\bdata loss\b.*\bmajor design\b/i],
  'Serious-risk holds include security, downtime, data loss and major design.');
rule('serious risk advice is addendum with no second alert', [/\bserious-risk advice\b/i, /\baddendum\b/i, /\bsecond alert\b/i],
  'Serious-risk advice follows as an addendum with no second alert.', /\bno\b/i,
  [[/^.*$/, 'Serious-risk advice follows as an addendum and a second alert announcement.']]);

const pointers = [
  ['skills/axstack-watch/SKILL.md', [
    ['## 4.', '## 5.'],
    ['The driver first closes a verification gap', '### Escalation'],
    ['Post a merge card', '### Blocked on a person'],
  ]],
  ['skills/axstack-implement/SKILL.md', [
    ['`INCOMPLETE`, a provenance gap', 'The T3 run watch'],
    ['Follow [Route each wake]', 'Merge-ready opens'],
  ]],
  ['skills/axstack-review/SKILL.md', [
    ['Every brief ends', '## Template: review receipt'],
    ['## Prompt-only urgent escalation', 'Under a manager PR job'],
  ]],
];
for (const [path, sections] of pointers) {
  for (const [anchor, end] of sections) test(`contract pointer: ${path} at ${anchor}`, () => {
    const source = read(path);
    const start = source.indexOf(anchor);
    const stop = source.indexOf(end, start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(stop).toBeGreaterThan(start);
    const window = source.slice(start, stop);
    const link = '../axstack/references/contracts.md#advised-holds';
    expect(loadedReferences(window)).toContain(link);
    const directive = window.match(/Follow \[Advised holds\]\([^)]*\)[^.]*\./)?.[0];
    expect(directive).toBeDefined();
    expect(loadedReferences(window.replace(directive, ''))).not.toContain(link);
    expect(loadedReferences(window.replace(directive, `Never ${directive}`))).not.toContain(link);
    expect(loadedReferences(window.replace(directive, directive.replace('Follow', 'Consult')))).toContain(link);
  });
}
