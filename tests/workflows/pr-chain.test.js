import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const read = (path) => existsSync(`${import.meta.dir}/../../${path}`)
  ? readFileSync(`${import.meta.dir}/../../${path}`, 'utf8') : '';
const chainPath = 'skills/axstack/references/pr-chain.md';
const publication = 'skills/axstack/references/candidate-publication.md';
const watch = 'skills/axstack-watch/SKILL.md';
// Prompt obligations are observable source contracts, not live forge/agent proof.
// Absence tests read existing shipped policy before the new reference exists.
const rules = [
  ['membership', chainPath, [/\b(?:record|save) ordinary-chain/i, /ordinary-chain/i, /legacy-native-stack/i, /direct dependencies/i],
    'Record ordinary-chain or legacy-native-stack identity and direct dependencies.', [/\b(?:record|save) ordinary-chain/i, 'omit ordinary-chain']],
  ['mixed routing', chainPath, [/unknown or mixed/i, /identity/i, /hold/i, /affected operations/i],
    'Unknown or mixed identity holds affected operations.', [/holds?/i, 'permits']],
  ['reviewed parent', chainPath, [/children/i, /start/i, /\breviewed parent/i],
    'Children start from the reviewed parent.', [/reviewed/i, 'unreviewed']],
  ['merge updates', chainPath, [/ordinary/i, /merge/i, /parent or base/i, /owned child/i, /preserv/i, /existing commits/i],
    'For ordinary chains, merge the parent or base into the owned child preserving existing commits.', [/merge/i, 'rebase']],
  ['invalidate promptly', chainPath, [/immediately/i, /invalidate/i, /affected child/i, /readiness/i],
    'Immediately invalidate affected child readiness.', [/immediately/i, 'eventually']],
  ['lazy batched refresh', chainPath, [/refresh/i, /next ready children/i, /direct dependencies/i, /as needed/i, /batch/i, /ancestor changes/i],
    'Refresh next ready children and direct dependencies as needed, batching ancestor changes.', [/as needed/i, 'on every ancestor push']],
  ['root integration', chainPath, [/only/i, /ready chain roots/i, /merge/i, /integration targets/i],
    'Only ready chain roots merge into integration targets.', [/only/i, 'all']],
  ['open parent forbidden', chainPath, [/child/i, /open parent branch/i, /merge/i],
    'Never merge a child into an open parent branch.', [/never/i, 'always'], /never/i],
  ['independent parent', chainPath, [/ready parent/i, /merge/i, /before/i, /child publication or readiness/i, /independently deliverable/i, /approved scope/i],
    'A ready parent can merge before child publication or readiness for independently deliverable approved scope.', [/before/i, 'only after']],
  ['retarget proof', chainPath, [/confirmed parent merge/i, /verify/i, /reviewed head/i, /actual head/i, /reachable/i, /integration result/i],
    'After confirmed parent merge, verify the reviewed head equals actual head and is reachable from the integration result.', [/reachable/i, 'absent']],
  ['direct readback', chainPath, [/direct children/i, /old head and base/i, /change only/i, /base/i, /read back/i, /unchanged head/i, /new base/i],
    'For direct children, reread old head and base, change only base, and read back unchanged head and new base.', [/direct children/i, 'all descendants']],
  ['uncertain retarget', chainPath, [/unknown/i, /retarget outcome/i, /lookup/i, /before retry/i],
    'An unknown retarget outcome requires lookup before retry.', [/before retry/i, 'after retry']],
  ['unusable parent', chainPath, [/closed without merge/i, /rewritten/i, /external squash or rebase/i, /missing ancestry/i, /hold/i, /dependents/i],
    'Closed without merge, rewritten parents, external squash or rebase, and missing ancestry hold dependents.', [/hold/i, 'advance']],
  ['integration enters child', chainPath, [/latest integration tip/i, /enter/i, /child history/i, /before/i, /merge/i],
    'The latest integration tip must enter child history before its merge.', [/before/i, 'after']],
  ['evidence identity', chainPath, [/bind/i, /evidence/i, /PR/i, /head/i, /base branch identity/i, /base SHA/i],
    'Bind evidence to PR, head, base branch identity and base SHA.', [/base branch identity/i, 'base SHA alone']],
  ['base-only invalidation', chainPath, [/base-only retargeting or base update/i, /fresh/i, /applicable review/i, /diligence/i, /shape/i, /CI/i, /approval evaluation/i],
    'Base-only retargeting or base update requires fresh applicable review, diligence, shape, CI and approval evaluation.', [/fresh/i, 'historical']],
  ['retirement', chainPath, [/branch retirement/i, /published and unpublished dependencies/i, /active authors/i, /complete open-PR inventory/i],
    'Branch retirement checks published and unpublished dependencies, active authors and complete open-PR inventory.', [/complete/i, 'partial']],
  ['unknown consumers', chainPath, [/unknown consumers/i, /hold/i, /deletion/i, /safe independent parent integration/i],
    'Unknown consumers hold deletion, never safe independent parent integration.', [/hold deletion/i, 'permit deletion'], /never/i],
  ['ordinary publication', publication, [/ordinary/i, /git push origin HEAD:refs\/heads\//i, /owned branch/i, /gh pr create/i, /gh pr edit/i],
    'For ordinary PRs, use git push origin HEAD:refs/heads/<owned branch> and gh pr create or gh pr edit.', [/owned branch/i, 'every branch']],
  ['no routine rewrite', publication, [/routine/i, /force push/i, /ordinary/i],
    'Never use routine force push for ordinary PRs.', [/never/i, 'always'], /never/i],
  ['guarded root merge', watch, [/ordinary chain root/i, /gh pr merge <n> --merge --match-head-commit <sha>/i],
    'For an ordinary chain root use gh pr merge <n> --merge --match-head-commit <sha>.', [/--merge/i, '--squash']],
];
for (const [name, path, concepts, rewording, inverse, prohibition] of rules) {
  test(`ordinary chain: ${name} is removal/inversion/rewording sensitive`, () => {
    const source = sentences(read(path)).join('. ');
    const accepts = (text) => prohibition ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);
    checkRule(source, accepts, rewording, [inverse], concepts.filter((concept) =>
      !prohibition || !concept.test(prohibition.source)));
  });
}

test('chain contract is loaded by all execution and repair entry points', () => {
  for (const path of ['skills/axstack-implement/SKILL.md', watch, publication,
    'skills/axstack-watch/references/repair-publication.md',
    'skills/axstack-watch/references/watch-runtime.md', 'skills/axstack-review/SKILL.md']) {
    expect(read(path), path).toContain('pr-chain.md');
  }
});

test('ordinary chain migration preserves native-only compatibility and singleton eligibility', () => {
  expect(read(chainPath)).toMatch(/gh stack.*only.*legacy-native-stack/i);
  expect(read(chainPath)).toMatch(/no automatic.*unstack/i);
  expect(read(chainPath)).toMatch(/singleton eligibility.*unchanged/i);
  const legacy = read(watch).split('For a native `gh stack`')[1];
  expect(legacy).toMatch(/whole-stack merge/);
  expect(legacy).toMatch(/No retargeting, branch deletion, or rebase/);
});
