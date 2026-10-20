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

test('Step-back: third failure replaces the immediate hold with both seats and one extra round', () => {
  const concepts = [/\bthird failing review round\b/i, /\bdriver\b.*\bsteps back\b/i,
    /\bboth\b.*\baxstack-advisor-astra\b.*\baxstack-advisor-opus\b/i,
    /\bexactly one extra repair round\b/i, /\bround 4\b/i];
  const accepts = (text) => requires(text, ...concepts) && !sentences(text).some((unit) =>
    /\bthird (?:failing )?review round\b.*\brecords? held\b/i.test(unit));
  checkRule(entry.replace(/`/g, '').replace(/\s+/g, ' '), accepts,
    'At the third failing review round the driver steps back with both axstack-advisor-astra and axstack-advisor-opus for exactly one extra repair round (round 4).',
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
  [/\bunavailable step-back seat\b/i, /\bcounts as no agreement\b/i],
  'An unavailable step-back seat counts as no agreement.',
  /\bcounts as no agreement\b/i, 'counts as agreement', /\bcounts as no agreement\b/i);

for (const [name, concept, wording] of [
  ['open findings and replies', /\bopen findings\b.*\bauthor\b.*\breplies\b/i, "open findings and the author's replies"],
  ['per-round deltas', /\bper-round deltas\b/i, 'per-round deltas'],
  ['line introduction blame', /\bblame\b.*\bround\b.*\bflagged line first appeared\b/i, 'blame showing the round in which each flagged line first appeared'],
  ['approved design', /\bapproved scope\b.*\bsketch\b.*\bapproach\b/i, 'approved scope, sketch and approach'],
]) rule(`adviser brief includes ${name}`, implement,
  [/\beach adviser\b/i, /\bindependently\b/i, /\bgets\b/i, concept],
  `Each adviser independently gets the ${wording}.`, /\bgets\b/i, 'omits');

rule('one advised round-4 repair brief returns to the same author only if all conditions hold', implement,
  [/\bsend one advised repair brief\b/i, /\bsame author\b/i, /\bround 4 only\b/i, /\ball conditions below hold\b/i],
  'Send one advised repair brief to the same author for round 4 only when all conditions below hold.',
  /\ball conditions below hold\b/i, 'any condition below holds');
for (const [name, concept, wording, direction, inverse, ban] of [
  ['driver acceptance', /\bdriver accepts the path\b/i, 'The driver accepts the path.', /\baccepts\b/i, 'rejects'],
  ['both advisers agree', /\bboth advisers agree on the path\b/i, 'Both advisers agree on the path.', /\bboth\b/i, 'Either'],
  ['scope boundary', /\bpath stays inside the approved scope\b/i, 'The path stays inside the approved scope.', /\bstays inside\b/i, 'leaves'],
  ['Binding boundary', /\bpath\b.*\bbreak\b.*\bsketch Binding line\b/i, 'The path must not break a sketch Binding line.', /\bmust not break\b/i, 'may break', /\bmust not break\b/i],
  ['independent holds absent', /\bindependent hold applies\b/i, 'No independent hold applies.', /\bNo independent hold applies\b/i, 'An independent hold applies', /\bNo independent hold applies\b/i],
]) rule(`round-4 condition: ${name}`, implement, [concept], wording, direction, inverse, ban);

rule('round 4 requires fresh independent same-role review and diligence', implement,
  [/\bround 4 requires\b/i, /\bfresh\b.*\bindependent reviewer and diligence receipts\b/i,
    /\bfresh session\b.*\bsame mapped reviewer role\b/i],
  'Round 4 requires fresh independent reviewer and diligence receipts from a fresh session of the same mapped reviewer role.',
  /\bfresh session\b/i, 'reused session');
rule('round 4 adds no extra reviewer', implement, [/\bextra reviewer\b/i],
  'Do not add an extra reviewer.', /\bDo not add\b/i, 'Add', /\bDo not add\b/i);
rule('advisers cannot lower ratings or clear findings', implement,
  [/\badvisers\b/i, /\blower a rating\b/i, /\bclear a finding\b/i],
  'Advisers must never lower a rating or clear a finding.',
  /\bmust never\b/i, 'can', /\bmust never\b/i);
rule('Pre-existing proposals require evidence and reviewer validation', implement,
  [/\badvisers can propose Pre-existing with evidence\b/i, /\bround-4 reviewer validates\b/i, /\breview\b.*\bPre-existing rules\b/i],
  "Advisers can propose Pre-existing with evidence, which the round-4 reviewer validates under review's Pre-existing rules.",
  /\bround-4 reviewer validates\b/i, 'author validates');

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
