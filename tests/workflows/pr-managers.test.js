import { test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

// These are source-contract checks. The separately frozen model evaluation is
// the behavioral evidence; passing these checks alone proves no runtime result.
test('review manager exposes one short finite-session native prompt', () => {
  const reviewPath = 'skills/axstack/references/review-manager-prompt.md';
  expect(existsSync(`${root}/skills/axstack/references/watch-manager-prompt.md`)).toBe(false);
  for (const path of [reviewPath]) {
    expect(existsSync(`${root}/${path}`), `${path} exists`).toBe(true);
    expect(read(path).length, `${path} stays thin`).toBeLessThan(2200);
    expect(read(path), `${path} discovers the contract relatively`).toContain('../axstack/references/automations.md');
  }
  expect(compact(reviewPath)).toMatch(/axstack-review/i);
  const reviewSkill = compact('skills/axstack-review/SKILL.md');
  expect(reviewSkill).toMatch(/fresh review-manager session[\s\S]{0,220}follow only[^.]*discovery[^.]*admission/i);
  expect(reviewSkill).toMatch(/Do not review a PR[^.]*materialize `axstack-owner`[^.]*check out a PR branch/i);
});

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
    'README.md',
    'docs/workflows.md',
  ]) {
    expect(compact(path), path).not.toMatch(/(?:at most|maximum of|cap(?:ped)? (?:at|of)) (?:five|5|one|1) (?:executing |concurrent(?:ly)? |bounded )?(?:PR |actionable-event )?(?:jobs|tasks)/i);
  }
});

test('manager contract uses bounded PR jobs and native recovery without a queue engine', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/one separate Orca worktree per PR job/i);
  expect(text).toMatch(/manager[^.]*never[^.]*checks? out[^.]*PR branch/i);
  expect(text).toMatch(/descendants[^.]*active|active[^.]*descendants/i);
  expect(text).toMatch(/settlement[^.]*frees[^.]*slot|slot[^.]*freed[^.]*settled/i);
  expect(text).toMatch(/reconcile[^.]*workers[^.]*GitHub[^.]*compact (?:run )?record/i);
  expect(text).toMatch(/unknown ownership[^.]*only[^.]*affected PR|affected PR[^.]*unknown ownership/i);
  expect(text).toMatch(/canary[^.]*fresh-session launch[^.]*overlapping-pass behavior[^.]*recovery/i);
  expect(text).toMatch(/canary[^.]*nested dispatch depth[^.]*coordinator-launched leaves/i);
  expect(text).not.toMatch(/`cursor\.json`|`pending\.json`|decision token|precheck\.log/i);
});

test('manager sessions reconcile before admission in the dedicated workspace', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/native existing-workspace mode[^.]*--fresh-session/i);
  expect(text).toMatch(/reconcile[^.]*saved state[^.]*GitHub[^.]*native Orca[^.]*before[^.]*admission/i);
  expect(text).toMatch(/live manager[^.]*same lane[^.]*authoritative/i);
  expect(text).toMatch(/duplicate[^.]*no PR work[^.]*no shared-record write/i);
  expect(text).toMatch(/duplicate[^.]*closes only its own exact terminal/i);
  expect(text).toMatch(/unknown liveness[^.]*does not authorize[^.]*duplicate|unknown liveness[^.]*blocks[^.]*admission/i);
});

test('manager event identity survives same-head changes', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/unchanged exact head[^.]*new event identity[^.]*actionable/i);
  expect(text).toMatch(/unchanged exact head and (?:unchanged|same) event[^.]*no job/i);
  expect(text).toMatch(/review ID[^.]*body digest/i);
});

test('manager jobs use private owned scratch without broad cleanup', () => {
  const runtime = compact('skills/axstack/references/orca-runtime.md');
  const manager = compact('skills/axstack/references/automations.md');
  expect(runtime).toMatch(/worktree-local[^.]*task[^.]*dispatch[^.]*0700/i);
  expect(runtime).toMatch(/real path[^.]*inside[^.]*worktree[^.]*not a symbolic link/i);
  expect(runtime).toMatch(/exact validated owned path[^.]*no glob/i);
  expect(runtime).toMatch(/never[^.]*wipe[^.]*cache/i);
  expect(runtime).toMatch(/uncertain temporary[^.]*preserv/i);
  expect(manager).toMatch(/TMPDIR[^.]*manager and job commands[^.]*private directory/i);
});

test('held manager jobs settle natively before releasing capacity', () => {
  const runtime = compact('skills/axstack/references/orca-runtime.md');
  const manager = compact('skills/axstack/references/automations.md');
  expect(runtime).toMatch(/permission prompt[^.]*provider safety refusal[^.]*held[^.]*incomplete/i);
  expect(runtime).toMatch(/never[^.]*bypass[^.]*retry[^.]*another model/i);
  expect(manager).toMatch(/native runtime inspection[^.]*actual hold/i);
  expect(manager).toMatch(/do not forge[^.]*worker_done/i);
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
  expect(teardown).toMatch(/Save continuity[^.]*last pass summary[\s\S]*?exact native terminal close/i);
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
  expect(manager).toMatch(/security concern[^.]*permanent on-chain[^.]*architecture decision/i);
  expect(manager).toMatch(/Telegram delivery[^.]*Telegram reply[^.]*silence never authorizes/i);
  expect(manager).toMatch(/No manager[^.]*may merge[^.]*close[^.]*force-push[^.]*rebase[^.]*restack[^.]*mutate a PR branch/i);
  expect(manager).toMatch(/Human merge remains the boundary/i);
});

test('manager continuity reuses valid state and keeps publication bounded', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/manager lane owns ongoing discovery and continuity[^.]*coordinator owns only[^.]*event/i);
  expect(text).toMatch(/Reuse[^.]*worktree[^.]*owner[^.]*unchanged receipts/i);
  expect(text).toMatch(/Settlement returns continuity[^.]*manager[^.]*rather than retaining an idle PR coordinator/i);
  expect(text).toMatch(/dirty source[^.]*unarchived review evidence[^.]*user-owned work[^.]*proven/i);
  expect(text).toMatch(/pending external result[^.]*unconfirmed review submission[^.]*not pending CI/i);
  expect(text).toMatch(/ascending repository and PR-number tie breaks/i);
});

test('evaluation scenarios cover each accepted decision boundary', () => {
  const data = JSON.parse(read('tests/workflows/pr-manager-scenarios.json'));
  expect(data.version).toBe(7);
  expect(data.migration).toMatch(/v7[^.]*exact own-terminal close/i);
  expect(data.evidence).toMatch(/behavioral evaluation inputs/i);
  expect(data.evidence).toMatch(/not a model evaluation result|no model evaluation/i);
  expect(data.evidence).toMatch(/not a scheduler implementation|not.*runtime receipt/i);
  const holdoutIds = [
    'thirty-peer-pr-coverage',
    'finite-unchanged-pass',
    'duplicate-manager-self-close',
    'owned-shell-cleanup',
    'durable-review-decision',
    'same-head-new-peer-request',
    'unsettled-descendant',
    'recovery-unknown-ownership',
    'resource-aware-sixth-job',
  ];
  expect(data.cases.slice(0, holdoutIds.length).map(({ id }) => id)).toEqual(holdoutIds);
  expect(Bun.CryptoHasher.hash(
    'sha256',
    JSON.stringify(data.cases.slice(0, holdoutIds.length)),
    'hex',
  )).toBe('bddf98f6b4414c38f6901aa6b82bcf7b6e08c7f7b7e8a0eb37fbc078438a2064');
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
  ]);
  for (const scenario of data.cases) {
    expect(scenario.input).toBeTruthy();
    expect(scenario.expected.length).toBeGreaterThan(1);
    expect(scenario.forbidden.length).toBeGreaterThan(1);
  }
});
