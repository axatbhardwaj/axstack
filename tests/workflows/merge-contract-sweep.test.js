import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

function sentence(path, anchor, after = '') {
  const text = read(path).replace(/\s+/g, ' ');
  const scope = after ? text.indexOf(after) : 0;
  expect(scope, `${path}: missing section ${after}`).toBeGreaterThanOrEqual(0);
  const start = text.indexOf(anchor, scope);
  expect(start, `${path}: missing ${anchor}`).toBeGreaterThanOrEqual(0);
  const end = text.slice(start).search(/\.(?=\s|$)/);
  expect(end, `${path}: unbounded ${anchor}`).toBeGreaterThanOrEqual(0);
  return text.slice(start, start + end + 1);
}

function claim(path, anchor, pattern, after) {
  expect(sentence(path, anchor, after), `${path}: ${anchor}`).toMatch(pattern);
}

test('merge authority is limited to the approved chat-run driver', () => {
  claim('AGENTS.md', 'Workers do not push', /submit, merge, publish, or release/);
  claim('AGENTS.md', 'Only the chat-run driver', /auto-merge.*integration.*full merge predicate; the user merges peer PRs and PRs into deploying bases/);
  claim('AGENTS.md', 'Whole eligible stacks', /merge together/);
  claim('skills/axstack/references/contracts.md', 'Only the chat-run driver', /approved ticket map.*run-created or explicitly adopted own PRs.*integration.*human approval/);
  claim('skills/axstack/references/contracts.md', 'The user merges peer PRs', /PRs into deploying bases/);
  claim('skills/axstack/references/contracts.md', 'Workers, reviewers, managers', /automations.*standalone watch never merge/);
  claim('skills/axstack/references/contracts.md', 'Review approval and reviewer votes', /alone never grant mutation or merge authority/);
  claim('skills/axstack/references/lifecycle.md', 'Only the chat-run driver holding', /approved ticket map.*auto-merge.*integration.*full merge predicate/);
  claim('skills/axstack/references/lifecycle.md', 'The user merges peer PRs', /deploying bases.*managers, workers, and automations never merge/);
  claim('skills/axstack/references/lifecycle.md', 'An eligible chat-run driver', /full predicate; otherwise the user merges/);
  claim('skills/axstack-review/SKILL.md', 'reviewers never merge', /never merge/);
  claim('skills/axstack-review/SKILL.md', 'The chat-run driver alone', /merge eligible integration PRs.*full predicate; the user merges peer PRs and deploying-base PRs/);
  claim('skills/axstack-review/SKILL.md', 'Reviewers never merge', /never merge/);
  claim('skills/axstack-review/SKILL.md', 'Their approval is one term', /never merge authority by itself/);
  claim('skills/axstack-review/SKILL.md', 'The user merges peer PRs', /PRs into deploying bases/, 'Their approval is one term');
  claim('skills/axstack/references/automations.md', 'No manager, automation coordinator', /worker may merge.*mutate a PR branch/);
  claim('skills/axstack/references/automations.md', 'The user merges PRs handled', /auto-merge authority never transfers to them/);
  claim('skills/axstack-watch/references/watch-runtime.md', 'Only the chat-run driver', /auto-merge.*integration.*full predicate; the user merges deploying-base and peer PRs/);
  claim('skills/axstack-audit/SKILL.md', 'Only the chat-run driver', /auto-merge.*integration.*full predicate; the user merges peer PRs and PRs into deploying bases/);
  claim('skills/axstack-audit/SKILL.md', 'The user-chosen improvement mode', /tested, independently reviewed PR/);
  claim('skills/axstack-audit/SKILL.md', 'the authorized delivery path', /same merge predicate.*eligible self-improvement PRs; the user merges peer PRs and deploying-base PRs/);
  claim('README.md', 'Only the chat-run driver', /auto-merge.*integration PRs after human approval and all checks; the user merges peer PRs and PRs into deploying bases/);
  claim('README.md', 'Missing authority', /unavailable models.*serious risks surface as holds/);
  claim('README.md', '| Agents left a mess |', /Orca.*one writer.*cleanup.*only the chat-run driver may auto-merge eligible integration PRs/);
  claim('README.md', 'The user merges peer PRs', /PRs into deploying bases/, '## Some notes');
  claim('README.md', 'Only the chat-run driver', /auto-merge eligible integration PRs under the full predicate/, '## Some notes');
});

test('weekly automation and delegated roles never merge', () => {
  claim('skills/axstack/references/test-audit-weekly.md', 'The user merges the weekly', /test-audit PR, including one into an integration base/);
  claim('skills/axstack/references/test-audit-weekly.md', 'The driver uses', /`gh stack` and opens at most one test-audit PR per week after independent review/);
  claim('skills/axstack/references/test-audit-weekly.md', 'Automations and workers', /never merge/);
  claim('docs/workflows.md', 'Workers never push', /never push or merge/);
  claim('docs/workflows.md', 'The user merges the weekly', /test-audit PR, including one into an integration base; automations never merge/);
  claim('skills/axstack/references/lifecycle.md', 'Standalone owners never merge', /user merges their PRs/);
  claim('docs/workflows.md', 'Only the chat-run driver', /holding the approved ticket map.*auto-merge.*integration PRs after human approval and the full predicate/, 'One Orca execution host');
  claim('docs/workflows.md', 'The user merges peer PRs', /PRs into deploying bases; review approval alone never grants merge authority/, 'One Orca execution host');
  claim('docs/workflows.md', 'Only the chat-run driver', /auto-merge eligible integration PRs after approval and the full predicate; the user merges peer PRs and PRs into deploying bases/, '## Chat-run PR watch');
  claim('docs/workflows.md', 'Only the chat-run driver', /auto-merge eligible integration PRs after the full predicate; the user merges peer PRs and PRs into deploying bases/, 'The watch lasts until');
  claim('docs/workflows.md', 'managers and workers never merge', /never merge/);
  claim('docs/workflows.md', 'The user merges PRs', /handled by this automation/);
  claim('docs/workflows.md', 'a task, PR, resource, or operation hold', /blocks its affected dependencies/);
  claim('docs/workflows.md', 'The human approves substantial specs', /approves substantial specs/);
  claim('docs/workflows.md', 'The current release path', /user to merge its release PR and approve the npm stage until the tag-only release change lands/);
  claim('docs/workflows.md', 'Run-wide holds', /stop the run; a task, PR, resource, or operation hold blocks its affected dependencies/);
  claim('docs/workflows.md', 'Bounded jobs publish ordinary', /exact-head review verdicts; managers and workers never merge/);
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
  claim('skills/axstack/references/candidate-publication.md', "Before the final version-bump PR's merge card", /dispatch `axstack-diligence` under \[Diligence\]\(diligence\.md\) to compare its bump with the merged PRs/);
  claim('skills/axstack/references/candidate-publication.md', 'Release diligence runs', /final version-bump PR's immutable checkout in the same registered repo/);
  claim('skills/axstack/references/diligence.md', 'For release preparation', /final PR's version bump.*merged PRs before its merge card/);
  claim('skills/axstack/references/lifecycle.md', 'Merge-ready differs from merged', /differs from merged/);
});

test('own-PR and audit scenarios use the guarded merge boundary', () => {
  const watch = JSON.parse(read('tests/workflows/chat-run-watch-scenarios.json'));
  const audit = JSON.parse(read('tests/workflows/audit-scenarios.json'));
  expect(watch.cases.find(({ id }) => id === 'maintenance-loop-until-ready').expected)
    .toMatch(/chat-run driver.*full merge predicate/);
  expect(audit.cases.find(({ id }) => id === 'automatic-self-edit-request').spec_ref)
    .toMatch(/chat-run driver.*full merge predicate/);
  expect(watch.cases.find(({ id }) => id === 'human-approval-survives-repair').expected)
    .toMatch(/only the chat-run driver may auto-merge.*full predicate/);
  expect(audit.cases.find(({ id }) => id === 'automatic-self-edit-request').expected.record)
    .toMatch(/chat-run driver.*full merge predicate.*user merges deploying-base PRs/);
  const owned = JSON.parse(read('tests/workflows/owned-scenarios.json'));
  expect(owned.cases.find(({ id }) => id === 'adoption-authority').input.request)
    .toMatch(/the user merges this standalone PR/);
  const scenarios = JSON.parse(read('tests/workflows/scenarios.json'));
  expect(scenarios.cases.find(({ id }) => id === 'rollout-publish').expected.forbidden.join(' '))
    .toMatch(/passing tests alone as merge authority/);
});
