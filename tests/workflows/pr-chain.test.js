import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const read = (path) => existsSync(`${import.meta.dir}/../../${path}`)
  ? readFileSync(`${import.meta.dir}/../../${path}`, 'utf8') : '';
const chainPath = 'skills/axstack/references/pr-chain.md';
const publication = 'skills/axstack/references/candidate-publication.md';
const watch = 'skills/axstack-watch/SKILL.md';
// Prompt obligations are observable source contracts, not live forge/agent proof.
// Each paraphrase changes vocabulary and sentence structure independently of shipped text.
const rules = [
  ['membership', chainPath, [/\b(?:record|save)\b/i, /identity/i, /ordinary-chain/i, /legacy-native-stack/i, /(?:direct|immediate) dependencies/i],
    'Save the membership identity as ordinary-chain or legacy-native-stack together with immediate dependencies.', [/\b(?:record|save)\b/i, 'omit']],
  ['mixed routing', chainPath, [/unknown|uncertain/i, /mixed|combines modes/i, /identity/i, /hold|block/i, /affected (?:operations|actions)/i],
    'Block the affected actions whenever membership identity is uncertain or combines modes.', [/holds?|block/i, 'permits']],
  ['reviewed parent', chainPath, [/children|child/i, /start|create/i, /parent/i, /reviewed|after review/i],
    'Create each child from its parent revision after review.', [/reviewed|after review/i, 'without review']],
  ['merge updates', chainPath, [/ordinary/i, /merge|merging/i, /parent or base/i, /owned child|child you own/i, /preserv|retain/i, /existing commit/i],
    'In ordinary chains, incorporate parent or base updates by merging into the child you own while retaining its existing commit objects.', [/merge|merging/i, 'rebase']],
  ['invalidate promptly', chainPath, [/immediately|at once/i, /invalidat|revoke/i, /affected child|impacted child/i, /readiness/i],
    'At once revoke readiness for each impacted child.', [/immediately|at once/i, 'eventually']],
  ['lazy batched refresh', chainPath, [/refresh/i, /next (?:ready|eligible) children/i, /(?:direct|immediate) dependencies/i, /(?:as|when) needed/i, /batch/i, /ancestor (?:changes|updates)/i],
    'Collect ancestor updates into batches and refresh the next eligible children and immediate dependencies when needed.', [/(?:as|when) needed/i, 'on every ancestor push']],
  ['ancestor repair order', chainPath, [/ordinary/i, /legacy/i, /repair|fix/i, /lowest affected ancestor|earliest impacted ancestor/i, /first|before/i, /then|after/i, /refresh|update/i, /revalidat|check again/i, /children|dependents/i],
    'For ordinary chains and legacy stacks, fix the earliest impacted ancestor first, then update and check again the children as needed.', [/first/i, 'last']],
  ['root integration', chainPath, [/only|restrict/i, /ready (?:chain roots|roots of the chain)/i, /merge/i, /integration.targets?/i],
    'Restrict integration-target merges to ready roots of the chain.', [/only|restrict/i, 'permit all']],
  ['open parent forbidden', chainPath, [/child/i, /parent branch/i, /open/i, /merg/i],
    'Do not integrate a child by merging it into a parent branch whose PR remains open.', [/never|do not/i, 'always'], /never|do not/i],
  ['independent parent', chainPath, [/ready parent/i, /merge/i, /before|ahead of/i, /child publication or readiness/i, /independently deliverable|ship independently/i, /approved scope/i],
    'An approved scope that can ship independently permits a ready parent to merge ahead of child publication or readiness.', [/before|ahead of/i, 'only after']],
  ['retarget proof', chainPath, [/confirmed parent merge|parent merge is confirmed/i, /verify|check/i, /reviewed/i, /actual/i, /heads?/i, /equals|equality/i, /reachable|ancestor/i, /integration (?:result|commit)/i],
    'Once the parent merge is confirmed, check equality between the reviewed and actual heads and prove that the integration commit contains the reviewed head as an ancestor.', [/reachable|ancestor/i, 'absent']],
  ['direct readback', chainPath, [/(?:direct|immediate) child(?:ren)?/i, /re-?read|fetch.*again/i, /old head and base|current head and prior base|previous head and base/i, /change only base|modify the base alone/i, /read back|confirm(?: remotely)?/i, /unchanged head|head stayed identical|head is unchanged/i, /new base|replacement base|base is the integration branch/i],
    ['For immediate children, fetch their current head and prior base again, modify the base alone, then confirm remotely that the head stayed identical and the replacement base is correct.',
      'For each direct child, re-read its previous head and base, modify the base alone, then confirm the head is unchanged and the base is the integration branch.'], [/(?:direct|immediate) child(?:ren)?/i, 'all descendants']],
  ['base edit requires parent-base and matching head', chainPath, [/gh pr edit <child> --base <integration>/i, /only after|only once/i, /confirm|check/i, /old base|prior base/i, /parent(?:'s)? branch/i, /recorded head|saved head/i, /match/i],
    'Run gh pr edit <child> --base <integration> only once checks confirm the prior base is the parent branch and the saved head matches.', [/only after|only once/i, 'before']],
  ['auto-retarget same proof', chainPath, [/proof|prove/i, /forge auto.retargeting/i, /same|likewise|equivalent/i],
    'Forge auto-retargeting needs equivalent proof.', [/same|likewise|equivalent/i, 'weaker']],
  ['uncertain retarget', chainPath, [/unknown|uncertain/i, /retarget outcome|result of changing the base/i, /lookup|inspect remote state/i, /before retry|prior to another attempt/i],
    'If the result of changing the base is uncertain, inspect remote state prior to another attempt.', [/before retry|prior to another attempt/i, 'after retry']],
  ['unusable parent', chainPath, [/closed without merge|clos(?:es|ed) unmerged/i, /rewritten/i, /(?:external|outside) squash or rebase|squashed or rebased outside Axstack/i, /missing ancestry|ancestry is unproven|lacks ancestry/i, /hold|block/i, /dependents|dependent PRs/i],
    ['Block dependent PRs when a parent closes unmerged, its history is rewritten, an outside squash or rebase occurs, or ancestry is unproven.',
      'Hold dependents when the parent closed unmerged, was rewritten, was squashed or rebased outside Axstack, or lacks ancestry.'], [/hold|block/i, 'advance']],
  ['integration enters child', chainPath, [/(?:latest|current) integration tip/i, /enter|include/i, /child history/i, /before|prior to/i, /merg/i],
    'Include the current integration tip in the child history prior to merging that child.', [/before|prior to/i, 'after']],
  ['evidence identity', chainPath, [/bind|key/i, /evidence/i, /PR/i, /head/i, /(?:base|target) branch identity/i, /base SHA|target commit SHA/i],
    'Key the evidence by PR identity, head revision, target branch identity and target commit SHA.', [/(?:base|target) branch identity/i, 'base SHA alone']],
  ['base-only invalidation', chainPath, [/(?:base|target).only retarget/i, /(?:base|target) update/i, /fresh|renewed/i, /applicable review/i, /diligence/i, /shape/i, /CI/i, /approval/i, /evaluation/i],
    'A target-only retarget or target update demands renewed evaluation of applicable review, diligence, shape, CI and approval.', [/fresh|renewed/i, 'historical']],
  ['new-base coverage even at unchanged heads', chainPath, [/check|inspect/i, /new.base workflow coverage|workflow coverage for the updated base/i, /unchanged heads|heads stay identical/i],
    'Inspect workflow coverage for the updated base even when heads stay identical.', [/unchanged heads|heads stay identical/i, 'only changed heads']],
  ['no old-base evidence reuse', chainPath, [/reuse/i, /old.base receipts|prior.base evidence/i],
    'Do not reuse prior-base evidence.', [/never|do not/i, 'always'], /never|do not/i],
  ['retirement', chainPath, [/branch retirement|retiring a branch/i, /check|inspect/i, /dependencies|dependent PR/i, /published/i, /unpublished/i, /active authors?/i, /complete|exhaustive/i, /open.PR/i, /inventory/i],
    ['Before retiring a branch, inspect dependencies whether published or unpublished, currently active authors and the exhaustive inventory of open PRs.',
      'Before retiring a branch, check every published or unpublished dependent PR, every active author and a complete inventory of open PRs.'], [/complete|exhaustive/i, 'partial']],
  ['unknown consumers', chainPath, [/(?:unknown|uncertain) consumers/i, /hold deletion|block deletion/i, /deletion/i, /safe independent/i, /parent/i, /integration/i],
    'Uncertain consumers block deletion but do not block safe independent integration of the parent.', [/hold deletion|block deletion/i, 'permit deletion'], /never|do not block/i],
  ['legacy-only tool', chainPath, [/gh stack/i, /only|exclusively/i, /legacy.native.stack/i, /operations/i],
    'Use gh stack exclusively for operations on legacy-native-stack work.', [/only|exclusively/i, 'also']],
  ['no automatic conversion', chainPath, [/automatic/i, /live/i, /unstack|conversion/i],
    'Never perform automatic conversion of a live native stack.', [/no|never/i, 'always'], /no|never/i],
  ['singleton unchanged', chainPath, [/singleton/i, /eligibility/i, /unchanged|unmodified/i],
    'Eligibility for a singleton stays unmodified.', [/unchanged|unmodified/i, 'narrowed']],
  ['affected checks and new-base shape', chainPath, [/re.run|repeat/i, /affected checks/i, /remeasure|measure again/i, /shape/i, /new base|updated base/i],
    'Repeat affected checks and measure again the shape against the updated base.', [/new base|updated base/i, 'old base']],
  ['size alone cannot hold', chainPath, [/size growth/i, /alone/i, /automatic hold/i],
    'Size growth alone never causes an automatic hold.', [/not|never/i, 'always'], /not|never/i],
  ['ordinary publication', publication, [/ordinary/i, /git push origin HEAD:refs\/heads\//i, /owned branch/i, /gh pr create/i, /gh pr edit/i],
    'Publish an ordinary PR via git push origin HEAD:refs/heads/<owned branch>, followed by gh pr create or gh pr edit.', [/owned branch/i, 'every branch']],
  ['no routine rewrite', publication, [/routine/i, /force push/i, /ordinary/i],
    'Do not routinely force push an ordinary PR.', [/never|do not/i, 'always'], /never|do not/i],
  ['guarded root merge', watch, [/ordinary chain root|root of an ordinary chain/i, /gh pr merge <n> --merge --match-head-commit <sha>/i],
    'Merge a root of an ordinary chain with gh pr merge <n> --merge --match-head-commit <sha>.', [/--merge/i, '--squash']],
];
for (const [name, path, concepts, rewording, inverse, prohibition] of rules) {
  test(`ordinary chain: ${name} is removal/inversion/rewording sensitive`, () => {
    const source = sentences(read(path)).join('. ');
    const accepts = (text) => prohibition ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);
    for (const paraphrase of [rewording].flat()) {
      expect(source.includes(paraphrase)).toBe(false);
      checkRule(source, accepts, paraphrase, [inverse], concepts.filter((concept) =>
        !prohibition || !concept.test(prohibition.source)));
    }
  });
}

test('chain contract is loaded by all execution and repair entry points', () => {
  for (const path of ['skills/axstack-implement/SKILL.md', watch, publication,
    'skills/axstack-watch/references/repair-publication.md',
    'skills/axstack-watch/references/watch-runtime.md', 'skills/axstack-review/SKILL.md']) {
    expect(read(path), path).toContain('pr-chain.md');
  }
});

for (const [name, concepts, paraphrase, inverse, prohibition] of [
  ['whole-stack merge', [/whole.stack|entire stack/i, /merge/i],
    'Merge the entire stack as one unit.', [/whole.stack|entire stack/i, 'single-member']],
  ['no native retarget/delete/rebase', [/retarget/i, /branch deletion|delete branches/i, /rebase/i, /inside the stack|within the stack/i],
    'Never retarget, delete branches, or rebase within the stack.', [/no|never/i, 'always'], /no|never/i],
]) {
  test(`legacy compatibility: ${name} survives removal/inversion/paraphrase`, () => {
    const native = sentences(read(watch).split('For a native `gh stack`')[1]).join('. ');
    const accepts = (text) => prohibition ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);
    checkRule(native, accepts, paraphrase, [inverse], concepts);
  });
}
