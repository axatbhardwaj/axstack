import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const contract = () => read('skills/axstack/references/automations.md').replace(/\s+/g, ' ');

// Source-contract regression checks, not model or live-runtime proof.
test('scheduled passes isolate retirement without narrowing lane-wide admission', () => {
  const text = contract();
  expect(text).toContain('new isolated workspace for every scheduled pass');
  expect(text).toContain('across all workspaces belonging to the same automation');
  expect(text).toContain('outside disposable manager workspaces');
  expect(text).toContain('never infer lane ownership from an empty local workspace');
  expect(text).toContain('Do not use `--reuse-session`');
});

test('bulk retirement is allowed only in the verified disposable pass workspace', () => {
  const text = contract();
  expect(text).toContain('terminal close --worktree id:<exact-native-workspace-id> --all --json');
  expect(text).toContain('Never bulk-close a shared manager workspace or a PR-job worktree');
  expect(text).toContain('If an unexpected terminal or user takeover is present, do not bulk-close');
  expect(text).toContain('A failed or uncertain close is not proof of retirement');
});

test('retention failure stops future scheduled growth and exit proof permits recovery', () => {
  const text = contract();
  expect(text).toContain('three or more unreclaimed earlier pass workspaces');
  expect(text).toContain('disable only this automation through the native CLI');
  expect(text).toContain('confirmed native process exit');
  expect(text).toContain('Absence or saved retirement intent alone is insufficient');
});

test('manual invocations do not enter scheduled lifecycle', () => {
  for (const skill of ['review', 'watch']) {
    const text = read(`skills/axstack-${skill}/SKILL.md`);
    expect(text).toContain('Manual invocation does not enter the scheduled manager lifecycle');
    expect(text).toContain('never close the user’s chat or workspace');
  }
});

test('retention counts leftovers only after routine safe reclamation', () => {
  const text = contract();
  const reclaim = text.indexOf('reclaim every safely removable earlier pass workspace');
  const recount = text.indexOf('re-list and count only the earlier pass workspaces still remaining');
  const pause = text.indexOf('If three or more unreclaimed earlier pass workspaces remain');
  expect(reclaim).toBeGreaterThan(-1);
  expect(recount).toBeGreaterThan(reclaim);
  expect(pause).toBeGreaterThan(recount);
  expect(text).toContain('do not wait for the three-workspace threshold to start cleanup');
  expect(text).toContain('Save confirmed exit and ownership-release receipts before removing each workspace');
});
