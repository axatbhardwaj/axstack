import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const contract = () => read('skills/axstack/references/workspace-hygiene.md');
const retirement = () => (
  contract().split('## Owned automation retirement')[1]?.split('\n## ')[0] ?? ''
).replace(/\s+/g, ' ');

const rules = [
  /intermediate completion[\s\S]*accepted[\s\S]*releases[\s\S]*fresh native terminal[\s\S]*descendants first/i,
  /final settlement[\s\S]*other repositories[\s\S]*hold with its reason/i,
  /author worktree and session until the PR merges or closes/i,
  /native ownership by Run, Task,[\s\S]*Dispatch[\s\S]*creator closes/i,
  /manual chats, automation dedicated workspaces, and genuine[\s\S]*`user_takeover`[\s\S]*never removed/i,
  /deleting a session means closing[\s\S]*terminal; agent chat history is not deleted/i,
  /<run dir>\/evidence\/<dispatch>\/[\s\S]*dispatch brief and completion receipt[\s\S]*Peer[\s\S]*reviewers/i,
  /Authors commit the candidate before reporting[\s\S]*done/i,
  /salvage ref[\s\S]*git add -A[\s\S]*git bundle[\s\S]*git bundle verify[\s\S]*path, bundle SHA-256, and salvage commit SHA/i,
  /failed verify holds[\s\S]*Never[\s\S]*author worktree before merge/i,
  /ignored non-cache files[\s\S]*submodule changes[\s\S]*outside[\s\S]*worktree hold/i,
  /Dispatched\s+workers never sweep[\s\S]*scheduled pass[\s\S]*lane's driver/i,
  /current repository[\s\S]*per-run worktrees in other[\s\S]*repositories/i,
  /Orca is unreachable[\s\S]*one line and continue[\s\S]*unreachable host/i,
  /every[\s\S]*owning Dispatch and descendant[\s\S]*fresh native list[\s\S]*evidence is durable/i,
  /remote counterpart are never deleted/i,
  /live or unsettled[\s\S]*user_takeover[\s\S]*Axstack provenance[\s\S]*table/i,
  /repair-labelled[\s\S]*repair Dispatch ID[\s\S]*otherwise hold/i,
  /release_unknown[\s\S]*native worker inspection[\s\S]*fresh[\s\S]*terminal list[\s\S]*otherwise hold/i,
];

test('workspace hygiene contract covers settlement, preservation, sweep, and bookkeeping', () => {
  for (const rule of rules) expect(contract()).toMatch(rule);
});

test('existing workflow entry points point to the shared contract', () => {
  for (const path of ['lifecycle.md', 'routing.md', 'orca-runtime.md', 'run-record.md']) {
    expect(read(`skills/axstack/references/${path}`)).toContain('workspace-hygiene.md');
  }
  expect(read('skills/axstack-cleanup/SKILL.md')).toContain('workspace-hygiene.md');
  expect(read('skills/axstack/references/routing.md')).toContain('Choose a route; load only the phase and references needed next.');
  const phases = ['align', 'audit', 'debug', 'explain', 'implement', 'improve', 'research', 'review', 'spec', 'tickets', 'watch'];
  for (const phase of phases) {
    const text = read(`skills/axstack-${phase}/SKILL.md`);
    expect(text, phase).toMatch(/driver entry[^;]*workspace-hygiene\.md/i);
    expect(text, phase).toMatch(/dispatch brief[^.]*<run dir>\/evidence\/<dispatch>\//i);
  }
  const record = read('skills/axstack/references/run-record.md');
  expect(record).toMatch(/Worktrees in other repositories: <per-run repository and worktree IDs or none>/);
  for (const path of ['lifecycle.md', 'routing.md']) {
    expect(Buffer.byteLength(read(`skills/axstack/references/${path}`))).toBeLessThan(7800);
  }
  expect(Buffer.byteLength(read('skills/axstack/references/lifecycle.md'))).toBeLessThan(7750);
});

test('cleanup scenarios have distinct inputs and contract-covered outcomes', () => {
  const fixture = JSON.parse(read('tests/workflows/workspace-hygiene-scenarios.json'));
  expect(fixture.cases).toHaveLength(20);
  expect(new Set(fixture.cases.map(({ id }) => id)).size).toBe(20);
  for (const { id, input, expected, contractPattern } of fixture.cases) {
    expect(input.length, id).toBeGreaterThan(20);
    expect(expected.length, id).toBeGreaterThan(5);
    expect(contract().replace(/\s+/g, ' '), id).toMatch(new RegExp(contractPattern, 'is'));
  }
});

test('owned watch removal is part of close-out and watch stop', () => {
  const lifecycle = read('skills/axstack/references/lifecycle.md');
  const watch = read('skills/axstack-watch/references/watch-runtime.md');
  const skill = read('skills/axstack-watch/SKILL.md');
  expect(lifecycle.split('## Close-out')[1]).toMatch(/remove[^.]*run's own automations[^.]*Workspace hygiene/i);
  const chat = watch.split('## Chat-run watch')[1];
  expect(chat).toMatch(/observer may\s+disable only its own automation[^.]*verify native disable\/readback/i);
  expect(chat).toMatch(/driver removes the automation by exact ID[^.]*verifies absence[^.]*dedicated workspace after the observer terminal closes/i);
  expect(skill).toMatch(/own-automation disable\/readback and driver-owned automation\s+removal/i);
});

test('standalone watch owner removes its own stopped automation', () => {
  const standalone = read('skills/axstack-watch/references/watch-runtime.md').split('## Standalone watch')[1]?.split('## Chat-run watch')[0] ?? '';
  expect(standalone).toMatch(/owner[^.]*disable[^.]*read back[^.]*remove[^.]*exact ID/i);
});

test('automation retirement proves the recorded owning Run created the exact ID', () => {
  expect(retirement()).toMatch(/Close-out[^.]*recorded owning Run[^.]*created[^.]*automation IDs/i);
});

test('automation retirement disables and reads back before exact-ID removal', () => {
  expect(retirement()).toMatch(/disable[^.]*verify native readback[^.]*before[^.]*`orca automations remove <id>`/i);
  expect(retirement()).toMatch(/`orca automations remove <id>`[^.]*verify absence by native readback/i);
});

test('automation retirement holds uncertain recorded ownership and watch state', () => {
  expect(retirement()).toMatch(/uncertain recorded ownership[^.]*watch state[^.]*disable result[^.]*holds/i);
});

test('automation workspace removal retains all four guards and rechecks liveness', () => {
  expect(retirement()).toMatch(/exact ownership[^.]*no live terminal[^.]*clean worktree[^.]*head on the remote/i);
  expect(retirement()).toMatch(/Recheck ownership and liveness immediately before workspace removal/i);
  expect(retirement()).toMatch(/dirty or unpublished[^.]*salvage[^.]*failed verification[^.]*hold/i);
});

test('durable and user automation workspaces remain protected', () => {
  expect(retirement()).toMatch(/durable review manager and its dedicated workspace/i);
  expect(retirement()).toMatch(/user-created automation and its dedicated workspace/i);
  expect(retirement()).toMatch(/only[^.]*retired owned per-run watch's workspace/i);
  expect(retirement()).not.toMatch(/(?:may|can|permitted to)[^.]*remove[^.]*review manager[^.]*workspace|review manager[^.]*workspace[^.]*may be removed/i);
});

test('cross-run sweep keeps quiet, provenance, and phase guards', () => {
  const hygiene = contract();
  expect(hygiene).toMatch(/ANY Axstack run on this host[\s\S]*every owning Dispatch[^.]*settled[^.]*release[^.]*`release_unknown`[^.]*60 minutes/i);
  expect(hygiene).toMatch(/shared or driver worktree[\s\S]*close[^.]*individually[\s\S]*driver's own terminal[^.]*user chat/i);
  expect(hygiene).toMatch(/Align\/Spec adviser[^.]*phase approves or stops/i);
  expect(hygiene).toMatch(/genuine `user_takeover`[^.]*Axstack provenance/i);
  expect(hygiene).toMatch(/Dirty or unpublished[^.]*open-PR authors/i);
  expect(read('skills/axstack/references/automations.md')).toMatch(/sweep[\s\S]*any Axstack run on this host/i);
  expect(read('skills/axstack-watch/references/watch-runtime.md')).toMatch(/sweep[\s\S]*any Axstack run on this host/i);
});

test('cross-run removal requires an idle agent and resolves release_unknown explicitly', () => {
  const sweep = (contract().split('## Driver-start orphan sweep')[1]?.split('## Native bookkeeping exceptions')[0] ?? '').replace(/\s+/g, ' ');
  const bookkeeping = contract().split('## Native bookkeeping exceptions')[1]?.split('## Known Orca issues')[0] ?? '';
  expect(sweep).toMatch(/release is confirmed or `release_unknown`, no agent is working, the exact terminal[^.]*60 minutes/i);
  expect(bookkeeping).toMatch(/For `release_unknown`[\s\S]{0,250}otherwise hold unless inspection proves a settled, quiet worker[\s\S]{0,100}close only that worker's exact terminal under the sweep rule and confirm its\s+absence/i);
  expect(bookkeeping).toMatch(/Unknown liveness holds\./);
});

test('sweep releases settled merged authors and protects every coordinator terminal', () => {
  const sweep = (contract().split('## Driver-start orphan sweep')[1]?.split('## Native bookkeeping exceptions')[0] ?? '').replace(/\s+/g, ' ');
  expect(sweep).toMatch(/merged or closed PR author[^.]*unreleased settled Dispatch[^.]*native worker release first[^.]*then apply the sweep guards/i);
  expect(sweep).toMatch(/Never close the live coordinator session's terminal for any run[^.]*user chat/i);
});

test('scheduled sweep scope and duplicate manager boundaries are explicit', () => {
  const hygiene = contract();
  const manager = read('skills/axstack/references/automations.md');
  const watch = read('skills/axstack-watch/references/watch-runtime.md');
  const cleanup = read('skills/axstack-cleanup/SKILL.md');
  for (const text of [hygiene, manager, watch].map((value) => value.replace(/\s+/g, ' '))) {
    expect(text).toMatch(/repositories listed in (?:its|this lane's) run record[^.]*registered repositories on this host[^.]*eligible settled resources/i);
  }
  expect(manager.replace(/\s+/g, ' ')).toMatch(/Once identified as a duplicate[^.]*no further shared-record write[^.]*no live or unsettled resource owned by the live manager/i);
  expect(cleanup).toMatch(/Driver-start orphan sweeps follow the guarded cross-run sweep in\s*\[Workspace hygiene\]/i);
});

test('sidebar contract names roles, records status checkpoints, and limits lineage', () => {
  const text = contract().replace(/\s+/g, ' ');
  for (const name of ['<run> driver', '<run> author #<pr>', '<run> review #<pr> r<n>']) {
    expect(text).toContain(name);
  }
  expect(text).toMatch(/orca worktree set --display-name/i);
  expect(text).toMatch(/primary.*secondary/i);
  expect(text).toMatch(/authors carry no round number/i);
  expect(text).toMatch(/task ID.*before a PR number exists/i);
  expect(text).toMatch(/--comment.*dispatch.*settlement.*verdict.*short SHA.*hold/is);
  expect(text).toMatch(/--workspace-status.*never.*completed.*hold/is);
  expect(text).toMatch(/reviewer under.*author.*author under.*driver.*same repository/is);
  expect(text).toMatch(/dependency order.*names.*gh stack/is);
  expect(text).toMatch(/cross-repository parents.*silently dropped/is);
  expect(text).toMatch(/remote.*new-child.*invalid/is);
});

test('sidebar reviewer qualifiers apply only to peer reviews', () => {
  const sidebar = contract().split('## Readable sidebar')[1];
  expect(sidebar).toMatch(/Peer reviewers[^.]*primary[^.]*secondary/i);
  expect(sidebar).toMatch(/authored reviewers[^.]*no[^.]*primary[^.]*secondary[^.]*qualifier/i);
  expect(sidebar).toMatch(/authors carry no round number/i);
});

test('finished agent-terminal close failure has an exact guarded fallback', () => {
  const text = contract();
  expect(text).toMatch(/runtime_error[\s\S]*\/quit[\s\S]*5 seconds[\s\S]*exit[\s\S]*fresh native terminal list/i);
  expect(text).toMatch(/never[^.]*working[^.]*user.taken.over[^.]*unclear agent/i);
  expect(text).toMatch(/Known Orca issues[\s\S]*upstream reporting[\s\S]*Orca 1\.4\.209[\s\S]*session:set/i);
});

test('safe deletion contract limits shell targets and preserves prompt holds', () => {
  const safe = contract().split('## Safe deletion')[1]?.split('\n## ')[0] ?? '';
  expect(safe).toMatch(/literal absolute path|\$\{VAR:\?\}/i);
  expect(safe).toContain('rm -rf -- "${EV:?}/mut"');
  expect(safe).toMatch(/own evidence folder.*TMPDIR.*worktree/is);
  expect(safe).toMatch(/bare `\$VAR`.*glob on a\s+variable.*`\/`.*`HOME`.*shared root/is);
  expect(safe).toMatch(/git clean -- <exact prefix>.*tool-native cleanup/is);
  expect(safe).toMatch(/safety prompt.*hold/is);
});

test('author, reviewer, runtime, and PR job briefs carry safe deletion rule', () => {
  for (const path of [
    'skills/axstack/references/orca-runtime.md',
    'skills/axstack-implement/SKILL.md',
    'skills/axstack-review/SKILL.md',
    'skills/axstack/references/automations.md',
  ]) {
    expect(read(path), path).toContain('workspace-hygiene.md#safe-deletion');
  }
});

test('worker dispatch entry points link the sidebar contract', () => {
  for (const path of [
    'skills/axstack/references/orca-runtime.md',
    'skills/axstack-implement/SKILL.md',
    'skills/axstack-review/SKILL.md',
    'skills/axstack-watch/references/watch-runtime.md',
    'skills/axstack/references/automations.md',
  ]) {
    expect(read(path), path).toContain('workspace-hygiene.md#readable-sidebar');
  }
});
