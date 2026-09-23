import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const contract = () => read('skills/axstack/references/workspace-hygiene.md');

const rules = [
  /intermediate completion[\s\S]*accepted[\s\S]*releases[\s\S]*fresh native terminal[\s\S]*descendants first/i,
  /final settlement[\s\S]*other repositories[\s\S]*hold with its reason/i,
  /author worktree and session until merge/i,
  /native ownership by Run, Task,[\s\S]*Dispatch[\s\S]*creator closes/i,
  /manual chats, automation dedicated workspaces, and genuine[\s\S]*`user_takeover`[\s\S]*never removed/i,
  /deleting a session means closing[\s\S]*terminal; agent chat history is not deleted/i,
  /<run dir>\/evidence\/<dispatch>\/[\s\S]*dispatch brief and completion receipt[\s\S]*Peer[\s\S]*reviewers/i,
  /Authors commit the candidate before reporting[\s\S]*done/i,
  /salvage ref[\s\S]*git add -A[\s\S]*git bundle[\s\S]*git bundle verify[\s\S]*path, bundle SHA-256, and salvage commit SHA/i,
  /failed verify holds[\s\S]*Never[\s\S]*author worktree before merge/i,
  /ignored non-cache files[\s\S]*submodule changes[\s\S]*outside[\s\S]*worktree hold/i,
  /Drivers only sweep on phase-skill entry; dispatched workers never sweep/i,
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
});

test('eleven cleanup scenarios have distinct inputs and contract-covered outcomes', () => {
  const fixture = JSON.parse(read('tests/workflows/workspace-hygiene-scenarios.json'));
  expect(fixture.cases).toHaveLength(11);
  expect(new Set(fixture.cases.map(({ id }) => id)).size).toBe(11);
  for (const { id, input, expected, contractPattern } of fixture.cases) {
    expect(input.length, id).toBeGreaterThan(20);
    expect(expected.length, id).toBeGreaterThan(5);
    expect(contract(), id).toMatch(new RegExp(contractPattern, 'is'));
  }
});
