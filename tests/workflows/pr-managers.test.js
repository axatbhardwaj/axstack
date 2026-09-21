import { test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

// These are source-contract checks. The separately frozen model evaluation is
// the behavioral evidence; passing these checks alone proves no runtime result.
test('thin PR managers expose two short finite-session native prompts', () => {
  const reviewPath = 'skills/axstack/references/review-manager-prompt.md';
  const watchPath = 'skills/axstack/references/watch-manager-prompt.md';
  for (const path of [reviewPath, watchPath]) {
    expect(existsSync(`${root}/${path}`), `${path} exists`).toBe(true);
    expect(read(path).length, `${path} stays thin`).toBeLessThan(2200);
    expect(read(path), `${path} discovers the contract relatively`).toContain('../axstack/references/automations.md');
  }
  expect(compact(reviewPath)).toMatch(/axstack-review/i);
  expect(compact(watchPath)).toMatch(/axstack-watch/i);
  const reviewSkill = compact('skills/axstack-review/SKILL.md');
  const watchSkill = compact('skills/axstack-watch/SKILL.md');
  expect(reviewSkill).toMatch(/fresh review-manager session[\s\S]{0,220}follow only[^.]*discovery[^.]*admission/i);
  expect(reviewSkill).toMatch(/Do not review a PR[^.]*materialize `axstack-owner`[^.]*check out a PR branch/i);
  expect(watchSkill).toMatch(/fresh watch-manager session[\s\S]{0,220}follow only[^.]*discovery[^.]*admission/i);
  expect(watchSkill).toMatch(/Do not adopt or repair a PR[^.]*materialize `axstack-owner`[^.]*check out a PR branch/i);
});

test('manager contract separates coverage from per-manager execution capacity', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/exactly two[^.]*reusable[^.]*manager/i);
  expect(text).toMatch(/review manager[^.]*at most (?:five|5)/i);
  expect(text).toMatch(/watch manager[^.]*at most (?:five|5)/i);
  expect(text).toMatch(/no borrowing|never borrow/i);
  expect(text).toMatch(/complete discovery pages|every discovery page|all discovery pages/i);
  expect(text).toMatch(/waiting[^.]*does not[^.]*execution slot|waiting[^.]*occup(?:y|ies) no[^.]*slot/i);
  expect(text).toMatch(/oldest actionable[^.]*unserved|fair/i);
  expect(text).not.toMatch(/at most (?:eight|8) live dispatch markers/i);
});

test('manager contract uses bounded PR jobs and native recovery without a queue engine', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/one separate Orca worktree per PR job/i);
  expect(text).toMatch(/manager[^.]*never[^.]*checks? out[^.]*PR branch/i);
  expect(text).toMatch(/descendants[^.]*active|active[^.]*descendants/i);
  expect(text).toMatch(/settlement[^.]*frees[^.]*slot|slot[^.]*freed[^.]*settled/i);
  expect(text).toMatch(/reconcile[^.]*workers[^.]*GitHub[^.]*compact (?:run )?record/i);
  expect(text).toMatch(/unknown ownership[^.]*only[^.]*affected PR|affected PR[^.]*unknown ownership/i);
  expect(text).toMatch(/canary[^.]*same-session reuse[^.]*busy tick[^.]*recovery/i);
  expect(text).toMatch(/canary[^.]*nested dispatch depth[^.]*coordinator-launched leaves/i);
  expect(text).not.toMatch(/`cursor\.json`|`pending\.json`|decision token|precheck\.log/i);
});

test('manager sessions reconcile before admission and duplicates close without shared writes', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/fresh finite session[^.]*persistent dedicated workspace/i);
  expect(text).toMatch(/reconcile[^.]*saved state[^.]*GitHub[^.]*native Orca[^.]*before[^.]*admission/i);
  expect(text).toMatch(/another live[^.]*same (?:lane|manager)[^.]*no PR work[^.]*no shared-record write/i);
  expect(text).toMatch(/duplicate[^.]*close[^.]*only[^.]*itself/i);
  expect(text).toMatch(/unknown liveness[^.]*does not authorize[^.]*duplicate|unknown liveness[^.]*blocks[^.]*admission/i);
});

test('manager event identity survives same-head changes', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/unchanged exact head[^.]*new event identity[^.]*actionable/i);
  expect(text).toMatch(/unchanged exact head and (?:unchanged|same) event[^.]*no job/i);
  expect(text).toMatch(/review ID[^.]*body digest/i);
});

test('manager teardown preserves continuity and makes self-close the final action', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/settle[^.]*descendants[^.]*before[^.]*manager/i);
  expect(text).toMatch(/save[^.]*continuity[^.]*user decisions[^.]*before[^.]*self-close/i);
  expect(text).toMatch(/positively identified[^.]*owned[^.]*unused setup shells/i);
  expect(text).toMatch(/exact terminal[^.]*close|native exact-terminal[^.]*close/i);
  expect(text).toMatch(/self-close[^.]*final action/i);
  expect(text).toMatch(/dirty worktrees[^.]*unpushed candidates[^.]*review evidence/i);
  expect(text).toMatch(/user-owned[^.]*unknown liveness[^.]*user_takeover[^.]*ambiguous publication/i);
});

test('user decisions remain actionable after the finite manager session closes', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/GitHub[^.]*durable user-owned conversation/i);
  expect(text).toMatch(/never depend[^.]*closed manager (?:chat|conversation|session)/i);
  expect(text).toMatch(/revalidate[^.]*candidate[^.]*head[^.]*base[^.]*event/i);
});

test('manager contract preserves authority and exceptional chat holds', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/defi-com\/monorepo[^.]*defi-com\/mobile/i);
  expect(text).toMatch(/peer code[^.]*read-only/i);
  expect(text).toMatch(/human merge|human[^.]*merges/i);
  expect(text).toMatch(/fast-forward[^.]*repair push|repair[^.]*fast-forward push/i);
  expect(text).toMatch(/security[^.]*permanent on-chain[^.]*architecture/i);
  expect(text).toMatch(/manager[^.]*Orca (?:chat|conversation)/i);
  expect(text).toMatch(/Telegram[^.]*never[^.]*authoriz|silence[^.]*never[^.]*authoriz/i);
});

test('watch repair admission preserves regression evidence and review dedupe', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/failing check[^.]*base check-run[^.]*same name[^.]*producing app identity[^.]*passing/i);
  expect(text).toMatch(/legacy status[^.]*same context/i);
  expect(text).toMatch(/`CHANGES_REQUESTED` review[^.]*review ID[^.]*body digest/i);
  expect(text).toMatch(/missing[^.]*pending[^.]*same-name\/different-app[^.]*holds repair/i);
  expect(text).toMatch(/new head or generic event[^.]*no repair authority/i);
  expect(text).toMatch(/deploy-on-push exclusions[^.]*lowest-first stack/i);
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

test('manager continuity reuses valid state and keeps publication bounded', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/manager owns ongoing discovery and continuity[^.]*coordinator owns only[^.]*event/i);
  expect(text).toMatch(/Reuse[^.]*worktree[^.]*owner[^.]*unchanged receipts/i);
  expect(text).toMatch(/Settlement returns continuity[^.]*manager[^.]*rather than retaining an idle PR coordinator/i);
  expect(text).toMatch(/dirty worktree[^.]*unpushed candidate[^.]*user-owned work[^.]*proven/i);
  expect(text).toMatch(/pending external result[^.]*unconfirmed publication or send outcome[^.]*not pending CI/i);
  expect(text).toMatch(/ascending repository and PR-number tie breaks/i);
  expect(text).toMatch(/fast-forward repair push[^.]*exact-current candidate[^.]*remote readback/i);
  expect(text).toMatch(/ambiguous review or push result[^.]*before any retry/i);
  expect(text).toMatch(/may merge, close, force-push, rebase, restack[\s\S]{0,160}Human merge/i);
});

test('bounded watch jobs settle without inheriting standalone lifetime', () => {
  const watch = compact('skills/axstack-watch/SKILL.md');
  expect(watch).toMatch(/standalone live watch[^.]*timer receipts[^.]*common expiry/i);
  expect(watch).toMatch(/bounded manager PR job ends[^.]*current event[^.]*descendant settle/i);
  expect(watch).toMatch(/returns exact receipts[^.]*reusable manager[^.]*releases proven resources/i);
  expect(watch).toMatch(/never waits for merge[^.]*or stops[^.]*recurring schedule/i);
  expect(watch).toMatch(/End a standalone watch[^.]*merge[^.]*cancellation[^.]*24 h deadline/i);
});

test('evaluation scenarios cover each accepted decision boundary', () => {
  const data = JSON.parse(read('tests/workflows/pr-manager-scenarios.json'));
  expect(data.version).toBe(2);
  expect(data.evidence).toMatch(/not a scheduler implementation|not.*runtime receipt/i);
  expect(data.cases.map(({ id }) => id)).toEqual([
    'thirty-pr-coverage',
    'finite-unchanged-pass',
    'duplicate-manager-self-close',
    'owned-shell-cleanup',
    'durable-user-decision',
    'same-head-new-review-event',
    'unsettled-descendant',
    'recovery-unknown-ownership',
    'fair-sixth-job',
  ]);
  for (const scenario of data.cases) {
    expect(scenario.input).toBeTruthy();
    expect(scenario.expected.length).toBeGreaterThan(1);
    expect(scenario.forbidden.length).toBeGreaterThan(1);
  }
});
