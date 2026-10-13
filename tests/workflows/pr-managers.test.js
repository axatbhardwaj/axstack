import { test, expect } from 'bun:test';
import { publicDocPaths } from './public-docs.js';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';

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
    expect(read(path), `${path} discovers the contract relatively`).toContain('../axstack/references/automations.md');
  }
  expect(compact(reviewPath)).toMatch(/axstack-review/i);
  const reviewSkill = compact('skills/axstack-review/SKILL.md');
  expect(reviewSkill).toMatch(/fresh review-manager session[\s\S]{0,220}follow only[^.]*discovery[^.]*admission/i);
  expect(reviewSkill).toMatch(/Do not review a PR[^.]*materialize `axstack-owner`[^.]*check out a PR branch/i);
});

// The packaged prompt is the gate's production boundary; mutations below
// protect its semantics without claiming live model or scheduler compliance.
const gatePaths = ['review-manager-prompt.md', 'automations.md'];
const quietRules = [
  ['gate precedes skill loading',
    [/quiet check/i, /before/i, /invoking.*axstack-review/i, /reading any.*skills\/\*\*/i],
    'Before invoking axstack-review or reading any skills/** file, perform the quiet check.',
    [[/before/i, 'after']]],
  ['changed PR list is busy',
    [/run.*full pass/i, /when/i, /\bsorted list/i, /differs|different/i, /Quiet gate:/i],
    'When the sorted list is different from Quiet gate:, run the full pass.',
    [[/differs|different/i, 'equal']]],
  ['non-terminal lane thread is busy',
    [/run.*full pass/i, /when/i, /other lane thread/i, /non-terminal/i],
    'When any other lane thread is non-terminal, run the full pass.',
    [[/non-terminal/i, 'terminal']]],
  ['unreadable continuity is busy',
    [/run.*full pass/i, /when/i, /continuity/i, /watermark/i, /missing/i, /malformed/i, /unreadable/i],
    'When continuity or a watermark is missing, malformed or unreadable, run the full pass.',
    [[/unreadable/i, 'readable'], [/missing/i, 'present'], [/malformed/i, 'valid']]],
  ['stale full pass is busy',
    [/run.*full pass/i, /when/i, /Last full pass:/i, /at least 4 hours old/i, /future/i],
    'When Last full pass: is at least 4 hours old or in the future, run the full pass.',
    [[/at least 4 hours old/i, 'less than 4 hours old']]],
  ['incomplete calls are busy',
    [/run.*full pass/i, /when/i, /call fails/i, /pagination/i, /head OIDs/i, /liveness/i, /incomplete/i, /unknown/i],
    'When a call fails or pagination, head OIDs or thread/run liveness is incomplete or unknown, run the full pass.',
    [[/call fails/i, 'call succeeds'], [/incomplete/i, 'complete'], [/unknown/i, 'known']]],
  ['account picker is mandatory and first',
    [/account picker/i, /must run first/i, /before.*quiet check/i],
    'Before the quiet check, the account picker must run first.',
    [[/must/i, 'may'], [/first/i, 'last'], [/before/i, 'after']], gatePaths],
  ['recorded work and non-user holds are busy',
    [/run.*full pass/i, /when/i, /continuity records/i, /\bany\b/i,
      /unserved/i, /capacity-deferred/i, /INCOMPLETE/, /re-eligible/i,
      /or any open hold/i, /resume condition/i, /beyond a user decision|other than only the user/i],
    'When continuity records any unserved, capacity-deferred, INCOMPLETE or re-eligible event, or any open hold with a resume condition other than only the user, run the full pass.',
    [[/run.*full pass/i, 'end quietly'], [/\bany\b/gi, 'every'],
      [/or any open hold/i, 'and any open hold'],
      [/beyond a user decision|other than only the user/i, 'awaiting only the user']], gatePaths],
  ['user-only holds remain quiet-eligible',
    [/holds awaiting only the user/i, /remain quiet-eligible/i,
      /updatedAt/i, /4 h full pass/i, /reminders/i],
    'Holds awaiting only the user remain quiet-eligible because updatedAt changes with a PR decision and the 4 h full pass covers reminders.',
    [[/only the user/i, 'also the user'], [/quiet-eligible/i, 'busy']], gatePaths],
];
for (const [name, concepts, rewording, inversions, paths = [gatePaths[0]]] of quietRules) {
  test(`review-manager quiet gate: ${name}`, () => {
    for (const path of paths) checkRule(compact(`skills/axstack/references/${path}`),
      (text) => requires(text, ...concepts), rewording,
      [...inversions, [/^/, 'Do not ']], concepts);
  });
}

test('quiet check is physically before the full-pass skill entry', () => {
  const text = compact('skills/axstack/references/review-manager-prompt.md');
  const accepts = (source) => {
    const check = source.search(/\b(?:run|perform) (?:the|a) quiet check/i);
    const entry = source.search(/Enter through installed.*axstack-review/i);
    return check >= 0 && entry > check;
  };
  expect(accepts(text)).toBe(true);
  expect(accepts(text.replace(/quiet check/gi, ''))).toBe(false);
  expect(accepts(`Enter through installed axstack-review. ${text}`)).toBe(false);
  const directive = text.match(/\bRun the quiet check[^.]*\./i)[0];
  expect(accepts(text.replace(directive, '') + directive)).toBe(false);
  expect(accepts(text.replace(/Run the quiet check/i, 'Perform a quiet check'))).toBe(true);
});

test('quiet discovery uses authenticated paginated PR and lane inventories', () => {
  const text = compact('skills/axstack/references/review-manager-prompt.md');
  const concepts = [/gh api user/i, /union/i, /two paginated.*gh search prs/i,
    /review-requested:@me/, /involves:@me/, /each with/i, /--limit 1000/,
    /open/i, /non-draft/i, /authored by someone else/i,
    /\bsorted\b/i, /repo#number/i, /headRefOid/i, /updatedAt/i];
  checkRule(text, (source) => requires(source, ...concepts),
    'Use gh api user to resolve self, then union two paginated gh search prs queries (review-requested:@me and involves:@me), each with --limit 1000, for open, non-draft PRs authored by someone else, producing sorted (repo#number, headRefOid, updatedAt) tuples.',
    [[/union/i, 'intersect'], [/each with/i, 'one with'], [/--limit 1000/, '--limit 30'],
      [/paginated/i, 'first-page'], [/authored by someone else/i, 'authored by self'],
      [/\bsorted\b/i, 'unsorted']], concepts);
  const lane = [/inventory/i, /every page/i, /T3/i, /lane/i, /thread/i, /run/i, /liveness/i];
  checkRule(text, (source) => requires(source, ...lane),
    'Inventory every page of T3 lane threads and their run liveness.',
    [[/every page/i, 'one page']], lane);
});

test('quiet search results at either limit are incomplete', () => {
  const cap = [/either query/i, /result count/i, /at or above 1000|1000 or more/i,
    /coverage/i, /\bincomplete\b/i];
  checkRule(compact('skills/axstack/references/review-manager-prompt.md'),
    (source) => requires(source, ...cap),
    'In either query, a result count of 1000 or more makes coverage incomplete.',
    [[/either query/i, 'both queries'], [/at or above 1000|1000 or more/i, 'below 1000'],
      [/\bincomplete\b/i, 'complete']], cap);
});

test('quiet exit is silent and leaves skills, sweep and continuity untouched', () => {
  const text = compact('skills/axstack/references/review-manager-prompt.md');
  const restrictions = [/no text|without text/i,
    /no skill load|without skill loading/i, /no sweep|without a sweep/i,
    /no continuity write|without continuity writes/i];
  const concepts = [/every busy condition is false/i, /end the turn/i, ...restrictions];
  const accepts = (source) => sentences(source).some((sentence) =>
    concepts.every((concept) => concept.test(sentence)) &&
    requires(restrictions.reduce((value, rule) => value.replace(rule, ''), sentence), /^/));
  checkRule(text, accepts,
    'When every busy condition is false, end the turn without text, without skill loading, without a sweep and without continuity writes.',
    [[/every busy condition is false/i, 'any busy condition is true'],
      ...restrictions.map((rule) => [rule, 'perform the action'])], concepts);
});

test('full passes record quiet watermarks in durable continuity', () => {
  for (const path of ['review-manager-prompt.md', 'automations.md']) {
    const text = compact(`skills/axstack/references/${path}`);
    const concepts = [/full pass (?:records?|saves?)/i, /Watermarks/i,
      /Quiet gate:/i, /\bsorted list/i, /Last full pass:/i, /UTC/i];
    checkRule(text, (source) => requires(source, ...concepts),
      'The full pass records Watermarks: Quiet gate: as the sorted list and Last full pass: as UTC.',
      [[/records?|saves?/i, 'ignores'], [/\bsorted\b/i, 'unsorted']], concepts);
  }
  const template = read('skills/axstack/references/run-record.md')
    .split('## Review-manager continuity template')[1].split('## Compact template')[0];
  expect(template).toMatch(/## Watermarks[\s\S]*Quiet gate:[^\n]*\bsorted\b[^\n]*headRefOid[^\n]*updatedAt/i);
  expect(template).toMatch(/## Watermarks[\s\S]*Last full pass:[^\n]*UTC/i);
});

test('documented review-manager schedules are hourly', () => {
  for (const path of ['skills/axstack/references/automations.md',
    'skills/axstack/references/lifecycle.md', 'docs/host-operations.md', 'README.md']) {
    const text = compact(path);
    expect(text, path).not.toMatch(/15-minute|every 15 minutes|everyMs:900000/i);
    expect(text, path).toMatch(/hourly|every hour/i);
    expect(text, path).toContain('everyMs:3600000');
  }
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
  expect(text).toMatch(/canary[^.]*two overlapping[^.]*run_scheduled_task_now[^.]*one admission owner/i);
  expect(requires(text, /canary/i, /reconcil/i, /killed/i, /predecessor/i)).toBe(true);
  expect(text).not.toMatch(/`cursor\.json`|`pending\.json`|decision token|precheck\.log/i);
});

test('manager sessions reconcile before admission in the dedicated workspace', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/schedule_task[^.]*everyMs:3600000[^.]*bindToCurrentThread:false/i);
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
  expect(runtime).toContain('Before use, commands must scope `TMPDIR` to an owned 0700 directory under the system temp directory, never under `$HOME`, named from the dispatch key and recorded in the receipt.');
  expect(runtime).toContain('Validate its real path, absence of symlinks and ownership before use and cleanup; remove it afterwards by literal absolute path.');
  expect(runtime).toContain('Evidence files still go to the private `<run>/evidence/<key>/` folder.');
  expect(runtime).toMatch(/exact validated owned path[^.]*no glob[^.]*no parent-root deletion/i);
  expect(runtime).toMatch(/Uncertain paths[^.]*preserv/i);
  expect(runtime).toMatch(/equivalent guards[^.]*worktree-local paths/i);
  expect(manager).toContain('Set `TMPDIR` for manager and job commands to an owned 0700 directory under the system temp directory, named from the dispatch key and recorded in the receipt, following [Workspace hygiene](workspace-hygiene.md).');
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
  const teardown = text.split('## Finite-session teardown')[1].split('## Activation canary')[0];
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
  expect(text).toMatch(/dirty source[\s\S]*?unpushed commits[\s\S]*?salvage path/i);
  expect(text).toMatch(/review evidence not yet durable[^.]*user-owned[^.]*proven/i);
  expect(text).toMatch(/pending external result[^.]*unconfirmed review submission[^.]*not pending CI/i);
  expect(text).toMatch(/ascending repository and PR-number tie breaks/i);
});

test('evaluation scenarios cover each accepted decision boundary', () => {
  const data = JSON.parse(read('tests/workflows/pr-manager-scenarios.json'));
  expect(data.version).toBe(8);
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
  expect(Bun.CryptoHasher.hash(
    'sha256',
    JSON.stringify(data.cases.slice(0, holdoutIds.length)),
    'hex',
  )).toBe('1868e51eb131995009de34a71a360b4f56d1e15dd53fd17429fb08322d14c2c2');
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
    'four-part-canary', 'missing-host-clone',
  ]);
  for (const scenario of data.cases) {
    expect(scenario.input).toBeTruthy();
    expect(scenario.expected.length).toBeGreaterThan(1);
    expect(scenario.forbidden.length).toBeGreaterThan(1);
  }
});
