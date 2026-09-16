import { test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');
const refPath = 'skills/axstack/references/automations.md';

// Structural checks on the shipped automation contract. They prove the
// instruction surface exists and names the spec's tokens, not agent behavior.
test('automations: shared reference exists and restates the operational contract', () => {
  expect(existsSync(`${root}/${refPath}`), `missing ${refPath}`).toBe(true);
  const text = compact(refPath);
  expect(text).toMatch(/gh api user --jq \.login/);
  expect(text).toMatch(/own PR[^.]*authored by self/i);
  expect(text).toMatch(/peer PR[^.]*review-requested|peer PR[^.]*@-mentions/i);
  expect(text).toMatch(/unsolicited reviews never happen/i);
  expect(text).toMatch(/mutation allowlist/i);
  expect(text).toMatch(/force-push[^.]*rebase[^.]*merge[^.]*close[^.]*APPROVE[^.]*REQUEST_CHANGES/);
  expect(text).toMatch(/report-only review[^.]*no push[^.]*no publication|no push and no publication/i);
});

test('automations: reviewer brief field, four criteria, and gate tokens are exact', () => {
  const text = compact(refPath);
  expect(text).toContain('Escalate to user: yes | no — <criterion> — <reason>');
  expect(text).toMatch(/security concern/i);
  expect(text).toMatch(/permanent on-chain state change/i);
  expect(text).toMatch(/architectural change in approach/i);
  expect(text).toMatch(/automation health/i);
  expect(text).toMatch(/automation health[^.]*only[^.]*watchdog[^.]*safety-hold|watchdog[^.]*safety-hold[^.]*never by a reviewer/i);
  expect(text).toContain('`axstack-auditor`');
  expect(text).toMatch(/exactly one literal token[^.]*`escalate` or `proceed`/i);
  expect(text).toMatch(/`proceed`[^.]*never overrides[^.]*validated blocking finding/i);
  expect(text).toMatch(/push[^.]*only after[^.]*`proceed`|after `proceed`[^.]*push/i);
});

test('automations: run record, sidecar, notification policy, dedup, expiry, and holds', () => {
  const text = compact(refPath);
  expect(text).toContain('`cursor.json`');
  expect(text).toContain('`precheck.log`');
  expect(text).toContain('`20260916-pr-automations`');
  expect(text).toContain('hermes send, target telegram (home), host VPS, gate-authorized escalations only');
  expect(text).toMatch(/\(PR, criterion, head SHA\)/);
  expect(text).toMatch(/\(finding type, first-observed run id\)/);
  expect(text).toMatch(/`expired`/);
  expect(text).toMatch(/never silently re-adopted|skips an expired PR/i);
  expect(text).toMatch(/silence never clears a hold/i);
  expect(text).toMatch(/unavailable gate[^.]*hold|gate[^.]*unavailable[^.]*hold/i);
  expect(text).toMatch(/`failed`[^.]*retried once|retried once[^.]*`failed`/i);
  expect(text).toMatch(/`uncertain`[^.]*never auto-resent/i);
  expect(text).toMatch(/docs\/specs\/orca-automations\.md/);
});

test('automations: entry, watch, and review skills link the reference', () => {
  for (const [path, link] of [
    ['skills/axstack/SKILL.md', 'references/automations.md'],
    ['skills/axstack-watch/SKILL.md', '../axstack/references/automations.md'],
    ['skills/axstack-review/SKILL.md', '../axstack/references/automations.md'],
    ['skills/axstack-watch/references/watch-runtime.md', '../../axstack/references/automations.md'],
  ]) {
    expect(read(path), `${path}: automations link`).toContain(`](${link})`);
  }
});
