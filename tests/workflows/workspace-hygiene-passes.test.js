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
  expect(record).toMatch(/every admitted pass overwrites[^.]*four[^.]*sections/i);
  expect(record).toMatch(/read back[^.]*before[^.]*terminal close/i);
  expect(record).toMatch(/superseded history[^.]*once[^.]*separate[^.]*history file[^.]*beside/i);
  expect(record).toMatch(/no change[^.]*at most one line/i);
  expect(record).toMatch(/60 lines[^.]*normal budget[^.]*not a truncation rule/i);
  expect(record).toMatch(/open holds[^.]*watermarks[^.]*never dropped/i);
  expect(manager).toContain('[Review-manager continuity template](run-record.md#review-manager-continuity-template)');
  expect(prompt).toContain('run-record.md#review-manager-continuity-template');
});

test('task-owned watch pass closes only its receipt terminal as final action', () => {
  const runtime = read('skills/axstack-watch/references/watch-runtime.md');
  expect(runtime).toMatch(/task-owned[^.]*automation pass/i);
  expect(runtime).not.toMatch(/save[^.]*observation continuity/i);
  expect(runtime).toContain('orca terminal close --terminal <exact handle from the run receipt> --json');
  expect(runtime).toMatch(/terminal close[^.]*final action/i);
  expect(runtime).toMatch(/never[^.]*--all[^.]*another terminal[^.]*shared workspace/i);
  expect(runtime).toMatch(/pass start[\s\S]*?read-only chat-run observer[^.]*reports[^.]*finished predecessor terminals/i);
  expect(runtime).toMatch(/own close[^.]*runtime_error[^.]*next pass[^.]*not a hold/i);
});

test('scheduled passes sweep recorded repositories after predecessor cleanup', () => {
  const hygiene = read('skills/axstack/references/workspace-hygiene.md').replace(/\s+/g, ' ');
  const manager = read('skills/axstack/references/automations.md').replace(/\s+/g, ' ');
  const watch = read('skills/axstack-watch/references/watch-runtime.md').replace(/\s+/g, ' ');

  expect(hygiene).toMatch(/scheduled pass[^.]*owns its lane[^.]*recorded cleanup authority[^.]*repositories listed in its run record/i);
  expect(hygiene).toMatch(/merged or closed PR[^.]*head commit is retrievable from the forge[^.]*PR's recorded head[^.]*remote branch[^.]*unverifiable[^.]*hold/i);
  expect(hygiene).toMatch(/author worktree[^.]*salvage first if dirty/i);
  expect(hygiene).toMatch(/phase-skill entry[^.]*chat and run record/i);
  expect(hygiene).toMatch(/Both are silent when nothing was removed/i);
  expect(manager).toMatch(/pass start[\s\S]*?finished predecessor terminals[\s\S]*?then run the driver-start orphan sweep/i);
  expect(manager).toMatch(/sweep[^.]*silent when nothing was removed/i);
  expect(manager).toMatch(/sweep results[^.]*continuity[^.]*Open holds/i);
  expect(manager).toMatch(/session admission[\s\S]*?pass-start predecessor cleanup and sweep[^.]*before discovery or admission/i);
  expect(watch).toMatch(/read-only chat-run observer[^.]*axstack-monitor[^.]*reports[^.]*leftovers[^.]*never salvage or remove/i);
});

test('watch sweep needs cleanup authority independent of repair authority', () => {
  const watch = read('skills/axstack-watch/references/watch-runtime.md').replace(/\s+/g, ' ');
  expect(watch).toMatch(/task-owned watch[^.]*recorded cleanup authority[\s\S]*?driver-start orphan sweep/i);
  expect(watch).toMatch(/cleanup authority[^.]*separate from[^.]*does not imply[^.]*repair or maintenance authority/i);
});

test('lane-owning watch pass records its own sweep results', () => {
  const hygiene = read('skills/axstack/references/workspace-hygiene.md').replace(/\s+/g, ' ');
  const watch = read('skills/axstack-watch/references/watch-runtime.md').replace(/\s+/g, ' ');
  expect(hygiene).toMatch(/cleanup-authorized watch pass[^.]*continuity[^.]*Open holds/i);
  expect(watch).toMatch(/cleanup-authorized[^.]*pass[^.]*silent when nothing was removed[^.]*continuity[^.]*Open holds/i);
});

test('author retention ends when its PR merges or closes', () => {
  expect(read('skills/axstack-cleanup/SKILL.md')).toMatch(/Keep an author worktree until its PR merges or closes/i);
  expect(read('skills/axstack-implement/SKILL.md')).toMatch(/Keep the author candidate until its PR merges or\s+closes/i);
});
