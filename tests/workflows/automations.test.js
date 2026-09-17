import { test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');
const refPath = 'skills/axstack/references/automations.md';

test('automations: rev-4 driver and watchdog contract replaces the retired pairs', () => {
  expect(existsSync(`${root}/${refPath}`), `missing ${refPath}`).toBe(true);
  const text = compact(refPath);
  expect(text).toMatch(/\*\*driver\*\*[^.]*every 15 minutes/i);
  expect(text).toMatch(/\*\*watchdog\*\*[^.]*hourly/i);
  expect(text).toMatch(/Pair A\/B[^.]*retired/i);
  expect(text).not.toMatch(/pair C\/D/i);
  expect(text).toMatch(/driver[^.]*automation session itself[^.]*no `axstack-monitor` or `axstack-owner`/i);
  expect(text).toMatch(/\*\*watchdog\*\*[^.]*hourly/i);
  expect(text).toMatch(/shell precheck with no model/i);
});

test('automations: discovery uses four searches, debounce, and the exact due-work classes', () => {
  const text = compact(refPath);
  for (const query of [
    '--author @me',
    '--review-requested @me',
    '--mentions @me',
    '--reviewed-by @me --review changes_requested',
  ]) expect(text).toContain(query);
  expect(text).toMatch(/peer and fourth-search heads[^.]*second consecutive precheck/i);
  expect(text).toMatch(/own heads[^.]*immediately/i);
  expect(text).toMatch(/own PRs contribute[^.]*checks[^.]*reduced to[^.]*name[^.]*conclusion\|state/i);
  expect(text).toMatch(/latestReviews[^.]*id[^.]*state[^.]*commit[^.]*head/i);
  const due = text.slice(text.indexOf('Due control work'), text.indexOf('## Driver tick'));
  expect(due).toMatch(/`approved` or `rejected`[^.]*without `consumed_at`/i);
  expect(due).toMatch(/`spent`[^.]*without a receipt/i);
  expect(due).toMatch(/`deferred\[\]`[^.]*head still matches/i);
  expect(due).toMatch(/expired repair cap/i);
  expect(due).toMatch(/dispatch marker[^.]*older than 3 h/i);
  expect(due).toMatch(/`pending_settlement\[\]`/i);
});

test('automations: dispatch claims, TTL, budgets, and both repair triggers are pinned', () => {
  const text = compact(refPath);
  expect(text).toMatch(/dispatch marker[^.]*task id[^.]*dispatch id[^.]*worktree[^.]*head[^.]*started_at[^.]*reservation[^.]*trigger/i);
  expect(text).toMatch(/trigger[^.]*`\{kind: check, name, app_id\}`[^.]*`\{kind: review, review_id, digest\}`/i);
  expect(text).toMatch(/marker older than 3 h/i);
  expect(text).toMatch(/live worker[^.]*`worker-stop`/i);
  expect(text).toMatch(/exited worker[^.]*`worker-abandon`/i);
  expect(text).toMatch(/review-triggered[^.]*marker's `trigger`[^.]*remove exactly[^.]*review id[^.]*digest[^.]*`processed_reviews\[\]`/i);
  expect(text).toMatch(/one `verdict` dispatch per tick/i);
  expect(text).toMatch(/six `repair` markers live/i);
  expect(text).toMatch(/one repair per PR per 24 h/i);
  expect(text).toMatch(/failing check[^.]*base check-run[^.]*same `name`[^.]*same producing `app\.id`[^.]*passing/i);
  expect(text).toContain('gh api repos/<repo>/commits/<base>/check-runs');
  expect(text).toMatch(/legacy commit status[^.]*same `context`/i);
  expect(text).toMatch(/missing[^.]*pending[^.]*same-name different-app base check[^.]*holds/i);
  expect(text).toMatch(/`CHANGES_REQUESTED` review[^.]*review id/i);
  expect(text).toMatch(/SHA-256 body digest[^.]*PR and head/i);
  expect(text).toMatch(/same finding[^.]*new review id[^.]*must not re-trigger/i);
  expect(text).toMatch(/superseded head[^.]*new review[^.]*triggers again[^.]*24 h cap/i);
});

test('automations: peer follow-up protects every human block and permits only marked or legacy reviews', () => {
  const text = compact(refPath);
  expect(text).toMatch(/whenever any self review with state `CHANGES_REQUESTED` exists[^.]*whichever search/i);
  expect(text).toMatch(/latest effective, non-dismissed self review[^.]*line prefix `<!-- axstack-automation verdict`/i);
  expect(text).toMatch(/id[^.]*`legacy_automation_reviews\[\]`/i);
  expect(text).toMatch(/otherwise record and skip/i);
  expect(text).toMatch(/dismissed block[^.]*skipped/i);
});

test('automations: reviewer rules use three criteria, binding verdict marker, and decision tokens', () => {
  const text = compact(refPath);
  expect(text).toContain('Escalate to user: yes | no — <criterion> — <reason>');
  for (const criterion of [
    'security concern',
    'permanent on-chain state change',
    'architectural change in approach',
  ]) expect(text).toMatch(new RegExp(criterion, 'i'));
  expect(text).toMatch(/exactly three/i);
  expect(text).toMatch(/no automation-health criterion/i);
  expect(text).toContain('<!-- axstack-automation verdict head=<sha> -->');
  expect(text).toMatch(/immediately before `gh pr review`[^.]*re-reads self[^.]*reviews/i);
  expect(text).toMatch(/`escalate`[^.]*opens a decision token[^.]*exits/i);
  expect(text).toContain('`~/defi/misc/reviews/`');
  expect(text).toContain('`review-PR-<num>.html` with no prefix means `defi-com/monorepo`');
  expect(text).toContain('`review-mobile-PR-<num>.html`');
  expect(text).toContain('`review-azure-next-hybrid-PR-<num>.html`');
  expect(text).toContain('`review-ci-workflows-PR-<num>.html`');
  expect(text).toContain('`defi-com/ci-workflows`');
});

test('automations: a published verdict body is written for the PR reader, not the pipeline', () => {
  // Feedback from a colleague on two live reviews: the body narrated the
  // pipeline ("two independent reviews, identical brief, all six angles",
  // "from secondary") and referred to findings that were never posted
  // ("two minor maintainability notes"), which lived only in the local review
  // file on the VPS. One assertion per prohibition so each can regress alone.
  const text = compact(refPath);
  const clause = text.match(/The verdict body is written for the person reading the PR[\s\S]*?only pipeline artefact the body carries\./)?.[0] ?? '';
  expect(clause, 'the verdict-body paragraph is missing').not.toBe('');

  expect(clause).toMatch(/reads as one reviewer's findings/i);
  // Each forbidden pipeline fact, individually.
  expect(clause, 'reviewer count').toMatch(/never names[^.]*reviewer count/i);
  expect(clause, 'brief').toMatch(/never names[^.]*\bthe brief\b/i);
  expect(clause, 'angles').toMatch(/never names[^.]*\bangles\b/i);
  expect(clause, 'gate').toMatch(/never names[^.]*\bthe gate\b/i);
  expect(clause, 'receipts').toMatch(/never names[^.]*\breceipts\b/i);
  expect(clause, 'attribution').toMatch(/never names[^.]*which reviewer found what/i);
  // Self-contained, with no room to omit a finding.
  expect(clause).toMatch(/self-contained/i);
  expect(clause, 'every validated finding').toMatch(/every validated finding[^.]*(?:appears|stated) in full/i);
  expect(clause, 'no dropping for brevity').toMatch(/never dropped|none is dropped/i);
  // Each inaccessible-reference branch, individually.
  expect(clause, 'local review file').toMatch(/never points[^.]*local review file/i);
  expect(clause, 'anything the reader cannot open').toMatch(/never points[^.]*cannot open/i);
  // Evidence framing, and the explicit allow/deny of borderline facts.
  expect(clause).toMatch(/what was checked and observed/i);
  expect(clause, 'head/base, CI, tests, diff size are allowed').toMatch(/head and base SHAs, CI status, test counts, and diff size[^.]*belong/i);
  expect(clause, 'pipeline phrasing is named').toMatch(/"shape verified" and "pinned CI"[^.]*do not/i);
  expect(clause).toMatch(/marker line is the only pipeline artefact/i);
});

test('automations: the pair runs from the root folder workspace and children nest under their project', () => {
  // Settled 2026-09-17: no project owns the automation. The driver and
  // watchdog run from the host's root folder workspace, the run directory is
  // private host state because that workspace is not a git repository, and a
  // per-PR child worktree is parented to its own project's primary worktree so
  // it appears under that project rather than under axstack. Asserted on the
  // shipped reference, the active spec, and the operational prompt, since a
  // stale assumption in any one of them breaks the tick.
  const ref = compact(refPath);
  const spec = compact('docs/specs/pr-automations.md');
  const prompts = compact('docs/plans/pr-automations-prompts.md');

  for (const [name, text] of [['reference', ref], ['spec', spec], ['prompts', prompts]]) {
    expect(text, `${name}: launch workspace`).toMatch(/(?:host's )?`root` folder workspace/i);
    expect(text, `${name}: run directory`).toMatch(/~\/\.local\/share\/axstack\/runs\/<run id>\//);
    expect(text, `${name}: no git-common-dir run directory`).not.toMatch(/git-common-dir[^.]*runs|runs[^.]*git-common-dir/i);
    expect(text, `${name}: no dedicated axstack worktree`).not.toMatch(/dedicated (?:Axstack |Orca )?(?:automations )?worktree/i);
  }
  expect(ref).toMatch(/not a git repository/i);
  expect(ref).toMatch(/parented to (?:that|the) project's primary worktree/i);
  expect(spec).toMatch(/project's primary worktree/i);

  // The prompt is what actually runs: parent by full Orca id, briefs by
  // absolute path, and no reliance on the launch workspace being a checkout.
  expect(prompts).toMatch(/--parent-worktree id:<clone id>::<clone path>/);
  expect(prompts).not.toMatch(/--parent-worktree <this worktree>/);
  expect(prompts).toMatch(/<axstack checkout>\/docs\/plans\/pr-automations-prompts\.md \(absolute path/);
  expect(prompts).not.toMatch(/pr-automations-prompts\.md in this worktree/);
});

test('automations: settlement leaves no worktree, directory, branch, or terminal behind', () => {
  const ref = compact(refPath);
  const spec = compact('docs/specs/pr-automations.md');
  const prompts = compact('docs/plans/pr-automations-prompts.md');
  expect(ref).toMatch(/Settlement leaves nothing behind/i);
  for (const [name, text] of [['reference', ref], ['spec', spec]]) {
    expect(text, `${name}: terminal tab`).toMatch(/closes? (?:any|its) terminal tab/i);
    expect(text, `${name}: worktree and directory`).toMatch(/removes the child worktree and its directory/i);
    expect(text, `${name}: untracked artefacts`).toMatch(/clears untracked artefacts/i);
    expect(text, `${name}: branch`).toMatch(/deletes the branch the worktree created/i);
    expect(text, `${name}: verified gone`).toMatch(/verif(?:ies|y) the directory is gone/i);
    expect(text, `${name}: leftovers are findings`).toMatch(/outlives its dispatch[^.]*health finding/i);
  }
  // The prompt spells out the same steps as commands, for both settlement
  // and abandon.
  expect(prompts).toMatch(/orca terminal close --terminal <handle> --tab/);
  expect(prompts).toMatch(/git -C <worktree path> clean -fdx/);
  expect(prompts).toMatch(/orca worktree rm --worktree id:<clone id>::<worktree path>/);
  expect(prompts).toMatch(/branch -D <worktree branch>/);
  expect(prompts).toMatch(/verify the directory is gone/);
  expect(prompts).toMatch(/after a confirmed abandon[^.]*apply the same disposability proof/);
});

test('automations: cleanup never destroys work it cannot prove is safe to lose', () => {
  // Review finding: unconditional `git clean -fdx` erases untracked files in
  // an abandoned repair, and unconditional `branch -D` can delete the only
  // ref to a committed but unpushed candidate. Destruction is gated on proof.
  const ref = compact(refPath);
  const spec = compact('docs/specs/pr-automations.md');
  const prompts = compact('docs/plans/pr-automations-prompts.md');
  // Scope the reference to its cleanup paragraph: the decisions ref is named
  // elsewhere too, and only its use as a durability proof here matters.
  const refCleanup = ref.match(/Settlement leaves nothing behind[\s\S]*?The run directory contains:/)?.[0] ?? '';
  expect(refCleanup, 'cleanup paragraph missing').not.toBe('');
  const specCleanup = spec.match(/After a worker settles the driver releases it[\s\S]*?settled by the user on 2026-09-17\)\./)?.[0] ?? '';
  expect(specCleanup, 'spec cleanup clause missing').not.toBe('');
  for (const [name, text] of [['reference', refCleanup], ['spec', specCleanup]]) {
    expect(text, `${name}: proof precedes destruction`).toMatch(/(?:proves|proven)[^.]{0,40}disposable/i);
    expect(text, `${name}: pushed candidate is durable`).toMatch(/pushed to the head branch|reachable by push/i);
    expect(text, `${name}: push proof needs a fresh fetch`).toMatch(/successful targeted fetch[^.]*failed fetch retaining/i);
    expect(text, `${name}: abandon settlement defined`).toMatch(/accepted abandon receipt/i);
    expect(text, `${name}: token-held candidate is durable`).toMatch(/refs\/axstack\/decisions\/<token>/);
    expect(text, `${name}: abandon requires a clean tree`).toMatch(/abandon[^.]*no uncommitted changes/i);
    expect(text, `${name}: unsafe work is retained`).toMatch(/is \*?\*?retained\*?\*?/i);
    expect(text, `${name}: retention is recorded`).toMatch(/health\[\][^.]*(?:path and SHA|path and \$hw)/i);
    expect(text, `${name}: blocks only that PR`).toMatch(/blocks? only that PR/i);
  }
  expect(refCleanup, 'a pending or unknown settlement stops cleanup').toMatch(/pending or unknown stops here/i);
  // The tick steps that the driver follows literally must defer to the gate
  // rather than instruct an unconditional removal.
  expect(ref, 'tick step 2 defers to the gated cleanup').toMatch(/run the cleanup under "Run directory" below, which proves the worktree disposable/);
  expect(ref, 'tick step 4 defers to the gated cleanup').toMatch(/After confirmed abandon, run the same cleanup[^.]*retained, not removed/);
  expect(ref).not.toMatch(/After confirmed abandon, remove the worktree/);
  expect(spec, 'spec step 2 defers to the gated cleanup').toMatch(/run the cleanup defined under "Run directory and state", which proves the worktree disposable/);
  expect(spec).not.toMatch(/After a confirmed abandon, remove the worktree/);
  // The prompt encodes the proof as commands, and gates clean/rm/branch -D on it.
  expect(prompts).toMatch(/pending or unknown release retains the worktree/);
  // Durability by push is tested only against a freshly fetched ref; a stale
  // origin/<branch> could make an unpushed candidate look pushed.
  expect(prompts).toMatch(/fetch origin <head branch> succeeds AND git -C <clone path> merge-base --is-ancestor \$hw FETCH_HEAD/);
  expect(prompts).toMatch(/a failed fetch is not proof: retain/);
  expect(prompts).not.toMatch(/--is-ancestor \$hw origin\/<head branch>/);
  // Abandon never yields a release receipt; its settlement is the accepted
  // abandon receipt plus proven exit.
  expect(prompts).toMatch(/there is no release receipt on this path, so do not wait for one/);
  expect(prompts).toMatch(/for-each-ref refs\/axstack\/decisions --points-at \$hw/);
  expect(prompts).toMatch(/If disposable, clean up completely/);
  expect(prompts).toMatch(/If not disposable, retain it[^.]*delete nothing/);
  expect(prompts).toMatch(/status --porcelain must be empty/);
  // clean -fdx may appear only inside the disposable branch.
  const disposableStart = prompts.indexOf('If disposable, clean up completely');
  const cleanAt = prompts.indexOf('git -C <worktree path> clean -fdx');
  expect(cleanAt, 'clean must come after the disposability gate').toBeGreaterThan(disposableStart);
});

test('automations: run directory, watchdog checks, and exclusions match rev 4', () => {
  const text = compact(refPath);
  for (const file of ['`cursor.json`', '`pending.json`', '`precheck.log`', '`decisions/<token>.json`', '`watchdog.log`', '`progress.md`']) {
    expect(text).toContain(file);
  }
  for (const check of ['driver stuck', 'precheck failing', 'worker stuck', 'decision waiting']) {
    expect(text).toMatch(new RegExp(check, 'i'));
  }
  expect(text).toMatch(/no gate for health findings/i);
  expect(text).toMatch(/no obligations table/i);
  expect(text).toMatch(/no `COMMENT` reviews/i);
  expect(text).toMatch(/no watch deadline/i);
  expect(text).toMatch(/no terminal hygiene/i);
  expect(text).toContain('(Orca run status alone is not evidence of completion)');
  expect(text).toMatch(/`dispatch_markers\[\]`[^;]*`pr`[^;]*`task_id`[^;]*`dispatch_id`[^;]*`worktree`[^;]*`head`[^;]*`started_at`[^;]*`reservation`[^;]*`trigger`/i);
  expect(text).toMatch(/`repair_caps\{url: \{expires_at\}\}`/i);
  expect(text).toMatch(/`processed_reviews\[\]`[^;]*`review_id`[^;]*`pr`[^;]*`head`[^;]*`digest`/i);
  expect(text).toMatch(/UTC[^.]*YYYY-MM-DDTHH:MM:SSZ/i);
  expect(text).toMatch(/unparsable timestamp[^.]*`error`[^.]*precheck[^.]*`unknown`[^.]*watchdog/i);
});

test('automations: driver and decision transitions retain literal rev-4 conditions', () => {
  const text = compact(refPath);
  expect(text).toMatch(/if `tick_started_at` is newer than `tick_done_at`[^.]*previous tick did not finish/i);
  expect(text).toMatch(/immediately before acting[^.]*re-read[^.]*`state == approved`/i);
  expect(text).toMatch(/candidate[^.]*survives worktree removal/i);
  expect(text).toMatch(/after `spent` or `stale`[^.]*delete[^.]*candidate ref/i);
});

test('automations: skills keep links and carry their rev-4 exceptions', () => {
  for (const [path, link] of [
    ['skills/axstack/SKILL.md', 'references/automations.md'],
    ['skills/axstack-watch/SKILL.md', '../axstack/references/automations.md'],
    ['skills/axstack-review/SKILL.md', '../axstack/references/automations.md'],
    ['skills/axstack-watch/references/watch-runtime.md', '../../axstack/references/automations.md'],
  ]) expect(read(path), `${path}: automations link`).toContain(`](${link})`);

  const relay = compact('skills/axstack-relay/SKILL.md');
  expect(relay).toMatch(/## Decision tokens/);
  expect(relay).toMatch(/agent[^.]*opens[^.]*token[^.]*sends/i);
  expect(relay).toMatch(/Hermes script[^.]*decides/i);
  expect(relay).toMatch(/driver[^.]*consumes/i);
  expect(relay).toMatch(/delivery is one-way[^.]*no session polls Telegram/i);

  const review = compact('skills/axstack-review/SKILL.md');
  expect(review).toContain('<!-- axstack-automation verdict head=<sha> -->');
  expect(review).toMatch(/immediately before `gh pr review`[^.]*re-read[^.]*self[^.]*reviews/i);
  expect(review).toMatch(/`escalate`[^.]*opens[^.]*decision token[^.]*exits/i);

  const repair = compact('skills/axstack-watch/references/repair-publication.md');
  expect(repair).toMatch(/`refs\/axstack\/decisions\/<token>`/);
  expect(repair).toMatch(/`escalate`[^.]*opens[^.]*decision token[^.]*instead of pushing/i);
});

test('automations: workflow documentation points to the rev-4 contract', () => {
  const docs = read('docs/workflows.md');
  const block = docs.slice(docs.indexOf('## Automations'), docs.indexOf('## Run record and evidence'));
  expect(block).toContain('docs/specs/pr-automations.md');
  expect(block).toContain('skills/axstack/references/automations.md');
  expect(block).toMatch(/driver[^.]*every 15 minutes/i);
  expect(block).toMatch(/hourly[^.]*watchdog/i);
  expect(block).toMatch(/decision token/i);
  expect(block).toMatch(/no `COMMENT` reviews/i);
});
