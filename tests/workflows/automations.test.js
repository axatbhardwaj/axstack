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
  expect(text).toMatch(/Outside the allowlist[^.]*records only|discovers and records only/i);
  expect(text).not.toMatch(/report-only review/i);
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
  expect(text).toMatch(/Only `proceed` plus no unresolved validated blocking finding permits a push/);
});

test('automations: run record, sidecar, notification policy, dedup, expiry, and holds', () => {
  const text = compact(refPath);
  expect(text).toContain('`cursor.json`');
  expect(text).toContain('`pending.json`');
  expect(text).toContain('`precheck.log`');
  expect(text).toContain('`watchdog.json`');
  expect(text).toContain('`20260916-pr-automations`');
  expect(text).toContain('hermes send, target telegram (home), host VPS, gate-authorized escalations only');
  expect(text).toMatch(/\(PR, criterion, head SHA\)/);
  expect(text).toMatch(/health notifications dedup on the occurrence id/);
  expect(text).toMatch(/`expired`/);
  expect(text).toMatch(/never silently re-adopted|skips an expired PR/i);
  expect(text).toMatch(/silence never clears a hold/i);
  expect(text).toMatch(/unavailable gate[^.]*hold|gate[^.]*unavailable[^.]*hold/i);
  expect(text).toMatch(/`failed`[^.]*retried once|retried once[^.]*`failed`/i);
  expect(text).toMatch(/`uncertain`[^.]*never auto-resent/i);
  expect(text).toMatch(/docs\/specs\/orca-automations\.md/);
});

test('automations: terminal hygiene stays inside the driver and reclaims the tab', () => {
  const text = compact(refPath);
  expect(text).toMatch(/hygiene[^.]*driver terminals only|only[^.]*driver terminals/i);
  expect(text).toMatch(/`terminalPtyId`[^.]*never a terminal title/i);
  expect(text).toMatch(/never closes a watchdog terminal or any terminal outside this automation/i);
  expect(text).toContain('--tab');
  // Revision 4 strengthens this from two automations to all four.
  expect(text).toMatch(/must not share a dispatch minute|never share a dispatch minute|may share a dispatch minute/i);
  expect(text).toMatch(/A, B, C and D each\s+take a distinct minute/);
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

// Scenario corpus: each case pins one transition (input facts -> required
// outcome and forbidden actions). A fresh evaluator executes these against the
// skill prompts; the deterministic checks below bind each case to the rule it
// exercises. See docs/plans/orca-automations-evidence.md for the RED/GREEN
// receipts per case.
test('automation scenarios: bounded cases pin the gate, criteria, expiry, holds, admission, provenance, precedence, and record-only', () => {
  const data = JSON.parse(read('tests/workflows/automation-scenarios.json'));
  expect(data.version).toBe(2);
  expect(data.cases.map(({ id }) => id)).toEqual([
    'push-before-gate',
    'proceed-with-blocking-finding',
    'watchdog-health-finding',
    'expired-pr-skipped',
    'unavailable-gate-hold',
    'repair-review-admission',
    'adopted-own-pr-author',
    'serious-risk-precedence',
    'escalate-holds-publication',
    'external-pr-record-only',
    'due-deadline-wake',
  ]);
  const skills = ['axstack', 'axstack-review', 'axstack-watch'];
  for (const c of data.cases) {
    expect(c.title && c.skill_ref && c.input && c.expected, `${c.id}: needs title/skill_ref/input/expected`).toBeTruthy();
    expect(skills.includes(c.skill_ref), `${c.id}: skill_ref must be an automation-facing skill`).toBeTruthy();
    expect(c.input.request && c.input.facts, `${c.id}: needs request and facts`).toBeTruthy();
    expect(c.expected.forbidden.length, `${c.id}: needs forbidden actions`).toBeGreaterThan(0);
    expect(c.expected.actions.length, `${c.id}: needs required actions`).toBeGreaterThan(0);
  }
  const byId = Object.fromEntries(data.cases.map((c) => [c.id, c]));
  const forbidden = (id) => byId[id].expected.forbidden.join(' | ');
  const actions = (id) => byId[id].expected.actions.join(' | ');

  // Facts: gate not spawned, remote at pre-repair SHA -> push only after proceed; never before the gate.
  expect(byId['push-before-gate'].input.facts).toMatch(/gate has not yet been spawned/i);
  expect(byId['push-before-gate'].expected.push).toMatch(/Only after proceed with no unresolved validated blocking finding/i);
  expect(forbidden('push-before-gate')).toMatch(/Pushing SHA A before the gate returns/i);
  // Facts: proceed + one validated blocking finding -> no notification and no push.
  expect(byId['proceed-with-blocking-finding'].input.facts).toMatch(/validated blocking finding[^.]*gate token is proceed|gate token is proceed/i);
  expect(byId['proceed-with-blocking-finding'].expected.decision).toMatch(/No user notification[^.]*cannot proceed/i);
  expect(forbidden('proceed-with-blocking-finding')).toMatch(/proceed override the blocking finding/i);
  // Facts: three error lines + identity mismatch, gate escalates -> watchdog sends once and records in watchdog.json.
  expect(byId['watchdog-health-finding'].input.facts).toMatch(/three consecutive error lines/i);
  expect(byId['watchdog-health-finding'].expected.criterion).toBe('automation health');
  expect(actions('watchdog-health-finding')).toMatch(/occurrence id \(type, first-observed UTC timestamp\)/i);
  expect(actions('watchdog-health-finding')).toMatch(/On escalate, perform exactly one hermes send and record the receipt in watchdog\.json/i);
  expect(forbidden('watchdog-health-finding')).toMatch(/Mutating GitHub/i);
  // Facts: expired in record and cursor.json -> skipped; never re-adopted.
  expect(byId['expired-pr-skipped'].input.facts).toMatch(/cursor\.json list the PR as expired/i);
  expect(actions('expired-pr-skipped')).toMatch(/Skip the expired PR/i);
  expect(forbidden('expired-pr-skipped')).toMatch(/re-adopt/i);
  // Facts: gate model unavailable -> hold, publish nothing, no escalation through the gate itself.
  expect(byId['unavailable-gate-hold'].input.facts).toMatch(/cannot be launched/i);
  expect(byId['unavailable-gate-hold'].expected.hold).toMatch(/mutation for this PR pauses/i);
  expect(forbidden('unavailable-gate-hold')).toMatch(/Escalating the hold through the unavailable gate itself/i);
  // Facts: remote != local candidate -> reviewer admits the local SHA via git rev-parse; remote equality at readback.
  expect(byId['repair-review-admission'].input.facts).toMatch(/remote head is still the pre-repair SHA/i);
  expect(actions('repair-review-admission')).toMatch(/git rev-parse[^|]*child worktree/i);
  expect(actions('repair-review-admission')).toMatch(/Re-check remote equality at the publication readback/i);
  expect(forbidden('repair-review-admission')).toMatch(/Stopping the review because the remote ref does not equal the candidate/i);
  // Facts: adopted own PR with a historical author -> automation session or dispatched axstack-author authors; reviewer from that provenance.
  expect(byId['adopted-own-pr-author'].input.facts).toMatch(/authored[^.]*by a session this run did not launch|not launched by this run/i);
  expect(actions('adopted-own-pr-author')).toMatch(/automation session[^|]*or[^|]*axstack-author/i);
  expect(actions('adopted-own-pr-author')).toMatch(/reviewer from the recorded provenance of the repair/i);
  expect(forbidden('adopted-own-pr-author')).toMatch(/Routing the fix to the PR's historical author session/i);
  // Facts: reviewer finds credible serious risk before the gate -> immediate internal hold; external notification only via escalate.
  expect(byId['serious-risk-precedence'].input.facts).toMatch(/gate has not been spawned/i);
  expect(actions('serious-risk-precedence')).toMatch(/Raise the internal prompt and record the dependent-action hold immediately/i);
  expect(forbidden('serious-risk-precedence')).toMatch(/hermes send before the gate returns escalate/i);
  expect(forbidden('serious-risk-precedence')).toMatch(/Deferring the internal hold until the gate settles/i);
  // Facts: gate returns escalate -> hold recorded and notified; nothing published.
  expect(byId['escalate-holds-publication'].input.facts).toMatch(/gate returns escalate/i);
  expect(actions('escalate-holds-publication')).toMatch(/Record the hold[^|]*exactly one hermes send/i);
  expect(byId['escalate-holds-publication'].expected.publication).toMatch(/Nothing is pushed or published/i);
  expect(forbidden('escalate-holds-publication')).toMatch(/Pushing or publishing on escalate/i);
  // Facts: only an external PR changed -> recorded in pending.json; no model work, no wake, no escalation.
  expect(byId['external-pr-record-only'].input.facts).toMatch(/outside the mutation allowlist/i);
  expect(actions('external-pr-record-only')).toMatch(/Record the PR in pending\.json/i);
  expect(forbidden('external-pr-record-only')).toMatch(/Launching review, watch, or gate work for the external PR/i);
  expect(forbidden('external-pr-record-only')).toMatch(/Escalating on external PR contents/i);
  // Facts: GitHub unchanged, stored deadline due -> precheck exits 0 with `due`; driver expires and stops.
  expect(byId['due-deadline-wake'].input.facts).toMatch(/GitHub is unchanged[^.]*deadline[^.]*(?:past|before now)/i);
  expect(actions('due-deadline-wake')).toMatch(/exit 0[^|]*`?due`?/i);
  expect(actions('due-deadline-wake')).toMatch(/mark the PR expired[^|]*record the handoff/i);
  expect(forbidden('due-deadline-wake')).toMatch(/Skipping the tick because the fingerprint is unchanged/i);
});

test('automations: docs/workflows.md has an Automations section pointing at spec and reference', () => {
  const docs = read('docs/workflows.md');
  expect(docs).toMatch(/^## Automations$/m);
  const section = docs.slice(docs.indexOf('## Automations'), docs.indexOf('## Run record and evidence'));
  expect(section).toContain('docs/specs/orca-automations.md');
  expect(section).toContain('skills/axstack/references/automations.md');
  expect(section).toMatch(/driver[^.]*five minutes|every five minutes/i);
  expect(section).toMatch(/watchdog every hour|hourly[^.]*watchdog/i);
  expect(section).toMatch(/exactly one (?:literal )?token[^.]*`escalate` or `proceed`/i);
  // Outcomes are asserted separately: escalate never publishes; proceed alone is insufficient.
  expect(section).toMatch(/`escalate`[^.]*hold[^.]*publishes nothing/i);
  expect(section).toMatch(/only `proceed`[^.]*no unresolved validated blocking finding[^.]*(?:permits|allows) (?:publication|a push)/i);
  expect(section).not.toMatch(/publishes only after[^.]*`escalate` or `proceed`/i);
});
