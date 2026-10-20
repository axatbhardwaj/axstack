import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, loadedReferences, prohibits, requires, sentences } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const entry = read('skills/axstack-implement/SKILL.md');
// Follow only an affirmative load directive; an absent link is missing guidance,
// not a missing-module failure. The source instructions are the public boundary.
const implement = entry + loadedReferences(entry)
  .filter((path) => path === 'references/step-back.md')
  .map((path) => read(`skills/axstack-implement/${path}`)).join('\n');

function rule(name, source, concepts, rewording, direction, inverse, prohibition) {
  test(`Step-back: ${name} (removal/inversion red, rewording green)`, () => {
    const clean = source.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '').replace(/\s+/g, ' ');
    checkRule(clean, (text) => prohibition
      ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts),
    rewording, [[direction, inverse]], concepts);
  });
}

test('Step-back: eligible failing review replaces the immediate hold with both seats and one extra round', () => {
  const concepts = [/\bany counted failing review round\b/i, /\bleaves rounds at (?:3 or more|least 3)\b/i, /\bwhile step-back: unused\b/i, /\bdriver\b.*\bsteps back\b/i,
    /\bboth\b.*\baxstack-advisor-astra\b.*\baxstack-advisor-opus\b/i,
    /\bexactly one extra repair round\b/i, /\bround 4\b/i];
  const accepts = (text) => requires(text, ...concepts) && !sentences(text).some((unit) =>
    /\bthird (?:failing )?review round\b.*\brecords? held\b/i.test(unit));
  checkRule(entry.replace(/`/g, '').replace(/\s+/g, ' '), accepts,
    'On any counted failing review round that leaves rounds at least 3 while step-back: unused, the driver steps back with both axstack-advisor-astra and axstack-advisor-opus for exactly one extra repair round (round 4).',
    [[/\bsteps back\b/i, 'holds without stepping back'], [/$/, '. The third review round records held.']], concepts);
});
rule('review and diligence fail together only once', entry,
  [/\bround with reviewer REQUEST_CHANGES\b.*\bdiligence FINDINGS\b/i,
    /\bincrements repairs once\b/i, /\bcounts once toward\b.*\bround-3 step-back\b/i],
  'A round with reviewer REQUEST_CHANGES and/or diligence FINDINGS increments repairs once and counts once toward the round-3 step-back.',
  /\bcounts once\b/i, 'counts twice');
rule('checks and post-readiness feedback consume repairs rather than rounds', implement,
  [/\bfailed checks\b.*\bpost-readiness feedback\b/i, /\bincrement repairs\b/i,
    /\bcount as failing review rounds\b/i],
  'Failed checks and post-readiness feedback increment repairs but never count as failing review rounds.',
  /\bnever count as failing review rounds\b/i, 'always count as failing review rounds',
  /\bnever count as failing review rounds\b/i);
rule('4.4 unavailable step-back seat means no agreement', implement,
  [/\bunavailable step-back seat\b/i, /\bcounts as no agreement\b/i, /\bfalls to the user with the advised step-back card\b/i],
  'An unavailable step-back seat counts as no agreement and falls to the user with the advised step-back card.',
  /\bcounts as no agreement\b/i, 'counts as agreement', /\bcounts as no agreement\b/i);

for (const [name, concept, wording] of [
  ['open findings and replies', /\bopen findings\b.*\bauthor\b.*\breplies\b/i, "open findings and the author's replies"],
  ['per-round deltas', /\bper-round deltas\b/i, 'per-round deltas'],
  ['line introduction blame', /\bblame\b.*\bround\b.*\bflagged line first appeared\b/i, 'blame showing the round in which each flagged line first appeared'],
  ['approved design', /\bapproved scope\b.*\bsketch\b.*\bapproach\b/i, 'approved scope, sketch and approach'],
]) rule(`adviser brief includes ${name}`, implement,
  [/\beach adviser\b/i, /\bindependently\b/i, /\bgets\b/i, concept],
  `Each adviser independently gets the ${wording}.`, /\bgets\b/i, 'omits');

rule('one advised extra-round repair brief returns to the same author only if all conditions hold', implement,
  [/\bsend one advised repair brief\b/i, /\bsame author\b/i, /\bextra round only\b/i, /\ball conditions below hold\b/i],
  'Send one advised repair brief to the same author for the extra round only when all conditions below hold.',
  /\ball conditions below hold\b/i, 'any condition below holds');
for (const [name, concept, wording, direction, inverse, ban] of [
  ['driver acceptance', /\bdriver accepts the path\b/i, 'The driver accepts the path.', /\baccepts\b/i, 'rejects'],
  ['both advisers agree', /\bboth advisers agree on the path\b/i, 'Both advisers agree on the path.', /\bboth\b/i, 'Either'],
  ['scope boundary', /\bpath stays inside the approved scope\b/i, 'The path stays inside the approved scope.', /\bstays inside\b/i, 'leaves'],
  ['Binding boundary', /\bpath\b.*\bbreak\b.*\bsketch Binding line\b/i, 'The path must not break a sketch Binding line.', /\bmust not break\b/i, 'may break', /\bmust not break\b/i],
  ['independent holds absent', /\bindependent hold applies\b/i, 'No independent hold applies.', /\bNo independent hold applies\b/i, 'An independent hold applies', /\bNo independent hold applies\b/i],
]) rule(`round-4 condition: ${name}`, implement, [concept], wording, direction, inverse, ban);

rule('the extra round requires fresh independent same-role review and diligence', implement,
  [/\bextra round requires\b/i, /\bfresh\b.*\bindependent reviewer and diligence receipts\b/i,
    /\bfresh session\b.*\bsame mapped reviewer role\b/i],
  'The extra round requires fresh independent reviewer and diligence receipts from a fresh session of the same mapped reviewer role.',
  /\bfresh session\b/i, 'reused session');
rule('round 4 adds no extra reviewer', implement, [/\bextra reviewer\b/i],
  'Do not add an extra reviewer.', /\bDo not add\b/i, 'Add', /\bDo not add\b/i);
rule('advisers cannot lower ratings or clear findings', implement,
  [/\badvisers\b/i, /\blower a rating\b/i, /\bclear a finding\b/i],
  'Advisers must never lower a rating or clear a finding.',
  /\bmust never\b/i, 'can', /\bmust never\b/i);
rule('Pre-existing proposals require evidence and reviewer validation', implement,
  [/\badvisers can propose Pre-existing with evidence\b/i, /\bextra-round reviewer validates\b/i, /\breview\b.*\bPre-existing rules\b/i],
  "Advisers can propose Pre-existing with evidence, which the extra-round reviewer validates under review's Pre-existing rules.",
  /\bextra-round reviewer validates\b/i, 'author validates');

rule('failed conditions fall to the user with an advised step-back card', implement,
  [/\bany condition fails\b/i, /\brecord held\b/i, /\buser\b.*\badvised step-back card\b/i],
  'When any condition fails, record held and fall to the user with the advised step-back card.',
  /\brecord held\b/i, 'record merge-ready');
rule('fall-to-user examples include split unavailable rejected and scope-breaking paths', implement,
  [/\bfailed conditions include\b/i, /\badviser split\b/i, /\bunavailable seat\b/i,
    /\bdriver rejecting\b/i, /\bonly path\b.*\bleaving\b.*\bscope\b.*\bbreaking\b.*\bBinding line\b/i],
  'Failed conditions include an adviser split, an unavailable seat, the driver rejecting the agreed path, or the only path leaving approved scope or breaking a Binding line.',
  /\bFailed conditions include\b/i, 'Permitted conditions include');
rule('scope changes keep the material-revision route', implement,
  [/\bscope change follows\b.*\bmaterial-revision route\b/i],
  'A scope change follows the existing material-revision route.', /\bfollows\b/i, 'bypasses');
rule('independent hold retains its own card and rules with advice as context', implement,
  [/\bindependent hold\b/i, /\bkeeps its own card and rules\b/i, /\bstep-back advice\b.*\battached as context\b/i],
  'An independent hold keeps its own card and rules, with received step-back advice attached as context.',
  /\bkeeps its own card and rules\b/i, 'uses the step-back card instead');
rule('cleared independent hold rechecks all conditions and reuses unchanged advice', implement,
  [/\bafter an independent hold clears\b/i, /\brecheck all\b.*\bconditions\b/i, /\breuse unchanged advice\b/i],
  'After an independent hold clears, recheck all extra-round conditions and reuse unchanged advice.',
  /\brecheck all\b/i, 'skip all');
rule('unchanged independent holds remain held', implement,
  [/\bINCOMPLETE\b.*\bprovenance gap\b.*\bunavailable model\b.*\bserious risk\b/i, /\brecords held\b/i],
  'INCOMPLETE, a provenance gap, unavailable model or serious risk records held.',
  /\brecords held\b/i, 'records merge-ready');
rule('diligence UNKNOWN remains a driver-disposition hold', entry,
  [/\bdiligence UNKNOWN\b/i, /\brecords\b.*\bheld\b/i, /\bblocks merge-ready\b.*\bdriver\b.*\brecorded disposition\b/i],
  "Diligence UNKNOWN records the PR as held and blocks merge-ready pending the driver's recorded disposition.",
  /\bblocks merge-ready\b/i, 'permits merge-ready');

const record = read('skills/axstack/references/run-record.md');
test('Step-back: PR membership template carries both per-PR budget fields', () => {
  const row = record.match(/^PR membership:.*$/m)?.[0] ?? '';
  const concepts = [/\bPR membership:/i, /\brounds: <n>/i, /\bstep-back: unused \| used r<n>/i];
  checkRule(row.replace(/;/g, ','), (text) => requires(text, ...concepts),
    'PR membership: <PR -> rounds: <n>, step-back: unused | used r<n>>',
    [[/\brounds: <n>/i, 'repairs: <n>']], concepts);
});
rule('each PR membership entry has distinct round and extension fields', record,
  [/\beach PR membership entry\b/i, /\brounds: <n>/i, /\bstep-back: unused \| used r<n>/i],
  'Each PR membership entry carries rounds: <n> and step-back: unused | used r<n>.',
  /\beach PR membership entry\b/i, 'Only each ticket entry');
rule('rounds count failing reviews rather than repairs', record,
  [/\brounds counts failing review rounds\b/i, /\brepairs\b/i],
  'The field rounds counts failing review rounds, not repairs.',
  /\bnot repairs\b/i, 'also repairs', /\bnot repairs\b/i);
rule('ticketless and adopted PRs also have entries', record,
  [/\bticketless PRs\b/i, /\bsmall-change intents\b/i, /\badopted PRs\b/i, /\bhave entries\b/i],
  'Ticketless PRs (small-change intents) and adopted PRs have entries too.',
  /\bhave entries\b/i, 'omit entries');
rule('new planned small-change and adopted PRs start with an unused budget', record,
  [/\bnew planned PR\b/i, /\bsmall-change PR\b/i, /\badopted PR\b/i,
    /\bstarts\b.*\brounds: 0\b.*\bstep-back: unused\b/i, /\bwhen it enters the run\b/i, /\bunless a prior run\b.*\bentry exists\b/i],
  'A new planned PR, small-change PR or adopted PR starts at rounds: 0 and step-back: unused when it enters the run, unless a prior run entry exists.',
  /\bstep-back: unused\b/i, 'step-back: used');
rule('adopted and other PRs copy prior entries instead of resetting', record,
  [/\bprior run\b.*\bentry exists\b/i, /\bcopy that entry\b/i, /\bincluding adopted PRs\b/i],
  'When a prior run entry exists for the PR, copy that entry, including adopted PRs.',
  /\bcopy that entry\b/i, 'reset that entry');
rule('pre-field Runtime version is explicit and alone permits legacy initialization', record,
  [/\bprior record predates the field only when\b/i, /\bRuntime line\b/i, /\bAxstack version below 0\.48\.0\b/i],
  'A prior record predates the field only when its Runtime line names an Axstack version below 0.48.0.',
  /\bbelow 0\.48\.0\b/i, 'at or above 0.48.0');
rule('pre-field entries start at zero failing rounds and unused', record,
  [/\bsuch a pre-field entry\b/i, /\bstarts\b.*\brounds: 0\b.*\bstep-back: unused\b/i],
  'Such a pre-field entry starts with rounds: 0 and step-back: unused.',
  /\bstep-back: unused\b/i, 'step-back: used');
rule('unclear inherited history newer missing fields and unknown Runtime use the budget', record,
  [/\bexcept for that absent-field initialization\b/i, /\binherited entry\b/i, /\bmissing or unclear\b.*\brounds or step-back values\b/i,
    /\bcounts as step-back: used\b/i, /\bnewer record missing the field\b/i, /\bunknown Runtime version\b/i],
  'Except for that absent-field initialization, an inherited entry with missing or unclear rounds or step-back values counts as step-back: used, including a newer record missing the field or an unknown Runtime version.',
  /\bcounts as step-back: used\b/i, 'counts as step-back: unused');
rule('separate PRs sharing a ticket retain separate budgets', record,
  [/\bdistinct PRs\b/i, /\bshare one ticket or issue\b/i, /\bkeep separate budgets\b/i],
  'Distinct PRs that share one ticket or issue keep separate budgets.',
  /\bseparate budgets\b/i, 'one budget');
rule('consume the extension before dispatching any step-back repair', record,
  [/\bwrite step-back: used r<n> before dispatching\b/i, /\bany repair from the step-back\b/i],
  'Write step-back: used r<n> before dispatching any repair from the step-back.',
  /\bbefore dispatching\b/i, 'after dispatching');
rule('replacement and split PRs inherit predecessor budget', record,
  [/\breplacement or split PR\b/i, /\bcopies\b.*\bpredecessor\b.*\bentry\b/i],
  "A replacement or split PR copies its predecessor's entry.", /\bcopies\b/i, 'resets');
rule('budgets persist through rebases resumes and owner transfer', record,
  [/\bentry persists across rebases\b.*\bresumes\b.*\bowner transfer\b/i],
  'The entry persists across rebases, resumes and owner transfer.', /\bpersists\b/i, 'resets');
rule('any failing review after extension holds even after a base update or passing round 4', record,
  [/\bany counted failing review round after the extension records held\b/i, /\badvised card\b/i,
    /\bre-review after a base update\b/i, /\bround after a passing round 4\b/i],
  'Any counted failing review round after the extension records held with an advised card, including a re-review after a base update and a round after a passing round 4.',
  /\brecords held\b/i, 'earns another extension');
rule('interrupted and failed extra-round attempts never renew the extension', record,
  [/\binterrupted or failed extra-round attempt\b/i, /\bsecond extension\b/i, /\bfollows\b.*\bexisting failure rules\b/i],
  'An interrupted or failed extra-round attempt never earns a second extension and follows the existing failure rules.',
  /\bnever earns a second extension\b/i, 'earns a second extension', /\bnever earns a second extension\b/i);
rule('a used entry cannot receive another extension', record,
  [/\bstep-back: used entry\b/i, /\bpermits no further extension\b/i],
  'A step-back: used entry permits no further extension.',
  /\bpermits no further extension\b/i, 'permits a further extension', /\bpermits no further extension\b/i);
rule('legacy initialization cannot reset a recorded extension', record,
  [/\bpre-field entry\b/i, /\bstep-back: unused\b/i, /\bonly if the field is absent\b/i],
  'Such a pre-field entry starts with rounds: 0 and step-back: unused only if the field is absent.',
  /\bonly if the field is absent\b/i, 'even if the field is present');
