import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';

const compact = (text) => text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const watch = read('skills/axstack-watch/SKILL.md').split('## 5. State readiness precisely')[1].split('## 6.')[0];
// These are instruction boundaries, not a simulated policy or live merge proof.
// Each rule probes real-source removal, inversion, concept loss and rewording.
const rules = [
  ['A1 default and scope', [/automatic merge/i, /default/i, /own PRs/i, /chat-run/i, /standalone/i, /authorized maintenance/i, /small/i, /adopted/i],
    'Automatic merge is the default for own PRs in chat-run and standalone watches in authorized maintenance mode, including small and adopted work.', [/default/i, 'forbidden']],
  ['A1 actor', [/merge actor/i, /recorded owning thread/i, /watch/i, /axstack-owner/i, /standalone/i],
    'The merge actor is the recorded owning thread of the watch, axstack-owner for standalone maintenance.', [/recorded owning thread/i, 'any idle worker']],
  ['A1 reconcile before transfer', [/missing or idle owner/i, /transfers? merge authority/i, /reconcile/i, /explicit-transfer/i, /lifecycle/i, /first/i],
    'A missing or idle owner never transfers merge authority because reconcile and lifecycle explicit-transfer rules apply first.', [/never transfers/i, 'transfers'], /never transfers/i],
  ['A1 forbidden actors', [/workers/i, /reviewers/i, /monitors/i, /managers/i, /nightly triage/i, /merge/i],
    'Workers, reviewers, monitors, managers, and nightly triage never merge.', [/never merge/i, 'can merge'], /never merge/i],
  ['A1 observation and peer', [/observation-only/i, /peer watches/i, /merge/i],
    'Observation-only and peer watches never merge.', [/never merge/i, 'can merge'], /never merge/i],
  ['A2 solo approval', [/solo/i, /authored.review/i, /APPROVE/i, /diligence/i, /PASS/i, /current head and base/i],
    'In solo mode, authored-review APPROVE and diligence PASS at the current head and base satisfy approval.', [/current head and base/ig, 'any historical head']],
  ['A2 provider independence', [/reviewer.s provider/i, /differs from every provider/i, /authored or repaired/i, /merge-base\.\.head/i, /receipt-recorded provenance/i],
    "The reviewer's provider differs from every provider that authored or repaired merge-base..head commits, using receipt-recorded provenance.", [/differs from every provider/i, 'may equal any provider']],
  ['A2 patch identity definition', [/both modes/i, /git patch-id --stable/i, /merge-base\.\.head/i],
    'Both modes use git patch-id --stable of merge-base..head.', [/merge-base\.\.head/i, 'head alone']],
  ['A2 no new rebase provenance', [/rebase or base-update merge/i, /unchanged patch-id/i, /adds? (?:no|zero) provenance/i],
    'A rebase or base-update merge with unchanged patch-id adds zero provenance.', [/adds? (?:no|zero) provenance/i, 'adds authorship provenance'], /adds? (?:no|zero) provenance/i],
  ['A2 unknown mixed manual', [/unknown or mixed provenance/i, /PRs the user wrote by hand/i, /post/i, /merge card/i],
    'Unknown or mixed provenance and PRs the user wrote by hand post a merge card.', [/post/i, 'skip']],
  ['A2 team adds collaborator', [/team/i, /at least one/i, /counted collaborator approval/i, /current head/i, /same authored review and diligence/i],
    'Team mode requires at least one counted collaborator approval at the current head plus the same authored review and diligence.', [/at least one/i, 'zero']],
  ['A2 automation reviews excluded', [/reviews/i, /Axstack automation marker/i, /count/i],
    'Reviews with an Axstack automation marker never count.', [/never count/i, 'always count'], /never count/i],
  ['A2 approval carryover', [/approval carries over only/i, /rebase/i, /unchanged/i, /patch-id/i, /recorded for both heads/i, /forge still counts it/i],
    'A collaborator approval carries over only across a rebase with unchanged patch-id recorded for both heads while the forge still counts it.', [/unchanged/i, 'changed']],
  ['A2 refresh all evidence', [/fresh authored review/i, /diligence/i, /CI/i, /every new head/i],
    'Require fresh authored review, diligence, and CI on every new head.', [/every new head/i, 'the initial head only']],
  ['A2 readiness persistence', [/merge-ready statement/i, /scope change/i, /CHANGES_REQUESTED/i, /serious-risk hold/i, /voids it/i],
    'A merge-ready statement persists through repairs, but a scope change, new CHANGES_REQUESTED, or serious-risk hold voids it.', [/voids it/i, 'preserves it']],
  ['A3 team dev', [/team/i, /only `?dev`?/i, /docs or workflows/i, /non-production/i],
    'Team mode targets only dev when repository docs or workflows prove it is non-production.', [/only `?dev`?/i, 'any base']],
  ['A3 solo integration', [/solo/i, /main/i, /any other/i, /integration/i],
    'Solo mode targets main or any other integration base.', [/integration/i, 'deploying']],
  ['A3 classify conservatively', [/classification/i, /docs and workflows/i, /branch name alone/i, /unknown means/i, /deploying/i],
    'Base classification uses docs and workflows, never the branch name alone, and unknown means deploying.', [/unknown means/i, 'unknown excludes'], /never the branch name alone/i],
  ['A3 re-read classification', [/re-read/i, /approval mode and base classification/i, /immediately before each automated merge/i, /every watch resume/i],
    'Re-read approval mode and base classification immediately before each automated merge and at every watch resume.', [/every watch resume/i, 'initial entry only']],
  ['A3 stack bottom', [/stack/i, /only the bottom member.s base/i, /eligible/i],
    "For a stack, only the bottom member's base must be eligible.", [/only the bottom member.s base/i, 'no base']],
  ['A3 stack parent head', [/each other member.s base/i, /next-lower member.s branch/i, /reviewed head/i],
    "Each other member's base must be the next-lower member's branch at its reviewed head.", [/reviewed head/i, 'any old head']],
  ['A3 every member', [/every member/i, /every other term and exclusion/i],
    'Every member must meet every other term and exclusion.', [/every member/i, 'the top alone']],
  ['A3 planned publication', [/stack/i, /holds until every/i, /approved plan/i, /ticket map/i, /adopted stack.s recorded members/i, /published/i],
    "A stack holds until every member of its approved plan (ticket map or adopted stack's recorded members) is published.", [/holds until every/i, 'merges before any']],
  ['A4 no bypass', [/--admin/i, /rule bypass/i, /used/i],
    '--admin and rule bypass are never used.', [/never used/i, 'allowed'], /never used/i],
  ['A5 test sources eligible', [/test sources/i, /stay|remain/i, /eligible/i],
    'Test sources remain eligible.', [/eligible/i, 'excluded']],
  ['A5 actual revert declaration', [/A5/i, /revert gate/i, /line starts with/i, /Revert:/i, /line start/i],
    'A5 reads the revert gate from the declaration whose line starts with Revert: at line start.', [/line start/i, 'any position']],
  ['A5 quoted format excluded', [/quoted format/i, /bullet/i, /declaration/i],
    'A quoted format inside a bullet never counts as the declaration.', [/never counts/i, 'counts'], /never counts/i],
  ['A7 solo reply is not approval', [/solo/i, /merge-card reply/i, /supplies merge approval/i],
    'In solo mode the user\'s merge-card reply never supplies merge approval.', [/never supplies/i, 'supplies'], /never supplies/i],
  ['A6 off switch', [/Auto-merge: off/i, /run or PR/i, /merge card/i, /waits for the user/i],
    'Auto-merge: off for a run or PR makes the merge card wait while it waits for the user.', [/waits for the user/i, 'merges immediately']],
  ['A7 all nonqualifying cases', [/post/i, /merge card/i, /every nonqualifying/i, /approval/i, /base/i, /exclusion/i, /off/i],
    'Post a merge card for every nonqualifying approval, base, exclusion, or off case.', [/every nonqualifying/i, 'selected']],
  ['A7 guarded reply', [/own PR/i, /integration/i, /user.s reply/i, /card/i, /authorizes/i, /merge actor/i, /guarded path/i],
    "For an own PR on integration, the user's reply to the card authorizes the merge actor under the guarded path.", [/authorizes/i, 'forbids']],
  ['A7 team reply cannot replace approval', [/team/i, /reply/i, /replaces/i, /counted collaborator approval/i],
    'In team mode a reply never replaces counted collaborator approval.', [/never replaces/i, 'replaces'], /never replaces/i],
  ['A7 team reply clearance', [/team/i, /reply only clears/i, /A3/i, /A6/i, /C4/i],
    'In team mode the reply only clears A3, A6, and C4 causes.', [/only clears/i, 'clears all beyond']],
  ['A7 forge-only categories', [/CI/i, /manifest/i, /merge-authority/i, /non-`?clean`? revert/i, /merged by the user on the forge/i],
    'CI, manifest, merge-authority, and non-clean revert categories are merged by the user on the forge.', [/user on the forge/i, 'watch owner']],
  ['D4 current run off', [/20261006-video-takeaways/i, /every PR/i, /user/i, /forge/i, /Auto-merge: off/i],
    'For 20261006-video-takeaways, every PR is merged by the user on the forge and the watch records Auto-merge: off.', [/user/i, 'agent']],
  ['D7 human categories', [/promotion/i, /release/i, /deploying/i, /peer/i, /user/i, /forge/i, /card only reports readiness/i],
    'Promotion, release, deploying-base, and peer PRs are merged by the user on the forge while the card only reports readiness.', [/user/i, 'worker']],
];

// A5 categories are independently removable: a broad list-presence check misses omissions.
const exclusions = [
  ['peer authors', /authored by anyone other than the user or the user.s agents/i,
    "PRs authored by anyone other than the user or the user's agents"],
  ['promotion', /promotion PRs.*dev.*staging.*prod/i, 'promotion PRs (dev to staging, staging to prod)'],
  ['deploying', /`?deploying`? or unknown base/i, 'PRs with a deploying or unknown base'],
  ['release', /release PRs/i, 'release PRs'],
  ['github', /anything under `?\.github\/`?/i, 'PRs changing anything under .github/'],
  ['workflow path', /file a workflow step invokes by path/i, 'PRs changing a file a workflow step invokes by path'],
  ['manifest', /package manifest or lockfile/i, 'PRs changing the package manifest or lockfile'],
  ['runner', /test-runner config/i, 'PRs changing test-runner config'],
  ['protection', /branch-protection or ruleset config/i, 'PRs changing branch-protection or ruleset config'],
  ['owners', /CODEOWNERS/i, 'PRs changing CODEOWNERS'],
  ['authority', /Axstack merge-authority text.*examples.*not a closed list/i,
    'PRs changing Axstack merge-authority text (examples, not a closed list)'],
  ['revert', /revert line is not `?clean`?/i, 'PRs whose revert line is not clean'],
  ['comments', /held under C4/i, 'PRs held under C4'],
];
for (const [name, concept, description] of exclusions) {
  rules.push([`A5 exclusion ${name}`, [/never auto-merge/i, concept],
    `Never auto-merge ${description}.`, [/never auto-merge/i, 'Auto-merge'], /never auto-merge/i]);
}
const acceptsRule = (concepts, prohibition) => (text) => sentences(text).some((unit) =>
  concepts.every((concept) => concept.test(unit))
  && (prohibition ? prohibition.test(unit) : requires(unit, ...concepts)));
for (const [name, concepts, rewording, inversion, prohibition] of rules) {
  test(`default auto-merge: ${name}`, () => {
    checkRule(compact(watch), acceptsRule(concepts, prohibition), rewording, [inversion], concepts);
  });
}

const surfaces = [
  'skills/axstack/references/contracts.md', 'skills/axstack/references/autopilot.md',
  'skills/axstack/references/lifecycle.md', 'skills/axstack/references/routing.md',
  'skills/axstack/references/role-roster.md', 'skills/axstack/references/t3-runtime.md',
  'skills/axstack/references/automations.md', 'skills/axstack/references/test-audit-weekly.md',
  'skills/axstack-watch/references/watch-runtime.md', 'skills/axstack-implement/SKILL.md',
  'skills/axstack-review/SKILL.md', 'skills/axstack-audit/SKILL.md', 'AGENTS.md',
  'docs/workflows.md', 'README.md',
];
for (const path of surfaces) {
  test(`default auto-merge authority surface: ${path}`, () => {
    const concepts = [/own PRs/i, /automatic merge/i, /default/i, /watch/i, /predicate/i];
    checkRule(compact(read(path)), (text) => requires(text, ...concepts),
      'For own PRs, automatic merge is the default under the watch predicate.', [[/default/i, 'forbidden']], concepts);
  });
}

test('authority-file examples and release authority remain explicit', () => {
  for (const path of ['contracts.md', 'autopilot.md', 'lifecycle.md', 'routing.md', 'role-roster.md',
    't3-runtime.md', 'diligence.md', 'profiles/presets/*.json', 'axstack-watch', 'axstack-implement', 'axstack-review', 'AGENTS.md']) {
    expect(watch).toContain(path);
  }
  expect(read('AGENTS.md')).toContain('The human merges the release PR and approves the npm stage; agents never run');
  expect(read('skills/axstack/references/contracts.md')).toMatch(/grants no release, npm publish, or host install authority/i);
});

const documented = [
  ['excluded proxy routing', [/excluded/i, /CLI proxy/i, /account pooling/i, /IP routing/i],
    'CLI proxy, account pooling, and IP routing are excluded.', [/excluded/i, 'authorized']],
  ['deferred contention', [/local CI contention/i, /deferred/i],
    'Local CI contention handling remains deferred.', [/deferred/i, 'implemented']],
  ['excluded quota routing', [/quota-driven/i, /scheduling/i, /model routing/i, /excluded/i],
    'Quota-driven scheduling or model routing remains excluded.', [/excluded/i, 'permitted']],
  ['excluded automatic merge categories', [/automatic merge/i, /promotion/i, /release/i, /deploying-base/i, /peer/i, /excluded/i],
    'Automatic merge of promotion, release, deploying-base, and peer PRs remains excluded.', [/excluded/i, 'permitted']],
  ['excluded previews', [/previews/i, /outside the VPS/i, /public previews/i, /production data/i, /excluded/i],
    'Previews outside the VPS, public previews, and production data remain excluded.', [/excluded/i, 'permitted']],
  ['triage relay boundary', [/nightly triage/i, /sends? relay messages/i],
    'Nightly triage never sends relay messages.', [/never sends/i, 'sends'], /never sends/i],
  ['correlated misses', [/two agents/i, /miss the same defect/i, /CI is green/i],
    'Two agents can miss the same defect while CI is green.', [/miss the same defect/i, 'always detect every defect']],
  ['spec checkpoint', [/spec approval/i, /user.s main checkpoint/i],
    "Spec approval is the user's main checkpoint.", [/main checkpoint/i, 'minor formality']],
  ['base race', [/head guard/i, /atomically guard/i, /base freshness/i],
    'A head guard does not atomically guard base freshness.', [/does not/i, 'does'], /does not/i],
  ['race consequence', [/concurrent-merge race/i, /held/i, /post-merge push-failure/i],
    'The concurrent-merge race is held by the post-merge push-failure rule.', [/held/i, 'ignored']],
  ['watch cost', [/watch/i, /10 minutes/i, /60 when quiet/i, /until PRs land/i, /accepted token cost/i],
    'A watch wakes every 10 minutes (60 when quiet) until PRs land, with an accepted token cost.', [/accepted token cost/i, 'zero cost']],
  ['shared preview user', [/preview code/i, /same VPS user/i, /agents/i, /isolated/i],
    'Preview code runs under the same VPS user as agents and is not isolated.', [/is not isolated/i, 'is isolated'], /is not isolated/i],
];
for (const path of ['docs/workflows.md', 'README.md']) {
  for (const [name, concepts, rewording, inversion, prohibition] of documented) {
    test(`documented boundary: ${name} in ${path}`, () => {
      checkRule(compact(read(path)), acceptsRule(concepts, prohibition), rewording, [inversion], concepts);
    });
  }
}
