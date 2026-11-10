import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { checkRule, loadedReferences, prohibits, requires } from './prose-contract.js';

const root = `${import.meta.dir}/../../skills`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');

// Independent PF-4 instruction contracts, exercised at shipped phase boundaries.
// These are static instruction proofs, never native scheduling/overlap evidence.
test('every installer-selected phase loads the accepted scheduling interface', () => {
  const phases = readdirSync(root, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory() && (entry.name.startsWith('axstack-') || entry.name === 'voa'));
  for (const { name } of phases) {
    const source = readFileSync(`${root}/${name}/SKILL.md`, 'utf8');
    expect(loadedReferences(source), name).toContain('../axstack/references/parallel-first.md#ready-work');
  }
});

const rules = [
  ['small work supports package authors', 'axstack-implement/SKILL.md',
    [/allow|permit/i, /small (?:work|path)/i, /isolated package (?:writers|authors)/i, /combined review/i],
    'Permit isolated package writers for small work with eligible combined review.'],
  ['final engineering candidate has one integrator', 'axstack-implement/SKILL.md',
    [/assign|name/i, /one integration author/i, /sole writer/i, /final (?:branch|candidate)/i],
    'Name one integration author as sole writer of the final branch.'],
  ['assembly preserves contributor ancestry', 'axstack-implement/SKILL.md',
    [/verify|check/i, /package tips/i, /ancestors/i, /final head/i],
    'Check that package tips are ancestors of the final head.'],
  ['emergent combined behavior keeps red first', 'axstack-implement/SKILL.md',
    [/require|record/i, /combined behavior/i, /meaningful.*red/i, /before/i, /green/i],
    'Require a meaningful red before implementing combined behavior and then integrated green.'],
  ['Tickets maps packages independently of PR boundaries', 'axstack-tickets/SKILL.md',
    [/map|record/i, /each package/i, /owner/i, /prerequisite milestone/i, /acceptance/i, /state/i],
    'Record each package with its owner, prerequisite milestone, acceptance and state.'],
  ['L0 permits bounded safe evidence packages', 'axstack-debug/SKILL.md',
    [/allow|permit/i, /L0/i, /driver-dispatched/i, /bounded/i, /safe/i, /evidence.*probe/i, /configured roles/i],
    'Permit driver-dispatched bounded safe evidence and probe packages at L0 using configured roles.'],
  ['Verify supports packages feeding one skill', 'axstack-verify/SKILL.md',
    [/allow|permit/i, /disjoint/i, /verification.artifact packages/i, /one skill/i, /one PR/i],
    'Allow disjoint verification-artifact packages to feed one skill in one PR.'],
  ['Scout scales by useful concerns', 'axstack-scout/SKILL.md',
    [/split|partition/i, /useful independent concerns/i, /capacity/i, /facets/i],
    'Partition facets by useful independent concerns within observed capacity.'],
  ['Correct permits repository read-only analysis', 'axstack-correct/SKILL.md',
    [/allow|permit/i, /repository mode/i, /driver/i, /bounded read.only/i, /analysis/i, /existing.*roles/i],
    'Allow the driver in repository mode to assign bounded read-only evidence analysis to existing research roles.'],
  ['Cleanup permits preservation analysis', 'axstack-cleanup/SKILL.md',
    [/allow|permit/i, /repository mode/i, /driver/i, /bounded read.only/i, /preservation/i, /existing.*roles/i],
    'Permit the driver in repository mode to assign bounded read-only preservation analysis to existing exploration roles.'],
  ['Watch repairs by exclusive package owner', 'axstack-watch/references/watch-runtime.md',
    [/route|return/i, /package.local/i, /exclusive.*author/i, /independent.*parallel/i],
    'Route package-local repairs to their exclusive package author, with independent repairs in parallel.'],
  ['step-back keeps one round across package repairs', 'axstack-implement/references/step-back.md',
    [/route|return/i, /package.local/i, /exclusive.*author/i, /integration.only/i, /one.*per.PR.*round/i],
    'Route package-local work to its exclusive author and integration-only work to the integrator within one per-PR extra round.'],
  ['Review checks every contributing writer', 'axstack-review/references/review-candidate.md',
    [/verify|check/i, /every.*(?:package|contributor)/i, /integration.*repair/i, /provenance/i, /supported.*binding/i],
    'Check provenance for every package, integration and repair contributor against the supported author binding.'],
  ['Research floors allow only scoped decomposition', 'axstack-research/SKILL.md',
    [/apply|use/i, /decomposition exception/i, /distinct.brief/i, /same.binding.*writers/i],
    'Apply the decomposition exception only to distinct-brief work and same-binding engineering writers.'],
  ['arena retains configured corroboration', 'axstack-brainstorm/references/arena.md',
    [/retain|preserve/i, /configured/i, /candidate.*judge/i, /provider floors/i, /decomposition/i],
    'Preserve configured candidate and judge seats and provider floors during decomposition.'],
  ['audit reports serialized work and reasons', 'axstack-audit/references/record.md',
    [/record|report/i, /packages/i, /identified/i, /launched/i, /completed/i, /serialized/i, /reasons/i],
    'Report packages identified, launched, completed and serialized with reasons.'],
  ['audit distinguishes execution from queueing', 'axstack-audit/references/record.md',
    [/distinguish|separate/i, /native execution overlap/i, /queued/i, /parallel tool calls/i],
    'Distinguish native execution overlap from queued work and parallel tool calls.'],
];

for (const [name, path, concepts, rewording] of rules) {
  test(name + ' — removal/inversion red, equivalent rewording green', () => {
    const accepts = (source) => requires(source, ...concepts);
    checkRule(read(path), accepts, rewording,
      [[new RegExp(concepts[0].source, 'ig'), 'omit']]);
  });
}

const guards = [
  ['L0 never clears L1', 'axstack-debug/SKILL.md', /never/i,
    [/L0.*receipts/i, /satisfy.*bypass/i, /L1.*adviser.*investigator/i],
    'L0 package receipts never satisfy or bypass L1 adviser and investigator receipt requirements.'],
  ['Correct keeps transcript privacy', 'axstack-correct/SKILL.md', /never/i,
    [/read transcripts/i], 'Never read transcripts.'],
  ['Cleanup mutation stays with driver', 'axstack-cleanup/SKILL.md', /never/i,
    [/delegate/i, /cleanup mutations/i], 'Never delegate cleanup mutations.'],
  ['measurement attempts stay sequential', 'axstack-perf/SKILL.md', /never/i,
    [/concurrent/i, /measured attempts/i, /one loop/i],
    'Never run concurrent measured attempts within one loop.'],
  ['contended measurement is unusable', 'axstack-improve/SKILL.md', /never/i,
    [/contended measurements/i, /baseline.*delta.*keep/i],
    'Contended measurements never support baseline, delta or keep decisions.'],
  ['native durations remain unknown without receipts', 'axstack-audit/references/record.md', /never/i,
    [/invent/i, /cost.*duration/i, /trustworthy receipts/i],
    'Never invent cost or duration without trustworthy receipts.'],
];
for (const [name, path, negative, concepts, rewording] of guards) {
  test(name + ' — removal/inversion red, equivalent rewording green', () => {
    checkRule(read(path), (source) => prohibits(source, negative, ...concepts),
      rewording, [[/never/i, 'always']]);
  });
}

test('retired blanket phase restrictions cannot override the package contract', () => {
  const forbidden = [
    ['axstack-implement/SKILL.md', /exactly one author writes it|one isolated author as the sole writer/i],
    ['axstack-verify/SKILL.md', /never launch a parallel source wave|with one writer and one PR/i],
    ['axstack-scout/SKILL.md', /split the question into 1[–-]3 facets/i],
    ['axstack-correct/SKILL.md', /never dispatch workers/i],
    ['axstack-cleanup/SKILL.md', /never dispatches a cleanup worker/i],
    ['axstack-watch/references/watch-runtime.md', /two issues on the same PR use one author and candidate/i],
  ];
  for (const [path, obsolete] of forbidden) expect(read(path), path).not.toMatch(obsolete);
});
