import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

test('rev-3 decisions have immutable bindings and exactly one writer per transition', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/at least 96 random bits[^.]*lowercase hex/i);
  expect(text).toMatch(/immutable bound fields[^.]*`repo`[^.]*`pr`[^.]*`head`[^.]*`base`[^.]*`action`/i);
  const lifecycle = text.slice(text.indexOf('Lifecycle'), text.indexOf('Opening'));
  expect(lifecycle).toMatch(/\| create `open` \| the agent that escalated \|/i);
  expect(lifecycle).toMatch(/\| `open → approved` \/ `open → rejected` \| the Hermes script only \|/i);
  expect(lifecycle).toMatch(/\| `approved → spent` \/ `approved → stale` \| the driver only \|/i);
  expect(lifecycle).toMatch(/\| `rejected → closed` \| the driver only \|/i);
  expect(lifecycle).toMatch(/\| `spent` \+ `receipt` \| the driver only \|/i);
  expect(text).toMatch(/each by temp file \+ rename/i);
  expect(text).toMatch(/Tokens do not expire/i);
});

test('rev-3 decision consumption spends before the call and reconciles missing receipts', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/driver is the only consumer/i);
  expect(text).toMatch(/writes `spent`[^.]*before[^.]*GitHub call/i);
  expect(text).toMatch(/spent[^.]*without a receipt[^.]*reconciliation/i);
  expect(text).toMatch(/retries once under the same approval/i);
  expect(text).toMatch(/revalidation failure[^.]*`stale`[^.]*drops the PR's head/i);
  expect(text).toMatch(/driver never mints a token/i);
});

test('rev-3 watchdog is model-free and performs exactly four checks without a gate', () => {
  const text = compact('skills/axstack/references/automations.md');
  const watchdog = text.slice(text.indexOf('## Watchdog'), text.indexOf('## Run directory'));
  expect(watchdog).toMatch(/shell precheck only/i);
  expect(watchdog).toMatch(/always exits non-zero/i);
  expect(watchdog.match(/\| (driver stuck|precheck failing|worker stuck|decision waiting) \|/gi)).toHaveLength(4);
  expect(watchdog).toMatch(/`watchdog\.log`[^.]*`\{ts, checks, trips, sent\}`/i);
  expect(watchdog).toMatch(/healthy tick[^.]*sends nothing/i);
  expect(watchdog).toMatch(/no gate for health findings/i);
});

test('rev-3 run directory assigns files to their sole writers', () => {
  const text = compact('skills/axstack/references/automations.md');
  const state = text.slice(text.indexOf('## Run directory'), text.indexOf('## Safety holds'));
  expect(state).toMatch(/`cursor\.json`[^.]*driver only/i);
  expect(state).toMatch(/`pending\.json`, `precheck\.log`[^.]*driver precheck only/i);
  expect(state).toMatch(/`decisions\/<token>\.json`[^.]*lifecycle table/i);
  expect(state).toMatch(/`watchdog\.log`[^.]*watchdog only/i);
  expect(state).toMatch(/`progress\.md`[^.]*driver only/i);
  expect(state).toMatch(/Orca run history[^.]*authoritative log/i);
});

test('rev-3 cutover order prevents both pairs from running together', () => {
  const text = compact('skills/axstack/references/automations.md');
  const cutover = text.slice(text.indexOf('## Cutover'), text.indexOf('## Exclusions'));
  const ordered = [
    'new pair exists disabled',
    'skills and references are installed',
    'C and D are disabled',
    'attempt is reconciled',
    'old worktree is removed',
    'old run directory is made read-only',
    'new pair is enabled',
    'first real driver tick is recorded',
  ];
  let cursor = -1;
  for (const phrase of ordered) {
    const next = cutover.toLowerCase().indexOf(phrase.toLowerCase());
    expect(next, `missing cutover step: ${phrase}`).toBeGreaterThan(cursor);
    cursor = next;
  }
  expect(cutover).toMatch(/both pairs never run together/i);
  expect(cutover).toMatch(/Historical artefacts are untouched/i);
});

test('rev-3 removes superseded operational concepts across the scoped contract', () => {
  const texts = [
    'skills/axstack/references/automations.md',
    'skills/axstack-review/SKILL.md',
    'skills/axstack-watch/references/repair-publication.md',
    'docs/workflows.md',
  ].map(compact).join(' ');
  expect(texts).not.toMatch(/blocking-review obligation|outstanding obligation/i);
  expect(texts).not.toMatch(/Automation publication \(`COMMENT`\)/i);
  expect(texts).not.toMatch(/watch window[^.]*24 hours|shared default 24-hour deadline/i);
  expect(texts).not.toMatch(/## Terminal hygiene|terminal hygiene runs/i);
  expect(texts).not.toMatch(/automation health criterion/i);
  expect((compact('skills/axstack/references/automations.md').match(/Pair A\/B/gi) ?? [])).toHaveLength(1);
});

test('rev-3 Notification policy and relay discovery edges remain intact', () => {
  const review = compact('skills/axstack-review/SKILL.md');
  const relay = compact('skills/axstack-relay/SKILL.md');
  expect(review).toContain('`Notification policy`');
  expect(review).toContain('[axstack-relay](../axstack-relay/SKILL.md)');
  expect(relay).toContain('`Notification policy`');
  expect(relay).toContain('command -v hermes');
  expect(relay).toContain('hermes send --list telegram');
  expect(relay).toContain('hermes send --to <target> --file <path> --json');
});
