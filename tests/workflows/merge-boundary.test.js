import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const watch = read('skills/axstack-watch/SKILL.md');
const implement = read('skills/axstack-implement/SKILL.md');
const autopilot = read('skills/axstack/references/autopilot.md');

// Shipped prose is the interface here. These checks do not prove agent decisions
// or forge behavior; independent scenarios must exercise those separately.
test('approval mode and deploy class are recorded conservatively once per run', () => {
  expect(watch).toMatch(/collaborator readback[\s\S]*solo[\s\S]*user alone[\s\S]*write, maintain, or admin/i);
  expect(watch).toMatch(/unknown[\s\S]*team/i);
  expect(watch).toMatch(/integration[\s\S]*does not deploy to\s+production/i);
  expect(watch).toMatch(/unknown[\s\S]*deploying/i);
});

test('merge card records head and base evidence before the human gate', () => {
  expect(watch).toMatch(/merge card when every term except human approval holds/i);
  expect(watch).toMatch(/head and base SHA[\s\S]*CI[\s\S]*authored review[\s\S]*diligence/i);
  expect(watch).toMatch(/human approvals[\s\S]*bot votes[\s\S]*SHA[\s\S]*stale/i);
  expect(watch).toMatch(/solo[\s\S]*decision hold[\s\S]*one relay/i);
  expect(watch).toMatch(/relay text[\s\S]*never[\s\S]*approval/i);
});

test('team vote needs current non-author user review with write permission', () => {
  expect(watch).toMatch(/team[\s\S]*latest opinionated review[\s\S]*not dismissed/i);
  expect(watch).toMatch(/non-author[\s\S]*type `User`[\s\S]*collaborators\/\{login\}\/permission[\s\S]*write, maintain, or admin/i);
  expect(watch).toMatch(/read-only[\s\S]*does not count/i);
});

test('solo chat approval excludes machine and pasted text, and has explicit expiry', () => {
  expect(watch).toMatch(/solo[\s\S]*user turn[\s\S]*driver chat[\s\S]*PR or stack/i);
  for (const marker of ['dispatch envelope', '<pasted_content>', 'tool output', 'Telegram', 'PR text']) {
    expect(watch).toContain(marker);
  }
  expect(watch).toMatch(/solo approval persists[\s\S]*scope change[\s\S]*CHANGES_REQUESTED[\s\S]*serious-risk hold/i);
});

test('empty or skipped CI and unresolved feedback block merging', () => {
  expect(watch).toMatch(/workflows the base runs on `pull_request`[\s\S]*required check[\s\S]*conclusion `success`/i);
  expect(watch).toMatch(/at least as many jobs[\s\S]*base.*latest run/i);
  expect(watch).toMatch(/unknown or empty[\s\S]*hold/i);
  expect(watch).toMatch(/skipped[\s\S]*other apps/i);
  expect(watch).toMatch(/unresolved review thread[\s\S]*top-level blocking comment/i);
  expect(watch).toMatch(/do-not-merge[\s\S]*chat.*hold/i);
  expect(watch).toMatch(/unsettled author Dispatch[\s\S]*dependency[\s\S]*serious-risk/i);
});

test('only the chat-run driver can merge scoped integration PRs', () => {
  expect(implement).toMatch(/only the chat-run driver holding the[\s\S]*approved ticket map is the merge actor/i);
  expect(implement).toMatch(/run-created[\s\S]*explicitly adopted[\s\S]*own PRs[\s\S]*integration/i);
  expect(implement).toMatch(/peer PR or[\s\S]*deploying[\s\S]*user to merge/i);
  expect(implement).toMatch(/manager[\s\S]*worker[\s\S]*automation[\s\S]*standalone watch[\s\S]*never merge/i);
  expect(autopilot).toMatch(/audit self-improvement PRs[\s\S]*same merge predicate/i);
});

test('singleton merge rechecks the forge and uses server-enforced head guard', () => {
  expect(watch).toMatch(/immediately before each automated merge, re-read every term/i);
  expect(watch).toMatch(/merge commits[\s\S]*otherwise hold for the user/i);
  expect(watch).toMatch(/gh pr merge <n> --merge --match-head-commit <sha> --delete-branch/);
  expect(watch).toMatch(/singleton PR[\s\S]*one guarded merge/i);
});

test('merge decision scenarios remain input-only for independent evaluation', () => {
  const { cases } = JSON.parse(read('tests/workflows/merge-boundary-scenarios.json'));
  expect(cases).toHaveLength(15);
  for (const scenario of cases) {
    expect(scenario.input.length).toBeGreaterThan(50);
    expect(scenario.expected).toBeUndefined();
  }
});
