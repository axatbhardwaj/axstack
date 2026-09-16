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

test('automations: watch repairs are gated locally and pushed fast-forward only', () => {
  const watch = compact('skills/axstack-watch/SKILL.md');
  const repair = compact('skills/axstack-watch/references/repair-publication.md');
  expect(watch).toMatch(/per-PR child worktree/i);
  expect(watch).toMatch(/expiry[^.]*`expired`[^.]*never silently re-adopted|`expired`[^.]*never silently re-adopted/i);
  expect(repair).toMatch(/committed locally[^.]*child worktree/i);
  expect(repair).toMatch(/authored mode at its local SHA|reviewed in authored mode at (?:its|the) local SHA/i);
  expect(repair).toMatch(/gate[^.]*`proceed`[^.]*no unresolved (?:validated )?blocking finding/i);
  expect(repair).toMatch(/publication readback[^.]*immediately before the push|immediately before the push/i);
  expect(repair).toMatch(/fast-forward only/i);
  expect(repair).toMatch(/`git push`[^.]*never[^.]*lease[^.]*force|no lease or force/i);
  expect(repair).toMatch(/no `gh stack` sync or restack from an automation|`gh stack`[^.]*never[^.]*automation/i);
  expect(repair).toMatch(/push[^.]*before the gate[^.]*forbidden|never push[^.]*before[^.]*gate/i);
});

// Scenario corpus contract only: a fresh evaluator executes these cases against
// the skill prompts; keyword matching is not behavior evidence.
test('automation scenarios: five bounded cases pin the gate, criteria, expiry, and holds', () => {
  const data = JSON.parse(read('tests/workflows/automation-scenarios.json'));
  expect(data.version).toBe(1);
  expect(data.cases.map(({ id }) => id)).toEqual([
    'push-before-gate',
    'proceed-with-blocking-finding',
    'watchdog-health-finding',
    'expired-pr-skipped',
    'unavailable-gate-hold',
  ]);
  const skills = ['axstack', 'axstack-review', 'axstack-watch'];
  for (const c of data.cases) {
    expect(c.title && c.skill_ref && c.input && c.expected, `${c.id}: needs title/skill_ref/input/expected`).toBeTruthy();
    expect(skills.includes(c.skill_ref), `${c.id}: skill_ref must be an automation-facing skill`).toBeTruthy();
    expect(c.input.request && c.input.facts, `${c.id}: needs request and facts`).toBeTruthy();
    expect(c.expected.forbidden.length, `${c.id}: needs forbidden actions`).toBeGreaterThan(0);
  }
  const byId = Object.fromEntries(data.cases.map((c) => [c.id, c]));
  expect(byId['push-before-gate'].expected.forbidden.join(' ')).toMatch(/push[^,]*before[^,]*gate/i);
  expect(byId['proceed-with-blocking-finding'].expected.forbidden.join(' ')).toMatch(/proceed[^,]*override|push[^,]*blocking finding/i);
  expect(byId['watchdog-health-finding'].expected.criterion).toBe('automation health');
  expect(byId['expired-pr-skipped'].expected.forbidden.join(' ')).toMatch(/re-adopt/i);
  expect(byId['unavailable-gate-hold'].expected.hold).toBeTruthy();
});

test('automations: docs/workflows.md has an Automations section pointing at spec and reference', () => {
  const docs = read('docs/workflows.md');
  expect(docs).toMatch(/^## Automations$/m);
  const section = docs.slice(docs.indexOf('## Automations'), docs.indexOf('## Run record and evidence'));
  expect(section).toContain('docs/specs/orca-automations.md');
  expect(section).toContain('skills/axstack/references/automations.md');
  expect(section).toMatch(/driver[^.]*five minutes|every five minutes/i);
  expect(section).toMatch(/watchdog every hour|hourly[^.]*watchdog/i);
  expect(section).toMatch(/`escalate` or `proceed`/);
});
