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
  // Parallel workers (user decision 2026-09-18): the only concurrency limit is
  // one host-wide cap on live dispatch markers; no per-tick verdict budget and
  // no separate repair pool. The per-PR repair cap and the stack rule stay.
  expect(text).toMatch(/at most (?:eight|8) live dispatch markers[^.]*(?:host-wide|across all repositories)/i);
  expect(text).not.toMatch(/one `verdict` dispatch per tick|six `repair` markers/i);
  // User decision 2026-09-18: a PR may be repaired again after two hours,
  // not a day — a repair whose new head still fails should not park the
  // whole stack behind it until tomorrow.
  expect(text).toMatch(/one repair per PR per 2 h/i);
  expect(text).not.toMatch(/repair per PR per 24 h|24 h (?:repair )?cap/i);
  expect(text).toMatch(/failing check[^.]*base check-run[^.]*same `name`[^.]*same producing `app\.id`[^.]*passing/i);
  expect(text).toContain('gh api repos/<repo>/commits/<base>/check-runs');
  expect(text).toMatch(/legacy commit status[^.]*same `context`/i);
  expect(text).toMatch(/missing[^.]*pending[^.]*same-name different-app base check[^.]*holds/i);
  expect(text).toMatch(/`CHANGES_REQUESTED` review[^.]*review id/i);
  expect(text).toMatch(/SHA-256 body digest[^.]*PR and head/i);
  expect(text).toMatch(/same finding[^.]*new review id[^.]*must not re-trigger/i);
  expect(text).toMatch(/superseded head[^.]*new review[^.]*triggers again[^.]*2 h cap/i);
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

test('automations: settlement removes the per-dispatch worktree and leaves no terminal behind', () => {
  const ref = compact(refPath);
  const spec = compact('docs/specs/pr-automations.md');
  const prompts = compact('docs/plans/pr-automations-prompts.md');
  expect(ref).toMatch(/Settlement leaves nothing behind/i);
  for (const [name, text] of [['reference', ref], ['spec', spec]]) {
    expect(text, `${name}: terminal tab`).toMatch(/closes? (?:any|its) terminal tab/i);
    // One worktree per dispatch: proven disposable -> removed; otherwise
    // retained in place. Never a reset of a shared slot.
    expect(text, `${name}: removed after proof`).toMatch(/prov(?:en|es)[^.]{0,40}disposable[\s\S]{0,900}`orca worktree rm/i);
    expect(text, `${name}: leftovers are findings`).toMatch(/outlives its dispatch[^.]*health finding/i);
    expect(text, `${name}: creates per dispatch`).toMatch(/one (?:Orca )?worktree per dispatch/i);
    expect(text, `${name}: no fixed pool`).not.toMatch(/fixed pool of|resets the slot to the pinned head|never creates or removes a worktree/i);
  }
  expect(prompts).toMatch(/orca terminal close --terminal <handle> --tab/);
  expect(prompts).toMatch(/orca worktree rm --worktree id:<clone id>::<worktree path>/);
  expect(prompts).not.toMatch(/git -C <worktree path> reset --hard|clean -fdx/);
  expect(prompts).not.toMatch(/branch -D/);
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
    expect(text, `${name}: fetch lands in a per-dispatch ref`).toMatch(/per-dispatch\s+ref/i);
    expect(text, `${name}: FETCH_HEAD rejected`).toMatch(/never `FETCH_HEAD`/);
    expect(text, `${name}: abandon settlement defined`).toMatch(/accepted abandon receipt/i);
    expect(text, `${name}: token-held candidate is durable`).toMatch(/refs\/axstack\/decisions\/<token>/);
    expect(text, `${name}: abandon requires a clean tree`).toMatch(/abandon[^.]*no uncommitted changes/i);
    expect(text, `${name}: unsafe work is retained`).toMatch(/(?:is|are both) \*?\*?retained\*?\*?/i);
    expect(text, `${name}: retention is recorded`).toMatch(/health\[\][^.]*(?:path and SHA|path and \$hw)/i);
    expect(text, `${name}: blocks only that PR`).toMatch(/block(?:s|ing)? only that PR/i);
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
  expect(prompts).toMatch(/fetch origin \+refs\/heads\/<head branch>:refs\/axstack\/cleanup\/<dispatch id> succeeds AND git -C <clone path> merge-base --is-ancestor \$hw refs\/axstack\/cleanup\/<dispatch id>/);
  expect(prompts).toMatch(/a failed fetch is not proof: retain/);
  expect(prompts).toMatch(/update-ref -d refs\/axstack\/cleanup\/<dispatch id>/);
  expect(prompts).not.toMatch(/--is-ancestor \$hw origin\/<head branch>/);
  // FETCH_HEAD is shared clone state; a concurrent fetch can replace it
  // between the fetch and the ancestry test.
  expect(prompts).not.toMatch(/--is-ancestor \$hw FETCH_HEAD/);
  // Abandon never yields a release receipt; its settlement is the accepted
  // abandon receipt plus proven exit.
  expect(prompts).toMatch(/there is no release receipt on this path, so do not wait for one/);
  expect(prompts).toMatch(/for-each-ref refs\/axstack\/decisions --points-at \$hw/);
  expect(prompts).toMatch(/If disposable, remove it completely/);
  expect(prompts).toMatch(/If not disposable[^.]*retain it in place[^.]*delete nothing/);
  expect(prompts).toMatch(/status --porcelain must be empty/);
  // The settlement-path `orca worktree rm` may appear only inside the
  // disposable branch (the no-worker branch in step 5 has its own, gated on
  // HEAD == head and a clean tree).
  const disposableStart = prompts.indexOf('If disposable, remove it completely');
  const rmAt = prompts.indexOf('orca worktree rm --worktree id:<clone id>::<worktree path>');
  expect(rmAt, 'rm must come after the disposability gate').toBeGreaterThan(disposableStart);
  expect(prompts.slice(0, disposableStart)).not.toMatch(/orca worktree rm/);
});

test('automations: the driver closes its own terminal tab as the last step of a tick', () => {
  // Rev 4 has no terminal hygiene sweep and each tick is a fresh session, so
  // without this every tick leaves one terminal in the root workspace: 24 had
  // accumulated in the old worktree by the time it was retired.
  const ref = compact(refPath);
  const spec = compact('docs/specs/pr-automations.md');
  const prompts = compact('docs/plans/pr-automations-prompts.md');
  expect(ref).toMatch(/tick_done_at[^.]*tick_outcome[^.]*then close(?:s)? (?:its|your) own terminal tab/i);
  expect(spec).toMatch(/tick_done_at[^.]*tick_outcome[^.]*close(?:s)? its own terminal tab/i);
  expect(prompts).toMatch(/orca terminal close --terminal \$ORCA_TERMINAL_HANDLE --tab/);
  // It must be the final action: nothing runs after the tab is gone.
  const closeAt = prompts.indexOf('orca terminal close --terminal $ORCA_TERMINAL_HANDLE --tab');
  const doneAt = prompts.indexOf('write tick_done_at and tick_outcome ok');
  expect(doneAt, 'tick_done_at must be written before the tab closes').toBeGreaterThan(-1);
  expect(closeAt).toBeGreaterThan(doneAt);
});

test('automations: a runtime-refusal hold is re-tested by attempting the operation, never by reading config', () => {
  // The depth hold was kept for hours by re-reading orca-data.json, a
  // persisted snapshot that lags the live setting. The only observation that
  // proves an Orca refusal is resolved is the operation no longer refusing.
  const ref = compact(refPath);
  const spec = compact('docs/specs/pr-automations.md');
  const prompts = compact('docs/plans/pr-automations-prompts.md');
  for (const [name, text] of [['reference', ref], ['spec', spec]]) {
    expect(text, `${name}: re-attempt is the observation`).toMatch(/runtime refusal[^.]*re-attempt(?:ing|s)? the refused operation/i);
    expect(text, `${name}: once per tick`).toMatch(/once per tick/i);
    // [\s\S]{0,80} rather than [^.]*: the file name in the clause has a dot.
    expect(text, `${name}: config is not evidence`).toMatch(/persisted configuration[\s\S]{0,80}?is never evidence/i);
    expect(text, `${name}: names the file`).toMatch(/orca-data\.json/);
    // Same-refusal identity is Orca's structured code, never prose.
    expect(text, `${name}: keyed on the structured code`).toMatch(/nested_worker_depth_exceeded/);
    expect(text, `${name}: persisted in cursor`).toMatch(/runtime_refusal \{code, first_seen, last_seen\}/);
    expect(text, `${name}: different code is new`).toMatch(/different code is a new finding/i);
    expect(text, `${name}: prose is never the key`).toMatch(/prose is never the key/i);
    // A refused start after worktree creation must not leak that worktree —
    // and there is no worker, so the settlement proof cannot be what gates
    // it. An explicit no-worker branch does.
    expect(text, `${name}: refused start has no worker`).toMatch(/worker-start[\s\S]{0,120}refused after[\s\S]{0,120}no worker/i);
    expect(text, `${name}: no-worker branch checks residualResources`).toMatch(/residualResources/);
    expect(text, `${name}: no-worker branch requires pinned head`).toMatch(/HEAD (?:must equal|equals) the pinned head/i);
    expect(text, `${name}: no-worker branch requires a clean tree`).toMatch(/status --porcelain[^.]*empty|tree is clean/i);
    expect(text, `${name}: otherwise retained`).toMatch(/(?:otherwise|anything else|anything unproven) (?:it is |is )?retain/i);
    // A failed start that owns runtime state is recovered through the
    // runtime's own guide, not merely parked.
    expect(text, `${name}: reads failedStage`).toMatch(/failedStage/);
    expect(text, `${name}: retaining alone is not recovery`).toMatch(/retaining alone is not recovery/i);
    // nextAction is a structured {kind, argv}; only a non-empty argv is run,
    // verbatim, and `none` authorizes nothing. A receipt with resources but
    // no Dispatch has no row and is recovered through request-show.
    expect(text, `${name}: nextAction is structured`).toMatch(/nextAction[\s\S]{0,20}\{kind, argv\}/);
    expect(text, `${name}: argv run verbatim`).toMatch(/non-empty `argv`[\s\S]{0,60}verbatim/);
    expect(text, `${name}: none means retain`).toMatch(/`?kind: none`?[\s\S]{0,80}(?:inspect|retention|retain)/);
    expect(text, `${name}: no-dispatch recovery`).toMatch(/no Dispatch[\s\S]{0,120}request-show/);
    expect(text, `${name}: never retries in the same tick`).toMatch(/never retr(?:y|ies) in the same tick/i);
    // The retry needs a launched tick, so the record must be due work and a
    // real cursor key — the precheck and watchdog read an exact schema.
    expect(text, `${name}: runtime_refusal is a cursor key`).toMatch(/runtime_refusal\{code, first_seen, last_seen\}/);
    expect(text, `${name}: runtime_refusal is due work`).toMatch(/runtime_refusal[\s\S]{0,160}(?:due control work|due, because|is due|re-test needs a launched tick)/i);
  }
  // The precheck itself must implement the due rule, or the retry never runs.
  const precheck = read('docs/plans/pr-automations-precheck.sh');
  // Plain `!= null`, not `// null`: jq's alternative operator treats false as
  // absent, and a literal false must be rejected by validation, not made due.
  expect(precheck).toMatch(/jq -e '\.runtime_refusal != null' >\/dev\/null; then due=1; fi/);
  expect(precheck).not.toMatch(/runtime_refusal \/\/ null/);
  // The record's timestamps are validated against the exact grammar.
  expect(precheck).toMatch(/def exact_timestamp:/);
  expect(precheck).toMatch(/\.first_seen \| exact_timestamp/);
  expect(precheck).toMatch(/\.last_seen \| exact_timestamp/);
  expect(prompts).toMatch(/re-attempt the refused operation once/);
  expect(prompts).toMatch(/never read orca-data\.json/);
  expect(prompts).toMatch(/structured error code in the JSON response/);
  expect(prompts).toMatch(/nested_worker_depth_exceeded/);
  expect(prompts).toMatch(/never key on the message text/);
  expect(prompts).toMatch(/if worker-start itself is refused after the worktree was created there is no worker, so do NOT use the step \(2\) settlement proof/);
  expect(prompts).toMatch(/read the receipt's failedStage and residualResources first/);
  expect(prompts).toMatch(/no dispatchId and an empty or absent residualResources/);
  expect(prompts).toMatch(/projection\.nextAction is an object \{kind, argv\}/);
  expect(prompts).toMatch(/when argv is non-empty run exactly that argv through the same orca executable, verbatim, and nothing else/);
  expect(prompts).toMatch(/when kind is none, inspect with worker-show and retain/);
  expect(prompts).toMatch(/residualResources but no dispatchId[^;]*request-show --request <error\.data\.orchestrationRequestId>/);
  expect(prompts).not.toMatch(/execute its literal projection\.nextAction/);
  expect(prompts).toMatch(/never --retry-of in the same tick/);
  // The spec's own due-work enumeration (the algorithm the precheck mirrors)
  // must list the record, not only the schema paragraph.
  const specDue = spec.match(/Due control work\*\*, read from `cursor\.json` and `decisions\/`:[\s\S]*?`open` decisions alone are not due/)?.[0] ?? '';
  expect(specDue, 'spec due-work enumeration missing').not.toBe('');
  expect(specDue).toMatch(/runtime_refusal/);
  expect(prompts).toMatch(/rev-parse HEAD must equal <head sha> and git -C <worktree path> status --porcelain must be empty/);
});

test('automations: every dispatch gets its own Orca worktree under one host-wide cap', () => {
  // User decision 2026-09-18: no fixed slot pool. Trust inherits from the
  // project's primary clone (a fresh child worktree launched with no "Quick
  // safety check" — canary 2026-09-18), so the driver creates one worktree
  // per dispatch, parented under the project, and removes it after settlement.
  const ref = compact(refPath);
  const spec = compact('docs/specs/pr-automations.md');
  const prompts = compact('docs/plans/pr-automations-prompts.md');
  for (const [name, text] of [['reference', ref], ['spec', spec], ['prompts', prompts]]) {
    expect(text, `${name}: never answers the dialog`).toMatch(/never answers? (?:that|the) dialog/i);
    expect(text, `${name}: trust comes from the clone`).toMatch(/trust[^.]*(?:inherit|primary (?:worktree|clone))/i);
    expect(text, `${name}: one worktree per dispatch`).toMatch(/one (?:Orca )?worktree per dispatch/i);
    expect(text, `${name}: no fixed pool`).not.toMatch(/fixed pool of|slot-1|slot-5|free slot|two slot|five slot/i);
    expect(text, `${name}: host-wide cap`).toMatch(/at most (?:eight|8) live dispatch markers/i);
    expect(text, `${name}: cap defers`).toMatch(/(?:cap|8 live)[^.]*deferred/i);
    expect(text, `${name}: detached checkout at the head`).toMatch(/checkout --detach <head sha>|checked out detached at the (?:pinned|exact) head/i);
    expect(text, `${name}: owned launch`).toMatch(/worker-start[^.]*--agent claude/);
    expect(text, `${name}: no driver-created terminal`).not.toMatch(/worker-start --terminal|terminal create --worktree/);
    expect(text, `${name}: no safe mode`).not.toMatch(/--safe-mode|safe mode/i);
    expect(text, `${name}: ownership asserted via worker-show`).toMatch(/worker-show[\s\S]{0,200}resource\.state[^.]*owned/);
    expect(text, `${name}: unowned launch retains the worktree`).toMatch(/worker not owned[\s\S]{0,400}retained_slots\[\]/);
    expect(text, `${name}: no helper`).not.toMatch(/trust\.js|trust helper|hasTrustDialogAccepted/);
  }
  // One shared recipe creates the worktree, closes its creation terminal and
  // pins the head; both launch paths invoke it, then start the owned worker
  // and assert ownership; marker text is fenced to the owned branch.
  const CREATE = 'orca worktree create --repo id:<clone id> --name <repo short>-<num>-<head7> --base-branch <default branch> --parent-worktree id:<clone id>::<clone path> --setup skip --json';
  expect(prompts).toContain(CREATE);
  expect(prompts).toMatch(/orca terminal close --worktree id:<clone id>::<worktree path> --all/);
  expect(prompts).toMatch(/git -C <worktree path> checkout --detach <head sha>/);
  expect(prompts).toMatch(/rev-parse HEAD == <head sha>/);
  expect((prompts.match(/create the dispatch worktree as above/g) ?? []).length, 'both paths use the recipe').toBe(2);
  const LAUNCH = '--agent claude --model claude-opus-5 --effort medium';
  expect((prompts.match(new RegExp(`worker-start [^;]*${LAUNCH}`, 'g')) ?? []).length, 'both launch paths use the owned agent launch').toBe(2);
  expect((prompts.match(/run orca orchestration worker-show --dispatch <dispatch id> --json and read \.result\.projection\.resource\.state from its output: require resource\.state == owned/g) ?? []).length, 'both launch paths assert ownership').toBe(2);
  expect(prompts).not.toMatch(/--json \.result\.projection/);
  expect((prompts.match(/apply the \(5\) recovery rules for a start that owns runtime state/g) ?? []).length, 'both unowned branches use the (5) recovery').toBe(2);
  expect((prompts.match(/if worker-start reports a failed stage or a visible hold[^;]*/g) ?? []).length).toBe(2);
  for (const marker of ['--task-title "repair <repo>#<num> @<head>"', '--task-title "review <repo>#<num> @<head>"']) {
    const at = prompts.indexOf(marker);
    const before = prompts.slice(0, at);
    const createAt = before.lastIndexOf('orca worktree create');
    const closeAt = before.lastIndexOf('orca terminal close --worktree');
    const checkoutAt = before.lastIndexOf('checkout --detach <head sha>');
    expect(createAt, `${marker}: worktree created before start`).toBeGreaterThan(-1);
    expect(closeAt, `${marker}: creation terminal closed after create`).toBeGreaterThan(createAt);
    expect(checkoutAt, `${marker}: head pinned after close`).toBeGreaterThan(closeAt);
    const ownedAt = prompts.indexOf('resource.state == owned', at);
    expect(ownedAt, `${marker}: ownership asserted after start`).toBeGreaterThan(at);
    const noMarkerAt = prompts.indexOf('record no marker', ownedAt);
    const fenceAt = prompts.indexOf('the rest of this step runs only on the owned branch', noMarkerAt);
    const markerAt = prompts.indexOf('marker', fenceAt);
    expect(noMarkerAt, `${marker}: unowned branch records no marker`).toBeGreaterThan(ownedAt);
    expect(fenceAt, `${marker}: owned-branch fence after the unowned branch`).toBeGreaterThan(noMarkerAt);
    expect(markerAt, `${marker}: marker recorded only after the fence`).toBeGreaterThan(fenceAt);
  }
  // Setup: only the four project clones are trusted; no slot pool is created.
  expect(prompts).not.toMatch(/--name slot-/);
  expect(prompts).toMatch(/orca worktree rm --worktree id:<clone id>::<worktree path>/);
  // The run directory no longer ships a trust helper.
  expect(ref).not.toMatch(/`trust\.js`/);
  // Retention is mechanical: a clean, terminal-less slot holding an unpushed
  // candidate must not satisfy the free predicate for ANY PR, so retained
  // slots are recorded in cursor.json and excluded from the pool until the
  // user reconciles them.
  for (const [name, text] of [['reference', ref], ['spec', spec], ['prompts', prompts]]) {
    expect(text, `${name}: retained worktrees stay in place`).toMatch(/retained_slots\[\][^.]*(?:stays|remains|kept) in place|retained in place/i);
    expect(text, `${name}: retention record`).toMatch(/retained_slots\[\][^.]*(?:`slot`|slot)[^.]*(?:`pr`|pr)[^.]*(?:`head`|head|SHA)[^.]*(?:`reason`|reason)/i);
    expect(text, `${name}: cleared only by the user`).toMatch(/retained_slots\[\][^.]*(?:cleared|removed) only by the user/i);
    // Both retention paths record the slot: a settled worker whose candidate
    // cannot be proven durable, and a dirty or unproven abandon.
    expect(text, `${name}: settled retention records the slot`).toMatch(/(?:settled|release)[^.]*(?:not|cannot be) proven disposable[\s\S]{0,400}retained_slots\[\]|(?:not|cannot be) proven disposable[\s\S]{0,400}retained_slots\[\]/i);
    expect(text, `${name}: abandon retention records the slot`).toMatch(/abandon[\s\S]{0,400}retained_slots\[\]/i);
    // Removal exists now, but only behind the disposability proof; a retained
    // worktree is never removed by the driver.
    expect(text, `${name}: retained is never removed`).toMatch(/retained[^.]*(?:not removed|never removed|in place)/i);
  }
  expect(ref).toMatch(/`retained_slots\[\]`[^;]*`slot`[^;]*`pr`[^;]*`head`[^;]*`reason`/);
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
