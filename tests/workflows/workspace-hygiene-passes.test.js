import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');

test('review manager uses one fixed current-state template and a separate history file', () => {
  const record = read('skills/axstack/references/run-record.md');
  const manager = read('skills/axstack/references/automations.md');
  const prompt = read('skills/axstack/references/review-manager-prompt.md');
  const template = record.split('## Review-manager continuity template')[1]?.split('```markdown\n')[1]?.split('```')[0];

  expect(template, 'single Markdown template in run-record.md').toBeTruthy();
  for (const section of ['Lane state', 'Open holds', 'Watermarks', 'Last pass']) {
    expect(template).toContain(`## ${section}\n`);
  }
  expect(record).toMatch(/each pass overwrites[^.]*four[^.]*sections/i);
  expect(record).toMatch(/read back[^.]*before[^.]*terminal close/i);
  expect(record).toMatch(/superseded history[^.]*once[^.]*separate[^.]*history file[^.]*beside/i);
  expect(record).toMatch(/no change[^.]*at most one line/i);
  expect(record).toMatch(/60 lines[^.]*normal budget[^.]*not a truncation rule/i);
  expect(record).toMatch(/open holds[^.]*watermarks[^.]*never dropped/i);
  expect(manager).toContain('[Review-manager continuity template](run-record.md#review-manager-continuity-template)');
  expect(prompt).toContain('run-record.md#review-manager-continuity-template');
});

test('task-owned watch pass saves continuity then closes only its receipt terminal', () => {
  const runtime = read('skills/axstack-watch/references/watch-runtime.md');
  expect(runtime).toMatch(/task-owned[^.]*automation pass/i);
  expect(runtime).toMatch(/save[^.]*continuity[^.]*read\s+back[^.]*before[^.]*terminal close/i);
  expect(runtime).toContain('orca terminal close --terminal <exact handle from the run receipt> --json');
  expect(runtime).toMatch(/terminal close[^.]*final action/i);
  expect(runtime).toMatch(/never[^.]*--all[^.]*another terminal[^.]*shared workspace/i);
});
