import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, loadedReferences, prohibits, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const shared = 'skills/axstack/references/';
const contracts = read(`${shared}contracts.md`);
const path = `${shared}parallel-first.md`;
// A missing instruction is a failed contract, not a filesystem/setup exception.
const source = existsSync(`${import.meta.dir}/../../${path}`) ? read(path) : '';

// Each row protects a distinct dispatch, ownership, integration or evidence duty.
// checkRule removes the real source, inverts it and accepts equivalent wording.
const rules = [
  ['ready before wait', 'Ready work', [/dispatch/i, /independent ready work/i, /before/i, /yield\w* to wait/i],
    'Before yielding to wait, dispatch independent ready work.', [/before/i, 'after']],
  ['transition reassessment', 'Ready work', [/intake/i, /each meaningful/i, /transition/i, /identify/i, /useful ready work/i],
    'At intake and each meaningful dependency transition, identify useful ready work.', [/identify/i, 'ignore']],
  ['bounded serial exception', 'Ready work', [/serial exceptions/i, /record/i, /dependency/i, /conflict/i, /capacity/i, /configuration/i, /small/i],
    'For serial exceptions, record the dependency, conflict, observed capacity, unavailable configuration or task too small to benefit.', [/record/i, 'omit']],
  ['package map', 'Ready work', [/work map/i, /names|records/i, /outcome/i, /owner/i, /inputs/i, /milestone/i, /write/i, /resource/i, /output/i, /acceptance/i, /state/i],
    'The work map records outcome, owner, inputs, milestone, write/resource boundary, output, acceptance and state.', [/names|records/i, 'omits']],
  ['same PR packages', 'Ownership', [/permit/i, /isolated writing packages/i, /one PR/i, /small/i, /combined review/i],
    'For small work, permit isolated writing packages within one PR with eligible combined review.', [/permit/i, 'forbid']],
  ['exclusive integration writer', 'Ownership', [/integration author/i, /sole writer/i, /combined branch/i],
    'The integration author remains the sole writer of the combined branch.', [/sole writer/i, 'concurrent writer']],
  ['exclusive transition', 'Ownership', [/driver/i, /records/i, /exclusive scope transition/i, /package duty finishes/i],
    'The driver records an exclusive scope transition after package duty finishes.', [/records/i, 'skips']],
  ['provenance', 'Ownership', [/record/i, /every/i, /package/i, /integration/i, /repair/i, /actual session/i, /provider/i, /model/i],
    'Record every package, integration and repair contributor actual session, provider and model.', [/record/i, 'omit']],
  ['supported binding', 'Ownership', [/ordinary writers/i, /same snapshotted supported author binding/i, /independent authored.review/i],
    'Ordinary writers use the same snapshotted supported author binding for independent authored-review.', [/same/i, 'arbitrary']],
  ['unmapped provenance holds', 'Ownership', [/divergent or unknown provenance/i, /without/i, /supported review mapping/i, /holds/i],
    'Divergent or unknown provenance without a supported review mapping holds the candidate.', [/holds/i, 'clears']],
  ['internal code milestone', 'Dependencies and repairs', [/within one PR/i, /verified terminal package receipt/i, /exact code tip/i, /acceptance evidence/i, /satisfy/i, /internal code dependency/i, /without.*package review/i],
    'Within one PR, a verified terminal package receipt, exact code tip and acceptance evidence satisfy an internal code dependency without separate package review.', [/satisfy/i, 'reject']],
  ['affected consumers stale', 'Dependencies and repairs', [/consumed interface or revision changes/i, /invalidate/i, /affected consumers/i, /reviews/i, /unrelated work continues/i],
    'When a consumed interface or revision changes, invalidate affected consumers and reviews while unrelated work continues.', [/invalidate/i, 'retain']],
  ['repairs by owner', 'Dependencies and repairs', [/return/i, /package.local fixes/i, /package author/i, /integration.only fixes/i, /integration author/i],
    'Return package-local fixes to the package author and integration-only fixes to the integration author.', [/return/i, 'withhold']],
  ['per PR budget', 'Dependencies and repairs', [/review.round/i, /repair budgets/i, /remain per PR/i, /package count/i],
    'Review-round and repair budgets remain per PR regardless of package count.', [/remain per PR/i, 'reset per package']],
  ['ancestry', 'Evidence', [/verify/i, /consumed package tips/i, /ancestors/i, /final head/i],
    'Verify consumed package tips are ancestors of the final head.', [/verify/i, 'assume']],
  ['combined red first', 'Evidence', [/named owner/i, /new combined behavior/i, /meaningful behavioral red/i, /before implementing/i, /green/i, /integrated head/i],
    'A named owner for new combined behavior records meaningful behavioral red before implementing it and green on the integrated head.', [/before implementing/i, 'after implementing']],
  ['mechanical classification', 'Evidence', [/driver/i, /classifies/i, /mechanical assembly/i, /tree equality/i, /reproducible automatic merge/i],
    'The driver classifies mechanical assembly using tree equality with a reproducible automatic merge.', [/classifies/i, 'ignores']],
  ['joined acceptance', 'Evidence', [/combined acceptance/i, /exercise/i, /package outputs together/i, /independent review/i, /exact head and base/i],
    'Combined acceptance must exercise package outputs together with independent review at the exact head and base.', [/must exercise/i, 'may skip']],
  ['report packages', 'Evidence', [/report/i, /packages identified/i, /launched/i, /completed/i, /serialized/i, /reasons/i],
    'Report packages identified, launched, completed and serialized with reasons.', [/report/i, 'omit']],
  ['overlap separation', 'Evidence', [/record/i, /native execution overlap/i, /separately/i, /queued/i, /parallel tool calls/i],
    'Record native execution overlap separately from queued tasks and parallel tool calls.', [/separately/i, 'indistinguishably']],
  ['unknown metrics', 'Evidence', [/costs and durations/i, /without trustworthy receipts/i, /remain unknown/i],
    'Costs and durations without trustworthy receipts remain unknown.', [/remain unknown/i, 'are estimated as facts']],
  ['same binding exception', 'Authority', [/same.binding package/i, /integration/i, /independent.PR authors/i, /exempt/i, /Codex.plus.Claude fanout floor/i],
    'Same-binding package, integration and independent-PR authors are exempt from the Codex-plus-Claude fanout floor.', [/are exempt/i, 'remain subject to']],
  ['decomposition exception', 'Authority', [/distinct.brief nonwriter packages/i, /eligible configured roles/i, /exempt/i, /blanket provider.diversity floor/i],
    'Distinct-brief nonwriter packages using eligible configured roles are exempt from the blanket provider-diversity floor.', [/are exempt/i, 'remain subject to']],
  ['corroboration preserved', 'Authority', [/preserve/i, /research pairs/i, /branch floors/i, /arena judges/i, /peer first.pass/i, /audit pairs/i],
    'Preserve research pairs and branch floors, arena judges, peer first-pass reviewers and audit pairs.', [/preserve/i, 'discard']],
];

function section(text, heading) {
  return text.split(`## ${heading}\n`)[1]?.split(/\n## /)[0]?.replace(/\s+/g, ' ') ?? '';
}

for (const [name, heading, concepts, rewording, inversion] of rules) {
  test(`parallel-first shared contract: ${name} (removal/inversion/rewording)`, () => {
    checkRule(section(source, heading), (text) => requires(text, ...concepts), rewording, [inversion], concepts);
  });
}

test('standing contracts load ready-work scheduling before dispatch', () => {
  expect(loadedReferences(contracts)).toContain('parallel-first.md');
  const accepts = (text) => loadedReferences(text).includes('parallel-first.md');
  const directive = contracts.split(/\n\s*\n/).find((p) => accepts(p));
  expect(accepts(contracts.replace(directive, ''))).toBe(false);
  expect(accepts(contracts.replace(directive, 'Never follow [Parallel-first](parallel-first.md).'))).toBe(false);
  expect(accepts(contracts.replace(directive, 'Consult [Parallel-first](parallel-first.md) before dispatch.'))).toBe(true);
});

test('existing dependency contract admits verified internal code without package review', () => {
  checkRule(read(`${shared}independent-delivery.md`).replace(/\s+/g, ' '),
    (text) => requires(text, /within one PR/i, /verified terminal/i, /exact code tip/i, /acceptance/i, /internal code dependency/i, /without.*package review/i),
    'Within one PR, a verified terminal receipt, exact code tip and acceptance evidence satisfy an internal code dependency without separate package review.',
    [[/without/i, 'requiring']]);
});

test('contributors cannot review their joined candidate', () => {
  checkRule(section(source, 'Ownership'),
    (text) => prohibits(text, /never/i, /owner/i, /every contributing writer/i, /review/i, /joined candidate/i),
    'The owner and every contributing writer never review the joined candidate.', [[/never/i, 'always']]);
});

for (const preset of ['mixed', 'codex-only', 'claude-only']) {
  test(`${preset} Debug role eligibility includes bounded L0 without replacing L1 receipts`, () => {
    for (const role of JSON.parse(read(`profiles/presets/${preset}.json`)).roles.filter((r) => r.id.startsWith('axstack-debug-investigator-'))) {
      checkRule(role.notes, (text) => requires(text, /L0/i, /bounded/i, /probe/i, /axstack-debug/i, /dispatch/i),
        'Axstack-debug dispatches bounded L0 probe packages with the shared packet and isolation.', [[/dispatches/i, 'forbids']]);
      expect(role.notes).toMatch(/L0 receipts never (?:satisfy|replace).*L1/i);
    }
  });
}
