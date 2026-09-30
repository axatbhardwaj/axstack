import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const watch = read('skills/axstack-watch/SKILL.md').split('## 5. State readiness precisely')[1].split('## 6.')[0];
const implement = read('skills/axstack-implement/SKILL.md').split('## 6. Loop until merge-ready')[1];
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

test('approval mode and deploy class are recorded conservatively once per run', () => {
  expect(sentence(watch, 'Record approval mode once per run')).toMatch(/`solo` only when.*user alone.*write, maintain, or admin.*unknown, `team`/i);
  expect(sentence(watch, 'Record deploying bases once per run')).toMatch(/`integration` only when.*does not deploy to production.*unknown means `deploying`/i);
  expect(sentence(watch, 'Never infer either classification')).toContain('branch name');
});

test('merge card binds the evidence and never grants solo approval by relay', () => {
  expect(sentence(watch, 'Post a merge card')).toMatch(/every term except human approval holds/i);
  expect(sentence(watch, 'Bind it to the PR')).toMatch(/head and base SHA.*CI.*authored review and diligence.*SHAs.*human approvals and bot votes.*SHA and stale flag/i);
  expect(sentence(watch, 'In `solo` mode the card')).toMatch(/user-decision hold.*one relay/i);
  expect(sentence(watch, 'relay text never supplies')).toContain('approval');
});

test('team approval requires counted permission and excludes stale votes', () => {
  expect(sentence(watch, 'Human approval: in `team` mode')).toMatch(/latest opinionated review.*non-author.*type `User`.*not dismissed.*collaborators\/\{login\}\/permission.*write, maintain, or admin/i);
  expect(sentence(watch, 'A read-only approver')).toMatch(/does not count/i);
  expect(sentence(watch, 'a stale or dismissed approval')).toMatch(/does not count/i);
});

test('solo approval accepts only a direct user turn and excludes every marker', () => {
  expect(sentence(watch, 'In `solo` mode, count only')).toMatch(/user turn.*driver chat.*PR or stack.*merge card/i);
  const markers = sentence(watch, 'Text carrying a visible machine marker');
  expect(markers).toMatch(/never counts/i);
  for (const marker of ['orchestration notices', 'dispatch envelopes', '`<pasted_content>` blocks', 'task notifications', 'tool output', 'relay/Telegram text', 'PR text']) {
    expect(markers).toContain(marker);
  }
  expect(sentence(watch, 'The solo approval persists')).toMatch(/scope change.*`CHANGES_REQUESTED`.*serious-risk hold.*voids it/i);
});

test('CI requires complete successful base workflow jobs and no pending checks', () => {
  expect(sentence(watch, 'CI: every job')).toMatch(/base runs on `pull_request`.*branch protection required check.*head.*conclusion `success`/i);
  expect(sentence(watch, 'There must be at least as many jobs')).toMatch(/base's latest run.*unknown or empty check set holds/i);
  expect(sentence(watch, 'A skipped required CI job')).toContain('holds');
  expect(sentence(watch, 'Checks from other apps')).toMatch(/neutral or skipped.*none may be pending/i);
});

test('feedback, receipts, dispatches, and vetoes are merge terms', () => {
  expect(sentence(watch, 'Feedback and revision:')).toMatch(/not draft.*mergeable against the current base.*no unresolved review thread.*top-level blocking comment.*effective blocking review/i);
  expect(sentence(watch, 'Authored review `APPROVE`')).toMatch(/diligence.*`PASS`.*current head and base/i);
  expect(sentence(watch, 'No `Escalate to user`')).toMatch(/unsettled author Dispatch.*task, PR, dependency, run-wide, or serious-risk.*hold/i);
  expect(sentence(watch, 'Veto:')).toMatch(/no `do-not-merge` label.*no chat `hold`/i);
});

test('auto-merge requires ticket-map membership; Small, peer, and deploying PRs stay human', () => {
  expect(sentence(autopilot, '- Small:')).toMatch(/small-change intent.*human merge/i);
  expect(sentence(implement, 'Only the chat-run driver')).toMatch(/approved ticket map.*merge actor.*own PRs inside the approved ticket map.*run-created or explicitly adopted into it.*`integration` base/i);
  expect(sentence(implement, 'A peer PR or')).toMatch(/`deploying` base.*user to merge/i);
  expect(sentence(autopilot, 'Only the original chat-run driver')).toMatch(/approved ticket-map membership.*`integration` base/i);
  expect(sentence(implement, 'A manager, worker')).toMatch(/reviewer.*automation.*standalone watch.*never merge/i);
  expect(sentence(autopilot, 'Managers, workers')).toMatch(/reviewers.*automations.*standalone watches never merge/i);
  expect(sentence(autopilot, 'Audit self-improvement PRs')).toContain('same merge predicate');
  expect(sentence(watch, 'Standalone watch and peer PRs')).toContain('human merge');
});

test('freshness and merge preconditions hold unsafe singleton and stack merges', () => {
  expect(sentence(implement, 'Apply `axstack-watch`')).toContain('an approval alone never grants merge authority');
  expect(sentence(watch, 'The current target base head')).toMatch(/target base head must be an ancestor of the singleton head or bottom stack member head; unknown ancestry holds/i);
  expect(sentence(watch, 'A CI re-run')).toMatch(/does not restore.*freshness/i);
  expect(sentence(watch, 'Immediately before each automated merge')).toMatch(/re-read every term from the forge/i);
  expect(sentence(watch, 'Confirm merge commits')).toMatch(/merge commits are allowed.*`delete_branch_on_merge` is false.*base has no merge queue; otherwise hold for the user/i);
  expect(sentence(implement, 'Re-read every predicate term')).toMatch(/watch §5 before merging/i);
  expect(sentence(implement, 'Confirm merge commits')).toMatch(/merge commits are allowed.*`delete_branch_on_merge` is false.*base has no merge queue; otherwise hold for the user/i);
});

test('singleton and native stack merge instructions preserve reviewed evidence', () => {
  expect(sentence(watch, 'For a singleton PR')).toMatch(/gh pr merge <n> --merge --match-head-commit <sha>.*--delete-branch.*only when no open PR uses its branch as base/i);
  expect(sentence(implement, 'For a singleton')).toMatch(/gh pr merge <n> --merge --match-head-commit <sha>.*--delete-branch.*only when no open PR uses its branch as base/i);
  expect(sentence(implement, 'For a native')).toMatch(/top reviewed head.*`merge_method: merge`.*`merge_action: direct_merge`/i);
  expect(sentence(watch, 'No retargeting')).toMatch(/no retargeting.*branch deletion.*rebase.*inside the stack/i);
  expect(sentence(implement, 'Never retarget')).toMatch(/never retarget.*delete a stack branch.*rebase.*merging/i);
  expect(sentence(watch, 'A failed head guard')).toMatch(/failed head guard or uncertain merge result holds for fresh reconciliation/i);
  expect(sentence(watch, 'For a native `gh stack`')).toMatch(/only a whole-stack merge.*top is the highest open member.*every open downstack member satisfies the full predicate, including scope/i);
  expect(sentence(watch, 'A partial stack')).toMatch(/holds for the user/i);
  expect(sentence(watch, 'Re-read each member')).toMatch(/head and base; each must equal its reviewed head and base/i);
  expect(sentence(watch, 'Request `PUT')).toMatch(/PUT \/repos\/\{o\}\/\{r\}\/pulls\/\{top\}\/merge-async.*`sha` equal to the top reviewed head.*`merge_method: merge`.*`merge_action: direct_merge`.*never `bypass_rules`/i);
  expect(sentence(watch, 'Poll `GET')).toMatch(/GET \/repos\/\{o\}\/\{r\}\/pulls\/\{top\}\/merge-async\/\{uuid\}.*`merged` or `failed`/i);
  expect(sentence(watch, 'Reconcile HTTP 200')).toMatch(/HTTP 200.*HTTP 409.*this exact request; a mismatch holds/i);
  expect(sentence(watch, 'A failed,')).toMatch(/failed, timed-out, or unknown status holds for the user; never retry blindly/i);
  expect(sentence(watch, 'After `merged`')).toMatch(/every member as MERGED.*actual head equal to its reviewed head.*ancestor of the merge result; otherwise take a serious-risk hold/i);
  expect(sentence(implement, 'Reconcile HTTP 200')).toMatch(/HTTP 200 or 409 against the intended request.*every merged member.*head equals its reviewed head.*ancestor of the merge result.*hold unknown or failed outcomes/i);
  expect(sentence(watch, 'After any automated merge')).toMatch(/failing push run on the target base.*merge result.*run-wide hold on further automated merges/i);
  expect(sentence(implement, 'A failing push run')).toMatch(/target base after an automated merge.*holds further automated merges run-wide/i);
});

test('a base move after final readback follows the guarded merge result', () => {
  expect(sentence(watch, 'If the target base moves')).toMatch(/after final readback.*singleton head guard or stack top `sha` decides whether the merge proceeds; the push run.*decides any further-merge hold/i);
});

test('merge decision scenarios remain input-only for independent evaluation', () => {
  const { cases } = JSON.parse(read('tests/workflows/merge-boundary-scenarios.json'));
  expect(cases.length).toBeGreaterThanOrEqual(25);
  for (const id of ['stack-two-member', 'stack-changed-head', 'stack-base-mismatch', 'stack-target-base-moved', 'stack-nonlinear', 'stack-partial', 'stack-probe-failed', 'stack-postmerge-mismatch', 'singleton-child-base', 'postmerge-push-fails', 'stack-existing-request', 'repository-auto-delete', 'merge-queue', 'stack-out-of-map-member', 'base-moves-after-preflight']) {
    expect(cases.some((scenario) => scenario.id === id), `missing scenario: ${id}`).toBe(true);
  }
  for (const scenario of cases) {
    expect(scenario.input.length).toBeGreaterThan(50);
    expect(scenario.expected).toBeUndefined();
  }
});
