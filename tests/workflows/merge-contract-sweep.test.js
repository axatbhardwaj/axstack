import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8').replace(/\s+/g, ' ');

test('merge authority stays with the chat-run driver for eligible integration PRs', () => {
  for (const path of [
    'AGENTS.md', 'skills/axstack/references/contracts.md',
    'skills/axstack/references/lifecycle.md', 'docs/workflows.md', 'README.md',
  ]) {
    const text = read(path);
    expect(text, path).toMatch(/chat-run driver/i);
    expect(text, path).toMatch(/integration/i);
    expect(text, path).toMatch(/(?:deploying|production)[^.]*user merges|user merges[^.]*deploying/i);
  }
});

test('report-only and delegated roles cannot inherit merge authority', () => {
  expect(read('skills/axstack/references/automations.md'))
    .toMatch(/No manager[^.]*worker may merge/i);
  expect(read('skills/axstack-review/SKILL.md')).toMatch(/reviewers never merge/i);
  expect(read('skills/axstack-audit/SKILL.md')).toMatch(/Act as a non-author, read-only reader/i);
  expect(read('skills/axstack-audit/SKILL.md')).toMatch(/Perform no[^.]*automatic merge/i);
  expect(read('skills/axstack/references/lifecycle.md')).toMatch(/Standalone owners never merge/i);
  for (const path of [
    'skills/axstack/references/test-audit-weekly.md',
    'skills/axstack-watch/references/watch-runtime.md',
  ]) expect(read(path), path).toMatch(/chat-run driver[^.]*integration/i);
});

test('run template records the merge decision inputs', () => {
  const text = read('skills/axstack/references/run-record.md');
  expect(text).toMatch(/Approval mode:.*solo.*team/i);
  expect(text).toMatch(/Deploying bases:/i);
  expect(text).toMatch(/PR digest watermarks:/);
  expect(text).toMatch(/Next:.*last receipt time.*next action.*hold/i);
});

test('docs distinguish team forge review from solo chat approval', () => {
  const text = read('docs/workflows.md');
  expect(text).toMatch(/team mode requires a counted forge review[^.]*non-author collaborator/i);
  expect(text).toMatch(/solo mode requires the user's chat reply naming the PR or stack/i);
});
