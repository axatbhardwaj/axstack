import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { requires, sentences } from './prose-contract.js';
const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();

const hygiene = () => read('skills/axstack/references/workspace-hygiene.md');
const scenarios = JSON.parse(read('tests/workflows/workspace-hygiene-scenarios.json')).cases;
test('hygiene scenarios retain twenty distinct safety boundaries', () => {
  expect(scenarios).toHaveLength(20);
  expect(new Set(scenarios.map(({ id }) => id)).size).toBe(20);
});
// Exact safety pins: deliberate wording changes require a test edit.
for (const { id, input, expected, contract } of scenarios) {
  test(`hygiene safety: ${id} exact text`, () => {
    expect(input.length).toBeGreaterThan(20);
    expect(expected.length).toBeGreaterThan(5);
    const text = normalize(hygiene());
    expect(text).toContain(contract);
    expect(text.split(contract).length).toBe(2);
  });
}
const pins = [
  'Dispatched workers never sweep or remove another session.',
  'Never remove the durable review-manager schedule, its lane resources, or a user-created schedule through ordinary run settlement.',
  'Never archive active or waiting workers, or sweep solely because they are idle.',
  'Idle alone never proves exit.',
  'Age never grants deletion authority.',
  'At final settlement, no eligible non-driver thread or worktree remains.',
];
for (const pin of pins) test(`hygiene exact text: ${pin}`, () => {
  const text = normalize(hygiene());
  expect(text).toContain(pin);
  expect(text.split(pin).length).toBe(2);
});
const rules = [
  ['quiet sweep', [/cross-run sweep/i, /quiet/i, /60 minutes/i, /exact thread/i], 'Cross-run sweep eligibility requires the exact thread to be quiet for at least 60 minutes.'],
  ['fresh sweep state', [/cross-run sweep/i, /fresh native state/i, /ownership/i, /liveness/i, /durable evidence/i], 'Fresh native state with durable evidence of ownership and liveness is required for cross-run sweep eligibility.'],
  ['inactive sweep agents', [/cross-run sweep/i, /every agent/i, /inactive/i], 'Every agent must be inactive for cross-run sweep eligibility.'],
  ['settled reviewer eligibility', [/settled reviewer/i, /eligibility/i, /independent/i, /owning run/i, /live/i], 'Eligibility of a settled reviewer is independent of a live owning run.'],
  ['adviser phase retention', [/Align\/Spec/i, /adviser/i, /remain/i, /phase/i, /approves/i, /stops/i], 'Align/Spec advisers remain until the phase that owns them approves or stops.'],
  ['incomplete inventory hold', [/incomplete inventory/i, /holds/i, /eligibility/i], 'Affected eligibility holds on incomplete inventory.'],
  ['schedule ownership', [/owning run/i, /created/i, /each exact/i, /watch/i, /retirement/i], 'The owning run must have created each exact watch chosen for retirement.'],
  ['schedule absence', [/delete_scheduled_task/i, /exact ID/i, /verify absence/i, /list_scheduled_tasks/i], 'Use exact ID with delete_scheduled_task and list_scheduled_tasks to verify absence.'],
  ['schedule uncertainty', [/uncertain result/i, /holds/i, /retains/i, /recorded ID/i], 'An uncertain result retains the recorded ID and holds retirement.'],
  ['schedule closed-run guard', [/cross-run/i, /watch/i, /run is closed/i, /every watched PR/i, /merged or closed/i], 'Cross-run watch retirement requires that its run is closed or every watched PR is merged or closed.'],
  ['separate operation receipts', [/settlement/i, /evidence preservation/i, /thread archival/i, /worktree removal/i, /branch retirement/i, /separate receipts/i], 'Separate receipts document settlement, evidence preservation, thread archival, worktree removal and branch retirement.'],
  ['other-repository settlement holds', [/final settlement/i, /other repositories/i, /run-owned worktrees/i, /report/i, /hold/i, /reason/i], 'At final settlement report run-owned worktrees in other repositories as a hold with its reason.'],
  ['ignored file staging', [/stage/i, /each classified ignored file/i, /separately/i, /git add -f/i, /exact path/i, /salvage ref/i, /before/i, /commit/i], 'Before the commit stage each classified ignored file separately on the salvage ref using git add -f -- <exact path>.'],
  ['bundle content verification', [/verify/i, /bundle/i, /every classified file/i, /bytes/i, /salvage commit/i, /beyond/i, /structural verification/i], 'Beyond structural verification, verify the bundle contains every classified file bytes and salvage commit.'],
  ['decision readback record', [/record each decision/i, /native readback/i, /private run record/i], 'In the private run record, record each decision together with its native readback.'],
  ['settlement proof', [/terminal/i, /run evidence/i, /before/i, /t3_thread_organize/i], 'Require terminal run evidence before t3_thread_organize archive.'],
  ['sweep records', [/record/i, /removed/i, /held/i, /run record/i], 'Record held and removed resources in the private run record.'],
  ['unreachable inventory', [/unreachable/i, /report/i, /continue/i, /phase/i], 'Report an unreachable T3 host and continue the phase.'],
];
for (const [name, concepts, holdout] of rules) {
  test(`hygiene rule: ${name}`, () => {
    expect(requires(hygiene(), ...concepts)).toBe(true);
    const clauses = sentences(hygiene());
    const matching = clauses.filter((clause) => requires(clause, ...concepts));
    expect(requires(clauses.filter((clause) => !matching.includes(clause)).join('. '), ...concepts)).toBe(false);
    expect(requires(clauses.map((clause) => matching.includes(clause) ? `Do not ${clause}` : clause).join('. '), ...concepts)).toBe(false);
    expect(requires(holdout, ...concepts)).toBe(true);
    expect(requires(`Do not ${holdout}`, ...concepts)).toBe(false);
  });
}
// These phase/link assertions belong to T5a; retain them until that text changes.
test('existing phase entry points load hygiene and private evidence', () => {
  for (const path of ['lifecycle.md', 'routing.md', 't3-runtime.md', 'run-record.md']) {
    expect(read(`skills/axstack/references/${path}`)).toContain('workspace-hygiene.md');
  }
  const phases = ['align', 'audit', 'debug', 'explain', 'implement', 'improve', 'research', 'review', 'spec', 'tickets', 'watch'];
  for (const phase of phases) {
    const text = read(`skills/axstack-${phase}/SKILL.md`);
    expect(requires(text, /driver entry/i, /sweep/i, /Workspace hygiene/i), phase).toBe(true);
    expect(text, phase).toMatch(/dispatch brief[^.]*<run dir>\/evidence\/<dispatch>\//i);
  }
  expect(read('skills/axstack/references/run-record.md')).toMatch(/Worktrees in other repositories: <per-run repository and worktree IDs or none>/);
});

test('owned watch removal is part of close-out and watch stop', () => {
  const watch = read('skills/axstack-watch/references/watch-runtime.md');
  const skill = read('skills/axstack-watch/SKILL.md');
  const chat = watch.split('## Chat-run watch')[1];
  expect(normalize(chat)).toContain('Delete only the recorded watch with `delete_scheduled_task` and read back its absence with `list_scheduled_tasks`.');
  expect(chat).toMatch(/driver separately settles workers[^.]*preserves evidence[^.]*archives the run/i);
  expect(skill).toMatch(/Delete only the recorded schedule[^.]*verify absence[^.]*list_scheduled_tasks/i);
});

test('standalone watch owner removes its own stopped automation', () => {
  const standalone = read('skills/axstack-watch/references/watch-runtime.md').split('## Standalone watch')[1]?.split('## Chat-run watch')[0] ?? '';
  expect(standalone).toMatch(/owner deletes only[^.]*recorded T3 schedule[^.]*delete_scheduled_task[^.]*verifies absence[^.]*list_scheduled_tasks[^.]*uncertain deletion holds/i);
});

test('manager and watch sweep boundaries follow T3 hygiene', () => {
  const manager = read('skills/axstack/references/automations.md');
  const watch = read('skills/axstack-watch/references/watch-runtime.md');
  expect(read('skills/axstack-cleanup/SKILL.md')).toMatch(/Driver-start orphan sweeps follow the guarded cross-run sweep in\s*\[Workspace hygiene\]/i);
  for (const text of [manager, watch]) {
    expect(text).toContain('workspace-hygiene.md');
    expect(normalize(text)).toContain("The orphan sweep covers the run record's repositories plus registered repositories on this host.");
  }
  expect(normalize(manager)).toMatch(/Once identified as a duplicate[^.]*no further shared-record write[^.]*no live or unsettled resource owned by the live manager/i);
});

test('retained entry points preserve routing and safe-deletion links', () => {
  expect(read('skills/axstack-cleanup/SKILL.md')).toContain('workspace-hygiene.md');
  expect(read('skills/axstack/references/routing.md')).toContain('Choose a route; load only the phase and references needed next.');
  expect(read('skills/axstack/references/t3-runtime.md')).toContain('workspace-hygiene.md');
  for (const phase of ['align', 'audit', 'debug', 'explain', 'implement', 'improve', 'research', 'review', 'spec', 'tickets', 'watch']) {
    expect(read(`skills/axstack-${phase}/SKILL.md`)).toMatch(/driver entry[^;]*workspace-hygiene\.md/i);
  }
  for (const path of ['skills/axstack/references/t3-runtime.md', 'skills/axstack-implement/SKILL.md', 'skills/axstack-review/SKILL.md', 'skills/axstack/references/automations.md']) {
    expect(read(path), path).toContain('workspace-hygiene.md#safe-deletion');
  }
});

test('safe deletion contract limits shell targets and preserves prompt holds', () => {
  const safe = hygiene().split('## Safe deletion')[1]?.split('\n## ')[0] ?? '';
  expect(safe).toMatch(/literal absolute path|\$\{VAR:\?\}/i);
  // Exact safety pin for the command, validation prerequisite, and literal target.
  expect(safe).toContain('For validated owned scratch, use `rm -r /tmp/<dispatch-key>/scratch` on a literal absolute path inside the evidence folder, `TMPDIR`, or worktree.');
  expect(safe).toMatch(/own evidence folder.*TMPDIR.*worktree/is);
  expect(safe).toMatch(/bare `\$VAR`.*glob on a\s+variable.*`\/`.*`HOME`.*shared root/is);
  expect(safe).toMatch(/git clean -- <exact prefix>.*tool-native cleanup/is);
  expect(safe).toMatch(/safety prompt.*hold/is);
});

test('packaged instructions exclude the rejected force-recursive scratch command', () => {
  for (const path of readdirSync(`${import.meta.dir}/../../skills`, { recursive: true })) {
    if (path.endsWith('.md')) expect(read(`skills/${path}`), path).not.toMatch(/\brm\s+-rf\b/);
  }
});
