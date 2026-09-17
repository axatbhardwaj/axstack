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
  // it appears under that project rather than under axstack.
  const text = compact(refPath);
  expect(text).toMatch(/run from the (?:host's )?`root` folder workspace/i);
  expect(text).toMatch(/not a git repository/i);
  expect(text).toMatch(/~\/\.local\/share\/axstack\/runs\/<run id>\//);
  expect(text).not.toMatch(/under the Axstack git-common-dir/i);
  expect(text).toMatch(/parented to (?:that|the) project's primary worktree/i);
  expect(text).not.toMatch(/parented to the driver\s+worktree/i);
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
