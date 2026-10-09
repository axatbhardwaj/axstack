import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const compact = (text) => text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '').replace(/;(?= ready at)/g, ',').replace(/\s+/g, ' ');
const watch = 'skills/axstack-watch/SKILL.md';
const docs = 'docs/workflows.md';
// Prose is the shipped interface. No test-only merge classifier or timer:
// each independent instruction gets source removal, concept loss, inversion
// and equivalent rewording through checkRule; live forge behavior is unproven.
const rules = [
  ['personal classification', [/personal/i, /solo/i, /only when/i, /outside/i, /defi-com/i, /complete collaborator readback/i, /user alone/i, /write/i, /maintain/i, /admin/i],
    'A repository is personal (solo) only when outside defi-com and a complete collaborator readback lists the user alone with write, maintain or admin access.', [/outside/i, 'inside']],
  ['work classification', [/defi-com/i, /extra writer/i, /incomplete or failed readback/i, /work/i, /team/i],
    'A defi-com repository, extra writer, or incomplete or failed readback classes as work (team).', [/work/i, 'personal']],
  ['all other repositories are work', [/every other repository/i, /work/i, /team/i],
    'Work (team) is the class for every other repository.', [/work/i, 'personal']],
  ['personal merge', [/personal/i, /merge when/i, /gates pass/i, /verification/i, /proven/i, /user-accepted/i, /head and base/i],
    'At this head and base, personal PRs merge when verification is proven or user-accepted and the gates pass.', [/merge when/i, 'hold even when']],
  ['personal base freedom', [/personal/i, /any base/i, /promotion/i, /deploying/i, /unknown/i, /\beligible\b/i],
    'Under the watch predicate personal PRs are eligible on any base, including unknown, deploying and promotion bases.', [/\beligible\b/i, 'excluded']],
  ['work merge', [/work/i, /merge when/i, /gates pass/i, /verification/i, /proven/i, /user-accepted/i, /counted collaborator approval/i, /integration/i],
    'Work PRs merge when gates pass, verification is proven or user-accepted, and counted collaborator approval exists on an integration base.', [/counted collaborator approval/i, 'an automation vote']],
  ['work user merges', [/work/i, /promotion/i, /deploying/i, /unknown/i, /merged by the user on the forge/i],
    'In work repositories, PRs on deploying or unknown bases and promotion PRs are merged by the user on the forge.', [/user on the forge/i, 'watch owner']],
  ['serious risk', [/serious-risk hold/i, /both/i, /personal/i, /work/i, /immediately|at once/i],
    'The serious-risk hold applies immediately to both personal and work PRs.', [/immediately|at once/i, 'after an hour']],
  ['proof required', [/proven verification/i, /required/i, /every own PR/i],
    'For every own PR, proven verification is required.', [/required/i, 'optional']],
  ['proof approval coverage', [/verification requires/i, /Verdict:.*APPROVE/i, /Coverage:.*\bCOMPLETE\b/i, /Escalate to user:.*no/i],
    'Verification requires Coverage: COMPLETE plus Verdict: APPROVE and Escalate to user: no.', [/Coverage:.*?\bCOMPLETE\b/i, 'Coverage: INCOMPLETE'], /Escalate to user:.*?no/i],
  ['proof safety fact', [/verification requires/i, /Safety fact/i, /change/i, /unproven/i],
    'For the change, verification requires a Safety fact which is not unproven.', [/not unproven/i, 'unproven'], /not unproven/i],
  ['proof diligence', [/verification requires/i, /diligence/i, /PASS/i, /exact head and base/i],
    'At the exact head and base, verification requires diligence PASS.', [/exact head and base/i, 'an earlier revision']],
  ['proof final-head execution', [/verification requires/i, /Final-head check/i, /command/i, /->/i, /log path/i, /reviewer ran/i, /final head/i, /run.?s evidence folder/i],
    "Verification requires Final-head check: <command> -> <log path> for a check the reviewer ran at the final head, retained in the run's evidence folder.", [/reviewer ran/i, 'author planned']],
  ['proof acceptance evidence', [/each acceptance check/i, /requires passing evidence/i, /ticket or spec/i, /PR body/i, /adopted/i, /ticketless/i],
    'Each acceptance check requires passing evidence from ticket or spec criteria, or the PR body for adopted and ticketless PRs.', [/passing/i, 'pending']],
  ['proof lineage carryover', [/earlier.head/i, /red-to-green/i, /patch lineage/i, /counts only/i, /reviewer/i, /still applies/i, /final change/i],
    'Earlier-head red-to-green evidence in the patch lineage counts only when the reviewer records it still applies to the final change.', [/counts only/i, 'counts regardless of whether']],
  ['proof verify skill', [/applicable/i, /verify-<app>/i, /passing result/i, /required/i, /changed behavior/i],
    'An applicable verify-<app> passing result is required for the changed behavior.', [/required/i, 'optional']],
  ['proof limitations', [/verification requires/i, /no limitation/i, /changed-behavior: unproven/i],
    'Verification requires no limitation carrying the changed-behavior: unproven tag.', [/no limitation/i, 'any limitation'], /no limitation/i],
  ['limitations tagged by meaning', [/reviewer/i, /every limitation/i, /changed behavior/i, /unexercised or unverified/i, /whatever words|however described/i, /changed-behavior: unproven/i],
    'The reviewer tags every limitation leaving changed behavior unexercised or unverified, however described, changed-behavior: unproven.', [/every limitation/i, 'selected limitations']],
  ['other limitations do not hold', [/other limitations/i, /hold/i],
    'Other limitations never hold the merge.', [/do not hold|never hold/i, 'hold'], /do not hold|never hold/i],
  ['self-weakening proof', [/removes or weakens/i, /check/i, /test-runner setting/i, /ruleset/i, /gates its own merge/i, /reviewer/i, /base.s checks against the head/i],
    "When a PR removes or weakens a check, test-runner setting or ruleset that gates its own merge, verification requires the reviewer ran the base's checks against the head.", [/base.s checks against the head/i, 'head checks alone']],
  ['close gaps first', [/driver first closes/i, /verification gap/i, /run(?:s|ning)? the check/i, /re-dispatch/i, /author/i],
    'The driver first closes a verification gap itself by running the check, re-dispatching review, or returning work to the author.', [/first closes/i, 'ignores']],
  ['only unclosable gap relays', [/only/i, /gap.*(?:cannot|unable to) close/i, /verification not proven/i, /card/i, /head and base/i],
    'Only a gap the driver cannot close becomes a verification not proven card bound to head and base.', [/only/i, 'every gap, including'], /cannot close|not proven/gi],
  ['card describes gap and action', [/card names/i, /what is unproven/i, /why/i, /action.*settle/i],
    'The card names the action that would settle what is unproven and explains why.', [/action.*settle/i, 'a milestone']],
  ['reply clears one cause', [/user.s reply/i, /driver thread/i, /forge/i, /clears only/i, /that verification cause/i],
    "In the driver thread or on the forge, the user's reply clears only that verification cause.", [/clears only/i, 'clears all holds beyond']],
  ['acceptance is not pass', [/user-accepted unproven/i, /item/i, /never as a pass/i],
    'Save user-accepted unproven: <item> in the record, never as a pass.', [/never as a pass/i, 'as a pass'], /never as a pass/i],
  ['accepted gap permits merge', [/accepted item/i, /settled/i, /head and base/i, /merge/i, /every other gate and hold/i],
    'Merge when every other gate and hold permits it, treating the accepted item as settled at this head and base.', [/every other gate and hold/i, 'only CI']],
  ['accepted verification escalation settled', [/settle/i, /Escalate to user/i, /user-accepted verification cause/i, /accepted head and base/i, /other escalation holds still apply/i],
    'For the accepted head and base settle Escalate to user for a user-accepted verification cause while other escalation holds still apply.', [/user-accepted verification cause/i, 'all escalation causes']],
  ['reply cannot waive gates', [/reply/i, /waives/i, /APPROVE/i, /diligence.*PASS/i, /green CI/i],
    'APPROVE, diligence PASS and green CI are gates a reply never waives.', [/never waives/i, 'waives'], /never waives/i],
  ['acceptance expires', [/new head or base/i, /voids/i, /acceptance/i],
    'The acceptance is what a new head or base voids.', [/voids/i, 'keeps']],
  ['work reply cannot replace approval', [/work repository/i, /reply/i, /replaces/i, /counted collaborator approval/i],
    'A reply in a work repository never replaces counted collaborator approval.', [/never replaces/i, 'replaces'], /never replaces/i],
  ['reviewer rates external comments', [/authored reviewer/i, /each non-agent/i, /review thread/i, /review body/i, /top-level comment/i, /human or (?:a )?bot/i, /current head/i, /above low/i, /addressed/i, /uncertain/i],
    'The authored reviewer rates each non-agent review thread, review body or top-level comment from a human or bot at the current head as above low, low, addressed or uncertain.', [/authored reviewer/i, 'driver']],
  ['rerate per head', [/re-rate/i, /every non-agent item/i, /each new head/i],
    'At each new head, re-rate every non-agent item.', [/each new head/i, 'the first head only']],
  ['low addressed do not hold', [/reviewer-rated/i, /low/i, /addressed/i, /hold automatic merge/i],
    'Items reviewer-rated addressed or low do not hold automatic merge.', [/do not hold/i, 'hold'], /do not hold/i],
  ['unrated uncertain above low hold', [/above low/i, /unrated/i, /uncertain/i, /holds automatic merge/i],
    'Each unrated, uncertain or above low item holds automatic merge.', [/holds automatic merge/i, 'permits automatic merge']],
  ['human changes hold', [/human/i, /CHANGES_REQUESTED/i, /holds automatic merge/i],
    'Until resolved, human CHANGES_REQUESTED holds automatic merge.', [/holds automatic merge/i, 'permits automatic merge']],
  ['late comment fresh dispatch', [/comment.*after.*receipt/i, /fresh review dispatch/i, /rating/i, /gap closing/i],
    'For rating as gap closing, a comment received after the receipt triggers a fresh review dispatch.', [/fresh review dispatch/i, 'immediate blocked ping']],
  ['unresolved rating reports and keeps holding', [/unrated or uncertain/i, /after one fresh rating dispatch/i, /keeps holding the merge/i, /report-only decision-style card/i, /head and base/i],
    'After one fresh rating dispatch an item still unrated or uncertain keeps holding the merge and posts a report-only decision-style card bound to head and base.', [/keeps holding the merge/i, 'permits the merge']],
  ['rating card names settling actions', [/rating card/i, /names the comment/i, /why/i, /unrated or uncertain/i, /action that settles it/i, /re-rating by the reviewer/i, /commenter resolving or replying/i, /author addressing it/i],
    'The rating card names the comment, why it is unrated or uncertain, and the action that settles it: re-rating by the reviewer, the commenter resolving or replying, or the author addressing it.', [/names the comment/i, 'omits the comment']],
  ['rating notification deduplicates by comment and head', [/report-only rating card/i, /notification of an unsettled rating/i, /deduplicated per comment and head/i],
    'A report-only rating card is a notification of an unsettled rating, deduplicated per comment and head.', [/deduplicated per comment and head/i, 'repeated on each wake']],
  ['rating card offers no acceptance', [/report-only rating card/i, /offers a user-acceptance path/i],
    'A report-only rating card never offers a user-acceptance path.', [/never offers/i, 'offers'], /never offers/i],
  ['reply cannot clear a comment rating hold', [/user reply/i, /comment rating hold/i],
    'A comment rating hold is one that a user reply never clears.', [/never clears/i, 'clears'], /never clears/i],
  ['agents cannot resolve or dismiss', [/agents/i, /resolve or dismiss/i, /non-agent items/i],
    'Agents never resolve or dismiss items that are non-agent items.', [/never/i, 'can'], /never/i],
  ['ready except human definition', [/ready-except-human/i, /every term other than/i, /collaborator approval/i, /human.*CHANGES_REQUESTED/i, /open findings from a person/i, /holds/i],
    'When every term other than open findings from a person, human CHANGES_REQUESTED and collaborator approval holds, the PR is ready-except-human.', [/every term other than/i, 'any term including']],
  ['blocker keys', [/each blocker/i, /key/i, /approval:<PR>/i, /changes:<review id>/i, /comment:<comment id>/i],
    'Give each blocker a key chosen from comment:<comment id>, changes:<review id> and approval:<PR>.', [/each blocker/i, 'all blockers together']],
  ['missing approval clock', [/missing approval'?s?/i, /clock starts/i, /first observed ready-except-human/i, /no review requested/i],
    'With no review requested too, a missing approval clock starts at the first observed ready-except-human time.', [/first observed ready-except-human/i, 'PR creation'], /no review requested/i],
  ['other clock timestamps', [/other clocks/i, /later of/i, /ready-except-human time/i, /item.s forge time/i],
    "Other clocks use the later of the item's forge time and ready-except-human time.", [/later of/i, 'earlier of']],
  ['comment clock requires rating', [/comment:/i, /clock starts only once/i, /reviewer/i, /rates/i, /above low/i],
    'For comment: the clock starts only once the authored reviewer rates above low.', [/above low/i, 'uncertain']],
  ['reviewer wait is not human readiness', [/unrated or uncertain/i, /waits on the reviewer/i, /ready-except-human/i],
    'For an unrated or uncertain item the PR waits on the reviewer and does not count as ready-except-human.', [/does not count/i, 'counts'], /does not count/i],
  ['clock resets', [/clock resets/i, /stops being ready-except-human/i, /patch-id changes/i],
    'If its patch-id changes or the PR stops being ready-except-human, the clock resets.', [/resets/i, 'continues']],
  ['same patch rebase keeps clock', [/same-patch-id rebase/i, /keeps/i, /clock/i],
    'The clock is what a same-patch-id rebase keeps.', [/keeps/i, 'resets']],
  ['once per key persists', [/each key/i, /sent at most once/i, /readiness.*lost.*regained/i, /patch.*changes/i],
    'Even if the patch changes or readiness is lost and regained, each key is sent at most once.', [/at most once/i, 'repeatedly']],
  ['ping delay and simultaneous keys', [/after 60 minutes/i, /one relay per key/i, /simultaneous blockers/i, /new key/i],
    'For simultaneous blockers or a new key, send one relay per key after 60 minutes.', [/60 minutes/i, '5 minutes']],
  ['ping payload', [/<repo>#<n>/i, /waiting <age>/i, /@<login\|no reviewer>/i, /approval\|changes\|comment/i, /ready at <sha7>/i],
    'Relay this payload: <repo>#<n> waiting <age> on @<login|no reviewer>: <approval|changes|comment>, ready at <sha7>.', [/@<login\|no reviewer>/i, '@unknown'], /no reviewer/i],
  ['existing wakes only', [/check runs/i, /existing watch wakes/i, /no new schedule/i],
    'On existing watch wakes the check runs, with no new schedule.', [/no new schedule/i, 'a new schedule'], /no new schedule/i],
  ['ping no reply needed', [/ping/i, /notification only/i, /blocker clears/i, /merges with no reply/i],
    'The ping is a notification only and when the blocker clears the PR merges with no reply.', [/with no reply/i, 'after a reply'], /with no reply/i],
];

for (const path of [watch, docs]) {
  for (const [name, concepts, rewording, inversion, prohibition] of rules) {
    test(`merge escalation ${path}: ${name}`, () => {
      const accepts = (text) => prohibition ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);
      checkRule(compact(read(path)), accepts, rewording, [inversion], concepts);
    });
  }
  for (const category of ['AGENTS.md', '.github/', 'lockfiles', 'Revert: steps']) {
    test(`merge escalation ${path}: file-independent eligibility for ${category}`, () => {
      const concepts = [/personal and work/i, /whatever files/i, /\beligible\b/i, new RegExp(category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))];
      const accepts = (text) => requires(text, ...concepts) && !/never auto-merge PRs changing/i.test(text);
      checkRule(compact(read(path)), accepts,
        `Personal and work PRs remain eligible whatever files they change, including ${category}.`, [[/\beligible\b/i, 'excluded']], concepts);
    });
  }
}

const notificationRules = [
  ['bounded categories', [/relay eligibility/i, /limited to/i, /user-decision holds/i, /serious-risk holds/i, /60-minute blocked ping/i, /capped peer PR milestones/i, /Notification policy/i],
    'Under the Notification policy relay eligibility is limited to capped peer PR milestones, the 60-minute blocked ping, serious-risk holds and user-decision holds.', [/limited to/i, 'unrestricted beyond']],
  ['peer budget across phases', [/peer PRs/i, /deduplicate/i, /implementation and release/i],
    'For peer PRs deduplicate across implementation and release.', [/deduplicate/i, 'duplicate']],
  ['verification decision hold', [/verification not proven/i, /user-decision hold/i, /Notification policy/i],
    'Verification not proven is a user-decision hold under the Notification policy.', [/user-decision hold/i, 'routine progress'], /not proven/i],
  ['blocked notification only', [/60-minute blocked ping/i, /notification-only category/i, /Notification policy/i],
    'Under the Notification policy, the 60-minute blocked ping belongs to a notification-only category.', [/notification-only category/i, 'user-decision hold']],
  ['own milestones stop', [/routine/i, /merge-ready/i, /merged/i, /relays/i, /own PRs/i],
    'For own PRs never send routine merged or merge-ready relays.', [/never send/i, 'send'], /never send/i],
  ['peer notifications unchanged', [/notifications for peer PRs/i, /unchanged/i, /at most two/i, /merge-ready.*merged/i, /per run/i],
    'Notifications for peer PRs keep an unchanged cap of at most two merge-ready/merged milestones per run.', [/unchanged/i, 'stopped']],
];
for (const path of [watch, docs, 'skills/axstack-relay/SKILL.md', 'skills/axstack-implement/SKILL.md',
  'skills/axstack-watch/references/watch-runtime.md', 'skills/axstack/references/autopilot.md']) {
  const source = path === watch ? read(path).split('## 4. Route each wake')[1].split('## 5.')[0] : read(path);
  for (const [name, concepts, rewording, inversion, prohibition] of notificationRules) {
    test(`notification scope ${path}: ${name}`, () => {
      const accepts = (text) => prohibition ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);
      checkRule(compact(source), accepts, rewording, [inversion], concepts);
    });
  }
}

// These caller summaries must agree with the canonical predicate; a pointer
// alone must not coexist with a narrower instruction in the same surface.
for (const path of ['skills/axstack-implement/SKILL.md', 'skills/axstack/references/autopilot.md']) {
  for (const [name, concepts, rewording, inversion] of [
    ['personal deploying merges', [/personal own PRs/i, /deploying bases/i, /automatic merge/i, /watch.*§5/i],
      'Personal own PRs on deploying bases follow automatic merge under watch §5.', [/automatic merge/i, 'user forge merge']],
    ['work base user merges', [/work/i, /promotion PRs/i, /deploying or unknown bases/i, /merged by the user on the forge/i],
      'In work repositories promotion PRs and deploying or unknown bases are merged by the user on the forge.', [/user on the forge/i, 'watch owner']],
    ['peer user merges', [/peer PRs/i, /merged by the user on the forge/i],
      'Merged by the user on the forge are peer PRs.', [/user on the forge/i, 'watch owner']],
  ]) {
    test(`driver merge summary ${path}: ${name}`, () => {
      checkRule(compact(read(path)), (text) => requires(text, ...concepts), rewording, [inversion], concepts);
    });
  }
}
test('audit delivery applies proven verification and escalation', () => {
  const concepts = [/owning watch thread/i, /applies watch §5/i, /proven verification/i, /escalation rules/i];
  checkRule(compact(read('skills/axstack-audit/SKILL.md')), (text) => requires(text, ...concepts),
    'The owning watch thread applies watch §5 with proven verification and escalation rules.',
    [[/proven verification/i, 'review votes alone']], concepts);
});

// The rebase brings a distinct reply protocol: an eligible verification hold
// must use that protocol, rather than treating a raw Telegram choice as assent.
for (const path of [watch, docs, 'skills/axstack-relay/SKILL.md']) {
  for (const [name, concepts, wording, prohibition] of [
    ['verification uses receipt-bound decision cards', [/verification not proven/i, /follow Relay.s decision-card procedure/i, /sent run receipt/i, /each option.s scope/i, /exact PR head and base/i],
      "For verification not proven, the driver shall follow Relay's decision-card procedure, binding each option's scope and the sent run receipt to the exact PR head and base.", /not proven/i],
    ['forwarded acceptance uses the reply protocol', [/verification decision/i, /forwarded choice/i, /Relay.s four reply checks/i, /acknowledgement-before-action/i, /before settling only its bound cause/i],
      "For a verification decision, a forwarded choice shall pass Relay's four reply checks and acknowledgement-before-action rule before settling only its bound cause."],
    ['changed base supersedes the verification card', [/changed PR head or base/i, /supersede/i, /open verification decision card/i, /reissu.*only if a decision is still needed/i],
      'A changed PR head or base shall supersede its open verification decision card, reissuing only if a decision is still needed.'],
  ]) {
    test(`merge relay reconciliation ${path}: ${name}`, () => {
      const accepts = (text) => prohibition ? prohibits(text, prohibition, ...concepts, /must|shall/i)
        : requires(text, ...concepts, /must|shall/i);
      checkRule(compact(read(path)), accepts, wording, [[/must|shall/i, 'must not']], concepts);
    });
  }
}
for (const path of [docs, 'skills/axstack-relay/SKILL.md']) {
  for (const [name, concepts, wording] of [
    ['reply responses are distinct from proactive notifications', [/decision responses/i, /separate from/i, /proactive Notification policy categories/i],
      'Decision responses shall remain separate from proactive Notification policy categories.'],
    ['own decision outcomes resolve the cause', [/own PRs/i, /required decision outcome/i, /resolution of the bound cause/i, /rather than a routine merge-ready or merged milestone/i],
      'For own PRs the driver shall send the required decision outcome as resolution of the bound cause, rather than a routine merge-ready or merged milestone.'],
  ]) {
    test(`merge relay reconciliation ${path}: ${name}`, () => {
      checkRule(compact(read(path)), (text) => requires(text, ...concepts, /must|shall/i), wording,
        [[/must|shall/i, 'must not']], concepts);
    });
  }
}

for (const [name, concepts, wording, inversion, prohibition] of [
  ['rating report has no reply-dependent authority', [/report-only comment-rating cards/i, /reply-dependent decision-card procedure/i, /user acceptance/i],
    'Report-only comment-rating cards never use the reply-dependent decision-card procedure or offer user acceptance.', [/never use/i, 'use'], /never use/i],
  ['relay reply cannot clear a comment rating hold', [/user reply/i, /comment rating hold/i],
    'A comment rating hold is one that a user reply never clears.', [/never clears/i, 'clears'], /never clears/i],
]) {
  test(`merge relay reconciliation: ${name}`, () => {
    checkRule(compact(read('skills/axstack-relay/SKILL.md')), (text) => prohibits(text, prohibition, ...concepts),
      wording, [inversion], concepts);
  });
}
