import { test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');
const refPath = 'skills/axstack/references/automations.md';

test('automations: rev-3 driver and watchdog contract replaces the retired pairs', () => {
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
  expect(text).toMatch(/dispatch marker[^.]*task id[^.]*dispatch id[^.]*worktree[^.]*head[^.]*started_at[^.]*reservation/i);
  expect(text).toMatch(/marker older than 3 h/i);
  expect(text).toMatch(/live worker[^.]*`worker-stop`/i);
  expect(text).toMatch(/exited worker[^.]*`worker-abandon`/i);
  expect(text).toMatch(/one `verdict` dispatch per tick/i);
  expect(text).toMatch(/six `repair` markers live/i);
  expect(text).toMatch(/one repair per PR per 24 h/i);
  expect(text).toMatch(/failing check[^.]*base check[^.]*passing/i);
  expect(text).toMatch(/`CHANGES_REQUESTED` review[^.]*review id/i);
  expect(text).toMatch(/SHA-256 body digest[^.]*PR and head/i);
  expect(text).toMatch(/same finding[^.]*new review id[^.]*must not re-trigger/i);
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
});

test('automations: run directory, watchdog checks, and exclusions match rev 3', () => {
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
});

test('automations: skills keep links and carry their rev-3 exceptions', () => {
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

test('automations: workflow documentation points to the rev-3 contract', () => {
  const docs = read('docs/workflows.md');
  const block = docs.slice(docs.indexOf('## Automations'), docs.indexOf('## Run record and evidence'));
  expect(block).toContain('docs/specs/pr-automations.md');
  expect(block).toContain('skills/axstack/references/automations.md');
  expect(block).toMatch(/driver[^.]*every 15 minutes/i);
  expect(block).toMatch(/hourly[^.]*watchdog/i);
  expect(block).toMatch(/decision token/i);
  expect(block).toMatch(/no `COMMENT` reviews/i);
});
