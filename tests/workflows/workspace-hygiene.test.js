import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';
const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();

const hygiene = () => read('skills/axstack/references/workspace-hygiene.md');
// Independent settlement decisions: accepting completion changes visibility,
// while retention, failures and repair ownership keep their existing meaning.
const completionRules = [
  {
    name: 'accepted completion settles launched writers and delegated tasks',
    concepts: [/after/i, /driver/i, /\baccept(?:s|ed)\b/i, /completion/i, /launched writer/i, /delegated task/i, /terminal run evidence/i, /plus/i, /verified receipt/i, /candidate check/i, /\bsettles?\b/i, /t3_thread_organize/i, /metadata only/i],
    rewording: 'The driver settles the matching thread with t3_thread_organize as metadata only after it accepts completion of a launched writer or delegated task using terminal run evidence plus a verified receipt or candidate check.',
    inversions: [[/after/i, 'before'], [/accept(?:s|ed)/i, 'rejects'], [/plus/i, 'instead of'], [/metadata only/i, 'destructive cleanup']],
    contradiction: 'and settle before acceptance',
    forbidden: /before.*accept|without.*(?:terminal|verified)|destructive/i,
  },
  {
    name: 'settling preserves thread and worktree resources',
    concepts: [/settling/i, /\bremoves?\b/i, /\barchives?\b/i, /\babandons?\b/i, /thread/i, /worktree/i],
    prohibition: /never/i,
    rewording: 'Settling never removes, archives or abandons a worktree or thread.',
    inversions: [[/never/i, 'always']],
    contradiction: 'and remove the worktree',
    forbidden: /and (?:remove|archive|abandon)\b/i,
  },
  {
    name: 'author resources remain unarchived through merge or closure',
    concepts: [/keep|retain/i, /author/i, /thread/i, /worktree/i, /unarchived/i, /until/i, /PR/i, /merges/i, /closes/i, /repairs/i, /same author/i],
    rewording: 'Retain the author thread and worktree unarchived until the PR closes or merges, returning repairs to the same author.',
    inversions: [[/unarchived/i, 'archived'], [/until/i, 'only before'], [/same author/i, 'another author']],
    contradiction: 'and archive the author thread',
    forbidden: /(?:archive|remove|abandon) the author/i,
  },
  {
    name: 'unaccepted or held completion remains visible',
    concepts: [/threads/i, /unaccepted completion/i, /FAILED or QUESTION markers/i, /held/i, /failed/i, /interrupted/i, /needing the user/i, /stay|remain/i, /\bunsettled\b/i, /visible/i],
    rewording: 'Threads needing the user, with interrupted, failed or held runs, FAILED or QUESTION markers, or unaccepted completion remain visible and unsettled.',
    inversions: [[/\bunsettled\b/i, 'settled'], [/visible/i, 'hidden'], [/unaccepted completion/i, 'accepted completion']],
    contradiction: 'and settle these threads',
    forbidden: /settle these threads/i,
  },
  {
    name: 'repair turns automatically restore visibility',
    concepts: [/repair turn/i, /automatically/i, /un-settles|unsettles/i, /thread/i, /visible/i, /working/i],
    rewording: 'A repair turn automatically unsettles the thread, making it visible while working.',
    inversions: [[/un-settles|unsettles/i, 'settles'], [/automatically/i, 'manually'], [/visible/i, 'hidden']],
    contradiction: 'and keep the working thread hidden',
    forbidden: /keep.*hidden/i,
  },
  {
    name: 'driver settles again after accepted repair completion',
    concepts: [/driver/i, /\bsettles?\b/i, /thread/i, /again/i, /after/i, /next accepted repair completion/i],
    rewording: 'After the next accepted repair completion, the driver settles the thread again.',
    inversions: [[/after/i, 'before'], [/accepted/i, 'unaccepted'], [/\bsettles?\b/i, 'unsettles']],
    contradiction: 'and leave it unsettled',
    forbidden: /leave.*unsettled/i,
  },
];
for (const rule of completionRules) test(`hygiene completion: ${rule.name}`, () => {
  const text = normalize(hygiene().split('## Settlement')[1]?.split('\n## ')[0] ?? '');
  const accepts = (source) => sentences(source).some((clause) =>
    !/unless|except/i.test(clause) && !rule.forbidden.test(clause)
    && (rule.prohibition
      ? prohibits(clause, rule.prohibition, ...rule.concepts)
      : requires(clause, ...rule.concepts)));
  checkRule(text, accepts, rule.rewording, rule.inversions, rule.concepts);
  for (const clause of sentences(text).filter(accepts)) {
    for (const escape of ['unless convenient', 'except during repairs', rule.contradiction]) {
      expect(accepts(text.replace(clause, `${clause} ${escape}`))).toBe(false);
    }
  }
});
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
  expect(normalize(manager)).toMatch(/Once identified as a duplicate[^.]*no further shared-record write[^.]*no PR-job thread or descendant owned by the live manager/i);
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
