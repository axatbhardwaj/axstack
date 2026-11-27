import { readSkillFile as readFileSync } from './skill-source.js';
import { test, expect } from 'bun:test';
import { publicDocPaths } from './public-docs.js';
import { checkRule, prohibits, requires } from './prose-contract.js';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

test('manager contract admits actionable events by measured host capacity, not fixed job counts', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/review manager/i);
  expect(text).not.toMatch(/watch manager|watch lane|own-PR repair/i);
  expect(text).toMatch(/available (?:memory|RAM)[^.]*CPU[^.]*active worker trees/i);
  expect(text).toMatch(/admits all eligible actionable[^.]*measured host capacity/i);
  expect(text).not.toMatch(/(?:at most|maximum of|cap of) (?:five|5|one|1) (?:concurrently executing )?(?:PR )?(?:tasks|jobs)/i);
  expect(text).toMatch(/complete discovery pages|every discovery page|all discovery pages/i);
  expect(text).toMatch(/waiting[^.]*does not[^.]*execution slot|waiting[^.]*occup(?:y|ies) no[^.]*slot/i);
  expect(text).toMatch(/oldest actionable[^.]*unserved|fair/i);
  expect(text).not.toMatch(/at most (?:eight|8) live dispatch markers/i);
});

test('current manager guidance has no numeric PR execution cap', () => {
  for (const path of [
    'skills/axstack/references/automations.md',
    'skills/axstack/references/lifecycle.md',
    'skills/axstack/references/review-manager-prompt.md',
    'skills/axstack-watch/references/watch-runtime.md',
    ...publicDocPaths(root),
  ]) {
    expect(compact(path), path).not.toMatch(/(?:at most|maximum of|cap(?:ped)? (?:at|of)) (?:five|5|one|1) (?:executing |concurrent(?:ly)? |bounded )?(?:PR |actionable-event )?(?:jobs|tasks)/i);
  }
});

test('manager contract uses bounded PR jobs and native recovery without a queue engine', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/one separate detached checkout per PR job/i);
  expect(text).toMatch(/manager[^.]*never[^.]*checks? out[^.]*PR branch/i);
  expect(text).toMatch(/descendants[^.]*active|active[^.]*descendants/i);
  expect(text).toMatch(/settlement[^.]*frees[^.]*slot|slot[^.]*freed[^.]*settled/i);
  expect(text).toMatch(/reconcile[^.]*workers[^.]*GitHub[^.]*compact (?:run )?record/i);
  expect(text).toMatch(/unknown ownership[^.]*only[^.]*affected PR|affected PR[^.]*unknown ownership/i);
  expect(text).toMatch(/(?:no|not create)[^.]*cursor files[^.]*queue engine/i);
  expect(text).not.toMatch(/`cursor\.json`|`pending\.json`|decision token|precheck\.log/i);
  expect(text).toMatch(/T3 owns[^.]*automation state[^.]*native workflows and schedules/i);
});

test('manager sessions reconcile before admission in the dedicated workspace', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/schedule_task[^.]*everyMs:1800000[^.]*bindToCurrentThread:false/i);
  expect(text).toMatch(/reconcile[^.]*saved state[^.]*GitHub[^.]*native T3[^.]*before[^.]*admission/i);
  expect(text).toMatch(/live manager[^.]*same lane[^.]*authoritative/i);
  expect(text).toMatch(/duplicate[^.]*no PR work[^.]*no further shared-record write/i);
  expect(text).toMatch(/duplicate[^.]*read-only discovery[^.]*own pass note/i);
  expect(requires(text, /outside[\s\S]*wedged-pass recovery/i, /unknown liveness/i,
    /blocks/i, /admission/i, /shared-record writes/i, /takeover/i, /cleanup/i)).toBe(true);
});

test('manager event identity survives same-head changes', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/unchanged exact head[^.]*new event identity[^.]*actionable/i);
  expect(text).toMatch(/unchanged exact head, base branch identity, base SHA and event[^.]*no job/i);
  expect(text).toMatch(/review ID[^.]*body digest/i);
});

test('manager jobs use private per-Dispatch scratch without broad cleanup', () => {
  const runtime = compact('skills/axstack/references/t3-runtime.md');
  const manager = compact('skills/axstack/references/automations.md');
  expect(runtime).toContain('Evidence files still go to the private `<run>/evidence/<key>/` folder.');
  expect(runtime).toMatch(/exact validated owned path[^.]*no glob[^.]*no parent-root deletion/i);
  expect(runtime).toMatch(/Uncertain paths[^.]*preserv/i);
  expect(requires(runtime, /worktree.local paths/i, /validate/i, /real path/i,
    /absence of symlinks/i, /ownership/i, /before use and cleanup/i)).toBe(true);
  expect(manager).toContain('Evidence files stay in the private `<run dir>/evidence/<dispatch>/` folder.');
  expect(manager).toMatch(/Never delete[^.]*broad `TMPDIR` glob/i);
  expect(manager).toMatch(/never[^.]*wipe[^.]*cache/i);
  expect(manager).toMatch(/uncertain ownership[^.]*containment/i);
});

test('held manager jobs settle natively before releasing capacity', () => {
  const runtime = compact('skills/axstack/references/t3-runtime.md');
  const manager = compact('skills/axstack/references/automations.md');
  expect(runtime).toMatch(/permission prompt[^.]*provider safety refusal[^.]*held[^.]*incomplete/i);
  expect(runtime).toMatch(/never[^.]*bypass[^.]*retry[^.]*another model/i);
  expect(manager).toMatch(/native runtime inspection[^.]*actual hold/i);
  expect(manager).toMatch(/do not forge[^.]*AXSTACK-DONE/i);
  expect(manager).toMatch(/release[^.]*slot[^.]*until[^.]*verif(?:y|ies)[^.]*settlement/i);
  expect(manager).toMatch(/unresolved execution teardown[^.]*pause[^.]*lane/i);
  expect(manager).toMatch(/unknown[^.]*user-owned[^.]*never[^.]*kill/i);
});

test('held-event dedupe avoids retry storms without starving unrelated PRs', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/held event identity[^.]*resume condition/i);
  expect(text).toMatch(/unchanged hold[^.]*no new job[^.]*no retry/i);
  expect(text).toMatch(/unrelated eligible PRs[^.]*continue[^.]*settled/i);
});

test('execution settlement frees capacity independently of retained cleanup state', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/positive[^.]*full-tree[^.]*process exit[^.]*frees[^.]*slot/i);
  expect(text).toMatch(/retained metadata[^.]*does not[^.]*occupy[^.]*slot/i);
  expect(text).toMatch(/archive[^.]*workspace removal[^.]*not[^.]*execution capacity/i);
  expect(text).toMatch(/cleanup hold[^.]*unrelated eligible PRs[^.]*continue/i);
});

test('manager pass ends after compact continuity and PR resource cleanup', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/settle[^.]*descendants[^.]*before[^.]*manager/i);
  const teardown = text.split('## Finite-session teardown')[1].split('## Recovery and limits')[0];
  expect(teardown).toMatch(/Save continuity[^.]*last pass summary[\s\S]*?read back[\s\S]*?ending the finite turn/i);
  expect(text).not.toMatch(/terminal close --worktree|old pass worktree/i);
});

test('user decisions remain actionable after the finite manager session closes', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/GitHub[^.]*durable user-owned conversation/i);
  expect(text).toMatch(/never depend[^.]*closed manager (?:chat|conversation|session)/i);
  expect(text).toMatch(/revalidate[^.]*candidate[^.]*head[^.]*base[^.]*event/i);
});

test('peer publication preserves human blocks and exact public receipts', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/human `CHANGES_REQUESTED` block[^.]*across head changes/i);
  expect(text).toContain('<!-- axstack-automation verdict head=<sha> -->');
  expect(text).toMatch(/GitHub review commit parameter[^.]*review ID[^.]*head/i);
  expect(text).toMatch(/self-contained[^.]*every validated finding[^.]*evidence[^.]*consequence/i);
  expect(text).toMatch(/never narrate[^.]*reviewer counts[^.]*gates[^.]*receipts/i);
  expect(text).toContain('`~/defi/misc/reviews/review-<repo>-PR-<num>.html`');
  expect(text).toMatch(/Never publish a `COMMENT` review/i);
});

test('review manager preserves peer, decision, notification, and merge boundaries', () => {
  const manager = compact('skills/axstack/references/automations.md');
  const review = compact('skills/axstack-review/SKILL.md');
  expect(review).toMatch(/Peer code stays readonly/i);
  // Peer process/architecture escalation is superseded by peer-review.test.js B6.
  expect(manager).toMatch(/Only credible serious security\/funds risk[^.]*peer-review serious-risk hold/i);
  expect(manager).toMatch(/Silence never authorizes\s+an action/i);
  expect(manager).toMatch(/No manager[^.]*may merge[^.]*close[^.]*force-push[^.]*rebase[^.]*restack[^.]*mutate a PR branch/i);
  expect(manager).toMatch(/Human merge remains the boundary/i);
});

test('manager continuity reuses valid state and keeps publication bounded', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/manager lane owns ongoing discovery and continuity[^.]*coordinator owns only[^.]*event/i);
  expect(text).toMatch(/Reuse[^.]*worktree[^.]*owner[^.]*unchanged receipts/i);
  expect(text).toMatch(/Settlement returns continuity[^.]*manager[^.]*rather than retaining an idle PR coordinator/i);
  expect(text).toMatch(/dirty source[\s\S]*?unpushed commits[\s\S]*?salvage path/i);
  expect(text).toMatch(/review evidence not yet durable[^.]*user-owned[^.]*proven/i);
  expect(text).toMatch(/pending external result[^.]*unconfirmed review submission[^.]*not pending CI/i);
  expect(text).toMatch(/ascending repository and PR-number tie breaks/i);
});

test('evaluation scenarios cover each accepted decision boundary', () => {
  const data = JSON.parse(read('tests/workflows/pr-manager-scenarios.json'));
  expect(data.version).toBe(10);
  expect(data.migration).toMatch(/v8[^.]*T3 pass threads/i);
  expect(data.evidence).toMatch(/behavioral evaluation inputs/i);
  expect(data.evidence).toMatch(/not a model evaluation result|no model evaluation/i);
  expect(data.evidence).toMatch(/not a scheduler implementation|not.*runtime receipt/i);
  const holdoutIds = [
    'thirty-peer-pr-coverage',
    'finite-unchanged-pass',
    'duplicate-manager-finite-turn',
    'owned-shell-cleanup',
    'durable-review-decision',
    'same-head-new-peer-request',
    'unsettled-descendant',
    'recovery-unknown-ownership',
    'resource-aware-sixth-job',
  ];
  expect(data.cases.slice(0, holdoutIds.length).map(({ id }) => id)).toEqual(holdoutIds);
  // The durable-decision case now rejects worker text and silence as authority.
  expect(Bun.CryptoHasher.hash(
    'sha256',
    JSON.stringify(data.cases.slice(0, holdoutIds.length)),
    'hex',
  )).toBe('9507fedf4cdfaccf07d8d99f8dd5a6a760d57c03b013cd9ca137efd1b2b391b5');
  expect(data.cases.slice(holdoutIds.length).map(({ id }) => id)).toEqual([
    'private-job-temp-cleanup',
    'permission-prompt-hold',
    'provider-safety-refusal',
    'held-event-dedupe',
    'unresolved-teardown',
    'exited-tree-retained-metadata',
    'settled-tree-archive-hold',
    'settled-job-release-and-cleanup',
    'closed-pr-worktree-cleanup',
    'compact-continuity-archive',
    'workspace-local-temporary-files',
    'binding-mismatch', 'overlap-ordering-hold', 'retained-worktree-limit',
    'missing-host-clone',
  ]);
  for (const scenario of data.cases) {
    expect(scenario.input).toBeTruthy();
    expect(scenario.expected.length).toBeGreaterThan(1);
    expect(scenario.forbidden.length).toBeGreaterThan(1);
  }
});

test('shadow and report preserve the native manager lane during unknown coverage', () => {
  const text = compact('skills/axstack/references/automations.md');
  const shadow = text.split('### Workflow shadow')[1].split('### Active workflow')[0];
  const lane = [/native schedule/i, /keeps ownership|remains the owner/i, /project and descendant coverage is unknown|unknown project and descendant coverage/i];
  checkRule(shadow, (prose) => requires(prose, ...lane),
    'With unknown project and descendant coverage, the native schedule remains the owner.',
    [[lane[1], 'switches ownership']], lane);
  const denial = /never block|cannot block/i;
  const slot = [/idle flagged threads/i, /slot/i];
  checkRule(text, (prose) => prohibits(prose, denial, ...slot),
    'Idle flagged threads cannot block the next slot.',
    [[denial, 'always block']], slot);
});

test('workflow shadow documents continuity freshness and the native reap boundary', () => {
  const prose = compact('skills/axstack/references/automations.md').split('### Workflow shadow')[1].split('### Active workflow')[0];
  const once = [/imports?|loads?/i, /continuity/i, /(?:exactly )?once|a single time/i];
  checkRule(prose, (value) => requires(value, ...once),
    'The workflow loads continuity a single time when it starts.',
    [[once[2], 'every tick']], once);
  const age = [/full-pass-age/i, /fails?|becomes stale/i, /(?:4|four) hours/i, /wakes?/i];
  checkRule(prose, (value) => requires(value, ...age),
    'The full-pass-age fact becomes stale within four hours and wakes the manager.',
    [[age[1], 'passes forever']], age);
  const wake = [/missing|absent/i, /stale|expired/i, /failed|unsuccessful/i, /reap/i, /wakes?|wake reason/i];
  checkRule(prose, (value) => requires(value, ...wake),
    'A reap result wakes the manager if absent, expired or unsuccessful.',
    [[wake[4], 'quiet reason']], wake);
  const ownership = [/native (?:schedule|manager)/i, /owns?|retains?/i, /live reap/i, /reviewer admission/i];
  checkRule(prose, (value) => requires(value, ...ownership),
    'The native manager retains live reap and reviewer admission.',
    [[ownership[1], 'cedes']], ownership);
});

test('the active cutover keeps continuity with the manager and wakes on uncertainty', () => {
  const active = compact('skills/axstack/references/automations.md')
    .split('### Active workflow')[1].split('## Session admission')[0];
  const ownership = [/manager owns/i, /progress\.md/i, /workflow reads/i, /pre-identity/i];
  checkRule(active, (prose) => requires(prose, ...ownership),
    'The manager owns `progress.md` and the workflow reads a pre-identity snapshot.',
    [[ownership[0], 'workflow owns'], [ownership[2], 'workflow overwrites']], ownership);
  const quiet = [/skips the agent/i, /only (?:when|if)/i, /every quiet term passes/i];
  checkRule(active, (prose) => requires(prose, ...quiet),
    'Active skips the agent only if every quiet term passes.',
    [[quiet[2], 'any quiet term passes']], quiet);
});
