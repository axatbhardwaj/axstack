import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

function sentence(path, anchor) {
  const text = read(path).replace(/\s+/g, ' ');
  const start = text.indexOf(anchor);
  expect(start, `${path}: missing ${anchor}`).toBeGreaterThanOrEqual(0);
  const end = text.slice(start).search(/\.(?=\s|$)/);
  expect(end, `${path}: unbounded ${anchor}`).toBeGreaterThanOrEqual(0);
  return text.slice(start, start + end + 1);
}

function claim(path, anchor, pattern) {
  expect(sentence(path, anchor), `${path}: ${anchor}`).toMatch(pattern);
}

test('merge authority is limited to the approved chat-run driver', () => {
  claim('AGENTS.md', 'Only the chat-run driver', /auto-merge.*integration.*full merge predicate/);
  claim('skills/axstack/references/contracts.md', 'Only the chat-run driver', /approved ticket map.*auto-merge.*integration.*human approval/);
  claim('skills/axstack/references/contracts.md', 'Workers, reviewers, managers', /automations.*standalone watch never merge/);
  claim('skills/axstack/references/lifecycle.md', 'Only the chat-run driver holding', /approved ticket map.*auto-merge.*integration.*full merge predicate/);
  claim('skills/axstack/references/lifecycle.md', 'The user merges peer PRs', /deploying bases.*managers, workers, and automations never merge/);
  claim('skills/axstack/references/lifecycle.md', 'An eligible chat-run driver', /full predicate; otherwise the user merges/);
  claim('skills/axstack-review/SKILL.md', 'The chat-run driver alone', /merge eligible integration PRs.*full predicate/);
  claim('skills/axstack-review/SKILL.md', 'Their approval is one term', /never merge authority by itself/);
  claim('skills/axstack/references/automations.md', 'No manager, automation coordinator', /worker may merge.*mutate a PR branch/);
  claim('skills/axstack/references/automations.md', 'The user merges PRs handled', /auto-merge authority never transfers to them/);
  claim('skills/axstack-watch/references/watch-runtime.md', 'Only the chat-run driver', /auto-merge.*integration.*full predicate; the user merges deploying-base and peer PRs/);
  claim('skills/axstack-audit/SKILL.md', 'Only the chat-run driver', /auto-merge.*integration.*full predicate; the user merges peer PRs and PRs into deploying bases/);
  claim('skills/axstack-audit/SKILL.md', 'the authorized delivery path', /same merge predicate.*eligible self-improvement PRs; the user merges peer PRs and deploying-base PRs/);
  claim('README.md', 'Only the chat-run driver', /auto-merge.*integration PRs after human approval and all checks/);
});

test('weekly automation and delegated roles never merge', () => {
  claim('skills/axstack/references/test-audit-weekly.md', 'The user merges the weekly', /test-audit PR.*integration base/);
  claim('skills/axstack/references/test-audit-weekly.md', 'Automations and workers', /never merge/);
  claim('docs/workflows.md', 'Workers never push', /never push or merge/);
  claim('docs/workflows.md', 'The user merges the weekly', /test-audit PR.*integration base/);
  claim('skills/axstack/references/lifecycle.md', 'Standalone owners never merge', /user merges their PRs/);
});

test('decision records, approval modes, relay, and release diligence keep their values', () => {
  const record = read('skills/axstack/references/run-record.md');
  const field = (name) => record.split('\n').find((line) => line.startsWith(name));
  expect(field('Approval mode:')).toMatch(/solo \| team; collaborator readback receipt/);
  expect(field('Deploying bases:')).toMatch(/integration \| deploying; docs\/workflow evidence/);
  expect(field('Next:')).toMatch(/last receipt time; next action; hold or none/);
  expect(field('PR digest watermarks:')).toMatch(/repo -> absolute path inside this private run record/);
  claim('docs/workflows.md', 'For merges, team mode', /counted forge review.*non-author collaborator with write, maintain, or admin permission; solo mode requires the user's chat reply naming the PR or stack/);
  claim('skills/axstack-relay/SKILL.md', 'A solo-repository merge card', /user-decision hold.*relaying the card never counts as chat approval or merge authority/);
  claim('skills/axstack/references/candidate-publication.md', 'Review, diligence, and human approval', /cover that same head/);
  claim('skills/axstack/references/diligence.md', 'For release preparation', /final PR's version bump.*merged PRs before its merge card/);
});

test('own-PR and audit scenarios use the guarded merge boundary', () => {
  const watch = JSON.parse(read('tests/workflows/chat-run-watch-scenarios.json'));
  const audit = JSON.parse(read('tests/workflows/audit-scenarios.json'));
  expect(watch.cases.find(({ id }) => id === 'maintenance-loop-until-ready').expected)
    .toMatch(/chat-run driver.*full merge predicate/);
  expect(audit.cases.find(({ id }) => id === 'automatic-self-edit-request').spec_ref)
    .toMatch(/chat-run driver.*full merge predicate/);
});
