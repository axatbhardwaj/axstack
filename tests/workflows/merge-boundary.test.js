import { readSkillFile as readFileSync } from './skill-source.js';
import { expect, test } from 'bun:test';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const watchFull = read('skills/axstack-watch/SKILL.md');
const watch = watchFull.split('## 5. State readiness precisely')[1].split('## 6.')[0];
const implementOwn = read('skills/axstack-implement/SKILL.md').split('## 6. Loop until merge-ready')[1];
// Detailed merge policy is canonical in watch §5, explicitly loaded by Implement.
expect(implementOwn).toContain('[watch §5](../axstack-watch/SKILL.md#5-state-readiness-precisely)');
const implement = implementOwn + watch;
const autopilot = read('skills/axstack/references/autopilot.md');

// Shipped prose is the interface here; live forge behavior needs separate proof.
function sentence(text, anchor) {
  const compact = text.replace(/\s+/g, ' ');
  const start = compact.indexOf(anchor);
  expect(start, `missing sentence: ${anchor}`).toBeGreaterThanOrEqual(0);
  const end = compact.slice(start).search(/\.(?=\s|$)/);
  expect(end, `unbounded sentence: ${anchor}`).toBeGreaterThanOrEqual(0);
  return compact.slice(start, start + end + 1);
}

test('approval mode and deploy class use conservative evidence on every resume and merge', () => {
  expect(sentence(watch, 'A base is `integration`')).toMatch(/docs or workflows.*does not deploy to production/i);
  expect(sentence(watch, 'Base classification uses')).toMatch(/docs and workflows.*never the branch name alone.*unknown means `deploying`/i);
  expect(sentence(watch, 'Re-read approval mode')).toMatch(/immediately before each automated merge.*every watch resume/i);
});

test('uncertain watch registration state holds new registrations until resolved', () => {
  expect(sentence(watchFull, 'Reuse the live owner and watch')).toMatch(/uncertain state holds new registrations until resolved/i);
});

test('merge card binds evidence and parks user decisions in the driver thread', () => {
  expect(sentence(watch, 'Bind it to the PR')).toMatch(/head and base SHA.*CI.*authored review and diligence.*SHAs.*collaborator approvals and bot votes.*SHA and stale flag/i);
  expect(sentence(watch, 'A card that needs')).toMatch(/decision hold raised in the T3 driver thread.*waiting on the decision/i);
  expect(sentence(watch, 'Revalidate the current head')).toMatch(/head and base.*reply clears only its bound cause/i);
});

test('team approval requires counted permission and excludes stale votes', () => {
  expect(sentence(watch, 'Human approval: in `team` mode')).toMatch(/latest opinionated review.*non-author.*type `User`.*not dismissed.*collaborators\/\{login\}\/permission.*write, maintain, or admin/i);
  expect(sentence(watch, 'A read-only approver')).toMatch(/does not count/i);
  expect(sentence(watch, 'a stale or dismissed approval')).toMatch(/does not count/i);
});

test('solo approval uses review and diligence; machine markers cannot supply a reply', () => {
  expect(sentence(watch, '- Approval:')).toMatch(/solo.*authored-review `APPROVE`.*diligence `PASS`.*current head and base/i);
  const markers = sentence(watch, 'Text carrying a visible machine marker');
  expect(markers).toMatch(/never counts as a user reply/i);
  for (const marker of ['orchestration notices', 'dispatch envelopes', '`<pasted_content>` blocks', 'task notifications', 'tool output', 'PR text']) {
    expect(markers).toContain(marker);
  }
  expect(sentence(watch, 'A collaborator approval carries over')).toMatch(/only.*rebase.*unchanged.*patch-id.*both heads.*forge still counts it/i);
});

test('CI requires complete successful base workflow jobs and no pending checks', () => {
  expect(sentence(watch, 'CI: every job')).toMatch(/base runs on `pull_request`.*branch protection required check.*head.*conclusion `success`/i);
  expect(sentence(watch, 'There must be at least as many jobs')).toMatch(/base's latest run.*unknown or empty check set holds/i);
  expect(sentence(watch, 'A skipped required CI job')).toContain('holds');
  expect(sentence(watch, 'Checks from other apps')).toMatch(/neutral or skipped.*none may be pending/i);
});

test('feedback, receipts, dispatches, and vetoes are merge terms', () => {
  const feedback = sentence(watch, 'Feedback and revision:');
  expect(feedback).toMatch(/\bnot draft\b.*\bmergeable against the current base\b/i);
  const concepts = [/\bblocking agent-authored thread\b/i, /\btop-level blocking comment\b/i,
    /\beffective blocking review remains\b/i, /\bvalidated\b.*\bPre-existing\b.*\bthread exception\b/i];
  checkRule(feedback.replace(/`/g, ''), (text) => prohibits(text, /\bno unresolved\b/i, ...concepts),
    'After the validated Pre-existing thread exception, no unresolved blocking agent-authored thread, top-level blocking comment, or effective blocking review remains.',
    [[/\bno unresolved\b/i, 'unresolved'], [/\bvalidated\b.*\bPre-existing\b.*\bthread exception\b/i, 'no exception']], concepts);
  expect(sentence(watch, 'Authored review `APPROVE`')).toMatch(/diligence.*`PASS`.*current head and base/i);
  expect(sentence(watch, 'No `Escalate to user`')).toMatch(/unsettled author Dispatch.*task, PR, dependency, run-wide, or serious-risk.*hold/i);
  expect(sentence(watch, 'Veto:')).toMatch(/no `do-not-merge` label.*no chat `hold`/i);
});

// Risky-path instructions are the boundary; mutations stay entirely in memory.
for (const [name, concepts, rewording, inversions] of [
  ['diff categories require a clear diff or revision-bound clearance',
    [/merge-base\.\.head/i, /touch(?:es|ing)? none of/i, /database migrations/i,
      /auth(?:\/authentication|entication)? code/i, /secrets/i,
      /credential config/i, /money\/funds-moving paths/i,
      /production deploy config/i, /or a head-and-base-bound user clearance/i,
      /Escalation/i, /applies/i],
    'Either merge-base..head touches none of database migrations, authentication code, secrets or credential config, money/funds-moving paths, or production deploy config, or a head-and-base-bound user clearance from Escalation applies.',
    [[/none of/i, 'any of'], [/head-and-base-bound/i, 'historical'],
      [/applies/i, 'is unnecessary']]],
  ['clearance needs the explicit user command at the exact PR head and base',
    [/only/i, /explicit user/i, /"merge this"/i, /(?:this|that) PR/i,
      /exact head and base SHA/i, /clear(?:s)?/i, /(?:this|the risky-path) hold/i,
      /authorizes.*merge actor.*guarded path/i],
    'Only an explicit user "merge this" for that PR at the exact head and base SHA can clear the risky-path hold and authorizes the merge actor under the guarded path.',
    [[/only/i, 'optionally'], [/explicit user/i, 'agent'],
      [/exact head and base SHA/i, 'any prior revision'],
      [/clear(?:s)?/i, 'retains'], [/authorizes/i, 'forbids']]],
  ['uncertain classification holds automatic merge',
    [/uncertain risky-path classification/i, /holds automatic merge/i],
    'Any uncertain risky-path classification holds automatic merge.',
    [[/holds automatic merge/i, 'allows automatic merge']]],
  ['risky paths require a merge card',
    [/post a merge card/i, /every/i, /risky-path case/i],
    'Post a merge card for every risky-path case.',
    [[/post a merge card/i, 'skip the merge card']]],
  ['risky paths park the driver on a decision hold',
    [/risky-path/i, /decision hold/i, /T3 driver thread/i,
      /driver ends its turn waiting on the decision/i],
    'A risky-path card is a decision hold in the T3 driver thread and the driver ends its turn waiting on the decision.',
    [[/decision hold/i, 'progress update'],
      [/driver ends its turn waiting on the decision/i, 'driver continues automatic merging']]],
  ['file eligibility remains subject to the risky-path hold',
    [/personal and work PRs/i, /eligible/i, /whatever files/i,
      /subject to the risky-path hold/i],
    'Personal and work PRs are eligible whatever files change, subject to the risky-path hold.',
    [[/subject to the risky-path hold/i, 'exempt from the risky-path hold']]],
  ['head or base changes restore the hold',
    [/new head or base/i, /re-applies|restores/i, /the hold/i],
    'A new head or base restores the hold.',
    [[/re-applies|restores/i, 'clears'],
      [/new head or base/i, 'new head only']]],
]) {
  test(`risky-path merge hold: ${name}`, () => {
    checkRule(watch.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' '),
      (text) => requires(text, ...concepts),
      rewording, inversions, concepts);
  });
}

test('risky-path merge hold applies independently of readiness', () => {
  const concepts = [/risky-path hold/i, /blocks automatic merge/i];
  const readinessCondition = /\b(?:at|after) (?:merge-ready|readiness)\b|\bonce the PR is ready\b/i;
  const accepts = (text) => sentences(text).some((unit) =>
    requires(unit, ...concepts) && !readinessCondition.test(unit));
  checkRule(watch.replace(/\s+/g, ' '), accepts,
    'Every risky-path hold blocks automatic merge.',
    [[/blocks automatic merge/i, 'allows automatic merge'],
      [/blocks automatic merge/i, 'blocks automatic merge only at merge-ready'],
      [/blocks automatic merge/i, 'blocks automatic merge only once the PR is ready']], concepts);
});

test('small and standalone maintenance share the guarded watch authority', () => {
  expect(sentence(autopilot, '- Small:')).toMatch(/small-change intent.*watch.*predicate/i);
  expect(sentence(implement, 'The merge actor is')).toMatch(/recorded owning watch thread.*axstack-owner.*standalone.*small and adopted/i);
  expect(sentence(autopilot, 'The recorded owning watch thread')).toMatch(/merge actor.*axstack-owner.*standalone.*small or adopted/i);
  expect(sentence(implement, 'A manager, worker')).toMatch(/reviewer.*monitor.*nightly triage.*never merge/i);
  expect(sentence(autopilot, 'Managers, workers')).toMatch(/reviewers.*monitors.*nightly triage never merge/i);
  expect(sentence(autopilot, 'Audit self-improvement PRs')).toContain('same merge predicate');
  expect(sentence(watch, 'Observation-only and peer watches')).toContain('never merge');
});

test('freshness and merge preconditions hold unsafe singleton and stack merges', () => {
  expect(sentence(implement, 'Apply `axstack-watch`')).toContain('an approval alone never grants merge authority');
  expect(sentence(watch, 'The current target base head')).toMatch(/target base head must be an ancestor of the singleton head or ordinary chain root head or legacy bottom stack member head; unknown ancestry holds/i);
  expect(sentence(watch, 'A CI re-run')).toMatch(/does not restore.*freshness/i);
  expect(sentence(watch, 'Update the branch')).toMatch(/refresh head-bound evidence/i);
  expect(sentence(watch, 'Immediately before each automated merge')).toMatch(/re-read every term from the forge/i);
  expect(sentence(watch, 'Confirm merge commits')).toMatch(/merge commits are allowed.*`delete_branch_on_merge` is false.*base has no merge queue; otherwise hold for the user/i);
  expect(sentence(implement, 'Re-read every predicate term')).toMatch(/watch §5 before merging/i);
});

test('singleton and native stack merge instructions preserve reviewed evidence', () => {
  expect(sentence(watch, 'For a singleton PR')).toMatch(/gh pr merge <n> --merge --match-head-commit <sha>.*--delete-branch.*only when no open PR uses its branch as base/i);
  expect(implementOwn).toMatch(/follow its guarded ordinary-root\/singleton or legacy-native\s+merge path/i);
  expect(sentence(watch, 'No retargeting')).toMatch(/no retargeting.*branch deletion.*rebase.*inside the stack/i);
  expect(sentence(watch, 'A failed head guard')).toMatch(/failed head guard or uncertain merge result holds for fresh reconciliation/i);
  expect(sentence(watch, 'For a native `gh stack`')).toMatch(/only a whole-stack merge.*top is the highest open member.*every open downstack member satisfies the full predicate, including scope/i);
  expect(sentence(watch, 'A partial stack')).toMatch(/holds for the user/i);
  expect(sentence(watch, 'Re-read each member')).toMatch(/head and base; each must equal its reviewed head and base/i);
  expect(sentence(watch, 'Request `PUT')).toMatch(/PUT \/repos\/\{o\}\/\{r\}\/pulls\/\{top\}\/merge-async.*`sha` equal to the top reviewed head.*`merge_method: merge`.*`merge_action: direct_merge`.*never `bypass_rules`/i);
  expect(sentence(watch, 'Poll `GET')).toMatch(/GET \/repos\/\{o\}\/\{r\}\/pulls\/\{top\}\/merge-async\/\{uuid\}.*`merged` or `failed`/i);
  expect(sentence(watch, 'Reconcile HTTP 200')).toMatch(/HTTP 200.*HTTP 409.*this exact request; a mismatch holds/i);
  expect(sentence(watch, 'A failed,')).toMatch(/failed, timed-out, or unknown status holds for the user; never retry blindly/i);
  expect(sentence(watch, 'After `merged`')).toMatch(/every member as MERGED.*actual head equal to its reviewed head.*ancestor of the merge result; otherwise take a serious-risk hold/i);
  expect(sentence(watch, 'After any automated merge')).toMatch(/failing push run on the target base.*merge result.*run-wide hold on further automated merges until resolved/i);
  expect(sentence(implement, 'A failing push run')).toMatch(/target base after an automated merge.*holds further automated merges run-wide/i);
});

test('a base move after final readback follows the guarded merge result', () => {
  expect(sentence(watch, 'If the target base moves')).toMatch(/after final readback.*singleton\/ordinary-root head guard or legacy stack top `sha` decides whether the merge proceeds; the push run.*decides any further-merge hold/i);
});

test('merge decision scenarios remain input-only for independent evaluation', () => {
  const { cases } = JSON.parse(read('tests/workflows/merge-boundary-scenarios.json'));
  const originalIds = ['team-integration', 'solo-chat', 'marker-is-not-approval', 'read-only-approver', 'empty-check-set', 'skipped-required-job', 'stale-approval', 'veto-label', 'chat-hold', 'unknown-deploy-class', 'dependency-hold', 'deploying-and-peer', 'singleton-guard', 'wrong-actor', 'merge-commits-disabled'];
  const newIds = ['stack-two-member', 'stack-changed-head', 'stack-base-mismatch', 'stack-target-base-moved', 'stack-nonlinear', 'stack-partial', 'stack-probe-failed', 'stack-postmerge-mismatch', 'singleton-child-base', 'postmerge-push-fails', 'stack-existing-request', 'repository-auto-delete', 'merge-queue', 'stack-out-of-map-member', 'base-moves-after-preflight'];
  const autoMergeIds = ['solo-no-card', 'small-standalone', 'unknown-provenance', 'rebase-patch-identity', 'changed-patch-approval', 'team-other-integration', 'solo-card-clearance', 'protected-file-categories', 'revert-declaration-origin', 'non-agent-bot', 'planned-stack-unpublished', 'off-with-current-evidence', 'current-run-human', 'automation-vote', 'classification-resume'];
  expect(cases).toHaveLength(45);
  for (const id of [...originalIds, ...newIds, ...autoMergeIds]) {
    expect(cases.some((scenario) => scenario.id === id), `missing scenario: ${id}`).toBe(true);
  }
  expect(cases.find((scenario) => scenario.id === 'postmerge-push-fails')?.input).toMatch(/\bdev\b/i);
  for (const scenario of cases) {
    expect(scenario.input.length).toBeGreaterThan(50);
    expect(scenario.expected).toBeUndefined();
  }
});
