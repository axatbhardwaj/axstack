import { expect, test } from 'bun:test';
import { readSkillFile as readFileSync } from './skill-source.js';
import { checkRule, loadedReferences, prohibits, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const contracts = () => read('skills/axstack/references/contracts.md').replace(/\s+/g, ' ');
const advised = () => contracts().split('## Advised holds')[1]?.split('## Serious risk')[0] ?? '';

// Each declared instruction is checked against its real source, removal,
// inversion and equivalent wording. This proves prose contracts, not live agents.
function rule(name, concepts, rewording, ban) {
  test(name, () => {
    const accepts = (text) => ban ? prohibits(text, ban, ...concepts) : requires(text, ...concepts);
    checkRule(advised(), accepts, rewording,
      ban ? [[ban, 'permit']] : [[/^/, 'Do not ']], concepts);
  });
}

rule('Usage: eligible verification not proven gets the existing card advice lines',
  [/add/i, /existing card/i, /Recommended/, /Trade-off/, /Checks would miss/, /numbered.*Reply/i],
  'Add Recommended, Trade-off, Checks would miss and numbered Reply lines to the existing card.');
rule('4.1: advise user holds with two or more executable paths',
  [/advise/i, /hold reaches the user/i, /two or more paths/i, /agent.*carry out/i],
  'Advise when a hold reaches the user and the reply picks two or more paths an agent can carry out.');
rule('4.1: criterion governs examples', [/criterion governs/i, /examples.*illustrative/i],
  'The criterion governs and the examples are illustrative.');
rule('4.6: exhaustive exclusions follow the cause', [/never-advised list/i, /exhaustive/i, /cause/i, /reply.*wording/i],
  'The never-advised list is exhaustive and follows the cause rather than reply option wording.', /never-advised/i);

const exclusions = [
  ['approval', /spec approval.*npm stage approval.*collaborator approval/i, 'spec approval, npm stage approval or collaborator approval'],
  ['access', /access.*credentials/i, 'access or credentials'],
  ['forge', /forge merges by the user/i, 'forge merges by the user'],
  ['off', /Auto-merge: off/i, 'Auto-merge: off'],
  ['report bases', /work-promotion.*deploying-base.*unknown-base.*report cards/i, 'work-promotion, deploying-base or unknown-base report cards'],
  ['ratings', /report-only comment-rating card/i, 'the report-only comment-rating card'],
  ['models', /model unavailability.*substitution/i, 'model unavailability or substitution'],
  ['stops', /denied actions.*explicit user stops/i, 'denied actions or explicit user stops'],
  ['peer', /peer-review holds/i, 'peer-review holds'],
  ['manager', /review-manager pass holds/i, 'review-manager pass holds'],
];
for (const [name, concept, wording] of exclusions) {
  rule(`4.1: never advise ${name}`, [/advise/i, concept],
    `Never advise ${wording}.`, /never/i);
}
rule('4.1: driver dispositions only advise if raised to the user',
  [/diligence.*UNKNOWN/i, /Learning.*contradiction/i, /driver dispositions/i, /only if.*user.*hold/i],
  'Diligence UNKNOWN and a Learning contradiction remain driver dispositions, advised only if raised to the user as a hold.');
rule('close gaps then form own assessment before advice',
  [/before.*(?:advice|consult)/i, /driver.*closes.*gap/i, /existing.*rules/i, /then.*own assessment/i],
  'Before advice the driver closes the gap under existing rules where possible, then forms its own assessment.');
rule('mixed adviser seats are independent and equally briefed',
  [/mixed/i, /axstack-advisor-astra/i, /axstack-advisor-opus/i, /independently/i, /same bounded evidence.*question/i],
  'In mixed consult axstack-advisor-astra and axstack-advisor-opus independently with the same bounded evidence packet and question.');
rule('independence excludes cross-reading', [/advisers/i, /cross-read/i],
  'Advisers never cross-read one another.', /never/i);
rule('single-provider intentional absence', [/single-provider/i, /one configured adviser/i, /other.*intentional absence/i],
  'Single-provider presets use the one configured adviser and record the other as an intentional absence.');
rule('4.2: high stakes overrides ordinary seats',
  [/high-stakes.*single-provider/i, /axstack-advisor-astra/i, /axstack-escalation-fable/i, /plain AGREE/i, /bounded checks/i],
  'For high-stakes holds including single-provider, use axstack-advisor-astra and axstack-escalation-fable plain AGREE after bounded checks.');
rule('4.2: high stakes retains card wait and authority rules',
  [/high-stakes/i, /card.*wait.*authority.*still apply/i],
  'For high-stakes holds the card, wait and authority rules here still apply.');
rule('4.2: high-stakes split is explicitly unresolved',
  [/Astra.*Fable.*disagree/i, /both options/i, /driver.*pick first/i, /high-stakes: no AGREE/i],
  'If Astra and Fable still disagree, show both options with the driver pick first marked high-stakes: no AGREE.', /no AGREE/i);
rule('4.2: user pick resolves high stakes explicitly', [/user.*pick/i, /explicit user decision/i],
  'The user pick is the explicit user decision.');
rule('4.2: driver pick is not AGREE', [/driver.*pick/i, /counts as AGREE/i],
  'The driver pick never counts as AGREE.', /never/i);
rule('4.2: ordinary split presents reasons and driver pick first',
  [/non-high-stakes.*split/i, /both options/i, /one-line reasons/i, /driver.*pick first/i],
  'On a non-high-stakes split show both options with one-line reasons and the driver pick first.');

rule('4.6: advice grants no authority', [/advice/i, /clears.*hold/i, /grants.*approval.*merge.*user-accepted unproven/i],
  'Advice never clears a hold or grants approval, merge or user-accepted unproven.', /never/i);
rule('4.6: silence never applies advice', [/silence/i, /applies.*recommendation/i],
  'Silence never applies the recommendation.', /never/i);
rule('4.6: reply clears only bound cause', [/user reply/i, /clears only.*bound cause/i],
  'A user reply clears only its bound cause.');
rule('multiple cards bind replies to PR or hold key', [/multiple.*cards/i, /reply.*PR/i, /hold key.*without a PR/i],
  'With multiple open cards each reply names its PR, or the hold key for a hold without a PR.', /without a PR/i);
rule('4.6: ambiguous reply clears nothing and asks once', [/ambiguous reply/i, /clears nothing/i, /driver asks once/i],
  'An ambiguous reply clears nothing and the driver asks once.');
rule('4.3: hung seat waits at most one bound wake', [/run watch armed/i, /wait.*at most/i, /next bound watch wake/i, /post.*card/i],
  'With a run watch armed wait at most until the next bound watch wake, then post the card.');
rule('4.3: no-watch card is immediate', [/watch armed/i, /post.*card.*at once/i],
  'With no watch armed post the card at once.', /no/i);
rule('4.3: running seat remains pending on card', [/running seat/i, /card/i, /advice pending: <seat>/i],
  'A running seat shows advice pending: <seat> on the card.');
rule('4.4: failed or unavailable seat is labelled', [/failed or unavailable seat/i, /card/i, /advice unavailable: <seat>/i],
  'A failed or unavailable seat shows advice unavailable: <seat> on the card.');
rule('one attempt per seat', [/one attempt per seat/i, /automatic retry.*substitution/i],
  'Make one attempt per seat with no automatic retry or substitution.', /no/i);
rule('4.7: late advice is an addendum without another hold or alert',
  [/late advice/i, /addendum.*driver thread/i, /new hold.*second alert/i],
  'Late advice is an addendum in the driver thread, never a new hold or second alert.', /never/i);
rule('pending dispatches settle durably', [/pending dispatches/i, /run record/i, /settle.*terminate/i],
  'Keep pending dispatches in the run record and settle them when they terminate.');
rule('unavailable seat records later model gap', [/unavailable seat/i, /model gap/i, /later work.*seat/i],
  'Record an unavailable seat as a model gap for later work needing that seat.');
rule('advice gap cannot block card or reply', [/advice gap/i, /blocks.*card.*user.*reply/i],
  'An advice gap never blocks the card or the user reply.', /never/i);
rule('4.5: stable evidence reuses advice', [/reuse.*advice receipt/i, /cause.*evidence packet.*patch-id.*unchanged/i],
  'Reuse an advice receipt while its cause and evidence packet including patch-id are unchanged.');
rule('4.5: changed evidence authority or question requires fresh advice', [/changed evidence.*authority.*question/i, /fresh advice/i],
  'Changed evidence, authority or question requires fresh advice.');
rule('round-4 card reuses step-back advice with delta brief', [/round-4 card/i, /reuses.*step-back advis/i, /delta-only brief/i],
  'The round-4 card reuses step-back advisers with a delta-only brief.');
rule('card rebinds separately from advice reuse', [/card.*rebinds/i, /current head and base/i, /supersede rules/i],
  'The card rebinds to the current head and base under existing supersede rules.');
rule('4.7: self-close is bounded and agreed',
  [/per PR and cause kind/i, /once/i, /close.*cause/i, /existing authority/i, /only.*advisers agree/i],
  'Per PR and cause kind the driver can act once to close the cause within existing authority only when advisers agree.');
rule('4.7: single adviser agrees with driver for self-close', [/single-provider/i, /self-close/i, /adviser.*must agree.*driver/i],
  'In single-provider presets self-close requires the adviser must agree with the driver.');
rule('4.7: split recurrence or new hold raises card', [/split/i, /cause recurs/i, /new hold/i, /post.*card/i],
  'On a split, if the cause recurs, or if the action raises a new hold, post the card.');
rule('4.7: serious risk raises immediately across phases before advice',
  [/outside peer mode/i, /serious-risk.*immediately/i, /watch.*implement.*review.*autopilot.*debug/i, /before.*advis/i],
  'Outside peer mode raise every serious-risk hold immediately in watch, implement, review, autopilot or debug before dispatching advisers.');
rule('serious risk categories stay complete', [/serious-risk/i, /security.*downtime.*data loss.*major design/i],
  'Serious-risk holds include security, downtime, data loss and major design.');
rule('serious risk advice is addendum with no second alert', [/serious-risk advice/i, /addendum/i, /second alert/i],
  'Serious-risk advice follows as an addendum with no second alert.', /no/i);

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
