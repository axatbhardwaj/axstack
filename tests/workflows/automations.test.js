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
  expect(text).toMatch(/orchestration recovery guide[^.]*state-specific next action/i);
  expect(text).toMatch(/review-triggered[^.]*marker's `trigger`[^.]*remove exactly[^.]*review id[^.]*digest[^.]*`processed_reviews\[\]`/i);
  // Parallel workers (user decision 2026-09-18): the only concurrency limit is
  // one host-wide cap on live dispatch markers; no per-tick verdict budget and
  // no separate repair pool. One repair per head and the stack rule stay.
  expect(text).toMatch(/at most (?:eight|8) live dispatch markers[^.]*(?:host-wide|across all repositories)/i);
  expect(text).not.toMatch(/one `verdict` dispatch per tick|six `repair` markers/i);
  // User decision 2026-09-18: no time-based repair cap at all. A repair
  // pushes a new head; if that head still is not merge-ready, discovery sees
  // a new failing check or review there and repairs again. The only dedupe
  // is one repair per head, so a repair that pushes nothing is not retried
  // at the same head until a human or a new commit moves it.
  expect(text).toMatch(/one repair per head/i);
  expect(text).toMatch(/`repaired_heads\[\]`/);
  expect(text).not.toMatch(/repair per PR per \d+ h|\d+ h (?:repair )?cap|no live repair cap/i);
  expect(text).toMatch(/failing check[^.]*base check-run[^.]*same `name`[^.]*same producing `app\.id`[^.]*passing/i);
  expect(text).toContain('gh api repos/<repo>/commits/<base>/check-runs');
  expect(text).toMatch(/legacy commit status[^.]*same `context`/i);
  expect(text).toMatch(/missing[^.]*pending[^.]*same-name different-app base check[^.]*holds/i);
  expect(text).toMatch(/`CHANGES_REQUESTED` review[^.]*review id/i);
  expect(text).toMatch(/SHA-256 body digest[^.]*PR and head/i);
  expect(text).toMatch(/same finding[^.]*new review id[^.]*must not re-trigger/i);
  expect(text).toMatch(/superseded head[^.]*new review[^.]*triggers again[^.]*new head/i);
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
  expect(text).toContain('review-<owner>-<repo>-PR-<num>.html');
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

  for (const [name, text] of [['reference', ref], ['spec', spec]]) {
    expect(text, `${name}: launch workspace`).toMatch(/(?:host's )?`root` folder workspace/i);
    expect(text, `${name}: run directory`).toMatch(/~\/\.local\/share\/axstack\/runs\/<run id>\//);
    expect(text, `${name}: no git-common-dir run directory`).not.toMatch(/git-common-dir[^.]*runs|runs[^.]*git-common-dir/i);
    expect(text, `${name}: no dedicated axstack worktree`).not.toMatch(/dedicated (?:Axstack |Orca )?(?:automations )?worktree/i);
  }
  expect(ref).toMatch(/not a git repository/i);
  expect(ref).toMatch(/parented to (?:that|the) project's primary worktree/i);
  expect(spec).toMatch(/project's primary worktree/i);
});

test('automations: settlement removes the per-dispatch worktree and leaves no terminal behind', () => {
  const ref = compact(refPath);
  const spec = compact('docs/specs/pr-automations.md');
  expect(ref).toMatch(/Settlement leaves nothing behind/i);
  expect(ref).toMatch(/preserve[^.]*private evidence[^.]*settle\/release through the guide/i);
  expect(ref).toMatch(/orchestration settlement[^.]*`orca-cli` worktree removal guidance/i);
  expect(ref).not.toMatch(/`orca (?:terminal close|worktree rm)/i);
  for (const [name, text] of [['spec', spec]]) {
    expect(text, `${name}: terminal tab`).toMatch(/closes? (?:any|its) terminal tab/i);
    // One worktree per dispatch: proven disposable -> removed; otherwise
    // retained in place. Never a reset of a shared slot.
    expect(text, `${name}: removed after proof`).toMatch(/prov(?:en|es)[^.]{0,40}disposable[\s\S]{0,900}`orca worktree rm/i);
    expect(text, `${name}: leftovers are findings`).toMatch(/outlives its dispatch[^.]*health finding/i);
    expect(text, `${name}: creates per dispatch`).toMatch(/one (?:Orca )?worktree per dispatch/i);
    expect(text, `${name}: no fixed pool`).not.toMatch(/fixed pool of|resets the slot to the pinned head|never creates or removes a worktree/i);
  }
});

test('automations: cleanup never destroys work it cannot prove is safe to lose', () => {
  // Review finding: unconditional `git clean -fdx` erases untracked files in
  // an abandoned repair, and unconditional `branch -D` can delete the only
  // ref to a committed but unpushed candidate. Destruction is gated on proof.
  const ref = compact(refPath);
  const spec = compact('docs/specs/pr-automations.md');
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
  expect(ref, 'tick step 2 defers to the gated cleanup').toMatch(/Apply the "Run directory" proof before removing a worktree/i);
  expect(ref, 'tick step 4 defers to the gated cleanup').toMatch(/confirmed abandon[^.]*run the same cleanup[^.]*retained, not removed/i);
  expect(ref).not.toMatch(/After confirmed abandon, remove the worktree/);
  expect(spec, 'spec step 2 defers to the gated cleanup').toMatch(/run the cleanup defined under "Run directory and state", which proves the worktree disposable/);
  expect(spec).not.toMatch(/After a confirmed abandon, remove the worktree/);
});

test('automations: the driver delegates session finish to native automation lifecycle', () => {
  // Rev 4 has no terminal hygiene sweep and each tick is a fresh session, so
  // without this every tick leaves one terminal in the root workspace: 24 had
  // accumulated in the old worktree by the time it was retired.
  const ref = compact(refPath);
  const spec = compact('docs/specs/pr-automations.md');
  expect(ref).toMatch(/tick_done_at[^.]*tick_outcome[^.]*native automation\/session lifecycle[^.]*exit/i);
  expect(ref).not.toMatch(/terminal close|close(?:s)? (?:its|your) own terminal tab/i);
  expect(spec).toMatch(/tick_done_at[^.]*tick_outcome[^.]*close(?:s)? its own terminal tab/i);
});

test('automations: a runtime-refusal hold is re-tested by attempting the operation, never by reading config', () => {
  // The depth hold was kept for hours by re-reading orca-data.json, a
  // persisted snapshot that lags the live setting. The only observation that
  // proves an Orca refusal is resolved is the operation no longer refusing.
  const ref = compact(refPath);
  const spec = compact('docs/specs/pr-automations.md');
  for (const [name, text] of [['spec', spec]]) {
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
  expect(ref).toMatch(/runtime refusal[^.]*re-attempting the refused operation/i);
  expect(ref).toMatch(/runtime's recovery guide[\s\S]{0,120}structured next action/i);
  expect(ref).not.toMatch(/nextAction[^.]*\{kind, argv\}|request-show/);
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
  // The spec's own due-work enumeration (the algorithm the precheck mirrors)
  // must list the record, not only the schema paragraph.
  const specDue = spec.match(/Due control work\*\*, read from `cursor\.json` and `decisions\/`:[\s\S]*?`open` decisions alone are not due/)?.[0] ?? '';
  expect(specDue, 'spec due-work enumeration missing').not.toBe('');
  expect(specDue).toMatch(/runtime_refusal/);
});

test('automations: every dispatch gets its own Orca worktree under one host-wide cap', () => {
  // User decision 2026-09-18: no fixed slot pool. Trust inherits from the
  // project's primary clone (a fresh child worktree launched with no "Quick
  // safety check" — canary 2026-09-18), so the driver creates one worktree
  // per dispatch, parented under the project, and removes it after settlement.
  const ref = compact(refPath);
  const spec = compact('docs/specs/pr-automations.md');
  for (const [name, text] of [['spec', spec]]) {
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
  expect(ref).toMatch(/runtime-owned placement guides[^.]*one Orca child worktree per dispatch[^.]*parented to the project's primary worktree/i);
  expect(ref).toMatch(/checked out detached at the exact head/i);
  expect(ref).toMatch(/prove Orca owns the worker resources/i);
  expect(ref).not.toMatch(/worker-start[^.]*--agent|worker-show[^.]*resource\.state|terminal close/);
  // The run directory no longer ships a trust helper.
  expect(ref).not.toMatch(/`trust\.js`/);
  // Retention is mechanical: a clean, terminal-less slot holding an unpushed
  // candidate must not satisfy the free predicate for ANY PR, so retained
  // slots are recorded in cursor.json and excluded from the pool until the
  // user reconciles them.
  for (const [name, text] of [['reference', ref], ['spec', spec]]) {
    expect(text, `${name}: retained worktrees stay in place`).toMatch(/retained_slots\[\][^.]*(?:stays|remains|kept) in place|retained in place/i);
    expect(text, `${name}: retention record`).toMatch(/retained_slots\[\][^.]*(?:`slot`|slot)[^.]*(?:`pr`|pr)[^.]*(?:`head`|head|SHA)[^.]*(?:`reason`|reason)/i);
    expect(text, `${name}: cleared only by the user`).toMatch(/retained_slots\[\][^.]*(?:cleared|removed) only by the user/i);
    // Both retention paths record the slot: a settled worker whose candidate
    // cannot be proven durable, and a dirty or unproven abandon.
    expect(text, `${name}: settled retention records the slot`).toMatch(/(?:settled|release)[^.]*(?:not|cannot be) proven (?:disposable|preserved)[\s\S]{0,400}retained_slots\[\]|(?:not|cannot be) proven (?:disposable|preserved)[\s\S]{0,400}retained_slots\[\]/i);
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
  expect(text).toMatch(/`repair_caps\{url: \{expires_at\}\}`[^.]*(?:legacy|never written)/i);
  // Legacy caps must be cleared once, or an expired one keeps every tick due.
  expect(text).toMatch(/repair_caps[^.]*(?:clears?|cleared|reset)[^.]*`\{\}`/i);
  expect(text).toMatch(/`repaired_heads\[\]` \(`pr`, `head`, `dispatched_at`\)/);
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
  expect(block).toContain('skills/axstack/references/automations.md');
  expect(block).toMatch(/driver[^.]*every 15 minutes/i);
  expect(block).toMatch(/hourly[^.]*watchdog/i);
  expect(block).toMatch(/decision token/i);
  expect(block).toMatch(/no `COMMENT` reviews/i);
});

test('automation prompt delegates to one contract and permits either driver agent', () => {
  const prompts = read('docs/plans/pr-automations-prompts.md');
  const driver = prompts.split('## Driver prompt (verbatim)')[1].split('## Review brief')[0];
  expect(driver.length).toBeLessThan(2200);
  expect(driver).toContain('<skills root>/axstack/references/automations.md');
  expect(driver).toContain('single operational contract');
  expect(driver).toContain('Run directory, and Safety holds');
  expect(driver).toContain('<axstack checkout>/docs/plans/pr-automations-prompts.md (absolute path');
  expect(driver).toContain('Use the agent selected in Orca');
  expect(driver).toContain('including a hold');
  expect(driver).not.toContain('expected Opus');
  const contract = compact(refPath);
  expect(contract).toContain('no review repository allowlist');
  expect(contract).toContain('Reviewer roles remain separately configured');
  expect(contract).not.toMatch(/Non-Opus or unknown driver identity/);
  expect(contract).toContain('Closed or merged PRs are skipped');
});
