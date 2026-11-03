import { readFileSync } from 'node:fs';
import { test } from 'bun:test';
import { checkRule, prohibits, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../skills/${path}`, 'utf8')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '').replace(/\s+/g, ' ');
const implement = read('axstack-implement/SKILL.md');
const small = implement.split(/### Small-change path/i)[1]?.split(/## 2\./)[0] ?? '';

// These are prompt contracts, not live agent-compliance proof. T5 owns the
// combined gate's detailed evidence checks; this guards the lean path's routing.
function rule(name, source, concepts, rewording, direction, inverse, ban) {
  test(`small-change path: ${name}`, () => {
    const terms = [...concepts, direction];
    checkRule(source, (text) => ban ? prohibits(text, ban, ...terms) : requires(text, ...terms),
      rewording, [[direction, inverse]], terms);
  });
}

rule('admission is one recorded intent and one PR', small,
  [/small-change intent/i, /acceptance checks/i, /exclusions/i, /one PR/i],
  'Use the lean path only for a recorded small-change intent with acceptance checks, exclusions and one PR that is not a risk path.',
  /only/i, 'also', /not a risk path/i);
rule('strict TDD and section 6 gates remain required', small,
  [/§§2-5/i, /ownership/i, /isolation/i, /strict TDD/i, /verification/i,
    /§6/i, /publication/i, /review/i, /repair/i, /native watch/i, /merge gates/i],
  'This path keeps §§2-5 ownership, isolation, strict TDD and verification plus §6 publication, review, repair, native watch and merge gates.',
  /keeps/i, 'drops');
rule('scope receipts and unknown holds remain mandatory', small,
  [/head\/base receipts/i, /Scope: FINDINGS/i, /repair/i, /Scope: UNKNOWN/i, /hold/i],
  'Head/base receipts, Scope: FINDINGS repair and Scope: UNKNOWN hold remain mandatory under the same gate.',
  /remain mandatory/i, 'become optional');
rule('review-depth classification grants no merge clearance', small, [/merge clearance/i],
  'This grants no merge clearance.', /grants no/i, 'grants full', /no/i);
rule('one isolated writer retains repairs', small,
  [/one isolated author/i, /sole writer/i, /repairs/i, /same author/i],
  'Keep one isolated author as sole writer and return repairs to the same author.',
  /sole writer/i, 'additional writer');
rule('workers cannot publish', small, [/workers/i, /push/i],
  'Workers never push.', /never/i, 'always', /never/i);
rule('review remains cross-provider and mapped', small,
  [/cross-provider reviewer/i, /actual author provenance/i],
  'Select one cross-provider reviewer from actual author provenance.',
  /select/i, 'skip');
rule('cross-model review cannot be waived', small, [/cross-model review/i],
  'Never skip cross-model review for a small change.', /never skip/i, 'always skip', /never skip/i);
rule('eligible work uses T5 combined review', small,
  [/eligible/i, /combined reviewer/i, /applicable diligence gate/i],
  'For eligible work use the combined reviewer under the applicable diligence gate.',
  /use/i, 'skip');
rule('ineligible or unknown work retains separate diligence', small,
  [/otherwise/i, /separate diligence/i, /unknown eligibility/i],
  'Otherwise require separate diligence, including unknown eligibility.',
  /require/i, 'waive');
rule('single-provider or unavailable reviewers hold review', small,
  [/single-provider presets/i, /unavailable mapped reviewers/i, /review under §6/i],
  'Single-provider presets or unavailable mapped reviewers hold review under §6.',
  /hold/i, 'waive');
rule('proof precedes driver publication', small,
  [/driver/i, /author.*evidence/i, /before publication/i],
  'The driver verifies author proof and evidence before publication.',
  /verifies/i, 'ignores');
rule('watch owns merge under the complete predicate', small,
  [/owning watch/i, /merge/i, /watch §5/i, /full predicate/i],
  'The owning watch merges only under watch §5 and its full predicate.',
  /only/i, 'also');
rule('publication arms native watch', small,
  [/after/i, /publication/i, /remote readback/i, /native watch/i],
  'After publication and remote readback, arm or join the native watch.',
  /arm or join/i, 'skip');

for (const trigger of ['second PR', 'risk path', 'review round 3', 'design conflict']) {
  rule(`escalation on ${trigger}`, small, [new RegExp(trigger, 'i'), /full path/i],
    `Escalate to the full path on a ${trigger}.`, /escalate/i, 'avoid escalating');
}
rule('review-depth risk includes authority and flagged concerns', small,
  [/risk path/i, /merge-risk list/i, /merge, dispatch or authority rules/i,
    /driver or reviewer/i, /security, data-loss or major-design concern/i],
  'Risk path includes the merge-risk list, changes to merge, dispatch or authority rules, and anything the driver or reviewer flags as a security, data-loss or major-design concern.',
  /includes/i, 'excludes');
rule('advisers start only after full-path escalation', small,
  [/step-back advisers/i, /full path/i],
  'Step-back advisers run only on the full path after escalation.', /only/i, 'also');
rule('escalation reconciles its trigger, scope and evidence', small,
  [/trigger/i, /scope/i, /dependencies/i, /current receipts/i, /escalation/i],
  'On escalation, record the trigger and reconcile scope, dependencies and current receipts.',
  /reconcile/i, 'ignore');
rule('escalation preserves author and round budget', small,
  [/author/i, /review-round budget/i],
  'On escalation, preserve the author and review-round budget.', /preserve/i, 'reset');
const loop = implement.split('## 6. Loop until merge-ready')[1] ?? '';
rule('section 6 escalates before round-3 step-back', loop,
  [/small-path work/i, /full path/i, /review round 3/i],
  'Small-path work first escalates at review round 3 to the full path.',
  /first escalates/i, 'stays');
rule('section 6 limits counted-round step-back to full path', loop,
  [/any counted failing review round/i, /rounds.*3 or more/i,
    /step-back: unused/i, /driver steps back/i],
  'On the full path, on any counted failing review round leaving rounds at 3 or more with step-back: unused, the driver steps back.',
  /on the full path/i, 'on either path');
rule('step-back procedure is restricted to full path', read('axstack-implement/references/step-back.md'),
  [/step-back procedure/i, /full path/i],
  'This step-back procedure applies only on the full path.', /only/i, 'also');
rule('rereads are limited to the active path', read('axstack/references/t3-runtime.md'),
  [/re-read/i, /only/i, /files/i, /current path/i],
  'Re-read only the files used by the current path.', /only/i, 'all');
rule('new path dependencies are read before use', read('axstack/references/t3-runtime.md'),
  [/path changes/i, /newly needed/i, /references/i, /before/i],
  'When the path changes, read newly needed references before using them.', /before/i, 'after');
rule('small-run completion alone does not trigger audit', read('axstack/references/lifecycle.md'),
  [/audit/i, /every small run/i],
  'Never dispatch audit on every small run.', /never/i, 'always', /never/i);

const closeOut = read('axstack/references/lifecycle.md').split('## Close-out')[1] ?? '';
rule('close-out settles a triggered small-path audit', closeOut,
  [/small-path runs/i, /when an audit-hook trigger applies/i],
  'For small-path runs, settle when an audit-hook trigger applies.', /settle/i, 'ignore');
rule('all other substantive runs retain their close-out audit decision', closeOut,
  [/all other substantive runs/i, /non-zero\/requested/i, /counts zero/i],
  'All other substantive runs settle non-zero/requested, else counts zero.', /settle/i, 'ignore');
